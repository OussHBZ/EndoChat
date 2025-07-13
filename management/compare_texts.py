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
                    "hypoglycmie", "gestion hypoglycémie", "traitement hypoglycémie", "sucre bas",
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
        
        # Add source information to prompt if sources exist
        source_instruction = ""
        # if actual_sources:
        #     # Create detailed source list with page numbers for the prompt
        #     source_details = []
        #     for source in actual_sources:
        #         if source.get('page'):
        #             source_details.append(f"{source['filename']} (page {source['page']})")
        #         else:
        #             source_details.append(source['filename'])
            
        #     source_instruction = (
        #         f"\nIMPORTANT: At the end of your response, add 'Sources: {', '.join(source_details)}'"
        #     )
        
        # Language instruction - UPDATED for patient-friendly responses
        language_instruction = ""
        if language:
            if language == 'en':
                language_instruction = "Respond in English. Give very short, simple answers that patients can understand."
            elif language == 'fr':
                language_instruction = "Répondez en français. Donnez des réponses courtes et simples que les patients peuvent comprendre."
            elif language == 'ar':
                language_instruction = "الرد باللغة العربية. قدم إجابات قصيرة وبسيطة يمكن للمرضى فهمها."
            else:
                language_instruction = "Give very short, simple answers that patients can understand."
        else:
            language_instruction = "Give very short, simple answers that patients can understand."
        
        # Check if this is a greeting message
        is_greeting = False
        greeting_patterns = [
            r'^\s*(hello|hi|hey|bonjour|salut|مرحبا|السلام عليكم)\s*$',
            r'^\s*(good\s+(morning|afternoon|evening)|bonsoir|صباح الخير|مساء الخير)\s*$',
            r'^\s*(how\s+are\s+you|comment\s+allez-vous|كيف حالك)\s*$'
        ]
        
        for pattern in greeting_patterns:
            if re.match(pattern, user_message.lower()):
                is_greeting = True
                break
        
        # COMPLETELY REWRITTEN PROMPT - Much shorter and more direct
        if is_greeting and len(conversation_history) == 0:
            # First message is a greeting - provide a brief welcome
            prompt = f"""You are DiabèteChat, a helpful medical diabetology assistant specialized in type 1 diabetes for patients.

{language_instruction}

Patient greets: {user_message}

RULES:
1. Give a very brief, friendly greeting (1 sentence)
2. Mention you can help with diabetology questions
3. Use simple words
4. Do NOT repeat this greeting in future messages

Brief greeting:"""
        else:
            # Regular message - no greetings
            prompt = f"""You are DiabèteChat, a helpful medical diabetology assistant specialized in type 1 diabetes for patients.

{language_instruction}

Medical information:
{documents_text if documents_text else "Use your medical diabetology and type 1 diabetes knowledge."}
Previous conversation:
{history_text}

Patient asks: {user_message}

RULES:
1. Answer in 1-5 short structured sentences only
2. Use simple words, no medical jargon
3. Be direct and helpful
4. Go straight to answering the question
5. Don't give long explanations
6. Do NOT include any sources or references in your response

Direct answer:"""
        
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
                lang_prefix = "Answer in English, keep it short. NO greetings."
            elif language == 'fr':
                lang_prefix = "Répondez en français, soyez bref. PAS de salutations."
            elif language == 'ar':
                lang_prefix = "أجب بالعربية، اجعل الإجابة قصيرة. بدون تحيات."
        
        fallback_prompt = f"""You are EndoChat, a medical assistant.
{lang_prefix}

Patient asks: {user_message}

Give a short, simple answer in 1-5 sentences only. Go straight to the answer, no greetings."""
        return fallback_prompt, updated_history
    

def update_conversation_history(conversation_history, assistant_response, user_identifier=None):
    """Update conversation history with the assistant's response"""
    try:
        # Remove any sources from the response
        clean_response = assistant_response
        
        # Remove sources sections
        sources_patterns = [
            r'\n*Sources?:\s*[^\n]*$',
            r'\n*Références?:\s*[^\n]*$', 
            r'\n*مصادر:\s*[^\n]*$'
        ]
        
        for pattern in sources_patterns:
            clean_response = re.sub(pattern, '', clean_response, flags=re.IGNORECASE)
        
        clean_response = clean_response.strip()
        
        # Add the assistant's response to history
        updated_history = []
        if isinstance(conversation_history, list):
            updated_history = conversation_history + [{
                'role': 'assistant',
                'content': clean_response
            }]
        else:
            updated_history = [{
                'role': 'assistant',
                'content': clean_response
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