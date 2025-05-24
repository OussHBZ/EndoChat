import boto3
import os
import logging
import hashlib
import json
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError
from datetime import datetime, timedelta

# Setup logging
logger = logging.getLogger(__name__)

class PollyTTSManager:
    def __init__(self):
        """Initialize the Amazon Polly TTS Manager"""
        self.client = None
        self.audio_cache_dir = "./static/audio_cache"
        self.cache_duration_hours = 24  # Cache audio files for 24 hours
        
        # Create audio cache directory if it doesn't exist
        if not os.path.exists(self.audio_cache_dir):
            os.makedirs(self.audio_cache_dir)
            logger.info(f"Created audio cache directory: {self.audio_cache_dir}")
        
        # Initialize AWS Polly client
        self._initialize_polly_client()
    
    def _initialize_polly_client(self):
        """Initialize the AWS Polly client with credentials"""
        try:
            # Get AWS credentials from environment variables
            aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
            aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
            aws_region = os.getenv('AWS_REGION', 'us-east-1')
            
            if not aws_access_key or not aws_secret_key:
                logger.error("AWS credentials not found in environment variables")
                return False
            
            # Create Polly client
            self.client = boto3.client(
                'polly',
                aws_access_key_id=aws_access_key,
                aws_secret_access_key=aws_secret_key,
                region_name=aws_region
            )
            
            # Test the connection by listing voices (without MaxItems parameter)
            test_response = self.client.describe_voices()
            logger.info("Successfully connected to Amazon Polly")
            return True
            
        except NoCredentialsError:
            logger.error("AWS credentials not found")
            return False
        except Exception as e:
            logger.error(f"Error initializing Polly client: {str(e)}")
            return False
    
    def get_voice_for_language(self, language):
        """Get the appropriate Polly voice for the given language"""
        voice_mapping = {
            'en': {
                'voice_id': 'Joanna',  # US English, Neural voice
                'engine': 'neural'
            },
            'fr': {
                'voice_id': 'Lea',     # French, Neural voice
                'engine': 'neural'
            },
            'ar': {
                'voice_id': 'Zeina',   # Arabic, Standard voice (Neural not available for Arabic)
                'engine': 'standard'
            }
        }
        
        return voice_mapping.get(language, voice_mapping['en'])
    
    def _generate_cache_key(self, text, language):
        """Generate a unique cache key for the text and language combination"""
        # Create a hash of the text and language
        content = f"{text}_{language}".encode('utf-8')
        hash_object = hashlib.md5(content)
        return hash_object.hexdigest()
    
    def _is_cache_valid(self, cache_file_path):
        """Check if the cached audio file is still valid (not expired)"""
        if not os.path.exists(cache_file_path):
            return False
        
        # Check file age
        file_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(cache_file_path))
        return file_age < timedelta(hours=self.cache_duration_hours)
    
    def _cleanup_old_cache_files(self):
        """Remove expired cache files"""
        try:
            current_time = datetime.now()
            removed_count = 0
            
            for filename in os.listdir(self.audio_cache_dir):
                if filename.endswith('.mp3'):
                    file_path = os.path.join(self.audio_cache_dir, filename)
                    file_age = current_time - datetime.fromtimestamp(os.path.getmtime(file_path))
                    
                    if file_age > timedelta(hours=self.cache_duration_hours):
                        os.remove(file_path)
                        removed_count += 1
            
            if removed_count > 0:
                logger.info(f"Cleaned up {removed_count} expired audio cache files")
                
        except Exception as e:
            logger.error(f"Error cleaning up cache files: {str(e)}")
    
    def synthesize_speech(self, text, language='en'):
        """
        Synthesize speech using Amazon Polly
        
        Args:
            text (str): Text to convert to speech
            language (str): Language code ('en', 'fr', 'ar')
            
        Returns:
            str: Path to the generated audio file, or None if failed
        """
        if not self.client:
            logger.error("Polly client not initialized")
            return None
        
        # Clean text for TTS (remove markdown, etc.)
        clean_text = self._clean_text_for_tts(text)
        
        if not clean_text.strip():
            logger.warning("Empty text provided for TTS")
            return None
        
        # Generate cache key and file path
        cache_key = self._generate_cache_key(clean_text, language)
        cache_file_path = os.path.join(self.audio_cache_dir, f"{cache_key}.mp3")
        
        # Check if we have a valid cached version
        if self._is_cache_valid(cache_file_path):
            logger.debug(f"Using cached audio file: {cache_key}")
            return f"audio_cache/{cache_key}.mp3"
        
        # Get voice configuration for language
        voice_config = self.get_voice_for_language(language)
        
        try:
            # Clean up old cache files periodically
            self._cleanup_old_cache_files()
            
            # Make the Polly request
            response = self.client.synthesize_speech(
                Text=clean_text,
                OutputFormat='mp3',
                VoiceId=voice_config['voice_id'],
                Engine=voice_config['engine'],
                SampleRate='22050'  # Good quality for web playback
            )
            
            # Save the audio stream to file
            with open(cache_file_path, 'wb') as audio_file:
                audio_file.write(response['AudioStream'].read())
            
            logger.info(f"Generated TTS audio for language '{language}' using voice '{voice_config['voice_id']}'")
            
            # Return the relative path for web access
            return f"audio_cache/{cache_key}.mp3"
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'TextLengthExceededException':
                logger.error("Text too long for Polly synthesis")
                # Try to truncate and retry
                truncated_text = clean_text[:3000]  # Polly limit is around 3000 characters
                logger.info("Retrying with truncated text")
                return self.synthesize_speech(truncated_text, language)
            else:
                logger.error(f"AWS Polly ClientError: {error_code} - {e.response['Error']['Message']}")
            return None
            
        except BotoCoreError as e:
            logger.error(f"AWS Polly BotoCoreError: {str(e)}")
            return None
            
        except Exception as e:
            logger.error(f"Unexpected error in speech synthesis: {str(e)}")
            return None
    
    def _clean_text_for_tts(self, text):
        """Clean text for better TTS output"""
        import re
        
        # Remove markdown formatting
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)  # Bold
        text = re.sub(r'\*(.*?)\*', r'\1', text)      # Italic
        text = re.sub(r'`(.*?)`', r'\1', text)        # Code
        text = re.sub(r'#{1,6}\s+', '', text)         # Headers
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)  # Links
        
        # Remove code blocks
        text = re.sub(r'```[^`]*```', '', text, flags=re.DOTALL)
        
        # Remove HTML tags if any
        text = re.sub(r'<[^>]+>', '', text)
        
        # Clean up extra whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        # Limit length for Polly (max ~3000 characters)
        if len(text) > 3000:
            text = text[:2997] + "..."
            logger.warning("Text truncated for Polly TTS due to length limit")
        
        return text
    
    def get_available_voices(self):
        """Get list of available voices from Polly"""
        if not self.client:
            return []
        
        try:
            response = self.client.describe_voices()
            voices = response.get('Voices', [])
            
            # Filter to voices we're interested in
            supported_languages = ['en-US', 'fr-FR', 'arb']  # arb is Arabic
            filtered_voices = [
                voice for voice in voices 
                if voice['LanguageCode'] in supported_languages
            ]
            
            return filtered_voices
            
        except Exception as e:
            logger.error(f"Error getting available voices: {str(e)}")
            return []
    
    def is_service_available(self):
        """Check if the Polly service is available and properly configured"""
        return self.client is not None