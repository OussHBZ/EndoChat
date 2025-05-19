# from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
import logging

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

def get_embedding_function():
    """Returns the embedding function using sentence-transformers model.
    
    This function provides the embeddings specifically tuned for endocrinology documents.
    It uses HuggingFace sentence-transformers to transform texts into vectors suitable 
    for semantic search.
    """
    try:
        return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    except Exception as e:
        logging.error(f"Error initializing embeddings: {e}")
        # Fallback to a different model if needed
        try:
            logging.info("Attempting fallback to multi-qa-MiniLM-L6-cos-v1 model")
            return HuggingFaceEmbeddings(model_name="sentence-transformers/multi-qa-MiniLM-L6-cos-v1")
        except Exception as fallback_error:
            logging.error(f"Fallback embedding also failed: {fallback_error}")
            raise Exception("Unable to initialize any embedding model")