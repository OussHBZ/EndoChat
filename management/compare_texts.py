import logging
import os
import json
import re
import unicodedata
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

def semantic_search_images(user_message, language='en'):
    """Smart image detection based on content topics"""
    try:
        from management.image_extractor import ImageExtractor
        extractor = ImageExtractor()
        
        # Load image metadata
        all_images = extractor.get_all_images()
        if not all_images:
            return []
        
        query_lower = user_message.lower()
        relevant_images = []
        
        # Define topic keywords for each of the 3 images
        image_topics = {
            # Image 1: Programme de formation en insulinothérapie fonctionnelle en Hospitalier
            "1 résumé IF_page7_img1_dabc8c47.png": {
                "keywords": [
                    # French
                    "insulinothérapie fonctionnelle", "programme de formation", "formation", "programme", 
                    "insulinothérapie", "éducation thérapeutique", "apprentissage", "hospitalier",
                    "enseignement", "formation diabète", "programme diabète",
                    # English
                    "functional insulin therapy", "training program", "education program", "therapeutic education",
                    "insulin therapy training", "diabetes education", "hospital training", "learning program",
                    # Arabic
                    "برنامج تدريب", "العلاج بالأنسولين", "التعليم العلاجي", "برنامج تعليمي"
                ]
            },
            
            # Image 2: Gestion de l'hypoglycémie
            "PrefinalISPADChapter11FR_page10_img1_fce5948d.png": {
                "keywords": [
                    # French
                    "hypoglycémie", "gestion hypoglycémie", "traitement hypoglycémie", "sucre bas",
                    "glycémie basse", "correction hypoglycémie", "protocole hypoglycémie",
                    # English  
                    "hypoglycemia", "low blood sugar", "hypoglycemia management", "low glucose",
                    "treating hypoglycemia", "hypoglycemia treatment", "low sugar", "glucose correction",
                    # Arabic
                    "نقص السكر", "انخفاض السكر", "علاج نقص السكر", "سكر منخفض"
                ]
            },
            
            # Image 3: Glycemic Targets
            "PrefinalISPADChapter8FR_page3_img1_4ffe260e.png": {
                "keywords": [
                    # French
                    "objectifs glycémiques", "cibles glycémiques", "glycémie cible", "hba1c",
                    "objectifs diabète", "contrôle glycémique", "valeurs cibles", "surveillance glycémique",
                    # English
                    "glycemic targets", "blood sugar targets", "glucose targets", "hba1c targets",
                    "diabetes targets", "glycemic control", "target values", "glucose monitoring",
                    "blood glucose goals", "sugar levels goals",
                    # Arabic
                    "أهداف السكر", "مستويات السكر المستهدفة", "مراقبة السكر", "أهداف الجلوكوز"
                ]
            }
        }
        
        # Check which images are relevant to the user's message
        for image_filename, topic_data in image_topics.items():
            score = 0
            
            # Check if any keywords match
            for keyword in topic_data["keywords"]:
                if keyword.lower() in query_lower:
                    score += 1
            
            # If we have matches, find the actual image data
            if score > 0:
                for image in all_images:
                    if image["filename"] == image_filename:
                        relevant_images.append({
                            'score': score,
                            'image': image
                        })
                        break
        
        # Sort by relevance score and return
        relevant_images.sort(key=lambda x: x['score'], reverse=True)
        final_images = [item['image'] for item in relevant_images]
        
        if final_images:
            logger.info(f"Found {len(final_images)} relevant images for topic: {user_message[:50]}...")
        
        return final_images
        
    except Exception as e:
        logger.error(f"Error in semantic_search_images: {str(e)}")
        return []

