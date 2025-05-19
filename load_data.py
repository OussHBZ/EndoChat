import logging
import time
import json
import os
from langchain_community.document_loaders.pdf import PyPDFDirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
from management.embeddings import get_embedding_function

# Define paths
CHROMA_PATH = "./chroma_db"
DATA_PATH = "./data"
PROCESSED_FILES_PATH = "./processed_files.json"

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

class PDFProcessor:
    def __init__(self):
        self.processed_files = self.load_processed_files()
        
    def load_processed_files(self):
        """Load the record of processed files"""
        if os.path.exists(PROCESSED_FILES_PATH):
            with open(PROCESSED_FILES_PATH, 'r') as f:
                return json.load(f)
        return {}
    
    def save_processed_files(self):
        """Save the record of processed files"""
        with open(PROCESSED_FILES_PATH, 'w') as f:
            json.dump(self.processed_files, f, indent=2)
            
    def needs_processing(self, pdf_path):
        """Check if a PDF needs to be processed based on modification time"""
        filename = os.path.basename(pdf_path)
        mod_time = os.path.getmtime(pdf_path)
        
        if filename not in self.processed_files:
            return True
            
        return mod_time > self.processed_files[filename]['last_processed']
        
    def get_unprocessed_pdfs(self):
        """Get list of PDFs that need processing"""
        unprocessed = []
        for filename in os.listdir(DATA_PATH):
            if not filename.lower().endswith('.pdf'):
                continue
                
            pdf_path = os.path.join(DATA_PATH, filename)
            if self.needs_processing(pdf_path):
                unprocessed.append(pdf_path)
            else:
                logging.debug(f"Skipping {filename} - already processed")
                
        return unprocessed
        
    def process_pdfs(self):
        """Process only PDFs that need updating"""
        try:
            unprocessed_pdfs = self.get_unprocessed_pdfs()
            
            if not unprocessed_pdfs:
                logging.debug("No new or modified PDFs to process")
                return True
                
            logging.debug(f"Processing {len(unprocessed_pdfs)} PDFs")
            
            # Load and process documents
            documents = self.load_documents(unprocessed_pdfs)
            if not documents:
                logging.error("No documents loaded")
                return False
                
            # Split into chunks
            chunks = self.split_documents(documents)
            if not chunks:
                logging.error("Documents not divided into chunks")
                return False
                
            # Add to Chroma
            self.add_documents_to_chroma(chunks)
            
            # Update processed files record
            for pdf_path in unprocessed_pdfs:
                filename = os.path.basename(pdf_path)
                self.processed_files[filename] = {
                    'last_processed': os.path.getmtime(pdf_path),
                    'chunks': len([chunk for chunk in chunks 
                                 if chunk.metadata['source'] == pdf_path])
                }
            
            self.save_processed_files()
            return True
            
        except Exception as e:
            logging.exception("Exception occurred in process_pdfs")
            return False


    def load_documents(self, pdf_paths):
        """Load specific PDF documents with proper page numbering"""
        logging.debug("Loading endocrinology documents")
        try:
            documents = []
            for pdf_path in pdf_paths:
                loader = PyPDFDirectoryLoader(os.path.dirname(pdf_path), 
                                        glob=os.path.basename(pdf_path))
                docs = loader.load()
            
                # Process page numbers - ensure they're stored correctly
                for doc in docs:
                    if 'page' in doc.metadata:
                        # Store the page number (which is 0-based in PyPDF) as page_label 
                        # Convert to 1-based page numbering for display
                        try:
                            page_num = doc.metadata['page']
                            if isinstance(page_num, (int, float)):
                                # Store the actual PDF page number as page_label
                                doc.metadata['page_label'] = str(int(page_num) + 1)
                            elif isinstance(page_num, str) and page_num.isdigit():
                                doc.metadata['page_label'] = str(int(page_num) + 1)
                        except (ValueError, TypeError):
                            # If conversion fails, keep original
                            logging.warning(f"Could not convert page number to int: {doc.metadata['page']}")
                        
                    # Add document type for better filtering later
                    doc.metadata['doc_type'] = 'endocrinology'
                    
                documents.extend(docs)
            
            # Log a few documents for debugging
            for i, doc in enumerate(documents[:3]):
                logging.debug(f"Document {i} Source: {doc.metadata.get('source')}")
                logging.debug(f"Document {i} Page: {doc.metadata.get('page')}")
                logging.debug(f"Document {i} Page Label: {doc.metadata.get('page_label')}")
            
            return documents
        except Exception as e:
            logging.exception("Exception occurred in load_documents")
            return None

    def split_documents(self, documents: list[Document]):
        """Split documents into chunks with larger size for more complete information"""
        logging.debug("Dividing documents into chunks")
        try:
            # Using RecursiveCharacterTextSplitter with increased chunk size
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=2500,  
                chunk_overlap=500,  
                length_function=len,
                is_separator_regex=False,
            )
            chunks = text_splitter.split_documents(documents)
            
            # Preserve metadata
            for chunk in chunks:
                source_doc = next((doc for doc in documents 
                                if doc.metadata['source'] == chunk.metadata['source']), 
                                None)
                if source_doc:
                    chunk.metadata['page'] = source_doc.metadata.get('page', 'Unknown')
                    chunk.metadata['doc_type'] = source_doc.metadata.get('doc_type', 'endocrinology')
            
            return chunks
        except Exception as e:
            logging.exception("Exception occurred in split_documents")
            return None

    def add_documents_to_chroma(self, chunks: list[Document]):
        """Add documents to Chroma database"""
        logging.debug("Adding documents to Chroma for endocrinology")
        try:
            db = Chroma(
                persist_directory=CHROMA_PATH, 
                embedding_function=get_embedding_function()
            )
            
            # Calculate IDs for chunks
            chunks_with_ids = self.calculate_chunk_ids(chunks)
            
            # Get existing document IDs
            existing_elements = db.get(include=[])
            existing_ids = set(existing_elements["ids"])
            
            # Filter out already existing chunks
            new_chunks = [chunk for chunk in chunks_with_ids 
                         if chunk.metadata["id"] not in existing_ids]
            
            if new_chunks:
                logging.debug(f"Adding {len(new_chunks)} new chunks")
                new_chunk_ids = [chunk.metadata["id"] for chunk in new_chunks]
                db.add_documents(new_chunks, ids=new_chunk_ids)
            else:
                logging.debug("No new chunks to add")
                
        except Exception as e:
            logging.exception("Exception occurred in add_documents_to_chroma")

    def calculate_chunk_ids(self, chunks):
        """Calculate unique IDs for chunks"""
        logging.debug("Calculating IDs for document chunks")
        try:
            last_page_id = None
            current_chunk_index = 0

            for chunk in chunks:
                source = chunk.metadata.get("source")
                page = chunk.metadata.get("page")
                current_page_id = f"{source}:{page}"

                if current_page_id == last_page_id:
                    current_chunk_index += 1
                else:
                    current_chunk_index = 0

                chunk_id = f"{current_page_id}:{current_chunk_index}"
                last_page_id = current_page_id
                chunk.metadata["id"] = chunk_id

            return chunks
        except Exception as e:
            logging.exception("Exception occurred in calculate_chunk_ids")
            return None

