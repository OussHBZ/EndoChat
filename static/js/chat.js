// Initialize variables
console.log("Chat.js loaded with image support");

let conversationHistory = [];
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
let isWaitingForResponse = false;
const userIdentifier = generateUserIdentifier();
let selectedLanguage = ''; // Store the selected language
const languageSelector = document.getElementById('language-selector');

// Speech recognition and TTS variables
let recognition = null;
let isListening = false;
let currentAudio = null;
let isSpeaking = false;
let currentSpeakingMessageId = null;
let currentSpeakingText = '';

// Image variables
let currentImages = [];

// Initialize Feather icons
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded");
    feather.replace();
    
    // Apply auto-resize to textarea
    setupTextareaAutoResize();
    
    // Set up the form submission handler
    chatForm.addEventListener('submit', handleFormSubmit);
    console.log("Form submission handler set up");
    
    // Set up the Enter key handler
    chatInput.addEventListener('keydown', handleInputKeydown);
    console.log("Keydown handler set up");
    
    // Initialize voice features
    initializeVoiceFeatures();
    console.log("Voice features initialized");
    
    // Check TTS service status
    checkTTSStatus();
    
    // Initially disable chat form until language is selected
    chatInput.disabled = true;
    sendButton.disabled = true;
    
    // Always show language selector when the page loads
    console.log("Showing language selector");
    languageSelector.style.display = 'block';
    setupLanguageSelection();
});

