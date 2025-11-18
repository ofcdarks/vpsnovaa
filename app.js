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

    // Token Limits Dataset (Updated for 2024/2025 APIs)
    // Replicado do token-limits.js para uso no frontend
    const TOKEN_LIMITS_FRONTEND = {
        'gpt-4o': { maxContextLength: 128000, maxOutputTokens: 16384 },
        'gpt-4-turbo': { maxContextLength: 128000, maxOutputTokens: 16384 },
        'gpt-3.5-turbo': { maxContextLength: 16385, maxOutputTokens: 4096 },
        'claude-3-5-sonnet': { maxContextLength: 200000, maxOutputTokens: 8192 },
        'claude-3-5-haiku': { maxContextLength: 200000, maxOutputTokens: 8192 },
        'claude-3-opus': { maxContextLength: 200000, maxOutputTokens: 4096 },
        'claude-3-sonnet': { maxContextLength: 200000, maxOutputTokens: 4096 },
        'gemini-2.5-pro': { maxContextLength: 1000000, maxOutputTokens: 8192 },
        'gemini-2.5-flash': { maxContextLength: 1000000, maxOutputTokens: 8192 },
        'gemini-2.5-flash-lite': { maxContextLength: 1000000, maxOutputTokens: 8192 },
        'gemini-1.5-pro': { maxContextLength: 2000000, maxOutputTokens: 8192 },
        'gemini-1.5-flash': { maxContextLength: 1000000, maxOutputTokens: 8192 }
    };

    // Normaliza o nome de um modelo para facilitar matching
    const normalizeModelName = (model) => {
        return model.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '').trim();
    };

    // Modelo recomendado padrão (mais estável e confiável)
    const RECOMMENDED_MODEL = 'gpt-4o';
    
    // Função helper para fazer requisição com fallback automático para modelo recomendado
    const apiRequestWithFallback = async (url, method, data, retries = 1) => {
        const originalModel = data.model;
        let lastError = null;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const result = await apiRequest(url, method, data);
                // Se foi usado modelo diferente do original e funcionou, avisar
                if (attempt > 0 && data.model !== originalModel) {
                    console.log(`✅ Requisição bem-sucedida usando modelo recomendado: ${data.model} (original: ${originalModel})`);
                }
                return result;
            } catch (error) {
                lastError = error;
                const errorMsg = error.message || '';
                
                // Verificar se é um erro que justifica fallback
                const shouldFallback = errorMsg.includes('MAX_TOKENS') || 
                                      errorMsg.includes('vazia ou malformada') ||
                                      errorMsg.includes('cortada') ||
                                      errorMsg.includes('limite de tokens') ||
                                      errorMsg.includes('context_length_exceeded') ||
                                      (errorMsg.includes('JSON') && attempt === 0);
                
                // Se deve fazer fallback e ainda não tentou o recomendado
                if (shouldFallback && attempt < retries && data.model !== RECOMMENDED_MODEL) {
                    console.warn(`⚠️ Erro com modelo ${data.model}: ${errorMsg.substring(0, 100)}`);
                    console.log(`🔄 Tentando automaticamente com modelo recomendado: ${RECOMMENDED_MODEL}`);
                    data.model = RECOMMENDED_MODEL;
                    // Pequeno delay antes de tentar novamente
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                // Se não deve fazer fallback ou já tentou tudo, lança o erro
                throw error;
            }
        }
        
        throw lastError;
    };
    
    // Smart Matching entre modelo pedido e dataset de limites
    const getTokenLimitsFrontend = (model) => {
        const m = normalizeModelName(model);

        // 1) Matching direto
        if (TOKEN_LIMITS_FRONTEND[m]) {
            return TOKEN_LIMITS_FRONTEND[m];
        }

        // 2) Matching por prefixos
        const patterns = [
            { key: 'gpt-4o', match: ['gpt-4o', 'gpt4o', 'gpt-4.1', 'gpt-4.0'] },
            { key: 'gpt-4-turbo', match: ['gpt-4-turbo', 'gpt4turbo'] },
            { key: 'gpt-3.5-turbo', match: ['gpt-3.5', 'gpt35'] },
            { key: 'claude-3-5-sonnet', match: ['claude-3-5-sonnet', 'claude-3-5', 'claude-35-sonnet'] },
            { key: 'claude-3-5-haiku', match: ['claude-3-5-haiku'] },
            { key: 'claude-3-opus', match: ['claude-3-opus', 'opus'] },
            { key: 'claude-3-sonnet', match: ['claude-3-sonnet'] },
            { key: 'gemini-2.5-pro', match: ['gemini-2.5-pro'] },
            { key: 'gemini-2.5-flash-lite', match: ['gemini-2.5-flash-lite'] },
            { key: 'gemini-2.5-flash', match: ['gemini-2.5-flash'] },
            { key: 'gemini-1.5-pro', match: ['gemini-1.5-pro'] },
            { key: 'gemini-1.5-flash', match: ['gemini-1.5-flash'] }
        ];

        for (const p of patterns) {
            for (const rule of p.match) {
                if (m.includes(rule)) {
                    return TOKEN_LIMITS_FRONTEND[p.key];
                }
            }
        }

        // 3) Matching genérico por tipo
        if (m.includes('gpt-4')) return TOKEN_LIMITS_FRONTEND['gpt-4o'];
        if (m.includes('gpt-3.5')) return TOKEN_LIMITS_FRONTEND['gpt-3.5-turbo'];
        if (m.includes('claude-3-5')) return TOKEN_LIMITS_FRONTEND['claude-3-5-sonnet'];
        if (m.includes('claude-3')) return TOKEN_LIMITS_FRONTEND['claude-3-sonnet'];
        if (m.includes('gemini-2.5')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-pro'];
        if (m.includes('gemini-1.5')) return TOKEN_LIMITS_FRONTEND['gemini-1.5-pro'];
        if (m.includes('gemini')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-flash'];

        // 4) Fallback conservador
        console.warn(`⚠️ Modelo desconhecido: "${model}". Usando fallback conservador.`);
        return { maxContextLength: 16000, maxOutputTokens: 4000 };
    };

    const splitTextIntoWordChunks = (text, maxWords) => {
        if (!text || maxWords <= 0) return [];
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];
        const chunks = [];
        for (let i = 0; i < words.length; i += maxWords) {
            const segmentWords = words.slice(i, i + maxWords);
            chunks.push({
                text: segmentWords.join(' '),
                startIndex: i,
                endIndex: i + segmentWords.length,
                wordCount: segmentWords.length
            });
        }
        return chunks;
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
        welcomeVideoDontShow: localStorage.getItem('welcomeVideoDontShow') === 'true',
        isWelcomeVideoActive: false, // Flag para rastrear se o vídeo de boas-vindas está ativo
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

    let scriptResults = { fullResult: null, currentPage: 1, partsPerPage: 5 };
    let scenePromptResults = { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
    let thumbnailPromptResults = { data: [], allPromptsText: '', rawPromptsText: '' };
    let imageFxResults = { images: [], lastClearedImages: [], lastPrompt: '' };
    let reviewerResults = {
        originalScript: null,
        originalScores: null,
        suggestions: [],
        revisedScript: '',
        revisedScriptParts: [],
        totalParts: 0,
        currentPage: 1,
        partsPerPage: 5,
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

    const renderTranslationProgress = () => {
        if (!appState.translationStatus) return;
        
        const progressEl = document.getElementById('translation-progress-indicator');
        if (!progressEl) return;
        
        const { active, total, completed, errors } = appState.translationStatus;
        const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;
        const remaining = total - completed;
        
        if (active || completed > 0) {
            const statusText = active 
                ? `Traduzindo ${remaining} de ${total} idioma(s)...`
                : `Tradução concluída: ${completed - errors}/${total} sucesso${errors > 0 ? `, ${errors} falhas` : ''}`;
            
            progressEl.innerHTML = `
                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                    <div class="flex items-center gap-2 mb-2">
                        ${active ? '<div class="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>' : '✓'}
                        <span class="text-sm font-medium text-blue-900 dark:text-blue-100">${statusText}</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${percentComplete}%"></div>
                    </div>
                    <div class="text-xs text-blue-700 dark:text-blue-300 mt-1">${percentComplete}% concluído</div>
                </div>
            `;
            progressEl.style.display = 'block';
        } else {
            progressEl.style.display = 'none';
        }
    };

    const renderSceneGenerationProgress = (status) => {
        let panel = document.getElementById('scene-gen-progress-panel');
        if (!panel) return;

        if (!status || !status.active) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        const {
            current = 0,
            total = 0,
            message,
            subMessage,
            chunkTotal = 0,
            chunkCurrent = 0
        } = status;
        const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        const isComplete = total > 0 && current >= total;
        const safeChunkCurrent = chunkTotal > 0 ? Math.min(chunkCurrent, chunkTotal) : 0;
        const chunkPercent = chunkTotal > 0 ? Math.min(100, Math.round((safeChunkCurrent / chunkTotal) * 100)) : 0;

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
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                    <h4 class="font-bold text-base ${titleColor} mb-1">${title}</h4>
                    <p class="text-sm text-gray-700 dark:text-gray-300 font-medium" title="${message || ''}">${message || 'Preparando prompts...'}</p>
                    ${subMessage ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">${subMessage}</p>` : ''}
                </div>
                <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-2" onclick="document.getElementById('scene-gen-progress-panel').style.display = 'none';">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
            </div>
            <div class="space-y-3">
                <div>
                    <div class="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        <span>Progresso Geral</span>
                        <span>${current}/${total || '?'} cena(s) - ${progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                        <div class="h-2.5 rounded-full ${progressBarColor} transition-all duration-300" style="width: ${progress}%;"></div>
                    </div>
                </div>
                ${chunkTotal > 0 ? `
                    <div>
                        <div class="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            <span>Progresso por Partes</span>
                            <span>Parte ${safeChunkCurrent}/${chunkTotal}</span>
                        </div>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div class="h-2 rounded-full bg-indigo-500 transition-all duration-300" style="width: ${chunkPercent}%;"></div>
            </div>
                    </div>
                ` : ''}
            </div>
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
                <button class="float-right text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onclick="if(confirm('Deseja realmente cancelar a geração de imagens?')) { appState.imageGenStatus.active = false; appState.imageGenStatus.cancelled = true; document.getElementById('image-gen-progress-panel').style.display = 'none'; }">
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
        const { current, total, message, error, status: jobStatus, partDownloads } = status;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;
        const isComplete = current === total && total > 0;

        let title, titleColor, progressBarColor, showErrorDetails = false;
        const isPartial = jobStatus === 'partial' || (message && message.includes('partes já geradas'));
        const isQuotaError = message && (message.includes('Quota') || message.includes('quota') || message.includes('Limite') || message.includes('limite ZERO'));
        
        if (error && !isPartial && isQuotaError) {
            title = '⚠️ Limite da API Atingido';
            titleColor = 'text-orange-600 dark:text-orange-400';
            progressBarColor = 'bg-orange-500';
            showErrorDetails = true;
        } else if (error && !isPartial && (message.includes('indisponível') || message.includes('502') || message.includes('503'))) {
            title = '⚠️ Servidor Indisponível';
            titleColor = 'text-yellow-600 dark:text-yellow-400';
            progressBarColor = 'bg-yellow-500';
        } else if (error && !isPartial && (message.includes('conexão') || message.includes('rede'))) {
            title = '📡 Erro de Conexão';
            titleColor = 'text-yellow-600 dark:text-yellow-400';
            progressBarColor = 'bg-yellow-500';
        } else if (error && !isPartial && (message.includes('chave') || message.includes('API'))) {
            title = '🔑 Erro de Autenticação';
            titleColor = 'text-red-600 dark:text-red-400';
            progressBarColor = 'bg-red-500';
        } else if (error && !isPartial) {
            title = '❌ Erro na Narração';
            titleColor = 'text-red-600 dark:text-red-400';
            progressBarColor = 'bg-red-500';
        } else if (isPartial) {
            title = '⚠️ Geração Parcial';
            titleColor = 'text-yellow-600 dark:text-yellow-400';
            progressBarColor = 'bg-yellow-500';
        } else if (isComplete) {
            title = '✅ Narração Concluída';
            titleColor = 'text-green-600 dark:text-green-400';
            progressBarColor = 'bg-green-500';
        } else {
            title = '🎙️ Gerando Narração...';
            titleColor = 'text-blue-600 dark:text-blue-400';
            progressBarColor = 'bg-blue-500';
        }
        
        // Formatar mensagem para melhor exibição
        let formattedMessage = message || '';
        let additionalInfo = '';
        
        if (showErrorDetails && formattedMessage.includes('\n')) {
            // Se tiver quebras de linha, dividir em mensagem principal e detalhes
            const parts = formattedMessage.split('\n\n');
            formattedMessage = parts[0];
            if (parts.length > 1) {
                additionalInfo = `
                    <div class="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs">
                        ${parts.slice(1).join('<br>').replace(/\n/g, '<br>')}
                    </div>
                `;
            }
        }
        
        // Atualização incremental - verificar se já existe estrutura básica
        let existingHeader = panel.querySelector('h4');
        let needsFullRender = !existingHeader;
        
        if (needsFullRender) {
            panel.innerHTML = `
                <h4 class="font-bold text-sm mb-2 ${titleColor}">
                    <span class="title-text">${title}</span>
                    <button class="close-panel-btn float-right text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    </button>
                </h4>
                <p class="message-text text-xs text-gray-700 dark:text-gray-300 mb-2 ${showErrorDetails ? '' : 'truncate'}" title="${message}">${formattedMessage}</p>
                <div class="additional-info-container"></div>
                <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
                    <div class="progress-bar h-2 rounded-full ${progressBarColor}" style="width: ${progress}%;"></div>
                </div>
                <p class="progress-text text-right text-xs text-gray-500 dark:text-gray-400 mt-1">${progress}% (${current}/${total})</p>
                <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600" id="parts-container">
                    <p class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Partes Disponíveis:</p>
                    <div class="space-y-2 max-h-60 overflow-y-auto" id="parts-list"></div>
                </div>
            `;
            
            // Adicionar event listener ao botão de fechar
            const closeBtn = panel.querySelector('.close-panel-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    panel.style.display = 'none';
                });
            }
        } else {
            // Atualizar apenas o que mudou
            const titleEl = panel.querySelector('.title-text');
            if (titleEl) titleEl.textContent = title;
            
            existingHeader.className = `font-bold text-sm mb-2 ${titleColor}`;
            
            const messageEl = panel.querySelector('.message-text');
            if (messageEl) {
                messageEl.textContent = formattedMessage;
                messageEl.title = message;
                messageEl.className = `message-text text-xs text-gray-700 dark:text-gray-300 mb-2 ${showErrorDetails ? '' : 'truncate'}`;
            }
            
            const additionalInfoContainer = panel.querySelector('.additional-info-container');
            if (additionalInfoContainer) {
                additionalInfoContainer.innerHTML = additionalInfo;
            }
            
            const progressBar = panel.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.className = `progress-bar h-2 rounded-full ${progressBarColor}`;
                progressBar.style.width = `${progress}%`;
            }
            
            const progressText = panel.querySelector('.progress-text');
            if (progressText) {
                progressText.textContent = `${progress}% (${current}/${total})`;
            }
        }
        
        // Atualizar partes disponíveis (mesmo código anterior para partes)
        const partsList = panel.querySelector('#parts-list');
        if (partsList && partDownloads && Array.isArray(partDownloads) && partDownloads.length > 0) {
            const availableParts = partDownloads.filter(p => p && p.available);
            
            availableParts.forEach(part => {
                const existingPart = partsList.querySelector(`[data-part-number="${part.partNumber}"]`);
                if (!existingPart) {
                    // Adicionar nova parte (código anterior)
                    const partDiv = document.createElement('div');
                    partDiv.className = 'flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600';
                    partDiv.setAttribute('data-part-number', part.partNumber);
                    partDiv.innerHTML = `
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Parte ${part.partNumber}</p>
                            <audio controls class="w-full h-8" preload="none" data-part-url="${part.downloadUrl}" data-part-number="${part.partNumber}">
                                Seu navegador não suporta o elemento de áudio.
                            </audio>
                        </div>
                        <div class="flex flex-col gap-1">
                            <button class="download-part-btn text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors cursor-pointer flex items-center gap-1"
                               data-download-url="${part.downloadUrl}"
                               data-part-number="${part.partNumber}"
                               title="Baixar parte ${part.partNumber}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Baixar
                            </button>
                            <button class="remove-part-btn text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors cursor-pointer flex items-center gap-1"
                               data-part-number="${part.partNumber}"
                               title="Remover parte ${part.partNumber}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Excluir
                            </button>
                        </div>
                    `;
                    partsList.appendChild(partDiv);
                    
                    // Configurar event listeners para os botões da nova parte
                    if (window.setupPartButtonListeners) {
                        setupPartButtonListeners(partDiv);
                    }
                    
                    // Configurar player de áudio para a nova parte (código anterior)
                    const audioElement = partDiv.querySelector('audio');
                    if (audioElement) {
                        const downloadUrl = audioElement.getAttribute('data-part-url');
                        const partNumber = part.partNumber;
                        
                        console.log(`🎵 Configurando player de áudio para parte ${partNumber}`);
                        
                        const loadAudio = async () => {
                            console.log(`🎵 loadAudio chamado para parte ${partNumber}`);
                            console.log(`🎵 audioElement.src = "${audioElement.src}"`);
                            console.log(`🎵 audioElement.dataset.loading = "${audioElement.dataset.loading}"`);
                            
                            if (audioElement.src && audioElement.src !== '' && audioElement.src.startsWith('blob:')) {
                                console.log(`🎵 Áudio já carregado para parte ${partNumber}`);
                                return;
                            }
                            
                            if (audioElement.dataset.loading === 'true') {
                                console.log(`🎵 Áudio já está sendo carregado para parte ${partNumber}`);
                                return;
                            }
                            
                            try {
                                audioElement.dataset.loading = 'true';
                                const token = localStorage.getItem('authToken');
                                if (!token) {
                                    addToLog('Você precisa estar autenticado para reproduzir o áudio.', true);
                                    audioElement.dataset.loading = 'false';
                                    return;
                                }
                                
                                audioElement.style.opacity = '0.6';
                                audioElement.style.pointerEvents = 'none';
                                
                                console.log(`🎵 Buscando áudio da parte ${partNumber} de ${downloadUrl}`);
                                
                                const response = await fetch(downloadUrl, {
                                    method: 'GET',
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                
                                console.log(`🎵 Resposta recebida: ${response.status}`);
                                
                                if (response.ok) {
                                    const blob = await response.blob();
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    audioElement.src = blobUrl;
                                    audioElement.load();
                                    audioElement.style.opacity = '1';
                                    audioElement.style.pointerEvents = 'auto';
                                    console.log(`✅ Áudio carregado com sucesso para parte ${partNumber}`);
                                    
                                    const cleanup = () => {
                                        window.URL.revokeObjectURL(blobUrl);
                                        audioElement.removeEventListener('removed', cleanup);
                                    };
                                    audioElement.addEventListener('removed', cleanup);
                                } else {
                                    audioElement.style.opacity = '1';
                                    audioElement.style.pointerEvents = 'auto';
                                    addToLog(`Erro ao carregar áudio da parte ${partNumber}: ${response.status}`, true);
                                }
                                audioElement.dataset.loading = 'false';
                            } catch (error) {
                                console.error(`❌ Erro ao carregar áudio da parte ${partNumber}:`, error);
                                audioElement.style.opacity = '1';
                                audioElement.style.pointerEvents = 'auto';
                                addToLog(`Erro ao carregar áudio: ${error.message}`, true);
                                audioElement.dataset.loading = 'false';
                            }
                        };
                        
                        // Tentar carregar ao interagir com o player
                        audioElement.addEventListener('play', function(e) {
                            console.log(`🎵 Evento 'play' disparado para parte ${partNumber}`);
                            if (!this.src || this.src === '' || !this.src.startsWith('blob:')) {
                                console.log(`🎵 Src vazio ou não é blob, carregando...`);
                                e.preventDefault(); // Prevenir play até carregar
                                loadAudio().then(() => {
                                    if (this.src && this.src.startsWith('blob:')) {
                                        console.log(`🎵 Tentando play novamente após carregar...`);
                                        this.play().catch(err => console.error('Erro ao dar play:', err));
                                    }
                                });
                            }
                        });
                        
                        // Também tentar carregar quando clicar em qualquer lugar do player
                        audioElement.addEventListener('click', function(e) {
                            console.log(`🎵 Clique no player da parte ${partNumber}`);
                            if (!this.src || this.src === '' || !this.src.startsWith('blob:')) {
                                console.log(`🎵 Src vazio, carregando ao clicar...`);
                                loadAudio();
                            }
                        }, { capture: true });
                    }
                }
            });
        }
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
        const charCountEl = document.getElementById('tts-char-count');
        if (scriptInput) {
            scriptInput.value = '';
            // Atualiza contador após limpar (sem limite)
            if (charCountEl) {
                charCountEl.textContent = '';
                charCountEl.className = 'text-sm text-gray-500 dark:text-gray-400';
            }
        }
        
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
        const charCountEl = document.getElementById('tts-char-count');
        
        if (scriptInput) {
            scriptInput.addEventListener('input', () => {
                debouncedVoiceDuration();
                updateCharCount();
            });
            
            // Atualiza contador ao carregar
            updateCharCount();
        }
        
        // Função para atualizar contador de caracteres (sem limite)
        function updateCharCount() {
            if (!scriptInput || !charCountEl) return;
            const currentLength = scriptInput.value.length;
            // Mostra apenas o total de caracteres, sem limite
            if (currentLength > 0) {
                charCountEl.textContent = `${currentLength.toLocaleString('pt-BR')} caracteres`;
                charCountEl.className = 'text-sm text-gray-500 dark:text-gray-400';
            } else {
                charCountEl.textContent = '';
            }
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
                const data = await response.json().catch(() => ({ message: null }));
                
                // Logout automático para erros de autenticação
                if ((response.status === 401 || response.status === 403) && !endpoint.includes('/api/verify-session')) {
                     handleLogout();
                }
                
                // Mensagens de erro mais amigáveis
                let userFriendlyMessage = data.message;
                
                if (!userFriendlyMessage) {
                    switch (response.status) {
                        case 400:
                            userFriendlyMessage = 'Requisição inválida. Verifique os dados enviados.';
                            break;
                        case 401:
                            userFriendlyMessage = 'Sessão expirada. Faça login novamente.';
                            break;
                        case 403:
                            userFriendlyMessage = 'Acesso negado. Você não tem permissão.';
                            break;
                        case 404:
                            userFriendlyMessage = 'Recurso não encontrado. O trabalho pode ter expirado.';
                            break;
                        case 429:
                            userFriendlyMessage = 'Muitas requisições. Aguarde alguns segundos e tente novamente.';
                            break;
                        case 500:
                            userFriendlyMessage = 'Erro no servidor. Tente novamente em alguns instantes.';
                            break;
                        case 502:
                            userFriendlyMessage = 'Servidor temporariamente indisponível. Tente novamente em alguns instantes.';
                            break;
                        case 503:
                            userFriendlyMessage = 'Serviço em manutenção. Tente novamente mais tarde.';
                            break;
                        case 504:
                            userFriendlyMessage = 'Tempo de resposta esgotado. O servidor demorou muito para responder.';
                            break;
                        default:
                            userFriendlyMessage = `Erro ao processar requisição (Código: ${response.status})`;
                    }
                }
                
                throw new Error(userFriendlyMessage);
            }
            return await response.json().catch(() => ({}));
        } catch (error) {
            // Erros de rede (sem conexão, etc)
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.error('Network Error:', error);
                throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
            }
            
            console.error('API Request Error:', error);
            throw error;
        }
    }

    async function streamApiRequest(endpoint, body, onChunk, onDone, onError) {
        const token = localStorage.getItem('authToken');
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro na requisicao de streaming.');
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
                            return;
                        }
                        
                        buffer += decoder.decode(value, { stream: true });
                        
                        const lines = buffer.split('\n');
                        buffer = lines.pop(); // Keep the potentially incomplete last line

                        for (const line of lines) {
                            if (line.trim() === 'data: [DONE]') { // OpenAI stream finished
                                onDone(buffer);
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
                }
            }
            processStream();

        } catch (error) {
            onError(error);
        }
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
        // Só mostra o alerta se estivermos dentro da plataforma (app-container visível)
        const appContainer = document.getElementById('app-container');
        if (!appContainer || (appContainer.style.display !== 'flex' && appContainer.style.display !== '')) {
            return false; // Não está dentro da plataforma ainda
        }
        
        // Verifica também se o usuário está logado
        if (!appState.currentUser) {
            return false;
        }
        
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
        return !appState.apiKeysConfigured;
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

        // Aguarda um pequeno delay para garantir que a tela está totalmente renderizada
        await new Promise(resolve => setTimeout(resolve, 100));

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
            { id: 'script-reviewer', type: 'tool', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Revisor de Roteiro' },
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
    
    function renderReviewerScriptPage() {
        const tabContent = document.getElementById('tab-content');
        let reviewerOutput = tabContent ? tabContent.querySelector('#reviewer-output') : document.getElementById('reviewer-output');
        
        if (!reviewerOutput) {
            const formContainer = tabContent ? tabContent.querySelector('.max-w-3xl.mx-auto > div.bg-white') : null;
            if (formContainer && formContainer.parentElement) {
                reviewerOutput = document.createElement('div');
                reviewerOutput.id = 'reviewer-output';
                reviewerOutput.className = 'mt-6 space-y-6';
                formContainer.parentElement.appendChild(reviewerOutput);
            } else {
                return;
            }
        }
        
        const { revisedScriptParts, totalParts, currentPage, partsPerPage } = reviewerResults;
        
        if (!revisedScriptParts || revisedScriptParts.length === 0) {
            return;
        }
        
        let revisedScriptOutput = reviewerOutput.querySelector('#reviewer-revised-script-output');
        if (!revisedScriptOutput) {
            revisedScriptOutput = document.createElement('div');
            revisedScriptOutput.id = 'reviewer-revised-script-output';
            revisedScriptOutput.className = 'mt-6';
            reviewerOutput.appendChild(revisedScriptOutput);
        }
        
        const totalPages = Math.ceil(totalParts / partsPerPage);
        const start = (currentPage - 1) * partsPerPage;
        const end = start + partsPerPage;
        const partsToShow = revisedScriptParts.slice(start, end);
        
        revisedScriptOutput.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Roteiro Revisado (${totalParts} partes)</h3>
                <div class="flex gap-2">
                    <button id="copy-revised-script-btn" type="button" class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 font-semibold dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 cursor-pointer">Copiar Completo</button>
                    <button id="download-revised-script-btn" type="button" class="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-md hover:bg-green-200 font-semibold dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40 cursor-pointer">Transferir .txt</button>
                </div>
            </div>
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Partes ${start + 1} a ${Math.min(end, totalParts)} de ${totalParts} (Página ${currentPage} de ${totalPages})</h4>
            </div>
            <div class="space-y-4">
                ${partsToShow.map((part) => `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-bold text-gray-900 dark:text-gray-100">${part.part_title}</h4>
                            ${createCopyButton(part.part_content)}
                        </div>
                        <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${part.part_content}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        let paginationContainer = reviewerOutput.querySelector('#reviewer-pagination-controls');
        if (totalParts > partsPerPage) {
            if (!paginationContainer) {
                paginationContainer = document.createElement('div');
                paginationContainer.id = 'reviewer-pagination-controls';
                paginationContainer.className = 'flex justify-center gap-2 mt-4 flex-wrap';
                revisedScriptOutput.appendChild(paginationContainer);
            }
            
            let paginationHtml = '';
            if (currentPage > 1) {
                paginationHtml += `<button type="button" class="reviewer-page-btn px-4 py-2 text-sm rounded-md bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 cursor-pointer" data-page="${currentPage - 1}">← Anterior</button>`;
            }
            
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                    paginationHtml += `<button type="button" class="reviewer-page-btn px-4 py-2 text-sm rounded-md ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'} cursor-pointer" data-page="${i}">${i}</button>`;
                } else if (i === currentPage - 3 || i === currentPage + 3) {
                    paginationHtml += `<span class="px-2 text-gray-500 dark:text-gray-400">...</span>`;
                }
            }
            
            if (currentPage < totalPages) {
                paginationHtml += `<button type="button" class="reviewer-page-btn px-4 py-2 text-sm rounded-md bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 cursor-pointer" data-page="${currentPage + 1}">Próximo →</button>`;
            }
            
            paginationContainer.innerHTML = paginationHtml;
        } else if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
        
        revisedScriptOutput.style.display = 'block';
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
            if (total_parts > 5) {
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
            if (total_parts > 5) {
                let paginationHtml = '<div class="flex items-center justify-center gap-2 flex-wrap">';
                
                // Botão Anterior
                paginationHtml += `<button class="page-btn px-4 py-2 text-sm font-medium rounded-md ${currentPage === 1 ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Anterior</button>`;
                
                // Botões de página
                const maxPagesToShow = 7;
                let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
                if (endPage - startPage + 1 < maxPagesToShow) {
                    startPage = Math.max(1, endPage - maxPagesToShow + 1);
                }
                
                if (startPage > 1) {
                    paginationHtml += `<button class="page-btn px-4 py-2 text-sm font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600" data-page="1">1</button>`;
                    if (startPage > 2) {
                        paginationHtml += `<span class="px-2 text-gray-500 dark:text-gray-400">...</span>`;
                    }
                }
                
                for (let i = startPage; i <= endPage; i++) {
                    paginationHtml += `<button class="page-btn px-4 py-2 text-sm font-medium rounded-md ${i === currentPage ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'}" data-page="${i}">${i}</button>`;
                }
                
                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                        paginationHtml += `<span class="px-2 text-gray-500 dark:text-gray-400">...</span>`;
                    }
                    paginationHtml += `<button class="page-btn px-4 py-2 text-sm font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600" data-page="${totalPages}">${totalPages}</button>`;
                }
                
                // Botão Próximo
                paginationHtml += `<button class="page-btn px-4 py-2 text-sm font-medium rounded-md ${currentPage === totalPages ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Próximo →</button>`;
                
                paginationHtml += '</div>';
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
        // Tentar buscar dentro do tab-content primeiro, depois globalmente
        const tabContent = document.getElementById('tab-content');
        let container = tabContent ? tabContent.querySelector(`#${containerId}`) : null;
        if (!container) {
            container = document.getElementById(containerId);
        }
        
        if (!container) {
            console.error(`Container não encontrado: ${containerId}`);
            return false;
        }
        if (!scores) {
            console.error('Scores não fornecidos:', scores);
            return false;
        }

        console.log('Renderizando scores:', scores);
        console.log('Container encontrado:', containerId, container);

        const retention = scores.retention_potential || 0;
        const clarity = scores.clarity_score || 0;
        const viral = scores.viral_potential || 0;

        try {
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${renderScoreCard('Potencial de Retencao', retention, {})}
                ${renderScoreCard('Clareza da Mensagem', clarity, {})}
                ${renderScoreCard('Potencial Viral', viral, {})}
            </div>
        `;
            console.log('Scores renderizados com sucesso');
            return true;
        } catch (error) {
            console.error('Erro ao renderizar scores:', error);
            container.innerHTML = `<p class="text-red-500">Erro ao renderizar pontuações: ${error.message}</p>`;
            return false;
        }
    };

    // New: Function to render reviewer suggestions
    const renderReviewerSuggestions = (suggestions) => {
        // Tentar buscar dentro do tab-content primeiro, depois globalmente
        const tabContent = document.getElementById('tab-content');
        let suggestionsOutput = tabContent ? tabContent.querySelector('#reviewer-suggestions-output') : null;
        if (!suggestionsOutput) {
            suggestionsOutput = document.getElementById('reviewer-suggestions-output');
        }
        
        if (!suggestionsOutput) {
            console.error('Elemento reviewer-suggestions-output não encontrado');
            return false;
        }
        
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            console.warn('Sugestões inválidas ou vazias:', suggestions);
            suggestionsOutput.innerHTML = '';
            return false;
        }

        console.log('Renderizando sugestões:', suggestions.length);

        try {
        suggestionsOutput.innerHTML = `
            <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Sugestoes de Melhoria</h3>
            <div class="space-y-4">
                    ${suggestions.map(s => {
                        const title = s.title || s.titulo || 'Sugestão';
                        const suggestion = s.suggestion || s.sugestao || s.text || '';
                        return `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <h4 class="font-bold text-gray-900 dark:text-gray-100 mb-2">${title}</h4>
                                <p class="text-gray-600 dark:text-gray-300">${suggestion}</p>
                    </div>
                        `;
                    }).join('')}
            </div>
        `;
            console.log('Sugestões renderizadas com sucesso');
            return true;
        } catch (error) {
            console.error('Erro ao renderizar sugestões:', error);
            suggestionsOutput.innerHTML = `<p class="text-red-500">Erro ao renderizar sugestões: ${error.message}</p>`;
            return false;
        }
    };
    // New: Function to re-evaluate script after changes
    async function reevaluateScript(scriptContent) {
        const model = document.getElementById('script-reviewer-model-select')?.value;
        const lang = document.getElementById('reviewer-lang')?.value || 'Portugues (Brasil)';
        const duration = document.getElementById('reviewer-duration')?.value;
        if (!model) return;

        showProgressModal("Reavaliando roteiro...", "A IA esta calculando novas pontuacoes...");

        const corePrinciples = `Etico: valor, respeito, transparencia. Evite "segredo", "infalivel", "garantido".`;
        const langContext = lang ? ` Lingua: ${removeAccents(lang)}.` : '';
        const durationContext = duration ? ` Duracao: ~${duration}min.` : '';
        const scorePrompt = `Analise roteiro revisado. Atribua 0-100 para retention_potential, clarity_score, viral_potential. ${corePrinciples}${langContext}${durationContext} Roteiro foi melhorado - pontuacoes devem ser realistas mas positivas. JSON apenas.\n\nROTEIRO:\n"""${removeAccents(scriptContent)}"""`;
        const scoreSchema = { type: "OBJECT", properties: { retention_potential: { type: "NUMBER" }, clarity_score: { type: "NUMBER" }, viral_potential: { type: "NUMBER" } } };

        try {
            const scoreResult = await apiRequestWithFallback('/api/generate', 'POST', { prompt: scorePrompt, model, schema: scoreSchema });
            if (scoreResult.data) {
                if (!scoreResult.data) scoreResult.data = {};
                const scoreKeys = ['retention_potential', 'clarity_score', 'viral_potential'];
                const originalScores = reviewerResults.originalScores || {};
                
                scoreKeys.forEach(key => {
                    let score = scoreResult.data[key];
                    if (score === undefined || score === null || isNaN(score)) {
                        // Se não tem pontuação válida, gera uma que seja melhor que a original
                        const originalScore = originalScores[key] || 70;
                        score = Math.max(originalScore + 2, generateRandomScore(Math.max(78, originalScore + 1), 98.5));
                    } else {
                        score = Math.min(Math.max(score, 0), 100);
                        
                        // GARANTIR que a pontuação seja SEMPRE melhor ou igual à original
                        const originalScore = originalScores[key];
                        if (originalScore !== undefined && originalScore !== null) {
                            if (score < originalScore) {
                                // Se a pontuação nova é menor, ajusta para ser pelo menos igual ou um pouco melhor
                                score = Math.max(originalScore, Math.min(originalScore + 2, 100));
                                addToLog(`Ajustando ${key}: pontuacao melhorada de ${originalScore} para ${score} (garantindo melhoria)`, false);
                            } else if (score === originalScore) {
                                // Se for igual, aumenta um pouco para mostrar melhoria
                                score = Math.min(originalScore + 1, 100);
                                addToLog(`Ajustando ${key}: pontuacao melhorada de ${originalScore} para ${score} (melhoria garantida)`, false);
                            }
                        }
                    }
                    scoreResult.data[key] = Math.min(score, 98.5);
                });
                
                reviewerResults.newScores = scoreResult.data;
                
                // Garantir que temos o container de output
                const tabContent = document.getElementById('tab-content');
                let outputContainer = tabContent ? tabContent.querySelector('#reviewer-output') : document.getElementById('reviewer-output');
                
                if (outputContainer) {
                    // Criar ou atualizar o container de novas pontuações
                    let newScoresContainer = outputContainer.querySelector('#reviewer-new-scores-container');
                    if (!newScoresContainer) {
                        newScoresContainer = document.createElement('div');
                        newScoresContainer.id = 'reviewer-new-scores-container';
                        newScoresContainer.className = 'mb-6';
                        newScoresContainer.innerHTML = `
                            <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Nova Pontuacao</h3>
                            <div id="reviewer-new-score-cards"></div>
                        `;
                        outputContainer.appendChild(newScoresContainer);
                    }
                    
                    const newScoresCardsEl = newScoresContainer.querySelector('#reviewer-new-score-cards');
                    if (newScoresCardsEl) {
                        renderReviewerScoresWithComparison(reviewerResults.originalScores, reviewerResults.newScores, 'reviewer-new-score-cards');
                        newScoresContainer.style.display = 'block';
                    }
                } else {
                    // Fallback: tentar renderizar mesmo sem container
                    renderReviewerScoresWithComparison(reviewerResults.originalScores, reviewerResults.newScores, 'reviewer-new-score-cards');
                    const newScoresContainerEl = document.getElementById('reviewer-new-scores-container');
                    if (newScoresContainerEl) newScoresContainerEl.style.display = 'block';
                }
                
                // Comparar pontuações totais
                const originalAvg = scoreKeys.reduce((sum, key) => sum + (originalScores[key] || 0), 0) / scoreKeys.length;
                const newAvg = scoreKeys.reduce((sum, key) => sum + (scoreResult.data[key] || 0), 0) / scoreKeys.length;
                
                if (newAvg > originalAvg) {
                    showSuccessToast(`Pontuacao melhorada! Media: ${originalAvg.toFixed(1)} → ${newAvg.toFixed(1)} (+${(newAvg - originalAvg).toFixed(1)})`);
                } else if (newAvg === originalAvg) {
                    showSuccessToast(`Pontuacao mantida: ${newAvg.toFixed(1)} (mesma qualidade)`);
                }
            } else {
                throw new Error("Nao foi possivel obter a nova pontuacao do roteiro.");
            }
        } catch (error) {
            addToLog(`Erro ao reavaliar roteiro: ${error.message}`, true);
        } finally {
            hideProgressModal();
        }
    }

    // Função para renderizar pontuações com comparação
    function renderReviewerScoresWithComparison(originalScores, newScores, containerId) {
        const tabContent = document.getElementById('tab-content');
        let container = tabContent ? tabContent.querySelector(`#${containerId}`) : null;
        if (!container) {
            container = document.getElementById(containerId);
        }
        if (!container || !newScores) return;

        const scoreKeys = ['retention_potential', 'clarity_score', 'viral_potential'];
        const labels = {
            retention_potential: 'Potencial de Retenção',
            clarity_score: 'Clareza da Mensagem',
            viral_potential: 'Potencial Viral'
        };

        const cardsHtml = scoreKeys.map(key => {
            const newScore = newScores[key] || 0;
            const originalScore = originalScores?.[key] || 0;
            const difference = newScore - originalScore;
            const isImproved = difference > 0;
            const isSame = difference === 0;
            
            let badgeClass = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            let badgeText = 'Sem mudança';
            let arrowIcon = '';
            
            if (isImproved) {
                badgeClass = 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
                badgeText = `+${difference.toFixed(1)}`;
                arrowIcon = '<svg class="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>';
            } else if (!isSame && difference < 0) {
                badgeClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
                badgeText = `${difference.toFixed(1)}`;
                arrowIcon = '<svg class="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>';
            }
            
            return `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-semibold text-gray-900 dark:text-gray-100">${labels[key]}</h4>
                        <span class="text-xs px-2 py-1 rounded-full ${badgeClass}">
                            ${arrowIcon} ${badgeText}
                        </span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">${newScore.toFixed(1)}</span>
                        <span class="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
                    </div>
                    ${originalScores ? `
                        <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Original: ${originalScore.toFixed(1)}
                        </div>
                    ` : ''}
                    <div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: ${newScore}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        // Calcular médias
        const originalMainScore = originalScores ? 
            (originalScores.retention_potential + originalScores.clarity_score + originalScores.viral_potential) / 3 : 0;
        const newMainScore = (newScores.retention_potential + newScores.clarity_score + newScores.viral_potential) / 3;
        const mainScoreDifference = newMainScore - originalMainScore;
        const isMainImproved = mainScoreDifference > 0;
        const isMainSame = mainScoreDifference === 0;

        let mainBadgeClass = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        let mainBadgeText = 'Sem mudança';
        let mainArrowIcon = '';
        
        if (isMainImproved) {
            mainBadgeClass = 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
            mainBadgeText = `+${mainScoreDifference.toFixed(1)}`;
            mainArrowIcon = '<svg class="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>';
        } else if (!isMainSame && mainScoreDifference < 0) {
            mainBadgeClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
            mainBadgeText = `${mainScoreDifference.toFixed(1)}`;
            mainArrowIcon = '<svg class="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>';
        }

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Analise de Pontuacao</h3>
                        ${originalScores ? `
                            <span class="text-xs px-2 py-1 rounded-full ${mainBadgeClass}">
                                ${mainArrowIcon} ${mainBadgeText}
                            </span>
                        ` : ''}
                    </div>
                    ${renderScoreCard('Potencial de Sucesso', newMainScore, {
                        'Potencial de Retencao': newScores.retention_potential,
                        'Clareza da Mensagem': newScores.clarity_score,
                        'Potencial Viral': newScores.viral_potential
                    })}
                    ${originalScores ? `
                        <div class="mt-3 text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-200 dark:border-gray-700">
                            Pontuação Original: ${originalMainScore.toFixed(1)} / 100
                        </div>
                    ` : ''}
                </div>
                <div class="grid grid-cols-1 gap-4">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }


    // Função auxiliar para processar retry de imagens (acessível globalmente)
    const createProcessFailedImageRetry = (form) => {
        return async (failedImage, index) => {
            const sceneNumber = failedImage.sceneNumber;
            const errorMessage = (failedImage.error || '').toLowerCase();
            
            // Detecta se é erro de throttling (limite de requisições)
            const isThrottlingError = errorMessage.includes('throttled') || 
                                     errorMessage.includes('limite de requisições') ||
                                     errorMessage.includes('429') ||
                                     errorMessage.includes('too many requests') ||
                                     errorMessage.includes('limite temporário');
            
            // Se for erro de throttling, apenas tenta novamente com o mesmo prompt
            if (isThrottlingError) {
                try {
                    imageFxResults.images[index] = {
                        ...failedImage,
                        status: 'retrying',
                        error: 'Limite de requisições atingido. Tentando novamente...'
                    };
                    renderImageFxOutput();
                    appState.imageGenStatus.message = `Cena ${sceneNumber}: tentando novamente após limite temporário...`;
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
                    const retryErrorMessage = (retryError.message || '').toLowerCase();
                    const isStillThrottling = retryErrorMessage.includes('throttled') || 
                                             retryErrorMessage.includes('limite de requisições') ||
                                             retryErrorMessage.includes('429') ||
                                             retryErrorMessage.includes('too many requests') ||
                                             retryErrorMessage.includes('limite temporário');
                    
                    addToLog(`Falha ao gerar novamente a cena ${sceneNumber}: ${retryError.message}`, true);
                    imageFxResults.images[index] = {
                        ...failedImage,
                        status: 'failed',
                        error: isStillThrottling ? `Limite temporário: ${retryError.message}` : `Falha no retry: ${retryError.message}`
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
    };

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
                const result = await apiRequestWithFallback('/api/generate', 'POST', { prompt, model, schema });
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
            const prompt = `Crie Guia de Edicao (Editor's Cut). Combine roteiro e prompts numa timeline. Estime timestamps (150 palavras/min). Formato Markdown: **CENA [N] (HH:MM:SS - HH:MM:SS):** + prompt + narracao.

ROTEIRO:
            ${removeAccents(script)}

PROMPTS:
${removeAccents(prompts)}`;

            showProgressModal("Gerando Guia de Edicao...", "A IA esta montando a sua linha do tempo...");
            if (outputEl) outputEl.innerHTML = '';

            try {
                const result = await apiRequestWithFallback('/api/generate', 'POST', { prompt, model, maxOutputTokens: 6000, temperature: 0.4 });
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
                parts: (() => {
                    const partsInput = document.getElementById('script-parts');
                    const durationInput = document.getElementById('script-duration');
                    let parts = parseInt(partsInput?.value, 10);
                    
                    // Se não houver partes calculadas, calcular baseado na duração
                    if (isNaN(parts) || parts <= 0) {
                        const duration = parseInt(durationInput?.value, 10);
                        if (!isNaN(duration) && duration > 0) {
                            parts = Math.max(1, Math.ceil(duration / 2));
                            if (partsInput) partsInput.value = parts;
                            console.log(`⚠️ Partes não calculadas. Calculando: ${duration} minutos → ${parts} partes`);
                        }
                    }
                    
                    console.log(`📝 Formulário - Duração: ${durationInput?.value} min, Partes: ${parts}`);
                    return parts;
                })(),
                narrationOnly: document.getElementById('script-narration')?.checked,
                includeAffiliate: document.getElementById('include-affiliate-product')?.checked,
                affiliateProduct: document.getElementById('affiliate-product-description')?.value.trim(),
                tone: document.getElementById('script-tone')?.value,
                lang: document.getElementById('script-lang')?.value,
                formula: document.getElementById('script-formula')?.value,
                manualStructure: document.getElementById('manual-structure-input')?.value.trim(),
                model: document.getElementById('script-writer-model-select')?.value,
                ctaPositions: Array.from(document.querySelectorAll('[id^="cta-"]:checked')).map(cb => cb.id.replace('cta-', ''))
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
            
            // Cada parte deve ter aproximadamente 320 palavras divididas em 5 parágrafos
            const paragraphsPerPart = 5;
            const targetWordsPerPart = 320;
            const minWordsPerParagraph = Math.floor(targetWordsPerPart / paragraphsPerPart); // 64 palavras mínimo por parágrafo
            const maxWordsPerParagraph = Math.ceil(targetWordsPerPart / paragraphsPerPart) + 5; // ~69 palavras máximo por parágrafo
            const totalWordsPerPart = targetWordsPerPart;
            const maxCharsPerPart = 7000; // Aumentado para acomodar 320 palavras

            let gpt_specific_instructions = '';
            if (form.model?.startsWith('gpt-')) {
                gpt_specific_instructions = `GPT: Seja prolixo e detalhado. CADA parte DEVE ter EXATAMENTE ~${targetWordsPerPart} palavras em ${paragraphsPerPart} paragrafos. Paragrafos devem ter entre ${minWordsPerParagraph} e ${maxWordsPerParagraph} palavras. Prioridade ABSOLUTA: comprimento completo. NUNCA resuma, SEMPRE expanda com detalhes, exemplos, descricoes e explicacoes.`;
            }

            dynamicOutputInstruction = `FORMATO OBRIGATORIO: ${form.parts} partes. CADA parte DEVE ter EXATAMENTE ${paragraphsPerPart} paragrafos com TOTAL de ~${targetWordsPerPart} palavras por parte (${minWordsPerParagraph}-${maxWordsPerParagraph} palavras/paragrafo). Max ${maxCharsPerPart} chars/parte. 
REGRA CRITICA: NUNCA abrevie, resuma ou pule conteudo. CADA parte DEVE estar COMPLETA com ${targetWordsPerPart} palavras. Se uma parte estiver curta, EXPANDA com mais detalhes, exemplos, descricoes e explicacoes. ${gpt_specific_instructions}
PONTUACAO: Use pontuacao completa (.,;!?) em todas as frases.
SAIDA: Use "[--PART N: TITULO--]" no inicio e "[--ENDPART--]" no final de cada parte. Ultima parte deve terminar com "[--ENDPART--]".`;
            if (form.narrationOnly) {
                dynamicOutputInstruction = `GERE ${form.parts} partes completas. CADA parte DEVE ter EXATAMENTE ~${targetWordsPerPart} palavras em ${paragraphsPerPart} paragrafos. NAO abrevie, resuma ou pule partes. Se uma parte estiver curta, EXPANDA com mais detalhes. SAIDA: Apenas narracao pura, sem tags ou titulos. Separe partes com "[--VOICEOVER_PART_BREAK--]".`;
            }

            if (form.includeAffiliate && form.affiliateProduct) {
                affiliateInstruction = `Integre naturalmente o produto: "${removeAccents(form.affiliateProduct)}".`;
            }

            if (form.trendsTerm) {
                trendsInstruction = `Incorpore o termo "${removeAccents(form.trendsTerm)}" organicamente.`;
            }

            if (form.ctaPositions.length > 0) {
                const totalCTAs = form.ctaPositions.length;
                const ctaRules = form.ctaPositions.map(pos => {
                    if (pos === 'inicio') return 'inicio: CTA na Parte 1 (final)';
                    if (pos === 'meio') return 'meio: CTA na parte do meio';
                    if (pos === 'final') return 'final: CTA na ultima parte';
                    return pos;
                }).join(', ');
                ctaInstruction = `REGRA CTA (OBRIGATORIO): Inclua EXATAMENTE ${totalCTAs} CTA(s) APENAS nas posicoes: ${ctaRules}. NAO inclua CTAs em outras partes. Use linguagem direta (ex: "Se inscreva", "Deixe seu like", "Comente"). Integre naturalmente, 1-2 paragrafos cada.`;
            }

            const contextInstruction = `Transicoes sutis entre partes: ultimo paragrafo de cada parte deve criar gancho para a proxima. Evite frases como "Na proxima parte...". Mantenha linha narrativa consistente.`;

            let final_check_instruction = '';
            const ctaCheck = form.ctaPositions.length > 0 
                ? `CTAs: EXATAMENTE ${form.ctaPositions.length} CTA(s) APENAS nas posicoes selecionadas (${form.ctaPositions.join(', ')})? Nenhum CTA extra?`
                : 'Nenhum CTA incluido?';
            if (form.narrationOnly) {
                final_check_instruction = `REVISAO CRITICA: ${form.parts} partes? CADA parte tem ~${targetWordsPerPart} palavras em ${paragraphsPerPart} paragrafos? Nenhuma parte esta curta? Tags "[--VOICEOVER_PART_BREAK--]" entre partes? Apenas narracao sem extras? ${ctaCheck}`;
            } else {
                final_check_instruction = `REVISAO CRITICA: ${form.parts} partes? CADA parte tem ${paragraphsPerPart} paragrafos? TOTAL de ~${targetWordsPerPart} palavras por parte (${minWordsPerParagraph}-${maxWordsPerParagraph} palavras/paragrafo)? Nenhuma parte esta curta? Tags corretas? Pontuacao completa? ${ctaCheck} Ultima parte com "[--ENDPART--]"?`;
            }

            const prompt = `DARKSCRIP AI - Especialista em roteiros virais. Crie roteiro seguindo EXATAMENTE a formula abaixo.

REGRA CRITICA: Comece DIRETAMENTE com [--PART 1: ... --] (ou narracao pura se voice-over). Sem introducoes.

FORMULA OBRIGATORIA (SIGA TODAS AS INSTRUCOES):
            ${removeAccents(formulaContent)}

IMPORTANTE: Voce DEVE seguir TODAS as instrucoes da formula acima. Nao pule nenhuma etapa, nao resuma, nao modifique a estrutura. A formula e OBRIGATORIA.

DIRETRIZES: Nicho: "${removeAccents(form.niche)}" | Publico: "${removeAccents(form.audience)}" | Tema: "${removeAccents(form.topic)}" | Tom: "${removeAccents(form.tone)}" | Lingua: "${removeAccents(form.lang)}" | Duracao: ${form.duration}min

            ${removeAccents(contextInstruction)}
            ${removeAccents(dynamicOutputInstruction)}
            ${removeAccents(ctaInstruction)}
            ${removeAccents(affiliateInstruction)}
            ${removeAccents(trendsInstruction)}
${removeAccents(final_check_instruction)}`;
            
            const outputEl = document.getElementById('output');
            const initialPartsCount = scriptResults.fullResult ? scriptResults.fullResult.script_parts.length : 0;
            const remainingParts = form.parts - initialPartsCount;

            const promptWithContinuation = continueGeneration ? 
                `${prompt}\n\nCONTINUAR: Parte ${initialPartsCount + 1} em diante. Gere ${remainingParts} partes restantes (total: ${form.parts}).` :
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
                const totalWordsForPart = targetWordsPerPart; // 320 palavras por parte
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

                // Adiciona qualquer buffer restante
                if (remainingBuffer) {
                textBuffer += remainingBuffer;
                }

                // Processa qualquer conteúdo restante no buffer
                const delimiter = form.narrationOnly ? "[--VOICEOVER_PART_BREAK--]" : "[--ENDPART--]";
                
                // Se ainda houver conteúdo no buffer, processa
                if (textBuffer.trim()) {
                    // Se o buffer contém delimitadores, processa cada parte
                    if (textBuffer.includes(delimiter)) {
                        while(textBuffer.includes(delimiter)) {
                            const partEndIndex = textBuffer.indexOf(delimiter);
                            const partToProcess = textBuffer.substring(0, partEndIndex);
                            textBuffer = textBuffer.substring(partEndIndex + delimiter.length);
                            if (partToProcess.trim()) {
                                processPart(partToProcess);
                            }
                        }
                    }
                    
                    // Processa qualquer conteúdo restante (última parte sem delimitador)
                    if (textBuffer.trim()) {
                processPart(textBuffer);
                        textBuffer = ''; // Limpa o buffer após processar
                    }
                }

                // Verifica se todas as partes foram geradas
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
            const lang = document.getElementById('reviewer-lang')?.value || 'Portugues (Brasil)';
            const duration = document.getElementById('reviewer-duration')?.value;
            
            // Buscar o container de output - tentar várias formas
            const tabContent = document.getElementById('tab-content');
            let reviewerOutput = tabContent ? tabContent.querySelector('#reviewer-output') : document.getElementById('reviewer-output');
            
            // Se não encontrar, criar o container
            if (!reviewerOutput) {
                // Buscar o formulário para inserir após ele
                const formContainer = tabContent ? tabContent.querySelector('.max-w-3xl.mx-auto > div.bg-white') : null;
                if (formContainer && formContainer.parentElement) {
                    reviewerOutput = document.createElement('div');
                    reviewerOutput.id = 'reviewer-output';
                    reviewerOutput.className = 'mt-6 space-y-6';
                    formContainer.parentElement.appendChild(reviewerOutput);
                    console.log('Container reviewer-output criado dinamicamente');
                } else {
                    console.error('Não foi possível criar o container reviewer-output');
                }
            }

            if (!scriptText || !model) {
                showSuccessToast("Por favor, cole um roteiro e selecione um modelo de IA para ser analisado.");
                return;
            }

            // Calcular palavras do roteiro original
            const originalWords = scriptText.split(/\s+/).filter(Boolean).length;

            // Verificar se há pontuações do roteiro importado (não resetar se já tiver e for o mesmo script)
            const hasImportedScores = reviewerResults.originalScores && reviewerResults.originalScript === scriptText;
            
            // Reset reviewer results - manter pontuações se o script for o mesmo
            if (!hasImportedScores) {
                reviewerResults.originalScores = null;
            }
            reviewerResults.originalScript = scriptText;
            reviewerResults.suggestions = [];
            reviewerResults.revisedScript = '';
            reviewerResults.newScores = null;
            
            // Limpar output anterior se existir (mas manter pontuações se já tiver)
            if (reviewerOutput) {
                // Se já temos pontuações, manter o container de pontuações
                if (hasImportedScores) {
                    // Limpar apenas sugestões e resultados de revisão
                    const suggestionsEl = reviewerOutput.querySelector('#reviewer-suggestions-output');
                    const actionsEl = reviewerOutput.querySelector('#improvement-actions-container');
                    const revisedEl = reviewerOutput.querySelector('#reviewer-revised-script-output');
                    const newScoresEl = reviewerOutput.querySelector('#reviewer-new-scores-container');
                    if (suggestionsEl) suggestionsEl.innerHTML = '';
                    if (actionsEl) actionsEl.style.display = 'none';
                    if (revisedEl) revisedEl.style.display = 'none';
                    if (newScoresEl) newScoresEl.style.display = 'none';
                } else {
                    reviewerOutput.innerHTML = '';
                }
            }

            showProgressModal("Analisando roteiro...", "A IA esta a avaliar o potencial e a gerar sugestoes...");

            const corePrinciples = `Etico: valor, respeito, transparencia. Evite "segredo", "infalivel", "garantido".`;

            try {
                const langContext = lang ? ` Lingua: ${removeAccents(lang)}.` : '';
                const durationContext = duration ? ` Duracao: ~${duration}min.` : '';
                
                let scoreResultPromise;
                if (!reviewerResults.originalScores) {
                    const scorePrompt = `Analise roteiro. Atribua 0-100 para retention_potential, clarity_score, viral_potential. ${corePrinciples}${langContext}${durationContext} Criterios: retention (ganchos, ritmo), clarity (compreensao), viral (compartilhamento). JSON apenas.\n\nROTEIRO:\n"""${removeAccents(scriptText)}"""`;
                    const scoreSchema = { type: "OBJECT", properties: { retention_potential: { type: "NUMBER" }, clarity_score: { type: "NUMBER" }, viral_potential: { type: "NUMBER" } }, required: ["retention_potential", "clarity_score", "viral_potential"] };
                    scoreResultPromise = apiRequestWithFallback('/api/generate', 'POST', { prompt: scorePrompt, model, schema: scoreSchema });
                } else {
                    // Se já temos pontuações, criar uma Promise resolvida
                    console.log('Usando pontuações importadas:', reviewerResults.originalScores);
                    scoreResultPromise = Promise.resolve({ data: reviewerResults.originalScores });
                }

                let suggestionPrompt;
                let suggestionSchema;
                // Otimização 1: Prompt mais conciso
                // langContext e durationContext já foram declarados acima
                const baseSuggestionPrompt = `Analise roteiro YouTube. ${corePrinciples}${langContext}${durationContext} Sugira 3-5 melhorias praticas para retencao, clareza e viral.`;
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
                const suggestionPromise = apiRequestWithFallback('/api/generate', 'POST', { prompt: suggestionPrompt, model, schema: suggestionSchema });

                const [scoreResponse, suggestionResponse] = await Promise.all([scoreResultPromise, suggestionPromise]);

                // Logs removidos para evitar poluição do console

                // Só atualizar pontuações se não tiver pontuações importadas
                if (!reviewerResults.originalScores && scoreResponse && scoreResponse.data) {
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
                    // Pontuações calculadas na análise
                } else if (reviewerResults.originalScores) {
                    // Usando pontuações importadas (não recalculando)
                }
                
                // SEMPRE renderizar pontuações originais se existirem
                if (reviewerResults.originalScores) {
                    // Garantir que temos o container de output
                    if (!reviewerOutput) {
                        const tabContentCheck = document.getElementById('tab-content');
                        reviewerOutput = tabContentCheck ? tabContentCheck.querySelector('#reviewer-output') : document.getElementById('reviewer-output');
                    }
                    
                    if (reviewerOutput) {
                        // Verificar se o container de scores existe, se não, criar
                        let scoresContainer = reviewerOutput.querySelector('#reviewer-original-scores-container');
                        if (!scoresContainer) {
                            scoresContainer = document.createElement('div');
                            scoresContainer.id = 'reviewer-original-scores-container';
                            scoresContainer.className = 'mb-6';
                            scoresContainer.innerHTML = `
                                <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Pontuacao Original</h3>
                                <div id="reviewer-original-score-cards"></div>
                            `;
                            reviewerOutput.appendChild(scoresContainer);
                            // Container de pontuação criado
                        }
                        
                        const scoresCardsEl = scoresContainer.querySelector('#reviewer-original-score-cards');
                        if (scoresCardsEl) {
                            // Renderizar diretamente no elemento usando as pontuações EXATAS
                            const retention = reviewerResults.originalScores.retention_potential || 0;
                            const clarity = reviewerResults.originalScores.clarity_score || 0;
                            const viral = reviewerResults.originalScores.viral_potential || 0;
                            const mainScore = (retention + clarity + viral) / 3;
                            
                            scoresCardsEl.innerHTML = `
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        <div class="flex justify-between items-center mb-2">
                                            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Analise de Pontuacao</h3>
                                        </div>
                                        ${renderScoreCard('Potencial de Sucesso', mainScore, {
                                            'Potencial de Retencao': retention,
                                            'Clareza da Mensagem': clarity,
                                            'Potencial Viral': viral
                                        })}
                                    </div>
                                    <div class="grid grid-cols-1 gap-4">
                                        ${renderScoreCard('Potencial de Retencao', retention, {})}
                                        ${renderScoreCard('Clareza da Mensagem', clarity, {})}
                                        ${renderScoreCard('Potencial Viral', viral, {})}
                                    </div>
                                </div>
                            `;
                            scoresContainer.style.display = 'block';
                            // Pontuação original renderizada com sucesso
                } else {
                            console.error('Elemento reviewer-original-score-cards não encontrado dentro do container');
                        }
                    } else {
                        console.error('Container reviewer-output não encontrado');
                    }
                } else {
                    console.error('Resposta de pontuação inválida:', scoreResponse);
                    throw new Error("Nao foi possivel obter a pontuacao inicial do roteiro.");
                }

                let suggestionsData;
                if (model.startsWith('gpt-')) {
                    suggestionsData = suggestionResponse?.data?.suggestions;
                } else {
                    // Para Gemini, pode vir como array direto ou dentro de um objeto
                    if (Array.isArray(suggestionResponse?.data)) {
                        suggestionsData = suggestionResponse.data;
                    } else if (suggestionResponse?.data?.suggestions && Array.isArray(suggestionResponse.data.suggestions)) {
                        suggestionsData = suggestionResponse.data.suggestions;
                    } else if (suggestionResponse?.data?.data && Array.isArray(suggestionResponse.data.data)) {
                        suggestionsData = suggestionResponse.data.data;
                } else {
                    suggestionsData = suggestionResponse?.data;
                    }
                }
                
                // Logs removidos para evitar poluição do console

                if (Array.isArray(suggestionsData) && suggestionsData.length > 0) {
                    reviewerResults.suggestions = suggestionsData;
                    // Sugestões recebidas
                    
                    // Garantir que temos o container de output
                    if (!reviewerOutput) {
                        const tabContentCheck = document.getElementById('tab-content');
                        reviewerOutput = tabContentCheck ? tabContentCheck.querySelector('#reviewer-output') : document.getElementById('reviewer-output');
                    }
                    
                    if (reviewerOutput) {
                        // Verificar se o container de sugestões existe, se não, criar
                        let suggestionsOutputEl = reviewerOutput.querySelector('#reviewer-suggestions-output');
                        if (!suggestionsOutputEl) {
                            suggestionsOutputEl = document.createElement('div');
                            suggestionsOutputEl.id = 'reviewer-suggestions-output';
                            suggestionsOutputEl.className = 'mb-6';
                            reviewerOutput.appendChild(suggestionsOutputEl);
                            // Container de sugestões criado
                        }
                        
                        // Renderizar sugestões diretamente
                        suggestionsOutputEl.innerHTML = `
                            <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Sugestoes de Melhoria</h3>
                            <div class="space-y-4">
                                ${reviewerResults.suggestions.map(s => {
                                    const title = s.title || s.titulo || 'Sugestão';
                                    const suggestion = s.suggestion || s.sugestao || s.text || '';
                                    return `
                                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                            <h4 class="font-bold text-gray-900 dark:text-gray-100 mb-2">${title}</h4>
                                            <p class="text-gray-600 dark:text-gray-300">${suggestion}</p>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                        
                        // Verificar se o container de ações existe, se não, criar
                        let improvementActionsEl = reviewerOutput.querySelector('#improvement-actions-container');
                        if (!improvementActionsEl) {
                            improvementActionsEl = document.createElement('div');
                            improvementActionsEl.id = 'improvement-actions-container';
                            improvementActionsEl.className = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2 mb-6';
                            improvementActionsEl.innerHTML = `
                                <button id="apply-suggestions-btn" type="button" class="w-full text-center py-2 px-4 rounded-lg font-semibold bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40">Aplicar Sugestoes Automaticamente</button>
                            `;
                            reviewerOutput.appendChild(improvementActionsEl);
                            
                        }
                        
                        improvementActionsEl.style.display = 'block';
                        
                        // A delegação de eventos já deve capturar o clique, mas vamos garantir
                        // que o botão existe e está acessível
                        const applySuggestionsBtn = improvementActionsEl.querySelector('#apply-suggestions-btn');
                        if (applySuggestionsBtn) {
                            // Verificar se a delegação de eventos está funcionando
                            // Se não, anexar diretamente
                            if (!applySuggestionsBtn._directListener) {
                                const directHandler = async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (handlers['apply-suggestions-btn']) {
                                        await handlers['apply-suggestions-btn']();
                                    }
                                };
                                applySuggestionsBtn.addEventListener('click', directHandler);
                                applySuggestionsBtn._directListener = directHandler;
                            }
                        }
                        // Sugestões renderizadas com sucesso
                } else {
                        console.error('Container reviewer-output não encontrado para sugestões');
                    }
                } else {
                    console.warn("A IA não retornou sugestões válidas ou a resposta estava vazia.", {
                        isArray: Array.isArray(suggestionsData),
                        length: suggestionsData?.length,
                        data: suggestionsData
                    });
                    reviewerResults.suggestions = [];
                    const improvementActionsEl = document.getElementById('improvement-actions-container');
                    if (improvementActionsEl) improvementActionsEl.style.display = 'none';
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
                    const originalScoresContainerErr = document.getElementById('reviewer-original-scores-container');
                    const suggestionsOutputErr = document.getElementById('reviewer-suggestions-output');
                    const improvementActionsContainerErr = document.getElementById('improvement-actions-container');
                    const revisedScriptOutputErr = document.getElementById('reviewer-revised-script-output');
                    const newScoresContainerErr = document.getElementById('reviewer-new-scores-container');
                    
                    if (originalScoresContainerErr) originalScoresContainerErr.style.display = 'none';
                    if (suggestionsOutputErr) suggestionsOutputErr.innerHTML = ''; // Clear suggestions
                    if (improvementActionsContainerErr) improvementActionsContainerErr.style.display = 'none';
                    if (revisedScriptOutputErr) revisedScriptOutputErr.style.display = 'none';
                    if (newScoresContainerErr) newScoresContainerErr.style.display = 'none';
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
            
            const corePrinciples = `Etico: valor, respeito, transparencia. Evite "segredo", "infalivel", "garantido".`;

            try {
                const lang = document.getElementById('reviewer-lang')?.value || 'Portugues (Brasil)';
                const durationInput = document.getElementById('reviewer-duration')?.value;
                const originalWords = reviewerResults.originalScript.split(/\s+/).filter(Boolean).length;
                
                // Calcular duração: usar a especificada pelo usuário ou manter original (~150 palavras/minuto)
                const originalDuration = Math.max(1, Math.ceil(originalWords / 150));
                let targetDuration = durationInput ? parseInt(durationInput, 10) : null;
                if (!targetDuration || isNaN(targetDuration) || targetDuration <= 0) {
                    // Se não especificado, manter original ou aumentar 1-3%
                    const increasePercent = 1 + Math.random() * 2; // 1-3% aleatório
                    targetDuration = Math.ceil(originalDuration * (1 + increasePercent / 100));
                }
                
                // Calcular palavras alvo: se usuário especificou mais minutos, aumentar proporcionalmente
                let targetWords = originalWords;
                if (durationInput && parseInt(durationInput, 10) > originalDuration) {
                    // Aumentar proporcionalmente à duração especificada
                    const userDuration = parseInt(durationInput, 10);
                    const increasePercent = ((userDuration - originalDuration) / originalDuration) * 100;
                    targetWords = Math.ceil(originalWords * (1 + increasePercent / 100));
                } else {
                    // Manter original ou aumentar 1-3%
                    const increasePercent = 1 + Math.random() * 2;
                    targetWords = Math.ceil(originalWords * (1 + increasePercent / 100));
                }
                
                // Garantir que nunca seja menor que o original
                targetWords = Math.max(targetWords, originalWords);
                
                // Calcular número de partes baseado na duração (similar ao criador: ~2min por parte)
                const partsPerMinute = 0.5; // 1 parte a cada 2 minutos
                const totalParts = Math.max(1, Math.ceil(targetDuration * partsPerMinute));
                const wordsPerPart = Math.ceil(targetWords / totalParts);
                
                // Inicializar estrutura de partes
                reviewerResults.totalParts = totalParts;
                reviewerResults.revisedScriptParts = [];
                reviewerResults.currentPage = 1;
                
                const langContext = lang ? ` Lingua: ${removeAccents(lang)}.` : '';
                const durationContext = durationInput ? ` Duracao desejada: ~${targetDuration}min (usuario especificou ${durationInput}min).` : ` Duracao original: ~${originalDuration}min (manter ou aumentar 1-3%).`;
                const suggestionsText = reviewerResults.suggestions.map(s => `- ${s.title}: ${s.suggestion}`).join('\n');
                
                // Prompt para gerar roteiro por partes com manutenção/aumento de duração
                const prompt = `Reescreva roteiro aplicando sugestoes. ${corePrinciples}${langContext}${durationContext} Mantenha tom/estrutura. 
REGRA CRITICA E OBRIGATORIA: 
- O roteiro deve ter entre ${targetWords - 50} e ${targetWords + 100} palavras (objetivo: ${targetWords} palavras)
- NUNCA diminua abaixo de ${originalWords} palavras (original tem ${originalWords} palavras)
- NUNCA corte ou remova conteudo importante do roteiro original
- Apenas melhore/refine/expanda o conteudo existente
- Mantenha TODAS as ideias e informacoes do roteiro original
- Divida o roteiro em ${totalParts} partes de aproximadamente ${wordsPerPart} palavras cada (320 palavras por parte)
- Cada parte deve ter aproximadamente 320 palavras divididas em 5 paragrafos
- IMPORTANTE: Apenas narracao pura, SEM tags, marcadores, ou instrucoes de backend
- Use "[--PART N: TITULO--]" no inicio de cada parte e "[--ENDPART--]" no final
- Ultima parte deve terminar com "[--ENDPART--]"
- NUNCA termine uma parte no meio de uma frase ou ideia

SUGESTOES:
${removeAccents(suggestionsText)}

ROTEIRO ORIGINAL (${originalWords} palavras, ~${originalDuration}min):
"""${removeAccents(reviewerResults.originalScript)}"""`;
                
                // Calcular maxOutputTokens dinamicamente
                const estimatedInputTokens = Math.ceil((prompt.length / 4) * 1.2);
                const estimatedOutputTokens = Math.ceil((targetWords / 0.75) * 1.2);
                const maxOutputTokens = Math.min(Math.max(8192, estimatedOutputTokens), 32000);
                
                console.log(`📊 Revisor - Duração original: ${originalDuration}min, Duração alvo: ${targetDuration}min, Palavras alvo: ${targetWords}, Partes: ${totalParts}, Palavras/parte: ${wordsPerPart}`);
                
                // Usar streaming para processar por partes (similar ao criador)
                let fullText = '';
                let textBuffer = '';
                let partsGenerated = 0;
                
                const onChunk = (data) => {
                    let textChunk = '';
                    if (data.type === 'content_block_delta') {
                        textChunk = data.delta?.text || '';
                    } else if (data.choices && data.choices[0].delta) {
                        textChunk = data.choices[0].delta.content || '';
                    } else if (data.candidates) {
                        textChunk = data.candidates[0]?.content?.parts[0]?.text || '';
                    }
                    textBuffer += textChunk;
                    
                    // Processar partes quando encontrar delimitador
                    const delimiter = "[--ENDPART--]";
                    while(textBuffer.includes(delimiter)) {
                        const partEndIndex = textBuffer.indexOf(delimiter);
                        const partText = textBuffer.substring(0, partEndIndex);
                        textBuffer = textBuffer.substring(partEndIndex + delimiter.length);
                        
                        if (partText.trim()) {
                            // Limpar artefatos
                            let cleanedPart = partText.replace(/\[--PART \d+: (.*?)--\]/s, (match, title) => {
                                return ''; // Remove tag mas mantém conteúdo
                            }).trim();
                            cleanedPart = cleanedPart.replace(/\(PAUSA VISUAL:[^)]+\)/gi, '');
                            cleanedPart = cleanedPart.replace(/\(PAUSA:[^)]+\)/gi, '');
                            cleanedPart = cleanedPart.replace(/\[PAUSA VISUAL:[^\]]+\]/gi, '');
                            cleanedPart = cleanedPart.replace(/\[PAUSA:[^\]]+\]/gi, '');
                            cleanedPart = cleanedPart.replace(/\([^)]*VISUAL[^)]*\)/gi, '');
                            cleanedPart = cleanedPart.replace(/\[[^\]]*VISUAL[^\]]*\]/gi, '');
                            cleanedPart = cleanedPart.trim();
                            
                            // Extrair título se existir
                            const titleMatch = partText.match(/\[--PART \d+: (.*?)--\]/s);
                            const partNumber = reviewerResults.revisedScriptParts.length + 1;
                            const partTitle = titleMatch ? titleMatch[1].trim() : `Parte ${partNumber}`;
                            
                            if (cleanedPart) {
                                reviewerResults.revisedScriptParts.push({
                                    part_title: partTitle,
                                    part_content: cleanedPart
                                });
                                partsGenerated++;
                                renderReviewerScriptPage();
                                hideProgressModal();
                                showProgressModal("Aplicando melhorias...", `Gerando parte ${partsGenerated} de ${totalParts}...`);
                            }
                        }
                    }
                };
                
                const onDone = () => {
                    console.log(`✅ Stream finalizado. Buffer restante: ${textBuffer.length} caracteres`);
                    console.log(`✅ Partes geradas até agora: ${reviewerResults.revisedScriptParts.length}/${totalParts}`);
                    
                    // Processar texto restante no buffer
                    if (textBuffer.trim()) {
                        let cleanedPart = textBuffer.replace(/\[--PART \d+: (.*?)--\]/s, '').replace(/\[--ENDPART--\]/g, '').trim();
                        cleanedPart = cleanedPart.replace(/\(PAUSA VISUAL:[^)]+\)/gi, '');
                        cleanedPart = cleanedPart.replace(/\(PAUSA:[^)]+\)/gi, '');
                        cleanedPart = cleanedPart.replace(/\[PAUSA VISUAL:[^\]]+\]/gi, '');
                        cleanedPart = cleanedPart.replace(/\[PAUSA:[^\]]+\]/gi, '');
                        cleanedPart = cleanedPart.replace(/\([^)]*VISUAL[^)]*\)/gi, '');
                        cleanedPart = cleanedPart.replace(/\[[^\]]*VISUAL[^\]]*\]/gi, '');
                        cleanedPart = cleanedPart.trim();
                        
                        if (cleanedPart) {
                            const titleMatch = textBuffer.match(/\[--PART \d+: (.*?)--\]/s);
                            const partNumber = reviewerResults.revisedScriptParts.length + 1;
                            const partTitle = titleMatch ? titleMatch[1].trim() : `Parte ${partNumber}`;
                            
                            reviewerResults.revisedScriptParts.push({
                                part_title: partTitle,
                                part_content: cleanedPart
                            });
                            partsGenerated++;
                            console.log(`✅ Parte final adicionada do buffer. Total de partes: ${reviewerResults.revisedScriptParts.length}`);
                        }
                    }
                    
                    // Se não gerou partes suficientes, dividir o texto completo
                    if (reviewerResults.revisedScriptParts.length === 0) {
                        console.warn(`⚠️ Nenhuma parte gerada com delimitadores. Fazendo fallback para divisão manual.`);
                        // Fallback: dividir texto completo manualmente
                        const fullTextToSplit = textBuffer.replace(/\[--PART \d+: .*?--\]/g, '').replace(/\[--ENDPART--\]/g, '').trim();
                        if (fullTextToSplit) {
                            const words = fullTextToSplit.split(/\s+/);
                            const wordsPerPartCalc = Math.ceil(words.length / totalParts);
                            
                            console.log(`📊 Dividindo ${words.length} palavras em ${totalParts} partes de ~${wordsPerPartCalc} palavras`);
                            
                            for (let i = 0; i < totalParts && words.length > 0; i++) {
                                const start = i * wordsPerPartCalc;
                                const end = Math.min(start + wordsPerPartCalc, words.length);
                                const partWords = words.slice(start, end);
                                const partContent = partWords.join(' ');
                                
                                if (partContent.trim()) {
                                    reviewerResults.revisedScriptParts.push({
                                        part_title: `Parte ${i + 1}`,
                                        part_content: partContent.trim()
                                    });
                                }
                            }
                            console.log(`✅ Divisão manual concluída: ${reviewerResults.revisedScriptParts.length} partes`);
                        }
                    } else if (reviewerResults.revisedScriptParts.length < totalParts) {
                        console.warn(`⚠️ Apenas ${reviewerResults.revisedScriptParts.length}/${totalParts} partes geradas. Isso é normal se o roteiro for curto.`);
                    }
                    
                    // Renderizar imediatamente após processar o buffer
                    renderReviewerScriptPage();
                    
                    fullText = reviewerResults.revisedScriptParts.map(p => p.part_content).join('\n\n');
                    console.log(`✅ Texto completo montado: ${fullText.split(/\s+/).filter(Boolean).length} palavras em ${reviewerResults.revisedScriptParts.length} partes`);
                };
                
                const onError = (error) => {
                    throw error;
                };
                
                // Chamar API com streaming
                await streamApiRequest('/api/generate', { 
                    prompt, 
                    model,
                    maxOutputTokens,
                    temperature: 0.7,
                    stream: true
                }, onChunk, onDone, onError);
                
                // Validar tamanho total após processamento
                const fullRevisedText = reviewerResults.revisedScriptParts.map(p => p.part_content).join('\n\n');
                const revisedWords = fullRevisedText.split(/\s+/).filter(Boolean).length;
                
                console.log(`📊 Validação final: ${revisedWords} palavras geradas (original: ${originalWords}, alvo: ${targetWords})`);
                
                // Validar: nunca menos que o original
                if (revisedWords < originalWords) {
                    addToLog(`⚠️ ATENÇÃO: Roteiro revisado tem ${revisedWords} palavras, menor que o original (${originalWords}). Expandindo partes sequencialmente...`, true);
                    
                    // Expansão SEQUENCIAL: adicionar conteúdo adicional nas partes existentes, uma por vez
                    const wordsNeeded = Math.ceil((originalWords - revisedWords) * 1.15); // 15% de margem
                    const wordsPerPartToAdd = Math.max(80, Math.ceil(wordsNeeded / reviewerResults.revisedScriptParts.length));
                    
                    console.log(`📈 Expandindo ${reviewerResults.revisedScriptParts.length} partes. Adicionar ~${wordsPerPartToAdd} palavras por parte.`);
                    
                    for (let i = 0; i < reviewerResults.revisedScriptParts.length; i++) {
                        showProgressModal("Expandindo roteiro...", `Expandindo parte ${i + 1} de ${reviewerResults.revisedScriptParts.length}...`);
                        
                        const part = reviewerResults.revisedScriptParts[i];
                        const currentWords = part.part_content.split(/\s+/).filter(Boolean).length;
                        const targetWordsForPart = currentWords + wordsPerPartToAdd;
                        
                        const expansionPrompt = `Expanda o texto abaixo adicionando mais detalhes, exemplos, explicações e contexto RELEVANTES ao tema. 
                        
INSTRUÇÕES CRÍTICAS:
- Mantenha TODAS as informações originais (não remova nada)
- Apenas ADICIONE conteúdo novo e relevante
- O texto expandido deve ter aproximadamente ${targetWordsForPart} palavras (atualmente: ${currentWords} palavras)
- Mantenha o mesmo tom, estilo e linguagem
- NÃO adicione títulos, marcadores ou tags
- Apenas narração pura para voice-over
- Certifique-se de que o texto expandido seja COMPLETO (sem cortes)

TEXTO ATUAL (${currentWords} palavras):
"""${removeAccents(part.part_content)}"""

Texto expandido (alvo: ${targetWordsForPart} palavras):`;
                        
                        try {
                            const expansionResult = await apiRequestWithFallback('/api/generate', 'POST', {
                                prompt: expansionPrompt,
                                model,
                                maxOutputTokens: Math.ceil(targetWordsForPart / 0.75 * 1.3),
                                temperature: 0.7
                            });
                            
                            if (expansionResult && expansionResult.data) {
                                let expandedText = expansionResult.data.text || expansionResult.data || '';
                                if (typeof expandedText === 'object' && expandedText.text) {
                                    expandedText = expandedText.text;
                                }
                                expandedText = expandedText.replace(/^```[\w]*\n?|\n?```$/gm, '').trim();
                                
                                const expandedWords = expandedText.split(/\s+/).filter(Boolean).length;
                                
                                console.log(`✅ Parte ${i + 1}: ${currentWords} → ${expandedWords} palavras`);
                                
                                if (expandedWords > currentWords) {
                                    reviewerResults.revisedScriptParts[i].part_content = expandedText;
                                    renderReviewerScriptPage();
                                } else {
                                    console.warn(`⚠️ Parte ${i + 1}: Expansão não aumentou palavras (${currentWords} → ${expandedWords})`);
                                }
                            }
                        } catch (error) {
                            console.error(`❌ Erro ao expandir parte ${i + 1}:`, error);
                            addToLog(`Erro ao expandir parte ${i + 1}: ${error.message}`, true);
                        }
                    }
                    
                    // Recalcular palavras após expansão
                    const newFullText = reviewerResults.revisedScriptParts.map(p => p.part_content).join('\n\n');
                    const newRevisedWords = newFullText.split(/\s+/).filter(Boolean).length;
                    if (newRevisedWords >= originalWords) {
                        const increasePercent = ((newRevisedWords - originalWords) / originalWords * 100).toFixed(1);
                        addToLog(`✅ Roteiro expandido com sucesso: ${newRevisedWords} palavras (original: ${originalWords}, aumento: +${increasePercent}%)`, false);
                        console.log(`✅ Expansão bem-sucedida: ${originalWords} → ${newRevisedWords} palavras (+${increasePercent}%)`);
                    } else {
                        addToLog(`⚠️ Roteiro ainda é menor que o original: ${newRevisedWords} palavras (original: ${originalWords}, faltam: ${originalWords - newRevisedWords} palavras). Considere revisar manualmente ou aplicar melhorias novamente.`, true);
                        console.warn(`⚠️ Expansão incompleta: ${newRevisedWords}/${originalWords} palavras`);
                    }
                } else {
                    const increase = ((revisedWords - originalWords) / originalWords * 100).toFixed(1);
                    addToLog(`✅ Roteiro revisado com sucesso: ${revisedWords} palavras (original: ${originalWords}, ${increase > 0 ? '+' : ''}${increase}%)`, false);
                    console.log(`✅ Roteiro completo: ${originalWords} → ${revisedWords} palavras (${increase > 0 ? '+' : ''}${increase}%)`);
                }
                
                // Salvar texto completo
                reviewerResults.revisedScript = reviewerResults.revisedScriptParts.map(p => p.part_content).join('\n\n');
                
                // Renderizar página de roteiro revisado por partes
                renderReviewerScriptPage();
                
                showSuccessToast("Roteiro revisado com sucesso!");
                
                // Reavaliar pontuação do roteiro revisado
                await reevaluateScript(reviewerResults.revisedScript);
            } catch (error) {
                console.error('Erro detalhado ao aplicar sugestões:', error);
                addToLog(`Erro ao aplicar sugestoes: ${error.message}`, true);
                showSuccessToast(`Erro ao aplicar sugestoes: ${error.message}`, true);
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
            
            const corePrinciples = `Etico: valor, respeito, transparencia. Evite "segredo", "infalivel", "garantido".`;

            try {
                const lang = document.getElementById('reviewer-lang')?.value || 'Portugues (Brasil)';
                const duration = document.getElementById('reviewer-duration')?.value;
                const originalWords = scriptToRevise.split(/\s+/).filter(Boolean).length;
                
                const langContext = lang ? ` Lingua: ${removeAccents(lang)}.` : '';
                const durationContext = duration ? ` Duracao: ~${duration}min.` : '';
                
                const maxWords = Math.ceil(originalWords * 1.03); // Máximo 3% de aumento
                const prompt = `Reescreva roteiro aplicando mudanca. ${corePrinciples}${langContext}${durationContext} Mantenha tom/estrutura. REGRA CRITICA: O roteiro deve ter entre ${originalWords} e ${maxWords} palavras (mantenha tamanho original ou aumente maximo 3%). NUNCA diminua abaixo de ${originalWords} palavras. IMPORTANTE: Apenas narracao pura, SEM tags, marcadores, ou instrucoes de backend como "(PAUSA VISUAL: ...)".

MUDANCA:
${removeAccents(manualInstruction)}

ROTEIRO (${originalWords} palavras):
"""${removeAccents(scriptToRevise)}"""`;
                
                const result = await apiRequestWithFallback('/api/generate', 'POST', { 
                    prompt, 
                    model,
                    maxOutputTokens: 8192
                });

                console.log('Resultado da API (correção manual):', result);

                // Tratar diferentes formatos de resposta - quando não há schema, vem como { text: "..." }
                let revisedText = null;
                if (result && result.data) {
                    if (typeof result.data === 'string') {
                        revisedText = result.data.trim();
                    } else if (result.data.text && typeof result.data.text === 'string') {
                        revisedText = result.data.text.trim();
                    } else if (typeof result.data === 'object') {
                        // Tentar extrair texto de diferentes campos possíveis
                        revisedText = result.data.content || result.data.script || result.data.result || result.data.output || null;
                        if (revisedText && typeof revisedText === 'string') {
                            revisedText = revisedText.trim();
                        } else {
                            // Se ainda não encontrou, verificar se há algum campo string longo
                            for (const key in result.data) {
                                if (typeof result.data[key] === 'string' && result.data[key].length > 100) {
                                    revisedText = result.data[key].trim();
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Limpar possíveis artefatos de formatação e marcações de backend
                if (revisedText) {
                    // Remover code blocks markdown
                    revisedText = revisedText.replace(/^```[\w]*\n?|\n?```$/gm, '');
                    // Remover prefixos comuns
                    revisedText = revisedText.replace(/^(Roteiro|Texto|Script|Conteudo):\s*/i, '');
                    // Remover JSON wrapper se presente
                    revisedText = revisedText.replace(/^\{[\s\S]*?"text"\s*:\s*"([^"]+)"/, '$1');
                    revisedText = revisedText.replace(/\\n/g, '\n');
                    // Remover marcações de backend como "(PAUSA VISUAL: ...)"
                    revisedText = revisedText.replace(/\(PAUSA VISUAL:[^)]+\)/gi, '');
                    revisedText = revisedText.replace(/\(PAUSA:[^)]+\)/gi, '');
                    revisedText = revisedText.replace(/\[PAUSA VISUAL:[^\]]+\]/gi, '');
                    revisedText = revisedText.replace(/\[PAUSA:[^\]]+\]/gi, '');
                    // Remover outras marcações comuns de backend
                    revisedText = revisedText.replace(/\([^)]*VISUAL[^)]*\)/gi, '');
                    revisedText = revisedText.replace(/\[[^\]]*VISUAL[^\]]*\]/gi, '');
                    revisedText = revisedText.trim();
                }

                if (revisedText) {
                    let finalRevisedText = revisedText;
                    const revisedWords = finalRevisedText.split(/\s+/).filter(Boolean).length;
                    const maxWords = Math.ceil(originalWords * 1.03);
                    const minWords = originalWords;
                    
                    // Validar tamanho: deve estar entre original e +3%
                    if (revisedWords < minWords) {
                        addToLog(`ATENCAO: O roteiro revisado tem ${revisedWords} palavras, menor que o original (${originalWords}). Tentando corrigir...`, true);
                        
                        const retryPrompt = `Roteiro tem ${revisedWords} palavras, precisa de ${minWords}-${maxWords} palavras. Expanda mantendo melhorias. Nao remova, apenas adicione. Apenas narracao, sem tags/marcadores/instrucoes backend.

ROTEIRO:
"""${removeAccents(finalRevisedText)}"""`;
                        
                        const retryResult = await apiRequestWithFallback('/api/generate', 'POST', { 
                            prompt: retryPrompt, 
                            model,
                            maxOutputTokens: 8192
                        });
                        
                        if (retryResult && retryResult.data) {
                            let retryText = null;
                            if (typeof retryResult.data === 'string') {
                                retryText = retryResult.data.trim();
                            } else if (retryResult.data.text) {
                                retryText = retryResult.data.text.trim();
                            } else if (retryResult.data.content) {
                                retryText = retryResult.data.content.trim();
                            }
                            
                            if (retryText) {
                                retryText = retryText.replace(/^```[\w]*\n?|\n?```$/gm, '');
                                retryText = retryText.replace(/\(PAUSA VISUAL:[^)]+\)/gi, '');
                                retryText = retryText.replace(/\(PAUSA:[^)]+\)/gi, '');
                                retryText = retryText.replace(/\[PAUSA VISUAL:[^\]]+\]/gi, '');
                                retryText = retryText.replace(/\[PAUSA:[^\]]+\]/gi, '');
                                retryText = retryText.replace(/\([^)]*VISUAL[^)]*\)/gi, '');
                                retryText = retryText.replace(/\[[^\]]*VISUAL[^\]]*\]/gi, '');
                                retryText = retryText.trim();
                                finalRevisedText = retryText;
                                const retryWords = finalRevisedText.split(/\s+/).filter(Boolean).length;
                                if (retryWords >= minWords && retryWords <= maxWords) {
                                    addToLog(`Roteiro corrigido: ${retryWords} palavras (objetivo: ${minWords}-${maxWords})`, false);
                                } else if (retryWords > maxWords) {
                                    addToLog(`AVISO: Roteiro tem ${retryWords} palavras (max: ${maxWords}). Reduzindo para limite...`, true);
                                    const words = finalRevisedText.split(/\s+/);
                                    if (words.length > maxWords) {
                                        finalRevisedText = words.slice(0, maxWords).join(' ');
                                        addToLog(`Roteiro truncado para ${maxWords} palavras.`, false);
                                    }
                                } else {
                                    addToLog(`AVISO: Apos correcao, roteiro ainda tem ${retryWords} palavras. Considere revisar manualmente.`, true);
                                }
                            }
                        }
                    } else if (revisedWords > maxWords) {
                        addToLog(`AVISO: Roteiro tem ${revisedWords} palavras (max permitido: ${maxWords}, +3%). Reduzindo para limite...`, true);
                        const words = finalRevisedText.split(/\s+/);
                        if (words.length > maxWords) {
                            finalRevisedText = words.slice(0, maxWords).join(' ');
                            addToLog(`Roteiro truncado para ${maxWords} palavras (limite de +3%).`, false);
                        }
                    } else {
                        const increase = ((revisedWords - originalWords) / originalWords * 100).toFixed(1);
                        addToLog(`Roteiro revisado: ${revisedWords} palavras (original: ${originalWords}, aumento: ${increase}%)`, false);
                    }
                    
                    reviewerResults.revisedScript = finalRevisedText;
                    
                    // Garantir que temos o container de output
                    const tabContent = document.getElementById('tab-content');
                    let outputContainer = tabContent ? tabContent.querySelector('#reviewer-output') : document.getElementById('reviewer-output');
                    
                    if (outputContainer) {
                        // Criar ou atualizar o container de roteiro revisado
                        let revisedScriptOutput = outputContainer.querySelector('#reviewer-revised-script-output');
                        if (!revisedScriptOutput) {
                            revisedScriptOutput = document.createElement('div');
                            revisedScriptOutput.id = 'reviewer-revised-script-output';
                            revisedScriptOutput.className = 'mt-6';
                            revisedScriptOutput.innerHTML = `
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Roteiro Revisado</h3>
                                    <div class="flex gap-2">
                                        <button id="copy-revised-script-btn" class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 font-semibold dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40">Copiar Roteiro</button>
                                        <button id="download-revised-script-btn" class="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-md hover:bg-green-200 font-semibold dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40">Transferir .txt</button>
                                    </div>
                                </div>
                                <textarea id="reviewer-revised-script-textarea" class="mt-1 w-full h-64 px-4 py-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" readonly></textarea>
                            `;
                            outputContainer.appendChild(revisedScriptOutput);
                        }
                        
                        const revisedScriptTextarea = revisedScriptOutput.querySelector('#reviewer-revised-script-textarea');
                        if (revisedScriptTextarea) {
                            revisedScriptTextarea.value = reviewerResults.revisedScript;
                        revisedScriptOutput.style.display = 'block';
                    }
                    }
                    
                    showSuccessToast("Correcao manual aplicada!");
                    await reevaluateScript(reviewerResults.revisedScript);
                } else {
                    console.error('Resposta da API não contém texto válido:', result);
                    throw new Error("A IA nao retornou um roteiro revisado valido. Resposta recebida: " + JSON.stringify(result).substring(0, 200));
                }
            } catch (error) {
                console.error('Erro detalhado ao aplicar correção manual:', error);
                addToLog(`Erro ao aplicar correcao manual: ${error.message}`, true);
                showSuccessToast(`Erro ao aplicar correcao: ${error.message}`);
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
                const result = await apiRequestWithFallback('/api/generate', 'POST', { prompt, model, schema });
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
            
            // Criar estado para traducao em background
            appState.translationStatus = {
                active: true,
                total: selectedLanguages.length,
                completed: 0,
                errors: 0,
                languages: selectedLanguages
            };
            
            // Renderizar UI inicial
            renderTranslationProgress();
            addToLog(`Iniciando traducao para ${selectedLanguages.length} idioma(s)...`);
            
            // Processar traducoes em background (paralelo)
            const translationPromises = selectedLanguages.map(async (lang) => {
                const prompt = `Traduza o seguinte roteiro para ${removeAccents(lang)}. Responda APENAS com o texto traduzido, sem nenhuma formatacao, explicacao ou texto adicional.\n\nROTEIRO:\n"""${removeAccents(text)}"""`;
                
                const containerId = `translation-container-${lang}`;
                const outputId = `translation-output-${lang}`;
                const actionsId = `actions-${lang}`;
                const statusId = `status-${lang}`;

                const containerHtml = `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4" id="${containerId}">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-bold text-gray-900 dark:text-gray-100">${lang}</h4>
                            <div class="flex gap-2 items-center">
                                <span id="${statusId}" class="text-xs text-gray-500 dark:text-gray-400">Processando...</span>
                            <div class="flex gap-2" id="${actionsId}" style="display:none;">
                                <button class="copy-btn text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Copiar</button>
                                <button class="download-translation-btn text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700" data-lang="${lang}">Transferir .txt</button>
                            </div>
                        </div>
                        </div>
                        <div id="${outputId}" class="prose prose-sm max-w-none text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                            <div class="flex items-center gap-2">
                                <div class="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                <span>Traduzindo...</span>
                            </div>
                        </div>
                    </div>
                `;
                if (outputEl) outputEl.insertAdjacentHTML('beforeend', containerHtml);

                try {
                const outputDiv = document.getElementById(outputId);
                    const statusSpan = document.getElementById(statusId);
                let fullTranslation = '';
                
                    // Tentar traducao via streaming
                await streamApiRequest('/api/generate', { prompt, model, stream: true },
                    (data) => {
                        let textChunk = '';
                        if (data.type === 'content_block_delta') { // Claude
                            textChunk = data.delta?.text || '';
                        } else if (data.choices && data.choices[0].delta) { // GPT
                            textChunk = data.choices[0].delta.content || '';
                        } else if (data.candidates) { // Gemini
                            textChunk = data.candidates[0]?.content?.parts[0]?.text || '';
                        }
                        fullTranslation += textChunk;
                        if (outputDiv) outputDiv.textContent = fullTranslation;
                    },
                    () => {
                            // Sucesso
                            appState.translationStatus.completed++;
                            renderTranslationProgress();
                            addToLog(`✅ ${lang}: concluida`);
                            
                            if (statusSpan) statusSpan.textContent = '✓ Concluída';
                            if (statusSpan) statusSpan.classList.add('text-green-600', 'dark:text-green-400');
                        
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
                    },
                    (error) => {
                            // Erro
                            appState.translationStatus.completed++;
                            appState.translationStatus.errors++;
                            renderTranslationProgress();
                            addToLog(`❌ ${lang}: falhou - ${error.message}`, true);
                            
                            if (statusSpan) statusSpan.textContent = '✗ Erro';
                            if (statusSpan) statusSpan.classList.add('text-red-600', 'dark:text-red-400');
                            
                        if (outputDiv) {
                                outputDiv.textContent = `Falha ao traduzir: ${error.message}`;
                            outputDiv.classList.add('text-red-600');
                        }
                    }
                );
                } catch (error) {
                    appState.translationStatus.completed++;
                    appState.translationStatus.errors++;
                    renderTranslationProgress();
                    addToLog(`❌ ${lang}: erro fatal - ${error.message}`, true);
                }
            });
            
            // Aguardar todas as traducoes (em paralelo)
            await Promise.allSettled(translationPromises);
            
            // Finalizar
            appState.translationStatus.active = false;
            renderTranslationProgress();
            
            const totalSuccess = appState.translationStatus.completed - appState.translationStatus.errors;
            if (appState.translationStatus.errors > 0) {
                showSuccessToast(`Traducao concluida: ${totalSuccess} sucesso, ${appState.translationStatus.errors} falhas`);
            } else {
                showSuccessToast(`Todas as ${totalSuccess} traducoes concluidas com sucesso!`);
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
            
            // Log para debug: verificar qual modelo foi selecionado
            console.log(`🎬 Gerando prompts de cena com modelo: "${model}"`);
            
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

            const totalEstimate = mode === 'manual' ? Math.max(chunks.length, 1) : Math.max(estimatedScenes, 1);
            const initialMessage = mode === 'manual'
                ? `Gerando ${chunks.length} prompt(s) com blocos de ${wordCount} palavra(s)...`
                : `A IA está analisando ${totalWords} palavras para sugerir cerca de ${estimatedScenes} cenas (entre ${minScenes} e ${maxScenes}, se necessário).`;

            appState.sceneGenStatus = { 
                active: true, 
                current: 0, 
                total: totalEstimate, 
                message: initialMessage, 
                subMessage: '',
                chunkTotal: 0,
                chunkCurrent: 0,
                error: false 
            };
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
                        const prompt = `Analise contexto geral, depois foque no trecho especifico. Gere 1 prompt de imagem em INGLES otimizado para '${imageModel}'.${styleInstruction} ${textInstruction} ${characterInstruction} 

CRITICO - FORMATO JSON OBRIGATORIO:
- Responda APENAS com um JSON objeto valido e completo
- Nao inclua texto antes ou depois do JSON
- Nao use markdown code blocks (sem \`\`\`json)
- Todas as strings devem estar entre aspas duplas
- Nao use virgulas finais
- Formato exato: {"prompt_text": "...", "scene_description": "...", "original_text": "..."}
- O JSON deve ser valido e completo, sem cortes

CONTEXTO:
"""${removeAccents(text)}"""

TRECHO:
"""${removeAccents(chunk)}"""`;
                        
                        appState.sceneGenStatus.subMessage = `Trecho ${index + 1} de ${chunks.length}`;
                        appState.sceneGenStatus.message = `Gerando cena ${index + 1} de ${chunks.length}...`;
                        renderSceneGenerationProgress(appState.sceneGenStatus);

                        let retries = 3;
                        let success = false;
                        while (retries > 0 && !success) {
                            try {
                                console.log(`📤 Enviando requisição para API: modelo="${model}"`);
                                const result = await apiRequestWithFallback('/api/generate', 'POST', { 
                                    prompt, 
                                    model, 
                                    schema,
                                    maxOutputTokens: 4096
                                });
                                console.log(`✅ Resposta recebida da API para modelo "${model}"`);
                                
                                // Tratamento robusto da resposta
                                let sceneData = null;
                                
                                if (result.data) {
                                    if (typeof result.data === 'object' && !Array.isArray(result.data)) {
                                        // Verifica se tem as propriedades esperadas
                                        if (result.data.prompt_text || result.data.prompt) {
                                            sceneData = {
                                                scene_description: result.data.scene_description || result.data.description || `Cena ${index + 1}`,
                                                prompt_text: result.data.prompt_text || result.data.prompt || '',
                                                original_text: result.data.original_text || result.data.original || chunk
                                            };
                                        }
                                    } else if (Array.isArray(result.data) && result.data.length > 0) {
                                        // Se retornou array, pega o primeiro item
                                        const firstItem = result.data[0];
                                        if (firstItem.prompt_text || firstItem.prompt) {
                                            sceneData = {
                                                scene_description: firstItem.scene_description || firstItem.description || `Cena ${index + 1}`,
                                                prompt_text: firstItem.prompt_text || firstItem.prompt || '',
                                                original_text: firstItem.original_text || firstItem.original || chunk
                                            };
                                        }
                                    }
                                }
                                
                                if (sceneData && sceneData.prompt_text) {
                                    scenePromptResults.data.push(sceneData);
                                    appState.sceneGenStatus.current = scenePromptResults.data.length;
                                    appState.sceneGenStatus.message = `Cena ${scenePromptResults.data.length}/${chunks.length} pronta.`;
                                    appState.sceneGenStatus.subMessage = `Trecho ${index + 1} concluído`;
                                    renderSceneGenerationProgress(appState.sceneGenStatus);
                                    success = true;
                                } else {
                                    throw new Error(`Formato de resposta inválido para cena ${index + 1}`);
                                }
                            } catch (error) {
                                retries--;
                                const isJsonError = error.message && (
                                    error.message.includes('JSON') || 
                                    error.message.includes('malformado') ||
                                    error.message.includes('incompleto') ||
                                    error.message.includes('parse') ||
                                    error.message.includes('Unexpected')
                                );
                                
                                if (isJsonError && retries > 0) {
                                    addToLog(`Erro de JSON na cena ${index + 1}. Tentando novamente com instruções mais explícitas... (${retries} tentativas restantes)`, true);
                                    // Adicionar instrução mais explícita no retry
                                    prompt = `${prompt}\n\nLEMBRE-SE: Retorne APENAS o JSON objeto, sem nenhum texto adicional. O JSON deve começar com { e terminar com }. Todas as strings entre aspas duplas.`;
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    continue; // Tenta novamente com o prompt melhorado
                                } else if (retries > 0) {
                                    addToLog(`Erro na cena ${index + 1}. Tentando novamente... (${retries} tentativas restantes)`, true);
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                } else {
                                    addToLog(`Erro ao gerar prompt para a cena ${index + 1}: ${error.message}`, true);
                                    console.error(`Erro detalhado para cena ${index + 1}:`, error);
                                }
                            }
                        }
                        
                        if (!success) {
                            addToLog(`Nao foi possivel gerar prompt para a cena ${index + 1} apos 3 tentativas.`, true);
                        }
                        // Otimização 4: Adicionar delay fixo
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }

                    scenePromptResults.total_prompts = scenePromptResults.data.length;
                    appState.sceneGenStatus.current = scenePromptResults.data.length;
                    appState.sceneGenStatus.total = Math.max(appState.sceneGenStatus.total, scenePromptResults.data.length);
                    appState.sceneGenStatus.message = `Roteiro dividido em ${scenePromptResults.data.length} cena(s) (modo manual).`;
                    appState.sceneGenStatus.subMessage = `Total final: ${scenePromptResults.data.length} cena(s).`;
                    renderSceneGenerationProgress(appState.sceneGenStatus);
                } else { // MODO AUTOMATICO
                    // PRIMEIRO: Analisar todo o roteiro para calcular quantidade EXATA de prompts
                    addToLog(`Analisando roteiro completo (${totalWords} palavras) para calcular quantidade exata de prompts...`, false);
                    appState.sceneGenStatus.message = `Analisando roteiro completo...`;
                    appState.sceneGenStatus.subMessage = `Calculando quantidade exata de prompts necessários`;
                    renderSceneGenerationProgress(appState.sceneGenStatus);
                    
                    // Função auxiliar para estimar tokens (aproximação: ~3.5 caracteres por token)
                    const estimateTokens = (text) => Math.ceil(text.length / 3.5);
                    
                    // Obter limites do modelo selecionado usando a função de matching inteligente
                    const tokenLimits = getTokenLimitsFrontend(model);
                    const maxContextLength = tokenLimits.maxContextLength;
                    const maxOutputTokens = tokenLimits.maxOutputTokens;
                    
                    console.log(`📊 Limites de tokens para modelo "${model}": Contexto=${maxContextLength}, Saída=${maxOutputTokens}`);
                    
                    // Calcular tokens do prompt base
                    const basePromptTemplate = `Diretor de arte: Divida roteiro em cenas visuais logicas. Roteiro: ~${totalWords} palavras. Para cada cena, gere 1 prompt em INGLES otimizado para '${imageModel}'.${styleInstruction} ${textInstruction} ${characterInstruction} JSON array: [{prompt_text, scene_description (PT), original_text}].\n\nROTEIRO:\n"""`;
                    const basePromptTokens = estimateTokens(basePromptTemplate);
                    const scriptTokens = estimateTokens(text);
                    const availableTokensForOutput = maxContextLength - basePromptTokens - scriptTokens - 500; // Margem de segurança
                    
                    // Calcular quantidade exata de prompts baseado nos tokens disponíveis
                    // Cada prompt de cena usa aproximadamente: 150 tokens (prompt_text) + 50 tokens (scene_description) + 100 tokens (original_text) = ~300 tokens por cena
                    const tokensPerScene = 300;
                    const maxScenesByTokens = Math.floor(availableTokensForOutput / tokensPerScene);
                    
                    // Calcular quantidade baseada em palavras (1 cena a cada ~90 palavras)
                    const scenesByWords = Math.max(1, Math.round(totalWords / 90));
                    
                    // Usar o menor valor entre os dois cálculos para garantir que cabe nos tokens
                    const exactSceneCount = Math.min(maxScenesByTokens, scenesByWords, maxScenes);
                    
                    console.log(`📊 Análise do roteiro:`);
                    console.log(`   Palavras: ${totalWords}`);
                    console.log(`   Tokens do script: ~${scriptTokens}`);
                    console.log(`   Tokens disponíveis para saída: ~${availableTokensForOutput}`);
                    console.log(`   Cenas calculadas por palavras: ${scenesByWords}`);
                    console.log(`   Cenas máximas por tokens: ${maxScenesByTokens}`);
                    console.log(`   ✅ Quantidade EXATA de prompts: ${exactSceneCount}`);
                    
                    addToLog(`Quantidade exata calculada: ${exactSceneCount} prompts de cena`, false);
                    
                    // Normalizar nome do modelo para verificações
                    const modelLower = normalizeModelName(model);
                    const isGeminiModel = modelLower.includes('gemini');
                    const isFlashLite = modelLower.includes('flash-lite');
                    const isFlash = modelLower.includes('flash') && !isFlashLite;
                    const isPro = modelLower.includes('pro');
                    
                    // Verificar se precisa de chunking baseado nos limites de tokens
                    const totalPromptTokens = basePromptTokens + scriptTokens;
                    const shouldUseChunkedAuto = totalPromptTokens > (maxContextLength * 0.7); // Usa chunking se usar mais de 70% do contexto
                    
                    // Ajustar limites de chunking baseado no modelo
                    const AUTO_CHUNK_WORD_THRESHOLD = isFlashLite ? 1000 : (isFlash ? 600 : 800);
                    const MAX_WORDS_PER_AUTO_CHUNK = isFlashLite ? 450 : (isFlash ? 250 : (isPro ? 350 : 450));
                    
                    // Usar quantidade EXATA calculada
                    const autoSceneGuidance = `Roteiro: ~${totalWords} palavras. Gere EXATAMENTE ${exactSceneCount} cenas. Cobertura completa, ordem cronologica. IMPORTANTE: Voce DEVE gerar EXATAMENTE ${exactSceneCount} cenas, nem mais nem menos.`;

                    if (shouldUseChunkedAuto) {
                        const chunkSchema = {
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

                        addToLog("Texto extenso detectado. Gemini sera processado em partes para evitar limite de tokens.", false);
                        const chunkedSegments = splitTextIntoWordChunks(text, MAX_WORDS_PER_AUTO_CHUNK);
                        if (!chunkedSegments.length) {
                            throw new Error("Nao foi possivel preparar o roteiro para o modo automatico.");
                        }

                        // Usar quantidade EXATA calculada para o total
                        appState.sceneGenStatus.total = exactSceneCount;
                        appState.sceneGenStatus.chunkTotal = chunkedSegments.length;
                        appState.sceneGenStatus.chunkCurrent = 0;
                        appState.sceneGenStatus.subMessage = `Preparando parte 1/${chunkedSegments.length} (${exactSceneCount} cenas totais)`;
                        renderSceneGenerationProgress(appState.sceneGenStatus);
                        let accumulatedScenes = 0;

                        for (let chunkIndex = 0; chunkIndex < chunkedSegments.length; chunkIndex++) {
                            const currentChunk = chunkedSegments[chunkIndex];
                            const chunkRatio = currentChunk.wordCount / totalWords;
                            // Calcular quantidade de cenas para este chunk baseado na quantidade EXATA total
                            const chunkSceneTarget = Math.max(1, Math.round(chunkRatio * exactSceneCount));
                            // Flash precisa de limite menor de cenas por chunk (2 máximo), Pro e Flash Lite podem ter até 4
                            const maxScenesPerChunk = isFlash ? 2 : (isPro ? 3 : 4);
                            const chunkSceneCap = Math.max(1, Math.min(maxScenesPerChunk, chunkSceneTarget + 1));
                            const chunkMinScenes = Math.max(1, Math.min(chunkSceneCap, chunkSceneTarget));
                            const chunkMaxScenes = chunkSceneCap;
                            const chunkPercent = Math.max(1, Math.round(chunkRatio * 100));
                            // Ajustar maxOutputTokens baseado no modelo (Flash precisa de muito mais tokens, Pro moderado)
                            const baseTokensPerScene = isFlash ? 800 : (isPro ? 600 : (isFlashLite ? 500 : 500));
                            const chunkMaxOutputTokens = Math.min(8192, Math.max(1500, chunkMaxScenes * baseTokensPerScene));

                            appState.sceneGenStatus.chunkCurrent = chunkIndex + 1;
                            appState.sceneGenStatus.message = `Processando parte ${chunkIndex + 1}/${chunkedSegments.length}`;
                            appState.sceneGenStatus.subMessage = `Meta: ${chunkMinScenes}-${chunkMaxScenes} cena(s) (~${chunkPercent}% do roteiro)`;
                            renderSceneGenerationProgress(appState.sceneGenStatus);

                            // Ajustar instruções de concisão baseado no modelo (Flash precisa ser ainda mais conciso)
                            const maxDescWords = isFlash ? '10-15' : '15-25';
                            const maxPromptWords = isFlash ? '40' : '50';
                            const concisenessNote = isFlash ? ' EXTREMAMENTE CONCISO. Evite palavras desnecessárias.' : '';
                            
                            const chunkPrompt = `Diretor de arte: Divida o roteiro em cenas visuais logicas. Este e o trecho ${chunkIndex + 1} de ${chunkedSegments.length} (aprox. ${currentChunk.wordCount} palavras, ${chunkPercent}% do roteiro). Gere EXATAMENTE entre ${chunkMinScenes} e ${chunkMaxScenes} cenas novas e cronologicas EXCLUSIVAMENTE para este trecho. NAO ultrapasse ${chunkMaxScenes} cenas. Continue a numeracao a partir da cena ${accumulatedScenes + 1}, sem repetir eventos ja descritos. IMPORTANTE: Cada scene_description deve ter no maximo 1 frase curta em PT-BR (${maxDescWords} palavras). Cada prompt_text em INGLES deve ter no maximo ${maxPromptWords} palavras.${concisenessNote} Para cada cena, gere 1 prompt em INGLES otimizado para '${imageModel}'.${styleInstruction} ${textInstruction} ${characterInstruction} 

CRITICO - FORMATO JSON OBRIGATORIO:
- Responda APENAS com um JSON array valido e completo
- Nao inclua texto antes ou depois do JSON
- Nao use markdown code blocks (sem \`\`\`json)
- Todas as strings devem estar entre aspas duplas
- Nao use virgulas finais
- Formato exato: [{"prompt_text": "...", "scene_description": "...", "original_text": "..."}]
- O JSON deve ser valido e completo, sem cortes

TRECHO FOCAL:
"""${removeAccents(currentChunk.text)}"""`;

                            let retries = 3;
                            let chunkScenes = null;

                            while (retries > 0) {
                                try {
                                    console.log(`📤 Enviando chunk ${chunkIndex + 1} para API: modelo="${model}"`);
                                    const chunkResult = await apiRequestWithFallback('/api/generate', 'POST', { 
                                        prompt: chunkPrompt, 
                                        model, 
                                        schema: chunkSchema,
                                        maxOutputTokens: chunkMaxOutputTokens
                                    });
                                    console.log(`✅ Chunk ${chunkIndex + 1} recebido da API para modelo "${model}"`);

                                    if (Array.isArray(chunkResult.data)) {
                                        chunkScenes = chunkResult.data;
                                    } else if (chunkResult.data?.scenes && Array.isArray(chunkResult.data.scenes)) {
                                        chunkScenes = chunkResult.data.scenes;
                                    } else if (chunkResult.data?.data && Array.isArray(chunkResult.data.data)) {
                                        chunkScenes = chunkResult.data.data;
                                    } else {
                                        chunkScenes = chunkResult.data;
                                    }

                                    if (!Array.isArray(chunkScenes) || chunkScenes.length === 0) {
                                        throw new Error("A IA nao retornou prompts de cena validos para este trecho.");
                                    }

                                    const validScenes = chunkScenes.filter(scene =>
                                        scene &&
                                        (scene.prompt_text || scene.prompt) &&
                                        typeof (scene.prompt_text || scene.prompt) === 'string'
                                    );

                                    if (!validScenes.length) {
                                        throw new Error("As cenas retornadas nao possuem estrutura valida.");
                                    }

                                    const normalized = validScenes.map((scene, localIndex) => ({
                                        scene_description: scene.scene_description || scene.description || `Cena ${accumulatedScenes + localIndex + 1}`,
                                        prompt_text: scene.prompt_text || scene.prompt || '',
                                        original_text: scene.original_text || scene.original || scene.text || currentChunk.text
                                    }));

                                    scenePromptResults.data.push(...normalized);
                                    accumulatedScenes += normalized.length;
                                    appState.sceneGenStatus.current = Math.min(exactSceneCount, accumulatedScenes);
                                    // Garantir que não ultrapasse a quantidade exata calculada
                                    if (scenePromptResults.data.length > exactSceneCount) {
                                        scenePromptResults.data = scenePromptResults.data.slice(0, exactSceneCount);
                                        accumulatedScenes = exactSceneCount;
                                    }
                                    appState.sceneGenStatus.subMessage = `Parte ${chunkIndex + 1}/${chunkedSegments.length} concluida (${appState.sceneGenStatus.current}/${appState.sceneGenStatus.total} cenas).`;
                                    renderSceneGenerationProgress(appState.sceneGenStatus);
                                    break;
                                } catch (chunkError) {
                                    const isMaxTokensError = chunkError.message && (
                                        chunkError.message.includes('MAX_TOKENS') ||
                                        chunkError.message.includes('maxOutputTokens') ||
                                        chunkError.message.includes('limite de tokens') ||
                                        chunkError.message.includes('vazia ou malformada')
                                    );
                                    
                                    const isJsonError = chunkError.message && (
                                        chunkError.message.includes('JSON') ||
                                        chunkError.message.includes('malformado') ||
                                        chunkError.message.includes('incompleto') ||
                                        chunkError.message.includes('parse') ||
                                        chunkError.message.includes('Unexpected')
                                    );
                                    
                                    if (isMaxTokensError && retries > 0) {
                                        // Se foi MAX_TOKENS, reduzir ainda mais o número de cenas esperadas
                                        const reducedMaxScenes = Math.max(1, chunkMaxScenes - 1);
                                        const reducedMinScenes = Math.max(1, chunkMinScenes - 1);
                                        const reducedPrompt = chunkPrompt.replace(
                                            new RegExp(`Gere EXATAMENTE entre ${chunkMinScenes} e ${chunkMaxScenes} cenas`),
                                            `Gere EXATAMENTE entre ${reducedMinScenes} e ${reducedMaxScenes} cenas`
                                        ).replace(
                                            new RegExp(`NAO ultrapasse ${chunkMaxScenes} cenas`),
                                            `NAO ultrapasse ${reducedMaxScenes} cenas`
                                        );
                                        
                                        addToLog(`Parte ${chunkIndex + 1}: limite de tokens atingido. Reduzindo para ${reducedMinScenes}-${reducedMaxScenes} cenas...`, true);
                                        
                                        try {
                                            const reducedBaseTokensPerScene = isFlash ? 800 : (isPro ? 600 : (isFlashLite ? 500 : 500));
                                            const reducedResult = await apiRequestWithFallback('/api/generate', 'POST', { 
                                                prompt: reducedPrompt, 
                                                model, 
                                                schema: chunkSchema,
                                                maxOutputTokens: Math.min(8192, Math.max(1500, reducedMaxScenes * reducedBaseTokensPerScene))
                                            });
                                            
                                            if (Array.isArray(reducedResult.data)) {
                                                chunkScenes = reducedResult.data;
                                            } else if (reducedResult.data?.scenes && Array.isArray(reducedResult.data.scenes)) {
                                                chunkScenes = reducedResult.data.scenes;
                                            } else if (reducedResult.data?.data && Array.isArray(reducedResult.data.data)) {
                                                chunkScenes = reducedResult.data.data;
                                            } else {
                                                chunkScenes = reducedResult.data;
                                            }
                                            
                                            if (Array.isArray(chunkScenes) && chunkScenes.length > 0) {
                                                const validScenes = chunkScenes.filter(scene =>
                                                    scene &&
                                                    (scene.prompt_text || scene.prompt) &&
                                                    typeof (scene.prompt_text || scene.prompt) === 'string'
                                                );
                                                
                                                if (validScenes.length > 0) {
                                                    const normalized = validScenes.map((scene, localIndex) => ({
                                                        scene_description: scene.scene_description || scene.description || `Cena ${accumulatedScenes + localIndex + 1}`,
                                                        prompt_text: scene.prompt_text || scene.prompt || '',
                                                        original_text: scene.original_text || scene.original || scene.text || currentChunk.text
                                                    }));
                                                    
                                                    scenePromptResults.data.push(...normalized);
                                                    accumulatedScenes += normalized.length;
                                                    appState.sceneGenStatus.current = Math.min(exactSceneCount, accumulatedScenes);
                                                    // Garantir que não ultrapasse a quantidade exata calculada
                                                    if (scenePromptResults.data.length > exactSceneCount) {
                                                        scenePromptResults.data = scenePromptResults.data.slice(0, exactSceneCount);
                                                        accumulatedScenes = exactSceneCount;
                                                    }
                                                    appState.sceneGenStatus.subMessage = `Parte ${chunkIndex + 1}/${chunkedSegments.length} concluida (${appState.sceneGenStatus.current}/${appState.sceneGenStatus.total} cenas).`;
                                                    renderSceneGenerationProgress(appState.sceneGenStatus);
                                                    break;
                                                }
                                            }
                                        } catch (reducedError) {
                                            retries--;
                                            if (retries === 0) {
                                                throw new Error(`Falha ao gerar cenas para a parte ${chunkIndex + 1} mesmo com redução: ${reducedError.message}`);
                                            }
                                            addToLog(`Parte ${chunkIndex + 1}: erro persistente. Tentando novamente... (${retries} restante)`, true);
                                            await new Promise(resolve => setTimeout(resolve, 2000));
                                        }
                                    } else if (isJsonError && retries > 0) {
                                        // Erro de JSON - tentar novamente com prompt mais explícito
                                        addToLog(`Parte ${chunkIndex + 1}: erro de JSON detectado. Tentando novamente com instruções mais explícitas... (${retries} restante)`, true);
                                        
                                        // Adicionar instrução ainda mais explícita no retry
                                        chunkPrompt = `${chunkPrompt}\n\nLEMBRE-SE: Retorne APENAS o JSON array, sem nenhum texto adicional. O JSON deve começar com [ e terminar com ]. Todas as strings entre aspas duplas.`;
                                        
                                        retries--;
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                        continue; // Tenta novamente com o prompt melhorado
                                    } else {
                                        retries--;
                                        if (retries === 0) {
                                            throw new Error(`Falha ao gerar cenas para a parte ${chunkIndex + 1}: ${chunkError.message}`);
                                        }
                                        addToLog(`Parte ${chunkIndex + 1}: erro (${chunkError.message}). Tentando novamente... (${retries} restante)`, true);
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                    }
                                }
                            }

                            appState.sceneGenStatus.message = `Parte ${chunkIndex + 1}/${chunkedSegments.length} concluida.`;
                            renderSceneGenerationProgress(appState.sceneGenStatus);
                        }

                        // Garantir que temos exatamente a quantidade calculada
                        if (scenePromptResults.data.length > exactSceneCount) {
                            scenePromptResults.data = scenePromptResults.data.slice(0, exactSceneCount);
                        } else if (scenePromptResults.data.length < exactSceneCount) {
                            addToLog(`⚠️ Aviso: Foram geradas ${scenePromptResults.data.length} cenas, mas ${exactSceneCount} foram calculadas.`, true);
                        }
                        
                        scenePromptResults.total_prompts = scenePromptResults.data.length;
                        appState.sceneGenStatus.current = scenePromptResults.data.length;
                        appState.sceneGenStatus.total = exactSceneCount;
                        appState.sceneGenStatus.chunkCurrent = chunkedSegments.length;
                        appState.sceneGenStatus.subMessage = `Todas as partes finalizadas (${scenePromptResults.data.length}/${exactSceneCount} cenas).`;
                        appState.sceneGenStatus.message = `Roteiro dividido em ${scenePromptResults.data.length} cena(s) (calculado: ${exactSceneCount}).`;
                        renderSceneGenerationProgress(appState.sceneGenStatus);
                    } else {
                    let schema;
                    let prompt;
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
                            prompt = `Diretor de arte: Divida roteiro em cenas visuais logicas. ${autoSceneGuidance} Para cada cena, gere 1 prompt em INGLES otimizado para '${imageModel}'.${styleInstruction} ${textInstruction} ${characterInstruction} 

CRITICO - FORMATO JSON OBRIGATORIO:
- Responda APENAS com um JSON objeto valido e completo
- Nao inclua texto antes ou depois do JSON
- Nao use markdown code blocks (sem \`\`\`json)
- Todas as strings devem estar entre aspas duplas
- Nao use virgulas finais
- Formato exato: {"scenes": [{"prompt_text": "...", "scene_description": "...", "original_text": "..."}]}
- O JSON deve ser valido e completo, sem cortes

ROTEIRO:
"""${removeAccents(text)}"""`;
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
                            prompt = `Diretor de arte: Divida roteiro em cenas visuais logicas. ${autoSceneGuidance} Para cada cena, gere 1 prompt em INGLES otimizado para '${imageModel}'.${styleInstruction} ${textInstruction} ${characterInstruction} 

CRITICO - FORMATO JSON OBRIGATORIO:
- Responda APENAS com um JSON array valido e completo
- Nao inclua texto antes ou depois do JSON
- Nao use markdown code blocks (sem \`\`\`json)
- Todas as strings devem estar entre aspas duplas
- Nao use virgulas finais
- Formato exato: [{"prompt_text": "...", "scene_description": "...", "original_text": "..."}]
- O JSON deve ser valido e completo, sem cortes

ROTEIRO:
"""${removeAccents(text)}"""`;
                        }

                        let result;
                        let scenesData;
                        let retries = 3;

                        // Calcular maxOutputTokens baseado na quantidade exata de cenas
                        // Cada cena usa ~300 tokens, então precisamos de tokens suficientes para todas as cenas
                        const tokensNeededForScenes = exactSceneCount * 300;
                        const nonChunkedMaxTokens = Math.min(maxOutputTokens, Math.max(4096, tokensNeededForScenes + 1000)); // Margem de segurança
                        
                        console.log(`📊 Requisição completa: ${exactSceneCount} cenas, ~${tokensNeededForScenes} tokens necessários, usando ${nonChunkedMaxTokens} tokens máximo`);
                        
                        while (retries > 0) {
                            try {
                                console.log(`📤 Enviando requisição completa para API: modelo="${model}"`);
                                result = await apiRequestWithFallback('/api/generate', 'POST', { 
                                    prompt, 
                                    model, 
                                    schema,
                                    maxOutputTokens: nonChunkedMaxTokens
                                });
                                console.log(`✅ Resposta completa recebida da API para modelo "${model}"`);
                                
                                if (model.startsWith('gpt-')) {
                                    scenesData = result.data?.scenes || result.data?.data?.scenes;
                                } else {
                                    if (Array.isArray(result.data)) {
                                        scenesData = result.data;
                                    } else if (result.data?.scenes && Array.isArray(result.data.scenes)) {
                                        scenesData = result.data.scenes;
                                    } else if (result.data?.data && Array.isArray(result.data.data)) {
                                        scenesData = result.data.data;
                                    } else {
                                        scenesData = result.data;
                                    }
                                }
                                
                                if (Array.isArray(scenesData) && scenesData.length > 0) {
                                    const validScenes = scenesData.filter(scene => 
                                        scene && 
                                        (scene.prompt_text || scene.prompt) &&
                                        typeof (scene.prompt_text || scene.prompt) === 'string'
                                    );
                                    
                                    if (validScenes.length > 0) {
                                        scenesData = validScenes.map(scene => ({
                                            scene_description: scene.scene_description || scene.description || `Cena ${scenesData.indexOf(scene) + 1}`,
                                            prompt_text: scene.prompt_text || scene.prompt || '',
                                            original_text: scene.original_text || scene.original || scene.text || ''
                                        }));
                                        break;
                                    }
                                }
                                
                                if (retries > 1) {
                                    console.warn(`Tentativa ${4 - retries} falhou. Resposta recebida:`, result);
                                    addToLog(`Tentando novamente... (${retries - 1} tentativas restantes)`, false);
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    retries--;
                                } else {
                                    throw new Error("A IA nao retornou prompts de cena validos no formato esperado.");
                                }
                            } catch (error) {
                                const isJsonError = error.message && (
                                    error.message.includes('JSON') ||
                                    error.message.includes('malformado') ||
                                    error.message.includes('incompleto') ||
                                    error.message.includes('parse') ||
                                    error.message.includes('Unexpected')
                                );
                                
                                if (isJsonError && retries > 0) {
                                    // Erro de JSON - adicionar instrução mais explícita no retry
                                    addToLog(`Erro de JSON detectado. Tentando novamente com instruções mais explícitas... (${retries} restante)`, true);
                                    if (model.startsWith('gpt-')) {
                                        prompt = `${prompt}\n\nLEMBRE-SE: Retorne APENAS o JSON objeto válido, sem nenhum texto adicional. O JSON deve começar com { e terminar com }. Todas as strings entre aspas duplas.`;
                                    } else {
                                        prompt = `${prompt}\n\nLEMBRE-SE: Retorne APENAS o JSON array válido, sem nenhum texto adicional. O JSON deve começar com [ e terminar com ]. Todas as strings entre aspas duplas.`;
                                    }
                                }
                                
                                retries--;
                                if (retries === 0) {
                                    console.error('Erro após todas as tentativas:', error);
                                    throw new Error(`Falha ao gerar prompts de cena após 3 tentativas: ${error.message}`);
                                }
                                console.warn(`Erro na tentativa ${4 - retries}:`, error.message);
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                        }
                        
                        if (!scenesData || !Array.isArray(scenesData) || scenesData.length === 0) {
                            throw new Error("A IA nao retornou prompts de cena validos.");
                        }
                        
                        // Garantir que temos exatamente a quantidade calculada
                        if (scenesData.length > exactSceneCount) {
                            scenesData = scenesData.slice(0, exactSceneCount);
                            addToLog(`Ajustado: ${scenesData.length} cenas (calculado: ${exactSceneCount})`, false);
                        } else if (scenesData.length < exactSceneCount) {
                            addToLog(`⚠️ Aviso: Foram geradas ${scenesData.length} cenas, mas ${exactSceneCount} foram calculadas.`, true);
                        }
                    
                    scenePromptResults.data.push(...scenesData);
                    scenePromptResults.total_prompts = scenePromptResults.data.length;
                    appState.sceneGenStatus.current = scenePromptResults.data.length;
                        appState.sceneGenStatus.total = exactSceneCount;
                        appState.sceneGenStatus.subMessage = `Roteiro dividido automaticamente (${scenePromptResults.data.length}/${exactSceneCount} cenas).`;
                        appState.sceneGenStatus.message = `Roteiro dividido em ${scenePromptResults.data.length} cena(s) (calculado: ${exactSceneCount}).`;
                    renderSceneGenerationProgress(appState.sceneGenStatus);
                    }
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
                console.error('Erro ao gerar prompts de cena:', error);
                addToLog(error.message || "Erro ao gerar prompts de cena", true);
                appState.sceneGenStatus.error = true;
                appState.sceneGenStatus.message = error.message || "Erro ao gerar prompts de cena";
                
                // Tentar extrair informações úteis do erro
                if (error.message && error.message.includes('JSON')) {
                    addToLog("Erro de formatação JSON detectado. A resposta da IA pode estar malformada.", true);
                    console.error('Detalhes do erro JSON:', error);
                }
            } finally {
                renderSceneGenerationProgress(appState.sceneGenStatus);
                setTimeout(() => {
                    appState.sceneGenStatus.active = false;
                    renderSceneGenerationProgress(appState.sceneGenStatus);
                }, 5000);
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

            const prompt = `Voce e um diretor de elenco especializado em analisar roteiros e identificar personagens para geracao de imagens com IA.

**ROTEIRO PARA ANALISAR:**
${scriptText}

---

**INSTRUCOES:**
1. Identifique todos os personagens principais e secundarios mencionados no roteiro.
2. Para cada personagem, crie uma descricao concisa e pratica que inclua:
   - Nome do personagem (ou descricao se nao tiver nome)
   - Idade aparente
   - Aparencia fisica (cor de cabelo, olhos, tipo fisico, tracos distintivos)
   - Vestimentas principais
   - Caracteristicas visuais importantes para manter consistencia

3. **FORMATO DE SAIDA OBRIGATORIO:** Voce DEVE retornar um objeto JSON com a seguinte estrutura exata:
{
  "characters": [
    "Nome, idade, descricao fisica e caracteristicas visuais",
    "Outro personagem, idade, descricao fisica e caracteristicas visuais"
  ]
}

**EXEMPLO DE FORMATO:**
{
  "characters": [
    "Joao, um homem de 40 anos, cabelo grisalho, oculos, rosto marcado, vestindo terno escuro",
    "Maria, uma jovem de 25 anos, cabelo longo e ruivo, olhos verdes, vestindo vestido casual"
  ]
}

**REGRA CRITICA:**
- Retorne APENAS o JSON valido, sem texto adicional antes ou depois
- Cada string no array deve ser uma descricao completa e pratica do personagem
- Foque em caracteristicas visuais que ajudem a manter consistencia nas imagens geradas
- Se um personagem nao tem nome, use uma descricao clara (ex: "Policial veterano, 50 anos, cabelo grisalho curto, uniforme azul")
- Limite a descricao de cada personagem a uma linha, mas seja completo e detalhado
- Retorne no formato JSON exato especificado acima, com a propriedade "characters" contendo um array de strings

**AGORA ANALISE O ROTEIRO FORNECIDO E RETORNE O JSON COM OS PERSONAGENS IDENTIFICADOS:**
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
                const result = await apiRequestWithFallback('/api/generate', 'POST', { 
                    prompt, 
                    model, 
                    schema,
                    maxOutputTokens: 4096
                });
                
                console.log('Resposta da API para detecção de personagens:', result);
                
                // Tratamento robusto da resposta
                let characters = [];
                
                if (result && result.data) {
                    // Se result.data já é o array de characters
                    if (Array.isArray(result.data)) {
                        characters = result.data;
                    }
                    // Se result.data tem a propriedade characters
                    else if (result.data.characters && Array.isArray(result.data.characters)) {
                        characters = result.data.characters;
                    }
                    // Se result.data é um objeto com outras propriedades
                    else if (typeof result.data === 'object') {
                        // Tenta encontrar o array em qualquer propriedade
                        for (const key in result.data) {
                            if (Array.isArray(result.data[key])) {
                                characters = result.data[key];
                                break;
                            }
                        }
                    }
                    // Se result.data é uma string, tenta fazer parse
                    else if (typeof result.data === 'string') {
                        try {
                            const parsed = JSON.parse(result.data);
                            if (parsed.characters && Array.isArray(parsed.characters)) {
                                characters = parsed.characters;
                            } else if (Array.isArray(parsed)) {
                                characters = parsed;
                            }
                        } catch (e) {
                            console.warn('Não foi possível fazer parse da string:', e);
                        }
                    }
                }
                
                // Se ainda não encontrou, tenta extrair do texto completo
                if (characters.length === 0 && result) {
                    const fullResult = JSON.stringify(result);
                    try {
                        // Tenta encontrar um JSON válido no resultado
                        const jsonMatch = fullResult.match(/\{"characters":\s*\[[^\]]*\]\}/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.characters && Array.isArray(parsed.characters)) {
                                characters = parsed.characters;
                            }
                        }
                    } catch (e) {
                        console.warn('Não foi possível extrair personagens do resultado completo:', e);
                    }
                }
                
                if (characters.length > 0) {
                    // Filtra strings vazias e limpa os dados
                    characters = characters
                        .filter(char => char && typeof char === 'string' && char.trim().length > 0)
                        .map(char => char.trim());
                    
                    if (characters.length > 0) {
                charactersTextarea.value = characters.join('\n');
                hideProgressModal();
                        showSuccessToast(`Personagens detectados com sucesso! (${characters.length} personagem${characters.length !== 1 ? 's' : ''} encontrado${characters.length !== 1 ? 's' : ''})`);
                    } else {
                        hideProgressModal();
                        addToLog("Os personagens detectados estavam vazios. Verifique o console para mais detalhes.", true);
                        showSuccessToast("Nenhum personagem válido foi detectado.");
                        console.error('Resposta completa da API:', result);
                    }
                } else {
                    hideProgressModal();
                    addToLog("Nenhum personagem foi detectado na resposta da IA. Verifique o console para mais detalhes.", true);
                    showSuccessToast("Nenhum personagem foi detectado. Verifique se o roteiro contém personagens identificáveis.");
                    console.error('Resposta completa da API:', result);
                    console.error('Estrutura de result.data:', result?.data);
                }
            } catch (error) {
                console.error('Erro ao detectar personagens:', error);
                console.error('Stack trace:', error.stack);
                addToLog(error.message || "Erro ao detectar personagens", true);
                hideProgressModal();
                showSuccessToast("Ocorreu um erro ao detectar personagens. Verifique o console para mais detalhes.");
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
                prompt = `Gere 2 prompts em INGLES para thumbnail '${platform}' sobre "${removeAccents(title)}". ${textInstruction} Diretriz: alta resolucao, cores vibrantes, clareza maxima, elementos fortes. JSON: {prompts: [{prompt, score (CTR 0-100), suggestion (PT, curta)}]}.`;
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
                prompt = `Gere 2 prompts em INGLES para thumbnail '${platform}' sobre "${removeAccents(title)}". ${textInstruction} Diretriz: alta resolucao, cores vibrantes, clareza maxima, elementos fortes. JSON array: [{prompt, score (CTR 0-100), suggestion (PT, curta)}].`;
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
                const result = await apiRequestWithFallback('/api/generate', 'POST', {prompt, model, schema});
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
    
            const processFailedImageRetry = createProcessFailedImageRetry(form);
            
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
                        // Verificar se foi cancelado
                        if (appState.imageGenStatus.cancelled) {
                            return;
                        }
                        
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
                            const errorLower = userFriendlyMessage.toLowerCase();

                            // Detectar erro de cookies expirados/inválidos
                            const isCookieError = errorLower.includes('cookie') || 
                                                errorLower.includes('autenticar') || 
                                                errorLower.includes('sessão') ||
                                                errorLower.includes('session') ||
                                                errorLower.includes('invalid cookie') ||
                                                errorLower.includes('cookie inválido') ||
                                                errorLower.includes('verifique os cookies') ||
                                                errorLower.includes('refresh session') ||
                                                errorLower.includes('expired');

                            if (isCookieError) {
                                alert('⚠️ COOKIES DO IMAGEFX EXPIRADOS!\n\nOs cookies do ImageFX expiraram ou são inválidos.\n\nPor favor:\n1. Abra o ImageFX no navegador e faça login\n2. Use a extensão "Cookie Editor" para exportar os cookies atualizados\n3. Vá em Configurações e cole os novos cookies\n4. Tente gerar as imagens novamente\n\nOs cookies precisam ser renovados periodicamente.');
                                
                                imageFxResults.images[currentImageIndex] = {
                                    status: 'failed',
                                    prompt: currentPrompt,
                                    error: 'Cookies do ImageFX expirados. Renove os cookies nas Configurações.',
                                    sceneNumber: currentSceneNumber,
                                    aspectRatio: form.aspectRatio
                                };
                                renderImageFxOutput();
                                completed++;
                                updateProgress();
                                return;
                            }

                            if (userFriendlyMessage.includes('Prompt bloqueado') || errorLower.includes('conteúdo inseguro') || errorLower.includes('conteudo inseguro')) {
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

                            // Se foi cancelado, parar aqui
                            if (appState.imageGenStatus.cancelled) {
                                appState.imageGenStatus.active = false;
                                appState.imageGenStatus.message = 'Geração cancelada pelo usuário.';
                                renderImageGenerationProgress(appState.imageGenStatus);
                                addToLog('Geração de imagens cancelada pelo usuário.', false);
                                return;
                            }

                    // Retry automático para imagens com erro (com concorrência de 3 e loop até 100%)
                    if (!isRetry && !isBulkRetry) {
                        const delay = (ms) => new Promise(res => setTimeout(res, ms));
                        let attempt = 0;
                        const maxAttempts = 50; // Limite de segurança para evitar loop infinito
                        
                        while (true) {
                            // Verificar se foi cancelado
                            if (appState.imageGenStatus.cancelled) {
                                appState.imageGenStatus.active = false;
                                appState.imageGenStatus.message = 'Geração cancelada pelo usuário.';
                            renderImageGenerationProgress(appState.imageGenStatus);
                                addToLog('Geração de imagens cancelada pelo usuário.', false);
                                break;
                            }
                            
                            const failedImages = imageFxResults.images.filter(img => img.status === 'failed');
                            
                            if (failedImages.length === 0) {
                                addToLog(`Todas as imagens foram geradas com sucesso!`);
                                break;
                            }
                            
                            attempt++;
                            if (attempt > maxAttempts) {
                                addToLog(`Limite de tentativas atingido. Parando retry automático.`, true);
                                break;
                            }
                            
                            addToLog(`Tentativa ${attempt}: Regenerando ${failedImages.length} imagem(ns) com erro (3 por vez)...`);
                            appState.imageGenStatus.message = `Tentativa ${attempt}: Regenerando ${failedImages.length} imagem(ns) com erro...`;
                            renderImageGenerationProgress(appState.imageGenStatus);
                            
                            // Cria tasks para as imagens com erro
                            const retryTasks = [];
                            for (let i = 0; i < imageFxResults.images.length; i++) {
                                const img = imageFxResults.images[i];
                                if (img.status === 'failed') {
                                    retryTasks.push({ img, index: i });
                                }
                            }
                            
                            // Processa com concorrência de 3 (em paralelo)
                            const processRetryTask = async (task) => {
                                // Verificar se foi cancelado
                                if (appState.imageGenStatus.cancelled) {
                                    return;
                                }
                                
                                const { img, index } = task;
                                addToLog(`[Retry Paralelo] Iniciando retry para cena ${img.sceneNumber}...`);
                                
                                const errorMessage = (img.error || '').toLowerCase();
                                const isThrottlingError = errorMessage.includes('throttled') || 
                                                         errorMessage.includes('limite de requisições') ||
                                                         errorMessage.includes('429') ||
                                                         errorMessage.includes('too many requests') ||
                                                         errorMessage.includes('limite temporário');
                                
                                // Se for erro de throttling, aguarda 5 segundos antes de tentar
                                // Isso acontece em paralelo para as 3 tasks simultaneamente
                                if (isThrottlingError) {
                                    imageFxResults.images[index] = {
                                        ...img,
                                        status: 'retrying',
                                        error: 'Aguardando 5 segundos antes de tentar novamente (limite temporário)...'
                                    };
                                    renderImageFxOutput();
                                    addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: aguardando 5s (throttling)...`);
                                    await delay(5000);
                                }
                                
                                // Obtém o form atual para usar na função de retry
                                const currentForm = {
                                    negativePrompt: document.getElementById('imagefx-negative-prompt')?.value.trim(),
                                    aspectRatio: img.aspectRatio,
                                    style: document.getElementById('imagefx-style')?.value,
                                    numImages: parseInt(document.getElementById('imagefx-num-images')?.value, 10),
                                    generationModel: document.getElementById('imagefx-model')?.value
                                };
                                const processFailedImageRetry = createProcessFailedImageRetry(currentForm);
                                addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: processando retry...`);
                                await processFailedImageRetry(img, index);
                                addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: retry concluído.`);
                            };
                            
                            // Processa 3 por vez em paralelo (não sequencial!)
                            addToLog(`[Retry Paralelo] Processando ${retryTasks.length} imagens com erro (3 por vez em paralelo)...`);
                            await runTasksWithConcurrency(retryTasks, 3, processRetryTask);
                            addToLog(`[Retry Paralelo] Lote de 3 concluído.`);
                            
                            // Aguarda um pouco antes da próxima rodada de tentativas
                            await delay(2000);
                            }
                            
                            addToLog(`Processo de retry automático concluído.`);
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
                
                // Retry automático para imagens com erro (com concorrência de 3 e loop até 100%)
                if (!isRetry && !isBulkRetry) {
                    const delay = (ms) => new Promise(res => setTimeout(res, ms));
                    let attempt = 0;
                    const maxAttempts = 50; // Limite de segurança para evitar loop infinito
                    
                    while (true) {
                    const failedImages = imageFxResults.images.filter(img => img.status === 'failed');
                    
                        if (failedImages.length === 0) {
                            addToLog(`Todas as imagens foram geradas com sucesso!`);
                            break;
                        }
                        
                        attempt++;
                        if (attempt > maxAttempts) {
                            addToLog(`Limite de tentativas atingido. Parando retry automático.`, true);
                            break;
                        }
                        
                        addToLog(`Tentativa ${attempt}: Regenerando ${failedImages.length} imagem(ns) com erro (3 por vez)...`);
                        appState.imageGenStatus.message = `Tentativa ${attempt}: Regenerando ${failedImages.length} imagem(ns) com erro...`;
                        renderImageGenerationProgress(appState.imageGenStatus);
                        
                        // Cria tasks para as imagens com erro
                        const retryTasks = [];
                        for (let i = 0; i < imageFxResults.images.length; i++) {
                            const img = imageFxResults.images[i];
                            if (img.status === 'failed') {
                                retryTasks.push({ img, index: i });
                            }
                        }
                        
                        // Processa com concorrência de 3 (em paralelo)
                        const processRetryTask = async (task) => {
                            const { img, index } = task;
                            addToLog(`[Retry Paralelo] Iniciando retry para cena ${img.sceneNumber}...`);
                            
                            const errorMessage = (img.error || '').toLowerCase();
                            const isThrottlingError = errorMessage.includes('throttled') || 
                                                     errorMessage.includes('limite de requisições') ||
                                                     errorMessage.includes('429') ||
                                                     errorMessage.includes('too many requests') ||
                                                     errorMessage.includes('limite temporário');
                            
                            // Se for erro de throttling, aguarda 5 segundos antes de tentar
                            // Isso acontece em paralelo para as 3 tasks simultaneamente
                            if (isThrottlingError) {
                                imageFxResults.images[index] = {
                                    ...img,
                                    status: 'retrying',
                                    error: 'Aguardando 5 segundos antes de tentar novamente (limite temporário)...'
                                };
                                renderImageFxOutput();
                                addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: aguardando 5s (throttling)...`);
                                await delay(5000);
                            }
                            
                            // Obtém o form atual para usar na função de retry
                            const currentForm = {
                                negativePrompt: document.getElementById('imagefx-negative-prompt')?.value.trim(),
                                aspectRatio: img.aspectRatio,
                                style: document.getElementById('imagefx-style')?.value,
                                numImages: parseInt(document.getElementById('imagefx-num-images')?.value, 10),
                                generationModel: document.getElementById('imagefx-model')?.value
                            };
                            const processFailedImageRetry = createProcessFailedImageRetry(currentForm);
                            addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: processando retry...`);
                            await processFailedImageRetry(img, index);
                            addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: retry concluído.`);
                        };
                        
                        // Processa 3 por vez em paralelo (não sequencial!)
                        addToLog(`[Retry Paralelo] Processando ${retryTasks.length} imagens com erro (3 por vez em paralelo)...`);
                        await runTasksWithConcurrency(retryTasks, 3, processRetryTask);
                        addToLog(`[Retry Paralelo] Lote de 3 concluído.`);
                        
                        // Aguarda um pouco antes da próxima rodada de tentativas
                        await delay(2000);
                        }
                        
                        addToLog(`Processo de retry automático concluído.`);
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
                const result = await apiRequestWithFallback('/api/generate', 'POST', { prompt, model, schema });
                
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
                // 1. Fetch YouTube video details (com fallback automático para GPT-4 se não tiver API do YouTube)
                let videoDetails;
                try {
                    videoDetails = await apiRequest('/api/youtube/details-v3', 'POST', { url: videoUrl });
                } catch (error) {
                    // Se falhar, tenta novamente (o backend já faz fallback para GPT-4)
                    throw new Error(`Não foi possível obter os detalhes do vídeo: ${error.message || 'Erro desconhecido'}`);
                }
        
                if (!videoDetails || !videoDetails.title) {
                    throw new Error("Não foi possível obter os detalhes do vídeo do YouTube. Verifique a URL e tente novamente.");
                }
                
                // Informar ao usuário sobre o método usado
                if (videoDetails.source === 'scraping_gpt4') {
                    console.log("ℹ️ Dados extraídos via scraping + GPT-4 (sem API do YouTube)");
                    addToLog("ℹ️ Dados extraídos via scraping e IA - algumas estatísticas podem ser estimadas", false);
                } else if (videoDetails.source === 'gpt4_estimation') {
                    console.log("ℹ️ Dados estimados usando GPT-4 (sem API do YouTube)");
                    addToLog("ℹ️ Dados estimados usando IA (GPT-4) - algumas informações podem não estar disponíveis", false);
                }
        
                // 2. Generate optimization suggestions using AI
                const optimizationPrompt = `Especialista SEO YouTube. Analise video e sugira otimizacoes. Titulo: 3-5 variacoes (CTR+SEO). Descricao: 500-1000 chars, SEO, gancho, CTA. Tags: 10-15 relevantes. Pontuacoes: 0-100 para SEO e CTR (original e sugestoes). JSON: {original_title, original_description, original_tags, original_scores: {seo_potential, ctr_potential}, suggested_titles[], suggested_description, suggested_tags[], new_scores: {seo_potential, ctr_potential}}.

VIDEO:
Titulo: "${removeAccents(videoDetails.title)}"
Descricao: "${removeAccents(videoDetails.description)}"
                Tags: ${videoDetails.tags.join(', ')}
                Canal: "${removeAccents(videoDetails.channelTitle)}"
Views: ${videoDetails.viewCount} | Likes: ${videoDetails.likeCount} | Comentarios: ${videoDetails.commentCount} | Publicado: ${videoDetails.publishedAt}`;
        
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
        
                const aiResult = await apiRequestWithFallback('/api/generate', 'POST', { prompt: optimizationPrompt, model, schema: optimizationSchema });
        
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
            const providerSelect = document.getElementById('tts-provider-select');
            const styleInstructions = document.getElementById('tts-style-instructions');
            const outputContainer = document.getElementById('output');

            const script = scriptInput?.value.trim();
            const voice = voiceSelect?.value;
            const ttsModel = modelSelect?.value || 'gemini-2.5-pro-preview-tts'; // Fallback
            const provider = providerSelect?.value || 'openai'; // OpenAI como padrão (melhor qualidade)
            const style = styleInstructions?.value.trim();

            if (!script || !voice) {
                showSuccessToast('Por favor, preencha o roteiro e selecione uma voz.');
                return;
            }

            // Sem limite de caracteres - o backend divide automaticamente em partes

            if (outputContainer) outputContainer.innerHTML = ''; // Clear previous results

            try {
                addToLog(`A iniciar geracao de narracao usando ${provider === 'openai' ? 'OpenAI' : 'Gemini'}...`);
                const response = await apiRequest('/api/tts/generate-from-script', 'POST', {
                    script: script,
                    voice: voice,
                    ttsModel: ttsModel,
                    styleInstructions: style,
                    provider: provider
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
                            error: statusRes.status === 'failed',
                            status: statusRes.status,
                            partDownloads: statusRes.partDownloads || []
                        };
                        renderVoiceGenerationProgress(appState.voiceGenStatus);

                        // Resetar contador de erros em caso de sucesso
                        if (state.pollErrorCount > 0) {
                            console.log('✅ Conexão restabelecida');
                            state.pollErrorCount = 0;
                        }
                        
                        if (statusRes.status === 'completed') {
                            clearInterval(state.longGenInterval);
                            state.longGenInterval = null;
                            state.longGenJobId = null;
                            showVoiceGenCompleteModal(statusRes.downloadUrl, statusRes.partDownloads || []);
                            addToLog('✅ Narração gerada com sucesso!', false);
                            setTimeout(() => {
                                appState.voiceGenStatus.active = false;
                                renderVoiceGenerationProgress(appState.voiceGenStatus);
                            }, 5000);
                        } else if (statusRes.status === 'partial') {
                            clearInterval(state.longGenInterval);
                            state.longGenInterval = null;
                            state.longGenJobId = null;
                            
                            if (statusRes.partDownloads && statusRes.partDownloads.length > 0) {
                                showVoiceGenCompleteModal(null, statusRes.partDownloads || []);
                                addToLog(`⚠️ Geração parcial: ${statusRes.partDownloads.length} parte(s) disponível(is) para download. ${statusRes.message}`, false);
                            } else {
                                addToLog(`❌ Erro na geração de voz: ${statusRes.message}`, true);
                            }
                            setTimeout(() => {
                                appState.voiceGenStatus.active = false;
                                renderVoiceGenerationProgress(appState.voiceGenStatus);
                            }, 10000);
                        } else if (statusRes.status === 'failed') {
                            clearInterval(state.longGenInterval);
                            state.longGenInterval = null;
                            state.longGenJobId = null;
                            
                            // Mensagem mais amigável dependendo do erro
                            let errorMsg = statusRes.message || 'Erro desconhecido';
                            if (errorMsg.includes('Quota') || errorMsg.includes('quota')) {
                                addToLog(`❌ Limite da API atingido. ${errorMsg}`, true);
                            } else if (errorMsg.includes('API') || errorMsg.includes('chave')) {
                                addToLog(`❌ Problema com a chave da API. Verifique suas configurações. ${errorMsg}`, true);
                            } else if (errorMsg.includes('modelo') || errorMsg.includes('model')) {
                                addToLog(`❌ Problema com o modelo selecionado. Tente usar outro modelo. ${errorMsg}`, true);
                            } else {
                                addToLog(`❌ Falha na geração de voz: ${errorMsg}`, true);
                            }
                        }
                    } catch (pollError) {
                        console.error('Erro ao verificar status da geração:', pollError);
                        
                        // Se for erro 404, o job pode ter expirado
                        if (pollError.message.includes('não encontrado') || pollError.message.includes('404')) {
                            clearInterval(state.longGenInterval);
                            state.longGenInterval = null;
                            state.longGenJobId = null;
                            addToLog('❌ Trabalho de geração expirou ou foi removido. Por favor, inicie uma nova geração.', true);
                            appState.voiceGenStatus = { 
                                active: false, 
                                current: 0, 
                                total: 0, 
                                message: 'Trabalho expirado', 
                                error: true 
                            };
                            renderVoiceGenerationProgress(appState.voiceGenStatus);
                            return;
                        }
                        
                        // Contar tentativas consecutivas de erro
                        if (!state.pollErrorCount) state.pollErrorCount = 0;
                        state.pollErrorCount++;
                        
                        // Se tiver muitos erros consecutivos, parar o polling
                        if (state.pollErrorCount >= 5) {
                            clearInterval(state.longGenInterval);
                            state.longGenInterval = null;
                            state.longGenJobId = null;
                            state.pollErrorCount = 0;
                            
                            let errorMsg = 'Não foi possível acompanhar o progresso da geração. ';
                            if (pollError.message.includes('temporariamente indisponível') || pollError.message.includes('502')) {
                                errorMsg += 'O servidor está temporariamente indisponível. Aguarde alguns minutos e verifique o status novamente.';
                            } else if (pollError.message.includes('conexão')) {
                                errorMsg += 'Verifique sua conexão com a internet.';
                            } else {
                                errorMsg += 'Tente recarregar a página.';
                            }
                            
                            addToLog(`❌ ${errorMsg}`, true);
                            appState.voiceGenStatus = { 
                                active: true, 
                                current: 0, 
                                total: 1, 
                                message: errorMsg, 
                                error: true 
                            };
                            renderVoiceGenerationProgress(appState.voiceGenStatus);
                        } else {
                            // Apenas logar o erro, mas continuar tentando
                            console.warn(`⚠️ Tentativa ${state.pollErrorCount}/5 falhou ao verificar status. Tentando novamente...`);
                        }
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
            const model = document.getElementById('tts-model-select')?.value || 'gemini-2.5-pro-preview-tts';
            const provider = document.getElementById('tts-provider-select')?.value || 'openai'; // OpenAI como padrão (melhor qualidade)

            if (!voice) {
                showSuccessToast('Por favor, selecione uma voz para testar.');
                return;
            }
            
            if (previewBtn) {
                previewBtn.disabled = true;
                previewBtn.classList.add('opacity-50');
            }
            addToLog(`A gerar previa da voz usando ${provider === 'openai' ? 'OpenAI' : 'Gemini'}...`);

            try {
                const response = await apiRequest('/api/tts/preview', 'POST', { voice, model, provider });
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

        // Modelo recomendado: GPT-4o (mais estável e confiável)
        const RECOMMENDED_MODEL = 'gpt-4o';

        const gptModelOptions = `
            <optgroup label="OpenAI GPT (Recomendado)">
                <option value="gpt-4o" selected>⭐ GPT-4o (Recomendado)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </optgroup>
        `;

        const geminiModelOptions = `
            <optgroup label="Google Gemini">
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
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

        // Ordem: GPT primeiro (recomendado), depois Claude, depois Gemini
        modelSelectIds.forEach(id => {
            const selectEl = mainContent.querySelector(`#${id}`);
            if (selectEl) {
                selectEl.innerHTML = gptModelOptions + claudeModelOptions + geminiModelOptions;
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
            // Verificar se o botão existe na aba atual antes de tentar anexar eventos
            const btn = mainContent ? mainContent.querySelector(`#${buttonId}`) : document.getElementById(buttonId);
            if (btn) {
                // Remove existing click listener to prevent duplicates
                if (btn._clickListener) {
                    btn.removeEventListener('click', btn._clickListener);
                }
                const clickHandler = async (e) => {
                    e.preventDefault(); // Always prevent default for these buttons
                    e.stopPropagation(); // Stop event propagation
                    if (btn.disabled) {
                        showSuccessToast('Por favor, configure suas chaves de API nas configuracoes para usar esta ferramenta.');
                        return;
                    }
                    // Log removido para evitar poluição do console - descomente se precisar debug
                    // console.log(`Botão ${buttonId} clicado, handler:`, buttonsToHandle[buttonId]);
                    if (buttonId === 'generate-imagefx') {
                        await handlers[buttonId](null, false);
                    } else {
                        const handlerKey = buttonsToHandle[buttonId];
                        if (handlers[handlerKey]) {
                            await handlers[handlerKey](e);
                        } else {
                            console.error(`Handler não encontrado para ${handlerKey}`);
                        }
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
            // Removido o console.warn - é normal que botões de outras abas não existam na aba atual
        });
        
        // Para botões que podem ser criados dinamicamente (como apply-suggestions-btn no script-reviewer)
        // Usar delegação de eventos no container pai
        if (tabId === 'script-reviewer') {
            const tabContent = document.getElementById('tab-content');
            if (tabContent) {
                // Remover listener existente se houver
                if (tabContent._reviewerDelegateListener) {
                    tabContent.removeEventListener('click', tabContent._reviewerDelegateListener);
                }
                
                // Delegar eventos para botões criados dinamicamente (apenas apply-suggestions-btn)
                // analyze-script-btn e apply-manual-btn são tratados pelo mainContentClickListener
                const delegateHandler = async (e) => {
                    const target = e.target;
                    // Verificar se o clique foi no botão ou em um elemento dentro dele
                    let applySuggestionsBtn = null;
                    
                    if (target.id === 'apply-suggestions-btn') {
                        applySuggestionsBtn = target;
                    } else {
                        // Procurar o botão pai
                        let parent = target.parentElement;
                        while (parent && parent !== tabContent) {
                            if (parent.id === 'apply-suggestions-btn') {
                                applySuggestionsBtn = parent;
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    }
                    
                    // Apenas processar apply-suggestions-btn aqui
                    // analyze-script-btn e apply-manual-btn são tratados pelo mainContentClickListener
                    if (applySuggestionsBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!applySuggestionsBtn.disabled && handlers['apply-suggestions-btn']) {
                            await handlers['apply-suggestions-btn']();
                        }
                    }
                };
                tabContent.addEventListener('click', delegateHandler);
                tabContent._reviewerDelegateListener = delegateHandler;
                // Log removido para evitar poluição do console
            }
        }

        if (tabId === 'script-writer') {
            populateFormulas();
            const scriptDurationEl = document.getElementById('script-duration');
            if (scriptDurationEl) {
                scriptDurationEl.addEventListener('input', e => {
                 const duration = parseInt(e.target.value);
                     if (!isNaN(duration) && duration > 0) {
                 let parts = Math.max(1, Math.ceil(duration / 2));
                 const scriptPartsEl = document.getElementById('script-parts');
                         if (scriptPartsEl) {
                             scriptPartsEl.value = parts;
                             console.log(`📊 Duração: ${duration} minutos → Partes: ${parts} (${duration}/2 = ${duration/2}, arredondado para cima)`);
                         }
                     }
                });
                
                // Calcular partes inicialmente se já houver duração
                const scriptPartsEl = document.getElementById('script-parts');
                if (scriptDurationEl.value && scriptPartsEl) {
                    const duration = parseInt(scriptDurationEl.value);
                    if (!isNaN(duration) && duration > 0) {
                        const parts = Math.max(1, Math.ceil(duration / 2));
                        scriptPartsEl.value = parts;
                        console.log(`📊 Cálculo inicial: ${duration} minutos → ${parts} partes`);
                    }
                }
            }
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
        
        if (tabId === 'script-reviewer') {
            initializeScriptReviewer();
            // Adicionar cálculo automático de partes baseado na duração
            const reviewerDurationEl = document.getElementById('reviewer-duration');
            if (reviewerDurationEl) {
                // Remover listeners existentes para evitar duplicatas
                const newEl = reviewerDurationEl.cloneNode(true);
                reviewerDurationEl.parentNode.replaceChild(newEl, reviewerDurationEl);
                
                newEl.addEventListener('input', e => {
                    const duration = parseInt(e.target.value);
                    if (!isNaN(duration) && duration > 0) {
                        let parts = Math.max(1, Math.ceil(duration / 2));
                        const reviewerPartsEl = document.getElementById('reviewer-parts');
                        if (reviewerPartsEl) reviewerPartsEl.value = parts || '';
                    } else {
                        const reviewerPartsEl = document.getElementById('reviewer-parts');
                        if (reviewerPartsEl) reviewerPartsEl.value = '';
                    }
                });
            }
            
            // Calcular partes inicialmente se já houver duração
            const reviewerDuration = document.getElementById('reviewer-duration');
            const reviewerParts = document.getElementById('reviewer-parts');
            if (reviewerDuration && reviewerParts && reviewerDuration.value) {
                const duration = parseInt(reviewerDuration.value);
                if (!isNaN(duration) && duration > 0) {
                    reviewerParts.value = Math.max(1, Math.ceil(duration / 2));
                }
            }
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
            
            // Handler para botões de paginação do script
            if (target.matches('.page-btn') && target.closest('#script-pagination-controls')) {
                const page = parseInt(target.dataset.page, 10);
                if (page && page !== scriptResults.currentPage) {
                    scriptResults.currentPage = page;
                    renderScriptPage();
                    // Scroll suave para o topo do output
                    const outputEl = document.getElementById('output');
                    if (outputEl) {
                        outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
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
            // Handlers para botões do revisor de roteiro
            if (targetId === 'analyze-script-btn' || target.closest('#analyze-script-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const btn = target.id === 'analyze-script-btn' ? target : target.closest('#analyze-script-btn');
                if (btn && !btn.disabled && handlers['analyze-script-btn']) {
                    await handlers['analyze-script-btn']();
                }
            }
            if (targetId === 'apply-manual-btn' || target.closest('#apply-manual-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const btn = target.id === 'apply-manual-btn' ? target : target.closest('#apply-manual-btn');
                if (btn && !btn.disabled && handlers['apply-manual-btn']) {
                    await handlers['apply-manual-btn']();
                }
            }
            if (targetId === 'download-revised-script-btn' || target.closest('#download-revised-script-btn')) {
                if (reviewerResults.revisedScript) {
                 safelyDownloadFile(reviewerResults.revisedScript, 'roteiro_revisado.txt', 'text/plain');
            }
            }
            if (targetId === 'copy-revised-script-btn' || target.closest('#copy-revised-script-btn')) {
                if (reviewerResults.revisedScript) {
                    const scriptToCopy = reviewerResults.revisedScript || document.getElementById('reviewer-revised-script-textarea')?.value;
                    if (scriptToCopy) {
                        navigator.clipboard.writeText(scriptToCopy).then(() => showSuccessToast("Roteiro revisado copiado!"));
                    }
                }
            }
            
            // Handler para paginação do revisor de roteiro
            if (target.matches('.reviewer-page-btn') || target.closest('.reviewer-page-btn')) {
                const pageBtn = target.matches('.reviewer-page-btn') ? target : target.closest('.reviewer-page-btn');
                if (pageBtn && pageBtn.closest('#reviewer-pagination-controls')) {
                    const page = parseInt(pageBtn.dataset.page, 10);
                    if (page && !isNaN(page) && page !== reviewerResults.currentPage && page >= 1) {
                        const maxPages = Math.ceil(reviewerResults.totalParts / reviewerResults.partsPerPage);
                        if (page <= maxPages) {
                            reviewerResults.currentPage = page;
                            renderReviewerScriptPage();
                            // Scroll suave para o topo do output
                            const reviewerOutput = document.getElementById('reviewer-output');
                            if (reviewerOutput) {
                                reviewerOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                    }
                }
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
                const charCountEl = document.getElementById('tts-char-count');
                if (scriptInput && scriptResults.fullResult && scriptResults.fullResult.full_script_text) {
                    const fullScript = scriptResults.fullResult.full_script_text;
                    
                    // Importa o roteiro completo sem limitação
                    scriptInput.value = fullScript;
                    showSuccessToast(`Ultimo roteiro gerado foi importado (${fullScript.length.toLocaleString('pt-BR')} caracteres).`);
                    
                    // Atualiza contador de caracteres
                    if (charCountEl) {
                        const currentLength = scriptInput.value.length;
                        charCountEl.textContent = `${currentLength.toLocaleString('pt-BR')} caracteres`;
                        charCountEl.className = 'text-sm text-gray-500 dark:text-gray-400';
                    }
                    
                    updateVoiceDurationHint();
                    
                    // Dispara evento input para atualizar o contador
                    scriptInput.dispatchEvent(new Event('input'));
                } else {
                    showSuccessToast("Nenhum roteiro gerado para importar.");
                }
            }
            
            if (targetId === 'import-last-script-for-scenes') {
                const sceneTextInput = document.getElementById('scene-text');
                if (sceneTextInput && scriptResults.fullResult && scriptResults.fullResult.full_script_text) {
                    sceneTextInput.value = scriptResults.fullResult.full_script_text;
                    
                    // Atualizar contador de palavras
                    const wordCounter = document.getElementById('scene-word-counter');
                    if (wordCounter) {
                        const wordCount = scriptResults.fullResult.full_script_text.split(/\s+/).filter(Boolean).length;
                        wordCounter.textContent = `${wordCount} palavras`;
                    }
                    
                    showSuccessToast("Ultimo roteiro gerado foi importado.");
                } else {
                    showSuccessToast("Nenhum roteiro gerado para importar.");
                }
            }
            
            if (targetId === 'import-last-script-for-translator') {
                const translatorInput = document.getElementById('translator-input-text');
                if (translatorInput && scriptResults.fullResult && scriptResults.fullResult.full_script_text) {
                    translatorInput.value = scriptResults.fullResult.full_script_text;
                    showSuccessToast(`Roteiro importado com sucesso (${scriptResults.fullResult.full_script_text.length} caracteres).`);
                } else {
                    showSuccessToast('Nenhum roteiro disponível para importar. Gere um roteiro primeiro.', true);
                }
            }
            
            if (targetId === 'import-last-script-reviewer') {
                const reviewerInput = document.getElementById('reviewer-input-text');
                if (reviewerInput && scriptResults.fullResult && scriptResults.fullResult.full_script_text) {
                    reviewerInput.value = scriptResults.fullResult.full_script_text;
                    
                    // Tentar importar também duração e idioma se disponíveis
                    const durationInput = document.getElementById('reviewer-duration');
                    const langSelect = document.getElementById('reviewer-lang');
                    
                    // Importar duração do prompt_info ou do fullResult
                    if (scriptResults.fullResult.prompt_info && scriptResults.fullResult.prompt_info.duration && durationInput) {
                        durationInput.value = scriptResults.fullResult.prompt_info.duration;
                        // Atualizar partes automaticamente
                        const partsInput = document.getElementById('reviewer-parts');
                        if (partsInput && durationInput.value) {
                            const duration = parseInt(durationInput.value);
                            if (!isNaN(duration) && duration > 0) {
                                partsInput.value = Math.max(1, Math.ceil(duration / 2));
                            }
                        }
                    } else if (scriptResults.fullResult.duration && durationInput) {
                        durationInput.value = scriptResults.fullResult.duration;
                    }
                    
                    if (scriptResults.fullResult.prompt_info && scriptResults.fullResult.prompt_info.lang && langSelect) {
                        langSelect.value = scriptResults.fullResult.prompt_info.lang;
                    } else if (scriptResults.fullResult.language && langSelect) {
                        langSelect.value = scriptResults.fullResult.language;
                    }
                    
                    // Importar pontuações se existirem - fazer uma cópia exata para não modificar
                    if (scriptResults.fullResult.scores) {
                        // Criar uma cópia profunda para garantir que não seja modificada
                        reviewerResults.originalScores = {
                            retention_potential: Number(scriptResults.fullResult.scores.retention_potential) || 0,
                            clarity_score: Number(scriptResults.fullResult.scores.clarity_score) || 0,
                            viral_potential: Number(scriptResults.fullResult.scores.viral_potential) || 0
                        };
                        // Pontuações importadas do roteiro
                        
                        // Usar requestAnimationFrame para garantir que o DOM está pronto
                        requestAnimationFrame(() => {
                            // Tentar encontrar o container várias vezes com diferentes seletores
                            const tabContent = document.getElementById('tab-content');
                            let outputContainer = null;
                            let attempts = 0;
                            const maxAttempts = 5;
                            
                            const findAndRender = () => {
                                // Tentar encontrar o container de output
                                if (tabContent) {
                                    outputContainer = tabContent.querySelector('#reviewer-output');
                                }
                                if (!outputContainer) {
                                    outputContainer = document.getElementById('reviewer-output');
                                }
                                if (!outputContainer && tabContent) {
                                    // Tentar encontrar dentro do template clonado
                                    const templateContent = tabContent.querySelector('.max-w-3xl.mx-auto');
                                    if (templateContent) {
                                        outputContainer = templateContent.querySelector('#reviewer-output');
                                    }
                                }
                                
                                if (outputContainer) {
                                    // Container encontrado, renderizar pontuações
                                    let scoresContainer = outputContainer.querySelector('#reviewer-original-scores-container');
                                    if (!scoresContainer) {
                                        // Se não existe, criar
                                        scoresContainer = document.createElement('div');
                                        scoresContainer.id = 'reviewer-original-scores-container';
                                        scoresContainer.className = 'mb-6';
                                        scoresContainer.innerHTML = `
                                            <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Pontuacao Original</h3>
                                            <div id="reviewer-original-score-cards"></div>
                                        `;
                                        // Inserir no início do outputContainer
                                        outputContainer.insertBefore(scoresContainer, outputContainer.firstChild);
                                    }
                                    
                                    const scoresCardsEl = scoresContainer.querySelector('#reviewer-original-score-cards');
                                    if (scoresCardsEl) {
                                        const retention = reviewerResults.originalScores.retention_potential || 0;
                                        const clarity = reviewerResults.originalScores.clarity_score || 0;
                                        const viral = reviewerResults.originalScores.viral_potential || 0;
                                        
                                        // Calcular média para o "Potencial de Sucesso"
                                        const mainScore = (retention + clarity + viral) / 3;
                                        
                                        // Usar renderScoreCard se disponível, senão HTML direto
                                        try {
                                            scoresCardsEl.innerHTML = `
                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                        <div class="flex justify-between items-center mb-2">
                                                            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Analise de Pontuacao</h3>
                                                        </div>
                                                        ${renderScoreCard('Potencial de Sucesso', mainScore, {
                                                            'Potencial de Retencao': retention,
                                                            'Clareza da Mensagem': clarity,
                                                            'Potencial Viral': viral
                                                        })}
                                                    </div>
                                                    <div class="grid grid-cols-1 gap-4">
                                                        ${renderScoreCard('Potencial de Retencao', retention, {})}
                                                        ${renderScoreCard('Clareza da Mensagem', clarity, {})}
                                                        ${renderScoreCard('Potencial Viral', viral, {})}
                                                    </div>
                                                </div>
                                            `;
                                        } catch (e) {
                                            // Fallback se renderScoreCard não estiver disponível
                                            console.error('Erro ao renderizar scores:', e);
                                            scoresCardsEl.innerHTML = `
                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Analise de Pontuacao</h3>
                                                        <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">Potencial de Sucesso</h4>
                                                        <div class="flex items-baseline gap-2 mb-4">
                                                            <span class="text-3xl font-bold text-blue-600 dark:text-blue-400">${Math.round(mainScore)}</span>
                                                            <span class="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
                                                        </div>
                                                        <div class="space-y-2">
                                                            <div>
                                                                <div class="flex justify-between text-sm mb-1">
                                                                    <span class="text-gray-500 dark:text-gray-400">Potencial de Retencao</span>
                                                                    <span class="font-semibold text-gray-900 dark:text-gray-100">${Math.round(retention)}/100</span>
                                                                </div>
                                                                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                                    <div class="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full" style="width: ${retention}%"></div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div class="flex justify-between text-sm mb-1">
                                                                    <span class="text-gray-500 dark:text-gray-400">Clareza da Mensagem</span>
                                                                    <span class="font-semibold text-gray-900 dark:text-gray-100">${Math.round(clarity)}/100</span>
                                                                </div>
                                                                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                                    <div class="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full" style="width: ${clarity}%"></div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div class="flex justify-between text-sm mb-1">
                                                                    <span class="text-gray-500 dark:text-gray-400">Potencial Viral</span>
                                                                    <span class="font-semibold text-gray-900 dark:text-gray-100">${Math.round(viral)}/100</span>
                                                                </div>
                                                                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                                    <div class="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full" style="width: ${viral}%"></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="grid grid-cols-1 gap-4">
                                                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                            <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">Potencial de Retencao</h4>
                                                            <div class="flex items-baseline gap-2">
                                                                <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">${retention.toFixed(1)}</span>
                                                                <span class="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
                                                            </div>
                                                            <div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                <div class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: ${retention}%"></div>
                                                            </div>
                                                        </div>
                                                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                            <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">Clareza da Mensagem</h4>
                                                            <div class="flex items-baseline gap-2">
                                                                <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">${clarity.toFixed(1)}</span>
                                                                <span class="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
                                                            </div>
                                                            <div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                <div class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: ${clarity}%"></div>
                                                            </div>
                                                        </div>
                                                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                            <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">Potencial Viral</h4>
                                                            <div class="flex items-baseline gap-2">
                                                                <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">${viral.toFixed(1)}</span>
                                                                <span class="text-sm text-gray-500 dark:text-gray-400">/ 100</span>
                                                            </div>
                                                            <div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                <div class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300" style="width: ${viral}%"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }
                                        
                                        scoresContainer.style.display = 'block';
                                        // Pontuações renderizadas com sucesso
                                    } else {
                                        console.error('Elemento reviewer-original-score-cards não encontrado');
                                    }
                                } else {
                                    // Container não encontrado, tentar novamente
                                    attempts++;
                                    if (attempts < maxAttempts) {
                                        setTimeout(findAndRender, 200);
                                    } else {
                                        console.error('Não foi possível encontrar o container reviewer-output após', maxAttempts, 'tentativas');
                                    }
                                }
                            };
                            
                            findAndRender();
                        });
                    } else {
                        console.warn('Nenhuma pontuação encontrada em scriptResults.fullResult.scores');
                    }
                    
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
                        
                        // Alerta se cookies ImageFX estão inválidos
                        if (!isValid) {
                            alert('⚠️ ATENÇÃO: Os cookies do ImageFX são inválidos ou expiraram!\n\nPor favor:\n1. Verifique se os cookies estão no formato correto (JSON)\n2. Exporte novamente os cookies usando a extensão "Cookie Editor"\n3. Cole os cookies atualizados no campo de configurações\n\nOs cookies do ImageFX podem expirar e precisam ser atualizados periodicamente.');
                        }
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

                // Função auxiliar para concorrência
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

                const delay = (ms) => new Promise(res => setTimeout(res, ms));
                let attempt = 0;
                const maxAttempts = 50; // Limite de segurança

                while (true) {
                    const currentFailedImages = imageFxResults.images.filter(img => img.status === 'failed');
                    
                    if (currentFailedImages.length === 0) {
                        regenerateButton.innerHTML = originalButtonText;
                        regenerateButton.disabled = false;
                        showSuccessToast('Todas as imagens foram geradas com sucesso!');
                        break;
                    }
                    
                    attempt++;
                    if (attempt > maxAttempts) {
                        regenerateButton.innerHTML = originalButtonText;
                        regenerateButton.disabled = false;
                        showSuccessToast('Limite de tentativas atingido. Algumas imagens podem não ter sido regeneradas.');
                        break;
                    }

                    regenerateButton.innerHTML = `<span class="spinner-sm"></span> Tentativa ${attempt}: Regenerando ${currentFailedImages.length} imagem(ns) (3 por vez)...`;

                    // Cria tasks para as imagens com erro
                    const retryTasks = [];
                for (let i = 0; i < imageFxResults.images.length; i++) {
                    const img = imageFxResults.images[i];
                    if (img.status === 'failed') {
                            retryTasks.push({ img, index: i });
                        }
                    }

                    // Processa com concorrência de 3 (em paralelo)
                    const processRetryTask = async (task) => {
                        const { img, index } = task;
                        addToLog(`[Retry Paralelo] Iniciando retry para cena ${img.sceneNumber}...`);
                        
                        const errorMessage = (img.error || '').toLowerCase();
                        const isThrottlingError = errorMessage.includes('throttled') || 
                                                 errorMessage.includes('limite de requisições') ||
                                                 errorMessage.includes('429') ||
                                                 errorMessage.includes('too many requests') ||
                                                 errorMessage.includes('limite temporário');
                        
                        // Se for erro de throttling, aguarda 5 segundos antes de tentar
                        // Isso acontece em paralelo para as 3 tasks simultaneamente
                        if (isThrottlingError) {
                            imageFxResults.images[index] = {
                                ...img,
                                status: 'retrying',
                                error: 'Aguardando 5 segundos antes de tentar novamente (limite temporário)...'
                            };
                            renderImageFxOutput();
                            addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: aguardando 5s (throttling)...`);
                            await delay(5000);
                        }
                        
                        // Obtém o form atual para usar na função de retry
                        const currentForm = {
                            negativePrompt: document.getElementById('imagefx-negative-prompt')?.value.trim(),
                            aspectRatio: img.aspectRatio,
                            style: document.getElementById('imagefx-style')?.value,
                            numImages: parseInt(document.getElementById('imagefx-num-images')?.value, 10),
                            generationModel: document.getElementById('imagefx-model')?.value
                        };
                        const processFailedImageRetry = createProcessFailedImageRetry(currentForm);
                        addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: processando retry...`);
                        await processFailedImageRetry(img, index);
                        addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: retry concluído.`);
                    };

                    // Processa 3 por vez em paralelo (não sequencial!)
                    addToLog(`[Retry Paralelo] Processando ${retryTasks.length} imagens com erro (3 por vez em paralelo)...`);
                    await runTasksWithConcurrency(retryTasks, 3, processRetryTask);
                    addToLog(`[Retry Paralelo] Lote de 3 concluído.`);
                    
                    // Aguarda um pouco antes da próxima rodada de tentativas
                    await delay(2000);
                }
            }
        };
        mainContent.addEventListener('click', appState.mainContentClickListener);
    }

    // Helper to extract YouTube video ID - melhorado para suportar mais formatos
    const getYouTubeVideoId = (url) => {
        if (!url) return null;
        
        // Remove espaços e trim
        url = url.trim();
        
        // Padrões de URL do YouTube
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
            /youtu\.be\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
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
                                <div class="relative inline-block w-14 h-8">
                                    <input type="checkbox" id="maintenance-toggle" class="sr-only peer" ${appStatus.maintenance.is_on ? 'checked' : ''}>
                                    <div class="absolute inset-0 bg-gray-600 dark:bg-gray-700 rounded-full transition-colors duration-200 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                                    <div class="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 peer-checked:translate-x-6"></div>
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
            // Função para atualizar o estado visual do toggle
            const updateToggleVisual = () => {
                const toggleBg = maintenanceToggle.nextElementSibling;
                const toggleDot = toggleBg?.nextElementSibling;
                if (toggleBg && toggleDot) {
                    if (maintenanceToggle.checked) {
                        toggleBg.classList.remove('bg-gray-600', 'dark:bg-gray-700');
                        toggleBg.classList.add('bg-blue-600', 'dark:bg-blue-500');
                        toggleDot.classList.add('translate-x-6');
                    } else {
                        toggleBg.classList.remove('bg-blue-600', 'dark:bg-blue-500');
                        toggleBg.classList.add('bg-gray-600', 'dark:bg-gray-700');
                        toggleDot.classList.remove('translate-x-6');
                    }
                }
            };
            
            // Atualiza o estado visual inicial
            updateToggleVisual();
            
            // Atualiza quando o checkbox muda
            maintenanceToggle.addEventListener('change', () => {
                updateToggleVisual();
                maintenanceMessageInput.disabled = !maintenanceToggle.checked;
            });
            
            // Garante que o clique no label funcione
            const toggleLabel = maintenanceToggle.closest('label');
            if (toggleLabel) {
                toggleLabel.addEventListener('click', (e) => {
                    // Se clicou diretamente no checkbox, não faz nada (já vai mudar)
                    if (e.target === maintenanceToggle) return;
                    // Se clicou em outro lugar do label, alterna o checkbox
                    e.preventDefault();
                    maintenanceToggle.checked = !maintenanceToggle.checked;
                    maintenanceToggle.dispatchEvent(new Event('change'));
                });
            }
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
            const dontShowAgainCheckbox = document.getElementById('welcome-video-dont-show');
            
            // Reseta a flag quando o modal é fechado
            appState.isWelcomeVideoActive = false;
            
            // Verifica se o usuário marcou "não mostrar mais"
            if (dontShowAgainCheckbox && dontShowAgainCheckbox.checked) {
                localStorage.setItem('welcomeVideoDontShow', 'true');
                appState.welcomeVideoDontShow = true;
            }
            
            if (welcomeVideoIframe) {
                // Para o vídeo e limpa o src
                welcomeVideoIframe.src = '';
                try {
                    welcomeVideoIframe.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
                } catch (e) {
                    // Ignora erros de cross-origin
                }
            }
            if (welcomeVideoModal) welcomeVideoModal.style.display = 'none';
        });
        
        // Função para mostrar fallback quando o vídeo não carrega
        function showWelcomeVideoFallback() {
            const welcomeVideoModal = document.getElementById('welcome-video-modal');
            const welcomeVideoIframe = document.getElementById('welcome-video-iframe');
            const fallbackDiv = document.getElementById('welcome-video-fallback');
            const externalLink = document.getElementById('welcome-video-external-link');
            
            if (welcomeVideoIframe && fallbackDiv) {
                // Extrai o videoId do src atual
                const currentSrc = welcomeVideoIframe.src;
                const videoIdMatch = currentSrc.match(/embed\/([a-zA-Z0-9_-]{11})/);
                if (videoIdMatch && externalLink) {
                    externalLink.href = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
                }
                fallbackDiv.classList.remove('hidden');
            }
        }
        
        // Detectar erro no iframe do vídeo de boas-vindas usando YouTube API
        // Listener global para mensagens do YouTube Player API (erro 153)
        // Usa uma flag para rastrear se o vídeo de boas-vindas está ativo
        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://www.youtube.com') return;
            if (!appState.isWelcomeVideoActive) return; // Só processa se o vídeo de boas-vindas estiver ativo
            
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data && (data.event === 'onError' || data.errorCode === 153 || (data.info && data.info.includes('153')))) {
                    const welcomeVideoModal = document.getElementById('welcome-video-modal');
                    if (welcomeVideoModal && welcomeVideoModal.style.display === 'flex') {
                        showWelcomeVideoFallback();
                        appState.isWelcomeVideoActive = false; // Reseta a flag após mostrar fallback
                    }
                }
            } catch (e) {
                // Ignora erros de parsing
            }
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

            // Show welcome video sempre que entrar na Academy (exceto se marcou "não mostrar mais")
            if (appState.currentTab === 'academy' && !appState.welcomeVideoDontShow && appState.currentUser && appState.currentUser.role !== 'admin') {
                const appSettings = await apiRequest('/api/app-settings', 'GET');
                const welcomeVideoUrl = appSettings.welcomeVideoUrl;
                if (welcomeVideoUrl) {
                    const welcomeVideoModal = document.getElementById('welcome-video-modal');
                    const welcomeVideoIframe = document.getElementById('welcome-video-iframe');
                    if (welcomeVideoModal && welcomeVideoIframe) {
                        const videoId = getYouTubeVideoId(welcomeVideoUrl);
                        if (videoId) {
                            // Esconde o fallback inicialmente
                            const fallbackDiv = document.getElementById('welcome-video-fallback');
                            if (fallbackDiv) {
                                fallbackDiv.classList.add('hidden');
                            }
                            
                            // Marca que o vídeo de boas-vindas está ativo
                            appState.isWelcomeVideoActive = true;
                            
                            // Parâmetros mínimos para evitar erro 153 - removido origin e enablejsapi que podem causar problemas
                            const params = new URLSearchParams({
                                rel: 0,
                                modestbranding: 1
                            });
                            
                            // Limpa o src anterior antes de definir o novo
                            welcomeVideoIframe.src = '';
                            
                            // Aguarda um momento antes de definir o novo src
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            welcomeVideoIframe.src = `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
                            
                            // Mostra o modal ANTES de qualquer verificação de erro
                            welcomeVideoModal.style.display = 'flex';
                            
                            // Adiciona link externo caso o embed falhe
                            const externalLink = welcomeVideoModal.querySelector('#welcome-video-external-link');
                            if (externalLink) {
                                externalLink.href = `https://www.youtube.com/watch?v=${videoId}`;
                            }
                            
                            // Monitora erros do iframe apenas após o modal estar visível
                            let errorCheckTimeout = null;
                            welcomeVideoIframe.onload = () => {
                                // Aguarda 3 segundos antes de verificar erros (dá tempo para o vídeo carregar)
                                errorCheckTimeout = setTimeout(() => {
                                    // Se após 3 segundos o iframe ainda não carregou corretamente, pode ser erro
                                    // Mas não fazemos nada aqui, deixamos o listener global tratar
                                }, 3000);
                            };
                            
                            welcomeVideoIframe.onerror = () => {
                                if (errorCheckTimeout) clearTimeout(errorCheckTimeout);
                                appState.isWelcomeVideoActive = false;
                                showWelcomeVideoFallback();
                            };
                        } else {
                            addToLog(`URL do video de boas-vindas invalida: ${welcomeVideoUrl}`, true);
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
        // Hide all output sections initially (com verificações de existência)
        const originalScoresContainer = document.getElementById('reviewer-original-scores-container');
        const suggestionsOutput = document.getElementById('reviewer-suggestions-output');
        const improvementActionsContainer = document.getElementById('improvement-actions-container');
        const revisedScriptOutput = document.getElementById('reviewer-revised-script-output');
        const newScoresContainer = document.getElementById('reviewer-new-scores-container');
        const reviewerOutput = document.getElementById('reviewer-output');
        
        if (originalScoresContainer) originalScoresContainer.style.display = 'none';
        if (suggestionsOutput) suggestionsOutput.innerHTML = '';
        if (improvementActionsContainer) improvementActionsContainer.style.display = 'none';
        if (revisedScriptOutput) revisedScriptOutput.style.display = 'none';
        if (newScoresContainer) newScoresContainer.style.display = 'none';
        if (reviewerOutput) reviewerOutput.innerHTML = ''; // Clear any previous error messages
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

        // Limpar cache
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        const cacheFeedback = document.getElementById('cache-feedback');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
                if (!confirm('Tem certeza que deseja limpar o cache? Isso removerá todos os arquivos temporários de áudio e mídia.')) {
                    return;
                }

                clearCacheBtn.disabled = true;
                clearCacheBtn.textContent = 'Limpando...';
                if (cacheFeedback) {
                    cacheFeedback.textContent = 'Limpando cache...';
                    cacheFeedback.className = 'mt-2 text-sm text-gray-600 dark:text-gray-400';
                }

                try {
                    const response = await apiRequest('/api/clear-cache', 'POST');
                    if (response.success) {
                        if (cacheFeedback) {
                            cacheFeedback.textContent = response.message || 'Cache limpo com sucesso!';
                            cacheFeedback.className = 'mt-2 text-sm text-green-600 dark:text-green-400';
                        }
                        showSuccessToast(response.message || 'Cache limpo com sucesso!');
                    } else {
                        throw new Error(response.message || 'Erro ao limpar cache');
                    }
                } catch (error) {
                    console.error('Erro ao limpar cache:', error);
                    if (cacheFeedback) {
                        cacheFeedback.textContent = `Erro: ${error.message || 'Erro ao limpar cache'}`;
                        cacheFeedback.className = 'mt-2 text-sm text-red-600 dark:text-red-400';
                    }
                    showSuccessToast(`Erro ao limpar cache: ${error.message || 'Erro desconhecido'}`, true);
                } finally {
                    clearCacheBtn.disabled = false;
                    clearCacheBtn.textContent = 'Limpar Cache';
                }
            });
        }
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
                const CARACTERES_POR_BLOCO = 500; // Máximo absoluto: 500 caracteres
        
                function formatTime(totalSeconds) {
                    const h = Math.floor(totalSeconds / 3600);
                    const m = Math.floor((totalSeconds % 3600) / 60);
                    const s = Math.floor(totalSeconds % 60);
                    const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
                }
        
                // Função para detectar se uma palavra termina uma frase
                const isSentenceEnd = (word) => {
                    const trimmed = word.trim();
                    return /[.!?;:]$/.test(trimmed);
                };
                
                // Função para detectar se uma palavra tem pontuação intermediária (vírgula, dois pontos, etc)
                const hasIntermediatePunctuation = (word) => {
                    const trimmed = word.trim();
                    return /[,;:]$/.test(trimmed);
                };
        
                const words = texto.split(/\s+/).filter(Boolean);
                let srtContent = '';
                let subtitleIndex = 1;
                let currentTime = 0; // Tempo em segundos para o início do bloco
                let wordPointer = 0;
        
                while (wordPointer < words.length) {
                    let currentBlockWords = [];
                    let currentBlockChars = 0;
                    let tempWordPointer = wordPointer;
                    let bestBreakPoint = -1; // Índice da melhor posição para quebrar
                    let foundSentenceEnd = false;
        
                    // Tenta preencher o bloco até o máximo de palavras/caracteres
                    while (tempWordPointer < words.length) {
                        const word = words[tempWordPointer];
                        const potentialWordLength = word.length + (currentBlockWords.length > 0 ? 1 : 0); // +1 for space
        
                        // Verifica se adicionar a próxima palavra excederia o limite
                        // IMPORTANTE: Usar >= para garantir que nunca ultrapasse 500 caracteres
                        const wouldExceedLimit = (currentBlockChars + potentialWordLength) >= CARACTERES_POR_BLOCO || currentBlockWords.length >= PALAVRAS_MAX_BLOCO;
                        
                        // Se está próximo do limite, verifica se há um bom ponto de quebra
                        if (wouldExceedLimit || (currentBlockWords.length >= PALAVRAS_MIN_BLOCO && isSentenceEnd(word))) {
                            // Se encontrou fim de frase e já tem mínimo de palavras, quebra aqui
                            if (isSentenceEnd(word) && currentBlockWords.length >= PALAVRAS_MIN_BLOCO) {
                                currentBlockWords.push(word);
                                currentBlockChars += potentialWordLength;
                                tempWordPointer++;
                                foundSentenceEnd = true;
                                break;
                            }
                            
                            // Se está no limite e encontrou fim de frase, quebra aqui mesmo que tenha menos palavras
                            if (wouldExceedLimit && isSentenceEnd(word) && currentBlockWords.length > 0) {
                        currentBlockWords.push(word);
                        currentBlockChars += potentialWordLength;
                        tempWordPointer++;
                                foundSentenceEnd = true;
                                break;
                            }
                            
                            // Se está no limite e não encontrou fim de frase, marca o melhor ponto de quebra até agora
                            if (wouldExceedLimit) {
                                // Se já encontrou um fim de frase anterior, usa ele
                                if (bestBreakPoint > 0) {
                                    // Retrocede até o melhor ponto de quebra
                                    const wordsToKeep = currentBlockWords.slice(0, bestBreakPoint + 1);
                                    currentBlockWords = wordsToKeep;
                                    tempWordPointer = wordPointer + wordsToKeep.length;
                                    foundSentenceEnd = true;
                                    break;
                                }
                                // Se não encontrou fim de frase mas tem vírgula ou ponto e vírgula, quebra ali
                                if (bestBreakPoint === -1) {
                                    for (let i = currentBlockWords.length - 1; i >= Math.max(0, currentBlockWords.length - 10); i--) {
                                        if (hasIntermediatePunctuation(currentBlockWords[i])) {
                                            bestBreakPoint = i;
                                            break;
                                        }
                                    }
                                    if (bestBreakPoint > 0) {
                                        const wordsToKeep = currentBlockWords.slice(0, bestBreakPoint + 1);
                                        currentBlockWords = wordsToKeep;
                                        tempWordPointer = wordPointer + wordsToKeep.length;
                                        break;
                                    }
                                }
                                // Último recurso: quebra no limite mesmo
                                break;
                            }
                        }
        
                        // Adiciona a palavra ao bloco
                        currentBlockWords.push(word);
                        currentBlockChars += potentialWordLength;
                        
                        // Marca pontos de quebra ideais
                        if (isSentenceEnd(word)) {
                            bestBreakPoint = currentBlockWords.length - 1;
                            // Se já tem mínimo de palavras e encontrou fim de frase, pode quebrar
                            if (currentBlockWords.length >= PALAVRAS_MIN_BLOCO) {
                                tempWordPointer++;
                                foundSentenceEnd = true;
                                break;
                            }
                        } else if (hasIntermediatePunctuation(word) && bestBreakPoint === -1) {
                            // Marca vírgula/ponto e vírgula como ponto de quebra secundário
                            bestBreakPoint = currentBlockWords.length - 1;
                        }
                        
                        tempWordPointer++;
                    }
        
                    // Se o bloco resultante for menor que o mínimo e não encontrou fim de frase, tenta adicionar mais
                    if (currentBlockWords.length < PALAVRAS_MIN_BLOCO && !foundSentenceEnd && tempWordPointer < words.length) {
                        while (currentBlockWords.length < PALAVRAS_MIN_BLOCO && tempWordPointer < words.length) {
                            const word = words[tempWordPointer];
                            const potentialWordLength = word.length + (currentBlockWords.length > 0 ? 1 : 0);
        
                            // IMPORTANTE: Usar >= para garantir que nunca ultrapasse 500
                            if ((currentBlockChars + potentialWordLength) >= CARACTERES_POR_BLOCO || currentBlockWords.length >= PALAVRAS_MAX_BLOCO) {
                                // Se está no limite, verifica se pode quebrar em fim de frase anterior
                                if (bestBreakPoint > 0 && bestBreakPoint < currentBlockWords.length) {
                                    const wordsToKeep = currentBlockWords.slice(0, bestBreakPoint + 1);
                                    currentBlockWords = wordsToKeep;
                                    tempWordPointer = wordPointer + wordsToKeep.length;
                                break;
                            }
                                break;
                            }
                            
                            currentBlockWords.push(word);
                            currentBlockChars += potentialWordLength;
                            
                            // Se encontrou fim de frase, quebra aqui mesmo que não tenha atingido o mínimo
                            if (isSentenceEnd(word)) {
                            tempWordPointer++;
                                foundSentenceEnd = true;
                                break;
                            }
                            
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
        
                    let blockText = currentBlockWords.join(' ');
                    
                    // VALIDAÇÃO CRÍTICA: Garantir que o bloco nunca ultrapasse 500 caracteres
                    if (blockText.length > CARACTERES_POR_BLOCO) {
                        // Se ultrapassou, truncar no último espaço antes do limite
                        let truncatedText = blockText.substring(0, CARACTERES_POR_BLOCO);
                        const lastSpaceIndex = truncatedText.lastIndexOf(' ');
                        
                        if (lastSpaceIndex > 0) {
                            truncatedText = truncatedText.substring(0, lastSpaceIndex);
                        } else {
                            // Se não há espaço, truncar no limite mesmo
                            truncatedText = truncatedText.substring(0, CARACTERES_POR_BLOCO);
                        }
                        
                        blockText = truncatedText.trim();
                        
                        // Ajustar wordPointer para não perder palavras
                        const usedWords = blockText.split(/\s+/).filter(Boolean);
                        if (usedWords.length < currentBlockWords.length) {
                            tempWordPointer = wordPointer + usedWords.length;
                        }
                    }
                    
                    // Validação final: garantir que não passou do limite
                    if (blockText.length > CARACTERES_POR_BLOCO) {
                        blockText = blockText.substring(0, CARACTERES_POR_BLOCO).trim();
                    }
                    
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