def process_endocrinology_documents():
    """Main process for embedding generation"""
    logging.debug("Starting process_endocrinology_documents")
    try:
        tic = time.time()
        
        # Ensure data directory exists
        if not os.path.exists(DATA_PATH):
            os.makedirs(DATA_PATH)
            logging.debug(f"Created data directory at {DATA_PATH}")
        
        processor = PDFProcessor()
        success = processor.process_pdfs()
        
        toc = time.time()
        logging.debug(f"Process completed in {(toc - tic):.2f} seconds")
        return success
    except Exception as e:
        logging.exception("Exception occurred in process_endocrinology_documents")
        return False
    
def process_endocrinology_documents_with_images():
    """Main process for embedding generation and image extraction"""
    logging.debug("Starting process_endocrinology_documents_with_images")
    try:
        tic = time.time()
        
        # Ensure data directory exists
        if not os.path.exists(DATA_PATH):
            os.makedirs(DATA_PATH)
            logging.debug(f"Created data directory at {DATA_PATH}")
        
        # 1. Process documents and generate embeddings
        processor = PDFProcessor()
        success = processor.process_pdfs()
        
        # 2. Extract images from PDF documents

    except Exception as e:
        logging.exception("Exception occurred in process_endocrinology_documents_with_images")
        return False
def load_documents(self, pdf_paths):
    """Load specific PDF documents with original page number preservation"""
    logging.debug("Loading endocrinology documents")
    try:
        documents = []
        for pdf_path in pdf_paths:
            loader = PyPDFDirectoryLoader(os.path.dirname(pdf_path), 
                                    glob=os.path.basename(pdf_path))
            docs = loader.load()
        
            # Process page numbers - ensure they're stored as integers
            for doc in docs:
                if 'page' in doc.metadata:
                    # Convert to 1-based page numbering (PDF pages usually start at 1)
                    try:
                        page_num = doc.metadata['page']
                        if isinstance(page_num, (int, float)):
                            doc.metadata['page'] = int(page_num) + 1  # Convert 0-based to 1-based
                        elif isinstance(page_num, str) and page_num.isdigit():
                            doc.metadata['page'] = int(page_num) + 1
                    except (ValueError, TypeError):
                        # If conversion fails, keep original
                        logging.warning(f"Could not convert page number to int: {doc.metadata['page']}")
                    
                # Add document type for better filtering later
                doc.metadata['doc_type'] = 'endocrinology'
                
            documents.extend(docs)
        
        for doc in documents:
            logging.debug(f"Document Source: {doc.metadata.get('source')}")
            logging.debug(f"Document Page: {doc.metadata.get('page')}")
        
        return documents
    except Exception as e:
        logging.exception("Exception occurred in load_documents")
        return None

if __name__ == "__main__":
    process_endocrinology_documents_with_images()