// Check TTS service status
async function checkTTSStatus() {
    try {
        const response = await fetch('/tts_status');
        const data = await response.json();
        
        if (data.available) {
            console.log(`TTS Service available: ${data.service} with ${data.voices_count} voices`);
        } else {
            console.warn('TTS Service not available:', data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error checking TTS status:', error);
    }
}

// Fetch images for the current user session
async function fetchImages() {
    try {
        const response = await fetch('/get_images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_identifier: userIdentifier
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentImages = data.images || [];
            console.log(`Fetched ${currentImages.length} relevant images`);
            return currentImages;
        } else {
            console.warn('No images found for current session');
            return [];
        }
    } catch (error) {
        console.error('Error fetching images:', error);
        return [];
    }
}

// Display images in the conversation
function displayImages(messageElement) {
    if (!currentImages || currentImages.length === 0) {
        return;
    }
    
    console.log(`Displaying ${currentImages.length} images`);
    
    // Create images container
    const imagesContainer = document.createElement('div');
    imagesContainer.className = 'images-container mt-4 space-y-3';
    
    // Add header
    const imagesHeader = document.createElement('h4');
    imagesHeader.className = 'text-sm font-semibold text-gray-700 mb-2';
    
    switch (selectedLanguage) {
        case 'en':
            imagesHeader.textContent = 'Related Images:';
            break;
        case 'fr':
            imagesHeader.textContent = 'Images associées:';
            break;
        case 'ar':
            imagesHeader.textContent = 'الصور ذات الصلة:';
            break;
        default:
            imagesHeader.textContent = 'Related Images:';
    }
    
    imagesContainer.appendChild(imagesHeader);
    
    // Add each image
    currentImages.forEach((image, index) => {
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'image-wrapper border rounded-lg p-3 bg-gray-50';
        
        // Image element
        const imgElement = document.createElement('img');
        imgElement.src = image.url;
        imgElement.alt = `Medical illustration from ${image.source_pdf}`;
        imgElement.className = 'max-w-full h-auto rounded cursor-pointer hover:shadow-lg transition-shadow';
        imgElement.loading = 'lazy';
        
        // Add click event for modal view
        imgElement.addEventListener('click', function() {
            showImageModal(image);
        });
        
        // Image caption
        const caption = document.createElement('div');
        caption.className = 'mt-2 text-xs text-gray-600';
        caption.innerHTML = `
            <div class="flex items-center justify-between">
                <span><strong>Source:</strong> ${image.source_pdf}</span>
                <span><strong>Page:</strong> ${image.page_number}</span>
            </div>
            <div class="mt-1">
                <span><strong>Size:</strong> ${image.width} × ${image.height}px</span>
            </div>
        `;
        
        imageWrapper.appendChild(imgElement);
        imageWrapper.appendChild(caption);
        imagesContainer.appendChild(imageWrapper);
    });
    
    // Add images container to message
    messageElement.appendChild(imagesContainer);
    
    // Clear current images after displaying
    currentImages = [];
}

// Show image in modal
function showImageModal(image) {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
    modal.id = 'image-modal';
    
    // Modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden';
    
    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75';
    closeButton.innerHTML = '<i data-feather="x" class="w-5 h-5"></i>';
    closeButton.onclick = () => document.body.removeChild(modal);
    
    // Image
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = `Medical illustration from ${image.source_pdf}`;
    img.className = 'max-w-full max-h-screen object-contain';
    
    // Image info
    const imageInfo = document.createElement('div');
    imageInfo.className = 'p-4 bg-gray-50 border-t';
    imageInfo.innerHTML = `
        <h3 class="font-semibold text-lg mb-2">Medical Illustration</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Source:</strong> ${image.source_pdf}</div>
            <div><strong>Page:</strong> ${image.page_number}</div>
            <div><strong>Dimensions:</strong> ${image.width} × ${image.height}px</div>
            <div><strong>Hash:</strong> ${image.hash}</div>
        </div>
    `;
    
    // Assemble modal
    modalContent.appendChild(closeButton);
    modalContent.appendChild(img);
    modalContent.appendChild(imageInfo);
    modal.appendChild(modalContent);
    
    // Add to body
    document.body.appendChild(modal);
    
    // Initialize feather icons
    feather.replace();
    
    // Close on escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Set up language selection buttons
function setupLanguageSelection() {
    console.log("Setting up language selection buttons");
    const languageButtons = document.querySelectorAll('.language-btn');
    console.log("Found", languageButtons.length, "language buttons");
    
    languageButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent any form submission
            console.log("Language button clicked:", this.getAttribute('data-lang'));
            selectedLanguage = this.getAttribute('data-lang');
            
            // Make the selected language available globally
            window.selectedLanguage = selectedLanguage;
            
            // Hide the language selector panel with a smooth transition
            languageSelector.style.opacity = '0';
            setTimeout(() => {
                languageSelector.style.display = 'none';
                languageSelector.style.opacity = '1';
            }, 300);
            
            // Update placeholder text and hints for the selected language
            updatePlaceholderForLanguage(selectedLanguage);
            
            // Enable chat input
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatInput.focus();
            
            // Add a welcome message in the selected language
            addWelcomeMessage(selectedLanguage);
            
            // Update voice recognition language if available
            if (recognition) {
                updateRecognitionLanguage(selectedLanguage);
            }
        });
    });
}

// Initialize voice features
function initializeVoiceFeatures() {
    // Check if browser supports speech recognition
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        console.warn("Speech Recognition API not supported in this browser");
        return;
    }
    
    // Create speech recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    // Create the mic button
    const micButton = document.createElement('button');
    micButton.type = 'button';
    micButton.id = 'mic-button';
    micButton.className = 'absolute left-2 bottom-2 p-2 rounded-lg text-gray-500 hover:text-gray-700';
    micButton.innerHTML = '<i data-feather="mic"></i>';
    micButton.setAttribute('aria-label', 'Voice input');
    
    // Add the mic button to the chat form
    const inputContainer = chatInput.parentElement;
    inputContainer.appendChild(micButton);
    
    // Update the textarea padding to make room for the mic button
    chatInput.style.paddingLeft = '40px';
    
    // Initialize feather icons for the button
    feather.replace();
    
    // Set up speech recognition events
    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');
        
        chatInput.value = transcript;
        
        // Trigger the input event to resize the textarea if needed
        chatInput.dispatchEvent(new Event('input'));
    };
    
    recognition.onend = () => {
        isListening = false;
        micButton.classList.remove('text-blue-600', 'animate-pulse');
        
        // Focus on the input field but don't submit automatically
        chatInput.focus();
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        micButton.classList.remove('text-blue-600', 'animate-pulse');
    };
    
    // Add click handler to the mic button
    micButton.addEventListener('click', toggleSpeechRecognition);
    
    // Create speech control panel
    createSpeechControlPanel();
    
    // Add MutationObserver to add voice output buttons to new messages
    setupVoiceOutputButtons();
}

