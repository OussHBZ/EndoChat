#!/usr/bin/env python3
"""
Test script to verify image detection is working correctly
"""

from management.compare_texts import semantic_search_images

def test_image_detection():
    """Test various queries to see which images are detected"""
    
    test_queries = [
        # Should trigger Image 1 (Programme de formation en insulinothérapie fonctionnelle)
        "Tell me about functional insulin therapy training programs",
        "Comment fonctionne le programme de formation en insulinothérapie?",
        "What is therapeutic education for diabetes?",
        "Programme de formation diabète",
        
        # Should trigger Image 2 (Gestion de l'hypoglycémie)
        "How to manage hypoglycemia?",
        "What should I do when blood sugar is low?",
        "Comment traiter l'hypoglycémie?",
        "My sugar levels are too low",
        "Protocole hypoglycémie",
        
        # Should trigger Image 3 (Glycemic Targets)
        "What are the glycemic targets for diabetes?",
        "Blood sugar goals for diabetics",
        "Objectifs glycémiques diabète",
        "HbA1c target values",
        "Glucose monitoring targets",
        
        # Should NOT trigger any images
        "What is diabetes?",
        "Tell me about insulin",
        "How does the pancreas work?",
        "Diabetes complications",
    ]
    
    print("=" * 80)
    print("Testing Image Detection")
    print("=" * 80)
    
    for query in test_queries:
        print(f"\nQuery: {query}")
        images = semantic_search_images(query, 'en')
        
        if images:
            print(f"✅ Found {len(images)} relevant image(s):")
            for img in images:
                filename = img['filename']
                description = img.get('description', 'No description')
                print(f"  - {filename}")
                print(f"    Description: {description}")
        else:
            print("❌ No images detected")
    
    print("\n" + "=" * 80)
    print("Test completed!")

if __name__ == "__main__":
    test_image_detection()