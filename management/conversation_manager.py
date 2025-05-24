import os
import json
import time
import logging
from datetime import datetime, timedelta

# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define paths
CONVERSATION_PATH = "./conversations"
MAX_CONVERSATION_AGE_DAYS = 30

class ConversationManager:
    """Manages conversation histories for users"""
    
    def __init__(self):
        """Initialize the conversation manager"""
        # Create the conversations directory if it doesn't exist
        if not os.path.exists(CONVERSATION_PATH):
            os.makedirs(CONVERSATION_PATH)
            logger.info(f"Created conversations directory at {CONVERSATION_PATH}")
    
    def save_conversation(self, conversation_history, user_identifier):
        """Save a conversation history to disk"""
        try:
            # Create a safe filename from the user identifier
            filename = self._get_safe_filename(user_identifier)
            file_path = os.path.join(CONVERSATION_PATH, f"{filename}.json")
            
            # Save the conversation history with timestamp
            conversation_data = {
                'history': conversation_history,
                'last_updated': time.time()
            }
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(conversation_data, f, ensure_ascii=False, indent=2)
            
            logger.debug(f"Saved conversation for user {user_identifier}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving conversation: {str(e)}")
            return False
    
    def load_conversation(self, user_identifier):
        """Load a conversation history from disk"""
        try:
            # Create a safe filename from the user identifier
            filename = self._get_safe_filename(user_identifier)
            file_path = os.path.join(CONVERSATION_PATH, f"{filename}.json")
            
            # Check if the file exists
            if not os.path.exists(file_path):
                return []
            
            # Load the conversation history
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle both old format (list) and new format (dict with 'history' key)
            if isinstance(data, list):
                # Old format - direct list
                conversation_history = data
                # Convert to new format for future compatibility
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        'history': conversation_history,
                        'last_updated': time.time()
                    }, f, ensure_ascii=False, indent=2)
            else:
                # New format - dictionary with 'history' key
                conversation_history = data.get('history', [])
                # Update the last access time
                data['last_updated'] = time.time()
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            
            logger.debug(f"Loaded conversation for user {user_identifier}")
            return conversation_history
            
        except Exception as e:
            logger.error(f"Error loading conversation: {str(e)}")
            return []
    
    def delete_conversation(self, user_identifier):
        """Delete a conversation history from disk"""
        try:
            # Create a safe filename from the user identifier
            filename = self._get_safe_filename(user_identifier)
            file_path = os.path.join(CONVERSATION_PATH, f"{filename}.json")
            
            # Check if the file exists
            if not os.path.exists(file_path):
                logger.debug(f"No conversation found for user {user_identifier}")
                return False
            
            # Delete the file
            os.remove(file_path)
            logger.info(f"Deleted conversation for user {user_identifier}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting conversation: {str(e)}")
            return False
    
    def cleanup_old_conversations(self):
        """Delete conversations that are older than MAX_CONVERSATION_AGE_DAYS"""
        try:
            # Get the current time
            current_time = time.time()
            max_age = MAX_CONVERSATION_AGE_DAYS * 24 * 60 * 60  # Convert days to seconds
            
            # Check each file in the conversations directory
            count = 0
            for filename in os.listdir(CONVERSATION_PATH):
                # Skip non-JSON files
                if not filename.endswith('.json'):
                    continue
                
                # Skip sources and images files - only process main conversation files
                if filename.endswith('_sources.json') or filename.endswith('_images.json'):
                    continue
                
                file_path = os.path.join(CONVERSATION_PATH, filename)
                
                try:
                    # Load the conversation data
                    with open(file_path, 'r', encoding='utf-8') as f:
                        conversation_data = json.load(f)
                    
                    # Handle different file formats
                    last_updated = None
                    
                    if isinstance(conversation_data, dict):
                        # New format with metadata
                        last_updated = conversation_data.get('last_updated', 0)
                    elif isinstance(conversation_data, list):
                        # Old format - use file modification time
                        last_updated = os.path.getmtime(file_path)
                    else:
                        # Unknown format - use file modification time
                        logger.warning(f"Unknown conversation format in {filename}, using file modification time")
                        last_updated = os.path.getmtime(file_path)
                    
                    # Check if the conversation is too old
                    if last_updated and current_time - last_updated > max_age:
                        # Delete the main conversation file
                        os.remove(file_path)
                        count += 1
                        logger.debug(f"Deleted old conversation: {filename}")
                        
                        # Also delete associated files (sources and images)
                        base_filename = filename.replace('.json', '')
                        
                        # Delete sources file if it exists
                        sources_file = os.path.join(CONVERSATION_PATH, f"{base_filename}_sources.json")
                        if os.path.exists(sources_file):
                            os.remove(sources_file)
                            logger.debug(f"Deleted associated sources file: {base_filename}_sources.json")
                        
                        # Delete images file if it exists
                        images_file = os.path.join(CONVERSATION_PATH, f"{base_filename}_images.json")
                        if os.path.exists(images_file):
                            os.remove(images_file)
                            logger.debug(f"Deleted associated images file: {base_filename}_images.json")
                
                except Exception as e:
                    logger.error(f"Error processing conversation file {filename}: {str(e)}")
                    continue
            
            logger.info(f"Cleanup completed. Deleted {count} old conversations.")
            return count
            
        except Exception as e:
            logger.error(f"Error in cleanup_old_conversations: {str(e)}")
            return 0
    
    def cleanup_orphaned_files(self):
        """Clean up orphaned sources and images files that don't have corresponding conversation files"""
        try:
            # Get list of main conversation files
            main_conversations = set()
            for filename in os.listdir(CONVERSATION_PATH):
                if filename.endswith('.json') and not filename.endswith('_sources.json') and not filename.endswith('_images.json'):
                    base_name = filename.replace('.json', '')
                    main_conversations.add(base_name)
            
            # Check for orphaned files
            orphaned_count = 0
            for filename in os.listdir(CONVERSATION_PATH):
                if filename.endswith('_sources.json') or filename.endswith('_images.json'):
                    # Extract base name
                    if filename.endswith('_sources.json'):
                        base_name = filename.replace('_sources.json', '')
                    else:  # _images.json
                        base_name = filename.replace('_images.json', '')
                    
                    # If no corresponding main conversation file exists, delete this file
                    if base_name not in main_conversations:
                        file_path = os.path.join(CONVERSATION_PATH, filename)
                        os.remove(file_path)
                        orphaned_count += 1
                        logger.debug(f"Deleted orphaned file: {filename}")
            
            if orphaned_count > 0:
                logger.info(f"Cleaned up {orphaned_count} orphaned files")
            
            return orphaned_count
            
        except Exception as e:
            logger.error(f"Error in cleanup_orphaned_files: {str(e)}")
            return 0
    
    def _get_safe_filename(self, user_identifier):
        """Create a safe filename from a user identifier"""
        # Replace any non-alphanumeric characters with underscores
        return ''.join(c if c.isalnum() else '_' for c in str(user_identifier))