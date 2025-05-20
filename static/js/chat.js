// Initialize variables
console.log("Chat.js loaded");

let conversationHistory = [];
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
let isWaitingForResponse = false;
const userIdentifier = generateUserIdentifier();
let selectedLanguage = ''; // Store the selected language
const languageSelector = document.getElementById('language-selector');

// Speech recognition and synthesis variables
let recognition = null;
let isListening = false;
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let isSpeaking = false;

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
    
    // Initially disable chat form until language is selected
    chatInput.disabled = true;
    sendButton.disabled = true;
    
    // Always show language selector when the page loads
    console.log("Showing language selector");
    languageSelector.style.display = 'block';
    setupLanguageSelection();
});

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
                speakText(text, messageId);
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

// Function to speak text
function speakText(text, messageId) {
    // Cancel any ongoing speech
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        isSpeaking = false;
        updateVoiceButtons(false);
    }
    
    // If we were already speaking this text, just stop and return (toggle behavior)
    if (isSpeaking && currentSpeakingText === text) {
        hideSpeechControls();
        return;
    }
    
    // Create a new utterance
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentSpeakingText = text;
    currentSpeakingMessageId = messageId;
    
    // Set language based on selected language
    switch (selectedLanguage) {
        case 'fr':
            currentUtterance.lang = 'fr-FR';
            break;
        case 'ar':
            currentUtterance.lang = 'ar-SA'; // Primary Arabic code
            break;
        default:
            currentUtterance.lang = 'en-US';
    }
    
    // Get available voices
    const voices = speechSynthesis.getVoices();
    let voiceFound = false;
    
    if (voices.length > 0) {
        // For Arabic, use a more comprehensive approach to find voices
        if (selectedLanguage === 'ar') {
            // Try multiple Arabic codes in order of preference
            const arabicCodes = ['ar-SA', 'ar', 'ar-EG', 'ar-AE', 'ar-KW', 'ar-MA', 'ar-QA', 'ar-IQ'];
            
            // First try exact matches with preferred Arabic dialects
            for (const code of arabicCodes) {
                const exactMatch = voices.find(voice => voice.lang === code);
                if (exactMatch) {
                    currentUtterance.voice = exactMatch;
                    console.log(`Found Arabic voice: ${exactMatch.name} (${exactMatch.lang})`);
                    voiceFound = true;
                    break;
                }
            }
            
            // If no exact match, try partial matches
            if (!voiceFound) {
                for (const code of arabicCodes) {
                    const partialMatches = voices.filter(voice => 
                        voice.lang.startsWith(code.split('-')[0]) ||
                        voice.name.toLowerCase().includes('arab'));
                    
                    if (partialMatches.length > 0) {
                        currentUtterance.voice = partialMatches[0];
                        console.log(`Found partial Arabic voice match: ${partialMatches[0].name}`);
                        voiceFound = true;
                        break;
                    }
                }
            }
            
            // If still no match, use any available voice as fallback
            if (!voiceFound) {
                // If a specific default voice is available, use it
                const defaultVoice = voices.find(voice => voice.default);
                if (defaultVoice) {
                    currentUtterance.voice = defaultVoice;
                    console.log(`Using default voice: ${defaultVoice.name}`);
                    voiceFound = true;
                } else if (voices.length > 0) {
                    // Otherwise use the first available voice
                    currentUtterance.voice = voices[0];
                    console.log(`Using first available voice: ${voices[0].name}`);
                    voiceFound = true;
                }
            }
            
            // For debugging, log all available voices
            console.log("All available voices:");
            voices.forEach(voice => console.log(`- ${voice.name} (${voice.lang})`));
        } else {
            // Normal voice selection for non-Arabic languages
            const langCode = currentUtterance.lang.split('-')[0]; // Get base language code
            
            // Try to find best matching voice
            const matchingVoice = voices.find(voice => voice.lang === currentUtterance.lang) || 
                                voices.find(voice => voice.lang.startsWith(langCode)) ||
                                voices.find(voice => voice.default) ||
                                voices[0];
            
            if (matchingVoice) {
                currentUtterance.voice = matchingVoice;
                console.log(`Using voice: ${matchingVoice.name} (${matchingVoice.lang})`);
                voiceFound = true;
            }
        }
    }
    
    // Set speech rate slightly slower for better comprehension
    currentUtterance.rate = 0.9;
    
    // Add special adjustments for Arabic
    if (selectedLanguage === 'ar') {
        // Slower rate for Arabic as it can be faster than other languages
        currentUtterance.rate = 0.8;
        // Slightly higher pitch can improve clarity for some voices
        currentUtterance.pitch = 1.1;
    }
    
    // Set up events
    currentUtterance.onstart = () => {
        isSpeaking = true;
        updateVoiceButtons(true, messageId);
        showSpeechControls();
    };
    
    currentUtterance.onend = () => {
        isSpeaking = false;
        updateVoiceButtons(false, messageId);
        hideSpeechControls();
    };
    
    currentUtterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        isSpeaking = false;
        updateVoiceButtons(false, messageId);
        hideSpeechControls();
        
        // Alert user about error with Arabic if appropriate
        if (selectedLanguage === 'ar' && !voiceFound) {
            const messageContainer = document.createElement('div');
            messageContainer.className = 'message-container bot';
            messageContainer.style.direction = 'rtl';
            
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.innerHTML = '<i data-feather="cpu"></i>';
            
            const messageText = document.createElement('div');
            messageText.className = 'message-text prose max-w-none';
            messageText.innerHTML = '<p>عذرًا، لا يدعم متصفحك تحويل النص العربي إلى كلام. يرجى تجربة متصفح آخر أو استخدام لغة أخرى للاستماع.</p>';
            
            messageContent.appendChild(avatar);
            messageContent.appendChild(messageText);
            messageContainer.appendChild(messageContent);
            
            chatHistory.appendChild(messageContainer);
            feather.replace();
            forceScrollToBottom();
        }
    };
    
    // Speak the text
    try {
        speechSynthesis.speak(currentUtterance);
        showSpeechControls();
    } catch (error) {
        console.error("Error initiating speech:", error);
    }
}

