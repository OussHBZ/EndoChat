EndoChat
EndoChat is an AI-powered chatbot specializing in endocrinology. It uses Retrieval Augmented Generation (RAG) to provide accurate and context-aware responses for patients seeking information about endocrine disorders, treatments, and related medical topics.

Features
Patient-Focused Responses: Provides easy-to-understand information about endocrinology tailored for patients.
Source Citations: Includes references to source documents with page numbers and downloadable PDFs.
Image Support: Displays relevant medical images when available.
RAG-based Document Retrieval: Finds and retrieves the most relevant information from endocrinology documents.
PDF Document Processing: Automatically processes PDF documents for text content.
Semantic Search: Uses sentence-transformers models for high-quality document embeddings.
Conversation Management: Maintains conversation history for contextual understanding.
Modern UI: Clean and responsive user interface for a seamless chat experience.
Requirements
Python 3.9+
Flask
LangChain
Groq API key (for LLaMa access)
sentence-transformers (for embeddings)
Setup and Usage Instructions
1. Initial Setup
Create and activate the virtual environment
bash
# Create a virtual environment
python -m venv env

# Activate on Windows
env\Scripts\activate

# Activate on macOS/Linux
source env/bin/activate

Install dependencies
bash
# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
2. Project Structure Setup
Run the setup script to create necessary directories
bash
python setup.py
3. Configuration
Set up environment variables
bash
# Copy the template
copy .env.template .env

# Edit the .env file with your API key
# Replace 'your_groq_api_key_here' with your actual Groq API key
4. Add Documents
Place your endocrinology PDF documents in the data directory
bash
# Create data directory if it doesn't exist
mkdir -p data

# Copy your PDF files to the data directory
# Example:
# copy "path\to\your\endocrinology_document.pdf" data\
5. Process Documents
Process the documents to generate embeddings
bash
python load_data.py
Database Reset
bash# Reset everything
python reset_database.py --all

# Reset only embeddings
python reset_database.py --embeddings

# Reset only conversation histories
python reset_database.py --conversations
⚙️ Customization
System Prompt
To modify how EndoChat responds:

Edit the find_document_similarity function in management/compare_texts.py

UI Customization

Replace static/img/endo_logo.png with your own logo
Modify static/css/style.css to change the appearance
Edit language settings in static/js/chat.js

🔍 Troubleshooting

No documents found? Ensure PDFs are placed in the /data directory
Embedding errors? Check Python environment for required packages
UI issues? Clear browser cache or try a different browser
Voice features not working? Check browser permissions for microphone access

📄 License
MIT License