// Toggle speech recognition on/off
function toggleSpeechRecognition() {
    const micButton = document.getElementById('mic-button');
    
    if (isListening) {
        recognition.stop();
        isListening = false;
        micButton.classList.remove('text-blue-600', 'animate-pulse');
    } else {
        // Check if we have a selected language first
        if (!selectedLanguage) {
            showLanguageSelectionReminder();
            return;
        }
        
        // Clear the input field if it's empty, otherwise keep the content for editing
        if (chatInput.value.trim() === '') {
            chatInput.value = '';
        }
        
        // Update the recognition language
        updateRecognitionLanguage(selectedLanguage);
        
        try {
            recognition.start();
            isListening = true;
            micButton.classList.add('text-blue-600', 'animate-pulse');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
        }
    }
}

// Update the recognition language based on selected language
function updateRecognitionLanguage(lang) {
    if (!recognition) return;
    
    switch (lang) {
        case 'en':
            recognition.lang = 'en-US';
            break;
        case 'fr':
            recognition.lang = 'fr-FR';
            break;
        case 'ar':
            recognition.lang = 'ar-SA';
            break;
        default:
            recognition.lang = 'en-US';
    }
    
    console.log("Recognition language set to:", recognition.lang);
}

// Setup voice output buttons for bot messages
function setupVoiceOutputButtons() {
    // Function to add voice output buttons to bot messages
    const addVoiceOutputButtons = () => {
        // Find all bot messages that don't already have voice buttons
        const botMessages = document.querySelectorAll('.message-container.bot:not(.typing-container)');
        
        botMessages.forEach(message => {
            // Skip if already has voice button
            if (message.querySelector('.voice-output-button')) return;
            
            const messageText = message.querySelector('.message-text');
            if (!messageText) return;
            
            // Create voice button container
            const voiceButtonContainer = document.createElement('div');
            voiceButtonContainer.className = 'voice-button-container ml-2';
            
            // Create voice output button
            const voiceButton = document.createElement('button');
            voiceButton.className = 'voice-output-button p-1 text-gray-500 hover:text-blue-600 transition-colors';
            voiceButton.innerHTML = '<i data-feather="volume-2"></i>';
            
            // Create stop button (initially hidden)
            const stopButton = document.createElement('button');
            stopButton.className = 'stop-output-button p-1 mt-1 text-red-500 hover:text-red-600 transition-colors hidden';
            stopButton.innerHTML = '<i data-feather="stop-circle"></i>';
            
            // Set button titles based on language
            switch (selectedLanguage) {
                case 'en':
                    voiceButton.title = 'Listen to this response';
                    stopButton.title = 'Stop speaking';
                    break;
                case 'fr':
                    voiceButton.title = 'Écouter cette réponse';
                    stopButton.title = 'Arrêter de parler';
                    break;
                case 'ar':
                    voiceButton.title = 'استمع إلى هذه الإجابة';
                    stopButton.title = 'توقف عن التحدث';
                    break;
                default:
                    voiceButton.title = 'Listen to this response';
                    stopButton.title = 'Stop speaking';
            }
            
            // Get text content without the Sources section
            let textToSpeak = messageText.textContent;
            if (textToSpeak.includes('Sources:')) {
                textToSpeak = textToSpeak.split('Sources:')[0].trim();
            }
            
            // Store the text to speak as a data attribute
            voiceButton.setAttribute('data-text', textToSpeak);
            stopButton.setAttribute('data-text', textToSpeak);
            
            // Store a reference to this message
            voiceButton.setAttribute('data-message-id', `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);
            stopButton.setAttribute('data-message-id', voiceButton.getAttribute('data-message-id'));
            
            // Add click events
            voiceButton.addEventListener('click', function() {
                const text = this.getAttribute('data-text');
                const messageId = this.getAttribute('data-message-id');
                speakTextWithPolly(text, messageId);
            });
            
            stopButton.addEventListener('click', function() {
                stopSpeaking();
            });
            
            // Add buttons to container
            voiceButtonContainer.appendChild(voiceButton);
            voiceButtonContainer.appendChild(stopButton);
            
            // Insert the container after the avatar
            const messageContent = message.querySelector('.message-content');
            if (messageContent) {
                const avatar = messageContent.querySelector('.avatar');
                if (avatar) {
                    avatar.insertAdjacentElement('afterend', voiceButtonContainer);
                    // Initialize feather icons
                    feather.replace();
                }
            }
        });
    };
    
    // Initial run
    addVoiceOutputButtons();
    
    // Set up a MutationObserver to detect new messages
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                addVoiceOutputButtons();
            }
        });
    });
    
    // Start observing the chat history
    observer.observe(chatHistory, { childList: true, subtree: true });
}

// Function to speak text using Amazon Polly
async function speakTextWithPolly(text, messageId) {
    // Stop any current audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        isSpeaking = false;
        updateVoiceButtons(false);
    }
    
    // If we were already speaking this text, just stop and return (toggle behavior)
    if (isSpeaking && currentSpeakingText === text) {
        hideSpeechControls();
        return;
    }
    
    try {
        // Show loading state
        updateVoiceButtons(true, messageId, true);
        
        // Request TTS from backend
        const response = await fetch('/synthesize_speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                language: selectedLanguage
            })
        });
        
        if (!response.ok) {
            throw new Error(`TTS request failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.audio_url) {
            // Create audio element and play
            currentAudio = new Audio(data.audio_url);
            currentSpeakingText = text;
            currentSpeakingMessageId = messageId;
            
            // Set up audio events
            currentAudio.onloadstart = () => {
                isSpeaking = true;
                updateVoiceButtons(true, messageId, false);
                showSpeechControls();
            };
            
            currentAudio.onended = () => {
                isSpeaking = false;
                updateVoiceButtons(false, messageId);
                hideSpeechControls();
                currentAudio = null;
                currentSpeakingText = '';
                currentSpeakingMessageId = null;
            };
            
            currentAudio.onerror = (error) => {
                console.error('Audio playback error:', error);
                isSpeaking = false;
                updateVoiceButtons(false, messageId);
                hideSpeechControls();
                showTTSError();
            };
            
            // Start playback
            await currentAudio.play();
            
        } else {
            throw new Error(data.error || 'Unknown TTS error');
        }
        
    } catch (error) {
        console.error('Error in TTS:', error);
        isSpeaking = false;
        updateVoiceButtons(false, messageId);
        hideSpeechControls();
        showTTSError();
    }
}

// Show TTS error message
function showTTSError() {
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container bot';
    
    // For Arabic, add RTL direction if needed
    if (selectedLanguage === 'ar') {
        messageContainer.style.direction = 'rtl';
    } else {
        messageContainer.style.direction = 'ltr';
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = '<i data-feather="cpu"></i>';
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text prose max-w-none';
    
    let errorMessage = '';
    switch (selectedLanguage) {
        case 'en':
            errorMessage = '<p>Sorry, text-to-speech is currently unavailable. Please check your connection and try again.</p>';
            break;
        case 'fr':
            errorMessage = '<p>Désolé, la synthèse vocale est actuellement indisponible. Veuillez vérifier votre connexion et réessayer.</p>';
            break;
        case 'ar':
            errorMessage = '<p>عذرًا، تحويل النص إلى كلام غير متاح حاليًا. يرجى التحقق من اتصالك والمحاولة مرة أخرى.</p>';
            break;
        default:
            errorMessage = '<p>Sorry, text-to-speech is currently unavailable. Please check your connection and try again.</p>';
    }
    
    messageText.innerHTML = errorMessage;
    
    messageContent.appendChild(avatar);
    messageContent.appendChild(messageText);
    messageContainer.appendChild(messageContent);
    
    chatHistory.appendChild(messageContainer);
    feather.replace();
    forceScrollToBottom();
}

// Update voice buttons to show active state
function updateVoiceButtons(isActive, messageId, isLoading = false) {
    // Hide all stop buttons first
    document.querySelectorAll('.stop-output-button').forEach(btn => {
        btn.classList.add('hidden');
    });
    
    // Remove speaking class from all voice buttons
    document.querySelectorAll('.voice-output-button').forEach(btn => {
        btn.classList.remove('speaking', 'loading');
    });
    
    // If active, show the specific stop button and highlight the voice button
    if (isActive && messageId) {
        // Find buttons with matching message ID
        const voiceButton = document.querySelector(`.voice-output-button[data-message-id="${messageId}"]`);
        const stopButton = document.querySelector(`.stop-output-button[data-message-id="${messageId}"]`);
        
        if (voiceButton) {
            if (isLoading) {
                voiceButton.classList.add('loading');
                voiceButton.innerHTML = '<i data-feather="loader" class="animate-spin"></i>';
            } else {
                voiceButton.classList.add('speaking');
                voiceButton.innerHTML = '<i data-feather="volume-2"></i>';
            }
            feather.replace();
        }
        
        if (stopButton && !isLoading) {
            stopButton.classList.remove('hidden');
        }
    } else {
        // Reset all voice buttons to default state
        document.querySelectorAll('.voice-output-button').forEach(btn => {
            btn.innerHTML = '<i data-feather="volume-2"></i>';
        });
        feather.replace();
    }
}

// Create speech control panel
function createSpeechControlPanel() {
    // Create the panel if it doesn't exist
    if (!document.getElementById('speech-control-panel')) {
        const controlPanel = document.createElement('div');
        controlPanel.id = 'speech-control-panel';
        controlPanel.className = 'fixed bottom-20 right-4 p-2 bg-white rounded-lg shadow-md flex items-center space-x-2 opacity-0 pointer-events-none transition-opacity duration-300 z-50';
        
        // Create stop button
        const stopButton = document.createElement('button');
        stopButton.className = 'p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200';
        stopButton.innerHTML = '<i data-feather="stop-circle"></i>';
        stopButton.addEventListener('click', stopSpeaking);
        
        // Set stop button title based on language
        switch (selectedLanguage) {
            case 'en':
                stopButton.title = 'Stop speaking';
                break;
            case 'fr':
                stopButton.title = 'Arrêter de parler';
                break;
            case 'ar':
                stopButton.title = 'توقف عن التحدث';
                break;
            default:
                stopButton.title = 'Stop speaking';
        }
        
        // Add to control panel
        controlPanel.appendChild(stopButton);
        
        // Add to body
        document.body.appendChild(controlPanel);
        
        // Initialize feather icons
        feather.replace();
    }
}

// Function to stop speaking
function stopSpeaking() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        isSpeaking = false;
        updateVoiceButtons(false, currentSpeakingMessageId);
        currentSpeakingMessageId = null;
        currentSpeakingText = '';
        hideSpeechControls();
    }
}

// Show speech controls
function showSpeechControls() {
    const controlPanel = document.getElementById('speech-control-panel');
    if (controlPanel) {
        controlPanel.classList.remove('opacity-0', 'pointer-events-none');
        controlPanel.classList.add('opacity-100');
    }
}

// Hide speech controls
function hideSpeechControls() {
    const controlPanel = document.getElementById('speech-control-panel');
    if (controlPanel) {
        controlPanel.classList.remove('opacity-100');
        controlPanel.classList.add('opacity-0', 'pointer-events-none');
    }
}

// Update placeholder text and hints based on language
function updatePlaceholderForLanguage(lang) {
    console.log("Updating placeholders for language:", lang);
    const enterHint = document.getElementById('enter-hint');
    const micButton = document.getElementById('mic-button');
    
    switch (lang) {
        case 'en':
            chatInput.placeholder = 'Ask your question or click the microphone...';
            enterHint.textContent = 'Press Enter to send, Shift+Enter for a new line';
            if (micButton) micButton.title = 'Click to speak';
            break;
        case 'fr':
            chatInput.placeholder = 'Posez votre question ou cliquez sur le microphone...';
            enterHint.textContent = 'Appuyez sur Entrée pour envoyer, Maj+Entrée pour un saut de ligne';
            if (micButton) micButton.title = 'Cliquez pour parler';
            break;
        case 'ar':
            chatInput.placeholder = 'اطرح سؤالك أو انقر على الميكروفون...';
            enterHint.textContent = 'اضغط على Enter للإرسال، Shift+Enter لسطر جديد';
            if (micButton) micButton.title = 'انقر للتحدث';
            chatInput.style.direction = 'rtl';
            document.body.style.direction = 'rtl';
            break;
        default:
            chatInput.placeholder = 'Ask your question or click the microphone...';
            enterHint.textContent = 'Press Enter to send, Shift+Enter for a new line';
            if (micButton) micButton.title = 'Click to speak';
            chatInput.style.direction = 'ltr';
            document.body.style.direction = 'ltr';
    }
}

// Generate a persistent user identifier
function generateUserIdentifier() {
    // Always generate a new identifier
    const identifier = 'user_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    console.log("User identifier:", identifier);
    return identifier;
}

// Set up textarea auto-resize functionality
function setupTextareaAutoResize() {
    chatInput.setAttribute('style', 'height: auto;');
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    console.log("Textarea auto-resize set up");
}

// Handle form submission
function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Form submission triggered");
    
    // Check if language is selected
    if (!selectedLanguage) {
        console.log("No language selected, cannot send message");
        showLanguageSelectionReminder();
        return;
    }
    
    // Get the user's message
    const userMessage = chatInput.value.trim();
    console.log("User message:", userMessage);
    
    // Do nothing if the input is empty or we're waiting for a response
    if (userMessage === '' || isWaitingForResponse) {
        console.log("Not sending: empty message or waiting for response");
        return;
    }
    
    // Add the user's message to the chat
    addMessageToChat('user', userMessage);
    
    // Clear the input field and reset its height
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Show typing indicator
    showTypingIndicator();
    
    // Send the message to the server
    console.log("About to send message to server");
    sendMessageToServer(userMessage);
}

