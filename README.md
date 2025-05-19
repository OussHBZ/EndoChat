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

# Activate the environment
# On Windows:
env\Scripts\activate

# On macOS/Linux:
# source env/bin/activate
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
This step reads your PDF documents, splits them into chunks, and creates embeddings for semantic search.

6. Start the Application
Run the Flask application
bash
python app.py
By default, the application will be available at http://localhost:5000

7. Using the Chat Interface
Open your web browser and navigate to http://localhost:5000
Type your endocrinology-related questions in the chat input
The system will retrieve relevant information from your documents and generate patient-friendly responses with source citations
Patient-Focused Features
EndoChat is designed specifically for patients who need to understand endocrinology concepts:

Simple Language: Complex medical concepts are explained in accessible terms
Source Citations: Every piece of information includes a citation showing the source document and page number
Downloadable References: Patients can download source documents for more detailed information
Visual Aids: Relevant medical images are displayed when available to help explain concepts
Administrative Tasks
If you need to reset the database
bash
# Reset everything
python reset_database.py --all

# Reset just the embeddings
python reset_database.py --embeddings

# Reset just the conversation histories
python reset_database.py --conversations
To update your document collection
Add new PDF files to the data directory
Run python load_data.py again - only new or modified documents will be processed
Customization
To modify the system prompt
Edit the find_document_similarity function in management/compare_texts.py to customize how the chatbot responds.

To change the application logo
Replace the file at static/img/endo_logo.png with your own logo.

License
MIT License

