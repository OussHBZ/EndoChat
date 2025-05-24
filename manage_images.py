#!/usr/bin/env python3
"""
Image Management Script for EndoChat
Use this script to:
1. Re-extract images from PDFs
2. Add descriptions to images for better semantic search
3. View and manage existing images
"""

import os
import sys
import json
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

def re_extract_images():
    """Re-extract all images from PDFs"""
    print_status("Re-extracting images from PDFs...", "info")
    
    try:
        from management.image_extractor import ImageExtractor
        
        # Create extractor instance
        extractor = ImageExtractor()
        
        # Clear existing processed files to force re-extraction
        extractor.processed_files = {}
        extractor.save_processed_files()
        
        # Re-extract images
        success = extractor.process_pdfs_for_images()
        
        if success:
            all_images = extractor.get_all_images()
            print_status(f"Successfully extracted {len(all_images)} images", "success")
            return extractor
        else:
            print_status("Image extraction failed", "error")
            return None
            
    except Exception as e:
        print_status(f"Error during image extraction: {str(e)}", "error")
        return None

def list_images(extractor):
    """List all extracted images"""
    print_status("Listing all extracted images:", "info")
    
    all_images = extractor.get_all_images()
    
    if not all_images:
        print_status("No images found", "warning")
        return
    
    print(f"\n{'='*80}")
    print(f"{'Filename':<40} {'Source PDF':<25} {'Page':<6} {'Description'}")
    print(f"{'='*80}")
    
    for image in all_images:
        filename = image['filename']
        source = image['source_pdf']
        page = image['page_number']
        description = image.get('description', 'No description')
        
        print(f"{filename:<40} {source:<25} {page:<6} {description}")
    
    print(f"{'='*80}")
    print(f"Total images: {len(all_images)}")

def add_image_descriptions(extractor):
    """Interactive function to add descriptions to images"""
    print_status("Adding descriptions to images", "info")
    
    all_images = extractor.get_all_images()
    
    if not all_images:
        print_status("No images found. Extract images first.", "warning")
        return
    
    # Group images by source PDF for better organization
    pdf_groups = {}
    for image in all_images:
        pdf_name = image['source_pdf']
        if pdf_name not in pdf_groups:
            pdf_groups[pdf_name] = []
        pdf_groups[pdf_name].append(image)
    
    print(f"\nFound images from {len(pdf_groups)} PDF files:")
    for i, pdf_name in enumerate(pdf_groups.keys(), 1):
        image_count = len(pdf_groups[pdf_name])
        print(f"{i}. {pdf_name} ({image_count} images)")
    
    print(f"{len(pdf_groups) + 1}. Add descriptions to all images")
    print(f"{len(pdf_groups) + 2}. Skip this step")
    
    try:
        choice = input(f"\nSelect PDF to add descriptions (1-{len(pdf_groups) + 2}): ").strip()
        choice_num = int(choice)
        
        if choice_num == len(pdf_groups) + 2:
            print_status("Skipping description addition", "info")
            return
        elif choice_num == len(pdf_groups) + 1:
            # Add descriptions to all images
            selected_images = all_images
        else:
            # Add descriptions to specific PDF
            pdf_names = list(pdf_groups.keys())
            if 1 <= choice_num <= len(pdf_names):
                selected_pdf = pdf_names[choice_num - 1]
                selected_images = pdf_groups[selected_pdf]
                print_status(f"Adding descriptions for images from: {selected_pdf}", "info")
            else:
                print_status("Invalid choice", "error")
                return
        
        # Add descriptions to selected images
        descriptions_added = 0
        for image in selected_images:
            filename = image['filename']
            current_desc = image.get('description', '')
            
            print(f"\n--- Image: {filename} ---")
            print(f"Source: {image['source_pdf']}, Page: {image['page_number']}")
            print(f"Size: {image['width']}x{image['height']}px")
            if current_desc:
                print(f"Current description: {current_desc}")
            else:
                print("No current description")
            
            print("\nYou can view the image at:")
            print(f"File path: {image['file_path']}")
            
            new_desc = input("Enter description (press Enter to skip): ").strip()
            
            if new_desc:
                if extractor.add_image_description(filename, new_desc):
                    print_status(f"Added description: {new_desc}", "success")
                    descriptions_added += 1
                else:
                    print_status("Failed to add description", "error")
        
        print_status(f"Added descriptions to {descriptions_added} images", "success")
        
    except (ValueError, KeyboardInterrupt):
        print_status("Operation cancelled", "warning")

def bulk_add_descriptions(extractor):
    """Add descriptions from a predefined dictionary"""
    print_status("Adding bulk descriptions...", "info")
    
    # Example descriptions - modify these based on your actual images
    sample_descriptions = {
        # Add your image filenames and descriptions here
        # Example:
        # "diabetes_guide_page1_img1_abcd1234.png": "Diagram showing insulin injection sites on human body",
        # "hormone_chart_page3_img1_efgh5678.png": "Chart comparing different hormone levels in blood",
    }
    
    if not sample_descriptions:
        print_status("No bulk descriptions defined. Edit the script to add them.", "warning")
        print("Add descriptions in the 'sample_descriptions' dictionary in the script.")
        return
    
    updated_count = extractor.update_image_descriptions(sample_descriptions)
    print_status(f"Updated {updated_count} image descriptions", "success")

def main():
    """Main function"""
    print("=" * 60)
    print("🖼️  EndoChat Image Management Tool")
    print("=" * 60)
    
    print("\nOptions:")
    print("1. Re-extract images from PDFs")
    print("2. List all extracted images")
    print("3. Add descriptions to images (interactive)")
    print("4. Add bulk descriptions (from script)")
    print("5. Exit")
    
    try:
        choice = input("\nSelect option (1-5): ").strip()
        
        if choice == "1":
            extractor = re_extract_images()
            if extractor:
                print_status("Images re-extracted successfully!", "success")
                print("\nNext steps:")
                print("1. Run option 2 to list images")
                print("2. Run option 3 to add descriptions")
        
        elif choice == "2":
            try:
                from management.image_extractor import ImageExtractor
                extractor = ImageExtractor()
                list_images(extractor)
            except Exception as e:
                print_status(f"Error listing images: {str(e)}", "error")
        
        elif choice == "3":
            try:
                from management.image_extractor import ImageExtractor
                extractor = ImageExtractor()
                add_image_descriptions(extractor)
            except Exception as e:
                print_status(f"Error adding descriptions: {str(e)}", "error")
        
        elif choice == "4":
            try:
                from management.image_extractor import ImageExtractor
                extractor = ImageExtractor()
                bulk_add_descriptions(extractor)
            except Exception as e:
                print_status(f"Error adding bulk descriptions: {str(e)}", "error")
        
        elif choice == "5":
            print_status("Goodbye!", "info")
            return
        
        else:
            print_status("Invalid option", "error")
    
    except KeyboardInterrupt:
        print_status("\nOperation cancelled by user", "warning")
    except Exception as e:
        print_status(f"Unexpected error: {str(e)}", "error")

if __name__ == "__main__":
    main()