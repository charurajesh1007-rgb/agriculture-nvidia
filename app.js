document.addEventListener('DOMContentLoaded', () => {
    // Pre-load voices to ensure remote voices (like Google Telugu, Tamil, etc.) are available
    let synthVoices = [];
    if (window.speechSynthesis) {
        const loadVoices = () => { synthVoices = window.speechSynthesis.getVoices(); };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('dropzone');
    const imagePreview = document.getElementById('image-preview');
    const symptomsInput = document.getElementById('symptoms-input');
    const runBtn = document.getElementById('run-btn');
    const btnText = document.getElementById('btn-text');
    const btnDot = document.getElementById('btn-dot');
    const diagnosisResult = document.getElementById('diagnosis-result');

    const languageSelect = document.getElementById('language-select');

    // Voice Input (Speech-to-Text)
    const micIcon = document.querySelector('.fa-microphone');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && micIcon) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        let isRecording = false;

        micIcon.style.cursor = 'pointer';
        
        micIcon.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                const selectedLangCode = languageSelect ? languageSelect.value : 'English';
                const langMap = {
                    'English': 'en-US', 'Hindi': 'hi-IN', 'Telugu': 'te-IN',
                    'Tamil': 'ta-IN', 'Kannada': 'kn-IN', 'Malayalam': 'ml-IN',
                    'Marathi': 'mr-IN', 'Bengali': 'bn-IN', 'Spanish': 'es-ES',
                    'French': 'fr-FR'
                };
                recognition.lang = langMap[selectedLangCode] || 'en-US';
                recognition.start();
                isRecording = true;
                micIcon.style.color = 'var(--red-alert)';
            }
        });

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                symptomsInput.value += (symptomsInput.value ? ' ' : '') + finalTranscript;
            }
        };

        recognition.onend = () => {
            isRecording = false;
            micIcon.style.color = 'var(--text-muted)';
        };
        
        recognition.onerror = () => {
            isRecording = false;
            micIcon.style.color = 'var(--text-muted)';
        };
    } else if (micIcon) {
        micIcon.style.display = 'none';
    }


    // Image upload handling
    dropzone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            // Compress uploaded image instantly
            const img = await createImageBitmap(e.target.files[0]);
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 512;
            let width = img.width;
            let height = img.height;
            
            if (width > height && width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            imagePreview.src = canvas.toDataURL('image/jpeg', 0.7);
            imagePreview.style.display = 'block';
            const placeholder = document.getElementById('upload-placeholder');
            if (placeholder) placeholder.style.display = 'none';
        }
    });

    // Run AI Diagnostic Analysis
    runBtn.addEventListener('click', async () => {
        if (!imagePreview.src || !imagePreview.src.startsWith('data:')) {
            alert('Please click or drag to upload a crop photo first.');
            return;
        }

        const symptoms = symptomsInput.value.trim();
        
        // UI Loading state
        runBtn.disabled = true;
        btnText.textContent = "Analyzing Image Diagnostics...";
        btnDot.style.backgroundColor = "var(--text-main)";
        diagnosisResult.classList.remove('hidden');
        diagnosisResult.innerHTML = '<p style="color: var(--text-muted)">Connecting to NVIDIA NIM... Waiting for Vision AI response...</p>';

        try {
            // Get base64 representation of the image and compress it
            let base64Image = imagePreview.src;
            if (!base64Image.startsWith('data:')) {
                const res = await fetch(base64Image);
                const blob = await res.blob();
                
                // Create an Image bitmap
                const img = await createImageBitmap(blob);
                
                // Create canvas for resizing
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 512;
                let width = img.width;
                let height = img.height;
                
                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to compressed JPEG base64
                base64Image = canvas.toDataURL('image/jpeg', 0.7);
            }

            // Get selected language
            const selectedLanguage = languageSelect ? languageSelect.value : 'English';
            
            const langMap = {
                'English': 'en-US',
                'Hindi': 'hi-IN',
                'Telugu': 'te-IN',
                'Tamil': 'ta-IN',
                'Kannada': 'kn-IN',
                'Malayalam': 'ml-IN',
                'Marathi': 'mr-IN',
                'Bengali': 'bn-IN',
                'Spanish': 'es-ES',
                'French': 'fr-FR'
            };

            // Helper function to handle streaming response
            const runStream = async (payload, onChunk) => {
                const response = await fetch("/api/diagnose", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    let errMessage = response.statusText;
                    try { const errData = await response.json(); if (errData.error) errMessage = errData.error; } catch(e) {}
                    throw new Error(errMessage);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let accumulatedText = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n");
                    
                    for (const line of lines) {
                        if (line.trim() === "data: [DONE]") continue;
                        if (line.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                    accumulatedText += data.choices[0].delta.content;
                                    if (onChunk) onChunk(accumulatedText);
                                }
                            } catch (e) {}
                        }
                    }
                }
                return accumulatedText;
            };

            let finalDisplayText = "";
            diagnosisResult.innerHTML = '<p style="color: var(--text-muted)">Diagnosing image (Fast Vision AI)... Please wait.</p>';

            // Step 1: English Analysis
            const englishPrompt = `You are an expert Agricultural AI.
Analyze the crop leaf image and diagnose the disease. Be extremely concise.
Format:
1. Problem: [1 short sentence]
2. Cause: [1 short sentence]
3. Solution: [Maximum 2 short bullet points]

${symptoms ? `Notes: ${symptoms}` : ""}`;

            const step1Payload = {
                model: "meta/llama-3.2-11b-vision-instruct",
                messages: [
                    { role: "user", content: [
                        { type: "text", text: englishPrompt },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]}
                ],
                max_tokens: 512,
                temperature: 0.2,
                stream: true
            };

            const englishText = await runStream(step1Payload, null); // Wait for full response silently

            // Step 2: Translation (if needed)
            if (selectedLanguage !== 'English') {
                diagnosisResult.innerHTML = `<p style="color: var(--text-muted)">Translating to ${selectedLanguage} (Lightning Fast Text AI)...</p>`;
                
                const translationPrompt = `Translate the following agricultural diagnosis into ${selectedLanguage}. 
Keep the exact same format (1. Problem, 2. Cause, 3. Solution). 
Do NOT add any English text. Reply 100% in ${selectedLanguage}.

Text to translate:
${englishText}`;

                const step2Payload = {
                    model: "meta/llama-3.1-70b-instruct",
                    messages: [
                        { role: "user", content: translationPrompt }
                    ],
                    max_tokens: 512,
                    temperature: 0.1,
                    stream: true
                };

                finalDisplayText = await runStream(step2Payload, (currentText) => {
                    const formattedHtml = currentText
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/\n\n/g, '</p><p>')
                        .replace(/\n/g, '<br>');
                    diagnosisResult.innerHTML = `<p>${formattedHtml}</p>`;
                });
            } else {
                finalDisplayText = englishText;
                const formattedHtml = finalDisplayText
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br>');
                diagnosisResult.innerHTML = `<p>${formattedHtml}</p>`;
            }

            // After stream completes, read the response out loud
            // After stream completes, add an on-demand Play and Stop Audio buttons
            if (window.speechSynthesis && finalDisplayText && !finalDisplayText.startsWith("Translating")) {
                const playBtnHtml = `<div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button id="play-audio-btn" style="padding: 10px 15px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="ph-fill ph-speaker-high"></i> Play Audio
                    </button>
                    <button id="stop-audio-btn" style="padding: 10px 15px; background: rgba(255,60,60,0.1); border: 1px solid rgba(255,60,60,0.3); color: #ff6b6b; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <i class="ph-fill ph-stop-circle"></i> Stop Audio
                    </button>
                </div>`;
                
                diagnosisResult.innerHTML += playBtnHtml;
                
                document.getElementById('play-audio-btn').addEventListener('click', () => {
                    // Stop any currently playing audio
                    if (window.currentAudioPlayer) {
                        window.currentAudioPlayer.pause();
                        window.currentAudioPlayer = null;
                    }
                    window.audioQueue = [];
                    
                    // Strip markdown for clean speech
                    let cleanText = finalDisplayText.replace(/\*/g, '').replace(/#/g, '').replace(/-/g, '');
                    cleanText = cleanText.replace(/(\d+)\./g, '$1,');
                    
                    // Extract language code (e.g., 'ta' for Tamil, 'te' for Telugu)
                    const targetLangCode = (langMap[selectedLanguage] || 'en-US').split('-')[0];
                    
                    if (cleanText.trim()) {
                        const lines = cleanText.split('\n');
                        lines.forEach(line => {
                            let text = line.trim();
                            if (text) {
                                // Google TTS has a 200 character limit. Split long lines safely.
                                if (text.length > 200) {
                                    const subChunks = text.match(/[^,.]+[,.]+/g) || [text];
                                    subChunks.forEach(sc => {
                                        if (sc.trim()) window.audioQueue.push(sc.trim());
                                    });
                                } else {
                                    window.audioQueue.push(text);
                                }
                            }
                        });
                        
                        const playNext = async () => {
                            if (window.audioQueue.length > 0) {
                                const textChunk = window.audioQueue.shift();
                                try {
                                    const res = await fetch('/api/tts', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ text: textChunk, lang: targetLangCode })
                                    });
                                    if (res.ok) {
                                        const blob = await res.blob();
                                        const url = URL.createObjectURL(blob);
                                        window.currentAudioPlayer = new Audio(url);
                                        window.currentAudioPlayer.onended = playNext;
                                        window.currentAudioPlayer.play().catch(e => {
                                            console.error("Playback failed:", e);
                                            playNext();
                                        });
                                    } else {
                                        console.error("TTS fetch failed", res.status);
                                        playNext();
                                    }
                                } catch (e) {
                                    console.error("TTS error:", e);
                                    playNext();
                                }
                            }
                        };
                        playNext();
                    }
                });
                
                document.getElementById('stop-audio-btn').addEventListener('click', () => {
                    if (window.currentAudioPlayer) {
                        window.currentAudioPlayer.pause();
                        window.currentAudioPlayer = null;
                    }
                    window.audioQueue = [];
                });
            }

        } catch (error) {
            console.error(error);
            diagnosisResult.innerHTML = `<p style="color: var(--red-alert)">Error connecting to NVIDIA API: ${error.message}</p>`;
        } finally {
            runBtn.disabled = false;
            btnText.textContent = "Run AI Diagnostic Analysis";
            btnDot.style.backgroundColor = "rgba(0,0,0,0.5)";
        }
    });
});
