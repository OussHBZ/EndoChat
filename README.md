# EndoChat

EndoChat is an AI-powered chatbot specializing in endocrinology. It uses Retrieval Augmented Generation (RAG) to provide accurate and context-aware responses for patients seeking information about endocrine disorders, treatments, and related medical topics.

## 🚀 Features

### Core Features
- **Patient-Focused Responses**: Provides easy-to-understand information about endocrinology tailored for patients
- **Source Citations**: Includes references to source documents with page numbers and downloadable PDFs
- **Image Support**: Displays relevant medical images when available
- **RAG-based Document Retrieval**: Finds and retrieves the most relevant information from endocrinology documents
- **PDF Document Processing**: Automatically processes PDF documents for text content
- **Semantic Search**: Uses sentence-transformers models for high-quality document embeddings
- **Conversation Management**: Maintains conversation history for contextual understanding

### Voice Features ✨ NEW
- **High-Quality Text-to-Speech**: Powered by Amazon Polly with professional voices
- **Multi-language Support**: Natural voices for English, French, and Arabic
- **Speech Recognition**: Voice input support for hands-free interaction
- **Audio Caching**: Intelligent caching system for faster playback

### User Interface
- **Modern UI**: Clean and responsive user interface for seamless chat experience
- **Multi-language Interface**: Support for English, French, and Arabic
- **RTL Support**: Full right-to-left text support for Arabic
- **Mobile Responsive**: Works perfectly on desktop, tablet, and mobile devices

## 🛠️ Requirements

- Python 3.9+
- Flask
- LangChain
- Groq API key (for LLaMa access)
- **AWS Account** (for Amazon Polly TTS - Free Tier eligible)
- sentence-transformers (for embeddings)

## 📋 Setup and Usage Instructions

### 1. Initial Setup

#### Create and activate the virtual environment
```bash
# Create a virtual environment
python -m venv env

# Activate on Windows
env\Scripts\activate

# Activate on macOS/Linux
source env/bin/activate
```

#### Install dependencies
```bash
# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

### 2. Project Structure Setup

Run the setup script to create necessary directories:
```bash
python setup.py
```

### 3. Configuration

#### Set up environment variables
```bash
# Copy the template
copy .env.template .env  # Windows
cp .env.template .env    # macOS/Linux
```

#### Edit the .env file with your API keys:
```bash
# API Keys
GROQ_API_KEY=your_groq_api_key_here

# AWS Polly Configuration (NEW)
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_REGION=us-east-1

# Application Settings
FLASK_APP=app.py
FLASK_ENV=production
FLASK_DEBUG=0
```

#### 🔊 Amazon Polly Setup (Text-to-Speech)
For high-quality voice features, set up Amazon Polly:

1. **Follow the detailed setup guide**: See `AMAZON_POLLY_SETUP.md`
2. **Quick setup**: 
   - Create AWS account (Free Tier)
   - Create IAM user with Polly permissions
   - Add credentials to `.env` file
3. **Free Tier includes**: 5 million characters/month for 12 months
4. **Cost after Free Tier**: $4.00 per 1 million characters

### 4. Add Documents

Place your endocrinology PDF documents in the data directory:
```bash
# Create data directory if it doesn't exist
mkdir -p data

# Copy your PDF files to the data directory
# Example:
# copy "path\to\your\endocrinology_document.pdf" data\
```

### 5. Process Documents

Process the documents to generate embeddings:
```bash
python load_data.py
```

### 6. Start the Application

```bash
python app.py
```

Open your browser and navigate to `http://localhost:5000`

## 🔧 Database Management

### Reset Database
```bash
# Reset everything
python reset_database.py --all

# Reset only embeddings
python reset_database.py --embeddings

# Reset only conversation histories
python reset_database.py --conversations
```

## ⚙️ Customization

### System Prompt
To modify how EndoChat responds:
- Edit the `find_document_similarity` function in `management/compare_texts.py`

### Voice Configuration
To change TTS voices:
- Edit voice mappings in `management/polly_tts.py`
- Available voices: Joanna (EN), Lea (FR), Zeina (AR)

