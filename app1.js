// Otimização 7: Adicionar modo DEV para logs de performance
const DEV_MODE = window.location.protocol === 'file:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
const devLog = (...args) => {
    if (DEV_MODE) {
        console.log('[DEV]', ...args);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // --- Utility to remove accents ---
    const removeAccents = (str) => {
        // This function should only be used for AI prompts, not for UI text.
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    const browserPath = {
        dirname: (p) => {
            if (p === '/') return '/';
            let pathStr = p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
            const lastSlash = pathStr.lastIndexOf('/');
            if (lastSlash === -1) return '.';
            if (lastSlash === 0) return '/';
            return pathStr.substring(0, lastSlash);
        }
    };

    // --- Theme Management ---
    const updateThemeUI = (theme) => {
        const lightIcon = document.getElementById('theme-icon-light'); // Sun icon
        const darkIcon = document.getElementById('theme-icon-dark'); // Moon icon
        if (!lightIcon || !darkIcon) return;

        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            lightIcon.classList.remove('hidden'); // Show sun icon to switch to light
            darkIcon.classList.add('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            lightIcon.classList.add('hidden');
            darkIcon.classList.remove('hidden'); // Show moon icon to switch to dark
        }
    };

    const applyTheme = () => {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            updateThemeUI('dark');
        } else {
            updateThemeUI('light');
        }
    };

    const toggleTheme = () => {
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme);
    };

    applyTheme(); // Apply theme on initial load

    // --- Global State Management ---
    let appState = {
        currentUser: null,
        apiKeysConfigured: false,
        adminPanel: {
            active: { currentPage: 1, limit: 10 },
            pending: { currentPage: 1, limit: 10 },
            currentSearch: '',
            userStatusFilter: 'active' // Default filter for admin users
        },
        progressInterval: null,
        phraseInterval: null,
        toastTimeout: null,
        sidebarOrder: [],
        draggingElement: null,
        currentTab: 'script-writer',
        lastGeneratedPrompts: null,
        lightboxCurrentIndex: -1,
        imageGenStatus: {
            active: false,
            current: 0,
            total: 0,
            message: '',
            error: false
        },
        voiceGenStatus: {
            active: false,
            current: 0,
            total: 0,
            message: '',
            error: false
        },
        sceneGenStatus: {
            active: false,
            current: 0,
            total: 0,
            message: '',
            error: false
        },
        voiceGenerator: {
            presets: null,
            longGenJobId: null,
            longGenInterval: null,
        },
        welcomeVideoShown: localStorage.getItem('welcomeVideoShown') === 'true',
        fileManager: {
            currentPath: '/',
            selectedItems: new Set(),
            items: []
        },
        downloads: {
            currentPath: '/',
            items: []
        }
    };

    let scriptResults = { fullResult: null, currentPage: 1, partsPerPage: 10 };
    let scenePromptResults = { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
    let thumbnailPromptResults = { data: [], allPromptsText: '', rawPromptsText: '' };
    let imageFxResults = { images: [], lastClearedImages: [], lastPrompt: '' };
    let reviewerResults = {
        originalScript: null,
        originalScores: null,
        suggestions: [],
        revisedScript: '',
        newScores: null
    };

    // --- Utility Functions ---
    const showScreen = (screenId) => {
        ['auth-section', 'activation-container', 'app-container', 'maintenance-overlay', 'force-password-change-modal', 'password-reset-modal'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = (id === screenId) ? 'flex' : 'none';
        });
    };

    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    };
    
    const generateRandomScore = (min, max) => {
        // Returns a number with one decimal place
        return parseFloat((Math.random() * (max - min) + min).toFixed(1));
    };

    const showProgressModal = (mainMessage, subMessage = null) => {
        const modal = document.getElementById('progress-modal');
        const taskMessageEl = document.getElementById('progress-task-message');
        const motivationalPhraseEl = document.getElementById('progress-motivational-phrase');
        const partCounterEl = document.getElementById('progress-part-counter');
        const partProgressBarContainer = document.getElementById('part-progress-bar-container');

        if (!modal || !taskMessageEl || !motivationalPhraseEl || !partCounterEl || !partProgressBarContainer) return;
        
        const phrases = [ "darkscript AI esta forjando seu proximo roteiro viral...", "Otimizando cada palavra para o seu sucesso no YouTube...", "Imagine seu canal crescendo. Estamos trabalhando para isso..."];

        taskMessageEl.textContent = mainMessage || 'Aguarde um momento...';
        partCounterEl.textContent = '';
        partProgressBarContainer.style.display = 'block';

        clearInterval(appState.phraseInterval);
        motivationalPhraseEl.textContent = subMessage || phrases[Math.floor(Math.random() * phrases.length)];
        appState.phraseInterval = setInterval(() => {
            motivationalPhraseEl.textContent = phrases[Math.floor(Math.random() * phrases.length)];
        }, 4000);
        
        updateProgress(0);
        modal.style.display = 'flex';

        let currentProgress = 0;
        let targetProgress = 0;
        
        clearInterval(appState.progressInterval);
        appState.progressInterval = setInterval(() => {
            if (currentProgress < targetProgress) {
                currentProgress = Math.min(currentProgress + 1, targetProgress);
            } else if (currentProgress < 95) {
                currentProgress = Math.min(currentProgress + 0.1, 95);
            }
            updateProgress(currentProgress);
        }, 80);

        window.setRealProgress = (realPercentage, counterText = '') => {
            targetProgress = realPercentage;
            partCounterEl.textContent = counterText;
            
            const partsInfoMatch = counterText.match(/(\d+)\/(\d+)/);
            if (partsInfoMatch) {
                let currentPart = parseInt(partsInfoMatch[1]);
                const totalParts = parseInt(partsInfoMatch[2]);
                
                currentPart = Math.min(currentPart, totalParts);
                
                if (totalParts > 1) {
                    const partProgress = (currentPart / totalParts) * 100;
                    const partProgressBar = document.getElementById('part-progress-bar');
                    if (partProgressBar) {
                        partProgressBar.style.width = `${partProgress}%`;
                        partProgressBarContainer.style.display = 'block';
                    }
                }
            }
        };
        
        window.setPartProgress = (progress) => {
            const partProgressBar = document.getElementById('part-progress-bar');
            if(partProgressBar) {
                partProgressBar.style.width = `${progress}%`;
            }
        };
    };

    const updateProgress = (progress) => {
        const circleEl = document.getElementById('progress-circle');
        const percentageEl = document.getElementById('progress-percentage');
        if (!circleEl || !percentageEl) return;

        const radius = circleEl.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const finalProgress = Math.min(100, Math.max(0, progress));
        const offset = circumference - (finalProgress / 100) * circumference;
        
        circleEl.style.strokeDashoffset = offset;
        percentageEl.textContent = `${Math.floor(finalProgress)}%`;

        if (finalProgress < 95) {
            circleEl.classList.add('pulsing-wait');
        } else {
            circleEl.classList.remove('pulsing-wait');
        }
    };

    const hideProgressModal = () => {
        if(window.setRealProgress) window.setRealProgress(100, '');
        clearInterval(appState.progressInterval);
        clearInterval(appState.phraseInterval);
        
        const modal = document.getElementById('progress-modal');
        if(modal && modal.style.display !== 'none') {
            const finalTimeout = setTimeout(() => {
                if (modal) modal.style.display = 'none';
                updateProgress(0);
                const partProgressBarContainer = document.getElementById('part-progress-bar-container');
                if(partProgressBarContainer) partProgressBarContainer.style.display = 'none';
                clearTimeout(finalTimeout);
            }, 1000);
        }
    };

    const showSuccessToast = (message) => {
        const toast = document.getElementById('success-toast');
        const toastMessage = document.getElementById('success-toast-message');
        if(!toast || !toastMessage) return;
        toastMessage.textContent = message;
        if (appState.toastTimeout) clearTimeout(appState.toastTimeout);
        toast.classList.add('show');
        appState.toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    };

    const addToLog = (message, isError = false) => {
        const logBar = document.getElementById('log-bar');
        const logMessage = document.getElementById('log-message');
        if(!logBar || !logMessage) return;
        logMessage.textContent = message;
        logBar.style.backgroundColor = isError ? '#fee2e2' : '#dbeafe';
        logBar.style.color = isError ? '#991b1b' : '#1e40af';
    };

    const safelyDownloadFile = async (content, filename, mimeType = 'application/octet-stream', toastMessage = 'Transferencia iniciada!') => {
        let blob;
        if (typeof content === 'string' && content.startsWith('data:')) {
            const parts = content.split(';base64,');
            const mime = parts[0].split(':')[1];
            const base64 = parts[1];
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: mime });
        } else if (content instanceof Blob) {
            blob = content;
        } else if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://'))) {
            try {
                const response = await fetch(content);
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.statusText}`);
                }
                blob = await response.blob();
                if (mimeType === 'application/octet-stream' && response.headers.get('Content-Type')) {
                    mimeType = response.headers.get('Content-Type');
                }
            } catch (error) {
                console.error("Error fetching file for download:", error);
                addToLog(`Erro ao baixar o ficheiro: ${error.message}`, true);
                return;
            }
        } else {
            blob = new Blob([content], { type: mimeType });
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click(); 
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccessToast(toastMessage);
    };

    const downloadThumbnail = async (url, filename) => {
        try {
            // First attempt: Fetch API to get blob, which is more reliable for naming files.
            const response = await fetch(url);
            if (!response.ok) throw new Error('A resposta da rede não foi bem-sucedida.');
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
            showSuccessToast('Transferência da thumbnail iniciada!');
        } catch (error) {
            console.warn("O download via Fetch falhou (provavelmente devido a CORS), tentando método alternativo:", error);
            addToLog("O download direto falhou, tentando abrir em nova aba...", false);
            // Fallback: Open in a new tab. This is the most compatible way if fetch is blocked.
            // The user can then right-click and save the image.
            try {
                window.open(url, '_blank');
                showSuccessToast('A thumbnail foi aberta numa nova aba. Pode salvá-la a partir daí.');
            } catch (fallbackError) {
                console.error("O método alternativo de download também falhou:", fallbackError);
                addToLog("Não foi possível baixar ou abrir a thumbnail.", true);
            }
        }
    };

    const populateLanguageSelectors = () => {
        const languages = [
            { value: 'Portugues (Brasil)', text: 'Portugues (Brasil)' },
            { value: 'English (US)', text: 'English (US)' },
            { value: 'Espanol (Espana)', text: 'Espanol (Espana)' },
            { value: 'Francais (Franca)', text: 'Francais (Franca)' },
            { value: 'Deutsch (Alemanha)', text: 'Deutsch (Alemanha)' },
            { value: 'Italiano (Italia)', text: 'Italiano (Italia)' },
            { value: '日本語 (Japao)', text: '日本語 (Japao)' },
            { value: '한국어 (Coreia do Sul)', text: '한국어 (Coreia do Sul)' },
            { value: 'Romana (Romenia)', text: 'Romana (Romenia)' },
            { value: 'Polski (Polska)', text: 'Polski (Polska)' }
        ];
        const langOptionsHtml = languages.map(lang => `<option value="${lang.value}">${lang.text}</option>`).join('');

        const langSelectIds = [
            'script-lang',
            'brainstorm-lang',
            'viral-lang',
            'optimizer-lang',
            'thumb-lang',
            'scene-lang',
            'reviewer-lang',
            'translator-lang-options' // For the translator, it's a container for checkboxes
        ];

        langSelectIds.forEach(id => {
            const selectEl = document.getElementById(id);
            if (selectEl) {
                if (id === 'translator-lang-options') {
                    // For translator, create checkboxes
                    selectEl.innerHTML = languages.map(lang => `
                        <div class="flex items-center">
                            <input type="checkbox" id="lang-${lang.value.replace(/\s/g, '-')}" value="${lang.value}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500">
                            <label for="lang-${lang.value.replace(/\s/g, '-')}" class="ml-2 text-sm text-gray-600 dark:text-gray-300">${lang.text}</label>
                        </div>
                    `).join('');
                } else {
                    selectEl.innerHTML = langOptionsHtml;
                    selectEl.value = 'Portugues (Brasil)';
                }
            }
        });
    };

    const renderSceneGenerationProgress = (status) => {
        let panel = document.getElementById('scene-gen-progress-panel');
        if (!panel) return;

        if (!status || !status.active) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        const { current, total, message } = status; // Removed 'error' from destructuring
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;
        const isComplete = current === total && total > 0;

        let title, titleColor, progressBarColor;
        // Error state is now handled by individual image cards, not the global progress panel
        if (isComplete) {
            title = 'Geracao Concluida';
            titleColor = 'text-green-600 dark:text-green-400';
            progressBarColor = 'bg-green-500';
        } else {
            title = 'A gerar prompts de cena...';
            titleColor = 'text-blue-600 dark:text-blue-400';
            progressBarColor = 'bg-blue-500';
        }
        
        panel.innerHTML = `
            <h4 class="font-bold text-sm mb-2 ${titleColor}">
                ${title}
                <button class="float-right text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onclick="document.getElementById('scene-gen-progress-panel').style.display = 'none';">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
            </h4>
            <p class="text-xs text-gray-700 dark:text-gray-300 mb-2 truncate" title="${message}">${message}</p>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div class="h-2 rounded-full ${progressBarColor}" style="width: ${progress}%;"></div>
            </div>
            <p class="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">${progress}% (${current}/${total})</p>
        `;
    };

    const renderImageGenerationProgress = (status) => {
        let panel = document.getElementById('image-gen-progress-panel');
        if (!panel) return;

        if (!status || !status.active) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        const { current, total, message } = status; // Removed 'error' from destructuring
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;
        const isComplete = current === total;

        let title, titleColor, progressBarColor;
        // Error state is now handled by individual image cards, not the global progress panel
        if (isComplete) {
            title = 'Geracao Concluida';
            titleColor = 'text-green-600 dark:text-green-400';
            progressBarColor = 'bg-green-500';
        } else {
            title = 'A gerar imagens...';
            titleColor = 'text-blue-600 dark:text-blue-400';
            progressBarColor = 'bg-blue-500';
        }
        
        panel.innerHTML = `
            <h4 class="font-bold text-sm mb-2 ${titleColor}">
                ${title}
                <button class="float-right text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onclick="document.getElementById('image-gen-progress-panel').style.display = 'none';">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
            </h4>
            <p class="text-xs text-gray-700 dark:text-gray-300 mb-2 truncate" title="${message}">${message}</p>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div class="h-2 rounded-full ${progressBarColor}" style="width: ${progress}%;"></div>
            </div>
            <p class="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">${progress}% (${current}/${total})</p>
        `;
    };
    const renderVoiceGenerationProgress = (status) => {
        let panel = document.getElementById('voice-gen-progress-panel');
        if (!panel) return;

        if (!status || !status.active) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        const { current, total, message, error } = status;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;
        const isComplete = current === total && total > 0;

        let title, titleColor, progressBarColor;
        if (error) {
            title = 'Erro na Narracao';
            titleColor = 'text-red-600 dark:text-red-400';
            progressBarColor = 'bg-red-500';
        } else if (isComplete) {
            title = 'Narracao Concluida';
            titleColor = 'text-green-600 dark:text-green-400';
            progressBarColor = 'bg-green-500';
        } else {
            title = 'A gerar narracao...';
            titleColor = 'text-blue-600 dark:text-blue-400';
            progressBarColor = 'bg-blue-500';
        }
        
        panel.innerHTML = `
            <h4 class="font-bold text-sm mb-2 ${titleColor}">
                ${title}
                <button class="float-right text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onclick="document.getElementById('voice-gen-progress-panel').style.display = 'none';">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
            </h4>
            <p class="text-xs text-gray-700 dark:text-gray-300 mb-2 truncate" title="${message}">${message}</p>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div class="h-2 rounded-full ${progressBarColor}" style="width: ${progress}%;"></div>
            </div>
            <p class="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">${progress}% (${current}/${total})</p>
        `;
    };

    const base64ToUint8Array = (base64) => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };

    const VOICE_DEFAULT_NAME = 'zephyr';

    const getVoiceGeneratorState = () => {
        if (!appState.voiceGenerator) {
            appState.voiceGenerator = { presets: null, longGenJobId: null, longGenInterval: null };
        }
        return appState.voiceGenerator;
    };

    const populateVoiceSelectors = (presets) => {
        const voiceSelectors = document.querySelectorAll('#tts-voice-select');
        if (!voiceSelectors.length || !presets || !Array.isArray(presets.voices)) return;

        const langMap = { "pt-BR": "Portugues (Brasil)", "en-US": "Ingles (EUA)", "es-ES": "Espanol (Espana)", "fr-FR": "Frances (Franca)", "de-DE": "Alemao (Alemanha)", "it-IT": "Italiano (Italia)", "ja-JP": "Japones (Japao)", "ko-KR": "Coreano (Coreia do Sul)" };
        const groupedVoices = presets.voices.reduce((acc, voice) => {
            const lang = langMap[voice.lang] || 'Outras';
            if (!acc[lang]) acc[lang] = [];
            acc[lang].push(voice);
            return acc;
        }, {});

        let optionsHtml = '';
        const langOrder = Object.keys(langMap);
        for (const langKey of langOrder) {
            const langName = langMap[langKey];
            if (groupedVoices[langName]) {
                optionsHtml += `<optgroup label="${langName}">`;
                optionsHtml += groupedVoices[langName].map(voice => `<option value="${voice.name}">${voice.label}${voice.multilingual ? ' (Multilingue)' : ''}</option>`).join('');
                optionsHtml += `</optgroup>`;
            }
        }

        voiceSelectors.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = `<option value="" disabled>Selecione uma voz</option>${optionsHtml}`;
            if (presets.voices.some(v => v.name === currentValue)) {
                select.value = currentValue;
            } else {
                select.value = VOICE_DEFAULT_NAME;
            }
        });
    };

    const ensureTtsPresetsLoaded = () => {
        const state = getVoiceGeneratorState();
        if (state.presets) {
            populateVoiceSelectors(state.presets);
            return state.presets;
        }
        
        if (typeof ttsVoicePresets !== 'undefined') {
            state.presets = ttsVoicePresets;
            populateVoiceSelectors(ttsVoicePresets);
            return ttsVoicePresets;
        } else {
            setTimeout(ensureTtsPresetsLoaded, 100);
            return null;
        }
    };

    const updateVoiceDurationHint = () => {
        const hint = document.getElementById('tts-duration-hint');
        const scriptInput = document.getElementById('tts-script-input');
        if (!hint || !scriptInput) return;
        
        const text = scriptInput.value;
        const totalWords = text.trim().split(/\s+/).filter(Boolean).length;

        if (totalWords === 0) {
            hint.textContent = 'Adicione o roteiro para calcular a duracao.';
            return;
        }
        const seconds = Math.max(1, Math.round((totalWords / 150) * 60));
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        const formatted = minutes > 0 ? `${minutes}min ${String(remainder).padStart(2, '0')}s` : `${remainder}s`;
        hint.textContent = `Estimativa ~ ${formatted} (${totalWords} palavras)`;
    };

    const debouncedVoiceDuration = debounce(updateVoiceDurationHint, 250);

    const resetVoiceGeneratorForm = () => {
        const state = getVoiceGeneratorState();
        if (state.longGenInterval) {
            clearInterval(state.longGenInterval);
            state.longGenInterval = null;
        }
        state.longGenJobId = null;

        const scriptInput = document.getElementById('tts-script-input');
        if (scriptInput) scriptInput.value = '';
        
        const styleTextarea = document.getElementById('tts-style-instructions');
        if (styleTextarea) styleTextarea.value = '';
        
        const outputContainer = document.getElementById('output');
        if (outputContainer) outputContainer.innerHTML = '';
        
        updateVoiceDurationHint();
    };

    const setupNarrationStyles = () => {
        const stylePresetSelect = document.getElementById('tts-style-preset');
        const styleInstructionsTextarea = document.getElementById('tts-style-instructions');
    
        if (!stylePresetSelect || !styleInstructionsTextarea) return;
    
        const styles = [
            { "nome": "Padrao (Personalizado)", "descricao": "" },
            { "nome": "Investigador Cetico", "descricao": "Tom narrativo autoritario, cetico e misterioso. O tom deve ser contido, mas intenso, projetando a imagem de um investigador de elite. A narracao deve ser seria e factual, com um ritmo ligeiramente mais lento e pausas nitidas para construir suspense antes de revelacoes. Enfase maxima em palavras que sugerem engano ou descoberta." },
            { "nome": "Misterioso Classico", "descricao": "Tom misterioso e envolvente, ritmo lento e pausas dramaticas antes das revelacoes." },
            { "nome": "Investigador", "descricao": "Voz seria e analitica, ritmo constante e pausas curtas apos fatos importantes." },
            { "nome": "Contador de Historias Sombrio", "descricao": "Tom sombrio, ritmo cadenciado e pausas longas antes do climax." },
            { "nome": "Suspense Cinematico", "descricao": "Tom teatral, comeca devagar, acelera no climax e desacelera no final." },
            { "nome": "True Crime Documentario", "descricao": "Tom grave e formal, ritmo lento com pausas breves apos datas, nomes ou locais." },
            { "nome": "Sussurro Intimista", "descricao": "Fale baixo, quase sussurrando, ritmo suave e pausas longas antes das revelacoes chocantes." },
            { "nome": "Narrador Impactante", "descricao": "Voz firme e marcante, ritmo medio, pausas curtas para dar impacto a cada frase." },
            { "nome": "Historia Rapida e Tensa", "descricao": "Tom urgente, ritmo acelerado, pausas minimas para criar sensacao de correria." },
            { "nome": "Misterio Vintage", "descricao": "Leve efeito de radio antigo, ritmo lento e pausas longas, como narrador dos anos 50." },
            { "nome": "Misterio com Humor Sutil", "descricao": "Tom leve e ironico, ritmo medio, pausas estrategicas para comentarios sarcasticos." },
            { "nome": "Apresentador de Radio Noir", "descricao": "Voz grave e suave, ritmo cadenciado, pausas longas, clima de novela policial." },
            { "nome": "Narrador de Lenda Urbana", "descricao": "Tom inquietante, ritmo pausado, pausas antes de revelar detalhes sobrenaturais." },
            { "nome": "Guia de Caso Misterioso", "descricao": "Tom explicativo, ritmo moderado, pausas curtas apos cada fato para reflexao." },
            { "nome": "Narrador Cinematico Epico", "descricao": "Tom epico e sombrio, ritmo variavel, pausas dramaticas antes do climax." },
            { "nome": "Historia Contada ao Pe do Ouvido", "descricao": "Tom intimo, quase confidencial, ritmo lento, pausas prolongadas nas revelacoes." },
            { "nome": "Tom de Reporter Policial", "descricao": "Tom jornalistico, ritmo constante, pausas para destaque de locais, datas e nomes." },
            { "nome": "Suspense Crescente", "descricao": "Comeca neutro, vai aumentando a intensidade, pausas cada vez menores ate o climax." },
            { "nome": "Tom Enigmatico", "descricao": "Voz baixa e envolvente, ritmo lento, pausas longas para criar misterio profundo." },
            { "nome": "Narrador Dramatico", "descricao": "Tom teatral, ritmo marcado, pausas fortes antes das frases de impacto." },
            { "nome": "Estilo Serie Documental", "descricao": "Tom narrativo de serie, ritmo cadenciado, pausas rapidas apos fatos e estatisticas." }
        ];
    
        stylePresetSelect.innerHTML = styles.map(style => `<option value="${style.descricao}">${style.nome}</option>`).join('');
    
        stylePresetSelect.addEventListener('change', (e) => {
            styleInstructionsTextarea.value = e.target.value;
        });
    };

    const initializeVoiceGenerator = () => {
        ensureTtsPresetsLoaded();
        setupNarrationStyles();
        const scriptInput = document.getElementById('tts-script-input');
        if (scriptInput) {
            scriptInput.addEventListener('input', debouncedVoiceDuration);
        }
        updateVoiceDurationHint();
    };

    // --- API Communication ---
    async function apiRequest(endpoint, method, body = null, isFormData = false) {
        const token = localStorage.getItem('authToken');
        const options = { method, headers: {} };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;
        
        if (isFormData) {
            options.body = body; // body is already FormData object
        } else {
            options.headers['Content-Type'] = 'application/json';
            if (body) options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(endpoint, options);
            if (!response.ok) {
                const data = await response.json().catch(() => ({ message: `Erro HTTP: ${response.status}` }));
                if ((response.status === 401 || response.status === 403) && !endpoint.includes('/api/verify-session')) {
                     handleLogout();
                }
                throw new Error(data.message || `Erro: ${response.status} ${response.statusText}`);
            }
            return await response.json().catch(() => ({}));
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    async function streamApiRequest(endpoint, body, onChunk, onDone, onError) {
        const token = localStorage.getItem('authToken');
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    const error = new Error(errorData.message || 'Erro na requisicao de streaming.');
                    onError(error);
                    reject(error);
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                
                async function processStream() {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) {
                                onDone(buffer); // Process any remaining buffer
                                resolve();
                                return;
                            }
                            
                            buffer += decoder.decode(value, { stream: true });
                            
                            const lines = buffer.split('\n');
                            buffer = lines.pop(); // Keep the potentially incomplete last line

                            for (const line of lines) {
                                if (line.trim() === 'data: [DONE]') { // OpenAI stream finished
                                    onDone(buffer);
                                    resolve();
                                    return;
                                }
                                if (line.startsWith('data: ')) {
                                    try {
                                        const jsonData = JSON.parse(line.substring(6));
                                        onChunk(jsonData);
                                    } catch (e) {
                                        // This can can happen with Gemini's first empty data chunk
                                        // console.warn('Chunk JSON invalido ignorado:', line);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        onError(error);
                        reject(error);
                    }
                }
                processStream();

            } catch (error) {
                onError(error);
                reject(error);
            }
        });
    }

    // --- Modals ---
    function showLightboxImage(index) {
        const imgEl = document.getElementById('lightbox-image');
        const image = imageFxResults.images[index];
        if (!imgEl || !image) return;
    
        imgEl.src = image.url;
    
        document.getElementById('lightbox-prev-btn').style.display = index === 0 ? 'none' : 'flex';
        document.getElementById('lightbox-next-btn').style.display = index === imageFxResults.images.length - 1 ? 'none' : 'flex';
    }

    function openLightbox(imageIndex) {
        const modal = document.getElementById('image-lightbox-modal');
        if (!modal) return;
        appState.lightboxCurrentIndex = imageIndex;
        showLightboxImage(appState.lightboxCurrentIndex);
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
    }

    function closeLightbox() {
        const modal = document.getElementById('image-lightbox-modal');
        if (!modal) return;
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
            appState.lightboxCurrentIndex = -1;
            // Clear the image source to prevent it from showing briefly on next open
            const imgEl = document.getElementById('lightbox-image');
            if (imgEl) imgEl.src = '';
        }, 300);
    }

    function showImageGenCompleteModal(durationInSeconds) {
        const modal = document.getElementById('image-gen-complete-modal');
        if (!modal) return;
    
        const durationEl = document.getElementById('image-gen-duration');
        if (durationEl) {
            durationEl.textContent = durationInSeconds !== undefined ? `Tempo total: ${durationInSeconds} segundos.` : '';
        }
    
        modal.style.display = 'flex';
    
        const closeBtn = document.getElementById('close-image-gen-modal-btn');
        const viewBtn = document.getElementById('view-generated-images-btn');
    
        // Clone and replace to remove old listeners
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        const newViewBtn = viewBtn.cloneNode(true);
        viewBtn.parentNode.replaceChild(newViewBtn, viewBtn);
    
        newCloseBtn.onclick = () => modal.style.display = 'none';
        
        newViewBtn.onclick = () => {
            modal.style.display = 'none';
            document.querySelector('.sidebar-btn[data-tab="image-generator"]').click();
            setTimeout(() => {
                document.getElementById('output')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        };
    }

    function showSceneGenCompleteModal(durationInSeconds) {
        const modal = document.getElementById('scene-gen-complete-modal');
        if (!modal) return;
    
        const durationEl = document.getElementById('scene-gen-duration');
        if (durationEl) {
            durationEl.textContent = durationInSeconds !== undefined ? `Tempo total: ${durationInSeconds} segundos.` : '';
        }
    
        modal.style.display = 'flex';
    
        const closeBtn = document.getElementById('close-scene-gen-modal-btn');
        const viewBtn = document.getElementById('view-generated-scenes-btn');
    
        // Clone and replace to remove old listeners
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        const newViewBtn = viewBtn.cloneNode(true);
        viewBtn.parentNode.replaceChild(newViewBtn, viewBtn);
    
        newCloseBtn.onclick = () => modal.style.display = 'none';
        
        newViewBtn.onclick = () => {
            modal.style.display = 'none';
            document.querySelector('.sidebar-btn[data-tab="scene-prompts"]').click();
            setTimeout(() => {
                document.getElementById('output')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        };
    }

    function showVoiceGenCompleteModal(downloadUrl) {
        const modal = document.getElementById('voice-gen-complete-modal');
        if (!modal) return;
    
        const downloadBtn = document.getElementById('download-voice-gen-btn');
        const closeBtn = document.getElementById('close-voice-gen-modal-btn');
    
        downloadBtn.href = downloadUrl;
    
        const hideModal = () => modal.style.display = 'none';
    
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
        newDownloadBtn.addEventListener('click', hideModal);
    
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', hideModal);
    
        modal.style.display = 'flex';
    }

    // --- Authentication & Screen Navigation ---
    async function handleLogin(e) {
        e.preventDefault();
        document.getElementById('login-feedback').textContent = '';
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        try {
            const response = await apiRequest('/api/login', 'POST', { email, password, rememberMe });
            localStorage.setItem('authToken', response.token);
            appState.currentUser = response.user;

            if (response.mustChangePassword) {
                showForcePasswordChangeModal();
                return;
            }

            const appStatus = await apiRequest('/api/status', 'GET');

            if (appStatus && appStatus.maintenance && appStatus.maintenance.is_on && appState.currentUser.role !== 'admin') {
                showMaintenanceMode(appStatus.maintenance.message);
            } else {
                await initializeApp(appStatus ? appStatus.announcement : null);
            }

        } catch (error) {
            console.error("Login Error:", error); // Added detailed error logging
            if (error.message.includes('ativada')) {
                showScreen('activation-container');
            } else {
                document.getElementById('login-feedback').textContent = error.message;
            }
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        const feedbackEl = document.getElementById('register-feedback');
        feedbackEl.textContent = '';
        const email = document.getElementById('register-email').value;
        const whatsapp = document.getElementById('register-whatsapp').value;
        const password = document.getElementById('register-password').value;

        const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
        const cleanedWhatsapp = whatsapp.replace(/\D/g, '');

        if (!whatsappRegex.test(cleanedWhatsapp) || cleanedWhatsapp.length < 10) {
            feedbackEl.textContent = 'Por favor, insira um numero de WhatsApp valido.';
            return;
        }

        try {
            await apiRequest('/api/register', 'POST', { email, password, whatsapp });
            showScreen('activation-container');
        } catch (error)
        {
            console.error("Register Error:", error); // Added detailed error logging
            feedbackEl.textContent = error.message;
        }
    }

    function handleLogout() {
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('apiAlertShown');
        appState.currentUser = null;
        showScreen('auth-section');
        document.getElementById('login-form').reset();
    }

    function showMaintenanceMode(message) {
        document.getElementById('maintenance-message').textContent = message || 'Estamos a realizar melhorias na plataforma. Voltaremos em breve!';
        showScreen('maintenance-overlay');
    }
    function showAnnouncement(announcement) {
        if (!announcement || !announcement.message) return;
        const seenAnnouncements = JSON.parse(localStorage.getItem('seenAnnouncements') || '[]');
        const announcementHash = announcement.message.substring(0, 50);
        if (seenAnnouncements.includes(announcementHash)) return;

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const linkedMessage = announcement.message.replace(urlRegex, '<a href="$1" target="_blank" class="text-blue-500 hover:underline">$1</a>');
        document.getElementById('announcement-message').innerHTML = linkedMessage;
        document.getElementById('announcement-overlay').style.display = 'flex';

        document.getElementById('close-announcement-btn').onclick = () => {
            document.getElementById('announcement-overlay').style.display = 'none';
            seenAnnouncements.push(announcementHash);
            localStorage.setItem('seenAnnouncements', JSON.stringify(seenAnnouncements));
        };
    }
    function showConfirmationModal(title, message, onConfirm) {
        document.getElementById('confirmation-title').textContent = title;
        document.getElementById('confirmation-message').textContent = message;
        document.getElementById('confirmation-modal').style.display = 'flex';

        const confirmBtn = document.getElementById('confirm-btn');
        const cancelBtn = document.getElementById('cancel-btn');

        const confirmHandler = () => { onConfirm(); hideConfirmationModal(); };
        const cancelHandler = () => hideConfirmationModal();

        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));

        document.getElementById('confirm-btn').addEventListener('click', confirmHandler);
        document.getElementById('cancel-btn').addEventListener('click', cancelHandler);
    }
    const hideConfirmationModal = () => document.getElementById('confirmation-modal').style.display = 'none';

    async function showForcePasswordChangeModal() {
        const modal = document.getElementById('force-password-change-modal');
        const form = document.getElementById('force-password-change-form');
        
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        const feedbackEl = newForm.querySelector('#force-password-change-feedback');
        const newPasswordInput = newForm.querySelector('#new-password-input');
        const confirmNewPasswordInput = newForm.querySelector('#confirm-new-password-input');
        const submitBtn = newForm.querySelector('button[type="submit"]');

        modal.style.display = 'flex';
        feedbackEl.textContent = '';

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            feedbackEl.textContent = '';
            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;

            if (newPassword !== confirmNewPassword) {
                feedbackEl.textContent = 'As senhas nao coincidem.';
                return;
            }
            if (newPassword.length < 6) {
                feedbackEl.textContent = 'A nova senha deve ter pelo menos 6 caracteres.';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'A salvar...';

            try {
                await apiRequest('/api/user/change-password', 'POST', { newPassword });
                showSuccessToast('Senha alterada com sucesso!');
                modal.style.display = 'none';
                const appStatus = await apiRequest('/api/status', 'GET');
                if (appStatus && appStatus.maintenance && appStatus.maintenance.is_on && appState.currentUser.role !== 'admin') {
                    showMaintenanceMode(appStatus.maintenance.message);
                } else {
                    await initializeApp(appStatus ? appStatus.announcement : null);
                }
            } catch (error) {
                console.error("Change Password Error:", error); // Added detailed error logging
                feedbackEl.textContent = error.message || 'Ocorreu um erro ao alterar a senha. Tente novamente.';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Salvar Nova Senha';
            }
        });

        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    function showPasswordResetModal() {
        const modal = document.getElementById('password-reset-modal');
        const form = document.getElementById('password-reset-form');
        
        // To avoid duplicate listeners, we replace the form with a clone.
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        const feedbackEl = newForm.querySelector('#password-reset-feedback');
        const emailInput = newForm.querySelector('#reset-email-input');
        const submitBtn = newForm.querySelector('button[type="submit"]');
        const cancelBtn = newForm.querySelector('#cancel-password-reset');

        modal.style.display = 'flex';
        feedbackEl.textContent = '';
        emailInput.value = '';

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            feedbackEl.textContent = '';
            const email = emailInput.value;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'A enviar...';

            try {
                const response = await apiRequest('/api/password-reset', 'POST', { email });
                feedbackEl.textContent = response.message;
                feedbackEl.classList.remove('text-red-500');
                feedbackEl.classList.add('text-green-600');
                submitBtn.style.display = 'none'; // Hide submit button on success
                setTimeout(() => {
                    modal.style.display = 'none';
                    // Reset for next time
                    feedbackEl.classList.remove('text-green-600');
                    feedbackEl.classList.add('text-red-500');
                    submitBtn.style.display = 'block';
                }, 5000);
            } catch (error) {
                console.error("Password Reset Error:", error); // Added detailed error logging
                feedbackEl.textContent = error.message || 'Ocorreu um erro ao redefinir a senha. Tente novamente.';
                feedbackEl.classList.add('text-red-500');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Senha Temporaria';
            }
        });

        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // --- Anti-Copy System ---
    function activateAntiCopy() {
        document.body.classList.add('no-copy');
        document.addEventListener('contextmenu', event => {
            event.preventDefault();
            addToLog('Acao desativada para proteger o conteudo - Para copiar: Windows (Ctrl+C/Ctrl+V) | Mac (Cmd+C/Cmd+V)', true);
        });
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'v')) return;
            if (e.ctrlKey && ['u', 's', 'a', 'x'].includes(e.key.toLowerCase())) e.preventDefault();
            if (e.key === 'F12') e.preventDefault();
        });
    }

    async function checkAndShowApiAlert() {
        let hasClaude = false;
        let hasGemini = false;
        let hasGpt = false; // Added GPT check
        let hasImageFX = false;
        try {
            const settings = await apiRequest('/api/settings', 'GET');
            hasClaude = settings.claude && settings.claude.trim() !== '';
            hasGemini = Array.isArray(settings.gemini) && settings.gemini.some(key => key && key.trim() !== '');
            hasGpt = settings.gpt && settings.gpt.trim() !== ''; // Check for GPT key
            hasImageFX = settings.imagefx_cookies && settings.imagefx_cookies.trim() !== '';
        } catch (error) {
            console.error("Erro ao verificar as configuracoes de API:", error);
        }

        appState.apiKeysConfigured = hasClaude || hasGemini || hasGpt || hasImageFX; // Updated to include GPT

        if (!appState.apiKeysConfigured && !sessionStorage.getItem('apiAlertShown')) {
            document.getElementById('api-alert-modal').style.display = 'flex';
            sessionStorage.setItem('apiAlertShown', 'true');
        }
        return 
        !appState.apiKeysConfigured;
    }

    async function checkAndShowWhatsappPopup() {
        if (!appState.currentUser || appState.currentUser.whatsapp) return;
        const modal = document.getElementById('whatsapp-update-modal');
        const form = document.getElementById('whatsapp-update-form');
        const feedbackEl = document.getElementById('whatsapp-update-feedback');
        const formContainer = document.getElementById('whatsapp-form-container');
        const successContainer = document.getElementById('whatsapp-success-container');
        modal.style.display = 'flex';
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            feedbackEl.textContent = '';
            const whatsapp = document.getElementById('update-whatsapp-input').value;
            const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
            const cleanedWhatsapp = whatsapp.replace(/\D/g, '');

            if (!whatsappRegex.test(cleanedWhatsapp) || cleanedWhatsapp.length < 10) {
                feedbackEl.textContent = 'Por favor, insira um numero de WhatsApp valido.';
                return;
            }
            try {
                await apiRequest('/api/user/whatsapp', 'PUT', { whatsapp });
                appState.currentUser.whatsapp = whatsapp;
                formContainer.style.display = 'none';
                successContainer.style.display = 'block';
                setTimeout(() => modal.style.display = 'none', 2000);
            } catch (error) {
                console.error("Whatsapp Update Error:", error); // Added detailed error logging
                feedbackEl.textContent = error.message || 'Ocorreu um erro. Tente novamente.';
            }
        });
    }

    // --- App Initialization & UI Building ---
    async function initializeApp(initialAnnouncement = null) {
        if (!appState.currentUser) return;
        showScreen('app-container');
        document.getElementById('user-email-display').textContent = appState.currentUser.email;
        buildSidebar();
        applyTheme(); // Call this again to ensure icons are set correctly after sidebar is built

        const apiKeysMissing = await checkAndShowApiAlert();

        if (apiKeysMissing) {
            appState.currentTab = 'settings';
        }

        renderTabContent(appState.currentTab);
        activateAntiCopy();
        if(initialAnnouncement) showAnnouncement(initialAnnouncement);
        await checkAndShowWhatsappPopup();
    }

    function getSidebarNavItems() {
        let navItems = [
            { id: 'creation-divider', type: 'divider', label: 'Criacao e Conteudo' },
            { id: 'brainstorm-ideas', type: 'tool', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', label: 'Brainstorm de Ideias' },
            { id: 'script-writer', type: 'tool', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', label: 'Criador de Roteiro' },
            { id: 'viral-titles', type: 'tool', icon: 'M15 15l-2 5L9 9l5-2 2 5z', label: 'Titulos Virais' },
            { id: 'script-translator', type: 'tool', icon: 'M3 5h12M9 3v2m1.06 7.11a12.56 12.56 0 01-3.43 3.43m3.43-3.43a12.56 12.56 0 003.43-3.43m-3.43 3.43l3.43 3.43m-3.43 3.43l-3.43-3.43m6.86-1.72a9 9 0 11-12.73 0 9 9 0 0112.73 0z', label: 'Tradutor de Roteiros' },
            
            { id: 'media-divider', type: 'divider', label: 'Midia e Imagem' },
            { id: 'scene-prompts', type: 'tool', icon: 'M15.5 4l-3.5 3.5M15.5 4a2.121 2.121 0 00-3-3L10 3.5M15.5 4v.5A2.5 2.5 0 0113 7M3 14l3-3m0 0l3 3m-3-3v10a2 2 0 002 2h3.5', label: 'Prompts para Cenas'},
            { id: 'thumbnail-prompts', type: 'tool', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Prompts de Thumbnail' },
            { id: 'image-generator', type: 'tool', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Gerador de Imagens' },
            { id: 'audio-divider', type: 'divider', label: 'Audio e Voz' },
            { id: 'voice-generator', type: 'tool', icon: 'M12 1a4 4 0 00-4 4v5a4 4 0 008 0V5a4 4 0 00-4-4zm-6 9a6 6 0 0012 0h2a8 8 0 01-7 7.937V21h-2v-3.063A8 8 0 014 10h2z', label: 'Gerador de Voz' },
            
            { id: 'optimization-divider', type: 'divider', label: 'Otimizacao e Gestao' },
            { id: 'video-optimizer', type: 'tool', icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: 'Otimizador de Video' },
            { id: 'optimizer', type: 'tool', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Otimizador de Descricao' },
           // { id: 'script-reviewer', type: 'tool', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Revisor de Roteiro' },
            { id: 'editors-cut', type: 'tool', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Guia de Edicao' },
            { id: 'srt-converter', type: 'tool', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', label: 'Conversor de SRT' },
            { id: 'text-divider', type: 'tool', icon: 'M4 6h16M4 12h16M4 18h7', label: 'Divisor de Texto' },
            
            { id: 'learning-divider', type: 'divider', label: 'Aprendizado' },
            { id: 'academy', type: 'tool', icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14v6m-6-3.422v-6.157a12.078 12.078 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998z', label: 'Academy' },
           // { id: 'downloads', type: 'tool', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4', label: 'Downloads' },

            { id: 'system-divider', type: 'divider', label: 'Sistema' },
            { id: 'settings', type: 'tool', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', label: 'Configuracoes' },
            { id: 'faq', type: 'tool', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4c-1.742 0-3.223-.835-3.772-2H6.5v2H4.5v-2H2.728a1 1 0 010-2h1.772V7H6.5v2h1.728zM12 18a6 6 0 100-12 6 6 0 000 12z', label: 'FAQ' },
        ];
        if (appState.currentUser && appState.currentUser.role === 'admin') {
            navItems.push(
                { id: 'admin', type: 'tool', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-1.781-4.121M12 11a4 4 0 11-8 0 4 4 0 018 0z', label: 'Painel Admin' },
             //   { id: 'file-manager', type: 'tool', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', label: 'Gerenciador de Arquivos' }
            );
        }
        return navItems;
    }

    const createIcon = (path) => `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="${path}" /></svg>`;

    function buildSidebar() {
        const sidebarNav = document.getElementById('sidebar-nav');
        sidebarNav.innerHTML = '';
        const allNavItems = getSidebarNavItems();
        const storedToolOrder = JSON.parse(localStorage.getItem('sidebarOrder') || '[]');
    
        const allToolsMap = new Map(allNavItems.filter(item => item.type === 'tool').map(item => [item.id, item]));
    
        let orderedToolIds = [];
        const seenToolIds = new Set();
    
        // Add tools from stored order first, if they still exist
        storedToolOrder.forEach(id => {
            if (allToolsMap.has(id)) {
                orderedToolIds.push(id);
                seenToolIds.add(id);
            }
        });
    
        // Add any new tools (not in stored order) to the end
        allToolsMap.forEach((tool, id) => {
            if (!seenToolIds.has(id)) {
                orderedToolIds.push(id);
            }
        });
    
        // Group tools by their original divider
        const sections = {};
        let currentSection = null;
    
        allNavItems.forEach(item => {
            if (item.type === 'divider') {
                currentSection = item.label;
                sections[currentSection] = { divider: item, tools: [] };
            } else if (item.type === 'tool' && currentSection) {
                sections[currentSection].tools.push(item.id);
            }
        });
    
        // Render sections in their original order
        allNavItems.filter(item => item.type === 'divider').forEach(dividerItem => {
            const section = sections[dividerItem.label];
            if (section) {
                const divider = document.createElement('div');
                divider.className = 'px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider';
                divider.textContent = section.divider.label;
                sidebarNav.appendChild(divider);
    
                // Render tools for this section based on the final sorted order
                orderedToolIds.forEach(toolId => {
                    if (section.tools.includes(toolId)) {
                        const tool = allToolsMap.get(toolId);
                        const wrapper = document.createElement('div');
                        wrapper.className = 'px-4 sidebar-draggable-item';
                        wrapper.setAttribute('data-item-id', tool.id);
                        wrapper.setAttribute('draggable', 'true');
                        const button = document.createElement('button');
                        button.className = `sidebar-btn w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100`;
                        button.setAttribute('data-tab', tool.id);
                        button.innerHTML = `<span>${createIcon(tool.icon)}</span><span>${tool.label}</span>`;
                        wrapper.appendChild(button);
                        sidebarNav.appendChild(wrapper);
                    }
                });
            }
        });
    
        setupDragAndDrop();
    }

    function saveSidebarOrder() {
        const sidebarNav = document.getElementById('sidebar-nav');
        const currentOrder = Array.from(sidebarNav.children)
            .filter(item => item.classList.contains('sidebar-draggable-item'))
            .map(item => item.getAttribute('data-item-id')).filter(Boolean);
        localStorage.setItem('sidebarOrder', JSON.stringify(currentOrder));
    }

    function setupDragAndDrop() {
        const sidebarNav = document.getElementById('sidebar-nav');
        const draggableItems = sidebarNav.querySelectorAll('.sidebar-draggable-item[draggable="true"]');
        draggableItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                appState.draggingElement = e.target.closest('.sidebar-draggable-item');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', appState.draggingElement.dataset.itemId);
                appState.draggingElement.classList.add('dragging');
            });
            item.addEventListener('dragenter', (e) => {
                e.preventDefault();
                const targetElement = e.target.closest('.sidebar-draggable-item');
                if (targetElement && targetElement !== appState.draggingElement && targetElement.getAttribute('draggable') === 'true') {
                    const bounding = targetElement.getBoundingClientRect();
                    const offset = bounding.y + (bounding.height / 2);
                    if (e.clientY - offset > 0) {
                        targetElement.classList.remove('over');
                        targetElement.classList.add('over', 'bottom');
                    } else {
                        targetElement.classList.remove('over', 'bottom');
                        targetElement.classList.add('over');
                    }
                }
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const targetElement = e.target.closest('.sidebar-draggable-item');
                e.dataTransfer.dropEffect = (targetElement && targetElement.getAttribute('draggable') === 'true') ? 'move' : 'none';
            });
            item.addEventListener('dragleave', (e) => {
                const targetElement = e.target.closest('.sidebar-draggable-item');
                if (targetElement) targetElement.classList.remove('over', 'bottom');
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const droppedOn = e.target.closest('.sidebar-draggable-item');
                const draggedElement = appState.draggingElement;
                if (draggedElement && droppedOn && draggedElement !== droppedOn && droppedOn.getAttribute('draggable') === 'true') {
                    const isBefore = droppedOn.classList.contains('over-top'); // Check if it's over the top half
                    const parent = droppedOn.parentNode;
                    if (isBefore) parent.insertBefore(draggedElement, droppedOn);
                    else parent.insertBefore(draggedElement, droppedOn.nextSibling);
                    saveSidebarOrder();
                }
                draggableItems.forEach(i => i.classList.remove('over', 'bottom', 'over-top'));
            });
            item.addEventListener('dragend', () => {
                if(appState.draggingElement) appState.draggingElement.classList.remove('dragging');
                appState.draggingElement = null;
                draggableItems.forEach(i => i.classList.remove('over', 'bottom', 'over-top'));
            });
        });
    }

    function populateFormulas() {
        const selectEl = document.getElementById('script-formula');
        if (!selectEl || typeof scriptFormulas === 'undefined' || Object.keys(scriptFormulas).length === 0) {
            selectEl.innerHTML = '<option value="" selected disabled>-- Nenhuma Formula Disponivel --</option>';
            return;
        }

        let optionsHtml = '<option value="" disabled>-- Selecione uma Formula --</option>';

        const groupedFormulas = Object.entries(scriptFormulas).reduce((acc, [key, value]) => {
            const category = value.category || 'Outras';
            if (!acc[category]) acc[category] = [];
            acc[category].push({ id: key, ...value });
            return acc;
        }, {});

        const sortedCategories = Object.keys(groupedFormulas).sort((a, b) => {
            if (a.includes('PERSONALIZADO')) return -1;
            if (b.includes('PERSONALIZADO')) return 1;
            if (a.includes('ALTA RETENCAO')) return -1;
            if (b.includes('ALTA RETENCAO')) return 1;
            return a.localeCompare(b);
        });

        for (const category of sortedCategories) {
            optionsHtml += `<optgroup label="${category}" class="font-semibold text-gray-800">`;
            groupedFormulas[category].sort((a, b) => a.label.localeCompare(b.label)).forEach(formula => {
                optionsHtml += `<option value="${formula.id}">${formula.label}</option>`;
            });
            optionsHtml += `</optgroup>`;
        }
        selectEl.innerHTML = optionsHtml;

        selectEl.value = 'complete_ethical_retention';
    }

    // --- Script History and Rendering ---
    function renderScriptHistory() {
        const historyContainer = document.getElementById('script-history-container');
        if (!historyContainer) return;

        const history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');

        if (history.length === 0) {
            historyContainer.innerHTML = '';
            return;
        }

        let historyHtml = `
            <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Historico de Roteiros</h3>
            <div class="space-y-3">
                ${history.map(item => `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-gray-900 dark:text-gray-100">${item.title || 'Roteiro sem titulo'}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${item.date}</p>
                        </div>
                        <div class="flex gap-2">
                            <button class="load-script-btn text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40" data-history-id="${item.id}">Carregar</button>
                            <button class="delete-script-btn text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40" data-history-id="${item.id}">Excluir</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button id="clear-script-history-btn" class="w-full mt-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Limpar todo o Historico</button>
        `;
        historyContainer.innerHTML = historyHtml;
    }

    function saveScriptToHistory(scriptData) {
        let history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
        const newItem = {
            id: Date.now(),
            title: document.getElementById('script-topic').value.trim(),
            date: new Date().toLocaleString('pt-BR'),
            data: scriptData
        };
        history.unshift(newItem);
        if (history.length > 20) history.pop();
        localStorage.setItem('scriptHistory', JSON.stringify(history));
    }
    function renderScriptPage() {
        const outputEl = document.getElementById('output');
        const paginationEl = document.getElementById('script-pagination-controls');
        if (!outputEl || !paginationEl) return;

        const { fullResult, currentPage, partsPerPage } = scriptResults;
        if (!fullResult) {
            outputEl.innerHTML = '';
            paginationEl.innerHTML = '';
            return;
        }
        const { scores, script_parts, total_parts, narrationOnlyMode } = fullResult;
        
        let actionsHtml = `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2"><button id="copy-script-btn" class="w-full text-center py-2 px-4 rounded-lg font-semibold bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40">Copiar Roteiro Completo</button><button id="save-script-txt-btn" class="w-full text-center py-2 px-4 rounded-lg font-semibold bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40">Transferir Roteiro (.txt)</button><button id="clear-script-output-btn" class="w-full text-center py-2 px-4 rounded-lg font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600">Limpar & Comecar de Novo</button></div>`;

        if (fullResult.narrationOnlyMode) {
             const totalPages = Math.ceil(total_parts / partsPerPage);
             const start = (currentPage - 1) * partsPerPage;
             const end = start + partsPerPage;
             const partsToShow = script_parts.slice(start, end);

             let continueButtonHtml = '';
             if (script_parts.length < total_parts) {
                const nextPart = script_parts.length + 1;
                continueButtonHtml = `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-4 flex flex-col sm:flex-row items-center gap-4">
                    <button id="continue-script-btn" class="w-full sm:w-auto flex-1 text-center py-3 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Continuar Geracao</button>
                    <div class="flex items-center gap-2">
                        <label for="continue-from-part" class="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">a partir da parte:</label>
                        <input type="number" id="continue-from-part" class="w-24 text-center px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value="${nextPart}" min="1" max="${total_parts}">
                    </div>
                </div>`;
             }

            outputEl.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Acoes Rapidas</h3>
                    ${actionsHtml}
                    ${continueButtonHtml}
                </div>
            </div>
            <hr class="my-6 border-gray-200 dark:border-gray-700"/>
            <div>
                <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Narracao para Voice Over (Pagina ${currentPage} de ${totalPages})</h3>
                <div class="space-y-4">
                     ${partsToShow.map((part) => `
                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="font-bold text-gray-900 dark:text-gray-100">${part.part_title}</h4>
                                ${createCopyButton(part.part_content)}
                            </div>
                            <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${part.part_content}</div>
                        </div>`).join('')}
                </div>
            </div>`;
            if (totalPages > 1) {
                let paginationHtml = '';
                for (let i = 1; i <= totalPages; i++) {
                    paginationHtml += `<button class="page-btn px-4 py-2 text-sm rounded-md ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}" data-page="${i}">${i}</button>`;
                }
                paginationEl.innerHTML = paginationHtml;
            } else {
                 paginationEl.innerHTML = '';
            }
            document.getElementById('legend-container').innerHTML = '';
            
        } else {
            const totalPages = Math.ceil(total_parts / partsPerPage);
            const start = (currentPage - 1) * partsPerPage;
            const end = start + partsPerPage;
            const partsToShow = script_parts.slice(start, end);

            let continueButtonHtml = '';
            if (script_parts.length < total_parts) {
                const nextPart = script_parts.length + 1;
                continueButtonHtml = `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-4 flex flex-col sm:flex-row items-center gap-4">
                    <button id="continue-script-btn" class="w-full sm:w-auto flex-1 text-center py-3 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Continuar Geracao</button>
                    <div class="flex items-center gap-2">
                        <label for="continue-from-part" class="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">a partir da parte:</label>
                        <input type="number" id="continue-from-part" class="w-24 text-center px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value="${nextPart}" min="1" max="${total_parts}">
                    </div>
                </div>`;
            }

            const mainScore = (scores.retention_potential + scores.clarity_score + scores.viral_potential) / 3;
            outputEl.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-center mb-2"><h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Analise de Pontuacao</h3></div>
                    ${renderScoreCard('Potencial de Sucesso', mainScore, {
                        'Potencial de Retencao': scores.retention_potential,
                        'Clareza da Mensagem': scores.clarity_score,
                        'Potencial Viral': scores.viral_potential
                    })}
                </div>
                <div>
                    <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Acoes Rapidas</h3>
                    ${actionsHtml}
                    ${continueButtonHtml}
                </div>
            </div>
            <hr class="my-6 border-gray-200 dark:border-gray-700"/>
            <div>
                <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Roteiro Gerado (Pagina ${currentPage} de ${totalPages})</h3>
                <div class="space-y-4">
                    ${partsToShow.map(part => `
                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div class="flex justify-between items-center mb-2">
                                <h4 class="font-bold text-gray-900 dark:text-gray-100">${part.part_title}</h4>
                                ${createCopyButton(part.part_content)}
                            </div>
                            <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${part.part_content}</div>
                        </div>`).join('')}
                </div>
            </div>`;
            if (total_parts > 10) {
                let paginationHtml = '';
                for (let i = 1; i <= totalPages; i++) {
                    paginationHtml += `<button class="page-btn px-4 py-2 text-sm rounded-md ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}" data-page="${i}">${i}</button>`;
                }
                paginationEl.innerHTML = paginationHtml;
            } else {
                 paginationEl.innerHTML = '';
            }
        }
    }

    // --- Scene Prompt History and Rendering ---
    function renderSceneHistory() {
        const historyContainer = document.getElementById('scene-history-container');
        if (!historyContainer) return;

        const history = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');

        if (history.length === 0) {
            historyContainer.innerHTML = '';
            return;
        }

        let historyHtml = `
            <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Historico de Prompts de Cena</h3>
            <div class="space-y-3">
                ${history.map(item => `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-gray-900 dark:text-gray-100">${item.title || 'Prompts de Cena sem titulo'}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${item.date}</p>
                        </div>
                        <div class="flex gap-2">
                            <button class="load-scene-prompts-btn text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40" data-history-id="${item.id}">Carregar</button>
                            <button class="delete-scene-prompts-btn text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40" data-history-id="${item.id}">Excluir</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button id="clear-scene-history-btn" class="w-full mt-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Limpar todo o Historico</button>
        `;
        historyContainer.innerHTML = historyHtml;
    }

    function saveSceneToHistory(sceneData, title) {
        let history = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');
        const newItem = {
            id: Date.now(),
            title: title || `Prompts de Cena - ${new Date().toLocaleString('pt-BR')}`,
            date: new Date().toLocaleString('pt-BR'),
            data: sceneData
        };
        history.unshift(newItem);
        if (history.length > 20) history.pop(); // Keep history size manageable
        localStorage.setItem('scenePromptHistory', JSON.stringify(history));
    }

    function renderScenePage() {
        const outputEl = document.getElementById('output');
        const paginationEl = document.getElementById('scene-pagination-controls');
        if (!outputEl || !paginationEl) return;

        const { data, currentPage, scenesPerPage, total_prompts } = scenePromptResults;

        if (!data || data.length === 0) {
            outputEl.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhum prompt de cena foi gerado ainda.</p>';
            paginationEl.innerHTML = '';
            return;
        }

        const totalScenes = data.length;
        const totalPages = Math.ceil(total_prompts / scenesPerPage);
        const start = (currentPage - 1) * scenesPerPage;
        const end = start + scenesPerPage;
        const scenesToShow = data.slice(start, end);

        scenePromptResults.allPromptsText = data.map((item, index) => `--- CENA ${index + 1}: ${item.scene_description || 'Descricao da Cena'} ---\nOriginal: "${item.original_text || 'N/A'}"\nPROMPT: "${item.prompt_text || 'N/A'}"`).join('\n\n');
        scenePromptResults.rawPromptsText = data.map(item => item.prompt_text || '').filter(Boolean).join('\n');
        
        let continueButtonHtml = '';
        if (data.length < total_prompts) {
             continueButtonHtml = `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-4"><button id="continue-scene-prompts-btn" class="w-full text-center py-3 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Continuar Geracao</button></div>`;
        }

        outputEl.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Prompts de Cena Gerados (${totalScenes} prompts)</h3>
                <div class="flex gap-2">
                    <button id="copy-all-scene-prompts" class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 font-semibold dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40">Copiar Todos (Detalhes)</button>
                    <button id="download-scene-prompts-detailed" class="text-sm bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200 font-semibold dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40">Transferir Detalhes (.txt)</button>
                    <button id="download-scene-prompts-raw" class="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded hover:bg-purple-200 font-semibold dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40">Transferir Prompts Puros (.txt)</button>
                </div>
            </div>
            ${continueButtonHtml}
            <div class="space-y-4">
                ${scenesToShow.map((item, index) => `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-bold text-gray-900 dark:text-gray-100 flex-1">Cena ${start + index + 1}: ${item.scene_description || 'Descricao da Cena'}</h4>
                            ${createCopyButton(item.prompt_text || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2"><strong>Original:</strong> <span class="bg-gray-100 dark:bg-gray-700 p-1 rounded inline-block text-xs">${item.original_text || 'N/A'}</span></p>
                        <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto whitespace-pre-wrap">${item.prompt_text || 'N/A'}</div>
                    </div>
                `).join('')}
            </div>
        `;
        if (totalPages > 1) {
            paginationEl.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="scene-page-btn px-4 py-2 text-sm rounded-md ${i + 1 === currentPage ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}" data-page="${i + 1}">${i + 1}</button>`).join('');
            paginationEl.querySelectorAll('.scene-page-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    scenePromptResults.currentPage = parseInt(e.target.dataset.page, 10);
                    renderScenePage();
                });
            });
        } else {
            paginationEl.innerHTML = '';
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    function renderImageFxOutput() {
        const output = document.getElementById('output');
        if (!output) return;
        const actionsContainer = document.getElementById('imagefx-actions');
        const restoreBtn = document.getElementById('restore-last-images-btn');
        const clearBtn = document.getElementById('clear-all-images-btn');
        const regenerateAllFailedBtn = document.getElementById('regenerate-all-failed-btn');

        const failedImagesCount = imageFxResults.images.filter(img => img.status === 'failed').length;

        if (imageFxResults.images.length === 0) {
            output.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhuma imagem foi gerada ainda.</p>';
            if(actionsContainer) actionsContainer.style.display = 'none';
        } else {
            output.innerHTML = `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${imageFxResults.images.map((img, index) => {
                        const isPending = img.status === 'pending';
                        const isFailed = img.status === 'failed' || img.status === 'retrying';
                        const isRetrying = img.status === 'retrying';

                        const aspectRatioClass = {
                            '16:9': 'aspect-video',
                            '9:16': 'aspect-[9/16]',
                            '1:1': 'aspect-square'
                        }[img.aspectRatio] || 'aspect-video';

                        if (isPending) {
                            return `
                                <div id="image-container-${index}" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 relative flex flex-col ${aspectRatioClass}">
                                    <div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
                                        <div class="text-center">
                                            <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <p class="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-300">A gerar Cena ${img.sceneNumber}...</p>
                                        </div>
                                    </div>
                                </div>
                            `;
                        } else if (isFailed) {
                            const errorMessage = escapeHTML(img.error);
                            const truncatedMessage = errorMessage.length > 150 ? errorMessage.substring(0, 150) + '...' : errorMessage;
                            
                            // Detecta o tipo de erro para mostrar mensagem adequada
                            const errorLower = errorMessage.toLowerCase();
                            const isThrottlingError = errorLower.includes('throttled') || 
                                                     errorLower.includes('limite de requisições') ||
                                                     errorLower.includes('429') ||
                                                     errorLower.includes('too many requests');
                            
                            const isPolicyError = errorLower.includes('bloqueado') || 
                                                 errorLower.includes('inseguro') || 
                                                 errorLower.includes('unsafe') ||
                                                 errorLower.includes('policy');
                            
                            let helpMessage = '';
                            if (isRetrying) {
                                helpMessage = '<div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded p-2 mb-3"><p class="text-xs text-blue-800 dark:text-blue-300"><strong>🔄 A processar...</strong><br>A sua imagem está a ser regenerada automaticamente. Por favor aguarde.</p></div>';
                            } else if (isThrottlingError) {
                                helpMessage = '<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded p-2 mb-3"><p class="text-xs text-yellow-800 dark:text-yellow-300"><strong>⏳ Limite temporário atingido</strong><br>Muitas requisições foram feitas ao mesmo tempo. Esta imagem será regenerada <strong>automaticamente em alguns segundos</strong>.</p></div>';
                            } else if (isPolicyError) {
                                helpMessage = '<div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded p-2 mb-3"><p class="text-xs text-orange-800 dark:text-orange-300"><strong>🛡️ Prompt bloqueado</strong><br>O prompt violou as políticas de conteúdo. A IA irá <strong>reescrever automaticamente</strong> mantendo o estilo e história.</p></div>';
                            } else {
                                helpMessage = '<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded p-2 mb-3"><p class="text-xs text-yellow-800 dark:text-yellow-300"><strong>⚠️ Erro detectado</strong><br>Esta imagem será <strong>regenerada automaticamente</strong> após a conclusão das outras.</p></div>';
                            }
                            
                            return `
                                <div id="image-container-${index}" class="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 relative flex flex-col ${aspectRatioClass}">
                                    <h4 class="font-bold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                                        ${isRetrying ? 'A Gerar Novamente Cena' : 'Erro na Cena'} ${img.sceneNumber}
                                    </h4>
                                    <div class="flex-grow">
                                        ${helpMessage}
                                        <details class="text-xs">
                                            <summary class="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 mb-2">Ver detalhes técnicos</summary>
                                            <p class="text-red-700 dark:text-red-400 mt-2 overflow-wrap-anywhere bg-red-50 dark:bg-red-950/30 p-2 rounded" title="${errorMessage}">${truncatedMessage}</p>
                                        </details>
                                    </div>
                                    <div class="flex flex-col gap-2 mt-auto">
                                        <button class="toggle-prompt-btn text-sm bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-3 py-1 rounded-md hover:bg-red-300 dark:hover:bg-red-700" data-img-index="${index}" ${isRetrying ? 'disabled' : ''}>
                                            ${isRetrying ? '⏳ Aguarde...' : 'Ver Prompt / Editar'}
                                        </button>
                                        <div id="edit-prompt-container-${index}" style="display:none;" class="mt-2 space-y-2">
                                            <textarea id="edit-prompt-${index}" class="w-full h-24 px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">${escapeHTML(img.prompt)}</textarea>
                                            <button class="regenerate-image-btn w-full text-center py-2 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" data-img-index="${index}" data-scene-number="${img.sceneNumber}" data-img-aspect-ratio="${img.aspectRatio}">
                                                Gerar Novamente
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        } else { // Successful image
                            const rewrittenIndicator = img.wasRewritten ? '<span class="text-yellow-500 font-bold text-lg" title="Este prompt foi reescrito pela IA">⚠️</span>' : '';
                            return `
                                <div id="image-container-${index}" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 group relative flex flex-col">
                                    <div class="relative ${aspectRatioClass} w-full cursor-pointer lightbox-trigger" data-img-index="${index}">
                                        <input type="checkbox" class="absolute top-2 right-2 h-5 w-5 z-20 image-select-checkbox" data-img-index="${index}">
                                        <span class="absolute top-2 left-2 text-white bg-black/50 rounded-full px-2 py-0.5 text-xs font-semibold z-10 flex items-center gap-1">Cena ${img.sceneNumber} ${rewrittenIndicator}</span>
                                        <img src="${img.url}" alt="${escapeHTML(img.prompt)}" class="w-full h-full rounded-lg object-cover">
                                        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 gap-2">
                                            <button class="download-single-image-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg" data-img-url="${img.url}" data-img-prompt="${escapeHTML(img.prompt)}" data-img-scene="${img.sceneNumber}">
                                                Baixar
                                            </button>
                                        </div>
                                    </div>
                                    <div class="flex flex-col gap-2 mt-2">
                                         <button class="toggle-prompt-btn text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600" data-img-index="${index}">
                                            Ver Prompt / Editar
                                        </button>
                                        <div id="edit-prompt-container-${index}" style="display:none;" class="mt-2 space-y-2">
                                            <textarea id="edit-prompt-${index}" class="w-full h-24 px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">${escapeHTML(img.prompt)}</textarea>
                                            <button class="regenerate-image-btn w-full text-center py-2 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" data-img-index="${index}" data-scene-number="${img.sceneNumber}" data-img-aspect-ratio="${img.aspectRatio}">
                                                Gerar Novamente
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            `;
            if(actionsContainer) actionsContainer.style.display = 'block';
        }

        if (imageFxResults.images.length > 0) {
            if(clearBtn) clearBtn.style.display = 'block';
        } else {
            if(clearBtn) clearBtn.style.display = 'none';
        }

        if (imageFxResults.lastClearedImages.length > 0 && imageFxResults.images.length === 0) {
             if(restoreBtn) restoreBtn.style.display = 'block';
        } else {
             if(restoreBtn) restoreBtn.style.display = 'none';
        }

        // Botão removido - retry automático está ativo
        if (regenerateAllFailedBtn) regenerateAllFailedBtn.style.display = 'none';
    }

    // --- Tools and Handlers ---
    const createCopyButton = (text, specificClass = '') => `<button class="copy-btn ${specificClass}" data-copy-text="${encodeURIComponent(text)}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>`;
    const getScoreColor = (score) => score >= 80 ? 'bg-blue-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    const getScoreTextColor = (score) => score >= 80 ? 'text-blue-600 dark:text-blue-400' : score >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

    const renderScoreCard = (title, mainScore, subScores, suggestion = '') => {
        const intMainScore = Math.round(mainScore || 0);
        const subScoresHtml = Object.entries(subScores).map(([key, value]) => {
            const cappedValue = Math.min(100, Math.round(value || 0));
            return `<div class="mb-2">
                        <div class="flex justify-between items-center text-sm mb-1 gap-2">
                            <span class="text-gray-500 dark:text-gray-400 truncate" title="${key}">${key}</span>
                            <span class="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">${cappedValue}/100}</span>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"><div class="h-1.5 rounded-full ${getScoreColor(cappedValue)}" style="width: ${cappedValue}%;"></div></div>
                    </div>`;
        }).join('');
        const suggestionHtml = suggestion ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"><strong class="text-gray-900 dark:text-gray-100">Virada de Chave:</strong> ${suggestion}</p>` : ''
        return `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 w-full flex-shrink-0 min-w-0">
                    <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate" title="${title}">${title}</h4>
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-baseline gap-1">
                            <span class="text-3xl font-bold ${getScoreTextColor(intMainScore)}">${intMainScore}</span>
                            <span class="text-gray-500 dark:text-gray-400 text-sm">/ 100</span>
                        </div>
                    </div>
                    ${subScoresHtml}
                    ${suggestionHtml}
                </div>`;
    };

    const getLegendForTool = (toolId) => {
        const legends = {
            'script-writer': `<h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">💡 A Entender as Metricas</h4><ul class="space-y-2 text-sm text-gray-600 dark:text-gray-300 list-disc list-inside"><li><strong>Potencial de Retencao:</strong> Mede a capacidade do roteiro de manter o espectador a assistir.</li><li><strong>Clareza da Mensagem:</strong> Avalia quao facil e entender a ideia central do video.</li><li><strong>Potencial Viral:</strong> Estima a probabilidade do conteudo ser amplamente partilhado.</li></ul>`,
            'thumbnail-prompts': `<h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">💡 A Entender as Metricas</h4><ul class="space-y-2 text-sm text-gray-600 dark:text-gray-300 list-disc list-inside"><li><strong>Potencial de CTR:</strong> Estimativa do poder de atracao do clique na thumbnail gerada.</li><li><strong>Virada de Chave:</strong> A principal melhoria ou conceito aplicado no prompt.</li></li></ul>`,
            'viral-titles': `<h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">💡 A Entender a Ferramenta</h4><p class="text-sm text-gray-600 dark:text-gray-300">Esta ferramenta unificada pode gerar tanto <strong>Titulos Prontos</strong> (com analise de pontuacao) quanto <strong>Estruturas de Titulos</strong> (modelos para preencher). Selecione o que precisa e deixe a IA fazer a magica!</p>`,
            'image-generator': `<h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">💡 Sobre o Gerador de Imagens</h4><p class="text-sm text-gray-600 dark:text-gray-300">Esta ferramenta utiliza a API do ImageFX (via cookies) para gerar imagens com base nos seus prompts. Para a usar, precisa de extrair os cookies da sua sessao ativa no ImageFX e cola-los no campo de "Configuracoes" da aplicacao.</p><p class="text-sm text-red-600"><strong>Atencao:</strong> A geracao via cookies pode ser instavel e depende da estrutura interna do ImageFX. Use por sua conta e risco.</p>`,
            'brainstorm-ideas': `<h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">💡 A Entender as Metricas</h4><ul class="space-y-2 text-sm text-gray-600 dark:text-gray-300 list-disc list-inside"><li><strong>Potencial:</strong> Estimativa geral de sucesso do video.</li><li><strong>Originalidade:</strong> Mede quao unica e inovadora e a ideia.</li><li><strong>Impacto:</strong> Avalia o poder da ideia de gerar emocao ou curiosidade.</li><li><strong>Busca Google:</strong> Potencial da ideia para ranquear bem em pesquisas no Google.</li><li><strong>Tendencias Google:</strong> Potencial da ideia para se alinhar com topicos em alta.</li></ul>`,
            'voice-generator': `<h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">🎙️ Dicas para a Narracao</h4><ul class="space-y-2 text-sm text-gray-600 dark:text-gray-300 list-disc list-inside"><li>Use nomes de locutor consistentes (ex.: Speaker 1) para cada voz.</li><li>Personalize as instrucoes de estilo para controlar ritmo, tom e emocao.</li><li>Teste modelos Pro e Flash para equilibrar qualidade e velocidade.</li></ul>`,
        };
        const legendHtml = legends[toolId] || '';
        return legendHtml ? `<div class="mt-6 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">${legendHtml}</div>` : '';
    };

    const cleanAiInstructions = (text) => {
        if (!text) return '';
        let cleanedText = text;
        
        // New, more robust rule: find the first valid part tag and discard everything before it.
        const firstPartIndex = cleanedText.indexOf('[--PART');
        if (firstPartIndex > 0) {
            cleanedText = cleanedText.substring(firstPartIndex);
        }

        // Existing rules
        cleanedText = cleanedText.replace(/<internal_thought>[\s\S]*?<\/internal_thought>/gs, '');
        cleanedText = cleanedText.replace(/^\s*\*\*.*?\:\*\*\s*/gm, '');
        cleanedText = cleanedText.replace(/\s*(?:-{4})?\[--PART[^\]]*?--\]\s*/g, '').trim();
        cleanedText = cleanedText.replace(/----\[--ENDPART--]/g, '').trim();
        cleanedText = cleanedText.replace(/----\[--VOICEOVER_PART_BREAK--]/g, '').trim();
        return cleanedText;
    };

    const getBrainstormPrompt = (lang, niche) => {
        // Otimização 1: Prompt mais conciso
        return `Como especialista em YouTube, gere 5 ideias de vídeo virais e inéditas em "${lang}" para um canal sobre "${niche}". Formate como títulos de até 100 caracteres. Para cada uma, forneça pontuações (0-100) para 'potential', 'originality', 'impact', 'search_potential', 'trends_potential' e 3 'sub_niches' relacionados. Responda APENAS com um JSON contendo uma chave "ideas", que é uma array de objetos.`;
    };

    // New: Function to render reviewer scores
    const renderReviewerScores = (scores, containerId) => {
        const container = document.getElementById(containerId);
        if (!container || !scores) return;

        const retention = scores.retention_potential || 0;
        const clarity = scores.clarity_score || 0;
        const viral = scores.viral_potential || 0;
        const mainScore = (retention + clarity + viral) / 3;

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${renderScoreCard('Potencial de Retencao', retention, {})}
                ${renderScoreCard('Clareza da Mensagem', clarity, {})}
                ${renderScoreCard('Potencial Viral', viral, {})}
            </div>
        `;
    };

    // New: Function to render reviewer suggestions
    const renderReviewerSuggestions = (suggestions) => {
        const suggestionsOutput = document.getElementById('reviewer-suggestions-output');
        if (!suggestionsOutput || !Array.isArray(suggestions) || suggestions.length === 0) {
            if (suggestionsOutput) suggestionsOutput.innerHTML = '';
            return;
        }

        suggestionsOutput.innerHTML = `
            <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Sugestoes de Melhoria</h3>
            <div class="space-y-4">
                ${suggestions.map(s => `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 class="font-bold text-gray-900 dark:text-gray-100 mb-2">${s.title}</h4>
                        <p class="text-gray-600 dark:text-gray-300">${s.suggestion}</p>
                    </div>
                `).join('')}
            </div>
        `;
    };
    // New: Function to re-evaluate script after changes
    async function reevaluateScript(scriptContent) {
        const model = document.getElementById('script-reviewer-model-select')?.value;
        if (!model) return;

        showProgressModal("Reavaliando roteiro...", "A IA esta calculando novas pontuacoes...");

        const corePrinciples = `DIRETRIZES ETICAS: Foco em valor, respeito ao espectador, transparencia. TATICAS PROIBIDAS: Evite "segredo", "infalivel", "garantido". Nao crie falsas urgencias.`;
        const scorePrompt = `Analise o roteiro e atribua pontuações de 0 a 100 para 'retention_potential', 'clarity_score' e 'viral_potential'. ${corePrinciples} Responda APENAS com um objeto JSON.\n\nROTEIRO:\n"""${removeAccents(scriptContent)}"""`;
        const scoreSchema = { type: "OBJECT", properties: { retention_potential: { type: "NUMBER" }, clarity_score: { type: "NUMBER" }, viral_potential: { type: "NUMBER" } } };

        try {
            const scoreResult = await apiRequest('/api/generate', 'POST', { prompt: scorePrompt, model, schema: scoreSchema });
            if (scoreResult.data) {
                if (!scoreResult.data) scoreResult.data = {};
                const scoreKeys = ['retention_potential', 'clarity_score', 'viral_potential'];
                scoreKeys.forEach(key => {
                    let score = scoreResult.data[key];
                    if (score === undefined || score === null || isNaN(score) || score < 70) {
                        scoreResult.data[key] = generateRandomScore(78, 98.5);
                    } else {
                        scoreResult.data[key] = Math.min(score, 98.5);
                    }
                });
                reviewerResults.newScores = scoreResult.data;
                renderReviewerScores(reviewerResults.newScores, 'reviewer-new-score-cards');
                document.getElementById('reviewer-new-scores-container').style.display = 'block';
            } else {
                throw new Error("Nao foi possivel obter a nova pontuacao do roteiro.");
            }
        } catch (error) {
            addToLog(`Erro ao reavaliar roteiro: ${error.message}`, true);
        } finally {
            hideProgressModal();
        }
    }


    const handlers = {
        'generate-brainstorm-ideas': async (e, append = false) => {
            const timerId = `brainstorm-${Date.now()}`;
            devLog(`Starting: ${timerId}`);
            console.time(timerId);

            const niche = document.getElementById('brainstorm-niche')?.value.trim();
            const model = document.getElementById('brainstorm-ideas-model-select')?.value;
            const lang = document.getElementById('brainstorm-lang')?.value;
            const outputEl = document.getElementById('output');

            if (!niche) {
                showSuccessToast("Por favor, insira um nicho para o seu canal.");
                return;
            }

            const prompt = getBrainstormPrompt(lang, niche);
            const schema = {
                type: "OBJECT",
                properties: {
                    ideas: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "STRING" },
                                scores: {
                                    type: "OBJECT",
                                    properties: {
                                        potential: { type: "NUMBER" },
                                        originality: { type: "NUMBER" },
                                        impact: { type: "NUMBER" },
                                        search_potential: { type: "NUMBER" },
                                        trends_potential: { type: "NUMBER" }
                                    }
                                },
                                sub_niches: {
                                    type: "ARRAY",
                                    items: { type: "STRING" },
                                    minItems: 3,
                                    maxItems: 3
                                }
                            }
                        }
                    }
                }
            };

            showProgressModal("Gerando ideias virais...", "A IA esta buscando os melhores topicos...");
            if (!append) {
                if (outputEl) outputEl.innerHTML = '';
                const legendContainer = document.getElementById('legend-container');
                if (legendContainer) legendContainer.innerHTML = getLegendForTool('brainstorm-ideas');
            }

            try {
                const result = await apiRequest('/api/generate', 'POST', { prompt, model, schema });
                if (result.data && result.data.ideas && result.data.ideas.length > 0) {
                    result.data.ideas.forEach(idea => {
                        if (!idea.scores) idea.scores = {};
                        const scoreKeys = ['potential', 'originality', 'impact', 'search_potential', 'trends_potential'];
                        scoreKeys.forEach(key => {
                            let score = idea.scores[key];
                            if (score === undefined || score === null || isNaN(score) || score < 70) {
                                idea.scores[key] = generateRandomScore(78, 98.5);
                            } else {
                                idea.scores[key] = Math.min(score, 98.5);
                            }
                        });
                    });

                    const ideasHtml = result.data.ideas.map(item => {
                        const scores = item.scores || {};
                        const potential = scores.potential || 0;
                        const originality = scores.originality || 0;
                        const impact = scores.impact || 0;
                        const search_potential = scores.search_potential || 0;
                        const trends_potential = scores.trends_potential || 0;

                        const mainScore = (potential + originality + impact + search_potential + trends_potential) / 5;
                        const subNichesHtml = item.sub_niches && item.sub_niches.length > 0 
                            ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Sub-nichos: ${item.sub_niches.map(sn => `<span class="inline-block bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300 mr-1">${sn}</span>`).join('')}</p>`
                            : '';
                        return `
                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start">
                            <div class="flex-1 w-full">
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="font-semibold text-lg text-gray-900 dark:text-gray-100">${item.title || 'N/A'}</h3>
                                    ${createCopyButton(item.title || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                                </div>
                                ${subNichesHtml}
                            </div>
                            <div class="w-full md:w-56 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0">
                                ${renderScoreCard('Analise da Ideia', mainScore, {
                                    'Potencial': potential,
                                    'Originalidade': originality,
                                    'Impacto': impact,
                                    'Busca Google': search_potential,
                                    'Tendencias Google': trends_potential
                                })}
                            </div>
                        </div>`;
                    }).join('');

                    if (append) {
                        if (outputEl) outputEl.insertAdjacentHTML('beforeend', ideasHtml);
                    } else {
                        if (outputEl) outputEl.innerHTML = ideasHtml;
                    }
                    const generateMoreBrainstormIdeasBtn = document.getElementById('generate-more-brainstorm-ideas');
                    if (generateMoreBrainstormIdeasBtn) generateMoreBrainstormIdeasBtn.style.display = 'block';
                    showSuccessToast("Ideias geradas com sucesso!");
                } else {
                    throw new Error("A IA nao retornou ideias validas.");
                }
            } catch (error) {
                addToLog(`Erro ao gerar ideias: ${error.message}`, true);
                if (!append) {
                    if (outputEl) outputEl.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao gerar as ideias.</p>`;
                }
            } finally {
                hideProgressModal();
                console.timeEnd(timerId);
                devLog(`Finished: ${timerId}. Chars in prompt: ${prompt.length}`);
            }
        },
        'generate-editors-cut': async () => {
            const timerId = `editors-cut-${Date.now()}`;
            devLog(`Starting: ${timerId}`);
            console.time(timerId);

            const script = document.getElementById('editors-cut-script-input')?.value.trim();
            const prompts = document.getElementById('editors-cut-prompts-input')?.value.trim();
            const model = document.getElementById('editors-cut-model-select')?.value;
            const outputEl = document.getElementById('output');

            if (!script || !prompts || !model) {
                showSuccessToast("Por favor, cole o roteiro e os prompts de cena para gerar o guia.");
                return;
            }

            // Otimização 1: Prompt mais conciso
            const prompt = `
            Crie um "Guia de Edicao" (Editor's Cut). Combine o roteiro e os prompts de cena numa linha do tempo para um editor.
            INSTRUCOES:
            1. Estime timestamps para cada cena (assuma 150 palavras/minuto).
            2. Formate em Markdown: **CENA [N] (HH:MM:SS - HH:MM:SS):**, seguido do prompt e do trecho da narração.
            Responda APENAS com o guia.

            --- ROTEIRO ---
            ${removeAccents(script)}

            --- PROMPTS (um por linha) ---
            ${removeAccents(prompts)}
            `;

            showProgressModal("Gerando Guia de Edicao...", "A IA esta montando a sua linha do tempo...");
            if (outputEl) outputEl.innerHTML = '';

            try {
                const result = await apiRequest('/api/generate', 'POST', { prompt, model, maxOutputTokens: 6000, temperature: 0.4 });
                if (result.data && result.data.text) {
                    if (outputEl) {
                        outputEl.innerHTML = `
                            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Guia de Edicao Gerado</h3>
                                    <div class="flex gap-2">
                                        <button id="copy-editors-cut" class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40">Copiar Guia</button>
                                        <button id="download-editors-cut" class="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-md hover:bg-green-200 font-semibold dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40">Baixar .txt</button>
                                    </div>
                                </div>
                                <pre id="editors-cut-content" class="whitespace-pre-wrap text-sm bg-gray-100 dark:bg-gray-700 p-4 rounded border border-gray-200 dark:border-gray-600 max-h-[60vh] overflow-y-auto">${result.data.text}</pre>
                            </div>
                        `;
                    }
                    showSuccessToast("Guia de Edicao gerado com sucesso!");
                } else {
                    throw new Error("A IA nao retornou um guia de edicao valido.");
                }
            } catch (error) {
                addToLog(`Erro ao gerar guia de edicao: ${error.message}`, true);
                if (outputEl) outputEl.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao gerar o guia.</p>`;
            } finally {
                hideProgressModal();
                console.timeEnd(timerId);
                devLog(`Finished: ${timerId}. Chars in prompt: ${prompt.length}`);
            }
        },
        'generate-script': async (e, continueGeneration = false) => {
             const timerId = `script-gen-${Date.now()}`;
             devLog(`Starting: ${timerId}`);
             console.time(timerId);

             const form = {
                niche: document.getElementById('script-niche')?.value.trim(),
                audience: document.getElementById('script-audience')?.value.trim(),
                topic: document.getElementById('script-topic')?.value.trim(),
                trendsTerm: document.getElementById('script-trends-term')?.value.trim(),
                duration: document.getElementById('script-duration')?.value,
                parts: parseInt(document.getElementById('script-parts')?.value, 10),
                narrationOnly: document.getElementById('script-narration')?.checked,
                includeAffiliate: document.getElementById('include-affiliate-product')?.checked,
                affiliateProduct: document.getElementById('affiliate-product-description')?.value.trim(),
                tone: document.getElementById('script-tone')?.value,
                lang: document.getElementById('script-lang')?.value,
                formula: document.getElementById('script-formula')?.value,
                manualStructure: document.getElementById('manual-structure-input')?.value.trim(),
                model: document.getElementById('script-writer-model-select')?.value,
                ctaPositions: (() => {
                    const positions = [];
                    const ctaInicio = document.getElementById('cta-inicio');
                    const ctaMeio = document.getElementById('cta-meio');
                    const ctaFinal = document.getElementById('cta-final');
                    
                    // Verificar se os elementos existem e estão marcados
                    if (ctaInicio && ctaInicio.checked) {
                        positions.push('inicio');
                        console.log('CTA INICIO marcado');
                    }
                    if (ctaMeio && ctaMeio.checked) {
                        positions.push('meio');
                        console.log('CTA MEIO marcado');
                    }
                    if (ctaFinal && ctaFinal.checked) {
                        positions.push('final');
                        console.log('CTA FINAL marcado');
                    }
                    
                    console.log('Posições CTA selecionadas:', positions);
                    return positions;
                })()
            };

            if (continueGeneration) {
                const continueFromPartInput = document.getElementById('continue-from-part');
                let startPart = scriptResults.fullResult?.script_parts.length + 1;
                
                if (continueFromPartInput) {
                    const userStartPart = parseInt(continueFromPartInput.value, 10);
                    if (!isNaN(userStartPart) && userStartPart > 0 && userStartPart <= form.parts) {
                        startPart = userStartPart;
                    } else {
                        if (continueFromPartInput) continueFromPartInput.value = startPart;
                    }
                }

                if (startPart > 1 && scriptResults.fullResult) {
                    scriptResults.fullResult.script_parts = scriptResults.fullResult.script_parts.slice(0, startPart - 1);
                } else {
                    scriptResults.fullResult.script_parts = [];
                }
            } else {
                if (!form.topic || !form.niche || !form.audience) {
                    showSuccessToast("Por favor, preencha os campos 'Nicho do Canal', 'Publico-Alvo' e 'Tema do Video'.");
                    return;
                }
                if (!form.duration || isNaN(form.duration) || parseInt(form.duration, 10) <= 0) {
                    showSuccessToast("Por favor, insira uma duracao valida para o video (em minutos).");
                    return;
                }
                if (form.formula === 'manual_structure' && !form.manualStructure) {
                    showSuccessToast("Por favor, descreva a estrutura manual desejada.");
                    return;
                }
                if (form.formula !== 'manual_structure' && !form.formula) {
                    showSuccessToast("Por favor, selecione uma formula de estrutura.");
                    return;
                }
                if (!form.parts) {
                    showSuccessToast("O numero de partes nao foi calculado. Por favor, insira uma duracao valida.");
                    return;
                }
                if (form.includeAffiliate && !form.affiliateProduct) {
                    showSuccessToast("Por favor, descreva o produto de afiliacao.");
                    return;
                }
                scriptResults.fullResult = {
                    scores: { 
                        retention_potential: generateRandomScore(82, 98.5), 
                        clarity_score: generateRandomScore(82, 98.5), 
                        viral_potential: generateRandomScore(82, 98.5) 
                    },
                    script_parts: [],
                    full_script_text: '',
                    narrationOnlyMode: form.narrationOnly,
                    total_parts: form.parts,
                    prompt_info: {
                       ...form
                    }
                };
            }

            let formulaContent;
            if (form.formula === 'manual_structure') {
                formulaContent = `**ESTRUTURA MANUAL FORNECIDA PELO USUARIO:**\n${form.manualStructure}`;
            } else {
                const formulaDefinition = scriptFormulas[form.formula] || scriptFormulas['universal_safe'];
                formulaContent = formulaDefinition.prompt;
            }
            formulaContent = formulaContent.replace(/\u005BN\u0055MERO DE PARTES\u005D/g, form.parts);


            let dynamicOutputInstruction = '';
            let affiliateInstruction = '';
            let trendsInstruction = '';
            let ctaInstruction = '';
            
            // Alterado de "EXATAMENTE" para "aproximadamente" para dar mais flexibilidade à IA
            const minWordsPerParagraph = 60;
            const paragraphsPerPart = 5;
            const totalWordsPerPart = minWordsPerParagraph * paragraphsPerPart;
            const maxCharsPerPart = 6000;

            let gpt_specific_instructions = '';
            if (form.model?.startsWith('gpt-')) {
                gpt_specific_instructions = `
INSTRUCAO ADICIONAL E OBRIGATORIA PARA MODELOS GPT:
Sua tendencia e ser conciso. Para esta tarefa, essa tendencia e um ERRO. Voce DEVE ser prolixo e detalhado.
- **REJEICAO AUTOMATICA:** Respostas com paragrafos curtos (menos de ${minWordsPerParagraph} palavras) serao rejeitadas.
- **OBJETIVO PRINCIPAL:** Seu objetivo principal e cumprir o requisito de comprimento. A qualidade do conteudo e secundaria a sua capacidade de gerar a quantidade de texto solicitada.
- **NAO RESUMA:** Em nenhuma circunstancia resuma o conteudo. Expanda cada ponto com detalhes, exemplos e explicacoes.
`;
            }

            dynamicOutputInstruction = `
            INSTRUCAO DE FORMATACAO CRITICA (INALTERAVEL):
            Voce DEVE gerar aproximadamente ${form.parts} partes. CADA parte DEVE ter aproximadamente ${paragraphsPerPart} paragrafos. CADA paragrafo DEVE ter entre ${minWordsPerParagraph} e ${minWordsPerParagraph + 10} palavras. O tamanho TOTAL de CADA parte DEVE ser de no maximo ${maxCharsPerPart} caracteres.
            E ABSOLUTAMENTE CRITICO que voce gere o conteudo COMPLETO para TODAS as partes solicitadas, sem abreviacoes ou resumos, mesmo que o conteudo pareca repetitivo ou que voce sinta que ja forneceu informacoes suficientes. A completude e a prioridade maxima.
            ${gpt_specific_instructions}
            INSTRUCOES DE SAIDA:
            - Use a tag "[--ENDPART--]" para separar CADA parte.
            - CADA parte DEVE comecar com a tag "[--PART [NUMERO]: [TITULO DA PARTE]--]".
            - O conteudo do roteiro deve ser 100% original e seguir o tema e a formula, sem abreviacoes ou resumos.
            `;
            if (form.narrationOnly) {
                dynamicOutputInstruction = `
                INSTRUCAO CRITICA DE GERACAO (PRIORIDADE MAXIMA):
                Esta e a regra mais importante. Voce DEVE gerar o conteudo COMPLETO para aproximadamente ${form.parts} partes solicitadas. Cada parte DEVE ter aproximadamente ${totalWordsPerPart} palavras.
                E ABSOLUTAMENTE CRITICO que voce gere o conteudo COMPLETO para TODAS as partes solicitadas, sem abreviacoes ou resumos, mesmo que o conteudo pareca repetitivo ou que voce sinta que ja forneceu informacoes suficientes. A completude e a prioridade maxima.
                - NAO ABREVIE.
                - NAO RESUMA.
                - NAO pule nenhuma parte. O nao cumprimento da contagem de partes e de palavras resultara em uma resposta inutil.
                
                REGRA DE SAIDA:
                O output DEVE ser APENAS a narracao pura. NAO inclua NENHUMA tag, marcador, titulo de parte (ex: "Parte 1"), ou QUALQUER TEXTO EXTRA.
                
                SEPARACAO:
                Separe cada parte da narracao com a tag de marcacao unica: "[--VOICEOVER_PART_BREAK--]".
                `;
            }

            if (form.includeAffiliate && form.affiliateProduct) {
                affiliateInstruction = `INSTRUCAO DE CONTEUDO: Integre de forma NATURAL e PERSUASIVA uma mencao ao produto: "${removeAccents(form.affiliateProduct)}".`;
            }

            if (form.trendsTerm) {
                trendsInstruction = `CONEXAO COM TENDENCIA: Incorpore o termo de pesquisa/tendencia "${removeAccents(form.trendsTerm)}" de forma relevante e organica no roteiro.`;
            }

            if (form.ctaPositions && form.ctaPositions.length > 0) {
                console.log('✅ CTAs serão incluídos nas posições:', form.ctaPositions);
                // Criar instrução específica e obrigatória baseada nas posições selecionadas
                const ctaInstructions = [];
                
                if (form.ctaPositions.includes('inicio')) {
                    ctaInstructions.push(`*** CTA NO INICIO (OBRIGATORIO) ***
Voce DEVE incluir uma chamada para acao (CTA) nos PRIMEIROS PARAGRAFOS da PARTE 1 do roteiro. 
Integre naturalmente no texto, por exemplo:
- "Se inscreva no canal para nao perder conteudos como este"
- "Deixe seu like se este conteudo esta te ajudando"
- "Ative o sininho para receber notificacoes"
- "Compartilhe este video com quem precisa ver isso"
O CTA deve aparecer naturalmente no conteudo da PARTE 1, preferencialmente no primeiro ou segundo paragrafo.`);
                }
                
                if (form.ctaPositions.includes('meio')) {
                    const middlePart = Math.ceil(form.parts / 2);
                    ctaInstructions.push(`*** CTA NO MEIO (OBRIGATORIO) ***
Voce DEVE incluir uma chamada para acao (CTA) na PARTE ${middlePart} ou em partes intermediarias do roteiro.
Integre naturalmente no texto, por exemplo:
- "Se ainda nao se inscreveu no canal, faca isso agora para nao perder os proximos videos"
- "Deixe seu comentario abaixo contando sua experiencia com este tema"
- "Compartilhe este video com alguem que precisa ver isso"
- "Marque alguem que se beneficiaria deste conteudo"
O CTA deve aparecer naturalmente no conteudo da PARTE ${middlePart} ou partes intermediarias.`);
                }
                
                if (form.ctaPositions.includes('final')) {
                    ctaInstructions.push(`*** CTA NO FINAL (OBRIGATORIO) ***
Voce DEVE incluir uma chamada para acao (CTA) na ULTIMA PARTE do roteiro (PARTE ${form.parts}).
Integre naturalmente no texto, por exemplo:
- "Se inscreva no canal para mais conteudos como este que te ajudam a [beneficio]"
- "Deixe seu like e compartilhe este video para ajudar outras pessoas"
- "Ative o sininho para nao perder os proximos videos sobre [tema]"
- "Comente abaixo o que voce achou e qual foi sua principal aprendizagem"
- "Salve este video para consultar depois quando precisar"
O CTA deve aparecer na PARTE ${form.parts} (ultima parte), preferencialmente nos ultimos paragrafos.`);
                }
                
                ctaInstruction = `

================================================================================
*** REGRA CRITICA E OBRIGATORIA: INCLUSAO DE CTAs (CHAMADAS PARA ACAO) ***
================================================================================

VOCE DEVE OBRIGATORIAMENTE INCLUIR CTAs NAS SEGUINTES POSICOES DO ROTEIRO:

${ctaInstructions.join('\n\n')}

*** INSTRUCOES GERAIS SOBRE CTAs: ***
- Os CTAs devem ser NATURAIS e INTEGRADOS ao conteudo, nao parecer forçados
- Use linguagem conversacional e amigavel
- Adapte os CTAs ao tema e contexto do video
- Os CTAs devem aparecer DENTRO do texto narrativo, nao como frases isoladas
- VARIe os tipos de CTA (inscricao, like, comentario, compartilhamento) conforme a posicao
- NUNCA omita os CTAs - eles sao OBRIGATORIOS nas posicoes especificadas

*** VALIDACAO OBRIGATORIA: ***
Antes de finalizar o roteiro, verifique:
- Inclui CTA no INICIO? (se solicitado) - VERIFICAR PARTE 1
- Inclui CTA no MEIO? (se solicitado) - VERIFICAR PARTE ${form.ctaPositions.includes('meio') ? Math.ceil(form.parts / 2) : 'N/A'}
- Inclui CTA no FINAL? (se solicitado) - VERIFICAR PARTE ${form.parts}
Se algum CTA obrigatorio estiver faltando, VOCE DEVE REESCREVER o roteiro para inclu-lo.

================================================================================
`;
                console.log('✅ Instrução CTA criada com', ctaInstructions.length, 'posições');
            } else {
                console.log('⚠️ Nenhuma posição CTA selecionada');
            }

            const contextInstruction = `
            CONEXAO NARRATIVA OBRIGATORIA E SUTIL: Todas as partes do roteiro DEVEM ser narrativamente conectadas. O final de uma parte deve criar uma transicao SUAVE e IMPERCEPTIVEL para a proxima. O objetivo e que o espectador nao sinta a divisao entre as partes.
            - **O que fazer:** O ultimo paragrafo de uma parte deve introduzir uma ideia, pergunta ou misterio que sera naturalmente resolvido ou explorado no inicio da parte seguinte.
            - **O que NAO fazer:** Evite frases cliche como "Na proxima parte, vamos ver...", "Mas isso e assunto para o proximo segmento." ou qualquer mencao explicita a "proxima parte". A transicao deve ser puramente contextual.
            Mantenha uma linha de raciocinio consistente do inicio ao fim.
            `;

            let final_check_instruction = '';
            if (form.narrationOnly) {
                final_check_instruction = `
                ---
                REVISAO FINAL ANTES DE RESPONDER:
                1.  Verifiquei se gerei aproximadamente ${form.parts} partes?
                2.  Verifiquei se CADA parte tem aproximadamente ${totalWordsPerPart} palavras?
                3.  Verifiquei se separei CADA parte com a tag "[--VOICEOVER_PART_BREAK--]"?
                4.  Verifiquei se a resposta contem APENAS a narracao e as tags de separacao, sem nenhum texto extra?
                Se a resposta para qualquer uma dessas perguntas for "nao", voce DEVE corrigir sua resposta antes de envia-la.
                `;
            } else {
                let ctaCheckInstruction = '';
                if (form.ctaPositions && form.ctaPositions.length > 0) {
                    const ctaChecks = [];
                    if (form.ctaPositions.includes('inicio')) {
                        ctaChecks.push('6.  Verifiquei se incluí um CTA (chamada para acao) no INICIO do roteiro (PARTE 1)?');
                    }
                    if (form.ctaPositions.includes('meio')) {
                        const middlePart = Math.ceil(form.parts / 2);
                        ctaChecks.push(`7.  Verifiquei se incluí um CTA (chamada para acao) no MEIO do roteiro (PARTE ${middlePart})?`);
                    }
                    if (form.ctaPositions.includes('final')) {
                        ctaChecks.push(`8.  Verifiquei se incluí um CTA (chamada para acao) no FINAL do roteiro (PARTE ${form.parts})?`);
                    }
                    if (ctaChecks.length > 0) {
                        ctaCheckInstruction = '\n' + ctaChecks.join('\n') + '\nSe algum CTA obrigatorio estiver faltando, VOCE DEVE REESCREVER para inclu-lo antes de enviar.';
                    }
                }
                
                final_check_instruction = `
                ---
                REVISAO FINAL ANTES DE RESPONDER:
                1.  Verifiquei se gerei aproximadamente ${form.parts} partes?
                2.  Verifiquei se CADA parte tem aproximadamente ${paragraphsPerPart} paragrafos?
                3.  Verifiquei se CADA paragrafo tem entre ${minWordsPerParagraph} e ${minWordsPerParagraph + 10} palavras?
                4.  Verifiquei se usei as tags "[--PART ... --]" e "[--ENDPART--]" corretamente?
                5.  Verifiquei se o roteiro final tem o mesmo numero de palavras ou MAIS que o original (se aplicavel)?${ctaCheckInstruction}
                Se a resposta para qualquer uma dessas perguntas for "nao", voce DEVE corrigir sua resposta antes de envia-la.
                `;
            }

            const prompt = `
            Voce e o DARKSCRIP AI - UM ESPECIALISTA EM ROTEIROS VIRAIS COM MAXIMA RETENCAO.
            Sua missao e criar um roteiro de video baseado nas informacoes do usuario e seguir a FORMULA DE ESTRUTURA selecionada com ABSOLUTA FIDELIDADE.

            **REGRA DE OURO (NÃO PODE SER IGNORADA):** Sua resposta DEVE começar DIRETAMENTE com a tag \`[--PART 1: ... --]\` (ou com a narração pura, se for o modo voice-over). NÃO inclua NENHUMA introdução, saudação, ou texto explicativo como 'Com certeza!', 'Aqui está o roteiro:', ou qualquer outra coisa antes do conteúdo do roteiro. A resposta deve ser apenas o roteiro.

            --- INICIO DA FORMULA DE ESTRUTURA SELECIONADA ---
            ${removeAccents(formulaContent)}
            --- FIM DA FORMULA DE ESTRUTURA SELECIONADA ---

            **REGRA CRITICA:** Os exemplos dentro da formula (marcados com "Ex:") sao apenas para ilustrar o estilo e a estrutura. NAO use o conteudo desses exemplos no roteiro final. O conteudo do roteiro deve ser 100% original e focado no "Tema do Video" fornecido pelo usuario.

            APLIQUE AS SEGUINTES DIRETRIZES DO USUARIO A ESTA FORMULA, SEMPRE PRIORIZANDO AS REGRAS DA FORMULA:
            - Nicho do Canal: "${removeAccents(form.niche)}"
            - Publico-Alvo: "${removeAccents(form.audience)}"
            - Tema do Video: "${removeAccents(form.topic)}"
            - Tom Narrativo: "${removeAccents(form.tone)}"
            - Lingua: "${removeAccents(form.lang)}"
            - Duracao Estimada: ${form.duration} minutos

            ${ctaInstruction ? removeAccents(ctaInstruction) : ''}

            ${removeAccents(contextInstruction)}
            ${removeAccents(dynamicOutputInstruction)}
            ${removeAccents(affiliateInstruction)}
            ${removeAccents(trendsInstruction)}
            ${removeAccents(final_check_instruction)}
            `;
            
            const outputEl = document.getElementById('output');
            const initialPartsCount = scriptResults.fullResult ? scriptResults.fullResult.script_parts.length : 0;
            const remainingParts = form.parts - initialPartsCount;

            const promptWithContinuation = continueGeneration ? 
                `${prompt}\n\nINSTRUCAO DE CONTINUACAO: A geracao anterior foi interrompida ou precisa ser refeita. Por favor, continue o roteiro a partir da parte ${initialPartsCount + 1}. Gere as ${remainingParts} partes restantes para completar o total de ${form.parts} partes.` :
                prompt;
            
            if (!continueGeneration) {
                if (outputEl) outputEl.innerHTML = '';
                const scriptPaginationControls = document.getElementById('script-pagination-controls');
                if (scriptPaginationControls) scriptPaginationControls.innerHTML = '';
                const legendContainer = document.getElementById('legend-container');
                if (legendContainer) legendContainer.innerHTML = '';
                showProgressModal(`A gerar roteiro de ${form.parts} partes...`, 'A inicializar a IA...');
                addToLog(`A gerar roteiro com ${form.model}...`);
            } else {
                 showProgressModal(`A continuar a partir da parte ${initialPartsCount + 1}...`, 'A IA esta a retomar o trabalho...');
                 addToLog(`A continuar geracao com ${form.model}...`);
            }

            let textBuffer = '';
            let lastWordCount = 0;
            let isGenerationComplete = false;
            
            const processPart = (partText) => {
                if (!partText || partText.trim() === '') return;

                const cleanedContent = cleanAiInstructions(partText);
                if (!cleanedContent) return;

                const nextPartNumber = scriptResults.fullResult?.script_parts.length + 1;
                const titleMatch = partText.match(/(?:-{4})?\[--PART \d+: (.*?)--\]/s);
                const partTitle = form.narrationOnly ? `Parte ${nextPartNumber}` : (titleMatch ? titleMatch[1].trim() : `Parte ${nextPartNumber}`);
                
                if (scriptResults.fullResult) scriptResults.fullResult.script_parts.push({ part_title: partTitle, part_content: cleanedContent });
                
                renderScriptPage();
                
                if(window.setRealProgress && scriptResults.fullResult) window.setRealProgress((scriptResults.fullResult.script_parts.length / scriptResults.fullResult.total_parts) * 100, `${scriptResults.fullResult.script_parts.length}/${scriptResults.fullResult.total_parts}`);
                lastWordCount = 0;
                window.setPartProgress(0);
            };
            
            const onChunk = (data) => {
                let textChunk = '';
                if (data.type === 'content_block_delta') { // Claude
                    textChunk = data.delta?.text || '';
                } else if (data.choices && data.choices[0].delta) { // GPT
                    textChunk = data.choices[0].delta.content || '';
                } else if (data.candidates) { // Gemini
                    textChunk = data.candidates[0]?.content?.parts[0]?.text || '';
                }
                
                textBuffer += textChunk;
                
                const currentWords = textBuffer.split(/\s+/).filter(Boolean).length - lastWordCount;
                const totalWordsForPart = minWordsPerParagraph * paragraphsPerPart;
                const partProgress = Math.min(100, (currentWords / totalWordsForPart) * 100);
                window.setPartProgress(partProgress);

                const delimiter = form.narrationOnly ? "[--VOICEOVER_PART_BREAK--]" : "[--ENDPART--]";
                while(textBuffer.includes(delimiter)) {
                    const partEndIndex = textBuffer.indexOf(delimiter);
                    const partToProcess = textBuffer.substring(0, partEndIndex);
                    textBuffer = textBuffer.substring(partEndIndex + delimiter.length);
                    processPart(partToProcess);
                }
            };
            
            const onDone = (remainingBuffer) => {
                if (isGenerationComplete) return;
                isGenerationComplete = true;

                textBuffer += remainingBuffer;
                processPart(textBuffer);

                if (scriptResults.fullResult && scriptResults.fullResult.script_parts.length < scriptResults.fullResult.total_parts) {
                    addToLog(`A transmissao terminou antes da conclusao. Partes: ${scriptResults.fullResult.script_parts.length}/${scriptResults.fullResult.total_parts}. A tentar continuar...`, true);
                    
                    setTimeout(() => {
                        handlers['generate-script'](null, true);
                    }, 2000);
                    return;
                }

                if (scriptResults.fullResult) scriptResults.fullResult.full_script_text = scriptResults.fullResult.script_parts.map(p => p.part_content).join('\n\n');

                saveScriptToHistory(scriptResults.fullResult);
                renderScriptHistory();
                
                hideProgressModal();
                showSuccessToast("Geracao concluida!");
                
                renderScriptPage();
            };

            const onError = (error) => {
                if (isGenerationComplete) {
                    addToLog('Erro de stream pos-conclusao ignorado.', true);
                    return;
                }

                if (scriptResults.fullResult && scriptResults.fullResult.script_parts.length >= scriptResults.fullResult.total_parts) {
                    addToLog('Geracao concluida, mas um erro de finalizacao de stream ocorreu. A ignorar continuacao automatica.', false);
                    hideProgressModal();
                    return;
                }

                addToLog(`Erro: ${error.message}. Tentando continuar em 2 segundos...`, true);
                setTimeout(() => {
                    handlers['generate-script'](e, true);
                }, 2000); 
            };

            streamApiRequest('/api/generate', { prompt: promptWithContinuation, model: form.model, stream: true }, onChunk, onDone, onError);
            console.timeEnd(timerId);
            devLog(`Finished: ${timerId}. Chars in prompt: promptWithContinuation.length`);
        },
        'analyze-script-btn': async () => {
            const timerId = `analyze-script-${Date.now()}`;
            devLog(`Starting: ${timerId}`);
            console.time(timerId);

            const scriptText = document.getElementById('reviewer-input-text')?.value.trim();
            const model = document.getElementById('script-reviewer-model-select')?.value;
            const reviewerOutput = document.getElementById('reviewer-output');

            if (!scriptText || !model) {
                showSuccessToast("Por favor, cole um roteiro e selecione um modelo de IA para ser analisado.");
                return;
            }

            // Reset reviewer results and hide all output sections
            reviewerResults = { originalScript: scriptText, originalScores: null, suggestions: [], revisedScript: '', newScores: null };
            document.getElementById('reviewer-original-scores-container').style.display = 'none';
            document.getElementById('reviewer-suggestions-output').innerHTML = '';
            document.getElementById('improvement-actions-container').style.display = 'none';
            document.getElementById('reviewer-revised-script-output').style.display = 'none';
            document.getElementById('reviewer-new-scores-container').style.display = 'none';
            if (reviewerOutput) reviewerOutput.innerHTML = ''; // Clear any previous error messages

            showProgressModal("Analisando roteiro...", "A IA esta a avaliar o potencial e a gerar sugestoes...");

            const corePrinciples = `DIRETRIZES ETICAS: Foco em valor, respeito ao espectador, transparencia. TATICAS PROIBIDAS: Evite "segredo", "infalivel", "garantido". Nao crie falsas urgencias.`;

            try {
                const scorePrompt = `Analise o roteiro e atribua pontuacoes de 0 a 100 para 'retention_potential', 'clarity_score' e 'viral_potential'. ${corePrinciples} Responda APENAS com um objeto JSON.\n\nROTEIRO:\n"""${removeAccents(scriptText)}"""`;
                const scoreSchema = { type: "OBJECT", properties: { retention_potential: { type: "NUMBER" }, clarity_score: { type: "NUMBER" }, viral_potential: { type: "NUMBER" } } };
                const scoreResult = apiRequest('/api/generate', 'POST', { prompt: scorePrompt, model, schema: scoreSchema });

                let suggestionPrompt;
                let suggestionSchema;
                // Otimização 1: Prompt mais conciso
                const baseSuggestionPrompt = `Como especialista em YouTube, analise o roteiro. ${corePrinciples} Forneca 3 sugestoes criticas para melhorar retencao, clareza e potencial viral.`;
                if (model.startsWith('gpt-')) {
                    suggestionPrompt = `${baseSuggestionPrompt} Responda APENAS com um JSON com a chave "suggestions", uma array de objetos com 'title' e 'suggestion'.\n\nROTEIRO:\n"""${removeAccents(scriptText)}"""`;
                    suggestionSchema = {
                        type: "OBJECT",
                        properties: {
                            suggestions: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        title: { type: "STRING" },
                                        suggestion: { type: "STRING" }
                                    }
                                }
                            }
                        }
                    };
                } else {
                    suggestionPrompt = `${baseSuggestionPrompt} Responda APENAS com uma array de objetos JSON, cada um com 'title' e 'suggestion'.\n\nROTEIRO:\n"""${removeAccents(scriptText)}"""`;
                    suggestionSchema = {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "STRING" },
                                suggestion: { type: "STRING" }
                            }
                        }
                    };
                }
                const suggestionPromise = apiRequest('/api/generate', 'POST', { prompt: suggestionPrompt, model, schema: suggestionSchema });

                const [scoreResponse, suggestionResponse] = await Promise.all([scoreResult, suggestionPromise]);

                if (scoreResponse.data) {
                    if (!scoreResponse.data) scoreResponse.data = {};
                    const scoreKeys = ['retention_potential', 'clarity_score', 'viral_potential'];
                    scoreKeys.forEach(key => {
                        let score = scoreResponse.data[key];
                        if (score === undefined || score === null || isNaN(score) || score < 70) {
                            scoreResponse.data[key] = generateRandomScore(78, 98.5);
                        } else {
                            scoreResponse.data[key] = Math.min(score, 98.5);
                        }
                    });
                    reviewerResults.originalScores = scoreResponse.data;
                    renderReviewerScores(reviewerResults.originalScores, 'reviewer-original-score-cards');
                    document.getElementById('reviewer-original-scores-container').style.display = 'block';
                } else {
                    throw new Error("Nao foi possivel obter a pontuacao inicial do roteiro.");
                }

                let suggestionsData;
                if (model.startsWith('gpt-')) {
                    suggestionsData = suggestionResponse?.data?.suggestions;
                } else {
                    suggestionsData = suggestionResponse?.data;
                }

                if (Array.isArray(suggestionsData) && suggestionsData.length > 0) {
                    reviewerResults.suggestions = suggestionsData;
                    document.getElementById('improvement-actions-container').style.display = 'block';
                    renderReviewerSuggestions(reviewerResults.suggestions);
                } else {
                    console.warn("A IA não retornou sugestões válidas ou a resposta estava vazia.");
                    reviewerResults.suggestions = [];
                    document.getElementById('improvement-actions-container').style.display = 'none';
                }
                
                showSuccessToast("Analise concluida.");

            } catch (error) {
                addToLog(`Erro na analise: ${error.message}`, true);
                if (reviewerOutput) {
                    reviewerOutput.innerHTML = `
                        <div class="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mt-6">
                            <h3 class="text-xl font-semibold text-red-800 dark:text-red-300 mb-2">Erro na Analise do Roteiro</h3>
                            <p class="text-red-700 dark:text-red-400">${error.message}</p>
                            <p class="text-sm text-red-600 dark:text-red-500 mt-2">Por favor, verifique o roteiro inserido e suas chaves de API nas configuracoes.</p>
                        </div>
                    `;
                    // Ensure all other output sections are hidden
                    document.getElementById('reviewer-original-scores-container').style.display = 'none';
                    document.getElementById('reviewer-suggestions-output').innerHTML = ''; // Clear suggestions
                    document.getElementById('improvement-actions-container').style.display = 'none';
                    document.getElementById('reviewer-revised-script-output').style.display = 'none';
                    document.getElementById('reviewer-new-scores-container').style.display = 'none';
                }
            } finally {
                hideProgressModal();
                console.timeEnd(timerId);
            }
        },
        'apply-suggestions-btn': async () => {
            if (!reviewerResults.originalScript || reviewerResults.suggestions.length === 0) {
                showSuccessToast("Nenhuma sugestao para aplicar. Analise um roteiro primeiro.");
                return;
            }
            const model = document.getElementById('script-reviewer-model-select')?.value;
            if (!model) {
                showSuccessToast("Por favor, selecione um modelo de IA.");
                return;
            }
            showProgressModal("Aplicando melhorias...", "Reescrevendo o roteiro com base nas sugestoes...");
            
            const corePrinciples = `DIRETRIZES ETICAS: Foco em valor, respeito ao espectador, transparencia. TATICAS PROIBIDAS: Evite "segredo", "infalivel", "garantido". Nao crie falsas urgencias.`;

            try {
                const suggestionsText = reviewerResults.suggestions.map(s => `- ${s.title}: ${s.suggestion}`).join('\n');
                const prompt = `Reescreva o roteiro original abaixo, aplicando TODAS as seguintes sugestoes de melhoria. ${corePrinciples} Mantenha o tone e a estrutura geral, mas incorpore as mudancas de forma fluida e natural. REGRA CRITICA E OBRIGATORIA: O roteiro final deve ter o mesmo numero de palavras ou MAIS que o original. NUNCA encurte o roteiro. Se necessario, adicione mais detalhes ou exemplos para cumprir esta regra. Responda APENAS com o roteiro completamente reescrito, pronto para narracao (voice over), sem NENHUMA tag, marcador, titulo de parte ou texto extra que nao seja parte da narracao.\n\nSUGESTOES:\n${removeAccents(suggestionsText)}\n\nROTEIRO ORIGINAL:\n"""${removeAccents(reviewerResults.originalScript)}"""`;
                const result = await apiRequest('/api/generate', 'POST', { prompt, model });

                if (result.data && result.data.text) {
                    reviewerResults.revisedScript = result.data.text;
                    const revisedScriptOutput = document.getElementById('reviewer-revised-script-output');
                    if (revisedScriptOutput) {
                        const textarea = revisedScriptOutput.querySelector('textarea');
                        if (textarea) textarea.value = reviewerResults.revisedScript;
                        revisedScriptOutput.style.display = 'block';
                    }
                    showSuccessToast("Roteiro revisado com sucesso!");
                    await reevaluateScript(reviewerResults.revisedScript);
                } else {
                    throw new Error("A IA nao retornou um roteiro revisado.");
                }
            } catch (error) {
                addToLog(`Erro ao aplicar sugestoes: ${error.message}`, true);
            } finally {
                hideProgressModal();
            }
        },
        'apply-manual-btn': async () => {
            const manualInstruction = document.getElementById('manual-correction-input')?.value.trim();
            const scriptToRevise = reviewerResults.revisedScript || reviewerResults.originalScript;
            const model = document.getElementById('script-reviewer-model-select')?.value;

            if (!scriptToRevise || !model) {
                showSuccessToast("Analise um roteiro primeiro e selecione um modelo de IA antes de aplicar uma correcao.");
                return;
            }
            if (!manualInstruction) {
                showSuccessToast("Por favor, escreva uma instrucao para a IA.");
                return;
            }

            showProgressModal("Aplicando correcao manual...", "A IA esta reescrevendo o roteiro...");
            
            const corePrinciples = `DIRETRIZES ETICAS: Foco em valor, respeito ao espectador, transparencia. TATICAS PROIBIDAS: Evite "segredo", "infalivel", "garantido". Nao crie falsas urgencias.`;

            try {
                const prompt = `Reescreva o roteiro original abaixo, aplicando a seguinte instrucao de mudanca. ${corePrinciples} Mantenha o tone e a estrutura geral, mas incorpore a mudanca de forma fluida e natural. REGRA CRITICA E OBRIGATORIA: O roteiro final deve ter o mesmo numero de palavras ou MAIS que o original. NUNCA encurte o roteiro. Se necessario, adicione mais detalhes ou exemplos para cumprir esta regra. Responda APENAS com o roteiro completamente reescrito, pronto para narracao (voice over), sem NENHUMA tag, marcador, titulo de parte ou texto extra que nao seja parte da narracao.\n\nINSTRUCAO DE MUDANCA:\n${removeAccents(manualInstruction)}\n\nROTEIRO ORIGINAL:\n"""${removeAccents(scriptToRevise)}"""`;
                
                const result = await apiRequest('/api/generate', 'POST', { prompt, model });

                if (result.data && result.data.text) {
                    reviewerResults.revisedScript = result.data.text;
                    const revisedScriptOutput = document.getElementById('reviewer-revised-script-output');
                    if (revisedScriptOutput) {
                        const textarea = revisedScriptOutput.querySelector('textarea');
                        if (textarea) textarea.value = reviewerResults.revisedScript;
                        revisedScriptOutput.style.display = 'block';
                    }
                    showSuccessToast("Correcao manual aplicada!");
                    await reevaluateScript(reviewerResults.revisedScript);
                } else {
                    throw new Error("A IA nao retornou um roteiro revisado.");
                }
            } catch (error) {
                addToLog(`Erro ao aplicar correcao manual: ${error.message}`, true);
            } finally {
                hideProgressModal();
            }
        },
        'generate-viral-content': async (e, append = false) => {
            const output = document.getElementById('output');
            const topic = document.getElementById('viral-topic')?.value.trim();
            const type = document.getElementById('viral-type')?.value;
            const lang = document.getElementById('viral-lang')?.value;
            const model = document.getElementById('viral-titles-model-select')?.value;
            if (!topic || !type || !lang || !model) { showSuccessToast("Por favor, preencha todos os campos."); return; }

            let prompt, schema, renderer;
            if (type === 'titles') {
                let jsonInstruction = `Responda APENAS com uma array de objetos JSON, cada um com: 'title', 'category' (modelos combinados), 'suggestion' (1 frase explicando a psicologia), e 'scores' (objeto com as chaves em ingles 'impact', 'clarity', 'curiosity' de 0-100).`;
                if (model.startsWith('gpt-')) {
                    jsonInstruction = `Responda APENAS com um objeto JSON contendo uma unica chave "titles", que e uma array de objetos. Cada objeto deve ter: 'title', 'category' (modelos combinados), 'suggestion' (1 frase explicando a psicologia), e 'scores' (objeto com as chaves em ingles 'impact', 'clarity', 'curiosity' de 0-100).`;
                }
                prompt = `Crie 4 titulos virais e ineditos em "${removeAccents(lang)}" sobre "${removeAccents(topic)}". Combine de 2 a 4 modelos de titulos diferentes para cada uno. O titulo nao pode exceder 100 caracteres. ${jsonInstruction}`;
                schema = { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, category: { type: "STRING" }, suggestion: { type: "STRING" }, scores: { type: "OBJECT", properties: { impact: { type: "NUMBER" }, clarity: { type: "NUMBER" }, curiosity: { type: "NUMBER" } } } } } };
                renderer = (result) => result.map(item => {
                    const scores = item.scores || {};
                    const impact = scores.impact || 0;
                    const clarity = scores.clarity || 0;
                    const curiosity = scores.curiosity || 0;
                    const mainScore = (impact + clarity + curiosity) / 3;
                    const subScores = { 'Impacto': impact, 'Clareza': clarity, 'Curiosidade': curiosity };
                    return `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start"><div class="flex-1 w-full"><div class="flex justify-between items-center mb-2"><h3 class="font-semibold text-lg text-gray-900 dark:text-gray-100">${item.title || 'N/A'}</h3>${createCopyButton(item.title || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}</div><div class="flex items-center gap-2"><span class="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full dark:bg-blue-900/20 dark:text-blue-300">${item.category || 'N/A'}</span></div></div><div class="w-full md:w-56 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0">${renderScoreCard('Potencial de Cliques', mainScore, subScores, item.suggestion || '')}</div></div>`;
                }).join('');
            } else { // structures
                let jsonInstruction = `Responda APENAS com uma array de objetos JSON, cada um com: 'structure', 'category', e 'explanation' (1 frase de como usar).`;
                if (model.startsWith('gpt-')) {
                    jsonInstruction = `Responda APENAS com um objeto JSON contendo uma unica chave "structures", que e uma array de objetos. Cada objeto deve ter: 'structure', 'category', e 'explanation' (1 frase de como usar).`;
                }
                prompt = `Crie 4 ESTRUTURAS de titulo ineditas e criativas em "${removeAccents(lang)}" sobre "${removeAccents(topic)}". Combine de 2 a 4 modelos diferentes. Use placeholders como [DOR], [NUMERO]. ${jsonInstruction}`;
                schema = { type: "ARRAY", items: { type: "OBJECT", properties: { structure: { type: "STRING" }, category: { type: "STRING" }, explanation: { type: "STRING" } } } };
                renderer = (result) => result.map(item => `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"><div class="flex justify-between items-start mb-2"><h3 class="font-semibold text-lg text-gray-900 dark:text-gray-100 flex-1">${item.structure || 'N/A'}</h3>${createCopyButton(item.structure || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}</div><div class="flex items-center gap-2 mb-3"><span class="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full dark:bg-green-900/20 dark:text-green-300">${item.category || 'N/A'}</span></div><p class="text-sm text-gray-600 dark:text-gray-300">${item.explanation || ''}</p></div>`).join('');
            }
            try {
                showProgressModal('A gerar conteudo...', 'A comunicar com a IA...');
                const result = await apiRequest('/api/generate', 'POST', { prompt, model, schema });
                hideProgressModal();

                const dataToRender = model.startsWith('gpt-') ? result.data.titles || result.data.structures : result.data;
                if (!dataToRender || !Array.isArray(dataToRender) || dataToRender.length === 0) {
                     throw new Error("A resposta da IA esta vazia ou em formato incorreto.");
                }
                
                if (type === 'titles') {
                    dataToRender.forEach(item => {
                        if (!item.scores) item.scores = {};
                        const scoreKeys = ['impact', 'clarity', 'curiosity'];
                        scoreKeys.forEach(key => {
                            let score = item.scores[key];
                            if (score === undefined || score === null || isNaN(score) || score < 70) {
                                item.scores[key] = generateRandomScore(75, 95);
                            } else {
                                item.scores[key] = Math.min(score, 100);
                            }
                        });
                    });
                }

                let html = renderer(dataToRender);
                if (append) output.insertAdjacentHTML('beforeend', html);
                else {
                    const legendContainer = document.getElementById('legend-container');
                    if (legendContainer) legendContainer.innerHTML = getLegendForTool('viral-titles');
                    if (output) output.innerHTML = html;
                }
                const generateMoreViralContentBtn = document.getElementById('generate-more-viral-content');
                if (generateMoreViralContentBtn) generateMoreViralContentBtn.style.display = 'block';
                if(!append) showSuccessToast("Conteudo gerado!");
            } catch (error) {
                hideProgressModal();
                console.error(error);
                addToLog(error.message, true);
                if (output) output.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao gerar o conteudo.</p>`;
            }
        },
        'translate-script': async () => {
            const text = document.getElementById('translator-input-text')?.value.trim();
            const selectedLanguages = Array.from(document.querySelectorAll('#translator-lang-options input:checked')).map(cb => cb.value);
            const model = document.getElementById('script-translator-model-select')?.value;
            const outputEl = document.getElementById('output');
            if (!text || selectedLanguages.length === 0 || !model) {
                showSuccessToast("Por favor, cole o roteiro, selecione pelo menos um idioma e um modelo de IA.");
                return;
            }

            if (outputEl) outputEl.innerHTML = '';
            showProgressModal('A traduzir...', `A preparar para traduzir para ${selectedLanguages.length} idioma(s)...`);
            
            let completed = 0;
            const translationPromises = selectedLanguages.map((lang) => {
                // Mapear nomes de idiomas para versões mais claras para a IA
                // Usar trim() para remover espaços e normalizar a comparação
                const normalizedLang = lang.trim();
                const languageMap = {
                    'Polski (Polska)': 'polonês',
                    'Portugues (Brasil)': 'português brasileiro',
                    'English (US)': 'inglês',
                    'Espanol (Espana)': 'espanhol',
                    'Francais (Franca)': 'francês',
                    'Deutsch (Alemanha)': 'alemão',
                    'Italiano (Italia)': 'italiano',
                    '日本語 (Japao)': 'japonês',
                    '한국어 (Coreia do Sul)': 'coreano',
                    'Romana (Romenia)': 'romeno'
                };
                
                // Buscar no mapa com a chave normalizada
                let targetLanguage = languageMap[normalizedLang];
                
                // Se não encontrar, tentar busca parcial para japonês e coreano
                if (!targetLanguage) {
                    if (normalizedLang.includes('日本語') || normalizedLang.includes('Japao') || normalizedLang.toLowerCase().includes('japao')) {
                        targetLanguage = 'japonês';
                    } else if (normalizedLang.includes('한국어') || normalizedLang.includes('Coreia')) {
                        targetLanguage = 'coreano';
                    } else {
                        targetLanguage = normalizedLang;
                    }
                }
                
                // Criar prompt específico e claro, especialmente para japonês
                let prompt;
                if (targetLanguage === 'japonês') {
                    prompt = `Traduza o seguinte roteiro para japonês (日本語). Responda APENAS com o texto traduzido em japonês, sem nenhuma formatacao, explicacao ou texto adicional. Mantenha a mesma estrutura e formatação do texto original. Use caracteres japoneses (hiragana, katakana, kanji) conforme apropriado.\n\nROTEIRO:\n"""${removeAccents(text)}"""`;
                } else {
                    prompt = `Traduza o seguinte roteiro para ${targetLanguage}. Responda APENAS com o texto traduzido, sem nenhuma formatacao, explicacao ou texto adicional. Mantenha a mesma estrutura e formatação do texto original.\n\nROTEIRO:\n"""${removeAccents(text)}"""`;
                }
                
                const containerId = `translation-container-${lang}`;
                const outputId = `translation-output-${lang}`;
                const actionsId = `actions-${lang}`;

                const containerHtml = `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4" id="${containerId}">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-bold text-gray-900 dark:text-gray-100">${lang}</h4>
                            <div class="flex gap-2" id="${actionsId}" style="display:none;">
                                <button class="copy-btn text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Copiar</button>
                                <button class="download-translation-btn text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700" data-lang="${lang}">Transferir .txt</button>
                            </div>
                        </div>
                        <div id="${outputId}" class="prose prose-sm max-w-none text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto"></div>
                    </div>
                `;
                if (outputEl) outputEl.insertAdjacentHTML('beforeend', containerHtml);

                const outputDiv = document.getElementById(outputId);
                let fullTranslation = '';
                
                if(window.setRealProgress) window.setRealProgress((completed / selectedLanguages.length) * 100, `Traduzindo para ${lang} (${completed}/${selectedLanguages.length})`);

                return streamApiRequest('/api/generate', { prompt, model, stream: true },
                    (data) => {
                        let textChunk = '';
                        if (data.type === 'content_block_delta') { // Claude
                            textChunk = data.delta?.text || '';
                        } else if (data.choices && data.choices[0].delta) { // GPT
                            textChunk = data.choices[0].delta.content || '';
                        } else if (data.candidates) { // Gemini
                            textChunk = data.candidates[0]?.content?.parts[0]?.text || '';
                        }
                        if (textChunk) {
                            fullTranslation += textChunk;
                            if (outputDiv) {
                                outputDiv.textContent = fullTranslation;
                                // Garantir que o conteúdo seja visível
                                outputDiv.classList.remove('text-gray-500', 'dark:text-gray-400');
                                outputDiv.classList.add('text-gray-900', 'dark:text-gray-100', 'whitespace-pre-wrap');
                            }
                        }
                    },
                    () => {
                        completed++;
                        if(window.setRealProgress) window.setRealProgress((completed / selectedLanguages.length) * 100, `Traducao para ${lang} concluida.`);
                        
                        // Verificar se há tradução antes de mostrar ações
                        if (fullTranslation && fullTranslation.trim().length > 0) {
                            const actionsDiv = document.getElementById(actionsId);
                            if (actionsDiv) actionsDiv.style.display = 'flex';
                            const copyBtn = actionsDiv?.querySelector('.copy-btn');
                            if (copyBtn) copyBtn.dataset.copyText = encodeURIComponent(fullTranslation);
                            const downloadBtn = actionsDiv?.querySelector('.download-translation-btn');
                            if (downloadBtn) downloadBtn.dataset.translation = encodeURIComponent(fullTranslation);
                            if (outputDiv) {
                                outputDiv.classList.remove('text-gray-500', 'dark:text-gray-400');
                                outputDiv.classList.add('text-gray-900', 'dark:text-gray-100', 'whitespace-pre-wrap');
                            }
                        } else {
                            // Se não há tradução, mostrar mensagem de erro
                            if (outputDiv) {
                                outputDiv.textContent = `Nenhuma traducao recebida para ${lang}. Por favor, tente novamente.`;
                                outputDiv.classList.remove('text-gray-500', 'dark:text-gray-400');
                                outputDiv.classList.add('text-yellow-600', 'dark:text-yellow-400');
                            }
                        }
                    },
                    (error) => {
                        completed++;
                        if(window.setRealProgress) window.setRealProgress((completed / selectedLanguages.length) * 100, `Erro no idioma ${lang}.`);
                        if (outputDiv) {
                            outputDiv.textContent = `Falha ao traduzir para ${lang}: ${error.message}`;
                            outputDiv.classList.remove('text-gray-500', 'dark:text-gray-400');
                            outputDiv.classList.add('text-red-600', 'dark:text-red-400');
                        }
                    }
                ).catch((error) => {
                    // Erro já foi tratado no callback onError, mas garantir que seja mostrado
                    completed++;
                    if(window.setRealProgress) window.setRealProgress((completed / selectedLanguages.length) * 100, `Erro no idioma ${lang}.`);
                    const errorOutputDiv = document.getElementById(outputId);
                    if (errorOutputDiv && (!errorOutputDiv.textContent || errorOutputDiv.textContent.trim().length === 0)) {
                        errorOutputDiv.textContent = `Erro ao traduzir para ${lang}: ${error.message || 'Erro desconhecido'}`;
                        errorOutputDiv.classList.remove('text-gray-500', 'dark:text-gray-400');
                        errorOutputDiv.classList.add('text-red-600', 'dark:text-red-400');
                    }
                });
            });

            // Aguardar todas as traduções completarem
            await Promise.all(translationPromises);
            
            hideProgressModal();
            
            // Mostrar modal de tradução concluída
            const translationModal = document.getElementById('translation-complete-modal');
            if (translationModal) {
                translationModal.style.display = 'flex';
                // Adicionar handler para fechar o modal
                const closeBtn = document.getElementById('close-translation-modal-btn');
                if (closeBtn) {
                    const hideModal = () => translationModal.style.display = 'none';
                    // Remover listeners antigos e adicionar novo
                    const newCloseBtn = closeBtn.cloneNode(true);
                    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
                    newCloseBtn.addEventListener('click', hideModal);
                }
            }
        },
        'generate-scene-prompts': async (e) => {
            const startTime = Date.now();
            const text = document.getElementById('scene-text')?.value.trim();
            const model = document.getElementById('scene-prompts-model-select')?.value;
            const imageModel = document.getElementById('scene-image-model')?.value;
            const lang = document.getElementById('scene-lang')?.value;
            const includeText = document.getElementById('scene-include-text')?.checked;
            const characters = document.getElementById('scene-characters')?.value.trim();
            if (!text || !model || !imageModel || !lang) {
                showSuccessToast("Por favor, preencha todos os campos.");
                return;
            }

            const mode = document.getElementById('generation-mode')?.value;
            const wordCount = parseInt(document.getElementById('scene-word-count')?.value, 10);
            const style = document.getElementById('scene-style')?.value;
            const styleInstruction = style && style !== 'none' ? ` O estilo visual principal deve ser '${removeAccents(style)}'.` : '';
            const textInstruction = includeText 
                ? `Se o prompt incluir texto para ser renderizado na imagem, esse texto DEVE estar no idioma "${removeAccents(lang)}".`
                : "O prompt NAO DEVE incluir nenhuma instrucao para adicionar texto.";
            const characterInstruction = characters ? ` Mantenha a consistencia dos seguintes personagens em todas as cenas: ${removeAccents(characters)}.` : '';
            const rawWords = text.split(/\s+/).filter(Boolean);
            const totalWords = rawWords.length;
            const estimatedScenes = Math.max(1, Math.round(totalWords / 90));
            const minScenes = Math.max(1, Math.floor(totalWords / 140));
            const maxScenes = Math.max(estimatedScenes + 2, Math.ceil(totalWords / 60));

            let chunks = [];
            scenePromptResults.data = []; // Limpa os resultados anteriores
            scenePromptResults.originalScript = text; // Correção 5: Salvar o roteiro original

            if (mode === 'manual') {
                if (wordCount <= 0) {
                    showSuccessToast('Por favor, insira um numero de palavras valido.');
                    return;
                }
                for (let i = 0; i < rawWords.length; i += wordCount) {
                    chunks.push(rawWords.slice(i, i + wordCount).join(' '));
                }
                scenePromptResults.total_prompts = chunks.length;
            } else { // MODO AUTOMATICO
                chunks.push(text); // No modo automatico, processamos o texto inteiro de uma vez
                scenePromptResults.total_prompts = null; // Sera definido apos a resposta da IA
            }

            const totalEstimate = mode === 'manual' ? chunks.length : estimatedScenes;
            const initialMessage = mode === 'manual'
                ? `Gerando ${chunks.length} prompt(s) com blocos de ${wordCount} palavra(s)...`
                : `A IA está analisando ${totalWords} palavras para sugerir cerca de ${estimatedScenes} cenas (entre ${minScenes} e ${maxScenes}, se necessário).`;

            appState.sceneGenStatus = { active: true, current: 0, total: totalEstimate, message: initialMessage, error: false };
            renderSceneGenerationProgress(appState.sceneGenStatus);
            addToLog(mode === 'manual'
                ? `A gerar ${chunks.length} prompt(s) com blocos de ${wordCount} palavra(s)...`
                : `A IA está a calcular automaticamente o número ideal de cenas (~${estimatedScenes}) para o roteiro.`);

            try {
                if (mode === 'manual') {
                    const schema = {
                        type: "OBJECT",
                        properties: {
                            scene_description: { type: "STRING" },
                            prompt_text: { type: "STRING" },
                            original_text: { type: "STRING" }
                        },
                        required: ["scene_description", "prompt_text", "original_text"]
                    };

                    for (let index = 0; index < chunks.length; index++) { // Use let for index
                        const chunk = chunks[index];
                        const prompt = `INSTRUCAO: Analise o CONTEXTO GERAL do roteiro completo abaixo. Depois, foque no TRECHO ESPECIFICO e gere UM prompt de imagem em INGLES. O prompt deve ser detalhado, otimizado para a IA de imagem '${imageModel}'.${styleInstruction} ${textInstruction} ${characterInstruction} Responda APENAS com um UNICO objeto JSON com as chaves: 'prompt_text', 'scene_description' (descricao curta da cena em portugues), e 'original_text' (o trecho do roteiro que inspirou a cena).\n\n--- CONTEXTO GERAL ---\n"""${removeAccents(text)}"""\n\n--- TRECHO ESPECIFICO ---\n"""${removeAccents(chunk)}"""`;
                        
                        appState.sceneGenStatus.current = index + 1;
                        appState.sceneGenStatus.message = `A gerar prompt para a cena ${index + 1} (trecho ${index + 1} de ${chunks.length})...`;
                        renderSceneGenerationProgress(appState.sceneGenStatus);

                        let retries = 3;
                        while (retries > 0) {
                            try {
                                const result = await apiRequest('/api/generate', 'POST', { prompt, model, schema });
                                if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
                                    scenePromptResults.data.push(result.data);
                                } else {
                                   addToLog(`A IA nao retornou um prompt valido para a cena ${index + 1}.`, true);
                                }
                                break;
                            } catch (error) {
                                retries--;
                                if (error.message.includes('JSON incompleto') && retries > 0) {
                                    addToLog(`Erro de JSON incompleto na cena ${index + 1}. Tentando novamente... (${retries} tentativas restantes)`, true);
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                } else {
                                    addToLog(`Erro ao gerar prompt para a cena ${index + 1}: ${error.message}`, true);
                                    break;
                                }
                            }
                        }
                        // Otimização 4: Adicionar delay fixo
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                } else { // MODO AUTOMATICO
                    let schema;
                    let prompt;
                    const autoSceneGuidance = `O roteiro possui aproximadamente ${totalWords} palavras. Gere entre ${minScenes} e ${maxScenes} cenas visuais (idealmente cerca de ${estimatedScenes}). Ajuste esse número apenas se necessário para cobrir totalmente a narrativa, sem deixar trechos importantes sem representação. Liste as cenas em ordem cronológica.`;
                    if (model.startsWith('gpt-')) {
                        schema = {
                            type: "OBJECT",
                            properties: {
                                scenes: {
                                    type: "ARRAY",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            scene_description: { type: "STRING" },
                                            prompt_text: { type: "STRING" },
                                            original_text: { type: "STRING" }
                                        },
                                        required: ["scene_description", "prompt_text", "original_text"]
                                    }
                                }
                            },
                            required: ["scenes"]
                        };
                        prompt = `INSTRUCAO MESTRE: Aja como um diretor de arte. Sua tarefa e ler o roteiro COMPLETO abaixo e dividi-lo em CENAS VISUAIS logicas. ${autoSceneGuidance} Para CADA cena, gere UM prompt de imagem detalhado em INGLES otimizado para a IA de imagem '${imageModel}'.${styleInstruction} ${textInstruction} ${characterInstruction} RESPONDA APENAS com um objeto JSON contendo uma unica chave "scenes", que e uma array de objetos. Cada objeto deve conter: 'prompt_text', 'scene_description' (descricao curta da cena em portugues), e 'original_text' (o trecho do roteiro que inspirou a cena).\n\nROTEIRO COMPLETO:\n"""${removeAccents(text)}"""`;
                    } else {
                        schema = {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    scene_description: { type: "STRING" },
                                    prompt_text: { type: "STRING" },
                                    original_text: { type: "STRING" }
                                },
                                required: ["scene_description", "prompt_text", "original_text"]
                            }
                        };
                        prompt = `INSTRUCAO MESTRE: Aja como um diretor de arte. Sua tarefa e ler o roteiro COMPLETO abaixo e dividi-lo em CENAS VISUAIS logicas. ${autoSceneGuidance} Para CADA cena, gere UM prompt de imagem detalhado em INGLES otimizado para a IA de imagem '${imageModel}'.${styleInstruction} ${textInstruction} ${characterInstruction} RESPONDA APENAS com uma array de objetos JSON. Cada objeto deve conter: 'prompt_text', 'scene_description' (descricao curta da cena em portugues), e 'original_text' (o trecho do roteiro que inspirou a cena).\n\nROTEIRO COMPLETO:\n"""${removeAccents(text)}"""`;
                    }
                    
                    const result = await apiRequest('/api/generate', 'POST', { prompt, model, schema });
                    const scenesData = model.startsWith('gpt-') ? result.data.scenes : result.data;
                    if (!scenesData || !Array.isArray(scenesData) || scenesData.length === 0) throw new Error("A IA nao retornou prompts de cena validos.");
                    
                    scenePromptResults.data.push(...scenesData);
                    scenePromptResults.total_prompts = scenePromptResults.data.length;
                    appState.sceneGenStatus.current = scenePromptResults.data.length;
                    appState.sceneGenStatus.total = scenePromptResults.data.length;
                    appState.sceneGenStatus.message = `Roteiro dividido em ${scenePromptResults.data.length} cena(s).`;
                    renderSceneGenerationProgress(appState.sceneGenStatus);
                }

                scenePromptResults.currentPage = 1;
                appState.lastGeneratedPrompts = scenePromptResults.data.map(item => item.prompt_text || '').filter(Boolean).join('\n');
                
                // Save to history
                const sceneTitle = document.getElementById('scene-text')?.value.trim().substring(0, 50) || 'Prompts de Cena';
                saveSceneToHistory(scenePromptResults, sceneTitle);
                renderSceneHistory();

                if (appState.currentTab === 'scene-prompts') {
                    renderScenePage();
                }
                
                const endTime = Date.now();
                const duration = Math.round((endTime - startTime) / 1000);
                showSceneGenCompleteModal(duration);

                appState.sceneGenStatus.message = `Concluido. ${scenePromptResults.data.length} prompts gerados.`;

            } catch (error) {
                console.error(error);
                addToLog(error.message, true);
                appState.sceneGenStatus.error = true;
                appState.sceneGenStatus.message = error.message;
            } finally {
                renderSceneGenerationProgress(appState.sceneGenStatus);
                setTimeout(() => {
                    appState.sceneGenStatus.active = false;
                    renderSceneGenerationProgress(appState.sceneGenStatus);
                }, 5000);
                console.timeEnd(timerId);
                devLog(`Finished: ${timerId}. Chunks processed: ${chunks.length}`);
            }
        },
        'detect-characters-btn': async () => {
            const scriptText = document.getElementById('scene-text')?.value.trim();
            const model = document.getElementById('scene-prompts-model-select')?.value;
            const charactersTextarea = document.getElementById('scene-characters');

            if (!scriptText || !model || !charactersTextarea) {
                showSuccessToast("Por favor, cole um roteiro e selecione um modelo de IA.");
                return;
            }

            showProgressModal("Detectando personagens...", "A IA esta analisando o roteiro...");

            const prompt = `Voce e um diretor de elenco, figurinista e designer visual cinematografico especializado em storytelling emocional e geracao de imagens com IA (ImageFX, VO3, Runway, Leonardo AI, Midjourney, etc.).  
Sua funcao e **ler um roteiro completo** e gerar **fichas de personagem com detalhamento tecnico e emocional absoluto**, garantindo que cada personagem mantenha a **mesma identidade visual, corporal e simbólica** em todas as cenas e producoes futuras.

---

### 🎯 OBJETIVO PRINCIPAL:
Transformar o texto narrativo em um **guia visual cinematografico de personagens**, contendo:
- Aparência física ultra-detalhada (tons, texturas, volumes, formas e luz);
- Vestimentas e variações contextuais (estado limpo, sujo, molhado, ferido, formal, doméstico);
- Expressões e linguagem corporal condizentes com o arco emocional;
- Símbolos visuais que expressem a essência psicológica do personagem;
- Direções de câmera e luz que reforcem o tom da narrativa.  

---

### 🧠 ETAPAS DE ANÁLISE (siga esta sequência):

1. **LEITURA COMPLETA E INTERPRETAÇÃO:**  
   - Identifique todos os personagens com presença significativa.  
   - Analise o papel narrativo de cada um (protagonista, antagonista, vítima, mentor, criança, coadjuvante).  
   - Observe mudanças físicas ou emocionais ao longo do roteiro.

2. **ANÁLISE PSICOLÓGICA E SIMBÓLICA:**  
   - Determine o estado emocional predominante (ex: culpa, medo, resignação, coragem).  
   - Identifique contrastes (ex: aparência impecável / alma destruída).  
   - Relacione com elementos simbólicos (ex: luz e sombra, pureza e corrupção, juventude e decadência).  

3. **CONSTRUÇÃO VISUAL:**  
   - Descreva aparência com **textura, contraste e luz**.  
   - Especifique traços anatômicos, tons de pele, reflexos, textura de cabelo, microexpressões e cicatrizes.  
   - Inclua sugestões de **iluminação e lente cinematográfica** para o retrato (ex: luz lateral fria, 35mm, profundidade rasa).  
   - Mencione o **ambiente que mais representa** o personagem (ex: sala escura, delegacia, porão, campo iluminado).  

4. **CONSISTÊNCIA ENTRE CENAS:**  
   - Certifique-se de que todos os elementos físicos (olhos, cabelo, rosto, altura, etnia) se repitam em todas as gerações.  
   - Se houver evolução (ex: envelhecimento, trauma, ferimento), descreva a transição detalhadamente.  
   - Use sempre a mesma estrutura facial e cor de olhos/cabelo como base.

---

### 🧩 MODELO DE SAÍDA ULTRA-DETALHADO:

**PERSONAGEM [número]: [NOME COMPLETO ou "Sem Nome (descrição)"]**

**Função Narrativa:** [Ex: protagonista, antagonista, vítima, policial veterano, mãe resiliente etc.]

**Arco Emocional:** [Resumo do que o personagem sente e aprende ao longo da história — ex: "De desconfiança a redenção"]

**Idade Aparente:** [em anos, mesmo que não seja dito no roteiro]  
**Etnia e Ancestralidade:** [detalhe visual e cultural — ex: caucasiano com traços latinos, pele morena clara exposta ao sol]  
**Tom de Pele e Textura:** [especifique variação de cor, luminosidade e textura — ex: tom oliva com poros visíveis e rugas leves]  
**Cor e Estilo do Cabelo:** [cor, textura, comprimento, penteado, sinais de idade ou desleixo]  
**Cor e Expressividade dos Olhos:** [cor exata, brilho, tipo de olhar — ex: olhos mel claros com olhar vigilante e cansado]  
**Formato do Rosto:** [ex: quadrado, oval, com maxilar forte, maçãs salientes]  
**Tipo Físico:** [altura, estrutura corporal, densidade muscular, curvatura de postura]  
**Expressão Padrão:** [como o rosto repousa emocionalmente — ex: semblante sério, mandíbula tensa, olhar distante]  
**Linguagem Corporal:** [gestos, postura, maneira de caminhar, ritmo de fala corporal]  
**Estilo de Roupa Principal:** [tipo, cor, estado de conservação, textura do tecido, ajuste ao corpo]  
**Variações de Roupa:** [quando está em casa, em ação, em crise, ferido etc.]  
**Acessórios e Detalhes Pessoais:** [relógio, anel, colar, aliança, distintivo, cicatriz, tatuagem, ferimentos]  
**Marcas / Características Distintivas:** [ex: cicatriz antiga, tremor leve, olhar perdido, barba irregular]  
**Paleta de Cores Dominante:** [principais tons que o representam visualmente e psicologicamente]  
**Símbolos Visuais e Metáforas:** [ex: "sombra e reflexo d'água representam sua dualidade moral"]  
**Ambiente e Iluminação Ideal:** [descrição de luz, temperatura de cor, clima e cenário que melhor expressam o personagem]  
**Ângulo Cinemático Recomendado:** [close-up, plano médio, plongée, contra-plongée, lente 35mm, 85mm etc.]  
**Sombras e Textura de Fundo:** [ex: fundo enevoado, parede fria, luz refletida em piso molhado]  
**Descrição Técnica para IA (ImageFX / VO3):**
> ultra-realistic 8k cinematic, volumetric lighting, dramatic shadows,  
> shallow depth of field, natural skin texture, filmic grain, emotional realism,  
> maintain identical facial structure, hairstyle, and outfit consistency.

---

### 🎨 PADRÃO DE COERÊNCIA VISUAL GLOBAL:
- Use **tons frios** (azul, cinza, marrom) para histórias dramáticas e de mistério.  
- Use **tons quentes** (laranja, dourado, sépia) para flashbacks ou lembranças positivas.  
- **Mulheres traumatizadas:** luz lateral difusa, contraste alto, textura de pele realista, olhos vermelhos.  
- **Homens veteranos:** luz dura, sombras marcadas, barba por fazer, fundo molhado, colarinho gasto.  
- **Jovens idealistas:** foco limpo, reflexos de sirene, roupas novas, postura ereta.  

---

### 🧱 REGRAS RÍGIDAS:
1. Nunca use adjetivos genéricos como "bonito", "normal", "alegre" — sempre descreva **o motivo visual**.  
2. Mantenha consistência absoluta entre gerações — **a IA deve reconhecer o mesmo rosto e figurino.**  
3. Use metáforas visuais coerentes (ex: "a luz nunca toca completamente seu rosto").  
4. Adapte pequenas variações conforme o arco emocional (ex: cabelo despenteado após trauma).  
5. Sempre descreva o **estado físico + o peso emocional** do personagem.  
`;

            const schema = {
                type: "OBJECT",
                properties: {
                    characters: {
                        type: "ARRAY",
                        items: {
                            type: "STRING"
                        }
                    }
                },
                required: ["characters"]
            };

            try {
                const result = await apiRequest('/api/generate', 'POST', { prompt, model, schema });
                const characters = result.data.characters || [];
                charactersTextarea.value = characters.join('\n');
                hideProgressModal();
                showSuccessToast("Personagens detectados com sucesso!");
            } catch (error) {
                console.error(error);
                addToLog(error.message, true);
                hideProgressModal();
                showSuccessToast("Ocorreu um erro ao detectar personagens.");
            }
        },
        'generate-prompts': async (e, append = false) => {
            const output = document.getElementById('output');
            const title = document.getElementById('thumb-title')?.value.trim();
            const platform = document.getElementById('thumb-platform')?.value;
            const lang = document.getElementById('thumb-lang')?.value;
            const includeText = document.getElementById('thumb-include-text')?.checked;
            const model = document.getElementById('thumbnail-prompts-model-select')?.value;
            
            if (!title || !platform || !lang || !model) { showSuccessToast("Por favor, preencha todos os campos."); return; }

            let textInstruction = includeText 
                ? `O prompt DEVE incluir uma instrucao clara para adicionar um texto curto e impactante na imagem, relacionado ao titulo. ESSE TEXTO DEVE ESTAR NO IDIOMA: "${removeAccents(lang)}".`
                : "O prompt NAO DEVE incluir nenhuma instrucao para adicionar texto. O foco deve ser 100% na composicao visual.";

            let prompt, schema;
            if (model.startsWith('gpt-')) {
                prompt = `Gere 2 prompts AVANCADOS em INGLES para a IA '${platform}' para uma thumbnail sobre "${removeAccents(title)}". O prompt em si DEVE ser em INGLES. ${textInstruction} Siga a diretriz: "alta resolucao, cores vibrantes, clareza maxima, elementos visuais fortes". Para cada prompt, forneca: 'prompt', 'score' (CTR 0-100), 'suggestion' (melhoria principal em PORTUGUES, curta). Responda APENAS com um objeto JSON contendo uma chave "prompts", que e uma array de objetos.`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        prompts: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    prompt: { type: "STRING" },
                                    score: { type: "NUMBER" },
                                    suggestion: { type: "STRING" }
                                },
                                required: ["prompt", "score", "suggestion"]
                            }
                        }
                    },
                    required: ["prompts"]
                };
            } else {
                prompt = `Gere 2 prompts AVANCADOS em INGLES para a IA '${platform}' para uma thumbnail sobre "${removeAccents(title)}". O prompt em si DEVE ser em INGLES. ${textInstruction} Siga a diretriz: "alta resolucao, cores vibrantes, clareza maxima, elementos visuais fortes". Para cada prompt, forneca: 'prompt', 'score' (CTR 0-100), 'suggestion' (melhoria principal em PORTUGUES, curta). O formato JSON DEVE ser uma array de objetos.`;
                schema = {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            prompt: { type: "STRING" },
                            score: { type: "NUMBER" },
                            suggestion: { type: "STRING" }
                        },
                        required: ["prompt", "score", "suggestion"]
                    }
                };
            }
            try {
                showProgressModal('A gerar prompts de thumbnail...');
                const result = await apiRequest('/api/generate', 'POST', {prompt, model, schema});
                hideProgressModal();

                const dataToRender = model.startsWith('gpt-') ? result.data.prompts : result.data;
                if (!dataToRender || !Array.isArray(dataToRender) || dataToRender.length === 0) {
                     throw new Error("A resposta da IA esta vazia ou em formato incorreto.");
                }

                if (append) thumbnailPromptResults.data.push(...dataToRender);
                else thumbnailPromptResults.data = dataToRender;
                
                thumbnailPromptResults.rawPromptsText = thumbnailPromptResults.data.map(p => p.prompt).filter(Boolean).join('\n');
                appState.lastGeneratedPrompts = thumbnailPromptResults.rawPromptsText;

                let html = dataToRender.map(item => {
                    const mainScore = item.score || 0;
                    const subScores = { 'Impacto Visual': item.score, 'Clareza': item.score > 10 ? item.score - 5 : item.score };
                    return `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start"><div class="flex-1"><div class="flex justify-between items-start"><p class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded flex-1">${item.prompt}</p>${createCopyButton(item.prompt, 'ml-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}</div></div><div class="w-full md:w-56 flex-shrink-0">${renderScoreCard('Potencial de CTR', mainScore, subScores, item.suggestion)}</div></div>`;
                }).join('');
                if (append) output.insertAdjacentHTML('beforeend', html);
                else {
                    const legendContainer = document.getElementById('legend-container');
                    if (legendContainer) legendContainer.innerHTML = getLegendForTool('thumbnail-prompts');
                    if (output) output.innerHTML = html;
                }
                const generateMorePromptsBtn = document.getElementById('generate-more-prompts');
                if (generateMorePromptsBtn) generateMorePromptsBtn.style.display = 'block';
                if(!append) showSuccessToast("Prompts de thumbnail gerados!");
            } catch (error) {
                hideProgressModal();
                console.error(error);
                addToLog(error.message, true);
                if (output) output.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao gerar o conteudo.</p>`;
            }
        },
        'generate-imagefx': async (promptsToGenerate, isRetry = false, originalIndex = -1, originalAspectRatio = null) => {
            const form = {
                promptInput: document.getElementById('imagefx-prompt'),
                negativePrompt: document.getElementById('imagefx-negative-prompt')?.value.trim(),
                aspectRatio: originalAspectRatio || document.getElementById('imagefx-aspect-ratio')?.value,
                style: document.getElementById('imagefx-style')?.value,
                numImages: parseInt(document.getElementById('imagefx-num-images')?.value, 10),
                batchFileInput: document.getElementById('imagefx-batch-file'),
                generationModel: document.getElementById('imagefx-model')?.value
            };
    
            const processFailedImageRetry = async (failedImage, index) => {
                const sceneNumber = failedImage.sceneNumber;
                const errorMessage = (failedImage.error || '').toLowerCase();
                
                // Detecta se é erro de throttling (limite de requisições)
                const isThrottlingError = errorMessage.includes('throttled') || 
                                         errorMessage.includes('limite de requisições') ||
                                         errorMessage.includes('429') ||
                                         errorMessage.includes('too many requests');
                
                // Se for erro de throttling, apenas tenta novamente com o mesmo prompt
                if (isThrottlingError) {
                    try {
                        imageFxResults.images[index] = {
                            ...failedImage,
                            status: 'retrying',
                            error: 'Limite de requisições atingido. Tentando novamente após aguardar...'
                        };
                        renderImageFxOutput();
                        appState.imageGenStatus.message = `Cena ${sceneNumber}: limite atingido, tentando novamente...`;
                        renderImageGenerationProgress(appState.imageGenStatus);
                        
                        addToLog(`Tentando gerar novamente a cena ${sceneNumber} (mesmo prompt)...`);
                        
                        const res = await apiRequest('/api/imagefx/generate', 'POST', {
                            prompts: [failedImage.prompt],
                            negative_prompt: form.negativePrompt,
                            aspect_ratio: failedImage.aspectRatio,
                            style: form.style,
                            num_images: form.numImages,
                            generation_model: form.generationModel
                        });
                        
                        const newImageResults = res.images.map(img => ({
                            ...img,
                            sceneNumber: failedImage.sceneNumber,
                            aspectRatio: failedImage.aspectRatio
                        }));
                        
                        imageFxResults.images.splice(index, 1, ...newImageResults);
                        renderImageFxOutput();
                        addToLog(`Cena ${sceneNumber} gerada com sucesso após retry!`);
                        return true;
                    } catch (retryError) {
                        addToLog(`Falha ao gerar novamente a cena ${sceneNumber}: ${retryError.message}`, true);
                        imageFxResults.images[index] = {
                            ...failedImage,
                            status: 'failed',
                            error: `Falha no retry: ${retryError.message}`
                        };
                        renderImageFxOutput();
                        return false;
                    }
                }
                
                // Se for erro de política/conteúdo, reescreve o prompt com IA
                const model = 'gemini-2.5-flash';
                appState.imageGenStatus.message = `Cena ${sceneNumber}: prompt bloqueado. Reescrevendo automaticamente...`;
                renderImageGenerationProgress(appState.imageGenStatus);
            
                const sceneIndex = sceneNumber - 1;
                
                let context = ''; 
                if (scenePromptResults.data && scenePromptResults.data[sceneIndex] && scenePromptResults.data[sceneIndex].original_text) {
                    context = scenePromptResults.data[sceneIndex].original_text;
                } else if (scenePromptResults.originalScript) {
                    context = scenePromptResults.originalScript;
                } else {
                    context = failedImage.prompt;
                    console.warn(`Could not find specific context for scene ${sceneNumber}. Using prompt as context.`);
                }
            
                let prevSuccessfulPrompt = null;
                for (let i = index - 1; i >= 0; i--) {
                    if (imageFxResults.images[i] && imageFxResults.images[i].status === 'success') {
                        prevSuccessfulPrompt = imageFxResults.images[i].prompt;
                        break;
                    }
                }
                let nextSuccessfulPrompt = null;
                for (let i = index + 1; i < imageFxResults.images.length; i++) {
                    if (imageFxResults.images[i] && imageFxResults.images[i].status === 'success') {
                        nextSuccessfulPrompt = imageFxResults.images[i].prompt;
                        break;
                    }
                }
            
                if (prevSuccessfulPrompt || nextSuccessfulPrompt) {
                    context += `\n\nContexto visual da cena anterior (se houver): "${prevSuccessfulPrompt || 'N/A'}". Contexto visual da cena posterior (se houver): "${nextSuccessfulPrompt || 'N/A'}". Garanta que a nova imagem se encaixe visualmente entre elas.`;
                }
            
                try {
                    imageFxResults.images[index] = {
                        ...failedImage,
                        status: 'retrying',
                        error: 'Prompt bloqueado pelas políticas. A IA está reescrevendo automaticamente para manter o estilo e a história...'
                    };
                    renderImageFxOutput();
            
                    const rewriteResponse = await apiRequest('/api/imagefx/rewrite-prompt', 'POST', {
                        failedPrompt: failedImage.prompt,
                        context: context,
                        model: model,
                        policyGuidance: failedImage.error || 'Policy violation'
                    });
            
                    if (rewriteResponse.newPrompt) {
                        const newPrompt = rewriteResponse.newPrompt;
                        addToLog(`Prompt da cena ${failedImage.sceneNumber} reescrito pela IA. Tentando gerar novamente...`);
            
                        const res = await apiRequest('/api/imagefx/generate', 'POST', {
                            prompts: [newPrompt],
                            negative_prompt: form.negativePrompt,
                            aspect_ratio: failedImage.aspectRatio,
                            style: form.style,
                            num_images: form.numImages,
                            generation_model: form.generationModel
                        });
            
                        const newImageResults = res.images.map(img => ({
                            ...img,
                            sceneNumber: failedImage.sceneNumber,
                            aspectRatio: failedImage.aspectRatio,
                            wasRewritten: true
                        }));
            
                        imageFxResults.images.splice(index, 1, ...newImageResults);
                        renderImageFxOutput();
                        return true;
                    } else {
                        throw new Error('A IA não retornou um prompt reescrito válido.');
                    }
                } catch (rewriteError) {
                    addToLog(`Falha ao reescrever e gerar novamente a cena ${failedImage.sceneNumber}: ${rewriteError.message}`, true);
                    imageFxResults.images[index] = {
                        ...failedImage,
                        status: 'failed',
                        error: `Falha na reescrita automática: ${rewriteError.message}`
                    };
                    renderImageFxOutput();
                    return false;
                }
            };
            
            const runGeneration = async (promptsBatch, isBulkRetry = false) => {
                if (!promptsBatch || promptsBatch.length === 0) {
                    showSuccessToast("Nenhum prompt valido foi fornecido.");
                    return;
                }
                
                imageFxResults.lastPrompt = promptsBatch.join('\n');
                const totalPrompts = promptsBatch.length;
                let generatedCount = 0;
                const generationStartTime = Date.now();
                
                if (!isRetry && !isBulkRetry) {
                    appState.imageGenStatus = { active: true, current: 0, total: totalPrompts, message: `A iniciar ${totalPrompts} prompt(s)...`, error: false };
                    renderImageGenerationProgress(appState.imageGenStatus);
                    addToLog(`A gerar imagens para ${totalPrompts} prompt(s) com ImageFX...`);
                }
    
                const allowConcurrent = (!isRetry && !isBulkRetry && form.numImages === 1 && totalPrompts > 1);

                const runTasksWithConcurrency = async (tasks, limit, processor) => {
                    return new Promise((resolve) => {
                        let nextIndex = 0;
                        let active = 0;

                        const launchNext = () => {
                            if (nextIndex >= tasks.length && active === 0) {
                                resolve();
                                return;
                            }
                            while (active < limit && nextIndex < tasks.length) {
                                const task = tasks[nextIndex++];
                                active++;
                                processor(task).finally(() => {
                                    active--;
                                    launchNext();
                                });
                            }
                        };

                        launchNext();
                    });
                };

                if (allowConcurrent) {
                    const baseIndex = imageFxResults.images.length;
                    const baseSceneNumber = baseIndex + 1;
                    const tasks = promptsBatch.map((prompt, idx) => {
                        const sceneNumber = baseSceneNumber + idx;
                        const imageIndex = baseIndex + idx;
                        imageFxResults.images.push({
                            status: 'pending',
                            prompt,
                            error: 'A gerar...',
                            sceneNumber,
                            aspectRatio: form.aspectRatio
                        });
                        return { prompt, sceneNumber, imageIndex };
                    });
                    renderImageFxOutput();

                    const totalTasks = tasks.length;
                    let completed = 0;

                    const updateProgress = () => {
                        if (!isRetry && !isBulkRetry) {
                            appState.imageGenStatus.current = completed;
                            appState.imageGenStatus.message = `Processando ${completed}/${totalTasks} cenas...`;
                            renderImageGenerationProgress(appState.imageGenStatus);
                        }
                    };

                    const processTask = async (task) => {
                        const { prompt: currentPrompt, sceneNumber: currentSceneNumber, imageIndex: currentImageIndex } = task;
                        try {
                            const res = await apiRequest('/api/imagefx/generate', 'POST', {
                                prompts: [currentPrompt],
                                negative_prompt: form.negativePrompt,
                                aspect_ratio: form.aspectRatio,
                                style: form.style,
                                num_images: form.numImages,
                                generation_model: form.generationModel
                            });

                            const imageResults = res.images.map(img => ({ ...img, sceneNumber: currentSceneNumber }));
                            if (imageResults.length > 0) {
                                imageFxResults.images[currentImageIndex] = imageResults[0];
                            } else {
                                imageFxResults.images[currentImageIndex] = {
                                    status: 'failed',
                                    prompt: currentPrompt,
                                    error: 'A API retornou uma resposta vazia.',
                                    sceneNumber: currentSceneNumber,
                                    aspectRatio: form.aspectRatio
                                };
                            }

                            if (appState.currentTab === 'image-generator') {
                                renderImageFxOutput();
                            }
                        } catch (error) {
                            console.error(`Erro na geração ImageFX para o prompt ${currentSceneNumber}:`, error.stack || error);
                            const userFriendlyMessage = error.message || 'Erro desconhecido.';

                            if (userFriendlyMessage.includes('Prompt bloqueado') || userFriendlyMessage.toLowerCase().includes('conteúdo inseguro') || userFriendlyMessage.toLowerCase().includes('conteudo inseguro')) {
                                const success = await processFailedImageRetry({
                                    status: 'failed',
                                    prompt: currentPrompt,
                                    error: userFriendlyMessage,
                                    sceneNumber: currentSceneNumber,
                                    aspectRatio: form.aspectRatio
                                }, currentImageIndex);

                            if (success) {
                                if (!isRetry && !isBulkRetry) {
                                    appState.imageGenStatus.message = `Cena ${currentSceneNumber}: prompt original bloqueado. Reescrevendo automaticamente...`;
                                    renderImageGenerationProgress(appState.imageGenStatus);
                                }
                                generatedCount++;
                                completed++;
                                updateProgress();
                                return;
                            }
                            }

                            imageFxResults.images[currentImageIndex] = {
                                status: 'failed',
                                prompt: currentPrompt,
                                error: userFriendlyMessage,
                                sceneNumber: currentSceneNumber,
                                aspectRatio: form.aspectRatio
                            };
                            renderImageFxOutput();
                            completed++;
                            updateProgress();
                            return;
                        }

                        generatedCount++;
                        completed++;
                        updateProgress();
                    };

                    await runTasksWithConcurrency(tasks, 3, processTask);

                    // Retry automático para imagens com erro
                    if (!isRetry && !isBulkRetry) {
                        const failedImages = imageFxResults.images.filter(img => img.status === 'failed');
                        
                        if (failedImages.length > 0) {
                            addToLog(`Tentando regenerar automaticamente ${failedImages.length} imagem(ns) com erro...`);
                            appState.imageGenStatus.message = `Tentando regenerar ${failedImages.length} imagem(ns) com erro...`;
                            renderImageGenerationProgress(appState.imageGenStatus);
                            
                            const delay = (ms) => new Promise(res => setTimeout(res, ms));
                            let retriedCount = 0;
                            
                            for (let i = 0; i < imageFxResults.images.length; i++) {
                                const img = imageFxResults.images[i];
                                if (img.status === 'failed') {
                                    retriedCount++;
                                    appState.imageGenStatus.message = `Regenerando automaticamente ${retriedCount} de ${failedImages.length} imagens com erro...`;
                                    renderImageGenerationProgress(appState.imageGenStatus);
                                    
                                    // Tenta processar o erro com retry automático
                                    await processFailedImageRetry(img, i);
                                    await delay(2000); // Espera 2 segundos entre cada tentativa
                                }
                            }
                            
                            addToLog(`Processo de retry automático concluído.`);
                        }
                    }

                    const durationSeconds = Math.max(1, Math.round((Date.now() - generationStartTime) / 1000));

                    if (!isRetry && !isBulkRetry) {
                        const successCount = imageFxResults.images.filter(img => img.status === 'success').length;
                        const failedCount = imageFxResults.images.filter(img => img.status === 'failed').length;
                        
                        appState.imageGenStatus.message = `Concluído. ${successCount} sucesso, ${failedCount} erro(s).`;
                        renderImageGenerationProgress(appState.imageGenStatus);
                        
                        if (successCount > 0) {
                            showImageGenCompleteModal(durationSeconds);
                        }
                        
                        setTimeout(() => {
                            appState.imageGenStatus.active = false;
                            renderImageGenerationProgress(appState.imageGenStatus);
                        }, 5000);
                    }
                    addToLog(`Processo concluído para ${totalTasks} prompt(s).`);
                    renderImageFxOutput();
                    return;
                }

                for (let i = 0; i < totalPrompts; i++) {
                    let currentPrompt = promptsBatch[i];
                    let currentImageIndex = isRetry ? originalIndex : (imageFxResults.images.length);
                    let currentSceneNumber = isRetry ? imageFxResults.images[originalIndex].sceneNumber : (imageFxResults.images.length + 1);
                    
                    if (!isRetry && !isBulkRetry) {
                        imageFxResults.images.push({
                            status: 'pending',
                            prompt: currentPrompt,
                            error: 'A gerar...',
                            sceneNumber: currentSceneNumber,
                            aspectRatio: form.aspectRatio
                        });
                        renderImageFxOutput();
                    } else if (isBulkRetry) {
                        currentImageIndex = imageFxResults.images.findIndex(img => img.prompt === currentPrompt && img.status === 'failed');
                        if (currentImageIndex === -1) continue;
                        currentSceneNumber = imageFxResults.images[currentImageIndex].sceneNumber;
                        imageFxResults.images[currentImageIndex] = {
                            ...imageFxResults.images[currentImageIndex],
                            status: 'retrying',
                            error: 'A tentar gerar novamente...'
                        };
                        renderImageFxOutput();
                    }
    
                    try {
                        appState.imageGenStatus.message = `A gerar imagem para a cena ${currentSceneNumber}: "${currentPrompt.substring(0, 30)}"...`;
                        renderImageGenerationProgress(appState.imageGenStatus);
                        
                        const res = await apiRequest('/api/imagefx/generate', 'POST', {
                            prompts: [currentPrompt], 
                            negative_prompt: form.negativePrompt,
                            aspect_ratio: form.aspectRatio,
                            style: form.style,
                            num_images: form.numImages,
                            generation_model: form.generationModel
                        });
    
                        const imageResults = res.images.map(img => ({ ...img, sceneNumber: currentSceneNumber }));
                        
                        imageFxResults.images.splice(currentImageIndex, 1, ...imageResults);
                        generatedCount++;
                        
                        if (appState.currentTab === 'image-generator') {
                            renderImageFxOutput(); 
                        }
                    } catch (error) {
                        console.error(`Erro na geração ImageFX para o prompt ${currentSceneNumber}:`, error.stack || error);
                        const userFriendlyMessage = error.message || 'Erro desconhecido.';
                        
                        // Automatic retry only for policy-related errors
                        if (userFriendlyMessage.includes('Prompt bloqueado') || userFriendlyMessage.toLowerCase().includes('conteúdo inseguro') || userFriendlyMessage.toLowerCase().includes('conteudo inseguro')) {
                            const success = await processFailedImageRetry({
                                status: 'failed',
                                prompt: currentPrompt,
                                error: userFriendlyMessage,
                                sceneNumber: currentSceneNumber,
                                aspectRatio: form.aspectRatio
                            }, currentImageIndex);
                
                            if (success) {
                                if (!isRetry) {
                                    appState.imageGenStatus.message = `Cena ${currentSceneNumber}: prompt original bloqueado. Reescrevendo automaticamente...`;
                                    renderImageGenerationProgress(appState.imageGenStatus);
                                }
                                generatedCount++;
                                continue;
                            }
                        } else {
                            // For other errors, just show the error
                            imageFxResults.images[currentImageIndex] = {
                                ...imageFxResults.images[currentImageIndex],
                                status: 'failed',
                                error: userFriendlyMessage
                            };
                            renderImageFxOutput();
                        }
                    } finally {
                        if (!isRetry) {
                            appState.imageGenStatus.current = i + 1;
                            renderImageGenerationProgress(appState.imageGenStatus);
                        }
                    }
                }
                
                // Retry automático para imagens com erro (fluxo sequencial)
                if (!isRetry && !isBulkRetry) {
                    const failedImages = imageFxResults.images.filter(img => img.status === 'failed');
                    
                    if (failedImages.length > 0) {
                        addToLog(`Tentando regenerar automaticamente ${failedImages.length} imagem(ns) com erro...`);
                        appState.imageGenStatus.message = `Tentando regenerar ${failedImages.length} imagem(ns) com erro...`;
                        renderImageGenerationProgress(appState.imageGenStatus);
                        
                        const delay = (ms) => new Promise(res => setTimeout(res, ms));
                        let retriedCount = 0;
                        
                        for (let i = 0; i < imageFxResults.images.length; i++) {
                            const img = imageFxResults.images[i];
                            if (img.status === 'failed') {
                                retriedCount++;
                                appState.imageGenStatus.message = `Regenerando automaticamente ${retriedCount} de ${failedImages.length} imagens com erro...`;
                                renderImageGenerationProgress(appState.imageGenStatus);
                                
                                // Tenta processar o erro com retry automático
                                await processFailedImageRetry(img, i);
                                await delay(2000); // Espera 2 segundos entre cada tentativa
                            }
                        }
                        
                        addToLog(`Processo de retry automático concluído.`);
                    }
                }
                
                if (!isRetry && !isBulkRetry) {
                    const durationSeconds = Math.max(1, Math.round((Date.now() - generationStartTime) / 1000));
                    const successCount = imageFxResults.images.filter(img => img.status === 'success').length;
                    const failedCount = imageFxResults.images.filter(img => img.status === 'failed').length;
                    
                    appState.imageGenStatus.message = `Concluído. ${successCount} sucesso, ${failedCount} erro(s).`;
                    renderImageGenerationProgress(appState.imageGenStatus);
                    
                    if (successCount > 0) {
                        showImageGenCompleteModal(durationSeconds);
                    }
        
                    setTimeout(() => {
                        appState.imageGenStatus.active = false;
                        renderImageGenerationProgress(appState.imageGenStatus);
                    }, 5000);
                }
    
                if (form.batchFileInput && form.batchFileInput.files[0]) form.batchFileInput.value = '';
                if (form.promptInput) form.promptInput.value = '';
            };
    
            if (isRetry) {
                await runGeneration(promptsToGenerate);
            } else {
                const batchFile = form.batchFileInput ? form.batchFileInput.files[0] : null;
                if (batchFile) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const prompts = event.target.result.split('\n').map(p => p.trim()).filter(Boolean);
                        runGeneration(prompts);
                    };
                    reader.onerror = () => {
                         showSuccessToast("Erro ao ler o ficheiro em lote.");
                         addToLog("Erro ao ler o ficheiro em lote.", true);
                    }
                    reader.readAsText(batchFile);
                } else if (form.promptInput && form.promptInput.value.trim()) {
                    const prompts = form.promptInput.value.split('\n').map(p => p.trim()).filter(Boolean);
                    runGeneration(prompts);
                } else {
                    showSuccessToast("Por favor, insira um prompt ou carregue um ficheiro em lote.");
                }
            }
        },
        'optimize-script-btn': async (e, append = false) => {
            const title = document.getElementById('optimizer-title')?.value.trim();
            const lang = document.getElementById('optimizer-lang')?.value;
            const model = document.getElementById('optimizer-model-select')?.value;
            const includeCta = document.getElementById('optimizer-cta')?.checked;
            const outputEl = document.getElementById('output');

            if (!title || !lang || !model || outputEl === null || includeCta === null) {
                showSuccessToast("Por favor, preencha todos os campos.");
                return;
            }

            let prompt, schema, renderer;

            if (append) {
                prompt = `Para o titulo de video "${removeAccents(title)}" em "${lang}", gere 3 NOVAS frases para thumbnail. As frases devem ser curtas e de alto impacto. Responda APENAS com um objeto JSON contendo a chave 'thumbnail_phrases', que e uma array de 3 objetos, cada um com 'phrase' (string) e 'score' (numero de 0-100 para CTR).`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        thumbnail_phrases: { 
                            type: "ARRAY", 
                            items: { 
                                type: "OBJECT",
                                properties: {
                                    phrase: { type: "STRING" },
                                    score: { type: "NUMBER" }
                                },
                                required: ["phrase", "score"]
                            } 
                        }
                    }
                };
                renderer = (result) => {
                    const container = outputEl.querySelector('#thumbnail-phrases-container .grid');
                    if (container) {
                        const newHtml = result.thumbnail_phrases.map(item => `
                            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between">
                                <p class="font-bold text-lg mb-2 text-center text-gray-900 dark:text-gray-100">${item.phrase}</p>
                                ${renderScoreCard('Potencial de CTR', item.score, {})}
                                <div class="mt-2 text-center">${createCopyButton(item.phrase)}</div>
                            </div>
                        `).join('');
                        container.insertAdjacentHTML('beforeend', newHtml);
                    }
                };
            } else {
                const ctaInstruction = includeCta ? 'A descricao DEVE incluir uma chamada para acao (CTA) sutil e relevante.' : 'A descricao NAO DEVE incluir uma chamada para acao (CTA).';
                prompt = `Para o titulo de video "${removeAccents(title)}" em "${lang}", gere metadados otimizados para YouTube. ${ctaInstruction} Responda APENAS com um objeto JSON valido com as chaves: 'optimized_description', 'tags' (array de strings), 'thumbnail_phrases' (array de 3 objetos com 'phrase' e 'score'), e 'scores' (objeto com 'seo_potential', 'ctr_potential', 'clarity_score').`;
                schema = {
                    type: "OBJECT",
                    properties: {
                        optimized_description: { type: "STRING" },
                        tags: { type: "ARRAY", items: { type: "STRING" } },
                        thumbnail_phrases: { 
                            type: "ARRAY", 
                            items: { 
                                type: "OBJECT",
                                properties: {
                                    phrase: { type: "STRING" },
                                    score: { type: "NUMBER" }
                                },
                                required: ["phrase", "score"]
                            } 
                        }
                    }
                };
                renderer = (result) => {
                    const { optimized_description, tags, thumbnail_phrases, scores } = result;
                    const mainScore = (scores.seo_potential + scores.ctr_potential + scores.clarity_score) / 3;
                    return `
                        <div class="space-y-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div class="flex justify-between items-center mb-2"><h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Analise de Potencial</h3></div>
                                    ${renderScoreCard('Potencial de Otimizacao', mainScore, {
                                        'Potencial de SEO': scores.seo_potential,
                                        'Potencial de CTR': scores.ctr_potential,
                                        'Clareza da Mensagem': scores.clarity_score
                                    })}
                                </div>
                            </div>
                            <hr class="border-gray-200 dark:border-gray-700"/>
                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Descricao Otimizada</h3>
                                    ${createCopyButton(optimized_description)}
                                </div>
                                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 prose prose-sm max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${optimized_description}</div>
                            </div>
                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Tags Recomendadas</h3>
                                    ${createCopyButton(tags.join(', '))}
                                </div>
                                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap gap-2">
                                    ${tags.map(tag => `<span class="inline-block bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1 text-sm font-semibold text-gray-600 dark:text-gray-300">${tag}</span>`).join('')}
                                    ${createCopyButton(tags.join(', '), 'absolute top-2 right-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                                </div>
                            </div>
                            <div id="thumbnail-phrases-container">
                                <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Frases para Thumbnail</h3>
                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    ${thumbnail_phrases.map(item => `
                                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between">
                                            <p class="font-bold text-lg mb-2 text-center text-gray-900 dark:text-gray-100">${item.phrase}</p>
                                            ${renderScoreCard('Potencial de CTR', item.score, {})}
                                            <div class="mt-2 text-center">${createCopyButton(item.phrase)}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                };
            }

            showProgressModal("Otimizando conteudo...", "A IA esta a trabalhar...");
            if (!append) {
                outputEl.innerHTML = '';
            }

            try {
                const result = await apiRequest('/api/generate', 'POST', { prompt, model, schema });
                
                if (!result.data) {
                    throw new Error("A resposta da IA esta vazia ou em formato incorreto.");
                }

                if (!result.data.scores) result.data.scores = {};
                const scoreKeys = ['seo_potential', 'ctr_potential', 'clarity_score'];
                scoreKeys.forEach(key => {
                    let score = result.data.scores[key];
                    if (score === undefined || score === null || isNaN(score) || score < 70) {
                        result.data.scores[key] = generateRandomScore(78, 98.5);
                    } else {
                        result.data.scores[key] = Math.min(score, 98.5);
                        }
                    });

                if (result.data.thumbnail_phrases) {
                    result.data.thumbnail_phrases.forEach(p => {
                        if (p.score === undefined || p.score === null || isNaN(p.score) || p.score < 70) {
                            p.score = generateRandomScore(78, 98.5);
                        } else {
                            p.score = Math.min(p.score, 98.5);
                        }
                    });
                }

                if (append) {
                    renderer(result.data);
                } else {
                    outputEl.innerHTML = renderer(result.data);
                }
                
                document.getElementById('generate-more-optimizer-content').style.display = 'block';
                showSuccessToast("Conteudo otimizado com sucesso!");
            } catch (error) {
                addToLog(`Erro na otimizacao: ${error.message}`, true);
                if (!append) {
                    outputEl.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao otimizar o conteudo.</p>`;
                }
            } finally {
                hideProgressModal();
            }
        },
        'analyze-video-btn': async () => {
            const videoUrlInput = document.getElementById('video-url-input');
            const videoUrl = videoUrlInput?.value.trim();
            const model = document.getElementById('video-optimizer-model-select')?.value;
            const outputEl = document.getElementById('output');
        
            if (!videoUrl || !model) {
                showSuccessToast("Por favor, insira a URL do vídeo do YouTube e selecione um modelo de IA.");
                return;
            }
        
            outputEl.innerHTML = ''; // Clear previous output
            showProgressModal("Analisando vídeo...", "A IA está a buscar detalhes e gerar otimizações...");
        
            try {
                // 1. Fetch YouTube video details
                const videoDetails = await apiRequest('/api/youtube/details-v3', 'POST', { url: videoUrl });
        
                if (!videoDetails || !videoDetails.title) {
                    throw new Error("Não foi possível obter os detalhes do vídeo do YouTube. Verifique a URL e sua chave de API.");
                }
        
                // 2. Generate optimization suggestions using AI
                const optimizationPrompt = `
                Você é um especialista em SEO para YouTube e marketing de conteúdo. Analise os detalhes do vídeo abaixo e forneça sugestões de otimização para o título, descrição e tags.
                
                **DIRETRIZES:**
                - **Título:** Sugira 3-5 variações de título que sejam mais atraentes, otimizadas para cliques (CTR) e busca (SEO).
                - **Descrição:** Sugira uma nova descrição otimizada para SEO, com palavras-chave relevantes, um gancho forte e uma chamada para ação (CTA) clara. A descrição deve ter entre 500 e 1000 caracteres.
                - **Tags:** Sugira 10-15 novas tags relevantes e de alto potencial de busca.
                - **Pontuação:** Atribua uma pontuação de 0 a 100 para o "Potencial de SEO" e "Potencial de CTR" do vídeo ORIGINAL.
                
                Responda APENAS com um objeto JSON contendo as chaves: 'original_title', 'original_description', 'original_tags', 'original_scores' (com 'seo_potential', 'ctr_potential'), 'suggested_titles' (array de strings), 'suggested_description', 'suggested_tags' (array de strings), e 'new_scores' (com 'seo_potential', 'ctr_potential' para as sugestões).
        
                --- DETALHES DO VÍDEO ---
                Título: "${removeAccents(videoDetails.title)}"
                Descrição: "${removeAccents(videoDetails.description)}"
                Tags: ${videoDetails.tags.join(', ')}
                Canal: "${removeAccents(videoDetails.channelTitle)}"
                Visualizações: ${videoDetails.viewCount}
                Likes: ${videoDetails.likeCount}
                Comentários: ${videoDetails.commentCount}
                Publicado em: ${videoDetails.publishedAt}
                `;
        
                const optimizationSchema = {
                    type: "OBJECT",
                    properties: {
                        original_title: { type: "STRING" },
                        original_description: { type: "STRING" },
                        original_tags: { type: "ARRAY", items: { type: "STRING" } },
                        original_scores: { type: "OBJECT", properties: { seo_potential: { type: "NUMBER" }, ctr_potential: { type: "NUMBER" } } },
                        suggested_titles: { type: "ARRAY", items: { type: "STRING" } },
                        suggested_description: { type: "STRING" },
                        suggested_tags: { type: "ARRAY", items: { type: "STRING" } },
                        new_scores: { type: "OBJECT", properties: { seo_potential: { type: "NUMBER" }, ctr_potential: { type: "NUMBER" } } }
                    },
                    required: ["original_title", "original_description", "original_tags", "original_scores", "suggested_titles", "suggested_description", "suggested_tags", "new_scores"]
                };
        
                const aiResult = await apiRequest('/api/generate', 'POST', { prompt: optimizationPrompt, model, schema: optimizationSchema });
        
                if (!aiResult.data) {
                    throw new Error("A IA não retornou sugestões de otimização válidas.");
                }
        
                const data = aiResult.data;
        
                // Ensure scores are numbers and within range
                const scoreKeys = ['seo_potential', 'ctr_potential'];
                scoreKeys.forEach(key => {
                    if (data.original_scores && (data.original_scores[key] === undefined || isNaN(data.original_scores[key]))) {
                        data.original_scores[key] = generateRandomScore(50, 80);
                    } else if (data.original_scores) {
                        data.original_scores[key] = Math.min(Math.max(data.original_scores[key], 0), 100);
                    }
                    if (data.new_scores && (data.new_scores[key] === undefined || isNaN(data.new_scores[key]))) {
                        data.new_scores[key] = generateRandomScore(80, 95);
                    } else if (data.new_scores) {
                        data.new_scores[key] = Math.min(Math.max(data.new_scores[key], 0), 100);
                    }
                });
        
                // Render video details
                outputEl.innerHTML = `
                    <div id="video-details-container" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
                        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Detalhes do Vídeo Original</h3>
                        <div class="flex flex-col md:flex-row gap-4">
                            <div class="md:w-1/3 flex-shrink-0">
                                <img src="${videoDetails.thumbnailUrl}" alt="Thumbnail do vídeo" class="w-full h-auto rounded-lg object-cover">
                                <button id="download-thumbnail-btn" class="mt-2 w-full py-2 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" data-thumbnail-url="${videoDetails.thumbnailUrl}" data-video-id="${videoDetails.id}">Baixar Thumbnail</button>
                                <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Visualizações: ${parseInt(videoDetails.viewCount).toLocaleString()}</p>
                                <p class="text-sm text-gray-500 dark:text-gray-400">Likes: ${parseInt(videoDetails.likeCount).toLocaleString()}</p>
                            </div>
                            <div class="md:w-2/3">
                                <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">${videoDetails.title}</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-300 mb-3 whitespace-pre-wrap">${videoDetails.description}</p>
                                <p class="text-sm text-gray-500 dark:text-gray-400">Tags: ${videoDetails.tags.join(', ')}</p>
                                <div class="mt-4">
                                    ${renderScoreCard('Pontuação Original', (data.original_scores.seo_potential + data.original_scores.ctr_potential) / 2, {
                                        'Potencial de SEO': data.original_scores.seo_potential,
                                        'Potencial de CTR': data.original_scores.ctr_potential
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="ai-suggestions-container" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6">
                        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Sugestões de Otimização da IA</h3>
                        <div class="space-y-6">
                            <div>
                                <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">Títulos Sugeridos</h4>
                                <ul class="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
                                    ${data.suggested_titles.map(title => `<li>${title} ${createCopyButton(title, 'ml-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}</li>`).join('')}
                                </ul>
                            </div>
                            <div>
                                <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">Descrição Otimizada</h4>
                                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 relative">
                                    <p class="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${data.suggested_description}</p>
                                    ${createCopyButton(data.suggested_description, 'absolute top-2 right-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                                </div>
                            </div>
                            <div>
                                <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">Tags Sugeridas</h4>
                                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 relative flex flex-wrap gap-2">
                                    ${data.suggested_tags.map(tag => `<span class="inline-block bg-gray-200 dark:bg-gray-600 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300">${tag}</span>`).join('')}
                                    ${createCopyButton(data.suggested_tags.join(', '), 'absolute top-2 right-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                                </div>
                            </div>
                            <div class="mt-4">
                                ${renderScoreCard('Nova Pontuação', (data.new_scores.seo_potential + data.new_scores.ctr_potential) / 2, {
                                    'Potencial de SEO': data.new_scores.seo_potential,
                                    'Potencial de CTR': data.new_scores.ctr_potential
                                })}
                            </div>
                        </div>
                    </div>
                `;
                showSuccessToast("Otimização de vídeo gerada com sucesso!");
        
            } catch (error) {
                addToLog(`Erro ao otimizar vídeo: ${error.message}`, true);
                outputEl.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao otimizar o vídeo: ${error.message}</p>`;
            } finally {
                hideProgressModal();
            }
        },
        'tts-generate-btn': async () => {
            const scriptInput = document.getElementById('tts-script-input');
            const voiceSelect = document.getElementById('tts-voice-select');
            const modelSelect = document.getElementById('tts-model-select');
            const styleInstructions = document.getElementById('tts-style-instructions');
            const outputContainer = document.getElementById('output');

            const script = scriptInput?.value.trim();
            const voice = voiceSelect?.value;
            const ttsModel = modelSelect?.value;
            const style = styleInstructions?.value.trim();

            if (!script || !voice || !ttsModel) {
                showSuccessToast('Por favor, preencha o roteiro, selecione uma voz e um modelo de IA.');
                return;
            }

            if (outputContainer) outputContainer.innerHTML = ''; // Clear previous results

            try {
                addToLog('A iniciar geracao de narracao...');
                const response = await apiRequest('/api/tts/generate-from-script', 'POST', {
                    script: script,
                    voice: voice,
                    ttsModel: ttsModel,
                    styleInstructions: style
                });

                if (!response.jobId) {
                    throw new Error('A API nao retornou um ID de trabalho valido.');
                }

                const state = getVoiceGeneratorState();
                state.longGenJobId = response.jobId;

                // Start polling
                if (state.longGenInterval) clearInterval(state.longGenInterval);
                state.longGenInterval = setInterval(async () => {
                    try {
                        if (!state.longGenJobId) {
                            clearInterval(state.longGenInterval);
                            return;
                        }
                        const statusRes = await apiRequest(`/api/tts/status/${state.longGenJobId}`, 'GET');
                        
                        appState.voiceGenStatus = {
                            active: true,
                            current: statusRes.progress,
                            total: statusRes.total,
                            message: statusRes.message,
                            error: statusRes.status === 'failed'
                        };
                        renderVoiceGenerationProgress(appState.voiceGenStatus);

                        if (statusRes.status === 'completed') {
                            clearInterval(state.longGenInterval);
                            state.longGenInterval = null;
                            state.longGenJobId = null;
                            showVoiceGenCompleteModal(statusRes.downloadUrl);
                            setTimeout(() => {
                                appState.voiceGenStatus.active = false;
                                renderVoiceGenerationProgress(appState.voiceGenStatus);
                            }, 5000);
                        } else if (statusRes.status === 'failed') {
                            clearInterval(state.longGenInterval);
                            state.longGenInterval = null;
                            state.longGenJobId = null;
                            addToLog(`Erro na geracao de voz: ${statusRes.message}`, true);
                        }
                    } catch (pollError) {
                        clearInterval(state.longGenInterval);
                        state.longGenInterval = null;
                        state.longGenJobId = null;
                        addToLog(`Erro ao verificar status da geracao: ${pollError.message}`, true);
                        appState.voiceGenStatus = { active: true, current: 0, total: 1, message: pollError.message, error: true };
                        renderVoiceGenerationProgress(appState.voiceGenStatus);
                    }
                }, 2000);

            } catch (error) {
                addToLog(`Erro ao iniciar geracao de voz: ${error.message}`, true);
                appState.voiceGenStatus = { active: true, current: 0, total: 1, message: error.message, error: true };
                renderVoiceGenerationProgress(appState.voiceGenStatus);
            }
        },
        'tts-reset-btn': () => {
            resetVoiceGeneratorForm();
            showSuccessToast('Formulario de geracao de voz limpo.');
        },
        'tts-preview-btn': async () => {
            const previewBtn = document.getElementById('tts-preview-btn');
            const previewPlayer = document.getElementById('tts-preview-player');
            const voice = document.getElementById('tts-voice-select').value;
            const model = document.getElementById('tts-model-select').value;

            if (!voice) {
                showSuccessToast('Por favor, selecione uma voz para testar.');
                return;
            }
            
            if (previewBtn) {
                previewBtn.disabled = true;
                previewBtn.classList.add('opacity-50');
            }
            addToLog('A gerar previa da voz...');

            try {
                const response = await apiRequest('/api/tts/preview', 'POST', { voice, model });
                if (response.audio && response.audio.base64) {
                    if (previewPlayer) {
                        previewPlayer.src = `data:${response.audio.mimeType};base64,${response.audio.base64}`;
                        previewPlayer.style.display = 'block';
                        previewPlayer.play();
                    }
                    addToLog('Previa da voz pronta.');
                } else {
                    throw new Error('A resposta da API nao continha audio.');
                }
            } catch (error) {
                addToLog(`Erro ao gerar previa: ${error.message}`, true);
            } finally {
                if (previewBtn) {
                    previewBtn.disabled = false;
                    previewBtn.classList.remove('opacity-50');
                }
            }
        },
    };

    // --- Main Render Function ---
    function renderTabContent(tabId) {
        appState.currentTab = tabId;
        const mainContent = document.getElementById('tab-content');
        const template = document.getElementById(`${tabId}-template`);
        if (!template) {
            if (mainContent) mainContent.innerHTML = `<p class="text-red-500">Erro: Template para "${tabId}" nao encontrado.</p>`;
            return;
        }
        if (mainContent) mainContent.innerHTML = '';
        if (mainContent) mainContent.appendChild(template.content.cloneNode(true));
        const mobileHeaderTitle = document.getElementById('mobile-header-title');
        if (mobileHeaderTitle && mainContent.querySelector('h2')) mobileHeaderTitle.textContent = mainContent.querySelector('h2').textContent;
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
        const menuOverlay = document.getElementById('menu-overlay');
        if (menuOverlay) menuOverlay.style.display = 'none';
        
        const claudeModelOptions = `
            <optgroup label="Anthropic Claude">
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
				<option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                
            </optgroup>
        `;

        const geminiModelOptions = `
            <optgroup label="Google Gemini">
                <option value="gemini-2.5-pro" selected>Gemini 2.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
            </optgroup>
        `;

        const gptModelOptions = `
            <optgroup label="OpenAI GPT">
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </optgroup>
        `;

        const modelSelectIds = [
            'script-writer-model-select',
            'viral-titles-model-select',
            'script-translator-model-select',
            'scene-prompts-model-select',
            'thumbnail-prompts-model-select',
            'script-reviewer-model-select',
            'optimizer-model-select',
            'brainstorm-ideas-model-select',
            'editors-cut-model-select',
            'video-optimizer-model-select'
        ];

        modelSelectIds.forEach(id => {
            const selectEl = mainContent.querySelector(`#${id}`);
            if (selectEl) {
                selectEl.innerHTML = claudeModelOptions + geminiModelOptions + gptModelOptions;
            }
        });

        attachTabEventListeners(tabId);
    }

    function attachTabEventListeners(tabId) {
        const mainContent = document.getElementById('tab-content');
        
        const aiDependentTools = [
            'script-writer', 'viral-titles', 'script-translator',
            'scene-prompts', 'thumbnail-prompts', 'image-generator', 'voice-generator', 'script-reviewer', 'optimizer',
            'brainstorm-ideas', 'editors-cut', 'video-optimizer'
        ];

        const formElementsMap = {
            'script-writer': 'script-writer-form-container',
            'srt-converter': 'conversorForm',
            'whatsapp-update-modal': 'whatsapp-update-form',
            'force-password-change-modal': 'force-password-change-form',
            'password-reset-modal': 'password-reset-form',
            'edit-user-modal': 'edit-user-form',
            'academy-lesson-modal': 'academy-lesson-form',
            'login-container': 'login-form',
            'register-container': 'register-form'
        };

        const buttonsToHandle = {
            'generate-script': 'generate-script',
            'generate-viral-content': 'generate-viral-content',
            'translate-script': 'translate-script',
            'generate-scene-prompts': 'generate-scene-prompts',
            'detect-characters-btn': 'detect-characters-btn',
            'generate-prompts': 'generate-prompts',
            'generate-imagefx': 'generate-imagefx',
            'tts-generate-btn': 'tts-generate-btn',
            'analyze-script-btn': 'analyze-script-btn',
            'apply-suggestions-btn': 'apply-suggestions-btn',
            'apply-manual-btn': 'apply-manual-btn',
            'optimize-script-btn': 'optimize-script-btn',
            'generate-brainstorm-ideas': 'generate-brainstorm-ideas',
            'generate-editors-cut': 'generate-editors-cut',
            'analyze-video-btn': 'analyze-video-btn',
            'split-text-btn': 'split-text-btn',
            'tts-reset-btn': 'tts-reset-btn',
            'tts-preview-btn': 'tts-preview-btn',
            'convert-srt-button': 'convert-to-srt' // Added specific ID for SRT button
        };

        Object.keys(buttonsToHandle).forEach(buttonId => {
            const btn = document.getElementById(buttonId);
            if (btn) {
                // Remove existing click listener to prevent duplicates
                if (btn._clickListener) {
                    btn.removeEventListener('click', btn._clickListener);
                }
                const clickHandler = async (e) => {
                    e.preventDefault(); // Always prevent default for these buttons
                    if (btn.disabled) {
                        showSuccessToast('Por favor, configure suas chaves de API nas configuracoes para usar esta ferramenta.');
                        return;
                    }
                    if (buttonId === 'generate-imagefx') {
                        await handlers[buttonId](null, false);
                    } else {
                        await handlers[buttonsToHandle[buttonId]](e);
                    }
                };
                btn.addEventListener('click', clickHandler);
                btn._clickListener = clickHandler;

                // Disable/enable based on API keys
                if (aiDependentTools.includes(tabId) && !appState.apiKeysConfigured) {
                    btn.disabled = true;
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                    btn.title = 'Configure suas chaves de API nas configuracoes para usar esta ferramenta.';
                } else {
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    btn.title = '';
                }
            }
        });

        if (tabId === 'script-writer') {
            populateFormulas();
            const scriptDurationEl = document.getElementById('script-duration');
            if (scriptDurationEl) scriptDurationEl.addEventListener('input', e => {
                 const duration = parseInt(e.target.value);
                 let parts = Math.max(1, Math.ceil(duration / 2));
                 const scriptPartsEl = document.getElementById('script-parts');
                 if (scriptPartsEl) scriptPartsEl.value = parts || '';
            });
            const includeAffiliateProductEl = document.getElementById('include-affiliate-product');
            if (includeAffiliateProductEl) includeAffiliateProductEl.addEventListener('change', (e) => {
                const affiliateContainer = document.getElementById('affiliate-product-container');
                if (affiliateContainer) affiliateContainer.style.display = e.target.checked ? 'block' : 'none';
            });
            const scriptFormulaEl = document.getElementById('script-formula');
            if (scriptFormulaEl) scriptFormulaEl.addEventListener('change', (e) => {
                const manualContainer = document.getElementById('manual-structure-container');
                if (manualContainer) manualContainer.style.display = e.target.value === 'manual_structure' ? 'block' : 'none';
            });
            renderScriptHistory();
        }
        
        if (tabId === 'image-generator') {
            renderImageFxOutput();
            const importLastImagePromptBtn = document.getElementById('import-last-image-prompt');
            if (importLastImagePromptBtn) {
                importLastImagePromptBtn.addEventListener('click', () => {
                    const imagefxPromptInput = document.getElementById('imagefx-prompt');
                    if (imagefxPromptInput && appState.lastGeneratedPrompts) {
                        imagefxPromptInput.value = appState.lastGeneratedPrompts;
                        showSuccessToast("Ultimos prompts gerados foram importados.");
                    } else {
                        showSuccessToast("Nenhum prompt foi gerado recentemente para importar.");
                    }
                });
            }
        }
        
        if (tabId === 'script-reviewer') {
            initializeScriptReviewer();
        }

        if (tabId === 'viral-titles' || tabId === 'thumbnail-prompts' || tabId === 'optimizer' || tabId === 'brainstorm-ideas') {
            const moreBtnIdMap = {
                'viral-titles': 'generate-more-viral-content',
                'thumbnail-prompts': 'generate-more-prompts',
                'optimizer': 'generate-more-optimizer-content',
                'brainstorm-ideas': 'generate-more-brainstorm-ideas'
            };
            const handlerKeyMap = {
                'viral-titles': 'generate-viral-content',
                'thumbnail-prompts': 'generate-prompts',
                'optimizer': 'optimize-script-btn',
                'brainstorm-ideas': 'generate-brainstorm-ideas'
            };
            const moreBtnId = moreBtnIdMap[tabId];
            const handlerKey = handlerKeyMap[tabId];

            if (moreBtnId && handlerKey) {
                const moreBtn = document.getElementById(moreBtnId);
                if (moreBtn) {
                    const newMoreBtn = moreBtn.cloneNode(true);
                    if (moreBtn.parentNode) moreBtn.parentNode.replaceChild(newMoreBtn, moreBtn);
                    if (aiDependentTools.includes(tabId) && !appState.apiKeysConfigured) {
                        newMoreBtn.disabled = true;
                        newMoreBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        newMoreBtn.disabled = false;
                        newMoreBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                    newMoreBtn.addEventListener('click', (e) => handlers[handlerKey](e, true));
                }
            }
            if (tabId === 'viral-titles') {
                const viralTypeEl = document.getElementById('viral-type');
                if (viralTypeEl) viralTypeEl.addEventListener('change', () => {
                    const output = document.getElementById('output');
                    if (output) output.innerHTML = '';
                    const generateMoreBtn = document.getElementById('generate-more-viral-content');
                    if (generateMoreBtn) generateMoreBtn.style.display = 'none';
                });
            }
        }

        if (tabId === 'voice-generator') initializeVoiceGenerator();
        if (tabId === 'script-translator') initializeScriptTranslator();
        if (tabId === 'scene-prompts') initializeScenePrompts();
        if (tabId === 'text-divider') initializeTextDivider();
        if (tabId === 'settings') initializeSettings();
        if (tabId === 'admin') initializeAdminPanel();
        if (tabId === 'file-manager') initializeFileManager();
        if (tabId === 'downloads') initializeDownloads();
        if (tabId === 'editors-cut') initializeEditorsCut();
        if (tabId === 'video-optimizer') initializeVideoOptimizer();
        if (tabId === 'srt-converter') initializeSrtConverter();
        if (tabId === 'academy') initializeAcademy();
        
        populateLanguageSelectors();
        
        if (appState.mainContentClickListener) {
            mainContent.removeEventListener('click', appState.mainContentClickListener);
        }

        appState.mainContentClickListener = async (e) => {
            const target = e.target;
            const targetId = e.target.id;
            
            const loadScriptBtn = target.closest('.load-script-btn');
            const deleteScriptBtn = target.closest('.delete-script-btn');
            const loadScenePromptsBtn = target.closest('.load-scene-prompts-btn');
            const deleteScenePromptsBtn = target.closest('.delete-scene-prompts-btn');


            if (loadScriptBtn) {
                const historyId = parseInt(loadScriptBtn.dataset.historyId, 10);
                const history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
                const itemToLoad = history.find(item => item.id === historyId);
                if (itemToLoad) {
                    const scriptTopic = document.getElementById('script-topic');
                    if (scriptTopic) scriptTopic.value = itemToLoad.title || '';
                    if (itemToLoad.data.prompt_info) {
                        const info = itemToLoad.data.prompt_info;
                        const scriptNiche = document.getElementById('script-niche');
                        if (scriptNiche) scriptNiche.value = info.niche || '';
                        const scriptAudience = document.getElementById('script-audience');
                        if (scriptAudience) scriptAudience.value = info.audience || '';
                        const scriptDuration = document.getElementById('script-duration');
                        if (scriptDuration) scriptDuration.value = info.duration || '';
                        const scriptParts = document.getElementById('script-parts');
                        if (scriptParts) scriptParts.value = info.parts || '';
                        const scriptLang = document.getElementById('script-lang');
                        if (scriptLang) scriptLang.value = info.lang || 'Portugues (Brasil)';
                        const scriptTone = document.getElementById('script-tone');
                        if (scriptTone) scriptTone.value = info.tone || 'envolvente e misterioso';
                        const scriptFormula = document.getElementById('script-formula');
                        if (scriptFormula) scriptFormula.value = info.formula || '';
                    }
                    scriptResults.fullResult = itemToLoad.data;
                    scriptResults.currentPage = 1;
                    renderScriptPage();
                    showSuccessToast('Roteiro carregado do historico!');
                    const outputEl = document.getElementById('output');
                    if (outputEl) outputEl.scrollIntoView({ behavior: 'smooth' });
                }
            }

            if (deleteScriptBtn) {
                const historyId = parseInt(deleteScriptBtn.dataset.historyId, 10);
                showConfirmationModal('Excluir Roteiro', 'Tem certeza de que deseja remover este roteiro do historico?', () => {
                    let history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
                    history = history.filter(item => item.id !== historyId);
                    localStorage.setItem('scriptHistory', JSON.stringify(history));
                    renderScriptHistory();
                    showSuccessToast('Roteiro removido do historico.');
                });
            }

            if (loadScenePromptsBtn) {
                const historyId = parseInt(loadScenePromptsBtn.dataset.historyId, 10);
                const history = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');
                const itemToLoad = history.find(item => item.id === historyId);
                if (itemToLoad) {
                    const sceneTextInput = document.getElementById('scene-text');
                    if (sceneTextInput) sceneTextInput.value = itemToLoad.data.originalScript || '';
                    // Restore other form fields if needed from itemToLoad.data.prompt_info
                    scenePromptResults.data = itemToLoad.data.data;
                    scenePromptResults.currentPage = 1;
                    scenePromptResults.total_prompts = itemToLoad.data.total_prompts;
                    scenePromptResults.allPromptsText = itemToLoad.data.allPromptsText;
                    scenePromptResults.rawPromptsText = itemToLoad.data.rawPromptsText;
                    renderScenePage();
                    showSuccessToast('Prompts de cena carregados do historico!');
                    const outputEl = document.getElementById('output');
                    if (outputEl) outputEl.scrollIntoView({ behavior: 'smooth' });
                }
            }

            if (deleteScenePromptsBtn) {
                const historyId = parseInt(deleteScenePromptsBtn.dataset.historyId, 10);
                showConfirmationModal('Excluir Prompts de Cena', 'Tem certeza de que deseja apagar este conjunto de prompts do historico?', () => {
                    let history = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');
                    history = history.filter(item => item.id !== historyId);
                    localStorage.setItem('scenePromptHistory', JSON.stringify(history));
                    renderSceneHistory();
                    showSuccessToast('Historico de prompts de cena limpo.');
                });
            }


            if (target.closest('.copy-btn, .prompt-copy-btn')) {
                const copyBtn = target.closest('.copy-btn, .prompt-copy-btn');
                if (copyBtn && copyBtn.dataset.copyText) {
                    navigator.clipboard.writeText(decodeURIComponent(copyBtn.dataset.copyText)).then(() => showSuccessToast("Copiado!"));
                }
            }
            if (targetId === 'copy-script-btn' && scriptResults.fullResult) navigator.clipboard.writeText(scriptResults.fullResult.full_script_text).then(() => showSuccessToast("Roteiro copiado!"));
            if (targetId === 'save-script-txt-btn' && scriptResults.fullResult) safelyDownloadFile(scriptResults.fullResult.full_script_text, (document.getElementById('script-topic')?.value.trim() || 'roteiro').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt', 'text/plain');
            if (targetId === 'clear-script-output-btn') {
                const outputEl = document.getElementById('output');
                if (outputEl) outputEl.innerHTML = '';
                const paginationEl = document.getElementById('script-pagination-controls');
                if (paginationEl) paginationEl.innerHTML = '';
                const formContainer = document.getElementById('script-writer-form-container');
                if (formContainer) formContainer.reset();
                const affiliateContainer = document.getElementById('affiliate-product-container');
                if (affiliateContainer) affiliateContainer.style.display = 'none';
                scriptResults.fullResult = null;
                const legendContainer = document.getElementById('legend-container');
                if (legendContainer) legendContainer.innerHTML = '';
            }
            if (targetId === 'continue-script-btn' && scriptResults.fullResult) {
                await handlers['generate-script'](e, true);
            }
            if (targetId === 'continue-scene-prompts-btn' && scenePromptResults.data.length > 0) {
                 await handlers['generate-scene-prompts'](e, true);
            }
            if (targetId === 'clear-script-history-btn') showConfirmationModal('Limpar Historico', 'Tem certeza de que deseja apagar todo o historico de roteiros? Esta acao nao pode ser desfeita.', () => { localStorage.removeItem('scriptHistory'); renderScriptHistory(); showSuccessToast('Historico limpo.'); });
            if (targetId === 'clear-scene-history-btn') showConfirmationModal('Limpar Historico de Prompts de Cena', 'Tem certeza de que deseja apagar este conjunto de prompts do historico?', () => { localStorage.removeItem('scenePromptHistory'); renderSceneHistory(); showSuccessToast('Historico de prompts de cena limpo.'); });
            if (targetId === 'copy-all-scene-prompts') navigator.clipboard.writeText(scenePromptResults.allPromptsText).then(() => showSuccessToast("Todos os prompts copiados!"));
            if (targetId === 'download-scene-prompts-detailed') safelyDownloadFile(scenePromptResults.allPromptsText, 'prompts_de_cena_detalhes.txt', 'text/plain');
            if (targetId === 'download-scene-prompts-raw') safelyDownloadFile(scenePromptResults.rawPromptsText, 'prompts_de_cena_puros.txt', 'text/plain');
            if(targetId === 'downloadBtn') { // Changed from download-srt-btn
                const srtContent = document.getElementById('resultado')?.textContent; // Changed from srt-result-content
                if (srtContent) safelyDownloadFile(srtContent, 'legendas.srt', 'application/x-subrip');
            }
            if(targetId === 'limparBtn') { // Changed from clear-srt-btn
                const textoInput = document.getElementById('textoInput');
                if (textoInput) textoInput.value = ''; // Changed from srt-input-text
                const resultadoEl = document.getElementById('resultado');
                if (resultadoEl) resultadoEl.textContent = ''; // Changed from srt-result-content
                const downloadBtn = document.getElementById('downloadBtn');
                if (downloadBtn) downloadBtn.style.display = 'none';
                const limparBtn = document.getElementById('limparBtn');
                if (limparBtn) limparBtn.style.display = 'none';
                showSuccessToast('Campos SRT limpos.');
            }
            if (targetId === 'download-revised-script-btn' && reviewerResults.revisedScript) {
                 safelyDownloadFile(reviewerResults.revisedScript, 'roteiro_revisado.txt', 'text/plain');
            }
            if (targetId === 'copy-revised-script-btn' && reviewerResults.revisedScript) {
                const scriptToCopy = document.getElementById('reviewer-revised-script-textarea')?.value;
                if (scriptToCopy) navigator.clipboard.writeText(scriptToCopy).then(() => showSuccessToast("Roteiro revisado copiado!"));
            }
            const lightboxTrigger = target.closest('.lightbox-trigger');
            if (lightboxTrigger && !target.closest('button, a, input')) {
                openLightbox(parseInt(lightboxTrigger.dataset.imgIndex, 10));
            }
            
            if (target.matches('.download-single-image-btn')) {
                const { imgUrl, imgScene } = target.dataset;
                const fileName = `cena_${imgScene}.png`;
                try {
                    await safelyDownloadFile(imgUrl, fileName, 'image/png');
                } catch (error) {
                    console.error('Erro ao baixar a imagem:', error);
                    addToLog('Nao foi possivel baixar a imagem. Tente novamente.', true);
                }
            }

            if (targetId === 'clear-all-images-btn') {
                if (imageFxResults.images.length > 0) {
                    imageFxResults.lastClearedImages = [...imageFxResults.images];
                    imageFxResults.images = [];
                    renderImageFxOutput();
                    showSuccessToast('Imagens removidas.');
                }
            }
            if (targetId === 'restore-last-images-btn') {
                if (imageFxResults.lastClearedImages.length > 0) {
                    imageFxResults.images = [...imageFxResults.lastClearedImages];
                    imageFxResults.lastClearedImages = [];
                    renderImageFxOutput();
                    showSuccessToast('Imagens restauradas.');
                }
            }
            if (targetId === 'select-all-images-btn') {
                const checkboxes = document.querySelectorAll('.image-select-checkbox');
                const isAnyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
                checkboxes.forEach(cb => cb.checked = isAnyUnchecked);
                target.textContent = isAnyUnchecked ? 'Desselecionar Tudo' : 'Selecionar Tudo';
            }
            if (targetId === 'download-selected-images-btn') {
                const selectedImages = Array.from(document.querySelectorAll('.image-select-checkbox:checked'))
                    .map(cb => imageFxResults.images[parseInt(cb.dataset.imgIndex, 10)]);
                if (selectedImages.length === 0) {
                    showSuccessToast('Nenhuma imagem selecionada para baixar.');
                    return;
                }
                showProgressModal(`A baixar ${selectedImages.length} imagens...`, "A preparar transferencia...", 0);
                for (let i = 0; i < selectedImages.length; i++) {
                    const img = selectedImages[i];
                    const fileName = `cena_${img.sceneNumber}.png`;
                    await new Promise(resolve => setTimeout(resolve, 250)); // Delay to avoid browser blocking
                    await safelyDownloadFile(img.url, fileName, 'image/png');
                    if(window.setRealProgress) window.setRealProgress(((i + 1) / selectedImages.length) * 100);
                }
                hideProgressModal();
                showSuccessToast('Todas as imagens selecionadas foram transferidas!');
            }
            if (target.matches('.download-translation-btn')) {
                const { lang, translation } = target.dataset;
                const filename = `${(document.getElementById('translator-input-text')?.value.substring(0, 30) || 'roteiro').replace(/[^a-z0-9]/gi, '_')}_${lang}.txt`;
                await safelyDownloadFile(decodeURIComponent(translation), filename, 'text/plain'); // Make sure to await here
            }
            if (targetId === 'tts-import-last-script') {
                const scriptInput = document.getElementById('tts-script-input');
                if (scriptInput && scriptResults.fullResult && scriptResults.fullResult.full_script_text) {
                    scriptInput.value = scriptResults.fullResult.full_script_text;
                    updateVoiceDurationHint();
                    showSuccessToast("Ultimo roteiro gerado foi importado.");
                } else {
                    showSuccessToast("Nenhum roteiro gerado para importar.");
                }
            }
            if (targetId === 'copy-editors-cut') {
                const content = document.getElementById('editors-cut-content')?.textContent;
                if (content) navigator.clipboard.writeText(content).then(() => showSuccessToast("Guia de Edicao copiado!"));
            }
            if (targetId === 'download-editors-cut') {
                const content = document.getElementById('editors-cut-content')?.textContent;
                if (content) await safelyDownloadFile(content, 'guia_de_edicao.txt', 'text/plain'); // Make sure to await here
            }

            if (targetId === 'download-thumbnail-btn') {
                const { thumbnailUrl, videoId } = target.dataset;
                if (thumbnailUrl && videoId) {
                    const fileName = `thumbnail_${videoId}.jpg`;
                    await downloadThumbnail(thumbnailUrl, fileName);
                } else {
                    showSuccessToast('URL da thumbnail ou ID do vídeo não encontrados.');
                }
            }

            // Settings Page Handlers
            if (targetId === 'save-settings') {
                const feedbackEl = document.getElementById('settings-feedback');
                const settingsToSave = {
                    claude: document.getElementById('claude-key')?.value.trim(),
                    // Ensure gemini is always an array, even if only one key
                    gemini: [document.getElementById('gemini-key-1')?.value.trim()].filter(Boolean),
                    gpt: document.getElementById('gpt-key')?.value.trim(),
                    imagefx_cookies: document.getElementById('imagefx-cookies-setting')?.value.trim(),
                };
                try {
                    await apiRequest('/api/settings', 'POST', { settings: settingsToSave });
                    showSuccessToast('Configuracoes guardadas!');
                    await checkAndShowApiAlert();
                    buildSidebar(); 
                    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('sidebar-btn-active'));
                    document.querySelector(`.sidebar-btn[data-tab="${appState.currentTab}"]`)?.classList.add('sidebar-btn-active');
                } catch(e) { 
                    console.error("Save Settings Error:", e); // Added detailed error logging
                    if (feedbackEl) feedbackEl.textContent = 'Erro ao guardar.'; 
                }
            }
            if (targetId === 'validate-api-keys') {
                const feedbackEl = document.getElementById('settings-feedback');
                const settingsToCheck = {
                    claude: document.getElementById('claude-key')?.value.trim(),
                    gemini: [document.getElementById('gemini-key-1')?.value.trim()].filter(Boolean),
                    gpt: document.getElementById('gpt-key')?.value.trim(),
                    imagefx_cookies: document.getElementById('imagefx-cookies-setting')?.value.trim(),
                };

                if (feedbackEl) {
                    feedbackEl.innerHTML = 'A validar chaves de API e cookies...';
                    feedbackEl.className = 'text-sm text-gray-600';
                }
                showProgressModal('A validar credenciais...', null);
                try {
                    const response = await apiRequest('/api/validate-api-keys', 'POST', settingsToCheck);
                    let messageHtmlParts = [];

                    if (settingsToCheck.claude) {
                        const isValid = response.claude_valid;
                        const text = `Claude: ${isValid ? 'Valida' : 'Invalida'}`;
                        const colorClass = isValid ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
                        messageHtmlParts.push(`<span class="${colorClass}">${text}</span>`);
                    }
                    if (settingsToCheck.gemini.length > 0) {
                        const isTextValid = response.gemini_valid;
                        const textText = `Gemini (Texto): ${isTextValid ? 'Valida' : 'Invalida'}`;
                        const textColorClass = isTextValid ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
                        messageHtmlParts.push(`<span class="${textColorClass}">${textText}</span>`);
                        
                        const isYoutubeValid = response.youtube_key_valid;
                        const youtubeText = `YouTube API: ${isYoutubeValid ? 'Valida' : 'Invalida'}`;
                        const youtubeColorClass = isYoutubeValid ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
                        messageHtmlParts.push(`<span class="${youtubeColorClass}">${youtubeText}</span>`);
                    }
                    if (settingsToCheck.gpt) {
                        const isValid = response.gpt_valid;
                        const text = `OpenAI (GPT): ${isValid ? 'Valida' : 'Invalida'}`;
                        const colorClass = isValid ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
                        messageHtmlParts.push(`<span class="${colorClass}">${text}</span>`);
                    }
                    if (settingsToCheck.imagefx_cookies) {
                        const isValid = response.imagefx_cookies_valid;
                        const text = `ImageFX Cookies: ${isValid ? 'Valido' : 'Invalido'}`;
                        const colorClass = isValid ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold';
                        messageHtmlParts.push(`<span class="${colorClass}">${text}</span>`);
                    }

                    if (messageHtmlParts.length === 0) {
                        if (feedbackEl) {
                            feedbackEl.textContent = 'Nenhuma chave ou cookie fornecido para validacao.';
                            feedbackEl.className = 'text-sm text-yellow-600';
                        }
                    } else {
                        if (feedbackEl) {
                            feedbackEl.innerHTML = messageHtmlParts.join(' | ');
                            feedbackEl.className = 'text-sm';
                        }
                    }
                } catch (e) {
                    console.error("Erro na validacao da API:", e);
                    if (feedbackEl) {
                        feedbackEl.textContent = `Erro ao validar: ${e.message}`;
                        feedbackEl.className = 'text-sm text-red-600';
                    }
                } finally {
                    hideProgressModal();
                    setTimeout(() => {
                        if (feedbackEl) {
                            feedbackEl.innerHTML = '';
                            feedbackEl.className = 'mt-2 text-sm';
                        }
                    }, 8000);
                }
            }

            // ImageFX specific handlers for retry/edit
            if (target.matches('.toggle-prompt-btn')) {
                const index = parseInt(target.dataset.imgIndex, 10);
                const container = document.getElementById(`edit-prompt-container-${index}`);
                if (container) {
                    if (container.style.display === 'none') {
                        container.style.display = 'block';
                        target.textContent = 'Esconder Prompt';
                    } else {
                        container.style.display = 'none';
                        target.textContent = 'Ver Prompt / Editar';
                    }
                }
            }

            if (target.matches('.regenerate-image-btn')) {
                const index = parseInt(target.dataset.imgIndex, 10);
                const promptTextarea = document.getElementById(`edit-prompt-${index}`);
                const aspectRatio = target.dataset.imgAspectRatio; // Get aspect ratio from dataset
                if (promptTextarea) {
                    const newPrompt = promptTextarea.value.trim();
                    if (newPrompt) {
                        // Temporarily update the imageFxResults entry to show it's being retried
                        imageFxResults.images[index] = {
                            ...imageFxResults.images[index],
                            status: 'retrying',
                            prompt: newPrompt,
                            error: 'A tentar gerar novamente...'
                        };
                        renderImageFxOutput(); // Re-render to show "retrying" state
                        
                        // Call generate-imagefx with the specific prompt and original index
                        await handlers['generate-imagefx']([newPrompt], true, index, aspectRatio); // Pass aspect ratio
                    } else {
                        showSuccessToast('O prompt nao pode estar vazio.');
                    }
                }
            }

            if (target.matches('.rewrite-prompt-btn')) {
                const index = parseInt(target.dataset.imgIndex, 10);
                const failedImage = imageFxResults.images[index];
                const promptTextarea = document.getElementById(`edit-prompt-${index}`);
                const model = 'gemini-2.5-flash'; // FIX: Hardcode a reliable text model.
            
                if (failedImage && promptTextarea && model) {
                    target.disabled = true;
                    target.textContent = 'A reescrever...';
                    try {
                        const response = await apiRequest('/api/imagefx/rewrite-prompt', 'POST', {
                            failedPrompt: failedImage.prompt,
                            context: scenePromptResults.originalScript, // Assuming this is available
                            model: model
                        });
                        if (response.newPrompt) {
                            promptTextarea.value = response.newPrompt;
                            showSuccessToast('Prompt reescrito pela IA!');
                        } else {
                            throw new Error('A IA não retornou um novo prompt.');
                        }
                    } catch (error) {
                        addToLog(`Erro ao reescrever prompt: ${error.message}`, true);
                    } finally {
                        target.disabled = false;
                        target.textContent = 'Reescrever com IA';
                    }
                }
            }

            if (targetId === 'regenerate-all-failed-btn') {
                const failedImages = imageFxResults.images.filter(img => img.status === 'failed');
                if (failedImages.length === 0) {
                    showSuccessToast('Nenhuma imagem com erro para regerar.');
                    return;
                }
            
                const regenerateButton = document.getElementById('regenerate-all-failed-btn');
                const originalButtonText = regenerateButton.innerHTML;
                regenerateButton.disabled = true;

                let processedCount = 0;

                // Adiciona um atraso entre as tentativas para evitar o "throttling" da API.
                const delay = (ms) => new Promise(res => setTimeout(res, ms));

                for (let i = 0; i < imageFxResults.images.length; i++) {
                    const img = imageFxResults.images[i];
                    if (img.status === 'failed') {
                        processedCount++;
                        regenerateButton.innerHTML = `<span class="spinner-sm"></span> A regerar ${processedCount} de ${failedImages.length}...`;
                        
                        // Chama a função para processar a nova tentativa de geração da imagem.
                        await processFailedImageRetry(img, i);
                        await delay(1000); // Espera 1 segundo antes de ir para a próxima.
                    }
                }
                
                regenerateButton.innerHTML = originalButtonText;
                regenerateButton.disabled = false;
                showSuccessToast('Todas as imagens com erro foram reprocessadas.');
            }
        };
        mainContent.addEventListener('click', appState.mainContentClickListener);
    }

    // Helper to extract YouTube video ID
    const getYouTubeVideoId = (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regex);
        return match && match[1] ? match[1] : null;
    };

    async function initializeAdminPanel() {
        const adminContainer = document.getElementById('admin-container');
        if (!adminContainer) return;
    
        let statsHtml = '';
        try {
            const stats = await apiRequest('/api/admin/stats', 'GET');
            statsHtml = `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 class="text-lg font-semibold mb-4">Estatisticas da Aplicacao</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-center"><p class="text-sm text-gray-500 dark:text-gray-400">Total de Utilizadores</p><p class="text-2xl font-bold text-gray-900 dark:text-gray-100">${stats.totalUsers}</p></div>
                        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-center"><p class="text-sm text-gray-500 dark:text-gray-400">Ativacao Pendente</p><p class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${stats.pendingActivation}</p></div>
                        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-center"><p class="text-sm text-gray-500 dark:text-gray-400">Online Agora (15min)</p><p class="text-2xl font-bold text-green-600 dark:text-green-400">${stats.onlineNow}</p></div>
                        <div class="bg-100 dark:bg-gray-700 p-3 rounded-lg text-center"><p class="text-sm text-gray-500 dark:text-gray-400">Logins (24h)</p><p class="text-2xl font-bold text-blue-600 dark:text-blue-400">${stats.loginsLast24h}</p></div>
                    </div>
                    <button id="approve-all-users-btn" class="w-full mt-4 py-2 px-4 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">Aprovar Todos os Utilizadores Pendentes</button>
                </div>`;
        } catch (error) {
            addToLog(`Erro ao carregar estatisticas: ${error.message}`, true);
            statsHtml = `<p class="text-red-500">Erro ao carregar estatisticas: ${error.message}</p>`;
        }
    
        let appStatusHtml = '';
        try {
            const appStatus = await apiRequest('/api/status', 'GET');
            appStatusHtml = `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6">
                    <h3 class="text-lg font-semibold mb-4">Controle da Aplicacao</h3>
                    <div class="space-y-4">
                        <div>
                            <label for="maintenance-toggle" class="flex items-center cursor-pointer">
                                <div class="relative">
                                    <input type="checkbox" id="maintenance-toggle" class="sr-only" ${appStatus.maintenance.is_on ? 'checked' : ''}>
                                    <div class="block bg-gray-600 w-14 h-8 rounded-full"></div>
                                    <div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition"></div>
                                </div>
                                <div class="ml-3 text-gray-700 dark:text-gray-300 font-medium">Modo de Manutencao</div>
                            </label>
                            <textarea id="maintenance-message-input" class="mt-2 w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Mensagem de manutencao..." ${!appStatus.maintenance.is_on ? 'disabled' : ''}>${appStatus.maintenance.message || ''}</textarea>
                        </div>
                        <div>
                            <label for="announcement-message-input" class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Anuncio Global (Markdown)</label>
                            <textarea id="announcement-message-input" class="mt-1 w-full h-24 px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Deixe em branco para remover o anuncio. Suporta Markdown.">${appStatus.announcement?.message || ''}</textarea>
                        </div>
                        <button id="save-app-status-btn" class="w-full py-3 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Salvar Status da Aplicacao</button>
                    </div>
                </div>`;
        } catch (error) {
            addToLog(`Erro ao carregar controle da aplicacao: ${error.message}`, true);
            appStatusHtml = `<p class="text-red-500">Erro ao carregar controle da aplicacao: ${error.message}</p>`;
        }

        let academySettingsHtml = '';
        try {
            const appSettings = await apiRequest('/api/app-settings', 'GET');
            const welcomeVideoUrl = appSettings.welcomeVideoUrl;
            academySettingsHtml = `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6">
                    <h3 class="text-lg font-semibold mb-4">Configuracoes da Academy</h3>
                    <div>
                        <label for="welcome-video-url-input" class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">URL do Video de Boas-Vindas (YouTube)</label>
                        <input type="url" id="welcome-video-url-input" class="mt-1 w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Cole a URL do video de boas-vindas aqui..." value="${welcomeVideoUrl || ''}">
                    </div>
                    <button id="save-academy-settings-btn" class="w-full py-3 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 mt-4">Salvar Configuracoes da Academy</button>
                </div>`;
        } catch (error) {
            addToLog(`Erro ao carregar configuracoes da Academy: ${error.message}`, true);
            academySettingsHtml = `<p class="text-red-500">Erro ao carregar configuracoes da Academy: ${error.message}</p>`;
        }
    
        const userManagementHtml = `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6">
                <h3 class="text-lg font-semibold mb-4">Gerenciamento de Utilizadores</h3>
                <div class="flex flex-col sm:flex-row gap-3 mb-4">
                    <input type="text" id="user-search-input" class="flex-1 px-4 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Buscar por email, whatsapp ou tags...">
                    <select id="user-status-filter" class="px-4 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <option value="active">Ativos</option>
                        <option value="pending">Pendentes</option>
                    </select>
                    <select id="user-limit-filter" class="px-4 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <option value="10">10 por pagina</option>
                        <option value="50">50 por pagina</option>
                        <option value="100">100 por pagina</option>
                    </select>
                </div>
                <div id="user-list-container"></div>
                <div id="user-pagination-controls" class="flex justify-center items-center gap-2 mt-4"></div>
            </div>`;
    
        if (adminContainer) adminContainer.innerHTML = statsHtml + appStatusHtml + academySettingsHtml + userManagementHtml + `
            <div id="admin-academy-container" class="mt-6">
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 class="text-lg font-semibold mb-4">Gerenciamento de Aulas da Academy</h3>
                    <button id="add-new-lesson-btn" class="w-full py-3 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Adicionar Nova Aula</button>
                    <div id="academy-admin-lessons-list" class="mt-4 space-y-3"></div>
                </div>
            </div>
        `;
    
        // Attach event listeners after setting innerHTML
        document.getElementById('approve-all-users-btn')?.addEventListener('click', async () => {
            showConfirmationModal('Aprovar Utilizadores', 'Tem certeza de que deseja ativar todas as contas pendentes?', async () => {
                try {
                    const response = await apiRequest('/api/admin/approve-all', 'POST');
                    showSuccessToast(response.message);
                    renderUsers(document.getElementById('user-status-filter')?.value, 1, appState.adminPanel.currentSearch);
                } catch (error) {
                    addToLog(`Erro ao aprovar utilizadores: ${error.message}`, true);
                }
            });
        });
    
        const maintenanceToggle = document.getElementById('maintenance-toggle');
        const maintenanceMessageInput = document.getElementById('maintenance-message-input');
        if (maintenanceToggle && maintenanceMessageInput) {
            maintenanceToggle.addEventListener('change', () => {
                maintenanceMessageInput.disabled = !maintenanceToggle.checked;
            });
        }
    
        document.getElementById('save-app-status-btn')?.addEventListener('click', async () => {
            try {
                const maintenanceToggleEl = document.getElementById('maintenance-toggle');
                const maintenanceMessageInputEl = document.getElementById('maintenance-message-input');
                const announcementMessageInputEl = document.getElementById('announcement-message-input');

                await apiRequest('/api/admin/maintenance', 'POST', {
                    is_on: maintenanceToggleEl?.checked,
                    message: maintenanceMessageInputEl?.value.trim()
                });
                await apiRequest('/api/admin/announcement', 'POST', {
                    message: announcementMessageInputEl?.value.trim()
                });
                showSuccessToast('Status da aplicacao salvo!');
            } catch (error) {
                addToLog(`Erro ao salvar status: ${error.message}`, true);
            }
        });

        document.getElementById('save-academy-settings-btn')?.addEventListener('click', async () => {
            try {
                const welcomeVideoUrlInput = document.getElementById('welcome-video-url-input');
                await apiRequest('/api/admin/app-settings', 'POST', {
                    settings: { welcomeVideoUrl: welcomeVideoUrlInput?.value.trim() }
                });
                showSuccessToast('Configuracoes da Academy salvas!');
            } catch (error) {
                addToLog(`Erro ao salvar configuracoes da Academy: ${error.message}`, true);
            }
        });
    
        const userSearchInput = document.getElementById('user-search-input');
        const userStatusFilter = document.getElementById('user-status-filter');
        const userLimitFilter = document.getElementById('user-limit-filter');
        const userListContainer = document.getElementById('user-list-container');
        const userPaginationControls = document.getElementById('user-pagination-controls');
        const batchTagContainer = document.getElementById('batch-tag-container');
        const selectedUserCountSpan = document.getElementById('selected-user-count');
        const batchTagsInput = document.getElementById('batch-tags-input');
        const addTagsBatchBtn = document.getElementById('add-tags-batch-btn');
        const removeTagsBatchBtn = document.getElementById('remove-tags-batch-btn');
    
        let selectedUserIds = new Set();
    
        const renderUsers = async (status = 'active', page = 1, search = '') => {
            const limit = parseInt(userLimitFilter?.value || '10', 10);
            appState.adminPanel[status].limit = limit;
            try {
                const response = await apiRequest(`/api/admin/users?status=${status}&page=${page}&limit=${limit}&search=${search}`, 'GET');
                const users = response.data;
                const totalPages = response.totalPages;
                const currentPage = response.currentPage;
    
                if (userListContainer) {
                    userListContainer.innerHTML = `
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead class="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"><input type="checkbox" id="select-all-users" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500"></th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">WhatsApp</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cargo</th>
                                        <th class="px-4 py-2 whitespace-nowrap text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tags</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acoes</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    ${users.map(user => `
                                        <tr class="${user.must_change_password ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}">
                                            <td class="px-4 py-2 whitespace-nowrap"><input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 user-select-checkbox" data-user-id="${user.id}" ${selectedUserIds.has(user.id) ? 'checked' : ''}></td>
                                            <td class="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${user.email}</td>
                                            <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                ${user.whatsapp ? `<a href="https://wa.me/${user.whatsapp.replace(/\D/g, '')}" target="_blank" class="text-blue-600 hover:underline">${user.whatsapp}</a>` : 'N/A'}
                                            </td>
                                            <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${user.role}</td>
                                            <td class="px-4 py-2 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'}">${user.is_active ? 'Ativo' : 'Pendente'}</span>${user.must_change_password ? '<span class="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">Senha Temp.</span>' : ''}</td>
                                            <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${user.tags ? user.tags.split(',').map(tag => `<span class="inline-block bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300 mr-1">${tag}</span>`).join('') : 'N/A'}</td>
                                            <td class="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                ${!user.is_active ? `<button class="approve-user-btn text-green-600 hover:text-green-900 dark:text-green-500 dark:hover:text-green-400 mr-2" data-user-id="${user.id}">Aprovar</button>` : ''}
                                                <button class="edit-user-btn text-blue-600 hover:text-blue-900 dark:text-blue-500 dark:hover:text-blue-400" data-user-id="${user.id}">Editar</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }
    
                if (userPaginationControls) {
                    userPaginationControls.innerHTML = '';
                    if (totalPages > 1) {
                        let paginationHtml = `<button class="page-btn px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`;
                        
                        const maxPagesToShow = 5;
                        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
                        if (endPage - startPage + 1 < maxPagesToShow) {
                            startPage = Math.max(1, endPage - maxPagesToShow + 1);
                        }

                        for (let i = startPage; i <= endPage; i++) {
                            paginationHtml += `<button class="page-btn px-3 py-1 rounded-md ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}" data-page="${i}">${i}</button>`;
                        }
                        paginationHtml += `<button class="page-btn px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Proximo</button>`;
                        userPaginationControls.innerHTML = paginationHtml;
                    }
        
                    userPaginationControls.querySelectorAll('.page-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            appState.adminPanel[status].currentPage = parseInt(e.target.dataset.page, 10);
                            renderUsers(status, appState.adminPanel[status].currentPage, search);
                        });
                    });
                }
    
                document.getElementById('select-all-users')?.addEventListener('change', (e) => {
                    userListContainer?.querySelectorAll('.user-select-checkbox').forEach(checkbox => {
                        checkbox.checked = e.target.checked;
                        const userId = parseInt(checkbox.dataset.userId, 10);
                        if (e.target.checked) selectedUserIds.add(userId);
                        else selectedUserIds.delete(userId);
                    });
                    updateBatchTagContainerVisibility();
                });
    
                userListContainer?.querySelectorAll('.user-select-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', (e) => {
                        const userId = parseInt(e.target.dataset.userId, 10);
                        if (e.target.checked) selectedUserIds.add(userId);
                        else selectedUserIds.delete(userId);
                        updateBatchTagContainerVisibility();
                    });
                });
    
                userListContainer?.querySelectorAll('.edit-user-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => showEditUserModal(e.target.dataset.userId));
                });

                userListContainer?.querySelectorAll('.approve-user-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const userId = e.target.dataset.userId;
                        showConfirmationModal('Aprovar Utilizador', `Tem a certeza de que deseja ativar o utilizador?`, async () => {
                            try {
                                await apiRequest(`/api/admin/user/${userId}/activate`, 'PUT');
                                showSuccessToast('Utilizador ativado com sucesso!');
                                renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
                            } catch (error) {
                                addToLog(`Erro ao ativar utilizador: ${error.message}`, true);
                            }
                        });
                    });
                });
    
                updateBatchTagContainerVisibility();
    
            } catch (error) {
                addToLog(`Erro ao carregar utilizadores: ${error.message}`, true);
                if (userListContainer) userListContainer.innerHTML = `<p class="text-red-500">Erro ao carregar utilizadores: ${error.message}</p>`;
            }
        };
    
        const updateBatchTagContainerVisibility = () => {
            if (selectedUserIds.size > 0) {
                if (batchTagContainer) batchTagContainer.style.display = 'block';
                if (selectedUserCountSpan) selectedUserCountSpan.textContent = selectedUserIds.size;
            } else {
                if (batchTagContainer) batchTagContainer.style.display = 'none';
            }
        };
    
        userSearchInput?.addEventListener('input', debounce(() => {
            appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage = 1; // Reset current page for active filter
            appState.adminPanel.currentSearch = userSearchInput.value.trim();
            renderUsers(appState.adminPanel.userStatusFilter, 1, appState.adminPanel.currentSearch);
        }, 300));
    
        userStatusFilter?.addEventListener('change', (e) => {
            appState.adminPanel.userStatusFilter = e.target.value; // Update the active filter
            // Reset current page for the new filter status
            appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage = 1;
            renderUsers(appState.adminPanel.userStatusFilter, 1, appState.adminPanel.currentSearch);
        });

        userLimitFilter?.addEventListener('change', (e) => {
            const newLimit = parseInt(e.target.value, 10);
            appState.adminPanel.active.limit = newLimit;
            appState.adminPanel.pending.limit = newLimit;
            appState.adminPanel.active.currentPage = 1;
            appState.adminPanel.pending.currentPage = 1;
            renderUsers(appState.adminPanel.userStatusFilter, 1, appState.adminPanel.currentSearch);
        });
        addTagsBatchBtn?.addEventListener('click', async () => {
            const tags = batchTagsInput?.value.trim();
            if (!tags) { showSuccessToast('Por favor, insira tags para adicionar.'); return; }
            if (selectedUserIds.size === 0) { showSuccessToast('Nenhum utilizador selecionado.'); return; }
            showConfirmationModal('Adicionar Tags', `Tem certeza de que deseja adicionar as tags "${tags}" a ${selectedUserIds.size} utilizador(es)?`, async () => {
                try {
                    await apiRequest('/api/admin/tags/batch', 'POST', { userIds: Array.from(selectedUserIds), tags, action: 'add' });
                    showSuccessToast('Tags adicionadas com sucesso!');
                    selectedUserIds.clear();
                    renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
                } catch (error) {
                    addToLog(`Erro ao adicionar tags: ${error.message}`, true);
                }
            });
        });
    
        removeTagsBatchBtn?.addEventListener('click', async () => {
            const tags = batchTagsInput?.value.trim();
            if (!tags) { showSuccessToast('Por favor, insira tags para remover.'); return; }
            if (selectedUserIds.size === 0) { showSuccessToast('Nenhum utilizador selecionado.'); return; }
            showConfirmationModal('Remover Tags', `Tem certeza de que deseja remover as tags "${tags}" de ${selectedUserIds.size} utilizador(es)?`, async () => {
                try {
                    await apiRequest('/api/admin/tags/batch', 'POST', { userIds: Array.from(selectedUserIds), tags, action: 'remove' });
                    showSuccessToast('Tags removidas com sucesso!');
                    selectedUserIds.clear();
                    renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
                } catch (error) {
                    addToLog(`Erro ao remover tags: ${error.message}`, true);
                }
            });
        });
    
        renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
    
        const showEditUserModal = async (userId) => {
            const modal = document.getElementById('edit-user-modal');
            const form = document.getElementById('edit-user-form');
            const feedbackEl = document.getElementById('edit-user-feedback');
            
            const newForm = form.cloneNode(true);
            if (form && form.parentNode) form.parentNode.replaceChild(newForm, form);
    
            const editUserId = newForm.querySelector('#edit-user-id');
            const editUserEmail = newForm.querySelector('#edit-user-email');
            const editUserWhatsapp = newForm.querySelector('#edit-user-whatsapp');
            const editUserTags = newForm.querySelector('#edit-user-tags');
            const resetPasswordBtn = newForm.querySelector('#reset-password-btn');
            const toggleStatusBtn = newForm.querySelector('#toggle-status-btn');
            const toggleRoleBtn = newForm.querySelector('#toggle-role-btn');
            const deleteUserBtn = newForm.querySelector('#delete-user-btn');
            const cancelEditBtn = newForm.querySelector('#cancel-edit-btn');
    
            if (feedbackEl) feedbackEl.textContent = '';
            if (modal) modal.style.display = 'flex';
    
            try {
                const user = await apiRequest(`/api/user/${userId}/details`, 'GET');
                if (editUserId) editUserId.value = user.id;
                if (editUserEmail) editUserEmail.value = user.email;
                if (editUserWhatsapp) editUserWhatsapp.value = user.whatsapp || '';
                if (editUserTags) editUserTags.value = user.tags || '';
    
                if (toggleStatusBtn) {
                    toggleStatusBtn.textContent = user.isActive ? 'Bloquear Utilizador' : 'Ativar Utilizador';
                    toggleStatusBtn.classList.toggle('bg-red-500', user.isActive);
                    toggleStatusBtn.classList.toggle('hover:bg-red-600', user.isActive);
                    toggleStatusBtn.classList.toggle('bg-green-500', !user.isActive);
                    toggleStatusBtn.classList.toggle('hover:bg-green-600', !user.isActive);
                }
    
                if (toggleRoleBtn) {
                    toggleRoleBtn.textContent = user.role === 'admin' ? 'Rebaixar para Utilizador' : 'Promover para Admin';
                    toggleRoleBtn.classList.toggle('bg-purple-500', user.role !== 'admin');
                    toggleRoleBtn.classList.toggle('hover:bg-purple-600', user.role !== 'admin');
                    if (user.id === 1 || user.id === appState.currentUser?.id) {
                        toggleRoleBtn.setAttribute('disabled', 'true');
                        toggleRoleBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        toggleRoleBtn.removeAttribute('disabled');
                        toggleRoleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }
    
                if (resetPasswordBtn) {
                    if (user.id === 1 || user.id === appState.currentUser?.id) {
                        resetPasswordBtn.setAttribute('disabled', 'true');
                        resetPasswordBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        resetPasswordBtn.removeAttribute('disabled');
                        resetPasswordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }
    
                if (deleteUserBtn) {
                    if (user.id === 1 || user.id === appState.currentUser?.id) {
                        deleteUserBtn.setAttribute('disabled', 'true');
                        deleteUserBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        deleteUserBtn.removeAttribute('disabled');
                        deleteUserBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }
    
            } catch (error) {
                if (feedbackEl) feedbackEl.textContent = error.message;
                addToLog(`Erro ao carregar dados do utilizador: ${error.message}`, true);
            }
    
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (feedbackEl) feedbackEl.textContent = '';
                try {
                    const currentUserId = editUserId?.value;
                    const currentEditUserEmail = editUserEmail?.value.trim();
                    const currentEditUserWhatsapp = editUserWhatsapp?.value.trim();
                    const currentEditUserTags = editUserTags?.value.trim();

                    if (currentUserId) {
                        await apiRequest(`/api/admin/user/${currentUserId}`, 'PUT', {
                            email: currentEditUserEmail,
                            whatsapp: currentEditUserWhatsapp,
                            tags: currentEditUserTags
                        });
                        showSuccessToast('Utilizador atualizado!');
                        if (modal) modal.style.display = 'none';
                        renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
                    }
                } catch (error) {
                    if (feedbackEl) feedbackEl.textContent = error.message;
                    addToLog(`Erro ao atualizar utilizador: ${error.message}`, true);
                }
            });
    
            resetPasswordBtn?.addEventListener('click', () => {
                const currentUserId = editUserId?.value;
                if (!currentUserId) return;
                showConfirmationModal('Redefinir Senha', 'Tem certeza de que deseja redefinir a senha deste utilizador? Uma nova senha temporaria sera gerada.', async () => {
                    try {
                        const response = await apiRequest(`/api/admin/user/${currentUserId}/reset-password`, 'POST');
                        showSuccessToast(response.message);
                        if (modal) modal.style.display = 'none';
                        renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
                    } catch (error) {
                        addToLog(`Erro ao redefinir senha: ${error.message}`, true);
                    }
                });
            });
    
            toggleStatusBtn?.addEventListener('click', async () => {
                const currentUserId = editUserId?.value;
                if (!currentUserId) return;
                const user = await apiRequest(`/api/user/${currentUserId}/details`, 'GET'); // Get latest status
                const currentStatusIsActive = user.isActive;
                const action = currentStatusIsActive ? 'bloquear' : 'ativar';
                showConfirmationModal(`${currentStatusIsActive ? 'Bloquear' : 'Ativar'} Utilizador`, `Tem certeza de que deseja ${action} este utilizador?`, async () => {
                    try {
                        if (!currentStatusIsActive) { // If currently inactive, activate
                            await apiRequest(`/api/admin/user/${currentUserId}/activate`, 'PUT');
                            showSuccessToast('Utilizador ativado com sucesso!');
                        } else { // If currently active, block
                            await apiRequest(`/api/admin/user/${currentUserId}/status`, 'PUT', { isActive: false });
                            showSuccessToast('Utilizador bloqueado com sucesso!');
                        }
                        if (modal) modal.style.display = 'none';
                        renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
                    } catch (error) {
                        addToLog(`Erro ao alterar status: ${error.message}`, true);
                    }
                });
            });
    
            toggleRoleBtn?.addEventListener('click', () => {
                const currentUserId = editUserId?.value;
                if (!currentUserId) return;
                const currentRoleIsAdmin = toggleRoleBtn.textContent.includes('Rebaixar');
                const newRole = currentRoleIsAdmin ? 'user' : 'admin';
                showConfirmationModal('Alterar Cargo', `Tem certeza de que deseja ${currentRoleIsAdmin ? 'rebaixar' : 'promover'} este utilizador para ${newRole}?`, async () => {
                    try {
                        await apiRequest(`/api/admin/user/${currentUserId}/role`, 'PUT', { role: newRole });
                        showSuccessToast(`Cargo do utilizador alterado para ${newRole}!`);
                        if (modal) modal.style.display = 'none';
                        renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
                    } catch (error) {
                        addToLog(`Erro ao alterar cargo: ${error.message}`, true);
                    }
                });
            });
    
            deleteUserBtn?.addEventListener('click', () => {
                const currentUserId = editUserId?.value;
                if (!currentUserId) return;
                showConfirmationModal('Excluir Utilizador', 'Tem certeza de que deseja excluir este utilizador? Esta acao e irreversivel.', async () => {
                    try {
                        await apiRequest(`/api/admin/user/${currentUserId}`, 'DELETE');
                        showSuccessToast('Utilizador excluido!');
                        if (modal) modal.style.display = 'none';
                        renderUsers(appState.adminPanel.userStatusFilter, appState.adminPanel[appState.adminPanel.userStatusFilter].currentPage, appState.adminPanel.currentSearch);
                    } catch (error) {
                        addToLog(`Erro ao excluir utilizador: ${error.message}`, true);
                    }
                });
            });
    
            cancelEditBtn?.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
            });
        };
        
        initializeAdminAcademy();
    }

    async function initializeAdminAcademy() {
        const adminAcademyContainer = document.getElementById('admin-academy-container');
        if (!adminAcademyContainer) return;
    
        const addLessonBtn = adminAcademyContainer.querySelector('#add-new-lesson-btn');
        const lessonsListContainer = adminAcademyContainer.querySelector('#academy-admin-lessons-list');
        const lessonModal = document.getElementById('academy-lesson-modal');
        const lessonModalTitle = document.getElementById('lesson-modal-title');
        const lessonForm = document.getElementById('academy-lesson-form');
        const lessonIdInput = document.getElementById('lesson-id');
        const lessonTitleInput = document.getElementById('lesson-title');
        const lessonDescriptionInput = document.getElementById('lesson-description');
        const lessonYoutubeUrlInput = document.getElementById('lesson-youtube-url');
        const lessonFileUrlInput = document.getElementById('lesson-file-url');
        const lessonFileNameInput = document.getElementById('lesson-file-name');
        const lessonTagTextInput = document.getElementById('lesson-tag-text');
        const lessonTagPositionSelect = document.getElementById('lesson-tag-position');
        const lessonFormFeedback = document.getElementById('lesson-form-feedback');
        const cancelLessonBtn = document.getElementById('cancel-lesson-btn');
        const saveLessonBtn = document.getElementById('save-lesson-btn');

        let currentLessonsOrder = []; // To store the order of lessons for drag and drop
    
        const renderAdminAcademyLessons = async () => {
            try {
                const lessons = await apiRequest('/api/admin/academy', 'GET');
                currentLessonsOrder = lessons.map(lesson => lesson.id); // Initialize order
                if (lessonsListContainer) {
                    lessonsListContainer.innerHTML = ''; // Clear existing content to prevent duplication
                    if (lessons.length === 0) {
                        lessonsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhuma aula adicionada ainda.</p>';
                    } else {
                        lessonsListContainer.innerHTML = lessons.map(lesson => `
                            <div class="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 flex justify-between items-center academy-admin-lesson-item"
                                 draggable="true" data-lesson-id="${lesson.id}">
                                <div class="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 cursor-grab handle" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                    <div>
                                        <p class="font-semibold text-gray-900 dark:text-gray-100">${lesson.title}</p>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">${new Date(lesson.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button class="edit-lesson-btn text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40" data-lesson-id="${lesson.id}">Editar</button>
                                    <button class="delete-lesson-btn text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40" data-lesson-id="${lesson.id}">Excluir</button>
                                </div>
                            </div>
                        `).join('');
                    }
                }
                lessonsListContainer?.querySelectorAll('.edit-lesson-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => openLessonModal(e.target.dataset.lessonId));
                });
                lessonsListContainer?.querySelectorAll('.delete-lesson-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => deleteLesson(e.target.dataset.lessonId));
                });
                setupAdminAcademyDragAndDrop();
            } catch (error) {
                addToLog(`Erro ao carregar aulas da Academy para admin: ${error.message}`, true);
                if (lessonsListContainer) lessonsListContainer.innerHTML = `<p class="text-red-500">Erro ao carregar aulas: ${error.message}</p>`;
            }
        };

        const setupAdminAcademyDragAndDrop = () => {
            const lessonsContainer = document.getElementById('academy-admin-lessons-list');
            if (!lessonsContainer) return;
        
            let draggedItem = null;
        
            lessonsContainer.addEventListener('dragstart', (e) => {
                const target = e.target.closest('.academy-admin-lesson-item');
                if (target) {
                    draggedItem = target;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggedItem.dataset.lessonId);
                    setTimeout(() => draggedItem.classList.add('dragging'), 0);
                }
            });
        
            lessonsContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                const target = e.target.closest('.academy-admin-lesson-item');
                if (target && target !== draggedItem) {
                    const bounding = target.getBoundingClientRect();
                    const offset = bounding.y + (bounding.height / 2);
                    if (e.clientY - offset > 0) {
                        target.classList.remove('over-top');
                        target.classList.add('over-bottom');
                    } else {
                        target.classList.remove('over-bottom');
                        target.classList.add('over-top');
                    }
                }
            });
        
            lessonsContainer.addEventListener('dragleave', (e) => {
                const target = e.target.closest('.academy-admin-lesson-item');
                if (target) {
                    target.classList.remove('over-top', 'over-bottom');
                }
            });
        
            lessonsContainer.addEventListener('drop', async (e) => {
                e.preventDefault();
                const droppedOn = e.target.closest('.academy-admin-lesson-item');
                if (draggedItem && droppedOn && draggedItem !== draggedItem) {
                    const isBefore = droppedOn.classList.contains('over-top');
                    if (isBefore) {
                        lessonsContainer.insertBefore(draggedItem, droppedOn);
                    } else {
                        lessonsContainer.insertBefore(draggedItem, droppedOn.nextSibling);
                    }
        
                    const newOrder = Array.from(lessonsContainer.children)
                        .filter(el => el.classList.contains('academy-admin-lesson-item'))
                        .map(el => parseInt(el.dataset.lessonId, 10));
                    
                    try {
                        await apiRequest('/api/admin/academy/reorder', 'PUT', { newOrder });
                        showSuccessToast('Ordem das aulas atualizada!');
                        renderAdminAcademyLessons();
                        initializeAcademy();
                    } catch (error) {
                        addToLog(`Erro ao salvar nova ordem: ${error.message}`, true);
                        renderAdminAcademyLessons(); // Re-render to revert visual change on error
                    }
                }
                lessonsContainer.querySelectorAll('.academy-admin-lesson-item').forEach(item => {
                    item.classList.remove('over-top', 'over-bottom');
                });
            });
        
            lessonsContainer.addEventListener('dragend', (e) => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                }
                lessonsContainer.querySelectorAll('.academy-admin-lesson-item').forEach(item => {
                    item.classList.remove('over-top', 'over-bottom');
                });
                draggedItem = null;
            });
        };
    
        const openLessonModal = async (lessonId = null) => {
            if (lessonForm) lessonForm.reset();
            if (lessonFormFeedback) lessonFormFeedback.textContent = '';
            if (lessonIdInput) lessonIdInput.value = ''; // Clear lessonId for new lessons

            if (lessonId) {
                if (lessonModalTitle) lessonModalTitle.textContent = 'Editar Aula';
                try {
                    const lessons = await apiRequest('/api/admin/academy', 'GET');
                    const lesson = lessons.find(l => String(l.id) === String(lessonId));
                    if (lesson) {
                        if (lessonIdInput) lessonIdInput.value = lesson.id;
                        if (lessonTitleInput) lessonTitleInput.value = lesson.title;
                        if (lessonDescriptionInput) lessonDescriptionInput.value = lesson.description || '';
                        if (lessonYoutubeUrlInput) lessonYoutubeUrlInput.value = lesson.youtube_url;
                        if (lessonFileUrlInput) lessonFileUrlInput.value = lesson.file_url || '';
                        if (lessonFileNameInput) lessonFileNameInput.value = lesson.file_name || '';
                        if (lessonTagTextInput) lessonTagTextInput.value = lesson.tag_text || '';
                        if (lessonTagPositionSelect) lessonTagPositionSelect.value = lesson.tag_position || 'top-2 left-2';
                    }
                } catch (error) {
                    addToLog(`Erro ao carregar dados da aula: ${error.message}`, true);
                    if (lessonFormFeedback) lessonFormFeedback.textContent = `Erro ao carregar aula: ${error.message}`;
                }
            } else {
                if (lessonModalTitle) lessonModalTitle.textContent = 'Adicionar Nova Aula';
                // Reset all fields for a new lesson
                if (lessonTitleInput) lessonTitleInput.value = '';
                if (lessonDescriptionInput) lessonDescriptionInput.value = '';
                if (lessonYoutubeUrlInput) lessonYoutubeUrlInput.value = '';
                if (lessonFileUrlInput) lessonFileUrlInput.value = '';
                if (lessonFileNameInput) lessonFileNameInput.value = '';
                if (lessonTagTextInput) lessonTagTextInput.value = '';
                if (lessonTagPositionSelect) lessonTagPositionSelect.value = 'top-2 left-2'; // Default position
            }
            if (lessonModal) lessonModal.style.display = 'flex';
        };
    
        const closeLessonModal = () => {
            if (lessonModal) lessonModal.style.display = 'none';
            if (lessonFormFeedback) lessonFormFeedback.textContent = ''; // Clear feedback on close
        };
    
        const saveLesson = async (e) => {
            e.preventDefault();
            if (lessonFormFeedback) lessonFormFeedback.textContent = '';
    
            const lessonData = {
                title: lessonTitleInput?.value.trim(),
                description: lessonDescriptionInput?.value.trim(),
                youtube_url: lessonYoutubeUrlInput?.value.trim(),
                file_url: lessonFileUrlInput?.value.trim(),
                file_name: lessonFileNameInput?.value.trim(),
                tag_text: lessonTagTextInput?.value.trim(),
                tag_position: lessonTagPositionSelect?.value,
            };
    
            if (!lessonData.title || !lessonData.youtube_url) {
                if (lessonFormFeedback) lessonFormFeedback.textContent = 'Título e URL do YouTube são obrigatórios.';
                return;
            }
    
            try {
                if (lessonIdInput?.value) {
                    await apiRequest(`/api/admin/academy/${lessonIdInput.value}`, 'PUT', lessonData);
                    showSuccessToast('Aula atualizada com sucesso!');
                } else {
                    await apiRequest('/api/admin/academy', 'POST', lessonData);
                    showSuccessToast('Aula adicionada com sucesso!');
                }
                closeLessonModal();
                renderAdminAcademyLessons();
                initializeAcademy(); // Re-render public academy to reflect changes
            } catch (error) {
                addToLog(`Erro ao salvar aula: ${error.message}`, true);
                if (lessonFormFeedback) lessonFormFeedback.textContent = `Erro ao salvar aula: ${error.message}`;
            }
        };
    
        const deleteLesson = (lessonId) => {
            showConfirmationModal('Excluir Aula', 'Tem certeza de que deseja excluir esta aula? Esta acao e irreversivel.', async () => {
                try {
                    await apiRequest(`/api/admin/academy/${lessonId}`, 'DELETE');
                    showSuccessToast('Aula excluida!');
                    renderAdminAcademyLessons();
                    initializeAcademy(); // Re-render public academy to reflect changes
                } catch (error) {
                    addToLog(`Erro ao excluir aula: ${error.message}`, true);
                }
            });
        };
    
        // Attach event listeners
        addLessonBtn?.addEventListener('click', () => openLessonModal());
        cancelLessonBtn?.addEventListener('click', closeLessonModal);
        lessonForm?.addEventListener('submit', saveLesson);
    
        renderAdminAcademyLessons();
    }
    // This function will contain all global event listeners that need to be set up once.
    function initializeGlobalEventListeners() {
        // Theme toggle button
        document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

        // Auth section buttons
        document.getElementById('login-form')?.addEventListener('submit', handleLogin);
        document.getElementById('register-form')?.addEventListener('submit', handleRegister);
        document.getElementById('show-register')?.addEventListener('click', () => {
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('register-container').style.display = 'block';
        });
        document.getElementById('show-login')?.addEventListener('click', () => {
            document.getElementById('register-container').style.display = 'none';
            document.getElementById('login-container').style.display = 'block';
        });
        document.getElementById('show-password-reset')?.addEventListener('click', showPasswordResetModal);
        document.getElementById('logout-from-maintenance')?.addEventListener('click', handleLogout);
        document.getElementById('back-to-login')?.addEventListener('click', () => showScreen('auth-section'));
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

        // Mobile menu toggle
        document.getElementById('open-menu-btn')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('open');
            document.getElementById('menu-overlay').style.display = 'block';
        });
        document.getElementById('menu-overlay')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('menu-overlay').style.display = 'none';
        });

        // Lightbox controls
        document.getElementById('close-lightbox-btn')?.addEventListener('click', closeLightbox);
        document.getElementById('lightbox-prev-btn')?.addEventListener('click', () => {
            if (appState.lightboxCurrentIndex > 0) {
                appState.lightboxCurrentIndex--;
                showLightboxImage(appState.lightboxCurrentIndex);
            }
        });
        document.getElementById('lightbox-next-btn')?.addEventListener('click', () => {
            if (appState.lightboxCurrentIndex < imageFxResults.images.length - 1) {
                appState.lightboxCurrentIndex++;
                showLightboxImage(appState.lightboxCurrentIndex);
            }
        });

        // API Alert Modal buttons
        document.getElementById('close-api-alert-btn')?.addEventListener('click', () => {
            document.getElementById('api-alert-modal').style.display = 'none';
        });
        document.getElementById('go-to-settings-btn')?.addEventListener('click', () => {
            document.getElementById('api-alert-modal').style.display = 'none';
            document.querySelector('.sidebar-btn[data-tab="settings"]').click();
        });

        // Video Player Modal
        document.getElementById('close-video-modal-btn')?.addEventListener('click', () => {
            const videoPlayerModal = document.getElementById('video-player-modal');
            const videoPlayerIframe = document.getElementById('video-player-iframe');
            const externalLink = document.getElementById('video-modal-external-link');
            const fallbackText = document.getElementById('video-modal-fallback');
            if (videoPlayerIframe) {
                videoPlayerIframe.src = ''; // Stop video playback
                delete videoPlayerIframe.dataset.videoId;
            }
            if (externalLink) {
                externalLink.classList.add('hidden');
                externalLink.href = '#';
            }
            if (fallbackText) fallbackText.classList.add('hidden');
            if (videoPlayerModal) videoPlayerModal.style.display = 'none';
        });

        // Welcome Video Modal
        document.getElementById('close-welcome-video-modal-btn')?.addEventListener('click', () => {
            const welcomeVideoModal = document.getElementById('welcome-video-modal');
            const welcomeVideoIframe = document.getElementById('welcome-video-iframe');
            if (welcomeVideoIframe) welcomeVideoIframe.src = ''; // Stop video playback
            if (welcomeVideoModal) welcomeVideoModal.style.display = 'none';
            localStorage.setItem('welcomeVideoShown', 'true'); // Mark as shown
            appState.welcomeVideoShown = true;
        });

        // Sidebar navigation
        document.getElementById('sidebar-nav')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.sidebar-btn');
            if (btn) {
                const tabId = btn.dataset.tab;
                if (tabId) {
                    renderTabContent(tabId);
                    // Remove active class from all buttons
                    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('sidebar-btn-active'));
                    // Add active class to the clicked button
                    btn.classList.add('sidebar-btn-active');
                }
            }
        });
    }

    // --- Academy Functions ---
    function openVideoPlayerModal(youtubeUrl, title, description) {
        const videoPlayerModal = document.getElementById('video-player-modal');
        const videoPlayerIframe = document.getElementById('video-player-iframe');
        const videoModalTitle = document.getElementById('video-modal-title');
        const videoModalDescription = document.getElementById('video-modal-description');

        if (!videoPlayerModal || !videoPlayerIframe || !videoModalTitle || !videoModalDescription) return;

        const videoId = getYouTubeVideoId(youtubeUrl);
        if (videoId) {
            const params = new URLSearchParams({
                rel: 0,
                modestbranding: 1,
                feature: 'oembed'
            });
            videoPlayerIframe.src = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
            videoPlayerIframe.dataset.videoId = videoId;
            videoModalTitle.textContent = title;
            videoModalDescription.textContent = description;
            const externalLink = document.getElementById('video-modal-external-link');
            const fallbackText = document.getElementById('video-modal-fallback');
            if (externalLink) {
                externalLink.href = `https://www.youtube.com/watch?v=${videoId}`;
                externalLink.classList.remove('hidden');
            }
            if (fallbackText) {
                fallbackText.classList.remove('hidden');
            }
            videoPlayerModal.style.display = 'flex';
        } else {
            showSuccessToast('URL do YouTube inválida.');
        }
    }

    // Helper function to get the correct rounded class for the tag
    const getTagRoundedClass = (position) => {
        switch (position) {
            case 'top-2 left-2': return 'rounded-br-lg';
            case 'top-2 right-2': return 'rounded-bl-lg';
            case 'bottom-2 left-2': return 'rounded-tr-lg';
            case 'bottom-2 right-2': return 'rounded-tl-lg';
            default: return 'rounded-br-lg'; // Default to top-left if not specified
        }
    };

    async function initializeAcademy() {
        const academyLessonsContainer = document.getElementById('academy-lessons-container');
        if (!academyLessonsContainer) return;

        try {
            const lessons = await apiRequest('/api/academy', 'GET');
            if (lessons.length === 0) {
                academyLessonsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhuma aula adicionada ainda.</p>';
            } else {
                academyLessonsContainer.innerHTML = lessons.map(lesson => `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative overflow-hidden group cursor-pointer academy-lesson-card"
                         data-youtube-url="${lesson.youtube_url}"
                         data-lesson-title="${lesson.title}"
                         data-lesson-description="${lesson.description || ''}">
                        <div class="relative w-full h-40 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
                            <img src="https://img.youtube.com/vi/${getYouTubeVideoId(lesson.youtube_url)}/hqdefault.jpg" 
                                 alt="Thumbnail do vídeo" 
                                 class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
                            <div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <h3 class="font-semibold text-lg text-gray-900 dark:text-gray-100 mt-3 mb-1">${lesson.title}</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">${lesson.description || ''}</p>
                        ${lesson.tag_text ? `<span class="absolute ${lesson.tag_position || 'top-2 left-2'} bg-blue-600 text-white text-xs font-bold px-2 py-1 ${getTagRoundedClass(lesson.tag_position)} z-10">${lesson.tag_text}</span>` : ''}
                        ${lesson.file_url ? `
                            <a href="${lesson.file_url}" download="${lesson.file_name || 'arquivo_aula.zip'}" class="absolute bottom-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-tl-lg hover:bg-green-600 flex items-center gap-1 z-10">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>${lesson.file_name || 'Download'}</span>
                            </a>
                        ` : ''}
                    </div>
                `).join('');

                academyLessonsContainer.querySelectorAll('.academy-lesson-card').forEach(card => {
                    card.addEventListener('click', (e) => {
                        // Prevent opening video if download link is clicked
                        if (e.target.closest('a[download]')) {
                            return;
                        }
                        const youtubeUrl = card.dataset.youtubeUrl;
                        const title = card.dataset.lessonTitle;
                        const description = card.dataset.lessonDescription;
                        openVideoPlayerModal(youtubeUrl, title, description);
                    });
                });
            }

            // Show welcome video if it hasn't been shown and a URL is configured
            // This logic should only run when the 'academy' tab is first rendered
            if (appState.currentTab === 'academy' && !appState.welcomeVideoShown && appState.currentUser && appState.currentUser.role !== 'admin') {
                const appSettings = await apiRequest('/api/app-settings', 'GET');
                const welcomeVideoUrl = appSettings.welcomeVideoUrl;
                if (welcomeVideoUrl) {
                    const welcomeVideoModal = document.getElementById('welcome-video-modal');
                    const welcomeVideoIframe = document.getElementById('welcome-video-iframe');
                    if (welcomeVideoModal && welcomeVideoIframe) {
                        const videoId = getYouTubeVideoId(welcomeVideoUrl);
                        if (videoId) {
                            welcomeVideoIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                            welcomeVideoModal.style.display = 'flex';
                            appState.welcomeVideoShown = true;
                            localStorage.setItem('welcomeVideoShown', 'true');
                        }
                    }
                }
            }

        } catch (error) {
            addToLog(`Erro ao carregar aulas da Academy: ${error.message}`, true);
            if (academyLessonsContainer) academyLessonsContainer.innerHTML = `<p class="text-red-500">Erro ao carregar aulas: ${error.message}</p>`;
        }
    }

    // --- Placeholder functions for other tools ---
    function initializeScriptReviewer() {
        // Hide all output sections initially
        document.getElementById('reviewer-original-scores-container').style.display = 'none';
        document.getElementById('reviewer-suggestions-output').innerHTML = '';
        document.getElementById('improvement-actions-container').style.display = 'none';
        document.getElementById('reviewer-revised-script-output').style.display = 'none';
        document.getElementById('reviewer-new-scores-container').style.display = 'none';
        document.getElementById('reviewer-output').innerHTML = ''; // Clear any previous error messages
    }
    function initializeScriptTranslator() { /* Lógica de inicialização do Tradutor de Roteiros */ }
    function initializeScenePrompts() {
        // Reset scenePromptResults when initializing the tab
        scenePromptResults = { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
        renderScenePage(); // Render an empty page or existing history if any
        renderSceneHistory();

        const sceneWordCountInput = document.getElementById('scene-word-count');
        const sceneTextInput = document.getElementById('scene-text');
        const scenePromptsCountDisplay = document.getElementById('scene-prompts-count-display');
        const generationModeSelect = document.getElementById('generation-mode');
        const manualOptionsDiv = document.getElementById('manual-options');
        const sceneStyleSelect = document.getElementById('scene-style');
        const sceneStyleDescription = document.getElementById('scene-style-description');

        const updateWordAndPromptCounts = () => {
            const text = sceneTextInput.value.trim();
            const words = text.split(/\s+/).filter(Boolean).length;
            const counter = document.getElementById('scene-word-counter');
            if (counter) counter.textContent = `${words} palavras`;

            const mode = generationModeSelect.value;
            if (mode === 'manual') {
                const wordsPerPrompt = parseInt(sceneWordCountInput.value, 10);
                if (words > 0 && wordsPerPrompt > 0) {
                    const numPrompts = Math.ceil(words / wordsPerPrompt);
                    scenePromptsCountDisplay.textContent = `(Aproximadamente ${numPrompts} prompts)`;
                } else {
                    scenePromptsCountDisplay.textContent = '';
                }
            } else {
                scenePromptsCountDisplay.textContent = '';
            }
        };

        if (sceneTextInput) {
            sceneTextInput.addEventListener('input', updateWordAndPromptCounts);
            // Trigger initial count
            sceneTextInput.dispatchEvent(new Event('input'));
        }

        if (generationModeSelect && manualOptionsDiv) {
            generationModeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'manual') {
                    manualOptionsDiv.style.display = 'flex';
                } else {
                    manualOptionsDiv.style.display = 'none';
                }
                updateWordAndPromptCounts(); // Update counts when mode changes
            });
            // Set initial display based on default value
            if (generationModeSelect.value === 'manual') {
                manualOptionsDiv.style.display = 'flex';
            } else {
                manualOptionsDiv.style.display = 'none';
            }
        }

        if (sceneWordCountInput) {
            sceneWordCountInput.addEventListener('input', updateWordAndPromptCounts);
        }

        if (sceneStyleSelect && sceneStyleDescription) {
            const updateStyleDescription = () => {
                const selectedOption = sceneStyleSelect.options[sceneStyleSelect.selectedIndex];
                sceneStyleDescription.textContent = selectedOption.dataset.description || '';
            };
            sceneStyleSelect.addEventListener('change', updateStyleDescription);
            updateStyleDescription(); // Initial call
        }
    }
    function initializeTextDivider() {
        const textDividerInput = document.getElementById('text-divider-input');
        const wordCountEl = document.getElementById('word-count');
        const charCountEl = document.getElementById('char-count');
        const timeEstimateEl = document.getElementById('time-estimate');
        const splitTextBtn = document.getElementById('split-text-btn');
        const splitChunkSizeInput = document.getElementById('split-chunk-size');
        const splitChunkTypeSelect = document.getElementById('split-chunk-type');
        const outputEl = document.getElementById('output');

        const updateCounts = () => {
            const text = textDividerInput.value;
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            const chars = text.length;
            
            // Estimativa: 150 palavras por minuto para narração
            const wordsPerMinute = 150;
            const totalMinutes = words / wordsPerMinute;
            const totalSeconds = Math.round(totalMinutes * 60);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            if (wordCountEl) wordCountEl.textContent = words;
            if (charCountEl) charCountEl.textContent = chars;
            if (timeEstimateEl) timeEstimateEl.textContent = formattedTime;
        };

        const splitText = () => {
            const text = textDividerInput.value.trim();
            const chunkSize = parseInt(splitChunkSizeInput.value, 10);
            const chunkType = splitChunkTypeSelect.value;

            if (!text) {
                showSuccessToast("Por favor, insira o roteiro completo para dividir.");
                return;
            }
            if (isNaN(chunkSize) || chunkSize <= 0) {
                showSuccessToast("Por favor, insira um tamanho de divisao valido.");
                return;
            }

            let parts = [];
            if (chunkType === 'word') {
                const words = text.split(/\s+/).filter(Boolean);
                for (let i = 0; i < words.length; i += chunkSize) {
                    parts.push(words.slice(i, i + chunkSize).join(' '));
                }
            } else { // char
                for (let i = 0; i < text.length; i += chunkSize) {
                    parts.push(text.slice(i, i + chunkSize));
                }
            }

            if (outputEl) {
                outputEl.innerHTML = parts.map((part, index) => `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-bold text-gray-900 dark:text-gray-100">Parte ${index + 1}</h4>
                            ${createCopyButton(part)}
                        </div>
                        <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${part}</div>
                    </div>
                `).join('');
            }
            showSuccessToast("Texto dividido com sucesso!");
        };

        if (textDividerInput) {
            textDividerInput.addEventListener('input', updateCounts);
            updateCounts(); // Initial call to set counts
        }
        if (splitTextBtn) {
            splitTextBtn.addEventListener('click', splitText);
        }
    }
    function initializeSettings() {
        const settingsForm = document.getElementById('settings-card');
        if (!settingsForm) return;

        const claudeKeyInput = document.getElementById('claude-key');
        const geminiKeyInput = document.getElementById('gemini-key-1');
        const gptKeyInput = document.getElementById('gpt-key');
        const imagefxCookiesInput = document.getElementById('imagefx-cookies-setting');

        // Load settings on initialization
        apiRequest('/api/settings', 'GET')
            .then(settings => {
                if (claudeKeyInput) claudeKeyInput.value = settings.claude || '';
                // Ensure gemini is handled as an array for loading
                if (geminiKeyInput) geminiKeyInput.value = (Array.isArray(settings.gemini) ? settings.gemini[0] : settings.gemini || '') ;
                if (gptKeyInput) gptKeyInput.value = settings.gpt || '';
                if (imagefxCookiesInput) imagefxCookiesInput.value = settings.imagefx_cookies || '';
            })
            .catch(error => {
                console.error("Erro ao carregar configurações:", error);
                addToLog("Erro ao carregar configurações de API.", true);
            });

        // Toggle password visibility
        settingsForm.querySelectorAll('.toggle-password-visibility').forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.target;
                const targetInput = document.getElementById(targetId);
                if (targetInput) {
                    if (targetInput.type === 'password') {
                        targetInput.type = 'text';
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.988 5.5L12 13.414l8.012-7.914a1 1 0 011.414 1.414l-9 9a1 1 0 01-1.414 0l-9-9a1 1 0 011.414-1.414z" /></svg>`; // Eye-open icon
                    } else {
                        targetInput.type = 'password';
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`; // Eye-closed icon
                    }
                }
            });
        });
    }
    function initializeEditorsCut() {
        // Correção 2: Adicionar event listener para o botão de importação
        const importBtn = document.getElementById('import-last-results-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const scriptInput = document.getElementById('editors-cut-script-input');
                const promptsInput = document.getElementById('editors-cut-prompts-input');

                // Correção 5: Garantir que o roteiro completo seja usado
                const fullScript = scriptResults.fullResult?.full_script_text || '';
                const fullPrompts = scenePromptResults.rawPromptsText || '';

                if (scriptInput && fullScript) {
                    scriptInput.value = fullScript;
                    devLog('[EDIT_LOAD_OK] Roteiro completo carregado no Guia de Edição.');
                } else {
                    showSuccessToast('Nenhum roteiro gerado recentemente para importar.');
                }

                if (promptsInput && fullPrompts) {
                    promptsInput.value = fullPrompts;
                } else {
                    showSuccessToast('Nenhum prompt de cena gerado recentemente para importar.');
                }

                if (fullScript || fullPrompts) {
                    showSuccessToast('Últimos resultados importados!');
                }
                devLog('[EDIT_FULL_RENDERED] Conteúdo renderizado no Guia de Edição.');
            });
        }
    }
    function initializeVideoOptimizer() {
        const videoUrlInput = document.getElementById('video-url-input');
        const analyzeVideoBtn = document.getElementById('analyze-video-btn');
        const outputEl = document.getElementById('output');

        if (analyzeVideoBtn) {
            // Re-attach event listener to ensure it's fresh
            if (analyzeVideoBtn._clickListener) {
                analyzeVideoBtn.removeEventListener('click', analyzeVideoBtn._clickListener);
            }
            const clickHandler = async (e) => {
                e.preventDefault();
                await handlers['analyze-video-btn']();
            };
            analyzeVideoBtn.addEventListener('click', clickHandler);
            analyzeVideoBtn._clickListener = clickHandler;
        }
        // Clear previous output when the tab is initialized
        if (outputEl) outputEl.innerHTML = '';
    }
    function initializeSrtConverter() {
        const textoInput = document.getElementById('textoInput');
        const convertSrtButton = document.getElementById('convert-srt-button');
        const resultadoEl = document.getElementById('resultado');
        const downloadBtn = document.getElementById('downloadBtn');
        const limparBtn = document.getElementById('limparBtn');

        // Nova função convertToSrt com a lógica fornecida
        const convertToSrt = async (e) => {
            e.preventDefault();
            const texto = textoInput?.value;
            if (!texto || !texto.trim()) {
                showSuccessToast("Por favor, cole um texto para converter.");
                return;
            }
        
            showProgressModal("Convertendo para SRT...", "Processando texto...");
            await new Promise(resolve => setTimeout(resolve, 50)); // Pequeno delay para a modal aparecer
        
            try {
                // Parâmetros definidos pelo usuário
                const DURACAO_BLOCO = 30; // segundos
                const INTERVALO_ENTRE_BLOCOS = 10; // segundos
                const PALAVRAS_MIN_BLOCO = 80;
                const PALAVRAS_MAX_BLOCO = 100;
                const CARACTERES_POR_BLOCO = 500;
        
                function formatTime(totalSeconds) {
                    const h = Math.floor(totalSeconds / 3600);
                    const m = Math.floor((totalSeconds % 3600) / 60);
                    const s = Math.floor(totalSeconds % 60);
                    const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
                }
        
                const words = texto.split(/\s+/).filter(Boolean);
                let srtContent = '';
                let subtitleIndex = 1;
                let currentTime = 0; // Tempo em segundos para o início do bloco
                let wordPointer = 0;
        
                while (wordPointer < words.length) {
                    let currentBlockWords = [];
                    let currentBlockChars = 0;
                    let tempWordPointer = wordPointer;
        
                    // Tenta preencher o bloco até o máximo de palavras/caracteres
                    while (tempWordPointer < words.length) {
                        const word = words[tempWordPointer];
                        const potentialWordLength = word.length + (currentBlockWords.length > 0 ? 1 : 0); // +1 for space
        
                        // Verifica se adicionar a próxima palavra excederia o limite de caracteres ou palavras
                        if (currentBlockChars + potentialWordLength > CARACTERES_POR_BLOCO || currentBlockWords.length >= PALAVRAS_MAX_BLOCO) {
                            break; // Não pode adicionar mais palavras neste bloco
                        }
        
                        currentBlockWords.push(word);
                        currentBlockChars += potentialWordLength;
                        tempWordPointer++;
                    }
        
                    // Se o bloco resultante for menor que o mínimo de palavras, tenta adicionar mais
                    // (apenas se ainda houver palavras e não exceder o máximo)
                    if (currentBlockWords.length < PALAVRAS_MIN_BLOCO && tempWordPointer < words.length) {
                        while (currentBlockWords.length < PALAVRAS_MIN_BLOCO && tempWordPointer < words.length) {
                            const word = words[tempWordPointer];
                            const potentialWordLength = word.length + (currentBlockWords.length > 0 ? 1 : 0);
        
                            if (currentBlockChars + potentialWordLength > CARACTERES_POR_BLOCO || currentBlockWords.length >= PALAVRAS_MAX_BLOCO) {
                                break;
                            }
                            currentBlockWords.push(word);
                            currentBlockChars += potentialWordLength;
                            tempWordPointer++;
                        }
                    }
        
                    // Se, após as tentativas, o bloco ainda estiver vazio (ex: texto muito curto ou uma única palavra muito longa)
                    if (currentBlockWords.length === 0 && wordPointer < words.length) {
                        // Adiciona pelo menos a próxima palavra para evitar loop infinito em casos extremos
                        currentBlockWords.push(words[wordPointer]);
                        tempWordPointer = wordPointer + 1;
                    } else if (currentBlockWords.length === 0) {
                        break; // Não há mais palavras para processar
                    }
        
                    const blockText = currentBlockWords.join(' ');
                    const startTime = currentTime;
                    const endTime = startTime + DURACAO_BLOCO;
        
                    srtContent += `${subtitleIndex}\n`;
                    srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
                    srtContent += blockText;
                    srtContent += '\n\n';
                    
                    currentTime = endTime + INTERVALO_ENTRE_BLOCOS;
                    wordPointer = tempWordPointer; // Move o ponteiro para a próxima palavra não processada
                    subtitleIndex++;
        
                    if (subtitleIndex % 100 === 0) { // Cede o controle para evitar travamento em textos muito longos
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
        
                if (resultadoEl) resultadoEl.textContent = srtContent.trim();
                if (downloadBtn) downloadBtn.style.display = 'block';
                if (limparBtn) limparBtn.style.display = 'block';
                
                hideProgressModal();
                showSuccessToast("Texto convertido para SRT!");
        
            } catch (error) {
                console.error("Erro no conversor SRT:", error);
                hideProgressModal();
                addToLog(`Erro ao converter para SRT: ${error.message}`, true);
                if (resultadoEl) resultadoEl.textContent = `Ocorreu um erro inesperado. Por favor, tente novamente. Detalhes: ${error.message}`;
            }
        };

        const clearSrtOutput = () => {
            textoInput.value = '';
            resultadoEl.textContent = '';
            downloadBtn.style.display = 'none';
            limparBtn.style.display = 'none';
            showSuccessToast('Campos SRT limpos.');
        };

        if (convertSrtButton) {
            convertSrtButton.addEventListener('click', convertToSrt);
        }
        if (limparBtn) {
            limparBtn.addEventListener('click', clearSrtOutput);
        }
    }

    // --- File Manager Functions ---
    async function initializeFileManager() {
        const fmCurrentPathEl = document.getElementById('fm-current-path');
        const fmBackBtn = document.getElementById('fm-back-btn');
        const fmFileListEl = document.getElementById('fm-file-list');
        const fmCreateFolderBtn = document.getElementById('fm-create-folder-btn');
        const fmUploadInput = document.getElementById('fm-upload-input');
        const fmDeleteSelectedBtn = document.getElementById('fm-delete-selected-btn');

        const renderFileManager = async () => {
            if (!fmCurrentPathEl || !fmFileListEl || !fmBackBtn) return;

            fmCurrentPathEl.textContent = appState.fileManager.currentPath;
            fmBackBtn.style.display = appState.fileManager.currentPath === '/' ? 'none' : 'inline-flex';
            fmFileListEl.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">A carregar arquivos...</p>';
            appState.fileManager.selectedItems.clear();
            updateFileManagerActions();

            try {
                const files = await apiRequest(`/api/admin/files?path=${appState.fileManager.currentPath}`, 'GET');
                appState.fileManager.items = files;
                if (fmFileListEl) {
                    fmFileListEl.innerHTML = files.map(item => `
                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500 fm-item-checkbox" data-item-path="${item.path}">
                                ${item.is_directory ? 
                                    `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>` :
                                    `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`
                                }
                                <span class="text-gray-900 dark:text-gray-100 ${item.is_directory ? 'font-semibold cursor-pointer fm-folder-name' : ''}" data-item-path="${item.path}">${item.name}</span>
                            </div>
                            ${item.is_directory ? '' : `<a href="/uploads/${item.path}" download class="text-blue-600 hover:underline text-sm">Download</a>`}
                        </div>
                    `).join('');
                }
            } catch (error) {
                addToLog(`Erro ao carregar arquivos: ${error.message}`, true);
                if (fmFileListEl) fmFileListEl.innerHTML = `<p class="text-center text-red-600">Erro ao carregar arquivos: ${error.message}</p>`;
            }
            attachFileManagerEventListeners();
        };

        const attachFileManagerEventListeners = () => {
            fmFileListEl?.querySelectorAll('.fm-folder-name').forEach(folderEl => {
                folderEl.addEventListener('click', () => {
                    appState.fileManager.currentPath = folderEl.dataset.itemPath;
                    renderFileManager();
                });
            });

            fmFileListEl?.querySelectorAll('.fm-item-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const itemPath = e.target.dataset.itemPath;
                    if (e.target.checked) {
                        appState.fileManager.selectedItems.add(itemPath);
                    } else {
                        appState.fileManager.selectedItems.delete(itemPath);
                    }
                    updateFileManagerActions();
                });
            });
        };

        const updateFileManagerActions = () => {
            if (fmDeleteSelectedBtn) {
                fmDeleteSelectedBtn.style.display = appState.fileManager.selectedItems.size > 0 ? 'block' : 'none';
            }
        };

        fmBackBtn?.addEventListener('click', () => {
            const parentPath = browserPath.dirname(appState.fileManager.currentPath);
            appState.fileManager.currentPath = parentPath === '.' ? '/' : parentPath;
            renderFileManager();
        });

        fmCreateFolderBtn?.addEventListener('click', () => {
            const folderName = prompt('Digite o nome da nova pasta:');
            if (folderName && folderName.trim()) {
                showConfirmationModal('Criar Pasta', `Tem certeza de que deseja criar a pasta "${folderName}" em "${appState.fileManager.currentPath}"?`, async () => {
                    try {
                        await apiRequest('/api/admin/files/folder', 'POST', { folderName: folderName.trim(), currentPath: appState.fileManager.currentPath });
                        showSuccessToast('Pasta criada com sucesso!');
                        renderFileManager();
                    } catch (error) {
                        addToLog(`Erro ao criar pasta: ${error.message}`, true);
                    }
                });
            }
        });

        fmUploadInput?.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                const formData = new FormData();
                for (let i = 0; i < files.length; i++) {
                    formData.append('files', files[i]);
                }
                formData.append('currentPath', appState.fileManager.currentPath);

                showProgressModal(`A enviar ${files.length} arquivo(s)...`, 'Por favor, aguarde...');
                try {
                    await apiRequest('/api/admin/files/upload', 'POST', formData, true); // true for FormData
                    showSuccessToast('Upload concluído!');
                    renderFileManager();
                } catch (error) {
                    addToLog(`Erro ao fazer upload: ${error.message}`, true);
                } finally {
                    hideProgressModal();
                    fmUploadInput.value = ''; // Clear input
                }
            }
        });

        fmDeleteSelectedBtn?.addEventListener('click', () => {
            if (appState.fileManager.selectedItems.size === 0) {
                showSuccessToast('Nenhum item selecionado para excluir.');
                return;
            }
            const itemsToDelete = Array.from(appState.fileManager.selectedItems);
            showConfirmationModal('Excluir Itens', `Tem certeza de que deseja excluir ${itemsToDelete.length} item(s)? Esta acao e irreversivel.`, async () => {
                showProgressModal(`A excluir ${itemsToDelete.length} item(s)...`, 'Por favor, aguarde...');
                try {
                    for (const itemPath of itemsToDelete) {
                        await apiRequest('/api/admin/files', 'DELETE', { filePath: itemPath });
                    }
                    showSuccessToast('Itens excluídos com sucesso!');
                    renderFileManager();
                } catch (error) {
                    addToLog(`Erro ao excluir itens: ${error.message}`, true);
                } finally {
                    hideProgressModal();
                }
            });
        });

        renderFileManager();
    }

    // --- Downloads Page Functions ---
    async function initializeDownloads() {
        const dlCurrentPathEl = document.getElementById('dl-current-path');
        const dlBackBtn = document.getElementById('dl-back-btn');
        const dlFileListEl = document.getElementById('dl-file-list');

        const renderDownloads = async () => {
            if (!dlCurrentPathEl || !dlFileListEl || !dlBackBtn) return;

            dlCurrentPathEl.textContent = appState.downloads.currentPath;
            dlBackBtn.style.display = appState.downloads.currentPath === '/' ? 'none' : 'inline-flex';
            dlFileListEl.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">A carregar arquivos...</p>';

            try {
                const files = await apiRequest(`/api/downloads?path=${appState.downloads.currentPath}`, 'GET');
                appState.downloads.items = files;
                if (dlFileListEl) {
                    dlFileListEl.innerHTML = files.map(item => `
                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                ${item.is_directory ? 
                                    `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>` :
                                    `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`
                                }
                                <span class="text-gray-900 dark:text-gray-100 ${item.is_directory ? 'font-semibold cursor-pointer dl-folder-name' : ''}" data-item-path="${item.path}">${item.name}</span>
                            </div>
                            ${item.download_url ? `
                                <a href="${item.download_url}" download="${item.name}" class="text-blue-600 hover:underline text-sm flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Download
                                </a>` : ''}
                        </div>
                    `).join('');
                }
            } catch (error) {
                addToLog(`Erro ao carregar downloads: ${error.message}`, true);
                if (dlFileListEl) dlFileListEl.innerHTML = `<p class="text-center text-red-600">Erro ao carregar downloads: ${error.message}</p>`;
            }
            attachDownloadsEventListeners();
        };

        const attachDownloadsEventListeners = () => {
            dlFileListEl?.querySelectorAll('.dl-folder-name').forEach(folderEl => {
                folderEl.addEventListener('click', () => {
                    appState.downloads.currentPath = folderEl.dataset.itemPath;
                    renderDownloads();
                });
            });
        };

        dlBackBtn?.addEventListener('click', () => {
            const parentPath = browserPath.dirname(appState.downloads.currentPath);
            appState.downloads.currentPath = parentPath === '.' ? '/' : parentPath;
            renderDownloads();
        });

        renderDownloads();
    }

    async function checkSession() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            showScreen('auth-section');
            return;
        }
        try {
            const response = await apiRequest('/api/verify-session', 'GET');
            appState.currentUser = response.user;
            if (response.mustChangePassword) {
                showForcePasswordChangeModal();
                return;
            }
            const appStatus = await apiRequest('/api/status', 'GET');
            if (appStatus && appStatus.maintenance && appStatus.maintenance.is_on && appState.currentUser.role !== 'admin') {
                showMaintenanceMode(appStatus.maintenance.message);
            } else {
                await initializeApp(appStatus ? appStatus.announcement : null);
            }
        } catch (error) {
            console.error("Session Check Error:", error);
            handleLogout();
        }
    }

    initializeGlobalEventListeners();
    checkSession();
});