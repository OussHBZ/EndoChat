#!/usr/bin/env python3
"""
Setup script for EndoChat project structure.
Creates necessary directories and files.
"""

import os
import shutil
import sys

def print_color(text, color_code):
    """Print colored text"""
    print(f"\033[{color_code}m{text}\033[0m")

def create_directory(directory):
    """Create a directory if it doesn't exist"""
    if not os.path.exists(directory):
        os.makedirs(directory)
        print_color(f"Created directory: {directory}", "32")
    else:
        print_color(f"Directory already exists: {directory}", "33")

def create_file(filepath, content=""):
    """Create a file with optional content"""
    if not os.path.exists(filepath):
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print_color(f"Created file: {filepath}", "32")
    else:
        print_color(f"File already exists: {filepath}", "33")

def copy_template(source, destination):
    """Copy a template file"""
    if not os.path.exists(destination):
        shutil.copyfile(source, destination)
        print_color(f"Created file from template: {destination}", "32")
    else:
        print_color(f"File already exists: {destination}", "33")

def main():
    """Main setup function"""
    print_color("\n=== Setting up EndoChat Project Structure ===\n", "36")
    
    # Create main directories
    directories = [
        "data",
        "chroma_db",
        "conversations",
        "static/css",
        "static/js",
        "static/img",
        "static/audio_cache",      # For Polly audio cache
        "static/extracted_images", # NEW: For extracted PDF images
        "templates",
        "management"
    ]
    
    for directory in directories:
        create_directory(directory)
    
    # Create __init__.py files for Python packages
    create_file("management/__init__.py")
    
    # Copy environment template
    if os.path.exists(".env.template") and not os.path.exists(".env"):
        copy_template(".env.template", ".env")
        print_color("\nIMPORTANT: Don't forget to edit your .env file with your API keys!", "33")
        print_color("New: Add your AWS credentials for Amazon Polly TTS!", "33")
    
    # Create placeholder for logo if it doesn't exist
    if not os.path.exists("static/img/endo_logo.png"):
        print_color("\nReminder: Add your logo as 'static/img/endo_logo.png'", "33")
    
    # Create .gitkeep files for cache directories
    gitkeep_paths = [
        "static/audio_cache/.gitkeep",
        "static/extracted_images/.gitkeep"
    ]
    
    for gitkeep_path in gitkeep_paths:
        if not os.path.exists(gitkeep_path):
            directory_name = os.path.dirname(gitkeep_path).split('/')[-1]
            create_file(gitkeep_path, f"# This file ensures the {directory_name} directory is tracked by git\n")
    
    print_color("\n=== Project setup complete ===\n", "36")
    print_color("Next steps:", "36")
    print_color("1. Activate your virtual environment", "0")
    print_color("2. Install dependencies: pip install -r requirements.txt", "0")
    print_color("3. Configure AWS credentials in .env file for Polly TTS", "31")
    print_color("4. Place your PDF documents in the 'data' directory", "0")
    print_color("5. Process documents: python load_data.py", "0")
    print_color("6. Start the application: python app.py", "0")
    print_color("\nNew Features:", "36")
    print_color("🖼️  Images will be automatically extracted from PDFs", "32")
    print_color("🔊 Professional TTS with Amazon Polly", "32")
    print_color("📱 Enhanced chat with image display", "32")
    print_color("\nFor Amazon Polly setup, see AMAZON_POLLY_SETUP.md", "36")
    print()

if __name__ == "__main__":
    main()