// Ensure voices are loaded
function ensureVoicesLoaded(callback) {
    let voices = speechSynthesis.getVoices();
    
    if (voices.length > 0) {
        // Voices already loaded
        callback(voices);
        return;
    }
    
    // Wait for voices to be loaded
    speechSynthesis.onvoiceschanged = function() {
        voices = speechSynthesis.getVoices();
        callback(voices);
        // Remove the event listener to prevent multiple calls
        speechSynthesis.onvoiceschanged = null;
    };
    
    // Fallback if onvoiceschanged doesn't fire
    setTimeout(() => {
        voices = speechSynthesis.getVoices();
        if (voices.length > 0 && typeof callback === 'function') {
            callback(voices);
        }
    }, 1000);
}

// Call this during initialization
function initializeTTS() {
    ensureVoicesLoaded(voices => {
        console.log(`Loaded ${voices.length} voices for speech synthesis`);
        // Log available Arabic voices
        const arabicVoices = voices.filter(voice => 
            voice.lang.startsWith('ar') || 
            voice.name.toLowerCase().includes('arab')
        );
        console.log(`Found ${arabicVoices.length} Arabic voices`);
        if (arabicVoices.length > 0) {
            arabicVoices.forEach(voice => console.log(`- ${voice.name} (${voice.lang})`));
        }
    });
}



// Update voice buttons to show active state
function updateVoiceButtons(isActive, messageId) {
    // Hide all stop buttons first
    document.querySelectorAll('.stop-output-button').forEach(btn => {
        btn.classList.add('hidden');
    });
    
    // Remove speaking class from all voice buttons
    document.querySelectorAll('.voice-output-button').forEach(btn => {
        btn.classList.remove('speaking');
    });
    
    // If active, show the specific stop button and highlight the voice button
    if (isActive && messageId) {
        // Find buttons with matching message ID
        const voiceButton = document.querySelector(`.voice-output-button[data-message-id="${messageId}"]`);
        const stopButton = document.querySelector(`.stop-output-button[data-message-id="${messageId}"]`);
        
        if (voiceButton) {
            voiceButton.classList.add('speaking');
        }
        
        if (stopButton) {
            stopButton.classList.remove('hidden');
        }
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
        
        // Add CSS for animations
        addVoiceFeaturesStyles();
    }
}

// Create variables to track speaking state
// let isSpeaking = false;
// let currentUtterance = null;
let currentSpeakingText = '';
let currentSpeakingMessageId = null;

