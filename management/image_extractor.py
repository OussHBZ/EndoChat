import fitz  # PyMuPDF
import os
import logging
import hashlib
import json
from PIL import Image
import io

# Setup logging
logger = logging.getLogger(__name__)

class ImageExtractor:
    def __init__(self):
        """Initialize the Image Extractor"""
        self.images_dir = "./static/extracted_images"
        self.metadata_file = "./extracted_images_metadata.json"
        self.processed_files = self.load_processed_files()
        
        # Create images directory if it doesn't exist
        if not os.path.exists(self.images_dir):
            os.makedirs(self.images_dir)
            logger.info(f"Created images directory: {self.images_dir}")
    
    def load_processed_files(self):
        """Load the record of processed files"""
        if os.path.exists(self.metadata_file):
            try:
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading metadata file: {str(e)}")
                return {}
        return {}
    
    def save_processed_files(self):
        """Save the record of processed files"""
        try:
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(self.processed_files, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving metadata file: {str(e)}")
    
    def needs_processing(self, pdf_path):
        """Check if a PDF needs image extraction based on modification time"""
        filename = os.path.basename(pdf_path)
        mod_time = os.path.getmtime(pdf_path)
        
        if filename not in self.processed_files:
            return True
            
        return mod_time > self.processed_files[filename].get('last_processed', 0)
    
    def generate_image_hash(self, image_data):
        """Generate a unique hash for an image to avoid duplicates"""
        return hashlib.md5(image_data).hexdigest()
    
    def extract_images_from_pdf(self, pdf_path):
        """Extract all images from a PDF file"""
        logger.info(f"Extracting images from: {pdf_path}")
        
        try:
            doc = fitz.open(pdf_path)
            filename = os.path.basename(pdf_path)
            extracted_images = []
            image_hashes = set()  # Track duplicates
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                image_list = page.get_images()
                
                logger.debug(f"Found {len(image_list)} images on page {page_num + 1}")
                
                for img_index, img in enumerate(image_list):
                    try:
                        # Get image data
                        xref = img[0]
                        pix = fitz.Pixmap(doc, xref)
                        
                        # Skip if image is too small (likely artifacts)
                        if pix.width < 50 or pix.height < 50:
                            pix = None
                            continue
                        
                        # Convert to PIL Image for processing
                        if pix.n - pix.alpha < 4:  # GRAY or RGB
                            img_data = pix.tobytes("png")
                            img_hash = self.generate_image_hash(img_data)
                            
                            # Skip duplicates
                            if img_hash in image_hashes:
                                pix = None
                                continue
                            
                            image_hashes.add(img_hash)
                            
                            # Create filename
                            img_filename = f"{os.path.splitext(filename)[0]}_page{page_num + 1}_img{img_index + 1}_{img_hash[:8]}.png"
                            img_path = os.path.join(self.images_dir, img_filename)
                            
                            # Save image
                            with open(img_path, "wb") as img_file:
                                img_file.write(img_data)
                            
                            # Store metadata
                            image_info = {
                                "filename": img_filename,
                                "source_pdf": filename,
                                "page_number": page_num + 1,
                                "image_index": img_index + 1,
                                "width": pix.width,
                                "height": pix.height,
                                "hash": img_hash,
                                "file_path": img_path
                            }
                            
                            extracted_images.append(image_info)
                            logger.debug(f"Extracted image: {img_filename}")
                        
                        pix = None
                        
                    except Exception as e:
                        logger.error(f"Error extracting image {img_index} from page {page_num + 1}: {str(e)}")
                        continue
            
            doc.close()
            
            # Update processed files record
            self.processed_files[filename] = {
                'last_processed': os.path.getmtime(pdf_path),
                'images_extracted': len(extracted_images),
                'images': extracted_images
            }
            
            logger.info(f"Extracted {len(extracted_images)} images from {filename}")
            return extracted_images
            
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_path}: {str(e)}")
            return []
    
    def process_pdfs_for_images(self, data_path="./data"):
        """Process all PDFs in the data directory for image extraction"""
        if not os.path.exists(data_path):
            logger.error(f"Data directory not found: {data_path}")
            return False
        
        pdf_files = [f for f in os.listdir(data_path) if f.lower().endswith('.pdf')]
        
        if not pdf_files:
            logger.warning("No PDF files found in data directory")
            return True
        
        total_images = 0
        processed_count = 0
        
        for pdf_file in pdf_files:
            pdf_path = os.path.join(data_path, pdf_file)
            
            if self.needs_processing(pdf_path):
                logger.info(f"Processing {pdf_file} for image extraction...")
                images = self.extract_images_from_pdf(pdf_path)
                total_images += len(images)
                processed_count += 1
            else:
                logger.debug(f"Skipping {pdf_file} - already processed")
        
        if processed_count > 0:
            self.save_processed_files()
            logger.info(f"Image extraction complete: {total_images} images from {processed_count} PDFs")
        
        return True
    
    def get_images_for_pdf(self, pdf_filename):
        """Get all images extracted from a specific PDF"""
        if pdf_filename in self.processed_files:
            return self.processed_files[pdf_filename].get('images', [])
        return []
    
    def search_images_by_keywords(self, keywords):
        """Search for images by PDF filename keywords"""
        matching_images = []
        
        for pdf_name, pdf_data in self.processed_files.items():
            # Check if any keyword matches the PDF name
            pdf_name_lower = pdf_name.lower()
            for keyword in keywords:
                if keyword.lower() in pdf_name_lower:
                    images = pdf_data.get('images', [])
                    matching_images.extend(images)
                    break
        
        return matching_images
    
    def get_all_images(self):
        """Get all extracted images"""
        all_images = []
        for pdf_data in self.processed_files.values():
            images = pdf_data.get('images', [])
            all_images.extend(images)
        return all_images
    
    def cleanup_orphaned_images(self):
        """Remove image files that are no longer referenced in metadata"""
        try:
            if not os.path.exists(self.images_dir):
                return
            
            # Get all referenced image files
            referenced_files = set()
            for pdf_data in self.processed_files.values():
                for image in pdf_data.get('images', []):
                    referenced_files.add(image['filename'])
            
            # Check for orphaned files
            existing_files = set(os.listdir(self.images_dir))
            orphaned_files = existing_files - referenced_files
            
            # Remove orphaned files
            removed_count = 0
            for orphaned_file in orphaned_files:
                if orphaned_file.endswith(('.png', '.jpg', '.jpeg')):
                    os.remove(os.path.join(self.images_dir, orphaned_file))
                    removed_count += 1
            
            if removed_count > 0:
                logger.info(f"Cleaned up {removed_count} orphaned image files")
                
        except Exception as e:
            logger.error(f"Error cleaning up orphaned images: {str(e)}")

def extract_images_from_documents():
    """Main function to extract images from all PDF documents"""
    logger.info("Starting image extraction from documents")
    
    try:
        extractor = ImageExtractor()
        success = extractor.process_pdfs_for_images()
        
        if success:
            # Cleanup orphaned images
            extractor.cleanup_orphaned_images()
            logger.info("Image extraction completed successfully")
        
        return success
        
    except Exception as e:
        logger.error(f"Error in image extraction: {str(e)}")
        return False

if __name__ == "__main__":
    extract_images_from_documents()