def find_document_similarity(user_message, conversation_history, user_identifier=None, language=None):
    """Find similar documents to the user message and generate the prompt"""
    try:
        # Generate conversation summary
        history_text = generate_conversation_summary(conversation_history)
        
        # Get the database instance
        db = get_db()
        if db is None:
            raise Exception("Failed to initialize database connection")
        
        # Retrieve relevant documents
        docs = db.similarity_search_with_score(user_message, k=5)
        
        # Format documents and track sources
        formatted_docs = []
        actual_sources = []
        
        for doc, score in docs:
            logger.debug(f"Document similarity score: {score} for content from {doc.metadata.get('source', 'unknown')}")
            
            if score < 1.5:  # Include relevant documents
                formatted_docs.append(doc.page_content)
                
                # Track sources WITH page numbers
                source_path = doc.metadata.get('source', '')
                page_num = None
                if 'page_label' in doc.metadata:
                    page_label = doc.metadata['page_label']
                    if isinstance(page_label, str) and page_label.isdigit():
                        page_num = int(page_label)
                    else:
                        page_num = page_label
                elif 'page' in doc.metadata:
                    page_num = doc.metadata['page']
                
                if source_path:
                    source_filename = os.path.basename(source_path)
                    if source_filename.lower().endswith('.pdf'):
                        source_info = {
                            "filename": source_filename,
                            "page": page_num
                        }
                        
                        # Avoid duplicates
                        existing = False
                        for s in actual_sources:
                            if s['filename'] == source_filename and s['page'] == page_num:
                                existing = True
                                break
                        
                        if not existing and page_num is not None:
                            actual_sources.append(source_info)
        
        # Perform smart image detection based on content topics
        relevant_images = semantic_search_images(user_message, language)
        
        # Save sources and images for this user
        if user_identifier:
            filename = ''.join(c for c in user_identifier if c.isalnum())
            sources_path = os.path.join(CONVERSATION_PATH, f"{filename}_sources.json")
            images_path = os.path.join(CONVERSATION_PATH, f"{filename}_images.json")
            
            if not os.path.exists(CONVERSATION_PATH):
                os.makedirs(CONVERSATION_PATH)
            
            # Save sources
            if actual_sources:
                with open(sources_path, 'w', encoding='utf-8') as f:
                    json.dump(actual_sources, f, ensure_ascii=False, indent=2)
                logger.debug(f"Saved sources for user {user_identifier}: {actual_sources}")
            
            # Save images (only if there are any)
            if relevant_images:
                with open(images_path, 'w', encoding='utf-8') as f:
                    json.dump(relevant_images, f, ensure_ascii=False, indent=2)
                logger.debug(f"Saved relevant images for user {user_identifier}: {len(relevant_images)} images")
            else:
                # Remove images file if no images are relevant
                if os.path.exists(images_path):
                    os.remove(images_path)
        
        # Join documents text
        documents_text = "\n\n".join(formatted_docs)
        
        # Language instruction
        language_instruction = ""
        if language:
            if language == 'en':
                language_instruction = "Respond in English. Structure your response with clear headings and bullet points where appropriate."
            elif language == 'fr':
                language_instruction = "Répondez en français. Structurez votre réponse avec des titres clairs et des puces si approprié."
            elif language == 'ar':
                language_instruction = "الرد باللغة العربية. قم بتنظيم إجابتك بعناوين واضحة ونقاط منظمة عند الحاجة."
            else:
                language_instruction = "Respond in the same language as the user. Structure your response clearly with headings and bullet points where appropriate."
        else:
            language_instruction = "Respond in the same language as the user. Structure your response clearly with headings and bullet points where appropriate."
        
        # Add source information to prompt if sources exist
        source_instruction = ""
        if actual_sources:
            # Create detailed source list with page numbers for the prompt
            source_details = []
            for source in actual_sources:
                if source.get('page'):
                    source_details.append(f"{source['filename']} (page {source['page']})")
                else:
                    source_details.append(source['filename'])
            
            source_instruction = (
                f"\nWhen referencing information from the provided documents, "
                f"add 'Sources: {', '.join(source_details)}' at the end of your response."
            )
        
        # IMPROVED PROMPT TEMPLATE - Well-structured responses
        prompt = f"""You are EndoChat, an AI assistant specialized in endocrinology. Provide clear, accurate, and well-structured responses about diabetes, hormones, and endocrine disorders.

{language_instruction}

Relevant medical documents:
{documents_text if documents_text else "No specific documents found for this query."}

Previous conversation:
{history_text}

User's question: {user_message}

Instructions:
1. Provide a well-structured, comprehensive answer to the user's question
2. Use clear headings (##) to organize different sections of your response
3. Use bullet points or numbered lists for clarity when listing information
4. Use simple, patient-friendly language while being medically accurate
5. Keep responses professional and informative
6. Do not mention system processes, document availability, or internal operations
7. Focus on providing practical, actionable medical information{source_instruction}

Structure your response with appropriate sections such as:
- Overview/Definition (if explaining a concept)
- Key Points or Symptoms
- Management/Treatment options
- Important Considerations
- When to seek medical help (if relevant)

Response:"""
        
        # Update conversation history
        if conversation_history and isinstance(conversation_history, list):
            if len(conversation_history) > 0 and not isinstance(conversation_history[0], dict):
                new_history = []
                for i, msg in enumerate(conversation_history):
                    new_history.append({
                        'role': 'user' if i % 2 == 0 else 'assistant',
                        'content': msg
                    })
                conversation_history = new_history
            elif len(conversation_history) > 0 and 'role' not in conversation_history[0]:
                new_history = []
                for i, msg in enumerate(conversation_history):
                    new_history.append({
                        'role': 'user' if i % 2 == 0 else 'assistant',
                        'content': msg
                    })
                conversation_history = new_history
        else:
            conversation_history = []
        
        updated_history = conversation_history + [{
            'role': 'user',
            'content': user_message
        }]
        
        # Save conversation history
        if user_identifier:
            save_conversation(updated_history, user_identifier)
        
        return prompt, updated_history
        
    except Exception as e:
        logger.error(f"Error in find_document_similarity: {str(e)}")
        # Fallback prompt
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
        
        lang_prefix = ""
        if language:
            if language == 'en':
                lang_prefix = "Respond in English with clear structure."
            elif language == 'fr':
                lang_prefix = "Répondez en français avec une structure claire."
            elif language == 'ar':
                lang_prefix = "الرد باللغة العربية مع تنظيم واضح."
        
        fallback_prompt = f"""You are EndoChat, an AI assistant specialized in endocrinology.
{lang_prefix}

User's question: {user_message}

Please provide a helpful, well-structured response about endocrinology based on your knowledge.
"""
        return fallback_prompt, updated_history

