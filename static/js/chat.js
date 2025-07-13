// Initialize variables
console.log("DiabèteChat.js loaded with improved image support");

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

// Add welcome message based on selected language
function addWelcomeMessage(language) {
    let welcomeMessage = '';
    
    switch (language) {
        case 'en':
            welcomeMessage = "Welcome to DiabèteChat! I'm here to help you with questions about type 1 diabetes, insulin therapy, blood sugar management, and related topics. How can I assist you today?";
            break;
        case 'fr':
            welcomeMessage = "Bienvenue sur DiabèteChat ! Je suis là pour vous aider avec vos questions sur le diabète de type 1, l'insulinothérapie, la gestion de la glycémie et les sujets connexes. Comment puis-je vous aider aujourd'hui ?";
            break;
        case 'ar':
            welcomeMessage = "مرحبا بك في DiabèteChat! أنا هنا لمساعدتك في الأسئلة المتعلقة بالسكري من النوع الأول وعلاج الأنسولين وإدارة سكر الدم والمواضيع ذات الصلة. كيف يمكنني مساعدتك اليوم؟";
            break;
        default:
            welcomeMessage = "Welcome to DiabèteChat! I'm here to help you with questions about type 1 diabetes, insulin therapy, blood sugar management, and related topics. How can I assist you today?";
    }
    
    addMessageToChat('bot', welcomeMessage);
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

// Display images in the conversation (only when received from server)
function displayImages(messageElement, images) {
    if (!images || images.length === 0) {
        return;
    }
    
    console.log(`Displaying ${images.length} relevant images`);
    
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
    images.forEach((image, index) => {
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

// Add a message to the chat history
function addMessageToChat(role, content, images = null) {
    // For bot messages, clean but keep very simple
    if (role === 'bot') {
        content = removeGreetings(content);
        content = cleanAndFormatResponse(content);
    }
    
    // Create the message container
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${role}`;
    
    // Set direction for Arabic
    if (selectedLanguage === 'ar') {
        messageContainer.style.direction = 'rtl';
    } else {
        messageContainer.style.direction = 'ltr';
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    
    const avatarIcon = document.createElement('i');
    avatarIcon.setAttribute('data-feather', role === 'user' ? 'user' : 'cpu');
    avatar.appendChild(avatarIcon);
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    
    if (role === 'user') {
        messageText.textContent = content;
    } else {
        messageText.className += ' prose max-w-none simple-response'; // Add simple-response class
        
        // Process message to extract sources
        const { mainContent, sourcesSection } = processMessageForSources(content);
        
        // For patient responses, use simple text formatting instead of markdown
        messageText.innerHTML = formatSimpleResponse(mainContent);
        
        // Display images if provided
        if (images && images.length > 0) {
            displayImages(messageText, images);
        }
        
        // Add sources - this is crucial for showing sources
        displaySources(messageText, sourcesSection);
    }
    
    messageContent.appendChild(avatar);
    messageContent.appendChild(messageText);
    messageContainer.appendChild(messageContent);
    
    chatHistory.appendChild(messageContainer);
    feather.replace();
    forceScrollToBottom();
}

function formatSimpleResponse(content) {
    // Keep it very simple - just wrap in paragraphs
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 1) {
        // Single paragraph - just return as text
        return `<p>${paragraphs[0].trim()}</p>`;
    } else {
        // Multiple paragraphs
        return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
    }
}

function processPatientFriendlyFormatting(messageElement) {
    // Remove any large headers that might have been created
    const headers = messageElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headers.forEach(header => {
        // Convert headers to simple bold text
        const boldText = document.createElement('strong');
        boldText.textContent = header.textContent;
        header.parentNode.replaceChild(boldText, header);
    });
    
    // Style lists to be more gentle
    const lists = messageElement.querySelectorAll('ul, ol');
    lists.forEach(list => {
        list.style.marginTop = '0.5rem';
        list.style.marginBottom = '0.5rem';
        list.style.paddingLeft = '1rem';
    });
    
    // Make paragraphs more readable with better spacing
    const paragraphs = messageElement.querySelectorAll('p');
    paragraphs.forEach(p => {
        p.style.marginBottom = '0.75rem';
        p.style.lineHeight = '1.6';
    });
}

// Clean and format the response content
function cleanAndFormatResponse(content) {
    // Remove any headers completely
    content = content.replace(/#{1,6}\s+/g, '');
    
    // Remove asterisks and bullet formatting - keep plain text
    content = content.replace(/\*\s+/g, '');
    content = content.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove bold formatting
    content = content.replace(/\*([^*]+)\*/g, '$1'); // Remove italic formatting
    
    // Remove numbered lists formatting
    content = content.replace(/\d+\.\s+/g, '');
    
    // Clean up extra line breaks but keep paragraph structure
    content = content.replace(/\n{3,}/g, '\n\n');
    content = content.replace(/\n\n/g, ' '); // Convert to single paragraphs
    
    // Clean up any remaining formatting
    content = content.trim();
    
    return content;
}

// Remove greeting phrases from bot responses
function removeGreetings(message) {
    // Common greeting patterns to remove (in multiple languages)
    const greetingPatterns = [
        /^(Bonjour\s*!\s*|Hello\s*!\s*|Hi\s*!\s*|مرحبا\s*!\s*)/i,
        /^(Comment puis-je vous aider aujourd'hui|How can I help you today|كيف يمكنني مساعدتك اليوم)/i,
        /^(Je vois que vous avez|I see that you have|أرى أن لديك)/i,
        /^(Pour commencer|To start|للبدء)/i,
        /^(N'hésitez pas|Don't hesitate|لا تتردد)/i
    ];
    
    let cleanedMessage = message;
    
    // Remove greeting patterns
    greetingPatterns.forEach(pattern => {
        cleanedMessage = cleanedMessage.replace(pattern, '').trim();
    });
    
    // Remove multiple spaces and empty lines
    cleanedMessage = cleanedMessage.replace(/\s+/g, ' ').trim();
    
    return cleanedMessage;
}

// Process message content to extract sources
function processMessageForSources(content) {
    // Remove any sources section from the content
    const sourcesMarkers = [
        'Sources:', 'sources:', 'SOURCES:', 'Sources :', 
        'Références:', 'références:', 'RÉFÉRENCES:',
        'مصادر:', 'المصادر:'
    ];
    
    let mainContent = content;
    
    // Remove sources section completely
    for (const marker of sourcesMarkers) {
        const markerIndex = content.indexOf(marker);
        if (markerIndex !== -1) {
            mainContent = content.substring(0, markerIndex).trim();
            break;
        }
    }
    
    return { mainContent, sourcesSection: null };
}

// Clean rendered message to remove any remaining system information
function cleanRenderedMessage(messageElement) {
    // Remove any remaining system prompts or internal information
    const systemPatterns = [
        'Je vois que vous avez à disposition des documents',
        'I see that you have documents available',
        'أرى أن لديك وثائق متاحة',
        'Ces documents décrivent',
        'These documents describe',
        'هذه الوثائق تصف',
        'Il y a des informations sur',
        'There is information about',
        'هناك معلومات حول',
        'Il y a également des schémas',
        'There are also diagrams',
        'هناك أيضا مخططات'
    ];
    
    let textContent = messageElement.innerHTML;
    
    systemPatterns.forEach(pattern => {
        const regex = new RegExp(pattern + '[^.]*\\.', 'gi');
        textContent = textContent.replace(regex, '');
    });
    
    messageElement.innerHTML = textContent;
}

// Process code blocks with syntax highlighting
function processCodeBlocks(messageElement) {
    const codeBlocks = messageElement.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
        // Add basic syntax highlighting classes if needed
        if (!block.className.includes('hljs')) {
            block.className += ' hljs';
        }
    });
}

// Display sources at the end of bot messages with a collapsible button
function displaySources(messageText, sourcesSection) {
    // console.log('displaySources called with:', sourcesSection); // Debug log
    
    // // Check if sourcesSection exists or if the message content contains sources
    // const messageContent = messageText.textContent || messageText.innerHTML;
    
    // // Look for sources in the message content if sourcesSection is empty
    // let sourcesToDisplay = sourcesSection;
    // if (!sourcesToDisplay && messageContent.includes('Sources:')) {
    //     const sourcesMatch = messageContent.match(/Sources:\s*(.+?)(?:\n|$)/i);
    //     if (sourcesMatch) {
    //         sourcesToDisplay = sourcesMatch[1];
    //         console.log('Extracted sources from content:', sourcesToDisplay); // Debug log
    //     }
    // }
    
    // if (!sourcesToDisplay || sourcesToDisplay.trim().length === 0) {
    //     console.log('No sources to display'); // Debug log
    //     return;
    // }
    
    // // Remove the sources text from the main message content if it exists
    // if (messageContent.includes('Sources:')) {
    //     const cleanedContent = messageContent.replace(/\n*Sources:\s*[^\n]*$/i, '');
    //     messageText.innerHTML = formatSimpleResponse(cleanedContent);
    // }
    
    // // Parse sources to count them
    // const sourceEntries = sourcesToDisplay.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    // if (sourceEntries.length === 0) {
    //     console.log('No valid source entries found'); // Debug log
    //     return;
    // }
    
    // console.log('Creating sources display for:', sourceEntries); // Debug log
    
    // // Create sources container
    // const sourcesContainer = document.createElement('div');
    // sourcesContainer.className = 'sources-container mt-4 pt-3 border-t border-gray-200';
    
    // // Create sources button
    // const sourcesButton = document.createElement('button');
    // sourcesButton.className = 'sources-button inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors duration-200';
    
    // const sourceText = sourceEntries.length === 1 ? 'source' : 'sources';
    // let buttonText = `View ${sourceEntries.length} ${sourceText}`;
    
    // // Translate button text based on language
    // if (selectedLanguage === 'fr') {
    //     const sourceTxt = sourceEntries.length === 1 ? 'source' : 'sources';
    //     buttonText = `Voir ${sourceEntries.length} ${sourceTxt}`;
    // } else if (selectedLanguage === 'ar') {
    //     buttonText = `عرض ${sourceEntries.length} مصدر`;
    // }
    
    // sourcesButton.innerHTML = `
    //     <i data-feather="file-text" class="mr-2 w-4 h-4"></i>
    //     <span>${buttonText}</span>
    //     <i data-feather="chevron-down" class="ml-2 w-4 h-4 transition-transform duration-200" id="sources-chevron-${Date.now()}"></i>
    // `;
    
    // // Create sources list (initially hidden)
    // const sourcesList = document.createElement('div');
    // sourcesList.className = 'sources-list mt-3 hidden';
    // sourcesList.id = `sources-list-${Date.now()}`;
    
    // // Add sources header
    // const sourcesHeader = document.createElement('div');
    // sourcesHeader.className = 'sources-header text-sm font-semibold text-gray-700 mb-2';
    
    // switch (selectedLanguage) {
    //     case 'en':
    //         sourcesHeader.textContent = 'References:';
    //         break;
    //     case 'fr':
    //         sourcesHeader.textContent = 'Références:';
    //         break;
    //     case 'ar':
    //         sourcesHeader.textContent = 'المراجع:';
    //         break;
    //     default:
    //         sourcesHeader.textContent = 'References:';
    // }
    
    // sourcesList.appendChild(sourcesHeader);
    
    // // Add individual sources with page numbers
    // sourceEntries.forEach(sourceEntry => {
    //     const sourceItem = document.createElement('div');
    //     sourceItem.className = 'source-item mb-2 p-2 bg-gray-50 rounded border-l-4 border-blue-300';
        
    //     // Extract filename and page number if present
    //     let filename = sourceEntry;
    //     let pageDisplay = '';
        
    //     // Check if source has page number in format "filename.pdf (page X)"
    //     const pageMatch = sourceEntry.match(/^(.+?)\s*\(page\s+(\d+)\)$/i);
    //     if (pageMatch) {
    //         filename = pageMatch[1].trim();
    //         pageDisplay = ` - Page ${pageMatch[2]}`;
    //     }
        
    //     const sourceLink = document.createElement('a');
    //     sourceLink.href = `/download_pdf?filename=${encodeURIComponent(filename)}`;
    //     sourceLink.className = 'source-download-link inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline';
    //     sourceLink.target = '_blank';
        
    //     sourceLink.innerHTML = `
    //         <i data-feather="download" class="mr-2 text-blue-500 w-4 h-4"></i>
    //         ${filename}${pageDisplay}
    //     `;
        
    //     sourceItem.appendChild(sourceLink);
    //     sourcesList.appendChild(sourceItem);
    // });
    
    // // Add click event to toggle sources
    // sourcesButton.addEventListener('click', function() {
    //     const chevron = this.querySelector('[data-feather="chevron-down"]');
        
    //     if (sourcesList.classList.contains('hidden')) {
    //         // Show sources
    //         sourcesList.classList.remove('hidden');
    //         sourcesList.classList.add('block');
    //         chevron.style.transform = 'rotate(180deg)';
            
    //         // Update button text
    //         const span = this.querySelector('span');
    //         if (selectedLanguage === 'fr') {
    //             const sourceTxt = sourceEntries.length === 1 ? 'source' : 'sources';
    //             span.textContent = `Masquer ${sourceEntries.length} ${sourceTxt}`;
    //         } else if (selectedLanguage === 'ar') {
    //             span.textContent = `إخفاء ${sourceEntries.length} مصدر`;
    //         } else {
    //             span.textContent = `Hide ${sourceEntries.length} ${sourceText}`;
    //         }
    //     } else {
    //         // Hide sources
    //         sourcesList.classList.add('hidden');
    //         sourcesList.classList.remove('block');
    //         chevron.style.transform = 'rotate(0deg)';
            
    //         // Update button text
    //         const span = this.querySelector('span');
    //         if (selectedLanguage === 'fr') {
    //             const sourceTxt = sourceEntries.length === 1 ? 'source' : 'sources';
    //             span.textContent = `Voir ${sourceEntries.length} ${sourceTxt}`;
    //         } else if (selectedLanguage === 'ar') {
    //             span.textContent = `عرض ${sourceEntries.length} مصدر`;
    //         } else {
    //             span.textContent = `View ${sourceEntries.length} ${sourceText}`;
    //         }
    //     }
    // });
    
    // // Assemble sources container
    // sourcesContainer.appendChild(sourcesButton);
    // sourcesContainer.appendChild(sourcesList);
    
    // // Add sources to message
    // messageText.appendChild(sourcesContainer);
    
    // // Initialize feather icons
    // feather.replace();
    
    // console.log('Sources display created successfully'); // Debug log
    return; 
}

// Show typing indicator
function showTypingIndicator() {
    isWaitingForResponse = true;
    sendButton.disabled = true;
    
    const typingContainer = document.createElement('div');
    typingContainer.className = 'message-container bot typing-container';
    typingContainer.id = 'typing-indicator';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.innerHTML = '<i data-feather="cpu"></i>';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    
    messageContent.appendChild(avatar);
    messageContent.appendChild(typingIndicator);
    typingContainer.appendChild(messageContent);
    
    chatHistory.appendChild(typingContainer);
    feather.replace();
    forceScrollToBottom();
}

// Hide typing indicator
function hideTypingIndicator() {
    isWaitingForResponse = false;
    sendButton.disabled = false;
    
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

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
            language: selectedLanguage
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
        
        // Add the response to the chat with images if provided
        addMessageToChat('bot', data.response, data.images || null);
        
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

// Force scroll to bottom
function forceScrollToBottom() {
    const chatContainer = document.getElementById('chat-container');
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}