// Function to stop speaking
function stopSpeaking() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        isSpeaking = false;
        updateVoiceButtons(false, currentSpeakingMessageId);
        currentSpeakingMessageId = null;
        currentSpeakingText = '';
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

// Add CSS styles for voice features
function addVoiceFeaturesStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.5;
            }
        }
        
        .animate-pulse {
            animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .voice-output-button {
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            transition: all 0.2s ease;
        }
        
        .voice-output-button:hover {
            background-color: #f0f7ff;
        }
        
        #speech-control-panel {
            z-index: 100;
        }
        
        [dir="rtl"] .voice-output-button {
            margin-left: 0;
            margin-right: 8px;
        }
        
        [dir="rtl"] #mic-button {
            left: auto;
            right: 2px;
        }
        
        [dir="rtl"] #chat-input {
            padding-left: 12px;
            padding-right: 40px;
        }
    `;
    document.head.appendChild(style);
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
        
        // Process images
        processImages(messageText);
        
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

// Main function to display sources
function displaySources(messageElement, sourcesSection) {
    // Create a unique ID for this sources section
    const sourcesId = `sources-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // If no sources section in the text, don't create sources UI
    if (!sourcesSection) {
        // Try to fetch from API only if explicitly mentioned in text
        if (messageElement.textContent.toLowerCase().includes('source') || 
            messageElement.textContent.toLowerCase().includes('référence') || 
            messageElement.textContent.toLowerCase().includes('مصادر')) {
            fetchSourcesFromAPI(messageElement);
        }
        return;
    }
    
    // Create sources button with appropriate language text
    const sourcesButton = document.createElement('button');
    sourcesButton.className = 'sources-button mt-3 text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium';
    
    // Set button text based on language
    let viewButtonText = 'View Sources';
    let hideButtonText = 'Hide Sources';
    let sourcesHeaderText = 'Sources:';
    let noSourcesMessage = 'No downloadable sources available.';
    
    switch (selectedLanguage) {
        case 'fr':
            viewButtonText = 'Voir les sources';
            hideButtonText = 'Masquer les sources';
            sourcesHeaderText = 'Sources:';
            noSourcesMessage = 'Aucune source téléchargeable disponible.';
            break;
        case 'ar':
            viewButtonText = 'عرض المصادر';
            hideButtonText = 'إخفاء المصادر';
            sourcesHeaderText = 'المصادر:';
            noSourcesMessage = 'لا توجد مصادر قابلة للتنزيل متاحة.';
            break;
    }
    
    sourcesButton.innerHTML = `<i data-feather="book-open" class="mr-1"></i> ${viewButtonText}`;
    
    // Create the sources list container (initially hidden)
    const sourcesList = document.createElement('div');
    sourcesList.id = sourcesId;
    sourcesList.className = 'sources-list mt-3';
    sourcesList.style.display = 'none';
    
    // Add click handler to toggle sources visibility
    sourcesButton.addEventListener('click', function() {
        if (sourcesList.style.display === 'none') {
            sourcesList.style.display = 'block';
            this.innerHTML = `<i data-feather="chevron-up" class="mr-1"></i> ${hideButtonText}`;
        } else {
            sourcesList.style.display = 'none';
            this.innerHTML = `<i data-feather="book-open" class="mr-1"></i> ${viewButtonText}`;
        }
        feather.replace();
        forceScrollToBottom();
    });
    
    // Create the sources header
    const sourcesHeader = document.createElement('h4');
    sourcesHeader.textContent = sourcesHeaderText;
    sourcesHeader.className = 'sources-header';
    sourcesList.appendChild(sourcesHeader);
    
    // Add the loading indicator initially
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'text-gray-500 text-sm flex items-center';
    loadingIndicator.innerHTML = '<div class="mr-2"><i data-feather="loader" class="animate-spin"></i></div> Loading sources...';
    sourcesList.appendChild(loadingIndicator);
    
    // Determine source filenames from text if available
    let sourceFilenames = [];
    if (sourcesSection) {
        sourceFilenames = sourcesSection.split(',')
            .map(s => s.trim())
            .filter(s => s)
            .map(s => s.replace(/^['"]|['"]$/g, '')); // Remove quotes if present
    }
    
    // Append elements to the message
    messageElement.appendChild(sourcesButton);
    messageElement.appendChild(sourcesList);
    feather.replace();
    
    // Fetch detailed source information from API
    fetchSourceDetails(sourcesList, loadingIndicator, sourceFilenames, noSourcesMessage, sourcesButton);
}



// Function to fetch source details and enhance with page numbers
async function fetchSourceDetails(sourcesList, loadingIndicator, sourceFilenames, noSourcesMessage, sourcesButton) {
    try {
        // Fetch detailed source information
        const response = await fetch('/get_source_details', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_identifier: userIdentifier
            })
        });
        
        // Remove loading indicator
        if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
        
        if (response.ok) {
            const data = await response.json();
            const sources = data.sources || [];
            
            // Create a map of filename to page numbers
            const sourceMap = {};
            
            sources.forEach(source => {
                const filename = source.filename;
                const page = source.page;
                
                if (!sourceMap[filename]) {
                    sourceMap[filename] = new Set(); // Use Set to avoid duplicates
                }
                
                if (page !== null && page !== undefined) {
                    sourceMap[filename].add(page);
                }
            });
            
            // If no sources from API but we have text sources, use those
            if (Object.keys(sourceMap).length === 0 && sourceFilenames.length > 0) {
                sourceFilenames.forEach(filename => {
                    sourceMap[filename] = new Set();
                });
            }
            
            // Generate HTML for each source
            if (Object.keys(sourceMap).length > 0) {
                Object.entries(sourceMap).forEach(([filename, pageSet]) => {
                    const pages = Array.from(pageSet).filter(p => p !== null && p !== undefined);
                    pages.sort((a, b) => a - b); // Sort page numbers
                    
                    // Create page string with simplified format
                    let pageString = '';
                    if (pages.length > 0) {
                        // Set page text based on language
                        let pageLabel = pages.length > 1 ? 'Pages' : 'Page';
                        
                        switch (selectedLanguage) {
                            case 'fr':
                                pageLabel = pages.length > 1 ? 'Pages' : 'Page';
                                break;
                            case 'ar':
                                pageLabel = pages.length > 1 ? 'الصفحات' : 'الصفحة';
                                break;
                        }
                        
                        pageString = `, ${pageLabel}: ${pages.join(', ')}`;
                    }
                    
                    // Create source item
                    const sourceItem = document.createElement('div');
                    sourceItem.className = 'source-item';
                    sourceItem.innerHTML = `
                        <a href="/download_pdf?filename=${encodeURIComponent(filename)}" 
                           class="source-download-link" target="_blank">
                           <i data-feather="file-text"></i>
                           ${filename}${pageString}
                        </a>
                    `;
                    sourcesList.appendChild(sourceItem);
                });
                
                // Re-initialize feather icons
                feather.replace();
            } else {
                // No sources found - remove sources section entirely
                if (sourcesButton && sourcesButton.parentNode) {
                    sourcesButton.parentNode.removeChild(sourcesButton);
                }
                if (sourcesList && sourcesList.parentNode) {
                    sourcesList.parentNode.removeChild(sourcesList);
                }
            }
        } else {
            // Error fetching sources - remove sources section
            if (sourcesButton && sourcesButton.parentNode) {
                sourcesButton.parentNode.removeChild(sourcesButton);
            }
            if (sourcesList && sourcesList.parentNode) {
                sourcesList.parentNode.removeChild(sourcesList);
            }
        }
    } catch (error) {
        console.error('Error fetching source details:', error);
        
        // Create fallback display using sourceFilenames if available
        if (sourceFilenames && sourceFilenames.length > 0) {
            sourceFilenames.forEach(filename => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'source-item';
                sourceItem.innerHTML = `
                    <a href="/download_pdf?filename=${encodeURIComponent(filename)}" 
                       class="source-download-link" target="_blank">
                       <i data-feather="file-text"></i>
                       ${filename}
                    </a>
                `;
                sourcesList.appendChild(sourceItem);
            });
            
            // Re-initialize feather icons
            feather.replace();
        } else {
            // No sources available - remove sources section
            if (sourcesButton && sourcesButton.parentNode) {
                sourcesButton.parentNode.removeChild(sourcesButton);
            }
            if (sourcesList && sourcesList.parentNode) {
                sourcesList.parentNode.removeChild(sourcesList);
            }
        }
    }
}