def update_conversation_history(conversation_history, assistant_response, user_identifier=None):
    """Update conversation history with the assistant's response and ensure sources are properly formatted"""
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
        
        # Get sources for this user
        sources_text = ""
        sources_found = False
        
        if user_identifier:
            filename = ''.join(c for c in user_identifier if c.isalnum())
            sources_path = os.path.join(CONVERSATION_PATH, f"{filename}_sources.json")
            
            if os.path.exists(sources_path):
                try:
                    with open(sources_path, 'r', encoding='utf-8') as f:
                        sources = json.load(f)
                    
                    if sources and len(sources) > 0:
                        sources_found = True
                        logger.debug(f"Found {len(sources)} sources for user {user_identifier}")
                        
                        # Create sources text with page numbers
                        source_details = []
                        for source in sources:
                            if source.get('page'):
                                source_details.append(f"{source['filename']} (page {source['page']})")
                            else:
                                source_details.append(source['filename'])
                        
                        sources_text = "\n\nSources: " + ", ".join(source_details)
                except Exception as src_err:
                    logger.error(f"Error reading sources file: {str(src_err)}")
        
        # Ensure sources are properly formatted in the response
        full_response = assistant_response
        
        if sources_found and not has_sources_section:
            logger.debug("Adding sources with page numbers to response")
            full_response = assistant_response + sources_text
        elif sources_found and has_sources_section:
            # Check if the existing sources section has page numbers
            sources_parts = re.split(r'(Sources:|sources:|SOURCES:|Références:|مصادر:)', assistant_response, flags=re.IGNORECASE)
            if len(sources_parts) > 1:
                sources_content = sources_parts[-1].strip()
                # If sources section doesn't contain page numbers, replace it
                if "page" not in sources_content and len(sources_content) < 50:
                    prefix = assistant_response.split(sources_parts[-2])[0]
                    full_response = prefix + sources_parts[-2] + " " + sources_text.replace("\n\nSources:", "")
                    logger.debug("Replacing sources section with page numbers")
        
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
        
        # Save conversation history
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