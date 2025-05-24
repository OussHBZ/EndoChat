#!/usr/bin/env python3
"""
Test script for Amazon Polly TTS integration
Run this to verify your AWS credentials and Polly setup
"""

import os
import sys
import boto3
from dotenv import load_dotenv
from botocore.exceptions import NoCredentialsError, ClientError

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

def test_env_file():
    """Test if .env file exists and has required variables"""
    print_status("Checking environment configuration...", "info")
    
    if not os.path.exists('.env'):
        print_status("No .env file found. Please copy .env.template to .env", "error")
        return False
    
    load_dotenv()
    
    required_vars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print_status(f"Missing environment variables: {', '.join(missing_vars)}", "error")
        return False
    
    print_status("Environment variables found", "success")
    return True

def test_aws_credentials():
    """Test AWS credentials and basic connectivity"""
    print_status("Testing AWS credentials...", "info")
    
    try:
        # Create Polly client
        client = boto3.client(
            'polly',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        
        # Test connection by listing voices (using correct parameters)
        response = client.describe_voices()
        print_status("AWS credentials valid", "success")
        return client
        
    except NoCredentialsError:
        print_status("AWS credentials not found or invalid", "error")
        return None
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'UnauthorizedOperation':
            print_status("AWS credentials valid but insufficient permissions", "error")
        elif error_code == 'InvalidUserID.NotFound':
            print_status("AWS Access Key ID not found", "error")
        elif error_code == 'SignatureDoesNotMatch':
            print_status("AWS Secret Access Key is incorrect", "error")
        elif error_code == 'AccessDenied':
            print_status("Access denied - check IAM permissions for Polly", "error")
        else:
            print_status(f"AWS error: {error_code} - {e.response['Error']['Message']}", "error")
        return None
    except Exception as e:
        print_status(f"Unexpected error: {str(e)}", "error")
        return None

def test_polly_voices(client):
    """Test available voices for each language"""
    print_status("Checking available voices...", "info")
    
    try:
        response = client.describe_voices()
        voices = response.get('Voices', [])
        
        # Languages we support
        target_languages = {
            'en-US': 'English (US)',
            'fr-FR': 'French (France)', 
            'arb': 'Arabic'
        }
        
        found_voices = {}
        
        for voice in voices:
            lang_code = voice['LanguageCode']
            if lang_code in target_languages:
                if lang_code not in found_voices:
                    found_voices[lang_code] = []
                found_voices[lang_code].append({
                    'name': voice['Name'],
                    'gender': voice['Gender'],
                    'engine': voice.get('SupportedEngines', ['standard'])
                })
        
        # Report findings
        for lang_code, lang_name in target_languages.items():
            if lang_code in found_voices:
                voices_list = found_voices[lang_code]
                print_status(f"{lang_name}: {len(voices_list)} voices available", "success")
                for voice in voices_list[:2]:  # Show first 2 voices
                    engines = ', '.join(voice['engine'])
                    print(f"    - {voice['name']} ({voice['gender']}, {engines})")
            else:
                print_status(f"{lang_name}: No voices found", "warning")
        
        return len(found_voices) > 0
        
    except Exception as e:
        print_status(f"Error checking voices: {str(e)}", "error")
        return False

def test_synthesis(client):
    """Test actual speech synthesis"""
    print_status("Testing speech synthesis...", "info")
    
    test_cases = [
        {
            'text': 'Hello, this is a test of Amazon Polly text-to-speech.',
            'voice': 'Joanna',
            'language': 'English'
        },
        {
            'text': 'Bonjour, ceci est un test de synthèse vocale Amazon Polly.',
            'voice': 'Lea', 
            'language': 'French'
        },
        {
            'text': 'مرحبا، هذا اختبار لتقنية تحويل النص إلى كلام من أمازون بولي.',
            'voice': 'Zeina',
            'language': 'Arabic'
        }
    ]
    
    success_count = 0
    
    for test_case in test_cases:
        try:
            response = client.synthesize_speech(
                Text=test_case['text'],
                OutputFormat='mp3',
                VoiceId=test_case['voice'],
                Engine='neural' if test_case['voice'] in ['Joanna', 'Lea'] else 'standard'
            )
            
            # Check if we got audio data
            audio_data = response['AudioStream'].read()
            if len(audio_data) > 0:
                print_status(f"{test_case['language']} synthesis: {len(audio_data)} bytes", "success")
                success_count += 1
            else:
                print_status(f"{test_case['language']} synthesis: No audio data", "error")
                
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print_status(f"{test_case['language']} synthesis failed: {error_code} - {error_message}", "error")
        except Exception as e:
            print_status(f"{test_case['language']} synthesis error: {str(e)}", "error")
    
    return success_count > 0

def test_polly_manager():
    """Test the actual PollyTTSManager class"""
    print_status("Testing PollyTTSManager class...", "info")
    
    try:
        from management.polly_tts import PollyTTSManager
        
        manager = PollyTTSManager()
        
        if not manager.is_service_available():
            print_status("PollyTTSManager: Service not available", "error")
            return False
        
        # Test synthesis through manager
        audio_path = manager.synthesize_speech("Hello from EndoChat!", "en")
        
        if audio_path:
            print_status(f"PollyTTSManager: Generated audio at {audio_path}", "success")
            
            # Check if file exists
            full_path = os.path.join("static", audio_path)
            if os.path.exists(full_path):
                size = os.path.getsize(full_path)
                print_status(f"Audio file size: {size} bytes", "success")
                return True
            else:
                print_status("Audio file not found on disk", "error")
                return False
        else:
            print_status("PollyTTSManager: Failed to generate audio", "error")
            return False
            
    except ImportError as e:
        print_status(f"Cannot import PollyTTSManager: {str(e)}", "error")
        return False
    except Exception as e:
        print_status(f"PollyTTSManager error: {str(e)}", "error")
        return False

def main():
    """Run all tests"""
    print("=" * 50)
    print("🔊 Amazon Polly TTS Test Suite")
    print("=" * 50)
    
    # Test 1: Environment
    if not test_env_file():
        print_status("Please fix environment configuration before continuing", "error")
        print("\n📋 To fix:")
        print("1. Copy .env.template to .env")
        print("2. Add your AWS credentials to .env file")
        return False
    
    # Test 2: AWS Credentials
    client = test_aws_credentials()
    if not client:
        print_status("Please fix AWS credentials before continuing", "error")
        print("\n📋 To fix:")
        print("1. Check your AWS Access Key ID in .env")
        print("2. Check your AWS Secret Access Key in .env")
        print("3. Verify your AWS region is set correctly")
        print("4. Ensure your IAM user has Polly permissions")
        return False
    
    # Test 3: Available Voices
    if not test_polly_voices(client):
        print_status("No compatible voices found", "warning")
    
    # Test 4: Speech Synthesis
    if not test_synthesis(client):
        print_status("Speech synthesis failed", "error")
        print("\n📋 Common fixes:")
        print("1. Check your IAM user has 'polly:SynthesizeSpeech' permission")
        print("2. Try a different AWS region")
        print("3. Check AWS service status")
        return False
    
    # Test 5: PollyTTSManager
    if not test_polly_manager():
        print_status("PollyTTSManager integration failed", "error")
        print("\n📋 To fix:")
        print("1. Ensure all project files are in place")
        print("2. Check that static/audio_cache directory exists")
        print("3. Verify management/polly_tts.py exists")
        return False
    
    print("\n" + "=" * 50)
    print_status("All tests passed! Amazon Polly is ready to use.", "success")
    print("=" * 50)
    
    # Usage summary
    print("\n📋 Next Steps:")
    print("1. Start your EndoChat application: python app.py")
    print("2. Open http://localhost:5000 in your browser")
    print("3. Select a language and try the voice features")
    print("4. Check /tts_status endpoint for service status")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_status("\nTest interrupted by user", "warning")
        sys.exit(1)
    except Exception as e:
        print_status(f"Unexpected error: {str(e)}", "error")
        sys.exit(1)