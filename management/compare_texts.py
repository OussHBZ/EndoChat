import logging
import os
import json
import re
import unicodedata
# from langchain_community.vectorstores import Chroma
from langchain_chroma import Chroma
from management.embeddings import get_embedding_function

# Define paths
CHROMA_PATH = "./chroma_db"
CONVERSATION_PATH = "./conversations"

# Define the maximum size of conversation history to retain
MAX_HISTORY_ITEMS = 10

# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global variable to store the database instance
_db_instance = None

def initialize_db(embedding_function=None):
    """Initialize and cache the database connection"""
    global _db_instance
    try:
        if embedding_function is None:
            from management.embeddings import get_embedding_function
            embedding_function = get_embedding_function()
            
        # Initialize the database connection
        from langchain_community.vectorstores import Chroma
        _db_instance = Chroma(
            persist_directory=CHROMA_PATH,
            embedding_function=embedding_function
        )
        logger.info("Database connection initialized")
        return _db_instance
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        return None

def get_db():
    """Get the database instance, initializing it if needed"""
    global _db_instance
    if _db_instance is None:
        return initialize_db()
    return _db_instance

def normalize_filename(filename):
    """Normalize a filename to make comparisons reliable"""
    # Convert to lowercase
    filename = filename.lower()
    
    # Remove accents
    filename = ''.join(c for c in unicodedata.normalize('NFD', filename)
                      if unicodedata.category(c) != 'Mn')
    
    # Remove file extension
    filename = os.path.splitext(filename)[0]
    
    # Remove special characters and spaces
    filename = re.sub(r'[^a-z0-9]', '', filename)
    
    return filename

def generate_conversation_summary(conversation_history):
    """Generate a summary of the conversation history"""
    try:
        # Format conversation history for the prompt
        formatted_history = []
        for item in conversation_history[-MAX_HISTORY_ITEMS:]:
            if item.get('role') == 'user':
                formatted_history.append(f"User: {item.get('content')}")
            else:
                formatted_history.append(f"Assistant: {item.get('content')}")
        
        history_text = "\n".join(formatted_history)
        
        return history_text
        
    except Exception as e:
        logger.error(f"Error in generate_conversation_summary: {str(e)}")
        return ""


