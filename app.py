from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from management.compare_texts import find_document_similarity, update_conversation_history, normalize_filename
from management.conversation_manager import ConversationManager
from management.polly_tts import PollyTTSManager
from management.image_extractor import ImageExtractor
import os
import threading
import time
import uuid
import logging
import atexit
from werkzeug.utils import secure_filename
import json, re

CONVERSATION_PATH = "./conversations"
CHROMA_PATH = "./chroma_db"

def create_app():
    app = Flask(__name__, static_folder='static', template_folder='templates')
    
    # Setup logging
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)
    
    # Initialize managers and extractors
    conversation_manager = ConversationManager()
    image_extractor = ImageExtractor()
    logger.info("Starting application initialization...")
    
    # Initialize Polly TTS Manager
    polly_manager = PollyTTSManager()
    if polly_manager.is_service_available():
        logger.info("Amazon Polly TTS service initialized successfully")
    else:
        logger.warning("Amazon Polly TTS service not available - check AWS credentials")
    
    # Pre-load embedding model and initialize Chroma DB
    try:
        from management.embeddings import get_embedding_function
        from management.compare_texts import initialize_db
        logger.info("Pre-loading embedding model...")
        embeddings = get_embedding_function()
        logger.info("Initializing database connection...")
        initialize_db(embeddings)
        logger.info("Embedding model and database initialized successfully")
    except Exception as e:
        logger.error(f"Error pre-loading embeddings: {str(e)}")
    
    # Load environment variables
    load_dotenv()
    api_key = os.getenv('GROQ_API_KEY')
    
    # Initialize LLM client
    client = ChatGroq(
        model="meta-llama/llama-4-scout-17b-16e-instruct",  # Using the larger model for better response quality
        temperature=0.2,          # Low temperature for more consistent responses
        api_key=api_key,
    )
    
    # Global flag for cleanup thread
    app.config['cleanup_thread_running'] = False
    
    def cleanup_worker():
        while app.config['cleanup_thread_running']:
            try:
                conversation_manager.cleanup_old_conversations()
                # Also cleanup orphaned images
                image_extractor.cleanup_orphaned_images()
                logger.info("Cleanup completed, sleeping for 1 hour...")
                for _ in range(60):
                    if not app.config['cleanup_thread_running']:
                        break
                    time.sleep(60)
            except Exception as e:
                logger.error(f"Error in cleanup worker: {str(e)}")
                time.sleep(60)
    
    def start_cleanup_thread():
        app.config['cleanup_thread_running'] = True
        cleanup_thread = threading.Thread(target=cleanup_worker)
        cleanup_thread.daemon = False
        cleanup_thread.start()
        return cleanup_thread
    
    def shutdown_cleanup_thread():
        app.config['cleanup_thread_running'] = False
        logger.info("Shutting down cleanup thread...")
    
    # Register the shutdown function
    atexit.register(shutdown_cleanup_thread)
    
    # Start the cleanup thread
    cleanup_thread = start_cleanup_thread()
    
    @app.route('/', methods=['GET'])
    def chat_page():
        return render_template('chat.html')
    
    @app.route('/chat', methods=['POST'])
    def chat():
        request_id = str(uuid.uuid4())  # Generate unique request ID
        logger.info(f"Received chat request. ID: {request_id}")
        
        try:
            data = request.json
            user_message = data['msg']
            user_identifier = data.get('user_identifier')
            conversation_history = data.get('conversation_history', [])
            language = data.get('language', None)  # Get the selected language
            
            logger.debug(f"Request {request_id} - Processing message: {user_message[:50]}... in language: {language}")
            
            # Step 1: Find relevant documents and create the prompt
            full_prompt, updated_history = find_document_similarity(
                user_message, 
                conversation_history,
                user_identifier,
                language  # Pass language to find_document_similarity
            )
            
            # Step 2: Call the LLM with the prompt
            response = client.invoke(full_prompt).content
            
            # Update conversation history with the new interaction
            final_history = update_conversation_history(
                updated_history, 
                response,
                user_identifier
            )
            
            logger.info(f"Request {request_id} - Successfully processed chat request")
            return jsonify({
                'response': response, 
                'conversation_history': final_history
            })
            
        except Exception as e:
            logger.error(f"Request {request_id} - Error processing chat request: {str(e)}")
            return jsonify({
                'error': 'An error occurred processing your request',
                'details': str(e)
            }), 500

    @app.route('/synthesize_speech', methods=['POST'])
    def synthesize_speech():
        """Endpoint to generate TTS audio using Amazon Polly"""
        try:
            data = request.json
            text = data.get('text', '')
            language = data.get('language', 'en')
            
            if not text.strip():
                return jsonify({'error': 'No text provided'}), 400
            
            if not polly_manager.is_service_available():
                return jsonify({'error': 'TTS service not available'}), 503
            
            # Generate audio file
            audio_file_path = polly_manager.synthesize_speech(text, language)
            
            if audio_file_path:
                return jsonify({
                    'success': True,
                    'audio_url': f'/static/{audio_file_path}'
                })
            else:
                return jsonify({'error': 'Failed to generate audio'}), 500
                
        except Exception as e:
            logger.error(f"Error in synthesize_speech: {str(e)}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/tts_status', methods=['GET'])
    def tts_status():
        """Check if TTS service is available"""
        try:
            is_available = polly_manager.is_service_available()
            voices = polly_manager.get_available_voices() if is_available else []
            
            return jsonify({
                'available': is_available,
                'voices_count': len(voices),
                'service': 'Amazon Polly'
            })
        except Exception as e:
            logger.error(f"Error checking TTS status: {str(e)}")
            return jsonify({
                'available': False,
                'error': str(e)
            })

    @app.route('/get_images', methods=['POST'])
    def get_images():
        """Get relevant images for a user session"""
        try:
            data = request.json
            user_identifier = data.get('user_identifier')
            
            if not user_identifier:
                return jsonify({'error': 'User identifier not provided'}), 400
                
            # Create a safe filename
            filename = ''.join(c for c in user_identifier if c.isalnum())
            images_file_path = os.path.join(CONVERSATION_PATH, f"{filename}_images.json")
            
            # Check if the images file exists
            if not os.path.exists(images_file_path):
                return jsonify({'images': []})
                
            # Load the images
            with open(images_file_path, 'r', encoding='utf-8') as f:
                images = json.load(f)
                
            # Add full URL paths for frontend
            for image in images:
                image['url'] = f"/static/extracted_images/{image['filename']}"
                
            return jsonify({'images': images})
            
        except Exception as e:
            logger.error(f"Error in get_images: {str(e)}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

    @app.route('/extract_images', methods=['POST'])
    def extract_images():
        """Manually trigger image extraction from PDFs"""
        try:
            success = image_extractor.process_pdfs_for_images()
            
            if success:
                # Get count of extracted images
                all_images = image_extractor.get_all_images()
                return jsonify({
                    'success': True,
                    'message': f'Image extraction completed. {len(all_images)} images available.',
                    'images_count': len(all_images)
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'Image extraction failed'
                }), 500
                
        except Exception as e:
            logger.error(f"Error in extract_images: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error',
                'details': str(e)
            }), 500
        
    @app.route('/download_pdf', methods=['GET'])
    def download_pdf():
        try:
            filename = request.args.get('filename')
            if not filename:
                logger.warning("No filename provided")
                return jsonify({'error': 'Filename not provided'}), 400

            # Define PDF directory
            pdf_directory = os.path.join(os.getcwd(), 'data')
        
            # List all files in the directory
            available_files = os.listdir(pdf_directory)
            
            # First, check for exact match
            if filename in available_files:
                matching_file = filename
            else:
                # Try to find a matching file using increasingly flexible methods
                
                # Method 1: Case-insensitive exact match
                matching_file = next((f for f in available_files if f.lower() == filename.lower()), None)
                
                # Method 2: Normalized match (removing accents, spaces, etc.)
                if not matching_file:
                    normalized_request = normalize_filename(filename).lower()
                    matching_file = next((f for f in available_files if normalize_filename(f).lower() == normalized_request), None)
                
                # Method 3: Partial match (filename is contained in actual file)
                if not matching_file:
                    matching_file = next((f for f in available_files if filename.lower() in f.lower()), None)
                
                # Method 4: Reversed partial match (actual file is contained in filename)
                if not matching_file:
                    for file in available_files:
                        if file.lower() in filename.lower():
                            matching_file = file
                            break
                
                # Method 5: Keyword matching (for filenames with multiple words)
                if not matching_file:
                    # Extract words from the filename
                    words = re.findall(r'\b\w{4,}\b', filename.lower())
                    
                    # Find files that contain the most matching keywords
                    best_match = None
                    most_matches = 0
                    
                    for file in available_files:
                        matches = sum(1 for word in words if word in file.lower())
                        if matches > most_matches:
                            most_matches = matches
                            best_match = file
                    
                    if most_matches > 0:
                        matching_file = best_match
            
            if not matching_file:
                # If no match found, return the list of available files
                logger.warning(f"No matching file found for: {filename}")
                logger.debug(f"Available files: {available_files}")
                
                # Return a user-friendly error page that lists available documents
                error_html = f"""
                <html>
                <head>
                    <title>Document Not Found</title>
                    <style>
                        body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
                        h1 {{ color: #d9534f; }}
                        .container {{ max-width: 800px; margin: 0 auto; }}
                        .file-list {{ background: #f5f5f5; padding: 15px; border-radius: 5px; }}
                        .file-item {{ margin-bottom: 8px; }}
                        .file-link {{ color: #428bca; text-decoration: none; }}
                        .file-link:hover {{ text-decoration: underline; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Document Not Found</h1>
                        <p>Sorry, the document <strong>"{filename}"</strong> could not be found.</p>
                        <p>Please choose from one of the available documents:</p>
                        <div class="file-list">
                """
                
                for file in available_files:
                    if file.lower().endswith('.pdf'):
                        error_html += f'<div class="file-item"><a class="file-link" href="/download_pdf?filename={file}">{file}</a></div>'
                
                error_html += """
                        </div>
                    </div>
                </body>
                </html>
                """
                
                return error_html, 404

            file_path = os.path.join(pdf_directory, matching_file)

            # Additional security checks
            if not file_path.lower().endswith('.pdf'):
                logger.warning(f"Invalid file type attempted: {file_path}")
                return jsonify({'error': 'Invalid file type'}), 400

            if not os.path.commonpath([file_path, pdf_directory]) == pdf_directory:
                logger.warning(f"Invalid file path attempted: {file_path}")
                return jsonify({'error': 'Invalid file path'}), 403

            logger.info(f"Serving PDF file: {file_path}")
            response = send_from_directory(
                pdf_directory,
                matching_file,
                as_attachment=True,
                mimetype='application/pdf'
            )
        
            # Add headers to prevent caching issues
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

            return response

        except Exception as e:
            logger.error(f"Error in download_pdf: {str(e)}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500
    
    @app.route('/static/<path:path>')
    def send_static(path):
        return send_from_directory('static', path)

    @app.route('/get_sources', methods=['POST'])
    def get_sources():
        try:
            data = request.json
            user_identifier = data.get('user_identifier')
            
            if not user_identifier:
                return jsonify({'error': 'User identifier not provided'}), 400
                
            # Create a safe filename
            filename = ''.join(c for c in user_identifier if c.isalnum())
            sources_file_path = os.path.join(CONVERSATION_PATH, f"{filename}_sources.json")
            
            # Check if the sources file exists
            if not os.path.exists(sources_file_path):
                return jsonify({'error': 'No sources found for this user'}), 404
                
            # Load the sources
            with open(sources_file_path, 'r', encoding='utf-8') as f:
                sources = json.load(f)
                
            return jsonify({'sources': sources})
            
        except Exception as e:
            logger.error(f"Error in get_sources: {str(e)}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500
    

        
    @app.route('/get_source_details', methods=['POST'])
    def get_source_details():
        try:
            data = request.json
            user_identifier = data.get('user_identifier')
            
            if not user_identifier:
                return jsonify({'error': 'User identifier not provided'}), 400
                
            # Create a safe filename
            filename = ''.join(c for c in user_identifier if c.isalnum())
            sources_file_path = os.path.join(CONVERSATION_PATH, f"{filename}_sources.json")
            
            # Check if the sources file exists
            if not os.path.exists(sources_file_path):
                return jsonify({'error': 'No sources found for this user'}), 404
                
            # Load the sources
            with open(sources_file_path, 'r', encoding='utf-8') as f:
                sources = json.load(f)
                
            return jsonify({'sources': sources})
            
        except Exception as e:
            logger.error(f"Error in get_source_details: {str(e)}")
            return jsonify({'error': 'Internal server error', 'details': str(e)}), 500
    
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=False, host='0.0.0.0', port=5000)