### UI Customization
- Replace `static/img/endo_logo.png` with your own logo
- Modify `static/css/style.css` to change the appearance
- Edit language settings in `static/js/chat.js`

## 🌍 Multi-language Support

EndoChat supports three languages:
- **English**: Full UI and voice support
- **French**: Full UI and voice support  
- **Arabic**: Full UI with RTL support and voice support

Users can select their preferred language at the start of each session.

## 🎙️ Voice Features

### Text-to-Speech (Amazon Polly)
- **High-quality voices**: Professional neural voices for English and French
- **Natural pronunciation**: Optimized for medical terminology
- **Smart caching**: Audio files cached for faster repeated playback
- **Automatic cleanup**: Old cache files automatically removed

### Speech Recognition (Browser-based)
- **Voice input**: Click microphone to speak your questions
- **Multi-language**: Supports English, French, and Arabic input
- **Real-time transcription**: See your speech converted to text instantly

## 🔍 Troubleshooting

### Common Issues

#### No documents found?
- Ensure PDFs are placed in the `/data` directory
- Run `python load_data.py` to process documents

#### Embedding errors?
- Check Python environment for required packages
- Verify internet connection for downloading models

#### UI issues?
- Clear browser cache or try a different browser
- Check browser console for JavaScript errors

#### Voice features not working?
- **TTS**: Check AWS credentials and Polly setup
- **Speech Recognition**: Check browser permissions for microphone access
- **Network**: Verify internet connection for API calls

#### Amazon Polly Issues?
- Check AWS credentials in `.env` file
- Verify IAM permissions for Polly access
- Monitor Free Tier usage in AWS console
- See `AMAZON_POLLY_SETUP.md` for detailed troubleshooting

### Check Service Status
Visit `http://localhost:5000/tts_status` to check TTS service availability.

## 💰 Cost Considerations

### Amazon Polly Costs
- **Free Tier**: 5 million characters/month for first 12 months
- **After Free Tier**: $4.00 per 1 million characters
- **Typical usage**: ~300,000 characters/month for normal use
- **Optimization**: Smart caching and text cleaning minimize costs

### Groq API
- Check Groq pricing for LLM usage
- Monitor usage through Groq dashboard

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit `.env` file to version control
2. **AWS Credentials**: Use least-privilege IAM policies
3. **API Keys**: Rotate credentials regularly
4. **Access Control**: Consider adding authentication for production use

## 📁 Project Structure

```
EndoChat/
├── management/
│   ├── compare_texts.py      # RAG and document retrieval
│   ├── conversation_manager.py
│   ├── embeddings.py
│   └── polly_tts.py         # NEW: Amazon Polly integration
├── static/
│   ├── css/style.css
│   ├── js/chat.js           # Updated with Polly support
│   ├── img/
│   └── audio_cache/         # NEW: TTS audio cache
├── templates/
│   └── chat.html
├── data/                    # Your PDF documents
├── conversations/           # User conversation histories
├── chroma_db/              # Vector database
├── app.py                  # Main Flask application
├── load_data.py           # Document processing
├── requirements.txt       # Python dependencies
└── .env                   # Configuration (create from template)
```

## 🆕 What's New in This Version

### Amazon Polly Integration
- **Professional TTS**: Replaced browser TTS with Amazon Polly
- **Better Quality**: Consistent, high-quality voices across all devices
- **Multi-language**: Native support for English, French, and Arabic
- **Smart Caching**: Reduced costs through intelligent audio caching
- **Fallback Support**: Graceful degradation if TTS unavailable

### Enhanced Voice Features
- **Loading indicators**: Visual feedback during audio generation
- **Better error handling**: Clear error messages for TTS issues
- **Improved UI**: Enhanced voice control buttons and feedback

### Infrastructure Improvements
- **Audio caching system**: Faster playback and cost optimization
- **Enhanced logging**: Better debugging and monitoring
- **Security improvements**: Secure credential handling

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues related to:
- **Amazon Polly**: See `AMAZON_POLLY_SETUP.md`
- **General setup**: Check this README and troubleshooting section
- **Technical issues**: Check application logs and browser console

---

**Note**: This application now features professional-grade text-to-speech powered by Amazon Polly, providing a superior voice experience compared to browser-based TTS solutions.