// Extract main content and sources section from a message
function processMessageForSources(content) {
    // Initialize variables
    let mainContent = content;
    let sourcesSection = null;
    
    // Comprehensive patterns to extract sources across languages
    const sourcesPatterns = [
        /\n\nSources:\s*(.*?)$/s,
        /\n\nsources:\s*(.*?)$/s,
        /\n\nSOURCES:\s*(.*?)$/s,
        /\n\nSource:\s*(.*?)$/s,
        /\n\nRéférences:\s*(.*?)$/s,  // French
        /\n\nمصادر:\s*(.*?)$/s,       // Arabic
        /Sources:\s*(.*?)$/s,         // Without newlines
        /Références:\s*(.*?)$/s,      // French without newlines
        /مصادر:\s*(.*?)$/s            // Arabic without newlines
    ];
    
    // Try each pattern until we find a match
    for (const pattern of sourcesPatterns) {
        const match = content.match(pattern);
        if (match) {
            mainContent = content.substring(0, match.index).trim();
            sourcesSection = match[1].trim();
            break;
        }
    }
    
    return { mainContent, sourcesSection };
}

// Function to clean already rendered messages (more aggressive approach)
function cleanRenderedMessage(messageElement) {
    // Get the first paragraph if it exists
    const firstParagraph = messageElement.querySelector('p:first-child');
    if (!firstParagraph) return;
    
    const html = firstParagraph.innerHTML;
    
    // Check for common introduction patterns
    const introPatterns = [
        // Check for EndoChat introduction phrases
        /(I'?m|I am|Je suis|أنا)\s+EndoChat/i,
        /EndoChat[^<>]*?(assistant|helper|مساعد)/i,
        /^[^<>]*?(Hello|Hi|Hey|Bonjour|Salut|مرحبا|أهلاً)/i,
        /^[^<>]*?!+\s+/i,  // Lines beginning with exclamation marks
    ];
    
    // If we detect an intro pattern in the first paragraph
    let containsIntro = false;
    for (const pattern of introPatterns) {
        if (pattern.test(html)) {
            containsIntro = true;
            break;
        }
    }
    
    if (containsIntro) {
        console.log("Found introduction pattern in rendered message, attempting to clean");
        
        // Try to extract meaningful content after any introductory phrases
        // Look for the first sentence break after any introductory pattern
        let cleanedHtml = html;
        
        // Look for sentence breaks
        const sentenceBreaks = ['. ', '! ', '? ', '.<', '!<', '?<'];
        let firstSentenceEnd = -1;
        
        for (const breakPattern of sentenceBreaks) {
            const index = html.indexOf(breakPattern);
            if (index !== -1 && (firstSentenceEnd === -1 || index < firstSentenceEnd)) {
                firstSentenceEnd = index + breakPattern.length - 1; // Don't include the space
            }
        }
        
        // If we found a sentence break, remove everything before it
        if (firstSentenceEnd !== -1) {
            cleanedHtml = html.substring(firstSentenceEnd + 1).trim();
            
            // Capitalize the first letter if needed
            if (cleanedHtml.length > 0) {
                cleanedHtml = cleanedHtml.charAt(0).toUpperCase() + cleanedHtml.substring(1);
            }
            
            console.log("Removed introduction from rendered message");
            firstParagraph.innerHTML = cleanedHtml;
        }
    }
}

// Function to remove greeting phrases from messages
function removeGreetings(message) {
    // First check if the message contains common self-identification patterns
    const selfIntroPatterns = [
        // Match any variation of "I'm/I am EndoChat" or similar introductions
        /^.*?(?:I'?m|I am|Je suis|أنا)\s+EndoChat.*?(?:assistant|helper|assistant en|مساعد|مساعدك)[^\n.!?]*[.!?]?\s*/i,
        
        // Match any sentence containing introductory phrases about EndoChat's purpose
        /^.*?EndoChat.*?(?:here to help|to assist you|pour vous aider|هنا لمساعدتك)[^\n.!?]*[.!?]?\s*/i,
        
        // Match Arabic introductions specifically (more complete patterns)
        /^.*?(?:بك|مرحبًا)!?\s+(?:أنا|انا)\s+EndoChat.*?(?:الغدد الصماء|مساعد|مساعدك)[^\n.!?]*[.!?]?\s*/i,
        
        // Match any sentence that mentions helping with medical concepts
        /^.*?(?:help you understand|vous aider à comprendre|مساعدتك على فهم).*?(?:medical|médicaux|الطبية)[^\n.!?]*[.!?]?\s*/i,
        
        // Match "you asked" prefix patterns
        /^You asked,?\s+[""].*?[""][.!?]?\s*/i,
        /^Vous avez demandé,?\s+[""].*?[""][.!?]?\s*/i,
        /^لقد سألت,?\s+[""].*?[""][.!?]?\s*/i,
        /^سألت,?\s+[""].*?[""][.!?]?\s*/i,
    ];
    
    // Define greeting patterns in different languages
    const greetingPatterns = [
        // English greetings
        /^Hello!?\s+/i,
        /^Hi!?\s+/i,
        /^Hey!?\s+/i,
        /^Greetings!?\s+/i,
        /^Good morning!?\s+/i,
        /^Good afternoon!?\s+/i,
        /^Good evening!?\s+/i,
        
        // French greetings
        /^Bonjour!?\s+/i,
        /^Salut!?\s+/i,
        /^Bonsoir!?\s+/i,
        
        // Arabic greetings
        /^مرحبا!?\s+/i,
        /^مرحباً!?\s+/i,
        /^أهلاً!?\s+/i,
        /^صباح الخير!?\s+/i,
        /^مساء الخير!?\s+/i,
        
        // Welcome phrases in different languages
        /^Welcome!?\s+/i,
        /^Bienvenue!?\s+/i,
        /^أهلاً وسهلاً!?\s+/i,
        /^أهلاً بك!?\s+/i,
    ];
    
    // Try to remove self-intro patterns first (these are more specific)
    let modifiedMessage = message;
    for (const pattern of selfIntroPatterns) {
        const before = modifiedMessage;
        modifiedMessage = modifiedMessage.replace(pattern, '');
        // If we made a change, log it for debugging
        if (before !== modifiedMessage) {
            console.log("Removed introduction pattern:", pattern);
        }
    }
    
    // Then try to remove simple greeting patterns
    for (const pattern of greetingPatterns) {
        const before = modifiedMessage;
        modifiedMessage = modifiedMessage.replace(pattern, '');
        // If we made a change, log it for debugging
        if (before !== modifiedMessage) {
            console.log("Removed greeting pattern:", pattern);
        }
    }
    
    // Catch any remaining specific patterns not caught by the generic ones
    modifiedMessage = modifiedMessage.replace(/^!+\s+/i, ''); // Remove leading exclamation marks
    
    // Remove any leading whitespace that might remain
    modifiedMessage = modifiedMessage.trim();
    
    // Capitalize the first letter if needed
    if (modifiedMessage.length > 0) {
        modifiedMessage = modifiedMessage.charAt(0).toUpperCase() + modifiedMessage.slice(1);
    }
    
    // If the message significantly changed, log the before/after
    if (message.length - modifiedMessage.length > 20) {
        console.log("Original message started with:", message.substring(0, 100));
        console.log("Cleaned message starts with:", modifiedMessage.substring(0, 100));
    }
    
    return modifiedMessage;
}

// Process code blocks with syntax highlighting
function processCodeBlocks(messageElement) {
    const codeBlocks = messageElement.querySelectorAll('pre code');
    
    codeBlocks.forEach(block => {
        // Add copy button
        const preElement = block.parentElement;
        const copyButton = document.createElement('button');
        copyButton.className = 'absolute top-2 right-2 p-1 bg-gray-800 rounded text-gray-300 hover:text-white';
        copyButton.innerHTML = '<i data-feather="clipboard"></i>';
        
        // Set copy button text based on language
        switch (selectedLanguage) {
            case 'en':
                copyButton.title = 'Copy code';
                break;
            case 'fr':
                copyButton.title = 'Copier le code';
                break;
            case 'ar':
                copyButton.title = 'نسخ الكود';
                break;
            default:
                copyButton.title = 'Copy code';
        }
        
        copyButton.onclick = function() {
            navigator.clipboard.writeText(block.textContent)
                .then(() => {
                    copyButton.innerHTML = '<i data-feather="check"></i>';
                    feather.replace();
                    setTimeout(() => {
                        copyButton.innerHTML = '<i data-feather="clipboard"></i>';
                        feather.replace();
                    }, 2000);
                })
                .catch(err => console.error('Failed to copy text: ', err));
        };
        
        // Make the pre element position relative for the absolute positioning of the button
        preElement.style.position = 'relative';
        preElement.appendChild(copyButton);
        
        // Add language indicator if available
        const match = block.className.match(/language-([a-z0-9]+)/i);
        if (match) {
            const language = match[1];
            const languageIndicator = document.createElement('div');
            languageIndicator.className = 'absolute top-2 left-2 text-xs font-mono text-gray-400';
            languageIndicator.textContent = language;
            preElement.appendChild(languageIndicator);
        }
    });
}

// Process images in the message
function processImages(messageElement) {
    // Look for image references in the text
    const imageRefs = messageElement.querySelectorAll('.image-reference');
    
    imageRefs.forEach(ref => {
        const imagePath = ref.getAttribute('data-path');
        if (!imagePath) return;
        
        // Create an image viewer
        const imageViewer = document.createElement('div');
        imageViewer.className = 'image-viewer';
        
        // Create the image element
        const imgElement = document.createElement('img');
        imgElement.src = `/static/extracted_images/${encodeURIComponent(imagePath)}`;
        imgElement.alt = ref.getAttribute('data-alt') || 'Medical image';
        imgElement.loading = 'lazy';
        
        // Add click event for enlarged view
        imgElement.addEventListener('click', function() {
            showImageModal(this.src, this.alt);
        });
        
        // Add the image to the viewer
        imageViewer.appendChild(imgElement);
        
        // Add caption if available
        const caption = ref.getAttribute('data-caption');
        if (caption) {
            const captionElement = document.createElement('div');
            captionElement.className = 'caption';
            captionElement.textContent = caption;
            imageViewer.appendChild(captionElement);
        }
        
        // Replace the reference with the image viewer
        ref.parentNode.replaceChild(imageViewer, ref);
    });
    
    // Also check for images described in the text with brackets [Image: description]
    const content = messageElement.innerHTML;
    const imageRegex = /\[Image:\s*([^\]]+)\]/g;
    let match;
    let modifiedContent = content;
    
    while ((match = imageRegex.exec(content)) !== null) {
        const description = match[1].trim();
        const imageHtml = `<div class="image-reference" data-path="${description.toLowerCase().replace(/\s+/g, '_')}.jpg" data-alt="${description}" data-caption="${description}"></div>`;
        modifiedContent = modifiedContent.replace(match[0], imageHtml);
    }
    
    if (modifiedContent !== content) {
        messageElement.innerHTML = modifiedContent;
        // Process the newly added image references
        processImages(messageElement);
    }
}

// Show an enlarged image in a modal
function showImageModal(src, alt) {
    // Create the modal container
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    
    // For Arabic, add RTL direction if needed
    if (selectedLanguage === 'ar') {
        modal.style.direction = 'rtl';
    } else {
        modal.style.direction = 'ltr';
    }
    
    // Create the modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'image-modal-content';
    
    // Create the image
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    
    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.className = 'image-modal-close';
    closeButton.innerHTML = '<i data-feather="x"></i>';
    closeButton.onclick = function() {
        document.body.removeChild(modal);
    };
    
    // Close the modal when clicking outside the image
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Assemble the modal
    modalContent.appendChild(img);
    modalContent.appendChild(closeButton);
    modal.appendChild(modalContent);
    
    // Add to the body
    document.body.appendChild(modal);
    
    // Initialize feather icons
    feather.replace();
}

// Show the typing indicator
function showTypingIndicator() {
    console.log("Showing typing indicator");
    // Disable the input and button while waiting for a response
    isWaitingForResponse = true;
    chatInput.disabled = true;
    sendButton.disabled = true;
    
    // Create the typing indicator
    const typingContainer = document.createElement('div');
    typingContainer.className = 'message-container bot typing-container';
    typingContainer.id = 'typing-indicator';
    
    // For Arabic, add RTL direction if needed
    if (selectedLanguage === 'ar') {
        typingContainer.style.direction = 'rtl';
    } else {
        typingContainer.style.direction = 'ltr';
    }
    
    const typingContent = document.createElement('div');
    typingContent.className = 'message-content';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    
    const avatarIcon = document.createElement('i');
    avatarIcon.setAttribute('data-feather', 'cpu');
    avatar.appendChild(avatarIcon);
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    
    // Add the typing dots
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        typingIndicator.appendChild(dot);
    }
    
    // Assemble the typing indicator
    typingContent.appendChild(avatar);
    typingContent.appendChild(typingIndicator);
    typingContainer.appendChild(typingContent);
    
    // Add the typing indicator to the chat
    chatHistory.appendChild(typingContainer);
    
    // Initialize feather icons
    feather.replace();
    
    // Force scroll to bottom
    forceScrollToBottom();
    
    // Set a timeout to show additional processing information after a delay
    setTimeout(() => {
        if (isWaitingForResponse) {
            const typingContent = document.querySelector('#typing-indicator .typing-indicator');
            if (typingContent) {
                const thinkingMessage = document.createElement('div');
                thinkingMessage.className = 'text-gray-500 ml-3 text-sm';
                
                // Set thinking message based on language
                switch (selectedLanguage) {
                    case 'en':
                        thinkingMessage.textContent = 'I\'m searching my endocrinology knowledge base...';
                        break;
                    case 'fr':
                        thinkingMessage.textContent = 'Je recherche des informations dans ma base de connaissances en endocrinologie...';
                        break;
                    case 'ar':
                        thinkingMessage.textContent = 'أبحث في قاعدة معرفتي في علم الغدد الصماء...';
                        break;
                    default:
                        thinkingMessage.textContent = 'I\'m searching my endocrinology knowledge base...';
                }
                
                typingContent.appendChild(thinkingMessage);
                
                // Force scroll to bottom again after adding the message
                forceScrollToBottom();
            }
        }
    }, 2000);
}