def find_document_similarity(user_message, conversation_history, user_identifier=None, language=None):
    """Find similar documents to the user message and generate the prompt"""
    try:
        # First, generate a summary of the conversation history
        history_text = generate_conversation_summary(conversation_history)
        
        # Get the database instance
        db = get_db()
        if db is None:
            raise Exception("Failed to initialize database connection")
        
        # Retrieve relevant documents for the user message
        docs = db.similarity_search_with_score(user_message, k=5)
        
        # Format documents for the prompt
        formatted_docs = []
        
        # Track actual used source filenames with page numbers
        actual_sources = []
        
        for doc, score in docs:
            # Log the similarity score for debugging
            logger.debug(f"Document similarity score: {score} for content from {doc.metadata.get('source', 'unknown')}")
            
            # Include documents with a more permissive threshold
            if score < 1.5:  # Higher threshold to include more documents
                formatted_docs.append(doc.page_content)
                
                # Get the source filename
                source_path = doc.metadata.get('source', '')
                
                # Get the page as the page number (using page_label)
                page_num = None
                if 'page_label' in doc.metadata:
                    page_label = doc.metadata['page_label']
                    # Try to convert to int if it's a digit string
                    if isinstance(page_label, str) and page_label.isdigit():
                        page_num = int(page_label)
                    else:
                        page_num = page_label
                elif 'page' in doc.metadata:
                    # Fallback to 'page' if 'page_label' is not available
                    page_num = doc.metadata['page']
                
                # Add to sources if from a PDF file
                if source_path:
                    source_filename = os.path.basename(source_path)
                    if source_filename.lower().endswith('.pdf'):
                        # Store the source with its page number
                        source_info = {
                            "filename": source_filename,
                            "page": page_num
                        }
                        
                        # Check if this source+page combination already exists
                        existing = False
                        for s in actual_sources:
                            if s['filename'] == source_filename and s['page'] == page_num:
                                existing = True
                                break
                        
                        if not existing and page_num is not None:
                            actual_sources.append(source_info)
        
        # Save the source filenames with page numbers for this user
        if user_identifier and actual_sources:
            # Create a safe filename from the user identifier
            filename = ''.join(c for c in user_identifier if c.isalnum())
            sources_path = os.path.join(CONVERSATION_PATH, f"{filename}_sources.json")
            
            # Ensure the conversation directory exists
            if not os.path.exists(CONVERSATION_PATH):
                os.makedirs(CONVERSATION_PATH)
            
            # Write to a JSON file
            with open(sources_path, 'w', encoding='utf-8') as f:
                json.dump(actual_sources, f, ensure_ascii=False, indent=2)
                
            logger.debug(f"Saved actual sources for user {user_identifier}: {actual_sources}")
        
        # Join the documents text
        documents_text = "\n\n".join(formatted_docs)
        
        # Determine the language-specific instructions
        language_instruction = ""
        if language:
            if language == 'en':
                language_instruction = "Respond in English."
            elif language == 'fr':
                language_instruction = "Respond in French (Répondre en français)."
            elif language == 'ar':
                language_instruction = "Respond in Arabic (الرد باللغة العربية)."
            else:
                language_instruction = "Respond in the same language as the user."
        else:
            language_instruction = "Respond in the same language as the user."
            
        # Add source information directly to the prompt
        source_reminder = ""
        if actual_sources:
            source_files = [s["filename"] for s in actual_sources]
            unique_source_files = list(set(source_files))
            source_reminder = (
                f"\nThe documents provided above are from these sources: {', '.join(unique_source_files)}.\n"
                "Remember to include these sources at the end of your response by adding a line that starts with 'Sources:' "
                "followed by the names of the documents you referenced.\n"
            )
        
        # Create a unified prompt that allows for both document-based and general knowledge
        prompt = f"""You are EndoChat, an endocrinology assistant helping patients understand medical concepts.
{language_instruction}

Here is information from endocrinology documents that may be relevant to the question:
{documents_text}
{source_reminder}

Previous conversation:
{history_text}

User's latest message: {user_message}

Instructions:
1. Answer endocrinology questions comprehensively:
   - First use information from the documents provided above if it answers the user's question
   - If the documents don't contain relevant information for the question, use your general knowledge about endocrinology
   - Always provide patient-friendly explanations that are easy to understand
   - Explain medical terms simply

2. When using document-based information:
   - At the end of your response, include "Sources:" followed by the names of documents you referenced
   - DO NOT include page numbers in this list - they will be added automatically
   - Example: "Sources: Diabète de type 1 PDF.pdf, Techniques d'injection d'insuline.pdf"
   - THIS IS VERY IMPORTANT. ALWAYS list your sources if you used the document information.

3. When using only general knowledge (because documents don't contain relevant information):
   - Do NOT include a "Sources:" section
   - Simply provide accurate information about endocrinology from your training

4. For off-topic questions:
   - Politely redirect to endocrinology topics

IMPORTANT: Your answer should be based primarily on document information if it's relevant. Only use general knowledge when the documents don't address the user's specific question.
"""
        
        # Update conversation history with the user message
        if conversation_history and isinstance(conversation_history, list):
            if len(conversation_history) > 0 and not isinstance(conversation_history[0], dict):
                # Convert old format history if needed
                new_history = []
                for i, msg in enumerate(conversation_history):
                    new_history.append({
                        'role': 'user' if i % 2 == 0 else 'assistant',
                        'content': msg
                    })
                conversation_history = new_history
            elif len(conversation_history) > 0 and 'role' not in conversation_history[0]:
                # Another possible old format
                new_history = []
                for i, msg in enumerate(conversation_history):
                    new_history.append({
                        'role': 'user' if i % 2 == 0 else 'assistant',
                        'content': msg
                    })
                conversation_history = new_history
        else:
            # Initialize if empty or not a list
            conversation_history = []
        
        updated_history = conversation_history + [{
            'role': 'user',
            'content': user_message
        }]
        
        # Save conversation history if user_identifier is provided
        if user_identifier:
            save_conversation(updated_history, user_identifier)
        
        return prompt, updated_history
        
    except Exception as e:
        logger.error(f"Error in find_document_similarity: {str(e)}")
        # Provide a fallback prompt if something goes wrong
        updated_history = []
        if isinstance(conversation_history, list):
            updated_history = conversation_history + [{
                'role': 'user',
                'content': user_message
            }]
        else:
            updated_history = [{
                'role': 'user',
                'content': user_message
            }]
        
        # Determine language for fallback message
        lang_prefix = ""
        if language:
            if language == 'en':
                lang_prefix = "Always respond in English."
            elif language == 'fr':
                lang_prefix = "Toujours répondre en français."
            elif language == 'ar':
                lang_prefix = "دائما الرد باللغة العربية."
        
        fallback_prompt = f"""You are an AI assistant specialized in endocrinology, helping patients.
{lang_prefix}

The document retrieval system encountered an error, but I'll try to help with your question.
User's question: {user_message}

Please provide a response based on general knowledge about endocrinology.
If you cannot answer, kindly explain that there was an issue retrieving specific documents.
"""
        return fallback_prompt, updated_history