// Display a reminder to select language
function showLanguageSelectionReminder() {
    const reminder = document.createElement('div');
    reminder.className = 'language-selection-reminder';
    reminder.textContent = 'Please select a language before sending a message.';
    chatHistory.appendChild(reminder);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (reminder.parentNode) {
            reminder.parentNode.removeChild(reminder);
        }
    }, 5000);
}

// Handle keydown events in the input field
function handleInputKeydown(event) {
    // Submit on Enter (but not if Shift is pressed)
    if (event.key === 'Enter' && !event.shiftKey) {
        console.log("Enter key pressed, triggering form submission");
        event.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
}

// Add a message to the chat history
function addMessageToChat(role, content) {
    // For bot messages, remove greeting prefixes
    if (role === 'bot') {
        content = removeGreetings(content);
    }
    
    // Create the message container
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${role}`;
    
    // For Arabic, add RTL direction if needed
    if (selectedLanguage === 'ar') {
        messageContainer.style.direction = 'rtl';
    } else {
        messageContainer.style.direction = 'ltr';
    }
    
    // Create the message content container
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Create the avatar
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    
    // Set the avatar icon based on the role
    const avatarIcon = document.createElement('i');
    avatarIcon.setAttribute('data-feather', role === 'user' ? 'user' : 'cpu');
    avatar.appendChild(avatarIcon);
    
    // Create the message text
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    
    // Format the message content based on role
    if (role === 'user') {
        messageText.textContent = content;
    } else {
        messageText.className += ' prose max-w-none';
        
        // Process message to extract sources
        const { mainContent, sourcesSection } = processMessageForSources(content);
        
        // Convert markdown to HTML for the main content
        messageText.innerHTML = marked.parse(mainContent);
        
        // Apply post-rendering clean-up to remove any remaining intro phrases
        cleanRenderedMessage(messageText);
        
        // Process code blocks with syntax highlighting
        processCodeBlocks(messageText);
        
        // Fetch and display images for bot messages
        if (role === 'bot') {
            fetchImages().then(() => {
                displayImages(messageText);
            });
        }
        
        // Add sources (unified approach)
        displaySources(messageText, sourcesSection);
    }
    
    // Assemble the message
    messageContent.appendChild(avatar);
    messageContent.appendChild(messageText);
    messageContainer.appendChild(messageContent);
    
    // Add the message to the chat history
    chatHistory.appendChild(messageContainer);
    
    // Initialize feather icons for the new message
    feather.replace();
    
    // Force scroll to bottom
    forceScrollToBottom();
}

// Rest of the functions remain the same as in the original chat.js...
// [Include all other functions like displaySources, processMessageForSources, etc.]

// Send a message to the server
function sendMessageToServer(message) {
    console.log("Sending message to server:", message);
    console.log("Using language:", selectedLanguage);
    console.log("Conversation history:", conversationHistory);
    
    fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            msg: message,
            user_identifier: userIdentifier,
            conversation_history: conversationHistory,
            language: selectedLanguage // Send the selected language to the server
        })
    })
    .then(response => {
        console.log("Response status:", response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Response received:", data);
        // Hide the typing indicator
        hideTypingIndicator();
        
        // Update the conversation history
        conversationHistory = data.conversation_history;
        
        // Log the response content to help debug sources issues
        console.log("Response content:", data.response);
        if (data.response.includes("Sources:")) {
            console.log("Response contains sources section");
        } else {
            console.log("Response does NOT contain sources section");
        }
        
        // Add the response to the chat
        addMessageToChat('bot', data.response);
        
        // Extra call to ensure scroll - after all content and images might have loaded
        setTimeout(() => forceScrollToBottom(), 1000);
    })
    .catch(error => {
        console.error('Error:', error);
        
        // Hide the typing indicator
        hideTypingIndicator();
        
        // Add an error message to the chat in the appropriate language
        let errorMessage = '';
        switch (selectedLanguage) {
            case 'en':
                errorMessage = `Sorry, I couldn't process your request. Please try again or check your connection.`;
                break;
            case 'fr':
                errorMessage = `Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer ou vérifier votre connexion.`;
                break;
            case 'ar':
                errorMessage = `عذرًا، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى أو التحقق من اتصالك.`;
                break;
            default:
                errorMessage = `Sorry, I couldn't process your request. Please try again or check your connection.`;
        }
        
        addMessageToChat('bot', errorMessage);
    });
}

// Add placeholder functions for the remaining functionality
// (These should be the same as in your original chat.js)
function removeGreetings(message) { /* existing function */ return message; }
function processMessageForSources(content) { /* existing function */ return {mainContent: content, sourcesSection: null}; }
function cleanRenderedMessage(messageElement) { /* existing function */ }
function processCodeBlocks(messageElement) { /* existing function */ }
function displaySources(messageText, sourcesSection) { /* existing function */ }
function showTypingIndicator() { /* existing function */ }
function hideTypingIndicator() { /* existing function */ }
function addWelcomeMessage(selectedLanguage) { /* existing function */ }
function forceScrollToBottom() { /* existing function */ }