// Hide the typing indicator
function hideTypingIndicator() {
    console.log("Hiding typing indicator");
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
    
    // Re-enable the input and button
    isWaitingForResponse = false;
    chatInput.disabled = false;
    sendButton.disabled = false;
    chatInput.focus();
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
        setTimeout(() => forceScrollToBottom(), 500);
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

// Add a welcome message based on the selected language
function addWelcomeMessage(lang) {
    console.log("Adding welcome message for language:", lang);
    let welcomeMessage = '';
    
    switch (lang) {
        case 'en':
            welcomeMessage = "Welcome to EndoChat! How can I help you with your endocrinology questions today? You can type your question or click the microphone icon to speak.";
            break;
        case 'fr':
            welcomeMessage = "Bienvenue sur EndoChat ! Comment puis-je vous aider avec vos questions d'endocrinologie aujourd'hui ? Vous pouvez taper votre question ou cliquer sur l'icône du microphone pour parler.";
            break;
        case 'ar':
            welcomeMessage = "مرحبًا بك في EndoChat! كيف يمكنني مساعدتك في أسئلتك المتعلقة بالغدد الصماء اليوم؟ يمكنك كتابة سؤالك أو النقر على أيقونة الميكروفون للتحدث.";
            break;
        default:
            welcomeMessage = "Welcome to EndoChat! How can I help you with your endocrinology questions today? You can type your question or click the microphone icon to speak.";
    }
    
    // Add the welcome message to the chat (directly, without going through removeGreetings)
    // Create the message container
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container bot';
    
    // For Arabic, add RTL direction if needed
    if (lang === 'ar') {
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
    
    // Set the avatar icon
    const avatarIcon = document.createElement('i');
    avatarIcon.setAttribute('data-feather', 'cpu');
    avatar.appendChild(avatarIcon);
    
    // Create the message text
    const messageText = document.createElement('div');
    messageText.className = 'message-text prose max-w-none';
    messageText.innerHTML = marked.parse(welcomeMessage);
    
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

// Scroll to the bottom of the chat - regular method
function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Force scroll to bottom with multiple approaches to ensure it works
function forceScrollToBottom() {
    // Approach 1: Direct property setting
    chatHistory.scrollTop = chatHistory.scrollHeight;
    
    // Approach 2: Smooth scrolling API
    chatHistory.scrollTo({
        top: chatHistory.scrollHeight,
        behavior: 'smooth'
    });
    
    // Approach 3: Scroll the last child into view
    if (chatHistory.lastElementChild) {
        chatHistory.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    
    // Approach 4: Delayed scroll as some content might still be rendering
    setTimeout(() => {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }, 100);
}
