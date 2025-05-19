import os
import shutil
import argparse
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define paths
CHROMA_PATH = "./chroma_db"
CONVERSATION_PATH = "./conversations"
PROCESSED_FILES_PATH = "./processed_files.json"

def reset_database(reset_all=False, reset_embeddings=False, reset_conversations=False):
    """Reset the database files"""
    try:
        count = 0
        
        # Reset all or specific components
        if reset_all or reset_embeddings:
            if os.path.exists(CHROMA_PATH):
                shutil.rmtree(CHROMA_PATH)
                logger.info(f"Deleted Chroma database at {CHROMA_PATH}")
                count += 1
                
            if os.path.exists(PROCESSED_FILES_PATH):
                os.remove(PROCESSED_FILES_PATH)
                logger.info(f"Deleted processed files record at {PROCESSED_FILES_PATH}")
                count += 1
        
        if reset_all or reset_conversations:
            if os.path.exists(CONVERSATION_PATH):
                shutil.rmtree(CONVERSATION_PATH)
                os.makedirs(CONVERSATION_PATH)
                logger.info(f"Reset conversations directory at {CONVERSATION_PATH}")
                count += 1
        
        if count == 0:
            logger.info("No data was reset. Use --all or specify components to reset.")
        else:
            logger.info(f"Reset complete. Removed {count} components.")
        
        return True
        
    except Exception as e:
        logger.error(f"Error in reset_database: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset EndoChat database components")
    parser.add_argument("--all", action="store_true", help="Reset all database components")
    parser.add_argument("--embeddings", action="store_true", help="Reset just the vector embeddings")
    parser.add_argument("--conversations", action="store_true", help="Reset just the conversation histories")
    
    args = parser.parse_args()
    
    reset_database(
        reset_all=args.all,
        reset_embeddings=args.embeddings,
        reset_conversations=args.conversations
    )