def update_conversation_history(conversation_history, assistant_response, user_identifier=None):
    """Update conversation history with the assistant's response and add sources"""
    try:
        # Check if the response already has a Sources section
        has_sources_section = any([
            "Sources:" in assistant_response,
            "sources:" in assistant_response,
            "SOURCES:" in assistant_response,
            "Sources :" in assistant_response,
            "Références:" in assistant_response,
            "مصادر:" in assistant_response
        ])
        
        logger.debug(f"Response already has sources section: {has_sources_section}")
        
        # Only add sources if they exist and the response doesn't already have them
        sources_text = ""
        sources_found = False
        
        if user_identifier:
            # Create a safe filename from the user identifier
            filename = ''.join(c for c in user_identifier if c.isalnum())
            sources_path = os.path.join(CONVERSATION_PATH, f"{filename}_sources.json")
            
            if os.path.exists(sources_path):
                try:
                    # Read the sources with page numbers
                    with open(sources_path, 'r', encoding='utf-8') as f:
                        sources = json.load(f)
                    
                    if sources and len(sources) > 0:
                        sources_found = True
                        logger.debug(f"Found {len(sources)} sources for user {user_identifier}")
                        
                        # Create sources text
                        source_filenames = [source["filename"] for source in sources]
                        # Remove duplicates
                        unique_source_filenames = list(set(source_filenames))
                        sources_text = "\n\nSources: " + ", ".join(unique_source_filenames)
                except Exception as src_err:
                    logger.error(f"Error reading sources file: {str(src_err)}")
            else:
                logger.debug(f"No sources file found at {sources_path}")
        
        # Add sources to the response
        full_response = assistant_response
        
        if sources_found and not has_sources_section:
            logger.debug("Adding sources to response")
            full_response = assistant_response + sources_text
        elif sources_found and has_sources_section:
            # Check if the existing sources section is empty or minimal
            sources_parts = re.split(r'(Sources:|sources:|SOURCES:|Références:|مصادر:)', assistant_response, flags=re.IGNORECASE)
            if len(sources_parts) > 1:
                # Get the part after the sources marker
                sources_content = sources_parts[-1].strip()
                if len(sources_content) < 5:
                    # Replace the empty sources section
                    prefix = assistant_response.split(sources_parts[-2])[0]
                    full_response = prefix + sources_parts[-2] + sources_text.replace("\n\nSources:", "")
                    logger.debug("Replacing empty sources section")
        
        # Add the assistant's response to history
        updated_history = []
        if isinstance(conversation_history, list):
            updated_history = conversation_history + [{
                'role': 'assistant',
                'content': full_response
            }]
        else:
            updated_history = [{
                'role': 'assistant',
                'content': full_response
            }]
        
        # Save conversation history if user_identifier is provided
        if user_identifier:
            save_conversation(updated_history, user_identifier)
        
        return updated_history
        
    except Exception as e:
        logger.error(f"Error in update_conversation_history: {str(e)}")
        # Return the original history with response appended
        if isinstance(conversation_history, list):
            return conversation_history + [{
                'role': 'assistant',
                'content': assistant_response
            }]
        else:
            return [
                {'role': 'user', 'content': 'Error retrieving conversation history'},
                {'role': 'assistant', 'content': assistant_response}
            ]
        


def save_conversation(conversation_history, user_identifier):
    """Save the conversation history to disk"""
    try:
        # Create conversations directory if it doesn't exist
        if not os.path.exists(CONVERSATION_PATH):
            os.makedirs(CONVERSATION_PATH)
        
        # Create a safe filename from the user identifier
        filename = ''.join(c for c in user_identifier if c.isalnum())
        file_path = os.path.join(CONVERSATION_PATH, f"{filename}.json")
        
        # Save the conversation history
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(conversation_history, f, ensure_ascii=False, indent=2)
        
        logger.debug(f"Saved conversation for user {user_identifier}")
        
    except Exception as e:
        logger.error(f"Error saving conversation: {str(e)}")

def load_conversation(user_identifier):
    """Load a conversation history from disk"""
    try:
        # Create a safe filename from the user identifier
        filename = ''.join(c for c in user_identifier if c.isalnum())
        file_path = os.path.join(CONVERSATION_PATH, f"{filename}.json")
        
        # Check if the file exists
        if not os.path.exists(file_path):
            return []
        
        # Load the conversation history
        with open(file_path, 'r', encoding='utf-8') as f:
            conversation_history = json.load(f)
        
        logger.debug(f"Loaded conversation for user {user_identifier}")
        return conversation_history
        
    except Exception as e:
        logger.error(f"Error loading conversation: {str(e)}")
        return []
    
