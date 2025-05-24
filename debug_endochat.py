#!/usr/bin/env python3
"""
Debug script for EndoChat issues
Run this to identify problems with your setup
"""

import os
import sys
from dotenv import load_dotenv

def print_status(message, status="info"):
    """Print colored status messages"""
    colors = {
        "success": "\033[92m✅",
        "error": "\033[91m❌", 
        "warning": "\033[93m⚠️",
        "info": "\033[94mℹ️"
    }
    end_color = "\033[0m"
    print(f"{colors.get(status, '')} {message}{end_color}")

def check_environment():
    """Check environment configuration"""
    print_status("Checking environment configuration...", "info")
    
    if not os.path.exists('.env'):
        print_status("No .env file found", "error")
        return False
    
    load_dotenv()
    
    # Check Groq API key
    groq_key = os.getenv('GROQ_API_KEY')
    if not groq_key:
        print_status("GROQ_API_KEY not found in .env", "error")
        return False
    elif len(groq_key) < 10:
        print_status("GROQ_API_KEY seems too short", "error")
        return False
    else:
        print_status(f"GROQ_API_KEY found (length: {len(groq_key)})", "success")
    
    return True

def test_groq_connection():
    """Test Groq API connection"""
    print_status("Testing Groq API connection...", "info")
    
    try:
        from langchain_groq import ChatGroq
        
        api_key = os.getenv('GROQ_API_KEY')
        client = ChatGroq(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.2,
            api_key=api_key,
        )
        
        # Test with a simple message
        response = client.invoke("Hello, this is a test message.")
        print_status(f"Groq API working: {response.content[:50]}...", "success")
        return True
        
    except Exception as e:
        print_status(f"Groq API error: {str(e)}", "error")
        return False

def check_embeddings():
    """Check embedding model"""
    print_status("Testing embedding model...", "info")
    
    try:
        from management.embeddings import get_embedding_function
        embeddings = get_embedding_function()
        print_status("Embedding model loaded successfully", "success")
        return True
    except Exception as e:
        print_status(f"Embedding error: {str(e)}", "error")
        return False

def check_database():
    """Check vector database"""
    print_status("Checking vector database...", "info")
    
    try:
        from management.compare_texts import initialize_db, get_db
        from management.embeddings import get_embedding_function
        
        embeddings = get_embedding_function()
        initialize_db(embeddings)
        db = get_db()
        
        if db:
            print_status("Vector database initialized", "success")
            return True
        else:
            print_status("Vector database initialization failed", "error")
            return False
            
    except Exception as e:
        print_status(f"Database error: {str(e)}", "error")
        return False

def check_documents():
    """Check if documents are processed"""
    print_status("Checking processed documents...", "info")
    
    data_dir = "./data"
    chroma_dir = "./chroma_db"
    
    if not os.path.exists(data_dir):
        print_status("Data directory not found", "error")
        return False
    
    pdf_files = [f for f in os.listdir(data_dir) if f.lower().endswith('.pdf')]
    if not pdf_files:
        print_status("No PDF files found in data directory", "error")
        return False
    
    print_status(f"Found {len(pdf_files)} PDF files", "success")
    
    if not os.path.exists(chroma_dir):
        print_status("ChromaDB directory not found - run 'python load_data.py'", "warning")
        return False
    
    print_status("ChromaDB directory exists", "success")
    return True

def test_document_retrieval():
    """Test document retrieval functionality"""
    print_status("Testing document retrieval...", "info")
    
    try:
        from management.compare_texts import find_document_similarity
        
        # Test with a simple query
        prompt, history = find_document_similarity(
            "What is diabetes?", 
            [], 
            "test_user", 
            "en"
        )
        
        if prompt and len(prompt) > 100:
            print_status("Document retrieval working", "success")
            return True
        else:
            print_status("Document retrieval returned empty prompt", "error")
            return False
            
    except Exception as e:
        print_status(f"Document retrieval error: {str(e)}", "error")
        return False

def main():
    """Run all debug tests"""
    print("=" * 60)
    print("🔍 EndoChat Debug Tool")
    print("=" * 60)
    
    all_passed = True
    
    # Test 1: Environment
    if not check_environment():
        all_passed = False
        print("\n❌ Fix your .env file before continuing")
        return False
    
    # Test 2: Groq API
    if not test_groq_connection():
        all_passed = False
        print("\n❌ Fix your Groq API configuration")
        return False
    
    # Test 3: Embeddings
    if not check_embeddings():
        all_passed = False
        print("\n❌ Fix your embedding model installation")
    
    # Test 4: Database
    if not check_database():
        all_passed = False
        print("\n❌ Fix your vector database setup")
    
    # Test 5: Documents
    if not check_documents():
        all_passed = False
        print("\n❌ Add PDF documents and run 'python load_data.py'")
    
    # Test 6: Document Retrieval
    if not test_document_retrieval():
        all_passed = False
        print("\n❌ Fix your document processing")
    
    if all_passed:
        print("\n" + "=" * 60)
        print_status("All tests passed! Your EndoChat should work properly.", "success")
        print("=" * 60)
        print("\n📋 If you're still getting errors:")
        print("1. Check your browser's Developer Console (F12)")
        print("2. Look at the Flask application logs")
        print("3. Try refreshing the page")
    else:
        print("\n" + "=" * 60)
        print_status("Some tests failed. Fix the issues above and try again.", "error")
        print("=" * 60)
    
    return all_passed

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_status("\nDebug interrupted by user", "warning")
        sys.exit(1)
    except Exception as e:
        print_status(f"Unexpected error: {str(e)}", "error")
        sys.exit(1)