
document.addEventListener('DOMContentLoaded', () => {
    'use strict';
    
    console.log('🚀 Iniciando DarkScript (versão modular)...');
    
    // ============================================================================
    // PROTEÇÃO: BLOQUEIO DO BOTÃO DIREITO DO MOUSE PARA USUÁRIOS NÃO-ADMIN
    // ============================================================================
    // Bloqueio inicial (será atualizado após login)
    let isUserAdmin = false;
    
    // Função para verificar e atualizar status de admin (global para ser acessível)
    window.updateAdminStatus = () => {
        isUserAdmin = window.appState?.currentUser?.role === 'admin';
        console.log(`🔒 Status de proteção: ${isUserAdmin ? 'DESBLOQUEADO (Admin)' : 'BLOQUEADO (Usuário comum)'}`);
    };
    
    const updateAdminStatus = window.updateAdminStatus;
    
    // Bloquear botão direito do mouse para não-admins
    document.addEventListener('contextmenu', (e) => {
        updateAdminStatus();
        if (!isUserAdmin) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);
    
    // Bloquear atalhos de teclado comuns para inspecionar (F12, Ctrl+Shift+I, Ctrl+U, etc)
    document.addEventListener('keydown', (e) => {
        updateAdminStatus();
        if (!isUserAdmin) {
            // F12 - DevTools
            if (e.key === 'F12') {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+I - DevTools
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+J - Console
            if (e.ctrlKey && e.shiftKey && e.key === 'J') {
                e.preventDefault();
                return false;
            }
            // Ctrl+U - View Source
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+C - Inspect Element
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                return false;
            }
        }
    }, true);
    
    // Bloquear seleção de texto para não-admins (opcional, mas ajuda na proteção)
    document.addEventListener('selectstart', (e) => {
        updateAdminStatus();
        if (!isUserAdmin) {
            e.preventDefault();
            return false;
        }
    }, true);
    
    // Atualizar status quando o usuário fizer login
    const originalCheckAuth = window.checkAuth;
    if (typeof originalCheckAuth === 'function') {
        // Será atualizado quando checkAuth for chamado
    }
    
    // ============================================================================
    // VARIÁVEIS GLOBAIS ESSENCIAIS
    // ============================================================================
    
    // Estado da aplicação
    window.appState = window.appState || {
        currentTab: null,
        currentUser: null,
        user: null,
        isAuthenticated: false,
        welcomeVideoDontShow: localStorage.getItem('welcomeVideoDontShow') === 'true',
        isWelcomeVideoActive: false,
        phraseInterval: null,
        progressInterval: null,
        toastTimeout: null,
        adminPanel: {
            active: { currentPage: 1, limit: 10 },
            pending: { currentPage: 1, limit: 10 },
            currentSearch: '',
            userStatusFilter: 'active' // Default filter for admin users
        },
        imageGenStatus: { active: false, current: 0, total: 0, message: '', cancelled: false },
        voiceGenStatus: { active: false, current: 0, total: 0, message: '' }
    };
    
    // Handlers (serão preenchidos pelos módulos)
    window.handlers = window.handlers || {};
    
    // Variáveis globais que os módulos podem precisar
    window.user = window.user || null;
    window.authToken = window.authToken || localStorage.getItem('authToken');
    
    // Resultados de roteiros gerados
    window.scriptResults = window.scriptResults || { fullResult: null, currentPage: 1, partsPerPage: 5 };
    
    // ============================================================================
    // FUNÇÕES UTILITÁRIAS BÁSICAS
    // ============================================================================
    
    // Função debounce (para delays em input)
    window.debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    };
    
    // Remove acentos (para prompts de IA)
    window.removeAccents = (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };
    
    // Escapa HTML (para segurança)
    window.escapeHTML = (str) => {
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
    };
    
    // Função para download seguro de arquivos
    window.safelyDownloadFile = (content, filename, mimeType = 'text/plain', successMessage = null) => {
        try {
            const blob = new Blob([content], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            if (successMessage && typeof window.showSuccessToast === 'function') {
                window.showSuccessToast(successMessage);
            }
        } catch (error) {
            console.error('Erro ao baixar arquivo:', error);
            if (typeof window.showSuccessToast === 'function') {
                window.showSuccessToast('Erro ao baixar arquivo. Tente novamente.', true);
            }
        }
    };
    
    // Inicializar imageFxResults globalmente
    window.imageFxResults = window.imageFxResults || { images: [], lastClearedImages: [], lastPrompt: '' };
    
    // Inicializar imageGenStatus no appState
    window.appState.imageGenStatus = window.appState.imageGenStatus || { active: false, current: 0, total: 0, message: '', cancelled: false };
    
    // Inicializar voiceGenStatus no appState
    window.appState.voiceGenStatus = window.appState.voiceGenStatus || { active: false, current: 0, total: 0, message: '' };
    
    // ============================================================================
    // FUNÇÕES DE RENDERIZAÇÃO DO GERADOR DE IMAGENS
    // ============================================================================
    
    /**
     * Renderiza o output do gerador de imagens - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - função renderImageFxOutput
     */
    window.renderImageFxOutput = function() {
        const output = document.getElementById('output');
        if (!output) return;
        const actionsContainer = document.getElementById('imagefx-actions');
        const restoreBtn = document.getElementById('restore-last-images-btn');
        const clearBtn = document.getElementById('clear-all-images-btn');
        const regenerateAllFailedBtn = document.getElementById('regenerate-all-failed-btn');

        const failedImagesCount = window.imageFxResults.images.filter(img => img.status === 'failed').length;

        if (window.imageFxResults.images.length === 0) {
            output.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhuma imagem foi gerada ainda.</p>';
            if(actionsContainer) actionsContainer.style.display = 'none';
        } else {
            output.innerHTML = `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${window.imageFxResults.images.map((img, index) => {
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
                            const errorMessage = window.escapeHTML(img.error);
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
                                            <textarea id="edit-prompt-${index}" class="w-full h-24 px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">${window.escapeHTML(img.prompt)}</textarea>
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
                                        <img src="${img.url}" alt="${window.escapeHTML(img.prompt)}" class="w-full h-full rounded-lg object-cover">
                                        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 gap-2">
                                            <button class="download-single-image-btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg" data-img-url="${img.url}" data-img-prompt="${window.escapeHTML(img.prompt)}" data-img-scene="${img.sceneNumber}">
                                                Baixar
                                            </button>
                                        </div>
                                    </div>
                                    <div class="flex flex-col gap-2 mt-2">
                                         <button class="toggle-prompt-btn text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600" data-img-index="${index}">
                                            Ver Prompt / Editar
                                        </button>
                                        <div id="edit-prompt-container-${index}" style="display:none;" class="mt-2 space-y-2">
                                            <textarea id="edit-prompt-${index}" class="w-full h-24 px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm">${window.escapeHTML(img.prompt)}</textarea>
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

        if (window.imageFxResults.images.length > 0) {
            if(clearBtn) clearBtn.style.display = 'block';
        } else {
            if(clearBtn) clearBtn.style.display = 'none';
        }

        if (window.imageFxResults.lastClearedImages.length > 0 && window.imageFxResults.images.length === 0) {
             if(restoreBtn) restoreBtn.style.display = 'block';
        } else {
             if(restoreBtn) restoreBtn.style.display = 'none';
        }

        // Botão removido - retry automático está ativo
        if (regenerateAllFailedBtn) regenerateAllFailedBtn.style.display = 'none';
        
        // Configurar event listeners para os botões criados dinamicamente
        setupImageGeneratorEventListeners();
    };
    
    /**
     * Renderiza o progresso da geração de imagens - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - função renderImageGenerationProgress
     */
    window.renderImageGenerationProgress = function(status) {
        let panel = document.getElementById('image-gen-progress-panel');
        if (!panel) return;

        if (!status || !status.active) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        const { current, total, message } = status;
        const progress = total > 0 ? Math.round((current / total) * 100) : 0;
        const isComplete = current === total;

        let title, titleColor, progressBarColor;
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
                <button class="float-right text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onclick="if(confirm('Deseja realmente cancelar a geração de imagens?')) { window.appState.imageGenStatus.active = false; window.appState.imageGenStatus.cancelled = true; document.getElementById('image-gen-progress-panel').style.display = 'none'; }">
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
    
    /**
     * Mostra modal de conclusão da geração de imagens - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - função showImageGenCompleteModal
     */
    window.showImageGenCompleteModal = function(durationInSeconds) {
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
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.onclick = () => modal.style.display = 'none';
        }
        
        if (viewBtn) {
            const newViewBtn = viewBtn.cloneNode(true);
            viewBtn.parentNode.replaceChild(newViewBtn, viewBtn);
            newViewBtn.onclick = () => {
                modal.style.display = 'none';
                // Apenas garantir que estamos na aba correta e fazer scroll
                // Não recriar a aba para não apagar as imagens
                if (window.appState.currentTab !== 'image-generator') {
                    // Se não estamos na aba correta, mudar para ela MAS preservar as imagens
                    // Salvando as imagens temporariamente
                    const savedImages = [...(window.imageFxResults?.images || [])];
                    window.appState.currentTab = 'image-generator';
                    window.showTab('image-generator');
                    // Restaurar as imagens após mostrar a aba
                    setTimeout(() => {
                        if (window.imageFxResults && savedImages.length > 0) {
                            window.imageFxResults.images = savedImages;
                        }
                        if (window.renderImageFxOutput) {
                            window.renderImageFxOutput();
                        }
                        const output = document.getElementById('output');
                        if (output) {
                            output.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 300);
                } else {
                    // Se já estamos na aba correta, apenas garantir que as imagens estão renderizadas e fazer scroll
                    if (window.renderImageFxOutput) {
                        window.renderImageFxOutput();
                    }
                    setTimeout(() => {
                        const output = document.getElementById('output');
                        if (output) {
                            output.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 100);
                }
            };
        }
    };
    
    /**
     * Mostra modal de conclusão do gerador de voz - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - função showVoiceGenCompleteModal
     */
    window.showVoiceGenCompleteModal = function(downloadUrl, partDownloads = []) {
        const modal = document.getElementById('voice-gen-complete-modal');
        if (!modal) return;

        const downloadBtn = document.getElementById('download-voice-gen-btn');
        const closeBtn = document.getElementById('close-voice-gen-modal-btn');

        // Configurar botão de download
        if (downloadBtn) {
            if (downloadUrl) {
                // Obter token de autenticação
                const token = localStorage.getItem('authToken');
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                
                // Detectar extensão do arquivo pela URL
                const urlExt = downloadUrl.split('.').pop().toLowerCase();
                const fileName = urlExt === 'wav' ? 'narracao_darkscript.wav' : 'narracao_darkscript.mp3';
                
                // Sempre mostrar o botão e tentar download diretamente (sem verificação HEAD)
                // A verificação será feita no momento do download
                downloadBtn.style.display = 'block';
                downloadBtn.download = fileName;
                
                // Remover onclick anterior se existir
                downloadBtn.onclick = null;
                
                // Configurar novo onclick com autenticação e retry
                downloadBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('🔄 Iniciando download de:', downloadUrl);
                    
                    // Função de download com retry
                    const attemptDownload = (retryCount = 0) => {
                        const maxRetries = 3;
                        const retryDelay = 2000;
                        
                        fetch(downloadUrl, {
                            headers: headers,
                            credentials: 'include'
                        })
                            .then(res => {
                                if (!res.ok) {
                                    if ((res.status === 404 || res.status === 401) && retryCount < maxRetries) {
                                        // Arquivo ainda não existe ou não autorizado, tentar novamente
                                        console.log(`⏳ Arquivo ainda não disponível ou não autorizado (tentativa ${retryCount + 1}/${maxRetries}), aguardando...`);
                                        if (window.showSuccessToast) {
                                            window.showSuccessToast(`Aguardando arquivo... (${retryCount + 1}/${maxRetries})`, false);
                                        }
                                        setTimeout(() => attemptDownload(retryCount + 1), retryDelay);
                                        return;
                                    }
                                    if (res.status === 401) {
                                        throw new Error('Não autorizado. Por favor, faça login novamente.');
                                    }
                                    throw new Error(`Erro ${res.status}: ${res.statusText}`);
                                }
                                return res.blob();
                            })
                            .then(blob => {
                                if (!blob) return; // Retry em andamento
                                
                                console.log('✅ Arquivo baixado com sucesso, tamanho:', blob.size, 'bytes');
                                
                                if (blob.size === 0) {
                                    throw new Error('Arquivo vazio recebido do servidor');
                                }
                                
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                
                                // Limpar após um delay
                                setTimeout(() => {
                                    window.URL.revokeObjectURL(url);
                                    document.body.removeChild(a);
                                }, 100);
                                
                                if (window.showSuccessToast) {
                                    window.showSuccessToast('Download iniciado!');
                                }
                            })
                            .catch(err => {
                                if (err.message.includes('404') && retryCount < maxRetries) {
                                    // Tentar novamente
                                    console.log(`⏳ Erro 404 (tentativa ${retryCount + 1}/${maxRetries}), aguardando...`);
                                    setTimeout(() => attemptDownload(retryCount + 1), retryDelay);
                                } else {
                                    console.error('❌ Erro ao baixar arquivo:', err);
                                    if (window.showSuccessToast) {
                                        window.showSuccessToast(`Erro ao baixar arquivo: ${err.message}`, true);
                                    }
                                }
                            });
                    };
                    
                    // Iniciar download
                    attemptDownload();
                };
            } else if (partDownloads && partDownloads.length > 0) {
                // Se houver partes disponíveis, configurar para baixar a primeira parte
                const firstPart = partDownloads[0];
                if (firstPart && firstPart.downloadUrl) {
                    const token = localStorage.getItem('authToken');
                    const headers = {};
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                    
                    // Sempre mostrar o botão e tentar download diretamente (sem verificação HEAD)
                    downloadBtn.style.display = 'block';
                    downloadBtn.download = `narracao_parte_${firstPart.partNumber || 1}.mp3`;
                    
                    // Configurar download com autenticação e retry
                    downloadBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const attemptDownload = (retryCount = 0) => {
                            const maxRetries = 3;
                            const retryDelay = 2000;
                            
                            fetch(firstPart.downloadUrl, {
                                headers: headers,
                                credentials: 'include'
                            })
                                .then(res => {
                                    if (!res.ok) {
                                        if ((res.status === 404 || res.status === 401) && retryCount < maxRetries) {
                                            console.log(`⏳ Arquivo ainda não disponível (tentativa ${retryCount + 1}/${maxRetries}), aguardando...`);
                                            if (window.showSuccessToast) {
                                                window.showSuccessToast(`Aguardando arquivo... (${retryCount + 1}/${maxRetries})`, false);
                                            }
                                            setTimeout(() => attemptDownload(retryCount + 1), retryDelay);
                                            return;
                                        }
                                        if (res.status === 401) {
                                            throw new Error('Não autorizado. Por favor, faça login novamente.');
                                        }
                                        throw new Error(`Erro ${res.status}: ${res.statusText}`);
                                    }
                                    return res.blob();
                                })
                                .then(blob => {
                                    if (!blob) return; // Retry em andamento
                                    
                                    if (blob.size === 0) {
                                        throw new Error('Arquivo vazio recebido do servidor');
                                    }
                                    
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `narracao_parte_${firstPart.partNumber || 1}.mp3`;
                                    document.body.appendChild(a);
                                    a.click();
                                    
                                    setTimeout(() => {
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                    }, 100);
                                    
                                    if (window.showSuccessToast) {
                                        window.showSuccessToast('Download iniciado!');
                                    }
                                })
                                .catch(err => {
                                    if (err.message.includes('404') || err.message.includes('401')) {
                                        if (retryCount < maxRetries) {
                                            setTimeout(() => attemptDownload(retryCount + 1), retryDelay);
                                        } else {
                                            console.error('❌ Erro ao baixar parte após todas as tentativas:', err);
                                            if (window.showSuccessToast) {
                                                window.showSuccessToast(`Erro ao baixar parte: ${err.message}`, true);
                                            }
                                        }
                                    } else {
                                        console.error('❌ Erro ao baixar parte:', err);
                                        if (window.showSuccessToast) {
                                            window.showSuccessToast(`Erro ao baixar parte: ${err.message}`, true);
                                        }
                                    }
                                });
                        };
                        
                        // Iniciar download
                        attemptDownload();
                    };
                } else {
                    downloadBtn.style.display = 'none';
                }
            } else {
                downloadBtn.style.display = 'none';
            }
        }

        modal.style.display = 'flex';

        // Clone and replace to remove old listeners
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.onclick = () => modal.style.display = 'none';
        }
    };
    
    /**
     * Configura event listeners para os botões do gerador de imagens
     */
    function setupImageGeneratorEventListeners() {
        // Toggle prompt (ver/editar prompt)
        document.querySelectorAll('.toggle-prompt-btn').forEach(btn => {
            if (btn.dataset.listenerAdded) return;
            btn.dataset.listenerAdded = 'true';
            btn.addEventListener('click', (e) => {
                const imgIndex = e.target.closest('.toggle-prompt-btn').dataset.imgIndex;
                const container = document.getElementById(`edit-prompt-container-${imgIndex}`);
                if (container) {
                    container.style.display = container.style.display === 'none' ? 'block' : 'none';
                }
            });
        });
        
        // Download single image
        document.querySelectorAll('.download-single-image-btn').forEach(btn => {
            if (btn.dataset.listenerAdded) return;
            btn.dataset.listenerAdded = 'true';
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const imgUrl = btn.dataset.imgUrl;
                const imgPrompt = btn.dataset.imgPrompt;
                const sceneNumber = btn.dataset.imgScene;
                
                try {
                    // Verificar se é data URL (base64) - não pode usar fetch devido ao CSP
                    const isDataUrl = imgUrl.startsWith('data:image/');
                    
                    if (isDataUrl) {
                        // Para data URLs, converter diretamente para blob
                        const response = await fetch(imgUrl);
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = `cena_${sceneNumber}_darkscript.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(blobUrl);
                        window.showSuccessToast(`Imagem da Cena ${sceneNumber} baixada com sucesso!`);
                    } else {
                        // Verificar se é URL externa (ImageFX) ou URL local
                        const isExternalUrl = imgUrl.startsWith('http://') || imgUrl.startsWith('https://');
                        
                        let response;
                        if (isExternalUrl) {
                            // Para URLs externas (ImageFX), fazer download direto sem autenticação
                            response = await fetch(imgUrl, {
                                mode: 'cors',
                                credentials: 'omit'
                            });
                        } else {
                            // Para URLs locais, usar autenticação
                            const token = localStorage.getItem('authToken');
                            response = await fetch(imgUrl, {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                        }
                        
                        if (!response.ok) {
                            throw new Error(`Erro ao baixar imagem: ${response.status} ${response.statusText}`);
                        }
                        
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = `cena_${sceneNumber}_darkscript.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(blobUrl);
                        window.showSuccessToast(`Imagem da Cena ${sceneNumber} baixada com sucesso!`);
                    }
                } catch (error) {
                    console.error('Erro ao baixar imagem:', error);
                    
                    // Fallback: tentar download direto via link (sem fetch)
                    try {
                        // Converter data URL para blob se necessário
                        if (imgUrl.startsWith('data:image/')) {
                            // Extrair base64 e tipo MIME
                            const matches = imgUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
                            if (matches) {
                                const mimeType = matches[1];
                                const base64Data = matches[2];
                                const byteCharacters = atob(base64Data);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);
                                const blob = new Blob([byteArray], { type: `image/${mimeType}` });
                                const blobUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = `cena_${sceneNumber}_darkscript.jpg`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(blobUrl);
                                window.showSuccessToast(`Imagem da Cena ${sceneNumber} baixada com sucesso!`);
                                return;
                            }
                        }
                        
                        // Fallback final: abrir em nova aba
                        const a = document.createElement('a');
                        a.href = imgUrl;
                        a.download = `cena_${sceneNumber}_darkscript.jpg`;
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.showSuccessToast(`Tentando download alternativo...`);
                    } catch (fallbackError) {
                        console.error('Erro no fallback de download:', fallbackError);
                        window.showSuccessToast(`Erro ao baixar imagem. Tente clicar com o botão direito e "Salvar imagem como".`, true);
                    }
                }
            });
        });
        
        // Regenerate image
        document.querySelectorAll('.regenerate-image-btn').forEach(btn => {
            if (btn.dataset.listenerAdded) return;
            btn.dataset.listenerAdded = 'true';
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const imgIndex = parseInt(btn.dataset.imgIndex);
                const sceneNumber = parseInt(btn.dataset.sceneNumber);
                const aspectRatio = btn.dataset.imgAspectRatio;
                const promptTextarea = document.getElementById(`edit-prompt-${imgIndex}`);
                const newPrompt = promptTextarea ? promptTextarea.value.trim() : null;
                
                if (!newPrompt) {
                    window.showSuccessToast('Por favor, insira um prompt válido.', true);
                    return;
                }
                
                const handler = window.handlers['generate-imagefx'];
                if (handler && typeof handler === 'function') {
                    await handler([newPrompt], true, imgIndex, aspectRatio);
                }
            });
        });
        
        // Image select checkbox
        document.querySelectorAll('.image-select-checkbox').forEach(checkbox => {
            if (checkbox.dataset.listenerAdded) return;
            checkbox.dataset.listenerAdded = 'true';
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
        
        // Lightbox trigger
        document.querySelectorAll('.lightbox-trigger').forEach(trigger => {
            if (trigger.dataset.listenerAdded) return;
            trigger.dataset.listenerAdded = 'true';
            trigger.addEventListener('click', (e) => {
                if (e.target.closest('.download-single-image-btn') || e.target.closest('.image-select-checkbox')) {
                    return;
                }
                const imgIndex = trigger.dataset.imgIndex;
                const img = window.imageFxResults.images[imgIndex];
                if (img && img.url && img.status === 'success') {
                    window.showLightboxImage(img.url, img.prompt);
                }
            });
        });
    }
    
    // Event listeners para botões do gerador de imagens (delegation)
    document.addEventListener('click', (e) => {
        // Selecionar tudo
        if (e.target.id === 'select-all-images-btn' || e.target.closest('#select-all-images-btn')) {
            e.preventDefault();
            document.querySelectorAll('.image-select-checkbox').forEach(checkbox => {
                checkbox.checked = true;
            });
            return;
        }
        
        // Baixar selecionadas
        if (e.target.id === 'download-selected-images-btn' || e.target.closest('#download-selected-images-btn')) {
            e.preventDefault();
            const selectedCheckboxes = Array.from(document.querySelectorAll('.image-select-checkbox:checked'));
            if (selectedCheckboxes.length === 0) {
                window.showSuccessToast('Nenhuma imagem selecionada.', true);
                return;
            }
            
            selectedCheckboxes.forEach(async (checkbox, index) => {
                const imgIndex = parseInt(checkbox.dataset.imgIndex);
                const img = window.imageFxResults.images[imgIndex];
                if (img && img.url && img.status === 'success') {
                    setTimeout(async () => {
                        try {
                            // Verificar se é data URL (base64) - não pode usar fetch devido ao CSP
                            const isDataUrl = img.url.startsWith('data:image/');
                            
                            if (isDataUrl) {
                                // Converter data URL diretamente para blob
                                const matches = img.url.match(/^data:image\/([^;]+);base64,(.+)$/);
                                if (matches) {
                                    const mimeType = matches[1];
                                    const base64Data = matches[2];
                                    const byteCharacters = atob(base64Data);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    const blob = new Blob([byteArray], { type: `image/${mimeType}` });
                                    const blobUrl = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = blobUrl;
                                    a.download = `cena_${img.sceneNumber}_darkscript.jpg`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    window.URL.revokeObjectURL(blobUrl);
                                }
                            } else {
                                // Verificar se é URL externa (ImageFX) ou URL local
                                const isExternalUrl = img.url.startsWith('http://') || img.url.startsWith('https://');
                                
                                let response;
                                if (isExternalUrl) {
                                    // Para URLs externas (ImageFX), fazer download direto sem autenticação
                                    response = await fetch(img.url, {
                                        mode: 'cors',
                                        credentials: 'omit'
                                    });
                                } else {
                                    // Para URLs locais, usar autenticação
                                    const token = localStorage.getItem('authToken');
                                    response = await fetch(img.url, {
                                        headers: {
                                            'Authorization': `Bearer ${token}`
                                        }
                                    });
                                }
                                
                                if (!response.ok) {
                                    throw new Error(`Erro ao baixar imagem: ${response.status} ${response.statusText}`);
                                }
                                
                                const blob = await response.blob();
                                const blobUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = `cena_${img.sceneNumber}_darkscript.jpg`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(blobUrl);
                            }
                        } catch (error) {
                            console.error(`Erro ao baixar imagem ${imgIndex}:`, error);
                            // Fallback: tentar download direto via link
                            try {
                                const a = document.createElement('a');
                                a.href = img.url;
                                a.download = `cena_${img.sceneNumber}_darkscript.jpg`;
                                a.target = '_blank';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            } catch (fallbackError) {
                                console.error('Erro no fallback de download:', fallbackError);
                            }
                        }
                    }, index * 200); // Delay para evitar bloqueio do navegador
                }
            });
            return;
        }
        
        // Limpar imagens
        if (e.target.id === 'clear-all-images-btn' || e.target.closest('#clear-all-images-btn')) {
            e.preventDefault();
            if (confirm('Tem certeza de que deseja limpar todas as imagens geradas?')) {
                window.imageFxResults.lastClearedImages = [...window.imageFxResults.images];
                window.imageFxResults.images = [];
                window.renderImageFxOutput();
                window.showSuccessToast('Imagens limpas com sucesso!');
            }
            return;
        }
        
        // Restaurar últimas imagens
        if (e.target.id === 'restore-last-images-btn' || e.target.closest('#restore-last-images-btn')) {
            e.preventDefault();
            if (window.imageFxResults.lastClearedImages.length > 0) {
                window.imageFxResults.images = [...window.imageFxResults.lastClearedImages];
                window.imageFxResults.lastClearedImages = [];
                window.renderImageFxOutput();
                window.showSuccessToast('Últimas imagens restauradas!');
            }
            return;
        }
        
        // Importar último prompt
        if (e.target.id === 'import-last-image-prompt' || e.target.closest('#import-last-image-prompt')) {
            e.preventDefault();
            const promptInput = document.getElementById('imagefx-prompt');
            if (promptInput && window.imageFxResults.lastPrompt) {
                promptInput.value = window.imageFxResults.lastPrompt;
                window.showSuccessToast('Último prompt importado!');
            } else {
                window.showSuccessToast('Nenhum prompt anterior encontrado.', true);
            }
            return;
        }
        
        // Importar último roteiro gerado - Revisor de Roteiro
        if (e.target.id === 'import-last-script-reviewer' || e.target.closest('#import-last-script-reviewer')) {
            e.preventDefault();
            const history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
            if (history.length > 0) {
                const lastScript = history[0];
                
                // Verificar diferentes formatos de dados
                let fullScript = '';
                
                if (lastScript.data) {
                    // Formato novo: script_parts com part_content
                    if (lastScript.data.script_parts && Array.isArray(lastScript.data.script_parts)) {
                        fullScript = lastScript.data.script_parts.map((part, idx) => {
                            const content = part.part_content || part.text || part.content || '';
                            return content ? `Parte ${idx + 1}:\n${content}` : '';
                        }).filter(Boolean).join('\n\n');
                    }
                    // Formato alternativo: full_script_text
                    else if (lastScript.data.full_script_text) {
                        fullScript = lastScript.data.full_script_text;
                    }
                    // Formato legado: script_parts com text
                    else if (lastScript.data.script_parts) {
                        fullScript = lastScript.data.script_parts.map((part, idx) => {
                            return `Parte ${idx + 1}:\n${part.text || part.content || ''}`;
                        }).join('\n\n');
                    }
                }
                
                const reviewerInput = document.getElementById('reviewer-input-text');
                if (reviewerInput) {
                    if (fullScript.trim()) {
                        reviewerInput.value = fullScript.trim();
                        window.showSuccessToast(`Último roteiro importado! (${lastScript.data?.script_parts?.length || 0} partes)`);
                    } else {
                        window.showSuccessToast('Roteiro encontrado mas está vazio. Tente gerar um novo roteiro primeiro.', true);
                    }
                } else {
                    window.showSuccessToast('Campo de entrada não encontrado.', true);
                }
            } else {
                window.showSuccessToast('Nenhum roteiro encontrado no histórico.', true);
            }
            return;
        }
        
        // Importar último roteiro gerado - Tradutor
        if (e.target.id === 'import-last-script-for-translator' || e.target.closest('#import-last-script-for-translator')) {
            e.preventDefault();
            const history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
            if (history.length > 0) {
                const lastScript = history[0];
                
                // Verificar diferentes formatos de dados
                let fullScript = '';
                
                if (lastScript.data) {
                    // Formato novo: script_parts com part_content
                    if (lastScript.data.script_parts && Array.isArray(lastScript.data.script_parts)) {
                        fullScript = lastScript.data.script_parts.map((part, idx) => {
                            const content = part.part_content || part.text || part.content || '';
                            return content ? `Parte ${idx + 1}:\n${content}` : '';
                        }).filter(Boolean).join('\n\n');
                    }
                    // Formato alternativo: full_script_text
                    else if (lastScript.data.full_script_text) {
                        fullScript = lastScript.data.full_script_text;
                    }
                    // Formato legado: script_parts com text
                    else if (lastScript.data.script_parts) {
                        fullScript = lastScript.data.script_parts.map((part, idx) => {
                            return `Parte ${idx + 1}:\n${part.text || part.content || ''}`;
                        }).join('\n\n');
                    }
                }
                
                const translatorInput = document.getElementById('translator-input-text');
                if (translatorInput) {
                    if (fullScript.trim()) {
                        translatorInput.value = fullScript.trim();
                        const partsCount = lastScript.data?.script_parts?.length || 0;
                        window.showSuccessToast(`Último roteiro importado! (${partsCount} partes)`);
                    } else {
                        window.showSuccessToast('Roteiro encontrado mas está vazio. Tente gerar um novo roteiro primeiro.', true);
                    }
                } else {
                    window.showSuccessToast('Campo de entrada não encontrado.', true);
                }
            } else {
                window.showSuccessToast('Nenhum roteiro encontrado no histórico.', true);
            }
            return;
        }
        
        // Importar último roteiro gerado - Prompts para Cenas
        if (e.target.id === 'import-last-script-for-scenes' || e.target.closest('#import-last-script-for-scenes')) {
            e.preventDefault();
            const history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
            if (history.length > 0) {
                const lastScript = history[0];
                // Para prompts de cena, usar apenas o texto limpo sem numeração de partes
                const fullScript = lastScript.data.script_parts?.map((part) => {
                    return part.text || part.part_content || '';
                }).join('\n\n') || '';
                
                const sceneInput = document.getElementById('scene-text');
                if (sceneInput) {
                    sceneInput.value = fullScript.trim();
                    window.showSuccessToast('Último roteiro importado!');
                    
                    // Atualizar contador de palavras se existir
                    if (sceneInput.value.trim()) {
                        const wordCount = sceneInput.value.trim().split(/\s+/).filter(Boolean).length;
                        const wordCounter = document.getElementById('scene-word-counter');
                        if (wordCounter) {
                            wordCounter.textContent = `${wordCount} palavras`;
                        }
                    }
                } else {
                    window.showSuccessToast('Campo de entrada não encontrado.', true);
                }
            } else {
                window.showSuccessToast('Nenhum roteiro encontrado no histórico.', true);
            }
            return;
        }
        
        // Importar último roteiro gerado - Gerador de Voz
        if (e.target.id === 'tts-import-last-script' || e.target.closest('#tts-import-last-script')) {
            e.preventDefault();
            const history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
            if (history.length > 0) {
                const lastScript = history[0];
                let fullScript = '';
                
                // Verificar diferentes formatos de dados
                if (lastScript.data) {
                    // Formato novo: script_parts com part_content
                    if (lastScript.data.script_parts && Array.isArray(lastScript.data.script_parts)) {
                        fullScript = lastScript.data.script_parts.map((part, idx) => {
                            const content = part.part_content || part.text || part.content || '';
                            return content ? `Parte ${idx + 1}:\n${content}` : '';
                        }).filter(Boolean).join('\n\n');
                    }
                    // Formato alternativo: full_script_text
                    else if (lastScript.data.full_script_text) {
                        fullScript = lastScript.data.full_script_text;
                    }
                    // Formato legado: script_parts com text
                    else if (lastScript.data.script_parts) {
                        fullScript = lastScript.data.script_parts.map((part) => {
                            return part.text || part.content || '';
                        }).join('\n\n');
                    }
                }
                
                const ttsInput = document.getElementById('tts-script-input');
                if (ttsInput && fullScript.trim()) {
                    ttsInput.value = fullScript.trim();
                    
                    // Disparar evento input para calcular duração automaticamente
                    ttsInput.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    window.showSuccessToast('Último roteiro importado!');
                } else if (!ttsInput) {
                    window.showSuccessToast('Campo de entrada não encontrado.', true);
                } else {
                    window.showSuccessToast('Nenhum roteiro encontrado no histórico.', true);
                }
            } else {
                window.showSuccessToast('Nenhum roteiro encontrado no histórico.', true);
            }
            return;
        }
        
        // Importar último resultado - Guia de Edição
        if (e.target.id === 'import-last-results-btn' || e.target.closest('#import-last-results-btn')) {
            e.preventDefault();
            const scriptHistory = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
            const sceneHistory = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');
            
            let imported = false;
            let importedScript = false;
            let importedPrompts = false;
            
            // Importar último roteiro
            if (scriptHistory.length > 0) {
                const lastScript = scriptHistory[0];
                
                // Verificar diferentes formatos de dados
                let fullScript = '';
                
                if (lastScript.data) {
                    // Formato novo: script_parts com part_content
                    if (lastScript.data.script_parts && Array.isArray(lastScript.data.script_parts)) {
                        fullScript = lastScript.data.script_parts.map((part, idx) => {
                            const content = part.part_content || part.text || part.content || '';
                            return content || '';
                        }).filter(Boolean).join('\n\n');
                    }
                    // Formato alternativo: full_script_text
                    else if (lastScript.data.full_script_text) {
                        fullScript = lastScript.data.full_script_text;
                    }
                    // Formato legado: script_parts com text
                    else if (lastScript.data.script_parts) {
                        fullScript = lastScript.data.script_parts.map((part) => {
                            return part.text || part.content || '';
                        }).join('\n\n');
                    }
                }
                
                // Procurar campo de entrada do guia de edição
                const editorsCutInput = document.getElementById('editors-cut-script-input') || 
                                       document.getElementById('editors-cut-input-text') ||
                                       document.querySelector('textarea[id*="editors-cut"][id*="script"], textarea[id*="editors-cut"][id*="input"]');
                
                if (editorsCutInput && fullScript.trim()) {
                    editorsCutInput.value = fullScript.trim();
                    importedScript = true;
                    imported = true;
                }
            }
            
            // Importar últimos prompts de cena
            if (sceneHistory.length > 0) {
                const lastScene = sceneHistory[0];
                let scenePrompts = '';
                
                if (lastScene.data) {
                    // Verificar diferentes formatos
                    if (Array.isArray(lastScene.data)) {
                        scenePrompts = lastScene.data.map(scene => {
                            if (typeof scene === 'string') return scene;
                            return scene.prompt || scene.text || scene.description || '';
                        }).filter(Boolean).join('\n');
                    } else if (lastScene.data.prompts && Array.isArray(lastScene.data.prompts)) {
                        scenePrompts = lastScene.data.prompts.map(scene => {
                            if (typeof scene === 'string') return scene;
                            return scene.prompt || scene.text || scene.description || '';
                        }).filter(Boolean).join('\n');
                    } else if (lastScene.data.scenes && Array.isArray(lastScene.data.scenes)) {
                        scenePrompts = lastScene.data.scenes.map(scene => {
                            if (typeof scene === 'string') return scene;
                            return scene.prompt || scene.text || scene.description || '';
                        }).filter(Boolean).join('\n');
                    } else if (typeof lastScene.data === 'string') {
                        scenePrompts = lastScene.data;
                    }
                }
                
                // Procurar campo de prompts
                const editorsCutPromptsInput = document.getElementById('editors-cut-prompts-input') ||
                                               document.querySelector('textarea[id*="editors-cut"][id*="prompt"]');
                
                if (editorsCutPromptsInput && scenePrompts.trim()) {
                    editorsCutPromptsInput.value = scenePrompts.trim();
                    importedPrompts = true;
                    imported = true;
                }
            }
            
            // Mensagem de sucesso baseada no que foi importado
            if (imported) {
                const parts = [];
                if (importedScript) parts.push('roteiro');
                if (importedPrompts) parts.push('prompts');
                window.showSuccessToast(`Último ${parts.join(' e ')} importado${parts.length > 1 ? 's' : ''}!`);
            } else {
                window.showSuccessToast('Nenhum resultado encontrado no histórico.', true);
            }
            return;
        }
    });
    
    // Gera pontuação aleatória
    window.generateRandomScore = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };
    
    // Cria botão de copiar
    window.createCopyButton = (text, className = '') => {
        const escapedText = (text || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return `<button class="${className} copy-btn" data-text="${escapedText}" title="Copiar">📋</button>`;
    };
    
    // Renderiza score card - CÓDIGO COMPLETO DO ORIGINAL (igual à imagem)
    window.renderScoreCard = (title, mainScore, subScores = {}, suggestion = '') => {
        const intMainScore = Math.round(mainScore || 0);
        
        // Função auxiliar para cor da barra de progresso baseada na pontuação
        const getScoreColor = (score) => {
            if (score >= 85) return 'bg-green-500';
            if (score >= 70) return 'bg-blue-500';
            if (score >= 50) return 'bg-yellow-500';
            return 'bg-red-500';
        };
        
        // Função auxiliar para cor do texto da pontuação principal
        const getScoreTextColor = (score) => {
            if (score >= 85) return 'text-green-600 dark:text-green-400';
            if (score >= 70) return 'text-blue-600 dark:text-blue-400';
            if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
            return 'text-red-600 dark:text-red-400';
        };
        
        const subScoresHtml = Object.entries(subScores).map(([key, value]) => {
            const cappedValue = Math.min(100, Math.round(value || 0));
            return `<div class="mb-2">
                        <div class="flex justify-between items-center text-sm mb-1 gap-2">
                            <span class="text-gray-500 dark:text-gray-400 truncate" title="${key}">${key}</span>
                            <span class="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">${cappedValue}/100</span>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5"><div class="h-1.5 rounded-full ${getScoreColor(cappedValue)}" style="width: ${cappedValue}%;"></div></div>
                    </div>`;
        }).join('');
        
        const suggestionHtml = suggestion ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"><strong class="text-gray-900 dark:text-gray-100">Virada de Chave:</strong> ${suggestion}</p>` : '';
        
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
    
    // ============================================================================
    // FUNÇÕES DE UI BÁSICAS
    // ============================================================================
    
    // Mostra toast de sucesso (notificações pequenas no canto)
    window.showSuccessToast = (message, isError = false) => {
        // Criar ou encontrar container de toasts
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'fixed top-4 right-4 z-[10000] space-y-2 max-w-md';
            document.body.appendChild(toastContainer);
        }
        
        // Limitar tamanho da mensagem e quebrar linhas se necessário
        let displayMessage = message;
        const maxLength = 120; // Limite de caracteres por linha
        if (message.length > maxLength) {
            // Quebrar em linhas menores
            const words = message.split(' ');
            let lines = [];
            let currentLine = '';
            
            for (const word of words) {
                if ((currentLine + ' ' + word).length <= maxLength) {
                    currentLine = currentLine ? currentLine + ' ' + word : word;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            
            displayMessage = lines.join('<br>');
        }
        
        const toast = document.createElement('div');
        toast.className = `px-4 py-3 rounded-lg shadow-xl border max-w-md ${isError ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300' : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'} transition-all duration-300 ease-out break-words`;
        
        // Ícone baseado no tipo
        const iconHtml = isError 
            ? '<svg class="w-5 h-5 inline-block mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
            : '<svg class="w-5 h-5 inline-block mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        
        toast.innerHTML = `${iconHtml}<span class="break-words">${displayMessage}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Remover após 6 segundos (mais tempo para mensagens longas)
        const displayTime = message.length > maxLength ? 6000 : 4000;
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, displayTime);
    };
    
    // Mostra modal de confirmação centralizado e profissional
    window.showConfirmationModal = (title, message, onConfirm, options = {}) => {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmation-modal');
            const titleEl = document.getElementById('confirmation-title');
            const messageEl = document.getElementById('confirmation-message');
            const confirmBtn = document.getElementById('confirm-btn');
            const cancelBtn = document.getElementById('cancel-btn');
            
            if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
                console.error('❌ Elementos do modal de confirmação não encontrados');
                // Fallback para confirm nativo
                if (confirm(`${title}\n\n${message}`)) {
                    if (onConfirm && typeof onConfirm === 'function') {
                        onConfirm();
                    }
                    resolve(true);
                } else {
                    resolve(false);
                }
                return;
            }
            
            // Limpar event listeners anteriores
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            // Configurar conteúdo
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            // Função para fechar o modal
            const closeModal = (confirmed = false) => {
                modal.style.display = 'none';
                resolve(confirmed);
            };
            
            // Event listener para confirmar
            newConfirmBtn.addEventListener('click', async () => {
                if (onConfirm && typeof onConfirm === 'function') {
                    try {
                        await onConfirm();
                    } catch (error) {
                        console.error('Erro ao executar callback de confirmação:', error);
                        window.showSuccessToast(`Erro: ${error.message}`, true);
                    }
                }
                closeModal(true);
            });
            
            // Event listener para cancelar
            newCancelBtn.addEventListener('click', () => {
                closeModal(false);
            });
            
            // Fechar ao clicar fora do modal
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal(false);
                }
            });
            
            // ESC key para fechar
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal(false);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
            
            // Mostrar modal
            modal.style.display = 'flex';
        });
    };
    
    // Função auxiliar para esconder modal de confirmação
    window.hideConfirmationModal = () => {
        const modal = document.getElementById('confirmation-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    };
    
    // Mostra modal de informação centralizado e profissional
    window.showInfoModal = (title, message, options = {}) => {
        return new Promise((resolve) => {
            // Criar ou encontrar modal de informação
            let infoModal = document.getElementById('info-modal');
            if (!infoModal) {
                infoModal = document.createElement('div');
                infoModal.id = 'info-modal';
                infoModal.className = 'fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[10005] flex items-center justify-center p-4';
                infoModal.style.display = 'none';
                document.body.appendChild(infoModal);
            }
            
            const type = options.type || 'info'; // info, success, warning, error
            const iconColors = {
                info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                success: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
                warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
                error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            };
            
            const icons = {
                info: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
                success: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
                warning: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
                error: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            };
            
            // Detectar se a mensagem contém uma senha temporária para destacá-la
            const passwordMatch = message.match(/([a-zA-Z0-9]{8,})/);
            const hasPassword = passwordMatch && (message.toLowerCase().includes('senha') || message.toLowerCase().includes('password') || message.toLowerCase().includes('temporária') || message.toLowerCase().includes('temporary'));
            
            let displayMessage = message;
            let tempPassword = null;
            
            if (hasPassword && passwordMatch) {
                tempPassword = passwordMatch[1];
                // Destacar a senha na mensagem
                displayMessage = message.replace(
                    tempPassword, 
                    `<strong class="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 px-2 py-1 rounded font-mono text-lg font-bold break-all">${tempPassword}</strong>`
                );
            }
            
            infoModal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
                    <div class="p-6">
                        <div class="flex items-center justify-center w-16 h-16 mx-auto rounded-full ${iconColors[type]} mb-4">
                            ${icons[type]}
                        </div>
                        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 text-center mb-2">${title}</h3>
                        <p class="text-gray-600 dark:text-gray-300 text-center mb-6 whitespace-pre-wrap">${displayMessage}</p>
                        ${hasPassword && tempPassword ? `
                            <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-4">
                                <p class="text-xs text-gray-600 dark:text-gray-400 mb-1 text-center">Senha Temporária:</p>
                                <p id="temp-password-display" class="font-mono text-lg font-bold text-gray-900 dark:text-gray-100 break-all text-center select-all cursor-pointer" onclick="navigator.clipboard.writeText('${tempPassword}').then(() => window.showSuccessToast('Senha copiada!'))">${tempPassword}</p>
                            </div>
                            <button id="copy-password-btn" class="w-full mb-3 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                                Copiar Senha
                            </button>
                        ` : ''}
                        <div class="flex justify-center">
                            <button id="info-modal-ok-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-8 rounded-lg transition-colors duration-200">
                                ${options.buttonText || 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Event listeners
            const okBtn = infoModal.querySelector('#info-modal-ok-btn');
            
            // Event listener para copiar senha se existir
            if (hasPassword && tempPassword) {
                const copyPasswordBtn = infoModal.querySelector('#copy-password-btn');
                const passwordDisplay = infoModal.querySelector('#temp-password-display');
                
                if (copyPasswordBtn) {
                    copyPasswordBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(tempPassword).then(() => {
                            copyPasswordBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> ✓ Senha Copiada!';
                            copyPasswordBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                            copyPasswordBtn.classList.add('bg-green-700');
                            setTimeout(() => {
                                copyPasswordBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Copiar Senha';
                                copyPasswordBtn.classList.remove('bg-green-700');
                                copyPasswordBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                            }, 2000);
                            if (window.showSuccessToast) {
                                window.showSuccessToast('Senha copiada para a área de transferência!');
                            }
                        }).catch(() => {
                            if (window.showSuccessToast) {
                                window.showSuccessToast('Erro ao copiar senha. Use Ctrl+C para copiar manualmente.', true);
                            }
                        });
                    });
                }
                
                // Permite copiar clicando na senha também
                if (passwordDisplay) {
                    passwordDisplay.addEventListener('click', () => {
                        navigator.clipboard.writeText(tempPassword).then(() => {
                            if (window.showSuccessToast) {
                                window.showSuccessToast('Senha copiada!');
                            }
                        }).catch(() => {});
                    });
                    passwordDisplay.style.cursor = 'pointer';
                    passwordDisplay.title = 'Clique para copiar';
                }
            }
            const closeModal = () => {
                infoModal.style.display = 'none';
                resolve(true);
            };
            
            okBtn.addEventListener('click', closeModal);
            infoModal.addEventListener('click', (e) => {
                if (e.target === infoModal) {
                    closeModal();
                }
            });
            
            // ESC key para fechar
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
            
            // Mostrar modal com animação
            infoModal.style.display = 'flex';
            setTimeout(() => {
                infoModal.querySelector('.bg-white').style.transform = 'scale(1)';
                infoModal.querySelector('.bg-white').style.opacity = '1';
            }, 10);
        });
    };
    
    // Mostra modal de progresso (usa o modal existente no HTML) - CÓDIGO COMPLETO DO ORIGINAL
    window.showProgressModal = (mainMessage, subMessage = null) => {
        const modal = document.getElementById('progress-modal');
        const taskMessageEl = document.getElementById('progress-task-message');
        const motivationalPhraseEl = document.getElementById('progress-motivational-phrase');
        const partCounterEl = document.getElementById('progress-part-counter');
        const partProgressBarContainer = document.getElementById('part-progress-bar-container');

        if (!modal || !taskMessageEl || !motivationalPhraseEl || !partCounterEl || !partProgressBarContainer) return;
        
        const phrases = [
            "darkscript AI esta forjando seu proximo roteiro viral...",
            "Otimizando cada palavra para o seu sucesso no YouTube...",
            "Imagine seu canal crescendo. Estamos trabalhando para isso..."
        ];

        taskMessageEl.textContent = mainMessage || 'Aguarde um momento...';
        partCounterEl.textContent = '';
        partProgressBarContainer.style.display = 'block';

        // Limpar intervalos anteriores
        if (window.appState.phraseInterval) clearInterval(window.appState.phraseInterval);
        if (window.appState.progressInterval) clearInterval(window.appState.progressInterval);
        
        motivationalPhraseEl.textContent = subMessage || phrases[Math.floor(Math.random() * phrases.length)];
        window.appState.phraseInterval = setInterval(() => {
            motivationalPhraseEl.textContent = phrases[Math.floor(Math.random() * phrases.length)];
        }, 4000);
        
        window.updateProgressCircle(0);
        modal.style.display = 'flex';

        // Sistema de progresso gradual
        let currentProgress = 0;
        let targetProgress = 0;
        
        window.appState.progressInterval = setInterval(() => {
            if (currentProgress < targetProgress) {
                currentProgress = Math.min(currentProgress + 1, targetProgress);
            } else if (currentProgress < 95) {
                currentProgress = Math.min(currentProgress + 0.1, 95);
            }
            window.updateProgressCircle(currentProgress);
        }, 80);

        // Função para definir o progresso real
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
    
    // Atualiza o círculo de progresso - CÓDIGO COMPLETO DO ORIGINAL
    window.updateProgressCircle = (progress = 0) => {
        const circleEl = document.getElementById('progress-circle');
        const percentageEl = document.getElementById('progress-percentage');
        if (!circleEl || !percentageEl) return;

        const radius = circleEl.r ? circleEl.r.baseVal.value : 45;
        const circumference = 2 * Math.PI * radius;
        const finalProgress = Math.min(100, Math.max(0, progress));
        const offset = circumference - (finalProgress / 100) * circumference;
        
        circleEl.style.strokeDasharray = circumference;
        circleEl.style.strokeDashoffset = offset;
        percentageEl.textContent = `${Math.floor(finalProgress)}%`;

        // Adicionar/remover classe de pulso
        if (finalProgress < 95) {
            circleEl.classList.add('pulsing-wait');
        } else {
            circleEl.classList.remove('pulsing-wait');
        }
    };
    
    // Atualiza mensagem do progresso
    window.updateProgressMessage = (message, motivationalPhrase = '') => {
        const taskMessage = document.getElementById('progress-task-message');
        const motivationalElement = document.getElementById('progress-motivational-phrase');
        
        if (taskMessage) taskMessage.textContent = message || '';
        if (motivationalElement) motivationalElement.textContent = motivationalPhrase || '';
    };
    
    // Atualiza contador de partes
    window.updateProgressCounter = (current, total) => {
        const partCounter = document.getElementById('progress-part-counter');
        if (partCounter) {
            partCounter.textContent = total > 0 ? `Parte ${current} de ${total}` : '';
        }
    };
    
    // Esconde modal de progresso - CÓDIGO COMPLETO DO ORIGINAL
    window.hideProgressModal = () => {
        if(window.setRealProgress) window.setRealProgress(100, '');
        if (window.appState.progressInterval) clearInterval(window.appState.progressInterval);
        if (window.appState.phraseInterval) clearInterval(window.appState.phraseInterval);
        
        const modal = document.getElementById('progress-modal');
        if(modal && modal.style.display !== 'none') {
            setTimeout(() => {
                if (modal) modal.style.display = 'none';
                window.updateProgressCircle(0);
                const partProgressBarContainer = document.getElementById('part-progress-bar-container');
                if(partProgressBarContainer) partProgressBarContainer.style.display = 'none';
            }, 1000);
        }
    };
    
    // Renderiza página de roteiro gerado - CÓDIGO COMPLETO DO ORIGINAL
    window.renderScriptPage = function() {
        const outputEl = document.getElementById('output');
        const paginationEl = document.getElementById('script-pagination-controls');
        if (!outputEl || !paginationEl) return;

        const { fullResult, currentPage, partsPerPage } = window.scriptResults;
        if (!fullResult) {
            outputEl.innerHTML = '';
            paginationEl.innerHTML = '';
            return;
        }
        const { scores, script_parts, total_parts, narrationOnlyMode } = fullResult;
        
        // Garantir que full_script_text sempre existe e está atualizado (sem marcações)
        // Re-numerar as partes corretamente para exibição
        if (script_parts && script_parts.length > 0) {
            // Renumerar partes para garantir ordem correta (1, 2, 3, ...)
            script_parts.forEach((part, index) => {
                const expectedNumber = index + 1;
                // Se o título for apenas "Parte X", garantir que o número está correto
                const partNumberMatch = part.part_title.match(/^Parte\s+(\d+)$/i);
                if (partNumberMatch) {
                    const currentNumber = parseInt(partNumberMatch[1]);
                    if (currentNumber !== expectedNumber) {
                        // Corrigir numeração
                        part.part_title = `Parte ${expectedNumber}`;
                    }
                } else if (part.part_title && part.part_title.trim()) {
                    // Se tem título personalizado, verificar se começa com "Parte N:"
                    const titledMatch = part.part_title.match(/^Parte\s+\d+:\s*(.+)$/i);
                    if (titledMatch) {
                        // Manter título mas corrigir número se necessário
                        part.part_title = `Parte ${expectedNumber}: ${titledMatch[1]}`;
                    }
                } else {
                    // Se não tem título, criar padrão
                    part.part_title = `Parte ${expectedNumber}`;
                }
            });
            
            fullResult.full_script_text = script_parts
                .map(p => window.cleanScriptContent(p.part_content))
                .join('\n\n');
        }
        
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
                                ${window.createCopyButton(window.cleanScriptContent(part.part_content))}
                            </div>
                            <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300" style="white-space: pre-wrap; line-height: 1.8;">${(window.cleanScriptContent ? window.cleanScriptContent(part.part_content) : part.part_content)}</div>
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
            const legendContainer = document.getElementById('legend-container');
            if (legendContainer) legendContainer.innerHTML = '';
            
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
                    ${window.renderScoreCard('Potencial de Sucesso', mainScore, {
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
                                ${window.createCopyButton(window.cleanScriptContent(part.part_content))}
                            </div>
                            <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300" style="white-space: pre-wrap; line-height: 1.8;">${(window.cleanScriptContent ? window.cleanScriptContent(part.part_content) : part.part_content)}</div>
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
        
        // Anexar event listeners para paginação
        paginationEl.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page, 10);
                if (!isNaN(page) && page > 0 && window.scriptResults) {
                    window.scriptResults.currentPage = page;
                    window.renderScriptPage();
                }
            });
        });
        
        // Anexar event listeners para os botões de ação (copiar, transferir, limpar)
        window.attachScriptActionListeners();
    };
    
    // Anexa event listeners para os botões de ação do roteiro - CÓDIGO COMPLETO DO ORIGINAL
    window.attachScriptActionListeners = () => {
        // Botão Copiar Roteiro Completo
        const copyBtn = document.getElementById('copy-script-btn');
        if (copyBtn && !copyBtn.dataset.listenerAdded) {
            copyBtn.dataset.listenerAdded = 'true';
            copyBtn.addEventListener('click', async () => {
                if (!window.scriptResults || !window.scriptResults.fullResult) {
                    window.showSuccessToast("Nenhum roteiro disponível para copiar. Gere um roteiro primeiro.", true);
                    return;
                }
                
                // Tentar pegar o roteiro completo de várias fontes
                let scriptToCopy = window.scriptResults.fullResult.full_script_text;
                
                // Se não tiver full_script_text, montar das partes (sem marcações)
                if (!scriptToCopy && window.scriptResults.fullResult.script_parts && window.scriptResults.fullResult.script_parts.length > 0) {
                    scriptToCopy = window.scriptResults.fullResult.script_parts
                        .map(p => window.cleanScriptContent(p.part_content))
                        .join('\n\n');
                } else if (scriptToCopy) {
                    scriptToCopy = window.cleanScriptContent(scriptToCopy);
                }
                
                if (scriptToCopy && scriptToCopy.trim()) {
                    try {
                        await navigator.clipboard.writeText(scriptToCopy);
                        window.showSuccessToast("Roteiro copiado!");
                    } catch (error) {
                        console.error('Erro ao copiar:', error);
                        window.showSuccessToast("Erro ao copiar. Tente novamente.", true);
                    }
                } else {
                    window.showSuccessToast("Roteiro vazio. Gere um roteiro primeiro.", true);
                }
            });
        }
        
        // Botão Transferir Roteiro (.txt)
        const saveBtn = document.getElementById('save-script-txt-btn');
        if (saveBtn && !saveBtn.dataset.listenerAdded) {
            saveBtn.dataset.listenerAdded = 'true';
            saveBtn.addEventListener('click', async () => {
                if (!window.scriptResults || !window.scriptResults.fullResult) {
                    window.showSuccessToast("Nenhum roteiro disponível para transferir. Gere um roteiro primeiro.", true);
                    return;
                }
                
                // Tentar pegar o roteiro completo de várias fontes
                let scriptToSave = window.scriptResults.fullResult.full_script_text;
                
                // Se não tiver full_script_text, montar das partes (sem marcações)
                if (!scriptToSave && window.scriptResults.fullResult.script_parts && window.scriptResults.fullResult.script_parts.length > 0) {
                    scriptToSave = window.scriptResults.fullResult.script_parts
                        .map(p => window.cleanScriptContent(p.part_content))
                        .join('\n\n');
                } else if (scriptToSave) {
                    scriptToSave = window.cleanScriptContent(scriptToSave);
                }
                
                if (scriptToSave && scriptToSave.trim()) {
                    // Tentar pegar o nome do arquivo de vários campos possíveis
                    const topicInput = document.getElementById('script-topic') || document.getElementById('script-theme');
                    const fileName = (topicInput?.value.trim() || 'roteiro').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt';
                    
                    // Criar blob e fazer download
                    const blob = new Blob([scriptToSave], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    window.showSuccessToast('Transferencia iniciada!');
                } else {
                    window.showSuccessToast("Roteiro vazio. Gere um roteiro primeiro.", true);
                }
            });
        }
        
        // Botão Limpar & Começar de Novo
        const clearBtn = document.getElementById('clear-script-output-btn');
        if (clearBtn && !clearBtn.dataset.listenerAdded) {
            clearBtn.dataset.listenerAdded = 'true';
            clearBtn.addEventListener('click', () => {
                // Limpar output visual
                const outputEl = document.getElementById('output');
                if (outputEl) outputEl.innerHTML = '';
                
                // Limpar paginação
                const paginationEl = document.getElementById('script-pagination-controls');
                if (paginationEl) paginationEl.innerHTML = '';
                
                // Limpar dados do script
                if (window.scriptResults) {
                    window.scriptResults.fullResult = null;
                    window.scriptResults.currentPage = 1;
                }
                
                // Limpar container de afiliado
                const affiliateContainer = document.getElementById('affiliate-product-container');
                if (affiliateContainer) affiliateContainer.style.display = 'none';
                
                // Limpar legenda
                const legendContainer = document.getElementById('legend-container');
                if (legendContainer) legendContainer.innerHTML = '';
                
                // Limpar pontuações se existirem
                const scoreContainer = outputEl?.querySelector('.score-analysis-container');
                if (scoreContainer) scoreContainer.remove();
                
                window.showSuccessToast("Roteiro limpo. Você pode começar de novo!");
            });
        }
        
        // Botão Continuar Geração
        const continueBtn = document.getElementById('continue-script-btn');
        if (continueBtn && !continueBtn.dataset.listenerAdded) {
            continueBtn.dataset.listenerAdded = 'true';
            continueBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (window.handlers && window.handlers['generate-script']) {
                    await window.handlers['generate-script'](e, true);
                } else {
                    const tool = window.moduleLoader?.getModule('script-writer');
                    if (tool && typeof tool.handler === 'function') {
                        await tool.handler(e, true);
                    }
                }
            });
        }
    };
    
    // Limpa conteúdo do roteiro removendo TODAS as marcações e instruções - VERSÃO ULTRA RIGOROSA
    // Função para obter o módulo de limpeza de roteiro
    window.getScriptCleaner = function() {
        if (window.moduleLoader) {
            return window.moduleLoader.getModule('script-cleaner');
        }
        return null;
    };
    
    window.cleanScriptContent = (text) => {
        if (!text) return '';
        
        // Tentar usar o módulo de limpeza dedicado primeiro
        const cleanerModule = window.getScriptCleaner();
        if (cleanerModule && typeof cleanerModule.cleanPart === 'function') {
            const cleaned = cleanerModule.cleanPart(text);
            if (cleaned && cleaned.trim().length > 0) {
                return cleaned;
            }
        }
        
        // Fallback para limpeza básica (código original)
        let cleanedText = text;
        
        // PASSO 1: Remover TODAS as marcações de partes (qualquer formato) - MAIS AGRESSIVO
        // Remover marcações no início, meio ou fim do texto
        cleanedText = cleanedText.replace(/\[--PART\s*\d+[^\]]*?--\]/gi, '');
        cleanedText = cleanedText.replace(/\[--PART\s*\d+:\s*[^\]]*?--\]/gi, '');
        cleanedText = cleanedText.replace(/----\[--PART[^\]]*?--\]/gi, '');
        cleanedText = cleanedText.replace(/\[--ENDPART--\]/gi, '');
        cleanedText = cleanedText.replace(/----\[--ENDPART--\]/gi, '');
        cleanedText = cleanedText.replace(/\[--VOICEOVER_PART_BREAK--\]/gi, '');
        cleanedText = cleanedText.replace(/----\[--VOICEOVER_PART_BREAK--\]/gi, '');
        // Remover variações com espaços extras
        cleanedText = cleanedText.replace(/\[\s*--\s*PART\s*\d+[^\]]*?\s*--\s*\]/gi, '');
        cleanedText = cleanedText.replace(/\[\s*--\s*ENDPART\s*--\s*\]/gi, '');
        // Remover marcações que aparecem no meio de frases
        cleanedText = cleanedText.replace(/[^\n]*?\[--PART[^\]]*?--\][^\n]*?/gi, '');
        cleanedText = cleanedText.replace(/[^\n]*?\[--ENDPART--\][^\n]*?/gi, '');
        
        // PASSO 2: Remover instruções internas da IA
        cleanedText = cleanedText.replace(/<internal_thought>[\s\S]*?<\/internal_thought>/gi, '');
        cleanedText = cleanedText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
        cleanedText = cleanedText.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
        cleanedText = cleanedText.replace(/^\s*\*\*.*?\:\*\*\s*/gm, '');
        cleanedText = cleanedText.replace(/^\s*#+\s*.*$/gm, ''); // Remover markdown headers
        
        // PASSO 3: Remover qualquer texto que pareça ser instrução ou marcação (LINHAS INTEIRAS)
        cleanedText = cleanedText.split('\n').filter(line => {
            const trimmed = line.trim();
            // Remover linhas que contenham marcações
            if (/\[--.*?--\]/.test(trimmed)) return false;
            if (/PART\s*\d+/i.test(trimmed) && trimmed.length < 100) return false; // Linhas curtas com "PART N"
            if (/ENDPART/i.test(trimmed) && trimmed.length < 50) return false; // Linhas curtas com "ENDPART"
            return true;
        }).join('\n');
        
        // PASSO 4: Remover texto duplicado (frases repetidas consecutivas)
        const lines = cleanedText.split('\n');
        const deduplicatedLines = [];
        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i].trim();
            const prevLine = i > 0 ? lines[i - 1].trim() : '';
            // Se a linha atual é muito similar à anterior (mais de 80% similar), pular
            if (currentLine && prevLine && currentLine.length > 20 && prevLine.length > 20) {
                const similarity = window.calculateSimilarity ? window.calculateSimilarity(currentLine, prevLine) : calculateSimilarity(currentLine, prevLine);
                if (similarity > 0.8) {
                    continue; // Pular linha duplicada
                }
            }
            deduplicatedLines.push(lines[i]);
        }
        cleanedText = deduplicatedLines.join('\n');
        
        // PASSO 5: Remover texto antes da primeira frase válida (se houver muito lixo no início)
        const firstValidSentence = cleanedText.match(/[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][^.!?]*[.!?]/);
        if (firstValidSentence && firstValidSentence.index > 50) {
            cleanedText = cleanedText.substring(firstValidSentence.index);
        }
        
        // PASSO 6: Remover linhas que são apenas números, símbolos ou muito curtas
        cleanedText = cleanedText.split('\n').filter(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.length < 3) return false;
            if (/^[\d\s\-\[\]\(\)]+$/.test(trimmed)) return false;
            if (/^[^\w\s]+$/.test(trimmed)) return false;
            // Remover linhas que são apenas "Parte N" ou variações
            if (/^Parte\s+\d+[:\s]*$/i.test(trimmed)) return false;
            return true;
        }).join('\n');
        
        // PASSO 7: Remover repetições de palavras consecutivas
        cleanedText = cleanedText.replace(/\b(\w+)\s+\1\b/gi, '$1');
        
        // PASSO 8: Remover frases duplicadas (mesma frase aparecendo duas vezes seguidas)
        const sentences = cleanedText.split(/[.!?]+\s*/).filter(s => s.trim().length > 10);
        const uniqueSentences = [];
        for (let i = 0; i < sentences.length; i++) {
            const current = sentences[i].trim();
            const prev = i > 0 ? sentences[i - 1].trim() : '';
            // Se a frase atual é muito similar à anterior, pular
            if (current && prev) {
                const similarity = window.calculateSimilarity ? window.calculateSimilarity(current, prev) : calculateSimilarity(current, prev);
                if (similarity > 0.85) {
                    continue;
                }
            }
            uniqueSentences.push(sentences[i]);
        }
        // Reconstruir texto com pontuação
        cleanedText = uniqueSentences.join('. ').replace(/\.\s*\./g, '.');
        
        // PASSO 9: Garantir formatação correta de parágrafos
        // Primeiro, normalizar quebras de linha (remover múltiplas)
        cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
        
        // Dividir em parágrafos e garantir que cada um seja separado por \n\n
        let paragraphs = cleanedText.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
        
        // Se não há parágrafos separados, tentar criar baseado em pontuação
        if (paragraphs.length === 1 && cleanedText.length > 200) {
            // Dividir por frases completas
            const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [];
            if (sentences.length > 0) {
                // Agrupar em parágrafos de 4-6 frases
                const sentencesPerParagraph = 5;
                paragraphs = [];
                for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
                    const paragraph = sentences.slice(i, i + sentencesPerParagraph)
                        .map(s => s.trim())
                        .filter(s => s.length > 0)
                        .join(' ');
                    if (paragraph.length > 0) {
                        paragraphs.push(paragraph);
                    }
                }
            }
        }
        
        // Reconstruir com espaçamento correto (duas quebras de linha entre parágrafos)
        cleanedText = paragraphs.join('\n\n');
        
        // PASSO 10: Garantir que não há mais de 2 quebras de linha seguidas
        cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
        
        // PASSO 11: Limpar espaços extras no início e fim de cada linha, mas manter quebras de linha
        cleanedText = cleanedText.split('\n').map(line => {
            // Se a linha está vazia, manter vazia (para preservar \n\n)
            if (!line.trim()) return '';
            // Se tem conteúdo, limpar espaços extras mas manter a linha
            return line.trim();
        }).join('\n');
        
        // PASSO 11: Remover qualquer marcação restante que possa ter escapado
        cleanedText = cleanedText.replace(/\[--[^\]]*?--\]/gi, '');
        cleanedText = cleanedText.replace(/--\[--[^\]]*?--\]/gi, '');
        cleanedText = cleanedText.replace(/\[--[^\]]*?--/gi, '');
        cleanedText = cleanedText.replace(/--[^\]]*?--\]/gi, '');
        
        // PASSO 12: Remover emojis de cópia e outros símbolos estranhos que não fazem parte do roteiro
        cleanedText = cleanedText.replace(/📋\s*/g, '');
        cleanedText = cleanedText.replace(/^\s*📋\s*$/gm, '');
        
        return cleanedText.trim();
    };
    
    // Função auxiliar para calcular similaridade entre duas strings
    window.calculateSimilarity = function(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1;
        
        // Usar algoritmo simples de similaridade baseado em palavras comuns
        const words1 = str1.toLowerCase().split(/\s+/);
        const words2 = str2.toLowerCase().split(/\s+/);
        const commonWords = words1.filter(word => words2.includes(word));
        
        return (commonWords.length * 2) / (words1.length + words2.length);
    };
    
    // Manter função local também para compatibilidade
    function calculateSimilarity(str1, str2) {
        return window.calculateSimilarity(str1, str2);
    }
    
    // Função de limpeza para uso no processamento de partes - CÓDIGO COMPLETO DO ORIGINAL
    window.cleanAiInstructions = (text) => {
        if (!text) return '';
        return window.cleanScriptContent(text);
    };
    
    // Salva roteiro no histórico - CÓDIGO COMPLETO DO ORIGINAL
    window.saveScriptToHistory = (scriptData) => {
        try {
            console.log('🔍 saveScriptToHistory chamado. Dados recebidos:', {
                hasScriptData: !!scriptData,
                hasScriptParts: !!(scriptData && scriptData.script_parts),
                scriptPartsLength: scriptData?.script_parts?.length || 0,
                scriptDataKeys: scriptData ? Object.keys(scriptData) : []
            });
            
            if (!scriptData || !scriptData.script_parts || scriptData.script_parts.length === 0) {
                console.warn('⚠️ Dados do roteiro inválidos ou vazios, não salvando no histórico. Dados:', scriptData);
                return;
            }
            
            let history = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
            const topicInput = document.getElementById('script-topic');
            const title = topicInput && topicInput.value.trim() 
                ? topicInput.value.trim() 
                : 'Roteiro sem título';
            
            const newItem = {
                id: Date.now(),
                title: title,
                date: new Date().toLocaleString('pt-BR'),
                data: scriptData
            };
            
            history.unshift(newItem);
            
            // Limitar a 5 itens (últimos 5)
            if (history.length > 5) {
                history = history.slice(0, 5);
            }
            
            localStorage.setItem('scriptHistory', JSON.stringify(history));
            console.log(`✅ Roteiro salvo no histórico com sucesso! Título: "${title}", Partes: ${scriptData.script_parts.length}, Total no histórico: ${history.length}`);
            
            // Verificar se foi salvo corretamente
            const verifyHistory = JSON.parse(localStorage.getItem('scriptHistory') || '[]');
            if (verifyHistory.length > 0 && verifyHistory[0].id === newItem.id) {
                console.log('✅ Verificação: Roteiro confirmado no localStorage');
            } else {
                console.error('❌ Verificação: Roteiro NÃO encontrado no localStorage após salvar!');
            }
        } catch (error) {
            console.error('❌ Erro ao salvar roteiro no histórico:', error);
            console.error('Stack trace:', error.stack);
        }
    };
    
    // Renderiza histórico de roteiros - CÓDIGO COMPLETO DO ORIGINAL
    window.renderScriptHistory = () => {
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
        
        // Anexar event listeners para carregar/excluir
        historyContainer.querySelectorAll('.load-script-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.historyId);
                const item = history.find(h => h.id === id);
                if (item && item.data) {
                    window.scriptResults = window.scriptResults || {};
                    window.scriptResults.fullResult = item.data;
                    window.scriptResults.currentPage = 1;
                    if (window.renderScriptPage) {
                        window.renderScriptPage();
                    }
                    window.showSuccessToast('Roteiro carregado!');
                }
            });
        });
        
        historyContainer.querySelectorAll('.delete-script-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.historyId);
                const newHistory = history.filter(h => h.id !== id);
                localStorage.setItem('scriptHistory', JSON.stringify(newHistory));
                window.renderScriptHistory();
                window.showSuccessToast('Roteiro excluído!');
            });
        });
        
        // Listener para limpar todo o histórico
        const clearBtn = document.getElementById('clear-script-history-btn');
        if (clearBtn) {
            const newClearBtn = clearBtn.cloneNode(true);
            clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
            newClearBtn.addEventListener('click', () => {
                if (confirm('Tem certeza de que deseja apagar todo o historico de roteiros? Esta acao nao pode ser desfeita.')) {
                    localStorage.removeItem('scriptHistory');
                    window.renderScriptHistory();
                    window.showSuccessToast('Historico limpo.');
                }
            });
        }
    };
    
    // Adiciona mensagem ao log
    window.addToLog = (message, isError = false) => {
        const logMessage = document.getElementById('log-message');
        if (logMessage) {
            logMessage.textContent = message;
            logMessage.className = `text-xs ${isError ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`;
        }
        if (isError) {
            console.error(message);
        } else {
            console.log(message);
        }
    };
    
    // Dev log (apenas em desenvolvimento)
    window.devLog = (...args) => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('[DEV]', ...args);
        }
    };
    
    // ============================================================================
    // FUNÇÕES DE API ESSENCIAIS
    // ============================================================================
    
    // Função básica de requisição API
    window.apiRequest = async (url, method, body) => {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const options = {
            method,
            headers
        };
        
        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: response.statusText, error: response.statusText };
            }
            
            // Log detalhado do erro para debug
            console.error(`❌ Erro na requisição ${method} ${url}:`, {
                status: response.status,
                statusText: response.statusText,
                error: errorData.error || errorData.message,
                details: errorData.details
            });
            
            throw new Error(errorData.error || errorData.message || `Erro ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    };
    
    // Função de requisição com fallback de modelo
    window.apiRequestWithFallback = async (url, method, data, retries = 1) => {
        const originalModel = data.model;
        let lastError = null;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const result = await window.apiRequest(url, method, data);
                return result;
            } catch (error) {
                lastError = error;
                const errorMsg = error.message || '';
                
                // Verificar se é erro temporário
                const isTemporaryError = errorMsg.includes('temporariamente indisponível') ||
                                        errorMsg.includes('502') ||
                                        errorMsg.includes('503') ||
                                        errorMsg.includes('504');
                
                if (isTemporaryError && attempt < retries) {
                    const waitTime = Math.min(2000 * Math.pow(2, attempt), 10000);
                    console.warn(`⚠️ Erro temporário (tentativa ${attempt + 1}/${retries + 1}). Aguardando ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                
                // Se não é erro temporário e ainda tem tentativas, aguardar um pouco
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                throw error;
            }
        }
        
        throw lastError;
    };
    
    // Função de streaming API
    window.streamApiRequest = async (url, body, onChunk, onDone, onError) => {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(error.message || `Erro ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    if (onDone) {
                        onDone(buffer);
                    }
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data === '[DONE]') {
                            if (onDone) {
                                onDone(buffer);
                            }
                            return;
                        }
                        
                        try {
                            const json = JSON.parse(data);
                            if (onChunk) {
                                onChunk(json);
                            }
                        } catch (e) {
                            // Ignorar erros de parsing
                        }
                    }
                }
            }
        } catch (error) {
            if (onError) {
                onError(error);
            } else {
                throw error;
            }
        }
    };
    
    // ============================================================================
    // SISTEMA DE AUTENTICAÇÃO
    // ============================================================================
    
    // Função para alternar entre telas (login, app, etc.)
    window.showScreen = (screenId) => {
        ['auth-section', 'activation-container', 'app-container', 'maintenance-overlay', 'force-password-change-modal', 'password-reset-modal'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = (id === screenId) ? 'flex' : 'none';
        });
        
        // Mostrar/ocultar widget de chat quando não estiver logado
        const chatWidget = document.getElementById('chat-widget');
        if (chatWidget) {
            if (screenId === 'app-container' && window.appState.currentUser) {
                chatWidget.style.display = 'block';
            } else {
                chatWidget.style.display = 'none';
            }
        }
    };
    
    // Função de login
    window.handleLogin = async function(e) {
        e.preventDefault();
        const feedbackEl = document.getElementById('login-feedback');
        if (feedbackEl) feedbackEl.textContent = '';
        
        const email = document.getElementById('login-email')?.value;
        const password = document.getElementById('login-password')?.value;
        const rememberMe = document.getElementById('remember-me')?.checked || false;
        
        if (!email || !password) {
            if (feedbackEl) feedbackEl.textContent = 'Por favor, preencha email e senha.';
            return;
        }
        
        try {
            const response = await window.apiRequest('/api/login', 'POST', { email, password, rememberMe });
            localStorage.setItem('authToken', response.token);
            window.authToken = response.token;
            window.appState.currentUser = response.user;
            window.appState.isAuthenticated = true;
            window.user = response.user;
            
            // Atualizar status de admin para proteção
            if (typeof window.updateAdminStatus === 'function') {
                window.updateAdminStatus();
            }
            
            if (response.mustChangePassword) {
                // Mostrar modal de troca de senha obrigatória
                console.log('🔐 Usuário precisa trocar senha temporária. Exibindo modal...');
                if (typeof window.showForcePasswordChangeModal === 'function') {
                    window.showForcePasswordChangeModal();
                } else {
                    console.error('❌ Função showForcePasswordChangeModal não encontrada!');
                    window.showInfoModal(
                        'Troca de Senha Obrigatória',
                        'Por segurança, você precisa alterar sua senha temporária antes de continuar. Por favor, recarregue a página.',
                        { type: 'warning' }
                    );
                }
                return;
            }
            
            // Verificar status da aplicação
            try {
                const appStatus = await window.apiRequest('/api/status', 'GET');
                if (appStatus && appStatus.maintenance && appStatus.maintenance.is_on && window.appState.currentUser.role !== 'admin') {
                    // Mostrar modo de manutenção
                    const maintenanceOverlay = document.getElementById('maintenance-overlay');
                    const maintenanceMessage = document.getElementById('maintenance-message');
                    if (maintenanceOverlay && maintenanceMessage) {
                        maintenanceMessage.textContent = appStatus.maintenance.message || 'Estamos a realizar melhorias na plataforma. Voltaremos em breve!';
                        window.showScreen('maintenance-overlay');
                        return;
                    }
                }
                
                // Inicializar aplicação
                await initializeApp(appStatus ? appStatus.announcement : null);
                
            } catch (statusError) {
                console.error('Erro ao verificar status:', statusError);
                // Continuar mesmo assim
                await initializeApp(null);
            }
            
        } catch (error) {
            console.error("Login Error:", error);
            if (feedbackEl) {
                if (error.message && error.message.includes('ativada')) {
                    window.showScreen('activation-container');
                } else {
                    feedbackEl.textContent = error.message || 'Erro ao fazer login. Tente novamente.';
                }
            }
        }
    };
    
    // Função de registro
    window.handleRegister = async function(e) {
        e.preventDefault();
        const feedbackEl = document.getElementById('register-feedback');
        if (feedbackEl) feedbackEl.textContent = '';
        
        const email = document.getElementById('register-email')?.value;
        const whatsapp = document.getElementById('register-whatsapp')?.value;
        const password = document.getElementById('register-password')?.value;
        
        if (!email || !whatsapp || !password) {
            if (feedbackEl) feedbackEl.textContent = 'Por favor, preencha todos os campos.';
            return;
        }
        
        const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
        const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
        
        if (!whatsappRegex.test(cleanedWhatsapp) || cleanedWhatsapp.length < 10) {
            if (feedbackEl) feedbackEl.textContent = 'Por favor, insira um número de WhatsApp válido.';
            return;
        }
        
        try {
            await window.apiRequest('/api/register', 'POST', { email, password, whatsapp });
            window.showScreen('activation-container');
        } catch (error) {
            console.error("Register Error:", error);
            if (feedbackEl) feedbackEl.textContent = error.message || 'Erro ao criar conta. Tente novamente.';
        }
    };
    
    // Função de logout
    window.handleLogout = function() {
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('apiAlertShown');
        window.authToken = null;
        window.appState.currentUser = null;
        window.appState.isAuthenticated = false;
        window.user = null;
        window.showScreen('auth-section');
        
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.reset();
    };
    
    // Função para inicializar a aplicação após login
    async function initializeApp(announcement = null) {
        // Mostrar tela principal
        window.showScreen('app-container');
        
        // Mostrar anúncio se houver
        if (announcement && announcement.message) {
            const announcementOverlay = document.getElementById('announcement-overlay');
            const announcementMessage = document.getElementById('announcement-message');
            const closeAnnouncementBtn = document.getElementById('close-announcement-btn');
            
            if (announcementOverlay && announcementMessage) {
                const seenAnnouncements = JSON.parse(localStorage.getItem('seenAnnouncements') || '[]');
                const announcementHash = announcement.message.substring(0, 50);
                
                if (!seenAnnouncements.includes(announcementHash)) {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const linkedMessage = announcement.message.replace(urlRegex, '<a href="$1" target="_blank" class="text-blue-500 hover:underline">$1</a>');
                    announcementMessage.innerHTML = linkedMessage;
                    announcementOverlay.style.display = 'flex';
                    
                    if (closeAnnouncementBtn) {
                        closeAnnouncementBtn.onclick = () => {
                            announcementOverlay.style.display = 'none';
                            seenAnnouncements.push(announcementHash);
                            localStorage.setItem('seenAnnouncements', JSON.stringify(seenAnnouncements));
                        };
                    }
                }
            }
        }
        
        // Atualizar email do usuário
        const userEmailDisplay = document.getElementById('user-email-display');
        if (userEmailDisplay && window.appState.currentUser) {
            userEmailDisplay.textContent = window.appState.currentUser.email || '';
        }
        
        // Carregar módulos se ainda não foram carregados
        if (!window.moduleLoader) {
            await initializeModules();
        }
        
        // Inicializar navegação lateral
        initializeNavigation();
    }
    
    // Função para mostrar modal de troca de senha obrigatória
    window.showForcePasswordChangeModal = function() {
        console.log('🔐 showForcePasswordChangeModal chamado');
        const modal = document.getElementById('force-password-change-modal');
        const form = document.getElementById('force-password-change-form');
        
        if (!modal || !form) {
            console.error('❌ Modal de troca de senha obrigatória não encontrado', { modal: !!modal, form: !!form });
            // Fallback: mostrar modal de informação
            window.showInfoModal(
                'Erro',
                'Modal de troca de senha não encontrado. Por favor, recarregue a página.',
                { type: 'error' }
            );
            return;
        }
        
        console.log('✅ Modal e formulário encontrados, exibindo...');
        
        // Clonar form para evitar listeners duplicados
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        const feedbackEl = newForm.querySelector('#force-password-change-feedback');
        const newPasswordInput = newForm.querySelector('#new-password-input');
        const confirmPasswordInput = newForm.querySelector('#confirm-new-password-input');
        const submitBtn = newForm.querySelector('button[type="submit"]');
        
        modal.style.display = 'flex';
        if (feedbackEl) feedbackEl.textContent = '';
        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
        if (newPasswordInput) newPasswordInput.focus();
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (feedbackEl) feedbackEl.textContent = '';
            
            const newPassword = newPasswordInput?.value;
            const confirmPassword = confirmPasswordInput?.value;
            
            if (!newPassword || !confirmPassword) {
                if (feedbackEl) {
                    feedbackEl.textContent = 'Por favor, preencha todos os campos.';
                }
                return;
            }
            
            if (newPassword.length < 6) {
                if (feedbackEl) {
                    feedbackEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
                }
                return;
            }
            
            if (newPassword !== confirmPassword) {
                if (feedbackEl) {
                    feedbackEl.textContent = 'As senhas não coincidem.';
                }
                return;
            }
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'A alterar senha...';
            }
            
            try {
                const response = await window.apiRequest('/api/user/change-password', 'POST', { newPassword });
                
                if (feedbackEl) {
                    feedbackEl.textContent = response.message || 'Senha alterada com sucesso!';
                    feedbackEl.classList.remove('text-red-500');
                    feedbackEl.classList.add('text-green-600');
                }
                
                // Atualizar estado do usuário
                if (window.appState.currentUser) {
                    window.appState.currentUser.mustChangePassword = false;
                }
                
                // Fechar modal após 1 segundo e inicializar aplicação
                setTimeout(async () => {
                    modal.style.display = 'none';
                    
                    // Verificar status da aplicação e inicializar
                    try {
                        const appStatus = await window.apiRequest('/api/status', 'GET');
                        if (appStatus && appStatus.maintenance && appStatus.maintenance.is_on && window.appState.currentUser.role !== 'admin') {
                            window.showScreen('maintenance-overlay');
                            const maintenanceMessage = document.getElementById('maintenance-message');
                            if (maintenanceMessage) {
                                maintenanceMessage.textContent = appStatus.maintenance.message || 'Estamos a realizar melhorias na plataforma. Voltaremos em breve!';
                            }
                            return;
                        }
                        
                        await initializeApp(appStatus ? appStatus.announcement : null);
                    } catch (statusError) {
                        console.error('Erro ao verificar status:', statusError);
                        await initializeApp(null);
                    }
                }, 1000);
                
            } catch (error) {
                console.error('Erro ao alterar senha:', error);
                if (feedbackEl) {
                    feedbackEl.textContent = error.message || 'Erro ao alterar senha. Tente novamente.';
                    feedbackEl.classList.remove('text-green-600');
                    feedbackEl.classList.add('text-red-500');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Salvar Nova Senha';
                }
            }
        });
    };
    
    // Função para mostrar modal de reset de senha
    window.showPasswordResetModal = function() {
        const modal = document.getElementById('password-reset-modal');
        const form = document.getElementById('password-reset-form');
        
        if (!modal || !form) {
            console.warn('Modal de reset de senha não encontrado');
            return;
        }
        
        // Clonar form para evitar listeners duplicados
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        const feedbackEl = newForm.querySelector('#password-reset-feedback');
        const emailInput = newForm.querySelector('#reset-email-input');
        const submitBtn = newForm.querySelector('button[type="submit"]');
        const cancelBtn = newForm.querySelector('#cancel-password-reset');
        
        modal.style.display = 'flex';
        if (feedbackEl) feedbackEl.textContent = '';
        if (emailInput) emailInput.value = '';
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (feedbackEl) feedbackEl.textContent = '';
            const email = emailInput?.value;
            
            if (!email) {
                if (feedbackEl) feedbackEl.textContent = 'Por favor, insira um email.';
                return;
            }
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'A enviar...';
            }
            
            try {
                const response = await window.apiRequest('/api/password-reset', 'POST', { email });
                
                // SEGURANÇA: A senha temporária NUNCA vem na resposta
                // Ela só é enviada por e-mail/WhatsApp (canal seguro)
                if (feedbackEl) {
                    feedbackEl.textContent = response.message || 'Senha temporária enviada com sucesso! Verifique seu e-mail.';
                    feedbackEl.classList.remove('text-red-500');
                    feedbackEl.classList.add('text-green-600');
                }
                
                if (submitBtn) submitBtn.style.display = 'none';
                
                // Fechar modal após 5 segundos
                setTimeout(() => {
                    modal.style.display = 'none';
                    if (feedbackEl) {
                        feedbackEl.classList.remove('text-green-600');
                        feedbackEl.classList.add('text-red-500');
                        feedbackEl.textContent = '';
                    }
                    if (submitBtn) {
                        submitBtn.style.display = 'block';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Enviar Senha Temporaria';
                    }
                }, 5000);
                
            } catch (error) {
                console.error("Password Reset Error:", error);
                if (feedbackEl) {
                    // Mostrar mensagem de erro mais detalhada
                    let errorMessage = error.message || 'Ocorreu um erro ao redefinir a senha. Tente novamente.';
                    
                    // Se o erro for sobre e-mail não configurado, dar instruções mais claras
                    if (errorMessage.includes('e-mail não configurado') || errorMessage.includes('configurações do servidor')) {
                        errorMessage += ' Por favor, entre em contato com o administrador do sistema.';
                    }
                    
                    feedbackEl.textContent = errorMessage;
                    feedbackEl.classList.remove('text-green-600');
                    feedbackEl.classList.add('text-red-500');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Senha Temporaria';
                }
            }
        });
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    };
    
    // Função para inicializar navegação lateral
    function initializeNavigation() {
        const sidebarNav = document.getElementById('sidebar-nav');
        if (!sidebarNav) {
            console.warn('sidebar-nav não encontrado');
            return;
        }
        
        // Limpar navegação atual
        sidebarNav.innerHTML = '';
        
        // Lista de módulos e categorias (IDs devem corresponder aos templates) - EXATAMENTE COMO NO ORIGINAL
        // Usando os ícones SVG exatos do app.js original
        const navigationItems = [
            // Criacao e Conteudo
            { id: 'brainstorm-ideas', name: 'Brainstorm de Ideias', iconSVG: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', category: 'Criacao e Conteudo' },
            { id: 'script-writer', name: 'Criador de Roteiro', iconSVG: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', category: 'Criacao e Conteudo' },
            { id: 'viral-titles', name: 'Titulos Virais', iconSVG: 'M15 15l-2 5L9 9l5-2 2 5z', category: 'Criacao e Conteudo' },
            { id: 'script-translator', name: 'Tradutor de Roteiros', iconSVG: 'M3 5h12M9 3v2m1.06 7.11a12.56 12.56 0 01-3.43 3.43m3.43-3.43a12.56 12.56 0 003.43-3.43m-3.43 3.43l3.43 3.43m-3.43 3.43l-3.43-3.43m6.86-1.72a9 9 0 11-12.73 0 9 9 0 0112.73 0z', category: 'Criacao e Conteudo' },
            
            // Midia e Imagem
            { id: 'scene-prompts', name: 'Prompts para Cenas', iconSVG: 'M15.5 4l-3.5 3.5M15.5 4a2.121 2.121 0 00-3-3L10 3.5M15.5 4v.5A2.5 2.5 0 0113 7M3 14l3-3m0 0l3 3m-3-3v10a2 2 0 002 2h3.5', category: 'Midia e Imagem' },
            { id: 'thumbnail-prompts', name: 'Prompts de Thumbnail', iconSVG: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', category: 'Midia e Imagem' },
            { id: 'image-generator', name: 'Gerador de Imagens', iconSVG: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', category: 'Midia e Imagem' },
            
            // Audio e Voz
            { id: 'voice-generator', name: 'Gerador de Voz', iconSVG: 'M12 1a4 4 0 00-4 4v5a4 4 0 008 0V5a4 4 0 00-4-4zm-6 9a6 6 0 0012 0h2a8 8 0 01-7 7.937V21h-2v-3.063A8 8 0 014 10h2z', category: 'Audio e Voz' },
            
            // Otimizacao e Gestao
            { id: 'video-optimizer', name: 'Otimizador de Video', iconSVG: 'M13 10V3L4 14h7v7l9-11h-7z', category: 'Otimizacao e Gestao' },
            { id: 'optimizer', name: 'Otimizador de Descricao', iconSVG: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', category: 'Otimizacao e Gestao' },
            { id: 'script-reviewer', name: 'Revisor de Roteiro', iconSVG: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', category: 'Otimizacao e Gestao' },
            { id: 'editors-cut', name: 'Guia de Edicao', iconSVG: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', category: 'Otimizacao e Gestao' },
            { id: 'srt-converter', name: 'Conversor de SRT', iconSVG: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', category: 'Otimizacao e Gestao' },
            { id: 'text-divider', name: 'Divisor de Texto', iconSVG: 'M4 6h16M4 12h16M4 18h7', category: 'Otimizacao e Gestao' },
            
            // Aprendizado
            { id: 'academy', name: 'Academy', iconSVG: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14v6m-6-3.422v-6.157a12.078 12.078 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998z', category: 'Aprendizado' },
            
            // Sistema
            { id: 'chat', name: 'Chat de Suporte', iconSVG: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', category: 'Sistema' },
            { id: 'settings', name: 'Configuracoes', iconSVG: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', category: 'Sistema' },
            { id: 'faq', name: 'FAQ', iconSVG: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4c-1.742 0-3.223-.835-3.772-2H6.5v2H4.5v-2H2.728a1 1 0 010-2h1.772V7H6.5v2h1.728zM12 18a6 6 0 100-12 6 6 0 000 12z', category: 'Sistema' },
            { id: 'admin', name: 'Painel Admin', iconSVG: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-1.781-4.121M12 11a4 4 0 11-8 0 4 4 0 018 0z', category: 'Sistema', role: 'admin' }
        ];
        
        // Agrupar por categoria
        const categories = {};
        navigationItems.forEach(item => {
            // Verificar se o item requer role específica
            if (item.role && window.appState.currentUser?.role !== item.role) {
                return; // Pular itens que requerem role específica
            }
            
            if (!categories[item.category]) {
                categories[item.category] = [];
            }
            categories[item.category].push(item);
        });
        
        // Renderizar navegação (EXATAMENTE COMO NO ORIGINAL)
        const categoryOrder = [
            'Criacao e Conteudo',
            'Midia e Imagem',
            'Audio e Voz',
            'Otimizacao e Gestao',
            'Aprendizado',
            'Sistema'
        ];
        
        let navHTML = '';
        for (const category of categoryOrder) {
            const items = categories[category];
            if (items && items.length > 0) {
                navHTML += `<div class="px-4 py-2"><p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">${category.toUpperCase()}</p></div>`;
                items.forEach(item => {
                    // Usar SVG icon path do original
                    const iconSVG = item.iconSVG || '';
                    
                    navHTML += `
                        <button 
                            class="sidebar-btn w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                            data-tab="${item.id}"
                        >
                            ${iconSVG ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="${iconSVG}"></path></svg>` : ''}
                            <span class="font-medium">${item.name}</span>
                        </button>
                    `;
                });
            }
        }
        
        sidebarNav.innerHTML = navHTML;
        
        // Selecionar primeira aba por padrão
        const firstBtn = sidebarNav.querySelector('.sidebar-btn');
        if (firstBtn) {
            const firstTabId = firstBtn.dataset.tab;
            if (firstTabId) {
                window.showTab(firstTabId);
            }
        }
        
        // CRÍTICO: Registrar listeners diretamente nos botões após renderização
        // Isso garante que mesmo se o event delegation falhar, os botões funcionam
        setTimeout(() => {
            const sidebarButtons = sidebarNav.querySelectorAll('.sidebar-btn');
            sidebarButtons.forEach(btn => {
                // Adicionar listener direto como fallback
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    const tabId = this.dataset.tab || this.getAttribute('data-tab');
                    if (tabId && typeof window.showTab === 'function') {
                        console.log(`🔄 Navegação direta (fallback) para: ${tabId}`);
                        window.showTab(tabId);
                    }
                }, { capture: true, once: false });
            });
            if (sidebarButtons.length > 0) {
                console.log(`✅ ${sidebarButtons.length} botões da sidebar registrados diretamente após renderização`);
            }
        }, 100);
        
        console.log('✅ Navegação inicializada');
    }
    
    // Função para verificar autenticação ao carregar a página
    async function checkAuth() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.showScreen('auth-section');
            return false;
        }
        
        try {
            const response = await window.apiRequest('/api/verify-session', 'GET');
            if (response && response.user) {
                window.appState.currentUser = response.user;
                window.appState.isAuthenticated = true;
                window.user = response.user;
                window.authToken = token;
                
                // Atualizar status de admin para proteção
                if (typeof window.updateAdminStatus === 'function') {
                    window.updateAdminStatus();
                }
                
                // Verificar status e inicializar app
                try {
                    const appStatus = await window.apiRequest('/api/status', 'GET');
                    if (appStatus && appStatus.maintenance && appStatus.maintenance.is_on && window.appState.currentUser.role !== 'admin') {
                        const maintenanceOverlay = document.getElementById('maintenance-overlay');
                        const maintenanceMessage = document.getElementById('maintenance-message');
                        if (maintenanceOverlay && maintenanceMessage) {
                            maintenanceMessage.textContent = appStatus.maintenance.message || 'Estamos a realizar melhorias na plataforma. Voltaremos em breve!';
                            window.showScreen('maintenance-overlay');
                            return true;
                        }
                    }
                    await initializeApp(appStatus ? appStatus.announcement : null);
                } catch (statusError) {
                    console.error('Erro ao verificar status:', statusError);
                    await initializeApp(null);
                }
                return true;
            }
        } catch (error) {
            console.error('Erro ao verificar sessão:', error);
            localStorage.removeItem('authToken');
            window.showScreen('auth-section');
            return false;
        }
    }
    
    // Configurar event listeners de autenticação
    function setupAuthEventListeners() {
        // Login form - REGISTRAR COM PRIORIDADE
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            // Remover listener anterior se existir (evitar duplicatas)
            const oldHandler = window.handleLogin;
            if (oldHandler) {
                loginForm.removeEventListener('submit', oldHandler);
            }
            // Registrar com capture para garantir que executa
            loginForm.addEventListener('submit', window.handleLogin, { capture: true, passive: false });
            console.log('✅ Listener de login registrado com prioridade');
        } else {
            console.warn('⚠️ Formulário de login não encontrado! Tentando novamente...');
            // Tentar novamente após um delay
            setTimeout(() => {
                const retryForm = document.getElementById('login-form');
                if (retryForm) {
                    retryForm.addEventListener('submit', window.handleLogin, { capture: true, passive: false });
                    console.log('✅ Listener de login registrado (retry)');
                }
            }, 500);
        }
        
        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', window.handleRegister);
        }
        
        // Toggle entre login e registro
        const showRegisterBtn = document.getElementById('show-register');
        if (showRegisterBtn) {
            showRegisterBtn.addEventListener('click', () => {
                const loginContainer = document.getElementById('login-container');
                const registerContainer = document.getElementById('register-container');
                if (loginContainer) loginContainer.style.display = 'none';
                if (registerContainer) registerContainer.style.display = 'block';
            });
        }
        
        const showLoginBtn = document.getElementById('show-login');
        if (showLoginBtn) {
            showLoginBtn.addEventListener('click', () => {
                const loginContainer = document.getElementById('login-container');
                const registerContainer = document.getElementById('register-container');
                if (loginContainer) loginContainer.style.display = 'block';
                if (registerContainer) registerContainer.style.display = 'none';
            });
        }
        
        // Esqueceu senha
        const showPasswordResetBtn = document.getElementById('show-password-reset');
        if (showPasswordResetBtn) {
            showPasswordResetBtn.addEventListener('click', () => {
                showPasswordResetModal();
            });
        }
        
        // Botão de tema - usar delegação de eventos para garantir que funcione
        // Será configurado quando o DOM estiver pronto
        function setupThemeButton() {
            const themeToggleBtn = document.getElementById('theme-toggle-btn');
            if (themeToggleBtn && !themeToggleBtn._themeListener) {
                themeToggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.toggleTheme();
                });
                themeToggleBtn._themeListener = true;
                console.log('✅ Botão de tema configurado');
            }
        }
        
        // Configurar quando DOM estiver pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupThemeButton);
        } else {
            setupThemeButton();
        }
        
        // Tentar configurar novamente após um delay (caso o botão seja renderizado dinamicamente)
        setTimeout(setupThemeButton, 500);
        
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', window.handleLogout);
        }
        
        const logoutFromMaintenanceBtn = document.getElementById('logout-from-maintenance');
        if (logoutFromMaintenanceBtn) {
            logoutFromMaintenanceBtn.addEventListener('click', window.handleLogout);
        }
        
        // Back to login
        const backToLoginBtn = document.getElementById('back-to-login');
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => {
                window.showScreen('auth-section');
            });
        }
    }
    
    // ============================================================================
    // SISTEMA DE TABS BÁSICO
    // ============================================================================
    
    // Função para mostrar tab
    // ============================================================================
    // SISTEMA DE TEMA (MODO ESCURO/CLARO)
    // ============================================================================
    
    const updateThemeUI = (theme) => {
        const lightIcon = document.getElementById('theme-icon-light');
        const darkIcon = document.getElementById('theme-icon-dark');
        if (!lightIcon || !darkIcon) return;
        
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            lightIcon.classList.remove('hidden');
            darkIcon.classList.add('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            lightIcon.classList.add('hidden');
            darkIcon.classList.remove('hidden');
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
    
    window.toggleTheme = () => {
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme);
    };
    
        // Aplicar tema ao carregar (mas aguardar DOM estar pronto)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyTheme);
        } else {
            applyTheme();
        }
    
    // ============================================================================
    // POPULAÇÃO DE DROPDOWNS (IDIOMAS, MODELOS, VOZES)
    // ============================================================================
    
    // Popula seletores de idioma
    window.populateLanguageSelectors = () => {
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
            'script-lang', 'brainstorm-lang', 'viral-lang', 'optimizer-lang',
            'thumb-lang', 'scene-lang', 'reviewer-lang'
        ];
        
        const mainContent = document.getElementById('tab-content');
        if (!mainContent) return;
        
        langSelectIds.forEach(id => {
            const selectEl = mainContent.querySelector(`#${id}`);
            if (selectEl) {
                selectEl.innerHTML = langOptionsHtml;
                selectEl.value = 'Portugues (Brasil)';
            }
        });
        
        // Para tradutor, criar checkboxes
        const translatorLangOptions = mainContent.querySelector('#translator-lang-options');
        if (translatorLangOptions) {
            translatorLangOptions.innerHTML = languages.map(lang => `
                <div class="flex items-center">
                    <input type="checkbox" id="lang-${lang.value.replace(/\s/g, '-')}" value="${lang.value}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-600 dark:border-gray-500">
                    <label for="lang-${lang.value.replace(/\s/g, '-')}" class="ml-2 text-sm text-gray-600 dark:text-gray-300">${lang.text}</label>
                </div>
            `).join('');
        }
    };
    
    // Popula seletores de modelos de IA
    window.populateModelSelects = () => {
        const gptModelOptions = `
            <optgroup label="OpenAI GPT">
                <option value="gpt-4o" selected>GPT-4o</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </optgroup>
        `;
        
        const claudeModelOptions = `
            <optgroup label="Anthropic Claude">
                <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
                <option value="claude-sonnet-4">Claude Sonnet 4</option>
            </optgroup>
        `;
        
        const geminiModelOptions = `
            <optgroup label="Google Gemini">
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            </optgroup>
        `;
        
        const allModelOptions = gptModelOptions + claudeModelOptions + geminiModelOptions;
        
        const modelSelectIds = [
            'script-writer-model-select', 'viral-titles-model-select', 'script-translator-model-select',
            'scene-prompts-model-select', 'thumbnail-prompts-model-select', 'script-reviewer-model-select',
            'optimizer-model-select', 'brainstorm-ideas-model-select', 'editors-cut-model-select',
            'video-optimizer-model-select'
        ];
        
        const mainContent = document.getElementById('tab-content');
        if (!mainContent) return;
        
        modelSelectIds.forEach(id => {
            const selectEl = mainContent.querySelector(`#${id}`);
            if (selectEl) {
                selectEl.innerHTML = allModelOptions;
            }
        });
    };
    
    // Popula seletores de vozes (quando necessário)
    window.populateVoiceSelects = () => {
        // Verificar se ttsVoicePresets está disponível (do voices.js)
        if (typeof ttsVoicePresets === 'undefined' || !ttsVoicePresets.voices) {
            console.warn('ttsVoicePresets não disponível. Carregue voices.js antes.');
            return;
        }
        
        const mainContent = document.getElementById('tab-content');
        if (!mainContent) return;
        
        const voiceSelect = mainContent.querySelector('#tts-voice-select');
        if (voiceSelect) {
            voiceSelect.innerHTML = ttsVoicePresets.voices.map(voice => 
                `<option value="${voice.name}">${voice.label}</option>`
            ).join('');
        }
    };
    
    // ============================================================================
    // MAPEAMENTO DE IDs DE MÓDULOS PARA IDs DE TEMPLATES
    // ============================================================================
    
    const getTemplateId = (moduleId) => {
        const templateMapping = {
            // IDs usados na navegação lateral -> IDs dos templates
            'brainstorm-ideas': 'brainstorm-ideas-template',
            'brainstorm': 'brainstorm-ideas-template',
            'viral-titles': 'viral-titles-template',
            'script-writer': 'script-writer-template',
            'script-translator': 'script-translator-template',
            'translator': 'script-translator-template', // Mapeamento alternativo
            'scene-prompts': 'scene-prompts-template',
            'thumbnail-prompts': 'thumbnail-prompts-template',
            'image-generator': 'image-generator-template',
            'voice-generator': 'voice-generator-template',
            'script-reviewer': 'script-reviewer-template',
            'description-optimizer': 'optimizer-template',
            'optimizer': 'optimizer-template', // ID usado na navegação
            'video-optimizer': 'video-optimizer-template',
            'text-splitter': 'text-divider-template',
            'text-divider': 'text-divider-template', // ID usado na navegação
            'srt-converter': 'srt-converter-template',
            'character-detector': 'scene-prompts-template', // Não tem template próprio, está dentro de scene-prompts
            'editors-cut': 'editors-cut-template',
            'academy': 'academy-template',
            'settings': 'settings-template',
            'faq': 'faq-template',
            'admin': 'admin-template',
            'chat': 'chat-template'
        };
        return templateMapping[moduleId] || `${moduleId}-template`;
    };
    
    // ============================================================================
    // POPULAÇÃO DE FÓRMULAS DE ESTRUTURA (CRIADOR DE ROTEIRO)
    // ============================================================================
    
    window.populateFormulas = () => {
        const selectEl = document.getElementById('script-formula');
        if (!selectEl) return;
        
        // Verificar se scriptFormulas está disponível (do formulas.js)
        if (typeof scriptFormulas === 'undefined' || Object.keys(scriptFormulas).length === 0) {
            selectEl.innerHTML = '<option value="" selected disabled>-- Nenhuma Fórmula Disponível --</option>';
            return;
        }
        
        let optionsHtml = '<option value="" disabled>-- Selecione uma Fórmula --</option>';
        
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
    };
    
    // ============================================================================
    // PREENCHIMENTO AUTOMÁTICO DO CRIADOR DE ROTEIRO
    // ============================================================================
    
    // Configura preenchimento automático do Criador de Roteiro baseado no tema
    window.setupScriptWriterAutoFill = () => {
        const topicInput = document.getElementById('script-topic');
        if (!topicInput) return;
        
        // Remover listener anterior se existir
        const newTopicInput = topicInput.cloneNode(true);
        topicInput.parentNode.replaceChild(newTopicInput, topicInput);
        
        // Debounce para evitar muitas chamadas
        let autoFillTimeout;
        newTopicInput.addEventListener('blur', async () => {
            const topic = newTopicInput.value.trim();
            if (!topic || topic.length < 3) return;
            
            // Limpar timeout anterior
            clearTimeout(autoFillTimeout);
            
            // Aguardar um pouco antes de analisar (debounce)
            autoFillTimeout = setTimeout(async () => {
                await window.analyzeTopicAndAutoFill(topic);
            }, 500);
        });
    };
    
    // Analisa o tema e preenche automaticamente os campos
    window.analyzeTopicAndAutoFill = async (topic) => {
        if (!topic || topic.length < 3) return;
        
        const trendsTermInput = document.getElementById('script-trends-term');
        const toneSelect = document.getElementById('script-tone');
        const formulaSelect = document.getElementById('script-formula');
        
        if (!trendsTermInput || !toneSelect || !formulaSelect) return;
        
        // Mostrar indicador de carregamento
        const originalTrendsValue = trendsTermInput.value;
        const originalToneValue = toneSelect.value;
        const originalFormulaValue = formulaSelect.value;
        
        try {
            // Chamar API para analisar o tema (se existir)
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/analyze-topic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ topic: topic })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.suggestions) {
                    const { trendsTerm, tone, formula } = data.suggestions;
                    
                    // Preencher apenas se os campos estiverem vazios ou o usuário não tiver alterado
                    if (trendsTerm && (!originalTrendsValue || originalTrendsValue === topic)) {
                        trendsTermInput.value = trendsTerm;
                    }
                    
                    if (tone && (!originalToneValue || originalToneValue === '')) {
                        toneSelect.value = tone;
                    }
                    
                    if (formula && (!originalFormulaValue || originalFormulaValue === '')) {
                        formulaSelect.value = formula;
                    }
                    
                    if (trendsTerm || tone || formula) {
                        window.showSuccessToast('Campos preenchidos automaticamente com base no tema!');
                    }
                    return;
                }
            } else if (response.status === 404) {
                // API não existe, usar análise local (não é um erro)
                console.log('API /api/analyze-topic não disponível, usando análise local');
            }
        } catch (error) {
            // Silenciar erro 404, usar análise local
            if (error.message && !error.message.includes('404')) {
                console.log('Erro ao chamar API de análise, usando análise local:', error);
            }
        }
        
        // Se a API não existir, usar análise local simples
        window.analyzeTopicLocal(topic, trendsTermInput, toneSelect, formulaSelect);
    };
    
    // Análise local simples (fallback se API não existir) - MELHORADA PARA INCLUIR 5 TERMOS
    window.analyzeTopicLocal = (topic, trendsTermInput, toneSelect, formulaSelect) => {
        const topicLower = topic.toLowerCase();
        
        // Gerar 5 termos de pesquisa em alta baseados no tema
        // Extrair palavras-chave principais do tema
        const keywords = topic.split(/\s+/).filter(w => w.length > 2);
        
        // Gerar termos relacionados combinando palavras-chave com termos populares
        const popularTerms = [
            'em alta', 'viral', 'tendência', 'popular', 'mais buscado',
            'trending', 'em destaque', 'tendências', 'tendência 2024', 'novo'
        ];
        
        // Gerar 5 termos de pesquisa variados
        let searchTerms = [];
        if (keywords.length > 0) {
            // Termo 1: Tema original
            searchTerms.push(topic);
            
            // Termo 2: Tema + "em alta"
            searchTerms.push(`${topic} em alta`);
            
            // Termo 3: Primeira palavra-chave + "viral"
            if (keywords[0]) {
                searchTerms.push(`${keywords[0]} viral`);
            }
            
            // Termo 4: Tema + "tendência"
            searchTerms.push(`${topic} tendência`);
            
            // Termo 5: Combinação de palavras-chave principais
            if (keywords.length >= 2) {
                searchTerms.push(`${keywords.slice(0, 2).join(' ')} ${popularTerms[Math.floor(Math.random() * popularTerms.length)]}`);
            } else {
                searchTerms.push(`${topic} mais buscado`);
            }
        } else {
            // Fallback: usar o tema diretamente com variações
            searchTerms = [
                topic,
                `${topic} em alta`,
                `${topic} viral`,
                `${topic} tendência`,
                `${topic} mais buscado`
            ];
        }
        
        // Preencher com os 5 termos separados por vírgula ou quebra de linha
        if (searchTerms.length > 0 && (!trendsTermInput.value || trendsTermInput.value === topic)) {
            trendsTermInput.value = searchTerms.join(', ');
        }
        
        // Sugerir tom narrativo baseado em palavras-chave
        let suggestedTone = '';
        if (topicLower.includes('mistério') || topicLower.includes('misterio') || topicLower.includes('segredo') || topicLower.includes('descoberta') || topicLower.includes('desconhecido')) {
            suggestedTone = 'misterioso';
        } else if (topicLower.includes('tutorial') || topicLower.includes('como') || topicLower.includes('guia') || topicLower.includes('passo') || topicLower.includes('dica')) {
            suggestedTone = 'educativo';
        } else if (topicLower.includes('história') || topicLower.includes('historia') || topicLower.includes('caso') || topicLower.includes('acontecimento') || topicLower.includes('crime') || topicLower.includes('misterio')) {
            suggestedTone = 'narrativo';
        } else if (topicLower.includes('review') || topicLower.includes('análise') || topicLower.includes('analise') || topicLower.includes('opinião') || topicLower.includes('opiniao')) {
            suggestedTone = 'analítico';
        } else if (topicLower.includes('notícia') || topicLower.includes('noticia') || topicLower.includes('atual') || topicLower.includes('recente') || topicLower.includes('novidade')) {
            suggestedTone = 'jornalístico';
        } else if (topicLower.includes('conversa') || topicLower.includes('bate-papo') || topicLower.includes('podcast') || topicLower.includes('debate')) {
            suggestedTone = 'conversacional';
        } else {
            suggestedTone = 'envolvente'; // Padrão mais adequado
        }
        
        if (suggestedTone && !toneSelect.value) {
            // Verificar se o tom sugerido existe no select
            const optionExists = Array.from(toneSelect.options).some(opt => 
                opt.value === suggestedTone || opt.text.toLowerCase().includes(suggestedTone.toLowerCase())
            );
            if (optionExists) {
                // Encontrar a opção exata
                const matchingOption = Array.from(toneSelect.options).find(opt => 
                    opt.value === suggestedTone || opt.text.toLowerCase().includes(suggestedTone.toLowerCase())
                );
                if (matchingOption) {
                    toneSelect.value = matchingOption.value;
                }
            }
        }
        
        // Sugerir fórmula baseada no tema (sempre usar a padrão se não houver valor)
        if (!formulaSelect.value) {
            formulaSelect.value = 'complete_ethical_retention';
        }
        
        window.showSuccessToast('5 termos de pesquisa e campos preenchidos automaticamente!');
    };
    
    // ============================================================================
    // POPULAÇÃO DE ESTILOS DE NARRAÇÃO (GERADOR DE VOZ)
    // ============================================================================
    
    window.setupNarrationStyles = () => {
        const stylePresetSelect = document.getElementById('tts-style-preset');
        if (!stylePresetSelect) return;
        
        const narrationStyles = [
            { value: '', label: 'Nenhum (usar apenas instruções de estilo)' },
            { value: 'investigador-cetico', label: 'Investigador Cético', instructions: 'Tom cético, questionador, analítico. Fale com pausas estratégicas, entonação que demonstra dúvida e análise cuidadosa. Ritmo moderado, enfatizando pontos importantes.' },
            { value: 'misterioso-classico', label: 'Misterioso Clássico', instructions: 'Tom sombrio e enigmático, voz profunda e envolvente. Ritmo lento e dramático, com pausas longas para criar suspense. Entonação que desperta curiosidade.' },
            { value: 'investigador', label: 'Investigador', instructions: 'Tom profissional e objetivo, voz clara e assertiva. Ritmo constante, enfatizando fatos e descobertas. Entonação que transmite confiança e expertise.' },
            { value: 'contador-historias-sombrio', label: 'Contador de Histórias Sombrio', instructions: 'Tom narrativo e sombrio, voz envolvente e cativante. Ritmo variável, acelerando em momentos de tensão e desacelerando para criar atmosfera. Entonação dramática e expressiva.' },
            { value: 'suspense-cinematico', label: 'Suspense Cinemático', instructions: 'Tom cinematográfico e tenso, voz que cria atmosfera de suspense. Ritmo variável com pausas estratégicas. Entonação que constrói tensão gradualmente.' },
            { value: 'true-crime-documentario', label: 'True Crime Documentário', instructions: 'Tom documental e informativo, voz neutra mas envolvente. Ritmo constante e profissional. Entonação que transmite seriedade e credibilidade.' },
            { value: 'sussurro-intimista', label: 'Sussurro Intimista', instructions: 'Tom íntimo e próximo, voz suave e envolvente. Ritmo lento e pausado. Entonação que cria conexão pessoal com o ouvinte.' },
            { value: 'narrador-impactante', label: 'Narrador Impactante', instructions: 'Tom poderoso e impactante, voz que captura atenção. Ritmo dinâmico com variações. Entonação expressiva e envolvente.' },
            { value: 'historia-rapida-tensa', label: 'História Rápida e Tensa', instructions: 'Tom rápido e tenso, voz que mantém o ritmo acelerado. Ritmo rápido com pausas curtas. Entonação que cria urgência e tensão.' },
            { value: 'misterio-vintage', label: 'Mistério Vintage', instructions: 'Tom nostálgico e clássico, voz que remete a filmes noir. Ritmo moderado com estilo vintage. Entonação que evoca atmosfera de época.' },
            { value: 'misterio-humor-sutil', label: 'Mistério com Humor Sutil', instructions: 'Tom misterioso com toques de humor, voz que equilibra suspense e leveza. Ritmo variável. Entonação que mescla seriedade e leveza sutil.' },
            { value: 'apresentador-radio-noir', label: 'Apresentador de Rádio Noir', instructions: 'Tom de rádio noir clássico, voz profunda e característica. Ritmo moderado com estilo radiofônico. Entonação que evoca programas de rádio antigos.' },
            { value: 'narrador-lenda-urbana', label: 'Narrador de Lenda Urbana', instructions: 'Tom de contador de histórias, voz que cria atmosfera de lenda urbana. Ritmo variável com pausas dramáticas. Entonação que desperta curiosidade e medo.' },
            { value: 'guia-caso-misterioso', label: 'Guia de Caso Misterioso', instructions: 'Tom de guia e orientador, voz que conduz através do mistério. Ritmo constante e claro. Entonação que guia o ouvinte passo a passo.' },
            { value: 'narrador-cinematico-epico', label: 'Narrador Cinemático Épico', instructions: 'Tom épico e grandioso, voz que cria impacto cinematográfico. Ritmo variável com momentos de grandeza. Entonação que transmite magnitude e importância.' },
            { value: 'historia-contada-ouvido', label: 'História Contada ao Pé do Ouvido', instructions: 'Tom íntimo e pessoal, voz que parece contar um segredo. Ritmo lento e próximo. Entonação que cria proximidade e confiança.' },
            { value: 'tom-reporter-policial', label: 'Tom de Repórter Policial', instructions: 'Tom jornalístico e objetivo, voz de repórter investigativo. Ritmo constante e profissional. Entonação que transmite credibilidade e seriedade.' },
            { value: 'suspense-crescente', label: 'Suspense Crescente', instructions: 'Tom que constrói tensão gradualmente, voz que intensifica o suspense. Ritmo que acelera progressivamente. Entonação que aumenta a tensão ao longo da narração.' },
            { value: 'tom-enigmatico', label: 'Tom Enigmático', instructions: 'Tom enigmático e misterioso, voz que desperta curiosidade. Ritmo variável com pausas estratégicas. Entonação que mantém o mistério e a intriga.' }
        ];
        
        stylePresetSelect.innerHTML = narrationStyles.map(style => 
            `<option value="${style.value}">${style.label}</option>`
        ).join('');
        
        // Armazenar estilos globalmente para uso posterior
        window.narrationStylesMap = {};
        narrationStyles.forEach(style => {
            if (style.value) {
                window.narrationStylesMap[style.value] = style.instructions;
            }
        });
        
        // Adicionar listener para aplicar estilo automaticamente
        stylePresetSelect.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            const styleInstructions = document.getElementById('tts-style-instructions');
            
            if (selectedValue && window.narrationStylesMap && window.narrationStylesMap[selectedValue]) {
                if (styleInstructions) {
                    styleInstructions.value = window.narrationStylesMap[selectedValue];
                    // Disparar evento para atualizar UI se necessário
                    styleInstructions.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (selectedValue === '') {
                // Limpar instruções se "Nenhum" for selecionado
                if (styleInstructions) {
                    styleInstructions.value = '';
                }
            }
        });
    };
    
    // ============================================================================
    // FUNÇÃO SHOW TAB COMPLETA
    // ============================================================================
    
    window.showTab = (tabId) => {
        try {
            console.log(`📂 showTab chamado para: ${tabId}`);
            window.appState.currentTab = tabId;
            const mainContent = document.getElementById('tab-content');
            
            if (!mainContent) {
                console.error('❌ Elemento tab-content não encontrado!');
                return;
            }
            
            // Usar mapeamento para encontrar o template correto
            const templateId = getTemplateId(tabId);
            const template = document.getElementById(templateId);
            
            if (!template) {
                if (mainContent) mainContent.innerHTML = `<p class="text-red-500">Erro: Template para "${tabId}" (${templateId}) não encontrado.</p>`;
                console.error(`Template não encontrado: ${templateId} para módulo ${tabId}`);
                return;
            }
        
        // Verificar se devemos preservar o conteúdo (para image-generator com imagens geradas)
        const shouldPreserveContent = (tabId === 'image-generator' && 
                                      window.imageFxResults && 
                                      window.imageFxResults.images && 
                                      window.imageFxResults.images.length > 0 &&
                                      mainContent && 
                                      mainContent.querySelector('#output') && 
                                      mainContent.querySelector('#output').children.length > 0);
        
        if (!shouldPreserveContent) {
            // Limpar e recriar o conteúdo normalmente
            if (mainContent) mainContent.innerHTML = '';
            if (mainContent) mainContent.appendChild(template.content.cloneNode(true));
        } else {
            // Se devemos preservar o conteúdo, apenas garantir que o template básico existe
            const existingTemplate = mainContent.querySelector('h2');
            const hasTemplateContent = existingTemplate && existingTemplate.textContent.includes('Gerador de Imagens');
            
            if (!hasTemplateContent) {
                // Salvar o output atual antes de recriar
                const currentOutput = mainContent.querySelector('#output');
                const currentActions = mainContent.querySelector('#imagefx-actions');
                
                // Recriar apenas a estrutura básica (formulário)
                const templateClone = template.content.cloneNode(true);
                const newOutput = templateClone.querySelector('#output');
                const newActions = templateClone.querySelector('#imagefx-actions');
                
                // Substituir o conteúdo mas preservar o output
                if (mainContent) {
                    const formSection = mainContent.querySelector('.max-w-3xl');
                    if (formSection && templateClone.querySelector('.max-w-3xl')) {
                        formSection.replaceWith(templateClone.querySelector('.max-w-3xl'));
                    }
                    
                    // Restaurar o output e actions se existirem
                    if (currentOutput && newOutput) {
                        newOutput.replaceWith(currentOutput);
                    }
                    if (currentActions && newActions) {
                        newActions.replaceWith(currentActions);
                    }
                }
            }
            // Se já tem o conteúdo correto, não fazer nada
        }
        
        // Atualizar título no mobile
        const mobileHeaderTitle = document.getElementById('mobile-header-title');
        if (mobileHeaderTitle && mainContent.querySelector('h2')) {
            mobileHeaderTitle.textContent = mainContent.querySelector('h2').textContent;
        }
        
        // Fechar sidebar mobile
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
        const menuOverlay = document.getElementById('menu-overlay');
        if (menuOverlay) menuOverlay.style.display = 'none';
        
        // Navegação já foi atualizada no início da função
        
        // Inicializar event listeners específicos do módulo scene-prompts
        if (tabId === 'scene-prompts') {
            // Executar após um pequeno delay para garantir que o template foi clonado
            setTimeout(() => {
                // Renderizar histórico de prompts de cena
                if (window.renderSceneHistory) {
                    window.renderSceneHistory();
                }
                
                let generationModeSelect = document.getElementById('generation-mode');
                const manualOptions = document.getElementById('manual-options');
                const sceneWordCount = document.getElementById('scene-word-count');
                const sceneText = document.getElementById('scene-text');
                const scenePromptsCountDisplay = document.getElementById('scene-prompts-count-display');
                
                console.log('🔍 Inicializando Prompts para Cenas...');
                console.log('generationModeSelect:', generationModeSelect ? '✅ encontrado' : '❌ não encontrado');
                console.log('manualOptions:', manualOptions ? '✅ encontrado' : '❌ não encontrado');
                console.log('sceneWordCount:', sceneWordCount ? '✅ encontrado' : '❌ não encontrado');
                console.log('sceneText:', sceneText ? '✅ encontrado' : '❌ não encontrado');
                console.log('scenePromptsCountDisplay:', scenePromptsCountDisplay ? '✅ encontrado' : '❌ não encontrado');
                
                // Função para atualizar visibilidade do campo manual
                const updateManualOptionsVisibility = () => {
                    // Re-buscar os elementos caso tenham sido recriados
                    if (!generationModeSelect || !generationModeSelect.parentNode) {
                        generationModeSelect = document.getElementById('generation-mode');
                    }
                    
                    if (generationModeSelect && manualOptions) {
                        const isManual = generationModeSelect.value === 'manual';
                        manualOptions.style.display = isManual ? 'block' : 'none';
                        console.log(`📊 Modo atual: ${generationModeSelect.value}, manual-options display: ${manualOptions.style.display}`);
                        
                        // Atualizar contador de prompts quando o modo manual está ativo
                        if (isManual && sceneWordCount && sceneText && scenePromptsCountDisplay) {
                            const updateCount = () => {
                                const text = sceneText.value.trim();
                                const wordCount = parseInt(sceneWordCount.value, 10) || 100;
                                
                                if (text && wordCount > 0) {
                                    const words = text.split(/\s+/).filter(Boolean).length;
                                    const totalScenes = Math.ceil(words / wordCount);
                                    
                                    // Atualizar display com formato mais claro
                                    if (totalScenes > 0) {
                                        scenePromptsCountDisplay.textContent = `${totalScenes} ${totalScenes === 1 ? 'cena' : 'cenas'}`;
                                        scenePromptsCountDisplay.style.color = '';
                                    } else {
                                        scenePromptsCountDisplay.textContent = '-';
                                    }
                                    
                                    // Log para debug
                                    console.log(`📊 Cálculo de cenas: ${words} palavras ÷ ${wordCount} palavras/cena = ${totalScenes} cenas`);
                                } else {
                                    scenePromptsCountDisplay.textContent = '-';
                                }
                            };
                            
                            // Atualizar quando o texto ou o número de palavras mudar
                            if (!sceneText.dataset.manualListenerAdded) {
                                sceneText.addEventListener('input', updateCount);
                                sceneText.addEventListener('paste', () => setTimeout(updateCount, 10));
                                sceneText.addEventListener('change', updateCount);
                                sceneText.dataset.manualListenerAdded = 'true';
                                console.log('✅ Listener do scene-text adicionado');
                            }
                            
                            if (!sceneWordCount.dataset.manualListenerAdded) {
                                sceneWordCount.addEventListener('input', updateCount);
                                sceneWordCount.addEventListener('change', updateCount);
                                sceneWordCount.addEventListener('keyup', updateCount);
                                sceneWordCount.dataset.manualListenerAdded = 'true';
                                console.log('✅ Listener do scene-word-count adicionado');
                            }
                            
                            updateCount(); // Atualizar imediatamente
                        } else if (scenePromptsCountDisplay) {
                            // Se não está no modo manual, limpar o display
                            scenePromptsCountDisplay.textContent = '-';
                        }
                    } else {
                        console.warn('⚠️ Elementos necessários não encontrados para atualizar visibilidade');
                    }
                };
                
                // Adicionar listener para mudança de modo
                if (generationModeSelect) {
                    // Remover listener anterior se existir (usando atributo para evitar duplicatas)
                    if (generationModeSelect.dataset.listenerAdded) {
                        const newSelect = generationModeSelect.cloneNode(true);
                        generationModeSelect.parentNode.replaceChild(newSelect, generationModeSelect);
                        generationModeSelect = newSelect;
                    }
                    
                    // Adicionar listener
                    generationModeSelect.addEventListener('change', () => {
                        console.log('🔄 Modo de geração mudou para:', generationModeSelect.value);
                        updateManualOptionsVisibility();
                    });
                    generationModeSelect.dataset.listenerAdded = 'true';
                    
                    // Atualizar imediatamente
                    updateManualOptionsVisibility();
                    console.log('✅ Listener do modo de geração configurado. Modo atual:', generationModeSelect.value);
                } else {
                    console.warn('⚠️ generationModeSelect não encontrado');
                }
            }, 300); // Aumentar timeout para garantir que o template foi clonado
        }
        
        // Popular dropdowns
        window.populateModelSelects();
        window.populateLanguageSelectors();
        
        // Inicializações específicas por módulo
        if (tabId === 'script-writer') {
            // Aguardar um pouco para garantir que o select existe
            setTimeout(() => {
                // Renderizar histórico de roteiros
                if (window.renderScriptHistory) {
                    window.renderScriptHistory();
                }
                
                window.populateFormulas();
                // Configurar preenchimento automático baseado no tema
                window.setupScriptWriterAutoFill();
            }, 100);
        }
        
        if (tabId === 'voice-generator') {
            // Aguardar um pouco para garantir que os selects existem
            setTimeout(() => {
                window.populateVoiceSelects();
                window.setupNarrationStyles();
            }, 100);
        }
        
        // Inicializar módulo se necessário
        if (window.moduleLoader) {
            // Tentar vários IDs possíveis
            const possibleIds = [tabId, templateId.replace('-template', ''), getTemplateId(tabId).replace('-template', '')];
            // Mapeamento especial para alguns módulos
            const idMapping = {
                'text-splitter': 'text-splitter',
                'text-divider': 'text-splitter',
                'split-text': 'text-splitter'
            };
            
            for (const id of possibleIds) {
                const moduleId = idMapping[id] || id;
                const module = window.moduleLoader.getModule(moduleId);
                if (module && typeof module.init === 'function') {
                    // Para text-splitter, aguardar um pouco para garantir que o template foi renderizado
                    if (moduleId === 'text-splitter') {
                        setTimeout(() => module.init(), 150);
                    } else {
                        module.init();
                    }
                    break;
                }
            }
        }
        
        // Chamar funções de inicialização específicas dos módulos
        const initFunctions = {
            'academy': 'initializeAcademy',
            'settings': 'initializeSettings',
            'faq': 'initializeFAQ',
            'admin': 'initializeAdminPanel',
            'chat': 'initializeChatWidget',
            'script-translator': 'initializeScriptTranslator',
            'translator': 'initializeScriptTranslator',
            'scene-prompts': 'initializeScenePrompts',
            'text-splitter': 'initializeTextDivider',
            'text-divider': 'initializeTextDivider',
            'srt-converter': 'initializeSrtConverter',
            'video-optimizer': 'initializeVideoOptimizer',
            'editors-cut': 'initializeEditorsCut',
            'voice-generator': 'initializeVoiceGenerator'
        };
        
        const initFunctionName = initFunctions[tabId] || initFunctions[getTemplateId(tabId).replace('-template', '')];
        if (initFunctionName && typeof window[initFunctionName] === 'function') {
            // Aguardar um pouco para garantir que o template foi clonado antes de inicializar
            // Especialmente importante para text-splitter que precisa dos elementos renderizados
            if (tabId === 'text-splitter' || tabId === 'text-divider') {
                setTimeout(() => {
                    window[initFunctionName]();
                }, 250);
            } else {
                setTimeout(() => {
                    window[initFunctionName]();
                }, 100);
            }
        }
        
        // Anexar event listeners aos botões
        attachTabEventListeners(tabId);
        
        // Configurações específicas para voice-generator (cálculo automático de duração)
        if (tabId === 'voice-generator') {
            setTimeout(() => {
                const ttsInput = document.getElementById('tts-script-input');
                const durationHint = document.getElementById('tts-duration-hint');
                const charCount = document.getElementById('tts-char-count');
                
                if (ttsInput && durationHint) {
                    const calculateTtsDuration = () => {
                        const text = ttsInput.value.trim();
                        if (!text) {
                            durationHint.textContent = 'Adicione o roteiro para calcular a duração.';
                            if (charCount) charCount.textContent = '';
                            return;
                        }
                        
                        const words = text.split(/\s+/).filter(Boolean).length;
                        const chars = text.length;
                        
                        // Estimativa: 150 palavras por minuto para narração
                        const wordsPerMinute = 150;
                        const totalMinutes = words / wordsPerMinute;
                        const totalSeconds = Math.round(totalMinutes * 60);
                        const minutes = Math.floor(totalSeconds / 60);
                        const seconds = totalSeconds % 60;
                        const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                        
                        durationHint.textContent = `Duração estimada: ${formattedTime} (${words} palavras)`;
                        if (charCount) {
                            charCount.textContent = `${chars.toLocaleString()} caracteres`;
                        }
                    };
                    
                    // Adicionar listeners se ainda não foram adicionados
                    if (!ttsInput.dataset.durationListenerAdded) {
                        ttsInput.addEventListener('input', calculateTtsDuration);
                        ttsInput.addEventListener('paste', () => setTimeout(calculateTtsDuration, 10));
                        ttsInput.dataset.durationListenerAdded = 'true';
                    }
                    
                    // Calcular imediatamente se já houver texto
                    calculateTtsDuration();
                }
            }, 100);
        }
        
        // Configurações específicas para script-writer (cálculo automático de partes)
        if (tabId === 'script-writer') {
            setTimeout(() => {
                const scriptDurationEl = document.getElementById('script-duration');
                if (scriptDurationEl) {
                    // Remover listener anterior se existir
                    const newDurationEl = scriptDurationEl.cloneNode(true);
                    scriptDurationEl.parentNode.replaceChild(newDurationEl, scriptDurationEl);
                    
                    newDurationEl.addEventListener('input', e => {
                        const duration = parseInt(e.target.value);
                        if (!isNaN(duration) && duration > 0) {
                            // Calcular partes proporcionalmente: cada parte entre 2-3 minutos
                            // Ideal: 2.5 minutos por parte (média entre 2-3)
                            let parts = Math.max(1, Math.ceil(duration / 2.5));
                            
                            // Verificar se com esse número de partes, cada parte ficaria < 2 min ou > 3 min
                            const durationPerPart = duration / parts;
                            if (durationPerPart < 2) {
                                // Se ficar menos de 2 min por parte, reduzir número de partes
                                parts = Math.max(1, Math.floor(duration / 2));
                            } else if (durationPerPart > 3) {
                                // Se ficar mais de 3 min por parte, aumentar número de partes
                                parts = Math.max(1, Math.ceil(duration / 3));
                            }
                            
                            const scriptPartsEl = document.getElementById('script-parts');
                            if (scriptPartsEl) {
                                scriptPartsEl.value = parts;
                                const finalDurationPerPart = duration / parts;
                                console.log(`📊 Duração: ${duration} minutos → ${parts} partes (${finalDurationPerPart.toFixed(1)} min/parte, entre 2-3 min)`);
                            }
                        }
                    });
                    
                    // Calcular partes inicialmente se já houver duração
                    const scriptPartsEl = document.getElementById('script-parts');
                    if (newDurationEl.value && scriptPartsEl) {
                        const duration = parseInt(newDurationEl.value);
                        if (!isNaN(duration) && duration > 0) {
                            // Calcular partes proporcionalmente: cada parte entre 2-3 minutos
                            // Ideal: 2.5 minutos por parte (média entre 2-3)
                            let parts = Math.max(1, Math.ceil(duration / 2.5));
                            
                            // Verificar se com esse número de partes, cada parte ficaria < 2 min ou > 3 min
                            const durationPerPart = duration / parts;
                            if (durationPerPart < 2) {
                                parts = Math.max(1, Math.floor(duration / 2));
                            } else if (durationPerPart > 3) {
                                parts = Math.max(1, Math.ceil(duration / 3));
                            }
                            
                            scriptPartsEl.value = parts;
                            const finalDurationPerPart = duration / parts;
                            console.log(`📊 Cálculo inicial: ${duration} minutos → ${parts} partes (${finalDurationPerPart.toFixed(1)} min/parte, entre 2-3 min)`);
                        }
                    }
                }
            }, 100);
        }
        
        } catch (error) {
            console.error('❌ Erro em showTab:', error);
            // Garantir que a navegação visual seja atualizada mesmo com erro
            document.querySelectorAll('.sidebar-btn').forEach(btn => {
                const btnTabId = btn.dataset.tab || btn.getAttribute('data-tab');
                if (btnTabId === tabId) {
                    btn.classList.add('bg-blue-100', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
                    btn.classList.remove('text-gray-700', 'dark:text-gray-300');
                } else {
                    btn.classList.remove('bg-blue-100', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400');
                    btn.classList.add('text-gray-700', 'dark:text-gray-300');
                }
            });
        }
    };
    
    // ============================================================================
    // ANEXAR EVENT LISTENERS AOS BOTÕES
    // ============================================================================
    
    // Remover listener anterior para evitar duplicatas
    let mainContentClickListener = null;
    
    function attachTabEventListeners(tabId) {
        const mainContent = document.getElementById('tab-content');
        if (!mainContent) return;
        
        // Remover listener anterior se existir
        if (mainContentClickListener) {
            mainContent.removeEventListener('click', mainContentClickListener, true);
            mainContentClickListener = null;
        }
        
        // Aguardar um pouco para garantir que o DOM está pronto
        setTimeout(() => {
            // Event listeners para botões usando delegação de eventos
            mainContentClickListener = (e) => {
                const button = e.target.closest('button');
                if (!button || !button.id) return;
                
                const buttonId = button.id;
                
                // Mapeamento de IDs de botão para nomes de handler
                const buttonToHandlerMap = {
                    'convert-srt-button': 'convert-to-srt',
                    'detect-characters-btn': 'detect-characters-btn',
                    'split-text-btn': 'split-text-btn',
                    'generate-script': 'generate-script',
                    'tts-generate-btn': 'tts-generate-btn',
                    'tts-preview-btn': 'tts-preview-btn',
                    'generate-imagefx': 'generate-imagefx',
                    'generate-scene-prompts': 'generate-scene-prompts',
                    'analyze-script-btn': 'analyze-script-btn',
                    'apply-suggestions-btn': 'apply-suggestions-btn',
                    'apply-manual-btn': 'apply-manual-btn',
                    'optimize-script-btn': 'optimize-script-btn',
                    'analyze-video-btn': 'analyze-video-btn',
                    'translate-script': 'translate-script',
                    'generate-viral-titles': 'generate-viral-titles',
                    'generate-editors-cut': 'generate-editors-cut'
                };
                
                // Obter o nome do handler (pode ser o próprio ID ou um mapeamento)
                const handlerName = buttonToHandlerMap[buttonId] || buttonId;
                
                // Verificar se é um handler registrado
                const handler = window.handlers[handlerName];
                
                // Debug: log quando o botão é clicado
                if (buttonId === 'generate-script' || buttonId === 'translate-script') {
                    console.log(`🔵 Botão ${buttonId} clicado!`, {
                        handlerName,
                        hasHandler: !!handler,
                        handlerType: typeof handler,
                        allHandlers: Object.keys(window.handlers || {})
                    });
                }
                
                if (handler && typeof handler === 'function') {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Debug: log antes de executar
                    if (buttonId === 'generate-script' || buttonId === 'translate-script') {
                        console.log(`✅ Executando handler ${handlerName}...`);
                    }
                    
                    // Executar handler de forma assíncrona sem bloquear
                    // Não retornar Promise para evitar conflitos com extensões do navegador
                    (async () => {
                        try {
                            // Se o handler retornar uma Promise, aguardar
                            const result = handler(e);
                            if (result instanceof Promise) {
                                await result;
                            }
                            if (buttonId === 'generate-script' || buttonId === 'translate-script') {
                                console.log(`✅ Handler ${handlerName} executado com sucesso`);
                            }
                        } catch (error) {
                            console.error(`❌ Erro ao executar handler ${handlerName}:`, error);
                            console.error('Stack trace:', error.stack);
                            if (window.showSuccessToast) {
                                window.showSuccessToast(`Erro: ${error.message}`, true);
                            }
                        }
                    })();
                    
                    // Retornar false explicitamente para evitar conflitos
                    return false;
                } else if (buttonId === 'generate-script' || buttonId === 'translate-script') {
                    console.error(`❌ Handler ${handlerName} não encontrado ou não é uma função!`, {
                        handlerName,
                        handler,
                        availableHandlers: Object.keys(window.handlers || {})
                    });
                }
            };
            
            mainContent.addEventListener('click', mainContentClickListener, true); // Use capture phase
            
            console.log(`✅ Event listeners anexados para ${tabId}`);
        }, 100);
    };
    
    // ============================================================================
    // INICIALIZAÇÃO DO SISTEMA DE MÓDULOS
    // ============================================================================
    
    async function initializeModules() {
        try {
            console.log('📦 Carregando módulos...');
            
            // Importar ModuleLoader
            const { default: ModuleLoader } = await import('./modules/frontend/loader.js');
            const loader = new ModuleLoader();
            window.ModuleLoader = ModuleLoader;
            window.moduleLoader = loader;
            
            // Garantir que o loader está disponível globalmente
            if (!window.moduleLoader) {
                window.moduleLoader = loader;
            }
            
            // Carregar todos os módulos
            const moduleHandlers = await loader.loadAllModules();
            
            // Mapeamento de IDs dos módulos para nomes dos handlers (igual ao integration-modular.js)
            // Nota: O loader já registra handlers com o nome correto via getHandlerName(), mas garantimos aqui também
            const handlerMapping = {
                'brainstorm-ideas': 'generate-brainstorm-ideas',
                'brainstorm': 'generate-brainstorm-ideas', // Nome do arquivo
                'viral-titles': 'generate-viral-content',
                'script-writer': 'generate-script',
                'script-translator': 'translate-script',
                'translator': 'translate-script', // Nome do arquivo
                'scene-prompts': 'generate-scene-prompts',
                'thumbnail-prompts': 'generate-prompts',
                'image-generator': 'generate-imagefx',
                'voice-generator': 'tts-generate-btn',
                'script-reviewer': 'analyze-script-btn',
                'description-optimizer': 'optimize-script-btn',
                'video-optimizer': 'analyze-video-btn',
                'text-splitter': 'split-text-btn',
                'text-divider': 'split-text-btn',
                'srt-converter': 'convert-to-srt',
                'character-detector': 'detect-characters-btn'
            };
            
            // Registrar handlers dos módulos
            // O loader retorna um Map com os handlers, vamos garantir que todos sejam registrados
            let registeredCount = 0;
            
            console.log('🔍 moduleHandlers recebido:', {
                type: typeof moduleHandlers,
                isMap: moduleHandlers instanceof Map,
                keys: moduleHandlers instanceof Map ? Array.from(moduleHandlers.keys()) : Object.keys(moduleHandlers || {})
            });
            
            // Primeiro, registrar handlers do Map retornado pelo loader
            if (moduleHandlers && moduleHandlers instanceof Map) {
                for (const [key, handlerFunc] of moduleHandlers.entries()) {
                    if (typeof handlerFunc === 'function') {
                        // Registrar com o nome do handler correto do mapeamento
                        if (handlerMapping[key]) {
                            window.handlers[handlerMapping[key]] = handlerFunc;
                            registeredCount++;
                            console.log(`✅ Handler '${handlerMapping[key]}' registrado do módulo '${key}'`);
                        }
                        // Também registrar com o nome original (caso já seja o nome do handler)
                        // Isso garante que handlers já registrados pelo loader continuem funcionando
                        if (!window.handlers[key] || key === handlerMapping[key]) {
                            window.handlers[key] = handlerFunc;
                        }
                    }
                }
            } else if (moduleHandlers && typeof moduleHandlers === 'object') {
                // Se for um objeto, iterar sobre as chaves
                for (const [key, handlerFunc] of Object.entries(moduleHandlers)) {
                    if (typeof handlerFunc === 'function') {
                        if (handlerMapping[key]) {
                            window.handlers[handlerMapping[key]] = handlerFunc;
                            registeredCount++;
                            console.log(`✅ Handler '${handlerMapping[key]}' registrado do módulo '${key}' (objeto)`);
                        }
                        if (!window.handlers[key] || key === handlerMapping[key]) {
                            window.handlers[key] = handlerFunc;
                        }
                    }
                }
            }
            
            // Garantir que o handler 'generate-script' está registrado diretamente do módulo script-writer
            const scriptWriterModule = loader.getModule('script-writer');
            console.log('🔍 Verificando módulo script-writer:', {
                moduleExists: !!scriptWriterModule,
                hasHandler: scriptWriterModule && typeof scriptWriterModule.handler === 'function',
                moduleId: scriptWriterModule?.id
            });
            
            if (scriptWriterModule && typeof scriptWriterModule.handler === 'function') {
                // Registrar com bind para manter o contexto
                const boundHandler = scriptWriterModule.handler.bind(scriptWriterModule);
                window.handlers['generate-script'] = boundHandler;
                console.log('✅ Handler generate-script registrado diretamente do módulo script-writer');
                registeredCount++;
            } else {
                console.error('❌ Módulo script-writer não encontrado ou handler não disponível!', {
                    module: scriptWriterModule,
                    handlerType: scriptWriterModule?.handler ? typeof scriptWriterModule.handler : 'undefined'
                });
            }
            
            // Garantir que o handler 'translate-script' está registrado diretamente do módulo translator
            const translatorModule = loader.getModule('script-translator') || loader.getModule('translator');
            console.log('🔍 Verificando módulo translator:', {
                moduleExists: !!translatorModule,
                hasHandler: translatorModule && typeof translatorModule.handler === 'function',
                moduleId: translatorModule?.id
            });
            
            if (translatorModule && typeof translatorModule.handler === 'function') {
                // Registrar com bind para manter o contexto
                const boundHandler = translatorModule.handler.bind(translatorModule);
                window.handlers['translate-script'] = boundHandler;
                console.log('✅ Handler translate-script registrado diretamente do módulo translator');
                registeredCount++;
            } else {
                console.error('❌ Módulo translator não encontrado ou handler não disponível!', {
                    module: translatorModule,
                    handlerType: translatorModule?.handler ? typeof translatorModule.handler : 'undefined'
                });
            }
            
            // Também verificar handlers do loader diretamente
            const loaderHandlers = loader.handlers || (loader.getAllHandlers ? loader.getAllHandlers() : null);
            if (loaderHandlers) {
                if (loaderHandlers instanceof Map) {
                    console.log('🔍 Handlers no loader (Map):', Array.from(loaderHandlers.keys()));
                    if (loaderHandlers.has('generate-script')) {
                        window.handlers['generate-script'] = loaderHandlers.get('generate-script');
                        console.log('✅ Handler generate-script copiado do loader (Map)');
                    }
                    if (loaderHandlers.has('script-writer')) {
                        window.handlers['generate-script'] = loaderHandlers.get('script-writer');
                        console.log('✅ Handler generate-script copiado do loader (script-writer do Map)');
                    }
                    if (loaderHandlers.has('translate-script')) {
                        window.handlers['translate-script'] = loaderHandlers.get('translate-script');
                        console.log('✅ Handler translate-script copiado do loader (Map)');
                    }
                    if (loaderHandlers.has('script-translator') || loaderHandlers.has('translator')) {
                        const translatorKey = loaderHandlers.has('script-translator') ? 'script-translator' : 'translator';
                        window.handlers['translate-script'] = loaderHandlers.get(translatorKey);
                        console.log(`✅ Handler translate-script copiado do loader (${translatorKey} do Map)`);
                    }
                } else if (typeof loaderHandlers === 'object') {
                    console.log('🔍 Handlers no loader (Object):', Object.keys(loaderHandlers));
                    if (loaderHandlers['generate-script']) {
                        window.handlers['generate-script'] = loaderHandlers['generate-script'];
                        console.log('✅ Handler generate-script copiado do loader (Object)');
                    }
                    if (loaderHandlers['script-writer']) {
                        window.handlers['generate-script'] = loaderHandlers['script-writer'];
                        console.log('✅ Handler generate-script copiado do loader (script-writer do Object)');
                    }
                    if (loaderHandlers['translate-script']) {
                        window.handlers['translate-script'] = loaderHandlers['translate-script'];
                        console.log('✅ Handler translate-script copiado do loader (Object)');
                    }
                    if (loaderHandlers['script-translator'] || loaderHandlers['translator']) {
                        const translatorKey = loaderHandlers['script-translator'] ? 'script-translator' : 'translator';
                        window.handlers['translate-script'] = loaderHandlers[translatorKey];
                        console.log(`✅ Handler translate-script copiado do loader (${translatorKey} do Object)`);
                    }
                }
            }
            
            // Última tentativa: buscar diretamente do Map do loader
            if (!window.handlers['generate-script'] && loader.handlers instanceof Map) {
                // Tentar todas as chaves possíveis
                const possibleKeys = ['generate-script', 'script-writer'];
                for (const key of possibleKeys) {
                    if (loader.handlers.has(key)) {
                        window.handlers['generate-script'] = loader.handlers.get(key);
                        console.log(`✅ Handler generate-script encontrado no loader com chave '${key}'`);
                        break;
                    }
                }
            }
            
            // Última tentativa para translate-script: buscar diretamente do Map do loader
            if (!window.handlers['translate-script'] && loader.handlers instanceof Map) {
                // Tentar todas as chaves possíveis
                const possibleKeys = ['translate-script', 'script-translator', 'translator'];
                for (const key of possibleKeys) {
                    if (loader.handlers.has(key)) {
                        window.handlers['translate-script'] = loader.handlers.get(key);
                        console.log(`✅ Handler translate-script encontrado no loader com chave '${key}'`);
                        break;
                    }
                }
            }
            
            // Debug: verificar se os handlers foram registrados
            console.log('📋 Handlers registrados:', {
                'generate-script': typeof window.handlers['generate-script'],
                'translate-script': typeof window.handlers['translate-script'],
                totalHandlers: Object.keys(window.handlers).length,
                allHandlerNames: Object.keys(window.handlers).slice(0, 15) // Primeiros 15 para debug
            });
            
            // VERIFICAÇÃO FINAL ABSOLUTA: Se ainda não estiver registrado, forçar registro
            if (!window.handlers['generate-script'] || typeof window.handlers['generate-script'] !== 'function') {
                console.warn('⚠️ Handler generate-script ainda não registrado. Forçando registro...');
                
                // Buscar no loader.handlers Map
                if (loader.handlers instanceof Map) {
                    const handlerFromMap = loader.handlers.get('generate-script') || loader.handlers.get('script-writer');
                    if (handlerFromMap && typeof handlerFromMap === 'function') {
                        window.handlers['generate-script'] = handlerFromMap;
                        console.log('✅ Handler generate-script FORÇADO do Map do loader');
                    }
                }
                
                // Se ainda não funcionou, buscar diretamente do módulo
                if (!window.handlers['generate-script'] || typeof window.handlers['generate-script'] !== 'function') {
                    const finalModule = loader.getModule('script-writer');
                    if (finalModule && typeof finalModule.handler === 'function') {
                        window.handlers['generate-script'] = finalModule.handler;
                        console.log('✅ Handler generate-script FORÇADO diretamente do módulo');
                    }
                }
            }
            
            // VERIFICAÇÃO FINAL ABSOLUTA para translate-script: Se ainda não estiver registrado, forçar registro
            if (!window.handlers['translate-script'] || typeof window.handlers['translate-script'] !== 'function') {
                console.warn('⚠️ Handler translate-script ainda não registrado. Forçando registro...');
                
                // Buscar no loader.handlers Map
                if (loader.handlers instanceof Map) {
                    const handlerFromMap = loader.handlers.get('translate-script') || 
                                          loader.handlers.get('script-translator') || 
                                          loader.handlers.get('translator');
                    if (handlerFromMap && typeof handlerFromMap === 'function') {
                        window.handlers['translate-script'] = handlerFromMap;
                        console.log('✅ Handler translate-script FORÇADO do Map do loader');
                    }
                }
                
                // Se ainda não funcionou, buscar diretamente do módulo
                if (!window.handlers['translate-script'] || typeof window.handlers['translate-script'] !== 'function') {
                    const finalModule = loader.getModule('script-translator') || loader.getModule('translator');
                    if (finalModule && typeof finalModule.handler === 'function') {
                        window.handlers['translate-script'] = finalModule.handler;
                        console.log('✅ Handler translate-script FORÇADO diretamente do módulo');
                    }
                }
            }
            
            // Confirmação final para translate-script
            if (window.handlers['translate-script'] && typeof window.handlers['translate-script'] === 'function') {
                console.log('✅✅✅ Handler translate-script CONFIRMADO e pronto para uso!');
            } else {
                console.error('❌❌❌ Handler translate-script NÃO FOI REGISTRADO após todas as tentativas!');
            }
            
            // Confirmação final
            if (window.handlers['generate-script'] && typeof window.handlers['generate-script'] === 'function') {
                console.log('✅✅✅ Handler generate-script FINALMENTE registrado e é uma função!');
            } else {
                console.error('❌❌❌ ERRO CRÍTICO: Handler generate-script NÃO PODE SER REGISTRADO!');
                console.error('Tentando criar handler temporário...');
                
                // IMPORTANTE: Capturar o loader na hora da criação do handler
                // Isso garante que o loader esteja disponível quando o handler for chamado
                const capturedLoader = loader;
                const capturedModuleHandlers = moduleHandlers;
                
                window.handlers['generate-script'] = async function(e, continueGeneration = false) {
                    console.log('🔄 Handler temporário chamado, buscando módulo...');
                    
                    // Tentar múltiplas formas de acessar o loader e o módulo
                    let module = null;
                    let loaderToUse = capturedLoader || window.moduleLoader;
                    
                    console.log('🔍 Debug - Loaders disponíveis:', {
                        capturedLoader: !!capturedLoader,
                        windowModuleLoader: !!window.moduleLoader,
                        loaderToUse: !!loaderToUse
                    });
                    
                    // Tentar 1: Loader capturado do escopo (mais confiável)
                    if (capturedLoader && typeof capturedLoader.getModule === 'function') {
                        try {
                            module = capturedLoader.getModule('script-writer');
                            console.log('🔍 Tentativa 1 - Loader capturado:', { found: !!module, moduleId: module?.id });
                        } catch (err) {
                            console.error('Erro ao buscar módulo no loader capturado:', err);
                        }
                    }
                    
                    // Tentar 2: window.moduleLoader
                    if (!module && window.moduleLoader && typeof window.moduleLoader.getModule === 'function') {
                        try {
                            loaderToUse = window.moduleLoader;
                            module = loaderToUse.getModule('script-writer');
                            console.log('🔍 Tentativa 2 - window.moduleLoader:', { found: !!module, moduleId: module?.id });
                        } catch (err) {
                            console.error('Erro ao buscar módulo no window.moduleLoader:', err);
                        }
                    }
                    
                    // Tentar 3: Buscar diretamente nos módulos do loader
                    if (!module && loaderToUse && loaderToUse.modules && loaderToUse.modules instanceof Map) {
                        try {
                            module = loaderToUse.modules.get('script-writer');
                            console.log('🔍 Tentativa 3 - loader.modules Map:', { found: !!module, moduleId: module?.id });
                        } catch (err) {
                            console.error('Erro ao buscar no loader.modules:', err);
                        }
                    }
                    
                    // Tentar 4: Buscar handlers diretamente no loader (pode ter o handler já pronto)
                    if (loaderToUse && loaderToUse.handlers instanceof Map) {
                        const handler = loaderToUse.handlers.get('script-writer') || loaderToUse.handlers.get('generate-script');
                        if (handler && typeof handler === 'function') {
                            console.log('🔍 Tentativa 4 - Handler encontrado no loader, executando diretamente...');
                            return await handler(e, continueGeneration);
                        }
                    }
                    
                    // Tentar 5: Buscar no moduleHandlers capturado
                    if (!module && capturedModuleHandlers instanceof Map) {
                        const handler = capturedModuleHandlers.get('script-writer') || capturedModuleHandlers.get('generate-script');
                        if (handler && typeof handler === 'function') {
                            console.log('🔍 Tentativa 5 - Handler encontrado no moduleHandlers capturado');
                            return await handler(e, continueGeneration);
                        }
                    }
                    
                    // Tentar 6: Buscar em window.handlers (pode ter sido registrado com outro nome)
                    const possibleHandlers = ['script-writer', 'generate-script'];
                    for (const key of possibleHandlers) {
                        if (window.handlers[key] && typeof window.handlers[key] === 'function' && key !== 'generate-script') {
                            console.log(`🔍 Tentativa 6 - Handler encontrado em window.handlers['${key}']`);
                            return await window.handlers[key](e, continueGeneration);
                        }
                    }
                    
                    if (module && typeof module.handler === 'function') {
                        console.log('✅ Módulo encontrado, executando handler...');
                        return await module.handler(e, continueGeneration);
                    } else {
                        console.error('❌ Módulo script-writer não encontrado após todas as tentativas!');
                        console.error('Loader capturado:', !!capturedLoader);
                        console.error('window.moduleLoader:', !!window.moduleLoader);
                        console.error('loaderToUse:', !!loaderToUse);
                        if (loaderToUse) {
                            console.error('Módulos no loader:', loaderToUse.listModules ? loaderToUse.listModules() : 'N/A');
                            console.error('Handlers no loader:', loaderToUse.handlers instanceof Map ? Array.from(loaderToUse.handlers.keys()) : 'N/A');
                        }
                        if (window.showSuccessToast) {
                            window.showSuccessToast('Erro: Módulo script-writer não encontrado. Recarregue a página.', true);
                        }
                        throw new Error('Módulo script-writer não encontrado. Recarregue a página.');
                    }
                };
                console.log('✅ Handler temporário criado');
            }
            
            // Inicializar todos os módulos (isso também registra handlers adicionais como tts-preview-btn)
            for (const moduleId of loader.listModules()) {
                await loader.initModule(moduleId);
            }
            
            // Registrar handlers adicionais dos módulos (como tts-preview-btn do voice-generator)
            const voiceModule = loader.getModule('voice-generator');
            if (voiceModule && typeof voiceModule.previewHandler === 'function') {
                window.handlers['tts-preview-btn'] = voiceModule.previewHandler.bind(voiceModule);
                registeredCount++;
                console.log(`✅ Handler 'tts-preview-btn' registrado do módulo 'voice-generator'`);
            }
            
            console.log(`✅ ${loader.listModules().length} módulos carregados com sucesso!`);
            console.log(`✅ ${registeredCount} handlers registrados via mapeamento`);
            console.log(`✅ Total de handlers: ${Object.keys(window.handlers).length}`);
            console.log('📋 Handlers disponíveis:', Object.keys(window.handlers).sort());
            
            // Configurar event listeners para botões
            setupEventListeners();
            
        } catch (error) {
            console.error('❌ Erro ao inicializar módulos:', error);
            window.addToLog('Erro ao carregar módulos. Recarregue a página.', true);
        }
    }
    
    // ============================================================================
    // CONFIGURAÇÃO DE EVENT LISTENERS
    // ============================================================================
    
    function setupEventListeners() {
        // Event listeners para botões de copiar (delegation)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn') || e.target.closest('.copy-btn')) {
                const btn = e.target.classList.contains('copy-btn') ? e.target : e.target.closest('.copy-btn');
                const text = btn.dataset.text || btn.getAttribute('data-text');
                if (text) {
                    navigator.clipboard.writeText(text).then(() => {
                        window.showSuccessToast('Texto copiado!');
                    }).catch(() => {
                        window.showSuccessToast('Erro ao copiar texto.', true);
                    });
                }
            }
        });
        
        // Event listeners para botões de tabs (delegation) - CORRIGIDO PARA NÃO BLOQUEAR LOGIN
        const handleSidebarClick = (e) => {
            // CRÍTICO: Ignorar completamente se for um formulário ou botão de formulário
            const form = e.target.closest('form');
            if (form) {
                return; // Deixar formulários funcionarem normalmente - NÃO INTERFERIR
            }
            
            // Ignorar botões de submit de formulários
            if (e.target.type === 'submit' || e.target.closest('button[type="submit"]')) {
                return; // Deixar formulários processarem normalmente
            }
            
            // Verificar se é um botão da sidebar ANTES de qualquer outra verificação
            const sidebarBtn = e.target.closest('.sidebar-btn');
            if (sidebarBtn) {
                const tabId = sidebarBtn.dataset.tab || sidebarBtn.getAttribute('data-tab');
                if (tabId) {
                    // IMPORTANTE: Parar propagação mas NÃO bloquear outros listeners importantes (como login)
                    e.preventDefault();
                    e.stopPropagation(); // Usar stopPropagation (não stopImmediatePropagation) para não bloquear login
                    e.stopImmediatePropagation(); // CRÍTICO: Parar TODOS os listeners na fase de capture para garantir que navegação funcione
                    console.log(`🔄 Navegando para: ${tabId}`);
                    try {
                        if (typeof window.showTab === 'function') {
                            window.showTab(tabId);
                        } else {
                            console.error('❌ window.showTab não é uma função!');
                        }
                    } catch (error) {
                        console.error('❌ Erro ao navegar:', error);
                        console.error('Stack:', error.stack);
                    }
                    return false;
                } else {
                    console.warn('⚠️ Botão clicado mas sem data-tab:', sidebarBtn);
                }
            }
        };
        
        // Registrar event listener com capture e PRIORIDADE MÁXIMA (primeiro na lista)
        // Usar capture phase para garantir que executa ANTES de outros listeners
        document.addEventListener('click', handleSidebarClick, { capture: true, passive: false });
        
        // FALLBACK: Registrar também diretamente nos botões da sidebar quando disponíveis
        // Isso garante que mesmo se o event delegation falhar, os botões ainda funcionam
        const registerSidebarButtonsDirectly = () => {
            const sidebarButtons = document.querySelectorAll('.sidebar-btn');
            sidebarButtons.forEach(btn => {
                // Remover listeners anteriores para evitar duplicatas
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                // Adicionar listener direto
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    const tabId = newBtn.dataset.tab || newBtn.getAttribute('data-tab');
                    if (tabId && typeof window.showTab === 'function') {
                        console.log(`🔄 Navegação direta para: ${tabId}`);
                        window.showTab(tabId);
                    }
                }, { capture: true });
            });
            if (sidebarButtons.length > 0) {
                console.log(`✅ ${sidebarButtons.length} botões da sidebar registrados diretamente (fallback)`);
            }
        };
        
        // Registrar imediatamente se os botões já existem
        if (document.querySelectorAll('.sidebar-btn').length > 0) {
            registerSidebarButtonsDirectly();
        }
        
        // Registrar também quando o DOM estiver pronto (fallback)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', registerSidebarButtonsDirectly);
        } else {
            // DOM já está pronto, aguardar um pouco para garantir que sidebar foi renderizada
            setTimeout(registerSidebarButtonsDirectly, 500);
        }
        
        console.log('✅ Event listeners de navegação registrados');
        
        // Event listeners para handlers de botões (delegation)
        // IMPORTANTE: Verificar se NÃO é um botão da sidebar ou formulário antes de processar
        // Os handlers são chamados através do sistema de módulos
        // Exemplo: <button id="generate-brainstorm-ideas"> será chamado através do módulo
        document.addEventListener('click', (e) => {
            // CRÍTICO: Ignorar se for um botão da sidebar
            if (e.target.closest('.sidebar-btn')) {
                return; // Não processar botões da sidebar aqui
            }
            
            // CRÍTICO: Ignorar se for um formulário ou botão de formulário
            const form = e.target.closest('form');
            if (form) {
                return; // Deixar formulários funcionarem normalmente
            }
            
            // Ignorar botões de submit
            if (e.target.type === 'submit' || e.target.closest('button[type="submit"]')) {
                return; // Deixar formulários processarem
            }
            
            const button = e.target.closest('button');
            if (!button || !button.id) return;
            
            const handlerName = button.id;
            const handler = window.handlers[handlerName];
            
            if (handler && typeof handler === 'function') {
                e.preventDefault();
                handler(e).catch(error => {
                    console.error(`Erro ao executar handler ${handlerName}:`, error);
                    window.showSuccessToast(`Erro: ${error.message}`, true);
                });
            }
        }, { capture: false, passive: false }); // Usar bubble phase (depois do sidebar)
        
        // Event listeners para botões "Gerar Mais" (chamam o handler principal com append=true)
        document.addEventListener('click', async (e) => {
            // Gerar Mais - Brainstorm
            if (e.target.id === 'generate-more-brainstorm-ideas' || e.target.closest('#generate-more-brainstorm-ideas')) {
                e.preventDefault();
                const handler = window.handlers['generate-brainstorm-ideas'];
                if (handler && typeof handler === 'function') {
                    try {
                        await handler(e, true); // append = true
                    } catch (error) {
                        console.error('Erro ao gerar mais ideias:', error);
                        window.showSuccessToast(`Erro: ${error.message}`, true);
                    }
                }
                return;
            }
            
            // Gerar Mais - Viral Titles
            if (e.target.id === 'generate-more-viral-content' || e.target.closest('#generate-more-viral-content')) {
                e.preventDefault();
                const handler = window.handlers['generate-viral-content'];
                if (handler && typeof handler === 'function') {
                    try {
                        await handler(e, true); // append = true
                    } catch (error) {
                        console.error('Erro ao gerar mais conteúdo viral:', error);
                        window.showSuccessToast(`Erro: ${error.message}`, true);
                    }
                }
                return;
            }
            
            // Gerar Mais - Thumbnail Prompts
            if (e.target.id === 'generate-more-prompts' || e.target.closest('#generate-more-prompts')) {
                e.preventDefault();
                const handler = window.handlers['generate-prompts'];
                if (handler && typeof handler === 'function') {
                    try {
                        await handler(e, true); // append = true
                    } catch (error) {
                        console.error('Erro ao gerar mais prompts:', error);
                        window.showSuccessToast(`Erro: ${error.message}`, true);
                    }
                }
                return;
            }
            
            // Gerar Mais - Optimizer
            if (e.target.id === 'generate-more-optimizer-content' || e.target.closest('#generate-more-optimizer-content')) {
                e.preventDefault();
                const handler = window.handlers['optimize-script-btn'];
                if (handler && typeof handler === 'function') {
                    try {
                        await handler(e, true); // append = true
                    } catch (error) {
                        console.error('Erro ao gerar mais conteúdo otimizado:', error);
                        window.showSuccessToast(`Erro: ${error.message}`, true);
                    }
                }
                return;
            }
        }, true);
        
        // Event listeners específicos para botões de configurações
        // Salvar Configurações
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'save-settings' || e.target.closest('#save-settings')) {
                e.preventDefault();
                const feedbackEl = document.getElementById('settings-feedback');
                const settingsToSave = {
                    claude: document.getElementById('claude-key')?.value.trim(),
                    // Ensure gemini is always an array, even if only one key
                    gemini: [document.getElementById('gemini-key-1')?.value.trim()].filter(Boolean),
                    gpt: document.getElementById('gpt-key')?.value.trim(),
                    imagefx_cookies: document.getElementById('imagefx-cookies-setting')?.value.trim(),
                };
                try {
                    await window.apiRequest('/api/settings', 'POST', { settings: settingsToSave });
                    window.showSuccessToast('Configuracoes guardadas!');
                    // Reconstruir sidebar se necessário (função já existe como initializeNavigation)
                    // Não é necessário chamar checkAndShowApiAlert pois não existe no original
                    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('sidebar-btn-active'));
                    document.querySelector(`.sidebar-btn[data-tab="${window.appState.currentTab}"]`)?.classList.add('sidebar-btn-active');
                } catch(e) {
                    console.error("Save Settings Error:", e);
                    if (feedbackEl) {
                        feedbackEl.textContent = 'Erro ao guardar.';
                        feedbackEl.className = 'mt-2 text-sm text-red-600 dark:text-red-400';
                    }
                }
            }
            
            // Validar APIs
            if (e.target.id === 'validate-api-keys' || e.target.closest('#validate-api-keys')) {
                e.preventDefault();
                const feedbackEl = document.getElementById('settings-feedback');
                const settingsToCheck = {
                    claude: document.getElementById('claude-key')?.value.trim(),
                    gemini: [document.getElementById('gemini-key-1')?.value.trim()].filter(Boolean),
                    gpt: document.getElementById('gpt-key')?.value.trim(),
                    imagefx_cookies: document.getElementById('imagefx-cookies-setting')?.value.trim(),
                };

                if (feedbackEl) {
                    feedbackEl.innerHTML = 'A validar chaves de API e cookies...';
                    feedbackEl.className = 'mt-2 text-sm text-gray-600 dark:text-gray-400';
                }
                window.showProgressModal('A validar credenciais...', null);
                try {
                    const response = await window.apiRequest('/api/validate-api-keys', 'POST', settingsToCheck);
                    let messageHtmlParts = [];

                    if (settingsToCheck.claude) {
                        const isValid = response.claude_valid;
                        const text = `Claude: ${isValid ? 'Valida' : 'Invalida'}`;
                        const colorClass = isValid ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold';
                        messageHtmlParts.push(`<span class="${colorClass}">${text}</span>`);
                    }
                    if (settingsToCheck.gemini.length > 0) {
                        const isTextValid = response.gemini_valid;
                        const textText = `Gemini (Texto): ${isTextValid ? 'Valida' : 'Invalida'}`;
                        const textColorClass = isTextValid ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold';
                        messageHtmlParts.push(`<span class="${textColorClass}">${textText}</span>`);
                        
                        const isYoutubeValid = response.youtube_key_valid;
                        const youtubeText = `YouTube API: ${isYoutubeValid ? 'Valida' : 'Invalida'}`;
                        const youtubeColorClass = isYoutubeValid ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold';
                        messageHtmlParts.push(`<span class="${youtubeColorClass}">${youtubeText}</span>`);
                    }
                    if (settingsToCheck.gpt) {
                        const isValid = response.gpt_valid;
                        const text = `OpenAI (GPT): ${isValid ? 'Valida' : 'Invalida'}`;
                        const colorClass = isValid ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold';
                        messageHtmlParts.push(`<span class="${colorClass}">${text}</span>`);
                    }
                    if (settingsToCheck.imagefx_cookies) {
                        const isValid = response.imagefx_cookies_valid;
                        const text = `ImageFX Cookies: ${isValid ? 'Valido' : 'Invalido'}`;
                        const colorClass = isValid ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold';
                        messageHtmlParts.push(`<span class="${colorClass}">${text}</span>`);
                        
                        // Alerta se cookies ImageFX estão inválidos
                        if (!isValid) {
                            alert('⚠️ ATENÇÃO: Os cookies do ImageFX são inválidos ou expiraram!\n\nPor favor:\n1. Verifique se os cookies estão no formato correto (JSON)\n2. Exporte novamente os cookies usando a extensão "Cookie Editor"\n3. Cole os cookies atualizados no campo de configurações\n\nOs cookies do ImageFX podem expirar e precisam ser atualizados periodicamente.');
                        }
                    }

                    if (messageHtmlParts.length === 0) {
                        if (feedbackEl) {
                            feedbackEl.textContent = 'Nenhuma chave ou cookie fornecido para validacao.';
                            feedbackEl.className = 'mt-2 text-sm text-yellow-600 dark:text-yellow-400';
                        }
                    } else {
                        if (feedbackEl) {
                            feedbackEl.innerHTML = messageHtmlParts.join(' | ');
                            feedbackEl.className = 'mt-2 text-sm';
                        }
                    }
                } catch (e) {
                    console.error("Erro na validacao da API:", e);
                    if (feedbackEl) {
                        feedbackEl.textContent = `Erro ao validar: ${e.message}`;
                        feedbackEl.className = 'mt-2 text-sm text-red-600 dark:text-red-400';
                    }
                } finally {
                    window.hideProgressModal();
                    setTimeout(() => {
                        if (feedbackEl) {
                            feedbackEl.innerHTML = '';
                            feedbackEl.className = 'mt-2 text-sm';
                        }
                    }, 8000);
                }
            }
        }, true); // Use capture phase
        
        console.log('✅ Event listeners configurados');
    }
    
    // ============================================================================
    // INICIALIZAÇÃO
    // ============================================================================
    
    // Configurar event listeners de autenticação primeiro
    setupAuthEventListeners();
    
    // Verificar autenticação ao carregar
    checkAuth().then(isAuthenticated => {
        if (!isAuthenticated) {
            // Se não estiver autenticado, apenas carregar módulos em background
            // (eles serão necessários quando o usuário fizer login)
            setTimeout(() => {
                initializeModules();
            }, 100);
        }
        // Se estiver autenticado, os módulos serão carregados dentro de initializeApp
    }).catch(error => {
        console.error('Erro ao verificar autenticação:', error);
        window.showScreen('auth-section');
    });
    
    // ============================================================================
    // FUNÇÕES DE INICIALIZAÇÃO DOS MÓDULOS
    // ============================================================================
    
    // Função para inicializar Settings (carrega e popula as chaves de API) - COMPLETA COMO NO ORIGINAL
    window.initializeSettings = function() {
        const settingsForm = document.getElementById('settings-card');
        if (!settingsForm) return;

        const claudeKeyInput = document.getElementById('claude-key');
        const geminiKeyInput = document.getElementById('gemini-key-1');
        const gptKeyInput = document.getElementById('gpt-key');
        const imagefxCookiesInput = document.getElementById('imagefx-cookies-setting');

        // Load settings on initialization
        window.apiRequest('/api/settings', 'GET')
            .then(settings => {
                if (claudeKeyInput) claudeKeyInput.value = settings.claude || '';
                // Ensure gemini is handled as an array for loading
                if (geminiKeyInput) geminiKeyInput.value = (Array.isArray(settings.gemini) ? settings.gemini[0] : settings.gemini || '') ;
                if (gptKeyInput) gptKeyInput.value = settings.gpt || '';
                if (imagefxCookiesInput) imagefxCookiesInput.value = settings.imagefx_cookies || '';
                console.log('✅ Configurações carregadas');
            })
            .catch(error => {
                console.error("Erro ao carregar configurações:", error);
            });

        // Toggle password visibility
        settingsForm.querySelectorAll('.toggle-password-visibility').forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.target;
                const targetInput = document.getElementById(targetId);
                if (targetInput) {
                    if (targetInput.type === 'password') {
                        targetInput.type = 'text';
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`; // Eye-open icon
                    } else {
                        targetInput.type = 'password';
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 01-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>`; // Eye-closed icon
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
                    const response = await window.apiRequest('/api/clear-cache', 'POST');
                    if (response.success) {
                        if (cacheFeedback) {
                            cacheFeedback.textContent = response.message || 'Cache limpo com sucesso!';
                            cacheFeedback.className = 'mt-2 text-sm text-green-600 dark:text-green-400';
                        }
                        window.showSuccessToast(response.message || 'Cache limpo com sucesso!');
                    } else {
                        throw new Error(response.message || 'Erro ao limpar cache');
                    }
                } catch (error) {
                    console.error('Erro ao limpar cache:', error);
                    if (cacheFeedback) {
                        cacheFeedback.textContent = `Erro: ${error.message || 'Erro ao limpar cache'}`;
                        cacheFeedback.className = 'mt-2 text-sm text-red-600 dark:text-red-400';
                    }
                    window.showSuccessToast(`Erro ao limpar cache: ${error.message || 'Erro desconhecido'}`, true);
                } finally {
                    clearCacheBtn.disabled = false;
                    clearCacheBtn.textContent = 'Limpar Cache';
                }
            });
        }
    };
    
    // Função para inicializar Admin Panel (FUNÇÃO COMPLETA DO ORIGINAL - 2769 LINHAS)
    // Esta função foi extraída e adaptada do app1.js original (linhas 11216-13984)
    // Todas as chamadas foram adaptadas para usar window.apiRequest, window.showSuccessToast, etc.
window.initializeAdminPanel = async function() {
        const adminContainer = document.getElementById('admin-container');
        if (!adminContainer) return;
        
        // Limpar widget do chat quando abrir painel admin
        if (window.appState.currentUser && (window.appState.currentUser.role === 'admin' || window.appState.currentUser.role === 'attendant')) {
            const chatWidgetContainer = document.getElementById('chat-widget-container');
            const chatToggleBtn = document.getElementById('chat-widget-toggle');
            if (chatWidgetContainer) {
                chatWidgetContainer.classList.add('hidden');
            }
            if (chatToggleBtn) {
                chatToggleBtn.style.display = 'block';
            }
            window.chatWidgetOpen = false;
            window.currentConversationId = null;
            
            // Limpar mensagens do widget
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
        }
    
        let statsHtml = '';
        try {
            const stats = await window.apiRequest('/api/admin/stats', 'GET');
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
            window.addToLog(`Erro ao carregar estatisticas: ${error.message}`, true);
            statsHtml = `<p class="text-red-500">Erro ao carregar estatisticas: ${error.message}</p>`;
        }
    
        let appStatusHtml = '';
        try {
            const appStatus = await window.apiRequest('/api/status', 'GET');
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
            window.addToLog(`Erro ao carregar controle da aplicacao: ${error.message}`, true);
            appStatusHtml = `<p class="text-red-500">Erro ao carregar controle da aplicacao: ${error.message}</p>`;
        }

        let academySettingsHtml = '';
        try {
            const appSettings = await window.apiRequest('/api/app-settings', 'GET');
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
            console.error('❌ [ADMIN] Erro ao carregar configurações da Academy:', error);
            window.addToLog(`Erro ao carregar configuracoes da Academy: ${error.message}`, true);
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
    
        const chatManagementHtml = `
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">Gerenciamento de Chat</h3>
                    <div class="flex items-center gap-3">
                        <span id="chat-status-label" class="text-sm font-medium text-gray-700 dark:text-gray-300">Chat: <span id="chat-status-text">Carregando...</span></span>
                        <button id="toggle-chat-enabled-btn" class="px-4 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">
                            Habilitar Chat
                        </button>
                    </div>
                </div>
                
                <!-- Painel de Chat do Admin -->
                <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-3">💬 Chat Administrativo</h4>
                    <div class="space-y-3">
                        <!-- Menu de seleção de usuários e opções -->
                        <div class="flex gap-2 flex-wrap">
                            <div class="flex-1 min-w-[200px] relative">
                                <input type="text" id="admin-chat-user-search" placeholder="Buscar por nome, email ou WhatsApp..." class="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                                <select id="admin-chat-user-select" class="w-full mt-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" size="5" style="display: none;">
                                    <option value="">Selecione um usuário...</option>
                                </select>
                            </div>
                            <button id="admin-start-chat-btn" class="px-4 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                                💬 Iniciar Conversa
                            </button>
                            <button id="admin-broadcast-btn" class="px-4 py-2 rounded-lg font-semibold text-white bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600" title="Enviar mensagem para todos os usuários">
                                📢 Enviar para Todos
                            </button>
                            <button id="admin-remote-access-btn" class="px-4 py-2 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600" title="Acesso Remoto - Ver tela do usuário">
                                🔍 Acesso Remoto
                            </button>
                        </div>
                        
                        <!-- Sistema de Fila -->
                        <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <div class="flex items-center justify-between mb-2">
                                <div>
                                    <h5 class="font-semibold text-gray-900 dark:text-gray-100">Fila de Atendimento</h5>
                                    <p id="admin-queue-count" class="text-sm text-gray-600 dark:text-gray-400">0 usuário(s) aguardando</p>
                                </div>
                                <button id="admin-refresh-queue-btn" class="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md">
                                    🔄 Atualizar
                                </button>
                            </div>
                            <div id="admin-queue-list" class="space-y-2 max-h-40 overflow-y-auto"></div>
                        </div>
                        
                        <div id="admin-chat-container" class="hidden mt-4">
                            <div class="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600" style="height: 600px; display: flex; flex-direction: column;">
                                <div class="p-3 border-b border-gray-200 dark:border-gray-600 bg-[#075e54] text-white flex items-center justify-between">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2">
                                            <h5 id="admin-chat-user-name" class="font-semibold">Usuário</h5>
                                            <span id="admin-chat-ticket-number" class="text-xs bg-green-600 px-2 py-0.5 rounded hidden">Ticket #0000</span>
                                        </div>
                                        <p class="text-xs text-green-200">Chat Administrativo</p>
                                    </div>
                                    <div class="flex gap-2">
                                        <button id="admin-chat-close-ticket-btn" class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded hidden" title="Fechar Ticket">
                                            Fechar Ticket
                                        </button>
                                        <button id="admin-close-chat-btn" class="text-white hover:text-gray-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div id="admin-chat-messages" class="flex-1 overflow-y-auto p-4 bg-[#ece5dd] space-y-2" style="max-height: 400px;"></div>
                                <div class="p-3 border-t border-gray-200 dark:border-gray-600 bg-[#f0f0f0]">
                                    <div class="flex gap-2 mb-2">
                                        <input type="file" id="admin-chat-file-input" class="hidden" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt">
                                        <button type="button" id="admin-chat-attach-btn" class="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 text-sm">
                                            📎 Anexar
                                        </button>
                                        <button type="button" id="admin-chat-quick-reply-btn" class="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 text-sm">
                                            ⚡ Resposta Rápida
                                        </button>
                                        <button type="button" id="admin-chat-transfer-btn" class="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 text-sm">
                                            🔄 Transferir
                                        </button>
                                    </div>
                                    <form id="admin-chat-form" class="flex gap-2">
                                        <input type="text" id="admin-chat-input" placeholder="Digite uma mensagem..." class="flex-1 px-4 py-2 rounded-full bg-white border border-gray-300 text-gray-900 text-sm" autocomplete="off">
                                        <button type="submit" class="w-10 h-10 bg-[#25d366] hover:bg-[#20ba5a] text-white rounded-full flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Atendentes -->
                <div class="mb-6">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-semibold text-gray-900 dark:text-gray-100">Atendentes</h4>
                        <button id="add-new-attendant-btn" class="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md dark:bg-blue-500 dark:hover:bg-blue-600">Adicionar Novo Atendente</button>
                    </div>
                    
                    <!-- Formulário para adicionar/editar atendente (inicialmente oculto) -->
                    <div id="attendant-form-container" class="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" style="display: none;">
                        <h5 class="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100" id="attendant-form-title">Adicionar Novo Atendente</h5>
                    <div class="mb-3">
                            <select id="attendant-user-select" class="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-300 text-gray-900 dark:text-white">
                                <option value="">Selecione um usuário admin...</option>
                        </select>
                    </div>
                    <div class="flex gap-2 mb-3">
                            <input type="number" id="attendant-max-conversations" placeholder="Máx conversas" value="5" min="1" class="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-300 text-gray-900 dark:text-white">
                        <label class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <input type="checkbox" id="attendant-is-active" checked class="rounded border-gray-300">
                            Ativo
                        </label>
                    </div>
                        <div class="flex gap-2">
                            <button id="save-attendant-btn" class="flex-1 py-2 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Salvar</button>
                            <button id="cancel-attendant-btn" class="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        </div>
                    </div>
                    
                    <div id="attendants-list" class="space-y-3"></div>
                </div>
                
                <!-- Respostas Rápidas -->
                <div>
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-semibold text-gray-900 dark:text-gray-100">Respostas Rápidas</h4>
                        <button id="add-new-quick-reply-btn" class="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md dark:bg-green-500 dark:hover:bg-green-600">Adicionar Nova Resposta Rápida</button>
                    </div>
                    
                    <!-- Formulário para adicionar/editar resposta rápida (inicialmente oculto) -->
                    <div id="quick-reply-form-container" class="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" style="display: none;">
                        <h5 class="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100" id="quick-reply-form-title">Adicionar Nova Resposta Rápida</h5>
                    <div class="space-y-3 mb-3">
                            <input type="text" id="quick-reply-title" placeholder="Título da resposta rápida" class="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-300 text-gray-900 dark:text-white">
                            <textarea id="quick-reply-message" placeholder="Mensagem..." rows="3" class="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-300 text-gray-900 dark:text-white"></textarea>
                            <input type="url" id="quick-reply-link" placeholder="Link (opcional)" class="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-600 border border-gray-300 text-gray-900 dark:text-white">
                        <label class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <input type="checkbox" id="quick-reply-is-active" checked class="rounded border-gray-300">
                            Ativo
                        </label>
                    </div>
                        <div class="flex gap-2">
                            <button id="save-quick-reply-btn" class="flex-1 py-2 px-4 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600">Salvar</button>
                            <button id="cancel-quick-reply-btn" class="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                        </div>
                    </div>
                    
                    <div id="quick-replies-list" class="space-y-3"></div>
                </div>
                
                <!-- Painel de Tickets/Atendimentos -->
                <div class="mt-6">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="font-semibold text-gray-900 dark:text-gray-100">📋 Tickets de Atendimento</h4>
                        <button id="clear-all-tickets-btn" class="px-4 py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600" title="Deletar todos os tickets">
                            🗑️ Zerar Tickets
                        </button>
                    </div>
                    
                    <!-- Busca e Filtros -->
                    <div class="mb-4 flex gap-2 flex-wrap">
                        <input type="text" id="ticket-search-input" placeholder="Buscar por número de ticket (ex: TKT-1234567890-ABC12)" class="flex-1 min-w-[200px] px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <select id="ticket-status-filter" class="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                            <option value="all">Todos os Status</option>
                            <option value="open">Abertos</option>
                            <option value="closed">Fechados</option>
                        </select>
                        <button id="refresh-tickets-btn" class="px-4 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                            🔄 Atualizar
                        </button>
                    </div>
                    
                    <!-- Estatísticas -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <p class="text-sm text-gray-600 dark:text-gray-400">Tickets Abertos</p>
                            <p id="tickets-open-count" class="text-2xl font-bold text-green-600 dark:text-green-400">0</p>
                        </div>
                        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p class="text-sm text-gray-600 dark:text-gray-400">Total de Tickets</p>
                            <p id="tickets-total-count" class="text-2xl font-bold text-blue-600 dark:text-blue-400">0</p>
                        </div>
                        <div class="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                            <p class="text-sm text-gray-600 dark:text-gray-400">Tickets Fechados</p>
                            <p id="tickets-closed-count" class="text-2xl font-bold text-gray-600 dark:text-gray-400">0</p>
                        </div>
                    </div>
                    
                    <!-- Lista de Tickets -->
                    <div id="tickets-list" class="space-y-3"></div>
                    <!-- Paginação -->
                    <div id="tickets-pagination" class="mt-4"></div>
                </div>
            </div>
        `;

        if (adminContainer) adminContainer.innerHTML = statsHtml + appStatusHtml + academySettingsHtml + userManagementHtml + chatManagementHtml + `
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
            window.showConfirmationModal('Aprovar Utilizadores', 'Tem certeza de que deseja ativar todas as contas pendentes?', async () => {
                try {
                    const response = await window.apiRequest('/api/admin/approve-all', 'POST');
                    window.showSuccessToast(response.message);
                    renderUsers(document.getElementById('user-status-filter')?.value, 1, window.appState.adminPanel.currentSearch);
                } catch (error) {
                    window.addToLog(`Erro ao aprovar utilizadores: ${error.message}`, true);
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

                await window.apiRequest('/api/admin/maintenance', 'POST', {
                    is_on: maintenanceToggleEl?.checked,
                    message: maintenanceMessageInputEl?.value.trim()
                });
                await window.apiRequest('/api/admin/announcement', 'POST', {
                    message: announcementMessageInputEl?.value.trim()
                });
                window.showSuccessToast('Status da aplicacao salvo!');
            } catch (error) {
                window.addToLog(`Erro ao salvar status: ${error.message}`, true);
            }
        });

        document.getElementById('save-academy-settings-btn')?.addEventListener('click', async () => {
            try {
                const welcomeVideoUrlInput = document.getElementById('welcome-video-url-input');
                await window.apiRequest('/api/admin/app-settings', 'POST', {
                    settings: { welcomeVideoUrl: welcomeVideoUrlInput?.value.trim() }
                });
                window.showSuccessToast('Configuracoes da Academy salvas!');
            } catch (error) {
                window.addToLog(`Erro ao salvar configuracoes da Academy: ${error.message}`, true);
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
            window.appState.adminPanel[status].limit = limit;
            try {
                const response = await window.apiRequest(`/api/admin/users?status=${status}&page=${page}&limit=${limit}&search=${search}`, 'GET');
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
                            window.appState.adminPanel[status].currentPage = parseInt(e.target.dataset.page, 10);
                            renderUsers(status, window.appState.adminPanel[status].currentPage, search);
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
                        window.showConfirmationModal('Aprovar Utilizador', `Tem a certeza de que deseja ativar o utilizador?`, async () => {
                            try {
                                await window.apiRequest(`/api/admin/user/${userId}/activate`, 'PUT');
                                window.showSuccessToast('Utilizador ativado com sucesso!');
                                renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                            } catch (error) {
                                window.addToLog(`Erro ao ativar utilizador: ${error.message}`, true);
                            }
                        });
                    });
                });
    
                updateBatchTagContainerVisibility();
    
            } catch (error) {
                window.addToLog(`Erro ao carregar utilizadores: ${error.message}`, true);
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
    
        userSearchInput?.addEventListener('input', window.debounce(() => {
            window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage = 1; // Reset current page for active filter
            window.appState.adminPanel.currentSearch = userSearchInput.value.trim();
            renderUsers(window.appState.adminPanel.userStatusFilter, 1, window.appState.adminPanel.currentSearch);
        }, 300));
    
        userStatusFilter?.addEventListener('change', (e) => {
            window.appState.adminPanel.userStatusFilter = e.target.value; // Update the active filter
            // Reset current page for the new filter status
            window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage = 1;
            renderUsers(window.appState.adminPanel.userStatusFilter, 1, window.appState.adminPanel.currentSearch);
        });

        userLimitFilter?.addEventListener('change', (e) => {
            const newLimit = parseInt(e.target.value, 10);
            window.appState.adminPanel.active.limit = newLimit;
            window.appState.adminPanel.pending.limit = newLimit;
            window.appState.adminPanel.active.currentPage = 1;
            window.appState.adminPanel.pending.currentPage = 1;
            renderUsers(window.appState.adminPanel.userStatusFilter, 1, window.appState.adminPanel.currentSearch);
        });
        addTagsBatchBtn?.addEventListener('click', async () => {
            const tags = batchTagsInput?.value.trim();
            if (!tags) { window.showSuccessToast('Por favor, insira tags para adicionar.'); return; }
            if (selectedUserIds.size === 0) { window.showSuccessToast('Nenhum utilizador selecionado.'); return; }
            window.showConfirmationModal('Adicionar Tags', `Tem certeza de que deseja adicionar as tags "${tags}" a ${selectedUserIds.size} utilizador(es)?`, async () => {
                try {
                    await window.apiRequest('/api/admin/tags/batch', 'POST', { userIds: Array.from(selectedUserIds), tags, action: 'add' });
                    window.showSuccessToast('Tags adicionadas com sucesso!');
                    selectedUserIds.clear();
                    renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                } catch (error) {
                    window.addToLog(`Erro ao adicionar tags: ${error.message}`, true);
                }
            });
        });
    
        removeTagsBatchBtn?.addEventListener('click', async () => {
            const tags = batchTagsInput?.value.trim();
            if (!tags) { window.showSuccessToast('Por favor, insira tags para remover.'); return; }
            if (selectedUserIds.size === 0) { window.showSuccessToast('Nenhum utilizador selecionado.'); return; }
            window.showConfirmationModal('Remover Tags', `Tem certeza de que deseja remover as tags "${tags}" de ${selectedUserIds.size} utilizador(es)?`, async () => {
                try {
                    await window.apiRequest('/api/admin/tags/batch', 'POST', { userIds: Array.from(selectedUserIds), tags, action: 'remove' });
                    window.showSuccessToast('Tags removidas com sucesso!');
                    selectedUserIds.clear();
                    renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                } catch (error) {
                    window.addToLog(`Erro ao remover tags: ${error.message}`, true);
                }
            });
        });
    
        renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
    
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
                const user = await window.apiRequest(`/api/user/${userId}/details`, 'GET');
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
                    if (user.id === 1 || user.id === window.appState.currentUser?.id) {
                        toggleRoleBtn.setAttribute('disabled', 'true');
                        toggleRoleBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        toggleRoleBtn.removeAttribute('disabled');
                        toggleRoleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }
    
                if (resetPasswordBtn) {
                    if (user.id === 1 || user.id === window.appState.currentUser?.id) {
                        resetPasswordBtn.setAttribute('disabled', 'true');
                        resetPasswordBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        resetPasswordBtn.removeAttribute('disabled');
                        resetPasswordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }
    
                if (deleteUserBtn) {
                    if (user.id === 1 || user.id === window.appState.currentUser?.id) {
                        deleteUserBtn.setAttribute('disabled', 'true');
                        deleteUserBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        deleteUserBtn.removeAttribute('disabled');
                        deleteUserBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                }
    
            } catch (error) {
                if (feedbackEl) feedbackEl.textContent = error.message;
                window.addToLog(`Erro ao carregar dados do utilizador: ${error.message}`, true);
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
                        await window.apiRequest(`/api/admin/user/${currentUserId}`, 'PUT', {
                            email: currentEditUserEmail,
                            whatsapp: currentEditUserWhatsapp,
                            tags: currentEditUserTags
                        });
                        window.showSuccessToast('Utilizador atualizado!');
                        if (modal) modal.style.display = 'none';
                        renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                    }
                } catch (error) {
                    if (feedbackEl) feedbackEl.textContent = error.message;
                    window.addToLog(`Erro ao atualizar utilizador: ${error.message}`, true);
                }
            });
    
            resetPasswordBtn?.addEventListener('click', () => {
                const currentUserId = editUserId?.value;
                if (!currentUserId) return;
                window.showConfirmationModal('Redefinir Senha', 'Tem certeza de que deseja redefinir a senha deste utilizador? Uma nova senha temporaria sera gerada.', async () => {
                    try {
                        const response = await window.apiRequest(`/api/admin/user/${currentUserId}/reset-password`, 'POST');
                        
                        // Extrair a senha temporária da mensagem de resposta
                        // A resposta vem como: "Senha redefinida. A nova senha temporária é: XXXXXXXXXX"
                        const tempPasswordMatch = response.message.match(/senha temporária é:\s*([a-zA-Z0-9]+)/i) || 
                                                 response.message.match(/temporária é:\s*([a-zA-Z0-9]+)/i) ||
                                                 response.message.match(/é:\s*([a-zA-Z0-9]{8,})/i);
                        const tempPassword = tempPasswordMatch ? tempPasswordMatch[1] : null;
                        
                        if (modal) modal.style.display = 'none';
                        
                        // Exibir modal destacado com a senha temporária
                        if (tempPassword) {
                            window.showInfoModal(
                                'Senha Temporária Gerada',
                                `A nova senha temporária para este utilizador é:\n\n${tempPassword}\n\nCopie esta senha antes de fechar este modal. O utilizador será obrigado a alterá-la no próximo login.`,
                                {
                                    type: 'success',
                                    buttonText: 'Copiar e Fechar'
                                }
                            ).then(() => {
                                // Copiar senha para clipboard
                                navigator.clipboard.writeText(tempPassword).then(() => {
                                    window.showSuccessToast('Senha temporária copiada para a área de transferência!');
                                }).catch(() => {
                                    // Fallback se clipboard não funcionar
                                    console.log('Senha temporária:', tempPassword);
                                });
                                renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                            });
                        } else {
                            // Se não conseguir extrair a senha, mostrar mensagem completa
                            window.showInfoModal(
                                'Senha Redefinida',
                                response.message,
                                {
                                    type: 'success',
                                    buttonText: 'OK'
                                }
                            ).then(() => {
                                renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                            });
                        }
                    } catch (error) {
                        window.showInfoModal(
                            'Erro ao Redefinir Senha',
                            `Ocorreu um erro ao redefinir a senha: ${error.message}`,
                            {
                                type: 'error',
                                buttonText: 'OK'
                            }
                        );
                        window.addToLog(`Erro ao redefinir senha: ${error.message}`, true);
                    }
                });
            });
    
            toggleStatusBtn?.addEventListener('click', async () => {
                const currentUserId = editUserId?.value;
                if (!currentUserId) return;
                const user = await window.apiRequest(`/api/user/${currentUserId}/details`, 'GET'); // Get latest status
                const currentStatusIsActive = user.isActive;
                const action = currentStatusIsActive ? 'bloquear' : 'ativar';
                window.showConfirmationModal(`${currentStatusIsActive ? 'Bloquear' : 'Ativar'} Utilizador`, `Tem certeza de que deseja ${action} este utilizador?`, async () => {
                    try {
                        if (!currentStatusIsActive) { // If currently inactive, activate
                            await window.apiRequest(`/api/admin/user/${currentUserId}/activate`, 'PUT');
                            window.showSuccessToast('Utilizador ativado com sucesso!');
                        } else { // If currently active, block
                            await window.apiRequest(`/api/admin/user/${currentUserId}/status`, 'PUT', { isActive: false });
                            window.showSuccessToast('Utilizador bloqueado com sucesso!');
                        }
                        if (modal) modal.style.display = 'none';
                        renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                    } catch (error) {
                        window.addToLog(`Erro ao alterar status: ${error.message}`, true);
                    }
                });
            });
    
            toggleRoleBtn?.addEventListener('click', () => {
                const currentUserId = editUserId?.value;
                if (!currentUserId) return;
                const currentRoleIsAdmin = toggleRoleBtn.textContent.includes('Rebaixar');
                const newRole = currentRoleIsAdmin ? 'user' : 'admin';
                window.showConfirmationModal('Alterar Cargo', `Tem certeza de que deseja ${currentRoleIsAdmin ? 'rebaixar' : 'promover'} este utilizador para ${newRole}?`, async () => {
                    try {
                        await window.apiRequest(`/api/admin/user/${currentUserId}/role`, 'PUT', { role: newRole });
                        window.showSuccessToast(`Cargo do utilizador alterado para ${newRole}!`);
                        if (modal) modal.style.display = 'none';
                        renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                    } catch (error) {
                        window.addToLog(`Erro ao alterar cargo: ${error.message}`, true);
                    }
                });
            });
    
            deleteUserBtn?.addEventListener('click', () => {
                const currentUserId = editUserId?.value;
                if (!currentUserId) return;
                window.showConfirmationModal('Excluir Utilizador', 'Tem certeza de que deseja excluir este utilizador? Esta acao e irreversivel.', async () => {
                    try {
                        await window.apiRequest(`/api/admin/user/${currentUserId}`, 'DELETE');
                        window.showSuccessToast('Utilizador excluido!');
                        if (modal) modal.style.display = 'none';
                        renderUsers(window.appState.adminPanel.userStatusFilter, window.appState.adminPanel[window.appState.adminPanel.userStatusFilter].currentPage, window.appState.adminPanel.currentSearch);
                    } catch (error) {
                        window.addToLog(`Erro ao excluir utilizador: ${error.message}`, true);
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
                const lessons = await window.apiRequest('/api/admin/academy', 'GET');
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
                window.addToLog(`Erro ao carregar aulas da Academy para admin: ${error.message}`, true);
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
                        await window.apiRequest('/api/admin/academy/reorder', 'PUT', { newOrder });
                        window.showSuccessToast('Ordem das aulas atualizada!');
                        renderAdminAcademyLessons();
                        window.initializeAcademy();
                    } catch (error) {
                        window.addToLog(`Erro ao salvar nova ordem: ${error.message}`, true);
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
                    const lessons = await window.apiRequest('/api/admin/academy', 'GET');
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
                    window.addToLog(`Erro ao carregar dados da aula: ${error.message}`, true);
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
                    await window.apiRequest(`/api/admin/academy/${lessonIdInput.value}`, 'PUT', lessonData);
                    window.showSuccessToast('Aula atualizada com sucesso!');
                } else {
                    await window.apiRequest('/api/admin/academy', 'POST', lessonData);
                    window.showSuccessToast('Aula adicionada com sucesso!');
                }
                closeLessonModal();
                renderAdminAcademyLessons();
                window.initializeAcademy(); // Re-render public academy to reflect changes
            } catch (error) {
                window.addToLog(`Erro ao salvar aula: ${error.message}`, true);
                if (lessonFormFeedback) lessonFormFeedback.textContent = `Erro ao salvar aula: ${error.message}`;
            }
        };
    
        const deleteLesson = (lessonId) => {
            window.showConfirmationModal('Excluir Aula', 'Tem certeza de que deseja excluir esta aula? Esta acao e irreversivel.', async () => {
                try {
                    await window.apiRequest(`/api/admin/academy/${lessonId}`, 'DELETE');
                    window.showSuccessToast('Aula excluida!');
                    renderAdminAcademyLessons();
                    window.initializeAcademy(); // Re-render public academy to reflect changes
                } catch (error) {
                    window.addToLog(`Erro ao excluir aula: ${error.message}`, true);
                }
            });
        };
    
        // Attach event listeners
        addLessonBtn?.addEventListener('click', () => openLessonModal());
        cancelLessonBtn?.addEventListener('click', closeLessonModal);
        lessonForm?.addEventListener('submit', saveLesson);
    
        renderAdminAcademyLessons();

        // ================================================
        // 💬 Gerenciamento de Chat - Admin
        // ================================================
        
        // Carregar usuários para o select de atendentes (apenas admins)
        async function loadUsersForAttendants() {
            try {
                const response = await window.apiRequest('/api/admin/users?status=active&page=1&limit=1000', 'GET');
                const select = document.getElementById('attendant-user-select');
                if (select) {
                    // Filtrar apenas usuários admin
                    const adminUsers = response.data.filter(user => user.role === 'admin');
                    select.innerHTML = '<option value="">Selecione um administrador...</option>' + 
                        adminUsers.map(user => `<option value="${user.id}">${user.email}</option>`).join('');
                }
            } catch (error) {
                console.error('Erro ao carregar usuários:', error);
            }
        }

        // Carregar atendentes
        async function loadAttendants() {
            try {
                console.log('👥 Carregando atendentes...');
                const response = await window.apiRequest('/api/chat/attendants', 'GET');
                console.log('👥 Resposta da API:', response);
                console.log('👥 Tipo da resposta:', typeof response, Array.isArray(response));
                
                // Garantir que temos um array
                let attendants = [];
                if (Array.isArray(response)) {
                    attendants = response;
                } else if (response && Array.isArray(response.data)) {
                    attendants = response.data;
                } else if (response && typeof response === 'object' && Object.keys(response).length === 0) {
                    // Objeto vazio - não há atendentes
                    attendants = [];
                } else {
                    console.warn('⚠️ Resposta inesperada da API:', response);
                    attendants = [];
                }
                
                console.log('👥 Atendentes processados:', attendants.length);
                console.log('👥 Dados dos atendentes:', attendants);
                const container = document.getElementById('attendants-list');
                if (!container) {
                    console.error('❌ Container de atendentes não encontrado! Verificando DOM...');
                    // Tentar encontrar o container novamente após um delay
                    setTimeout(() => {
                        const retryContainer = document.getElementById('attendants-list');
                        if (retryContainer) {
                            console.log('✅ Container encontrado após retry');
                            loadAttendants();
                        } else {
                            console.error('❌ Container ainda não encontrado após retry');
                        }
                    }, 1000);
                    return;
                }
                
                console.log('✅ Container encontrado, renderizando lista...');
                
                if (attendants.length === 0) {
                    container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhum atendente configurado ainda.</p>';
                } else {
                    container.innerHTML = attendants.map(att => `
                            <div class="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 flex justify-between items-center">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full ${att.is_active === 1 ? 'bg-green-500' : 'bg-gray-400'} flex items-center justify-center">
                                        <span class="text-white font-semibold">${(att.email || 'A')[0].toUpperCase()}</span>
                                    </div>
                                <div>
                                    <p class="font-semibold text-gray-900 dark:text-gray-100">${att.email}</p>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">
                                            Máx: ${att.max_conversations || 5} conversas | 
                                            ${att.is_active === 1 ? '🟢 Online' : '⚫ Offline'} |
                                            ${att.active_conversations || 0} ativas
                                        </p>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button class="toggle-attendant-status-btn text-sm ${att.is_active === 1 ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40' : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'} px-3 py-1 rounded-md" data-user-id="${att.user_id}" data-current-status="${att.is_active}">
                                        ${att.is_active === 1 ? 'Colocar Offline' : 'Colocar Online'}
                                    </button>
                                    <button class="edit-attendant-btn text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40" data-user-id="${att.user_id}">Editar</button>
                                    <button class="remove-attendant-btn text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40" data-user-id="${att.user_id}">Remover</button>
                                </div>
                            </div>
                        `).join('');
                        
                        container.querySelectorAll('.toggle-attendant-status-btn').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const userId = parseInt(btn.dataset.userId);
                                const currentStatus = parseInt(btn.dataset.currentStatus);
                                const newStatus = currentStatus === 1 ? 0 : 1;
                                try {
                                    await window.apiRequest('/api/chat/attendants', 'POST', {
                                        userId,
                                        isActive: newStatus === 1,
                                        maxConversations: attendants.find(a => a.user_id === userId)?.max_conversations || 5
                                    });
                                    window.showSuccessToast(`Atendente ${newStatus === 1 ? 'colocado online' : 'colocado offline'}!`);
                                    await loadAttendants();
                                } catch (error) {
                                    window.addToLog(`Erro ao alterar status: ${error.message}`, true);
                                }
                            });
                        });
                        
                        container.querySelectorAll('.edit-attendant-btn').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const userId = parseInt(btn.dataset.userId);
                                const selectedAtt = attendants.find(a => a.user_id === userId);
                                if (selectedAtt) {
                                    // Preencher formulário
                                    document.getElementById('attendant-user-select').value = selectedAtt.user_id;
                                    document.getElementById('attendant-max-conversations').value = selectedAtt.max_conversations || 5;
                                    document.getElementById('attendant-is-active').checked = selectedAtt.is_active === 1;
                                    // Mostrar e preencher formulário
                                    const formContainer = document.getElementById('attendant-form-container');
                                    const formTitle = document.getElementById('attendant-form-title');
                                    if (formContainer) {
                                        formContainer.style.display = 'block';
                                        if (formTitle) formTitle.textContent = 'Editar Atendente';
                                    }
                                    // Mudar botão salvar
                                    const saveBtn = document.getElementById('save-attendant-btn');
                                    if (saveBtn) {
                                        saveBtn.dataset.editUserId = selectedAtt.user_id;
                                    }
                                    // Scroll para o formulário
                                    formContainer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            });
                        });
                        
                        container.querySelectorAll('.remove-attendant-btn').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const userId = parseInt(btn.dataset.userId);
                                if (confirm('Tem certeza que deseja remover este atendente?')) {
                                    try {
                                        await window.apiRequest(`/api/chat/attendants/${userId}`, 'DELETE');
                                        window.showSuccessToast('Atendente removido!');
                                        loadAttendants();
                                    } catch (error) {
                                        window.addToLog(`Erro ao remover atendente: ${error.message}`, true);
                                    }
                                }
                            });
                        });
                    }
            } catch (error) {
                console.error('Erro ao carregar atendentes:', error);
            }
        }

        // Carregar respostas rápidas
        async function loadQuickRepliesAdmin() {
            try {
                console.log('💬 Carregando respostas rápidas...');
                const response = await window.apiRequest('/api/chat/quick-replies', 'GET');
                console.log('💬 Resposta da API:', response);
                console.log('💬 Tipo da resposta:', typeof response, Array.isArray(response));
                
                // Garantir que temos um array
                let replies = [];
                if (Array.isArray(response)) {
                    replies = response;
                } else if (response && Array.isArray(response.data)) {
                    replies = response.data;
                } else if (response && typeof response === 'object' && Object.keys(response).length === 0) {
                    // Objeto vazio - não há respostas
                    replies = [];
                } else {
                    console.warn('⚠️ Resposta inesperada da API:', response);
                    replies = [];
                }
                
                console.log('💬 Respostas processadas:', replies.length);
                console.log('💬 Dados das respostas:', replies);
                const container = document.getElementById('quick-replies-list');
                if (!container) {
                    console.error('❌ Container de respostas rápidas não encontrado! Verificando DOM...');
                    // Tentar encontrar o container novamente após um delay
                    setTimeout(() => {
                        const retryContainer = document.getElementById('quick-replies-list');
                        if (retryContainer) {
                            console.log('✅ Container encontrado após retry');
                            loadQuickRepliesAdmin();
                        } else {
                            console.error('❌ Container ainda não encontrado após retry');
                        }
                    }, 1000);
                    return;
                }
                
                console.log('✅ Container encontrado, renderizando lista...');
                // Não precisamos mais do dropdown, removido
                
                if (replies.length === 0) {
                    container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhuma resposta rápida configurada ainda.</p>';
                } else {
                    container.innerHTML = replies.map(reply => `
                            <div class="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 flex justify-between items-center">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <p class="font-semibold text-gray-900 dark:text-gray-100">${reply.title}</p>
                                        <span class="px-2 py-0.5 text-xs rounded-full ${reply.is_active === 1 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'}">
                                            ${reply.is_active === 1 ? '🟢 Ativo' : '⚫ Inativo'}
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-600 dark:text-gray-300 mb-1">${(reply.message_text || reply.message || '').substring(0, 100)}${(reply.message_text || reply.message || '').length > 100 ? '...' : ''}</p>
                                    ${reply.link ? `<a href="${reply.link}" target="_blank" class="text-xs text-blue-600 hover:underline dark:text-blue-400">${reply.link}</a>` : ''}
                                    </div>
                                <div class="flex gap-2 ml-4">
                                    <button class="edit-quick-reply-btn text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40" data-reply-id="${reply.id}">Editar</button>
                                    <button class="delete-quick-reply-btn text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40" data-reply-id="${reply.id}">Deletar</button>
                                </div>
                            </div>
                        `).join('');
                        
                        container.querySelectorAll('.edit-quick-reply-btn').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const reply = replies.find(r => r.id === parseInt(btn.dataset.replyId));
                                if (reply) {
                                    document.getElementById('quick-reply-title').value = reply.title || '';
                                    document.getElementById('quick-reply-message').value = reply.message_text || reply.message || '';
                                    document.getElementById('quick-reply-link').value = reply.link || '';
                                    document.getElementById('quick-reply-is-active').checked = reply.is_active === 1;
                                    // Mostrar e preencher formulário
                                    const formContainer = document.getElementById('quick-reply-form-container');
                                    const formTitle = document.getElementById('quick-reply-form-title');
                                    if (formContainer) {
                                        formContainer.style.display = 'block';
                                        if (formTitle) formTitle.textContent = 'Editar Resposta Rápida';
                                    }
                                    // Mudar botão salvar
                                    const saveBtn = document.getElementById('save-quick-reply-btn');
                                    if (saveBtn) {
                                        saveBtn.dataset.editId = reply.id;
                                    }
                                    // Scroll para o formulário
                                    formContainer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            });
                        });
                        
                        container.querySelectorAll('.delete-quick-reply-btn').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const replyId = parseInt(btn.dataset.replyId);
                                if (confirm('Tem certeza que deseja deletar esta resposta rápida?')) {
                                    try {
                                        await window.apiRequest(`/api/chat/quick-replies/${replyId}`, 'DELETE');
                                        window.showSuccessToast('Resposta rápida deletada!');
                                        loadQuickRepliesAdmin();
                                    } catch (error) {
                                        window.addToLog(`Erro ao deletar resposta rápida: ${error.message}`, true);
                                    }
                                }
                            });
                        });
                    }
            } catch (error) {
                console.error('Erro ao carregar respostas rápidas:', error);
            }
        }

        // Event listeners para atendentes
        const addNewAttendantBtn = document.getElementById('add-new-attendant-btn');
        if (addNewAttendantBtn) {
            addNewAttendantBtn.addEventListener('click', () => {
                const formContainer = document.getElementById('attendant-form-container');
                const formTitle = document.getElementById('attendant-form-title');
                if (formContainer) {
                    formContainer.style.display = 'block';
                    if (formTitle) formTitle.textContent = 'Adicionar Novo Atendente';
                    // Limpar formulário
                    document.getElementById('attendant-user-select').value = '';
                    document.getElementById('attendant-max-conversations').value = '5';
                    document.getElementById('attendant-is-active').checked = true;
                    const saveBtn = document.getElementById('save-attendant-btn');
                    if (saveBtn) {
                        delete saveBtn.dataset.editUserId;
                    }
                    formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
        
        const cancelAttendantBtn = document.getElementById('cancel-attendant-btn');
        if (cancelAttendantBtn) {
            cancelAttendantBtn.addEventListener('click', () => {
                const formContainer = document.getElementById('attendant-form-container');
                if (formContainer) {
                    formContainer.style.display = 'none';
                    // Limpar formulário
                    document.getElementById('attendant-user-select').value = '';
                    document.getElementById('attendant-max-conversations').value = '5';
                    document.getElementById('attendant-is-active').checked = true;
                    const saveBtn = document.getElementById('save-attendant-btn');
                    if (saveBtn) {
                        delete saveBtn.dataset.editUserId;
                    }
                }
            });
        }
        
        const saveAttendantBtn = document.getElementById('save-attendant-btn');
        if (saveAttendantBtn) {
            saveAttendantBtn.addEventListener('click', async () => {
                const editUserId = saveAttendantBtn.dataset.editUserId ? parseInt(saveAttendantBtn.dataset.editUserId) : null;
                const userId = editUserId || parseInt(document.getElementById('attendant-user-select')?.value);
                const maxConversations = parseInt(document.getElementById('attendant-max-conversations')?.value || '5');
                const isActive = document.getElementById('attendant-is-active')?.checked;
                
                if (!userId) {
                    window.showSuccessToast('Selecione um usuário admin');
                    return;
                }
                
                try {
                    console.log('📤 Enviando dados do atendente:', { userId, maxConversations, isActive });
                    const response = await window.apiRequest('/api/chat/attendants', 'POST', {
                        userId,
                        maxConversations,
                        isActive
                    });
                    console.log('✅ Resposta do servidor:', response);
                    window.showSuccessToast(editUserId ? 'Atendente atualizado!' : 'Atendente adicionado!');
                    
                    // Ocultar formulário
                    const formContainer = document.getElementById('attendant-form-container');
                    if (formContainer) {
                        formContainer.style.display = 'none';
                    }
                    
                    // Limpar formulário
                    document.getElementById('attendant-user-select').value = '';
                    document.getElementById('attendant-max-conversations').value = '5';
                    document.getElementById('attendant-is-active').checked = true;
                    delete saveAttendantBtn.dataset.editUserId;
                    
                    // Aguardar um pouco para garantir que o servidor processou
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    // Recarregar lista de atendentes
                    console.log('🔄 Recarregando lista de atendentes...');
                    const container = document.getElementById('attendants-list');
                    if (container) {
                        container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>';
                    }
                    
                    // Recarregar múltiplas vezes para garantir
                    await loadAttendants();
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await loadAttendants(); // Recarregar novamente
                    await loadUsersForAttendants();
                    console.log('✅ Lista de atendentes recarregada');
                } catch (error) {
                    console.error('❌ Erro ao salvar atendente:', error);
                    window.showSuccessToast(`Erro ao salvar atendente: ${error.message}`, true);
                    window.addToLog(`Erro ao salvar atendente: ${error.message}`, true);
                    await loadAttendants();
                }
            });
        }

        // Event listeners para respostas rápidas
        const addNewQuickReplyBtn = document.getElementById('add-new-quick-reply-btn');
        if (addNewQuickReplyBtn) {
            addNewQuickReplyBtn.addEventListener('click', () => {
                const formContainer = document.getElementById('quick-reply-form-container');
                const formTitle = document.getElementById('quick-reply-form-title');
                if (formContainer) {
                    formContainer.style.display = 'block';
                    if (formTitle) formTitle.textContent = 'Adicionar Nova Resposta Rápida';
                    // Limpar formulário
                    document.getElementById('quick-reply-title').value = '';
                    document.getElementById('quick-reply-message').value = '';
                    document.getElementById('quick-reply-link').value = '';
                    document.getElementById('quick-reply-is-active').checked = true;
                    const saveBtn = document.getElementById('save-quick-reply-btn');
                    if (saveBtn) {
                        delete saveBtn.dataset.editId;
                    }
                    formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
        
        const cancelQuickReplyBtn = document.getElementById('cancel-quick-reply-btn');
        if (cancelQuickReplyBtn) {
            cancelQuickReplyBtn.addEventListener('click', () => {
                const formContainer = document.getElementById('quick-reply-form-container');
                if (formContainer) {
                    formContainer.style.display = 'none';
                    // Limpar formulário
                    document.getElementById('quick-reply-title').value = '';
                    document.getElementById('quick-reply-message').value = '';
                    document.getElementById('quick-reply-link').value = '';
                    document.getElementById('quick-reply-is-active').checked = true;
                    const saveBtn = document.getElementById('save-quick-reply-btn');
                    if (saveBtn) {
                        delete saveBtn.dataset.editId;
                    }
                }
            });
        }
        
        const saveQuickReplyBtn = document.getElementById('save-quick-reply-btn');
        if (saveQuickReplyBtn) {
            saveQuickReplyBtn.addEventListener('click', async () => {
                const title = document.getElementById('quick-reply-title')?.value.trim();
                const message = document.getElementById('quick-reply-message')?.value.trim();
                const link = document.getElementById('quick-reply-link')?.value.trim();
                const isActive = document.getElementById('quick-reply-is-active')?.checked;
                const editId = saveQuickReplyBtn.dataset.editId;
                
                if (!title || !message) {
                    window.showSuccessToast('Título e mensagem são obrigatórios');
                    return;
                }
                
                try {
                    console.log('📤 Enviando dados da resposta rápida:', { id: editId ? parseInt(editId) : null, title, messageText: message, link: link || null, isActive });
                    const response = await window.apiRequest('/api/chat/quick-replies', 'POST', {
                        id: editId ? parseInt(editId) : null,
                        title,
                        messageText: message,
                        link: link || null,
                        isActive
                    });
                    console.log('✅ Resposta do servidor:', response);
                    window.showSuccessToast(editId ? 'Resposta rápida atualizada!' : 'Resposta rápida adicionada!');
                    
                    // Ocultar formulário
                    const formContainer = document.getElementById('quick-reply-form-container');
                    if (formContainer) {
                        formContainer.style.display = 'none';
                    }
                    
                    // Limpar formulário
                    document.getElementById('quick-reply-title').value = '';
                    document.getElementById('quick-reply-message').value = '';
                    document.getElementById('quick-reply-link').value = '';
                    document.getElementById('quick-reply-is-active').checked = true;
                    delete saveQuickReplyBtn.dataset.editId;
                    
                    // Aguardar um pouco para garantir que o servidor processou
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    // Recarregar lista de respostas rápidas
                    console.log('🔄 Recarregando lista de respostas rápidas...');
                    const container = document.getElementById('quick-replies-list');
                    if (container) {
                        container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>';
                    }
                    
                    // Recarregar múltiplas vezes para garantir
                    await loadQuickRepliesAdmin();
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await loadQuickRepliesAdmin(); // Recarregar novamente
                    console.log('✅ Lista de respostas rápidas recarregada');
                } catch (error) {
                    console.error('❌ Erro ao salvar resposta rápida:', error);
                    window.showSuccessToast(`Erro ao salvar resposta rápida: ${error.message}`, true);
                    window.addToLog(`Erro ao salvar resposta rápida: ${error.message}`, true);
                    await loadQuickRepliesAdmin();
                }
            });
        }

        // Carregar dados iniciais
        loadUsersForAttendants();
        
        // ================================================
        // 💬 Habilitar/Desabilitar Chat
        // ================================================
        
        // Carregar status do chat
        async function loadChatStatus() {
            try {
                const status = await window.apiRequest('/api/status', 'GET');
                const chatEnabled = status.chatEnabled !== false; // Default: true
                updateChatStatusUI(chatEnabled);
            } catch (error) {
                console.error('Erro ao carregar status do chat:', error);
                updateChatStatusUI(true); // Default: habilitado
            }
        }
        
        // Atualizar UI do status do chat
        function updateChatStatusUI(enabled) {
            const statusText = document.getElementById('chat-status-text');
            const toggleBtn = document.getElementById('toggle-chat-enabled-btn');
            
            if (statusText) {
                statusText.textContent = enabled ? 'Habilitado' : 'Desabilitado';
                statusText.className = enabled ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold';
            }
            
            if (toggleBtn) {
                toggleBtn.textContent = enabled ? '❌ Desabilitar Chat' : '✅ Habilitar Chat';
                toggleBtn.className = enabled 
                    ? 'px-4 py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                    : 'px-4 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600';
            }
        }
        
        // Toggle chat enabled/disabled
        const toggleChatEnabledBtn = document.getElementById('toggle-chat-enabled-btn');
        if (toggleChatEnabledBtn) {
            toggleChatEnabledBtn.addEventListener('click', async () => {
                try {
                    const status = await window.apiRequest('/api/status', 'GET');
                    const currentStatus = status.chatEnabled !== false; // Default: true
                    const newStatus = !currentStatus;
                    
                    await window.apiRequest('/api/admin/chat/enable', 'POST', { enabled: newStatus });
                    updateChatStatusUI(newStatus);
                    window.showSuccessToast(`Chat ${newStatus ? 'habilitado' : 'desabilitado'} com sucesso!`);
                } catch (error) {
                    console.error('Erro ao alterar status do chat:', error);
                    window.showSuccessToast(`Erro ao alterar status do chat: ${error.message}`, true);
                }
            });
        }
        
        // Carregar status inicial
        loadChatStatus();
        
        // ================================================
        // 💬 Painel de Chat do Admin
        // ================================================
        
        // Variáveis para busca de usuários no chat admin
        let allUsersForChat = [];
        let filteredUsersForChat = [];
        
        // Carregar usuários para o dropdown do chat admin
        async function loadUsersForAdminChat() {
            try {
                const users = await window.apiRequest('/api/chat/users', 'GET');
                if (Array.isArray(users)) {
                    allUsersForChat = users;
                    filteredUsersForChat = users;
                    updateAdminChatUserSelect();
                }
            } catch (error) {
                console.error('Erro ao carregar usuários para chat admin:', error);
            }
        }
        
        // Atualizar select de usuários do chat admin
        function updateAdminChatUserSelect() {
            const select = document.getElementById('admin-chat-user-select');
            const searchInput = document.getElementById('admin-chat-user-search');
            
            if (select && Array.isArray(filteredUsersForChat)) {
                select.innerHTML = '<option value="">Selecione um usuário...</option>' + 
                    filteredUsersForChat.map(user => {
                        const displayText = `${user.email}${user.whatsapp ? ' (' + user.whatsapp + ')' : ''}`;
                        return `<option value="${user.id}">${displayText}</option>`;
                    }).join('');
                
                // Mostrar select quando há resultados e busca ativa
                if (filteredUsersForChat.length > 0 && searchInput && searchInput.value.trim()) {
                    select.style.display = 'block';
                    select.size = Math.min(filteredUsersForChat.length + 1, 8);
                } else {
                    select.style.display = 'none';
                }
            }
        }
        
        // Buscar usuários no chat admin (será inicializado após DOM estar pronto)
        function initializeAdminChatUserSearch() {
            const adminChatUserSearch = document.getElementById('admin-chat-user-search');
            if (adminChatUserSearch) {
                // Remover listeners antigos se existirem
                const newSearch = adminChatUserSearch.cloneNode(true);
                adminChatUserSearch.parentNode.replaceChild(newSearch, adminChatUserSearch);
                
                newSearch.addEventListener('input', (e) => {
                    const searchTerm = e.target.value.trim().toLowerCase();
                    
                    if (searchTerm === '') {
                        filteredUsersForChat = allUsersForChat;
                        const select = document.getElementById('admin-chat-user-select');
                        if (select) select.style.display = 'none';
                    } else {
                        filteredUsersForChat = allUsersForChat.filter(user => {
                            const email = (user.email || '').toLowerCase();
                            const whatsapp = (user.whatsapp || '').toLowerCase();
                            return email.includes(searchTerm) || 
                                   whatsapp.includes(searchTerm);
                        });
                        
                        updateAdminChatUserSelect();
                    }
                });
                
                // Quando selecionar um usuário, atualizar o input
                const select = document.getElementById('admin-chat-user-select');
                if (select) {
                    select.addEventListener('change', (e) => {
                        const selectedUserId = e.target.value;
                        if (selectedUserId) {
                            const selectedUser = filteredUsersForChat.find(u => u.id == selectedUserId);
                            if (selectedUser && newSearch) {
                                newSearch.value = `${selectedUser.email}${selectedUser.whatsapp ? ' (' + selectedUser.whatsapp + ')' : ''}`;
                                select.style.display = 'none';
                            }
                        }
                    });
                }
                
                // Fechar select ao clicar fora
                document.addEventListener('click', (e) => {
                    const select = document.getElementById('admin-chat-user-select');
                    if (select && newSearch && 
                        !select.contains(e.target) && 
                        !newSearch.contains(e.target)) {
                        select.style.display = 'none';
                    }
                });
            }
        }
        
        // Iniciar conversa com usuário selecionado
        const adminStartChatBtn = document.getElementById('admin-start-chat-btn');
        if (adminStartChatBtn) {
            adminStartChatBtn.addEventListener('click', async () => {
                const select = document.getElementById('admin-chat-user-select');
                const searchInput = document.getElementById('admin-chat-user-search');
                
                // Tentar pegar do select primeiro, se não tiver, buscar pelo texto do input
                let userId = select?.value;
                
                if (!userId && searchInput && searchInput.value.trim()) {
                    // Buscar usuário pelo texto digitado
                    const searchTerm = searchInput.value.trim().toLowerCase();
                    const foundUser = allUsersForChat.find(user => {
                        const email = (user.email || '').toLowerCase();
                        const whatsapp = (user.whatsapp || '').toLowerCase();
                        const name = (user.name || '').toLowerCase();
                        const displayText = `${email}${whatsapp ? ' (' + whatsapp + ')' : ''}`.toLowerCase();
                        return email === searchTerm || 
                               whatsapp === searchTerm || 
                               name === searchTerm ||
                               displayText === searchTerm ||
                               displayText.includes(searchTerm);
                    });
                    
                    if (foundUser) {
                        userId = foundUser.id;
                    }
                }
                
                if (!userId) {
                    window.showSuccessToast('Selecione ou busque um usuário primeiro', true);
                    return;
                }
                
                try {
                    const conversation = await window.apiRequest('/api/chat/start-conversation', 'POST', { targetUserId: parseInt(userId) });
                    if (conversation && conversation.id) {
                        adminCurrentConversationId = conversation.id;
                        adminCurrentUserId = parseInt(userId);
                        
                        // Criar ticket automaticamente ao iniciar conversa
                        try {
                            // Gerar número do ticket amigável (TKT-YYYY-MM-DD-001)
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = String(now.getMonth() + 1).padStart(2, '0');
                            const day = String(now.getDate()).padStart(2, '0');
                            const dateStr = `${year}-${month}-${day}`;
                            
                            // Buscar último ticket do dia para gerar número sequencial
                            const tickets = await window.apiRequest('/api/chat/tickets', 'GET');
                            let sequence = 1;
                            if (Array.isArray(tickets)) {
                                const todayTickets = tickets.filter(t => 
                                    t.ticket_number && t.ticket_number.startsWith(`TKT-${dateStr}-`)
                                );
                                if (todayTickets.length > 0) {
                                    const lastTicket = todayTickets.sort((a, b) => {
                                        const matchA = a.ticket_number.match(/TKT-\d{4}-\d{2}-\d{2}-(\d+)/);
                                        const matchB = b.ticket_number.match(/TKT-\d{4}-\d{2}-\d{2}-(\d+)/);
                                        const numA = matchA && matchA[1] ? parseInt(matchA[1]) : 0;
                                        const numB = matchB && matchB[1] ? parseInt(matchB[1]) : 0;
                                        return numB - numA;
                                    })[0];
                                    if (lastTicket) {
                                        const match = lastTicket.ticket_number.match(/TKT-\d{4}-\d{2}-\d{2}-(\d+)/);
                                        if (match && match[1]) {
                                            sequence = parseInt(match[1]) + 1;
                                        }
                                    }
                                }
                            }
                            
                            const ticketNumber = `TKT-${dateStr}-${String(sequence).padStart(3, '0')}`;
                            const ticketResult = await window.apiRequest('/api/chat/tickets', 'POST', {
                                ticket_number: ticketNumber,
                                conversation_id: conversation.id,
                                user_id: parseInt(userId),
                                attendant_id: window.appState.currentUser.id,
                                status: 'open',
                                priority: 'normal'
                            });
                            if (ticketResult && ticketResult.id) {
                                adminCurrentTicketId = ticketResult.id;
                                
                                const ticketNumberEl = document.getElementById('admin-chat-ticket-number');
                                const closeTicketBtn = document.getElementById('admin-chat-close-ticket-btn');
                                if (ticketNumberEl) {
                                    ticketNumberEl.textContent = `Ticket ${ticketNumber}`;
                                    ticketNumberEl.classList.remove('hidden');
                                }
                                if (closeTicketBtn) closeTicketBtn.classList.remove('hidden');
                                
                                // Atualizar painel de tickets
                                if (typeof loadTicketsPanel === 'function') {
                                    loadTicketsPanel();
                                }
                            }
                        } catch (ticketError) {
                            console.error('Erro ao criar ticket:', ticketError);
                        }
                        
                        // Mostrar container de chat
                        const container = document.getElementById('admin-chat-container');
                        const userName = document.getElementById('admin-chat-user-name');
                        if (container) container.classList.remove('hidden');
                        if (userName) {
                            const user = await window.apiRequest(`/api/user/${userId}/details`, 'GET');
                            userName.textContent = user.email || 'Usuário';
                        }
                        
                        // Carregar mensagens
                        await loadAdminChatMessages(conversation.id);
                    }
                } catch (error) {
                    console.error('Erro ao iniciar conversa:', error);
                    window.showSuccessToast('Erro ao iniciar conversa', true);
                }
            });
        }
        
        // Acesso remoto
        const adminRemoteAccessBtn = document.getElementById('admin-remote-access-btn');
        if (adminRemoteAccessBtn) {
            adminRemoteAccessBtn.addEventListener('click', async () => {
                // Usar usuário da conversa atual ou buscar do select
                let userId = adminCurrentUserId;
                if (!userId) {
                    const select = document.getElementById('admin-chat-user-select');
                    userId = select?.value;
                }
                
                if (!userId) {
                    window.showSuccessToast('Selecione um usuário primeiro ou abra uma conversa', true);
                    return;
                }
                
                try {
                    // Armazenar o userId para usar quando receber a resposta
                    adminCurrentUserId = parseInt(userId);
                    
                    // Enviar comando de acesso remoto via WebSocket
                    if (window.chatSocket && window.chatSocket.connected) {
                        window.chatSocket.emit('remote-access-request', {
                            userId: parseInt(userId),
                            action: 'view-screen',
                            data: {}
                        });
                        window.showSuccessToast('Solicitação de acesso remoto enviada! Aguardando aprovação do usuário...');
                    } else {
                        // Fallback para API
                        await window.apiRequest('/api/chat/remote-access', 'POST', {
                            userId: parseInt(userId),
                            action: 'navigate',
                            data: { section: 'home' }
                        });
                        window.showSuccessToast('Comando de acesso remoto enviado!');
                    }
                } catch (error) {
                    console.error('Erro ao enviar comando remoto:', error);
                    window.showSuccessToast('Erro ao enviar comando remoto', true);
                }
            });
        }
        
        // Variável global para controle de acesso remoto do atendente
        let remoteViewerActive = false;
        let remoteViewerContainer = null;
        
        // Escutar resposta de acesso remoto (atendente)
        if (window.chatSocket) {
            window.chatSocket.on('remote-access-response', (data) => {
                console.log('🔧 [REMOTE] Resposta de acesso remoto recebida:', data);
                if (data.accepted) {
                    window.showSuccessToast(`Acesso remoto permitido pelo usuário ${data.userId}`);
                    // Armazenar o userId para usar nas atualizações de tela
                    adminCurrentUserId = data.userId;
                    // Iniciar visualização remota
                    startRemoteViewing(data.userId);
                } else {
                    window.showSuccessToast('Acesso remoto recusado pelo usuário', true);
                }
            });
            
            // Escutar atualizações de tela do usuário
            window.chatSocket.on('remote-screen-update', (data) => {
                console.log('📺 [REMOTE] Recebendo atualização de tela:', data);
                // Se o visualizador está ativo, atualizar a tela
                // Verificar se é o usuário que estamos visualizando OU se não temos um usuário específico
                if (remoteViewerActive) {
                    // Se temos um adminCurrentUserId, verificar se é o mesmo
                    // Se não temos, aceitar qualquer atualização
                    if (!adminCurrentUserId || data.userId === adminCurrentUserId) {
                        updateRemoteScreen(data.image);
                    }
                }
            });
            
            // Escutar fim de compartilhamento
            window.chatSocket.on('remote-screen-end', (data) => {
                if (data.userId === adminCurrentUserId) {
                    stopRemoteViewing();
                }
            });
        }
        
        // Iniciar visualização remota
        function startRemoteViewing(userId) {
            remoteViewerActive = true;
            
            // Criar container para visualização remota
            if (!remoteViewerContainer) {
                remoteViewerContainer = document.createElement('div');
                remoteViewerContainer.id = 'remote-viewer-container';
                remoteViewerContainer.className = 'fixed inset-0 bg-black z-[10009] flex flex-col';
                remoteViewerContainer.innerHTML = `
                    <div class="bg-gray-800 text-white p-4 flex items-center justify-between">
                        <h3 class="text-lg font-semibold">🔍 Acesso Remoto Ativo - Usuário ID: ${userId}</h3>
                        <button id="close-remote-viewer" class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">
                            Encerrar Acesso
                        </button>
                    </div>
                    <div class="flex-1 overflow-auto bg-gray-900 flex items-center justify-center p-4">
                        <img id="remote-screen-image" src="" alt="Tela do usuário" class="max-w-full max-h-full object-contain border border-gray-700 rounded">
                    </div>
                    <div class="bg-gray-800 text-white p-4 text-sm border-t border-gray-700">
                        <p class="text-center">📺 Você está visualizando a tela do usuário em tempo real. Use o chat para se comunicar.</p>
                    </div>
                `;
                document.body.appendChild(remoteViewerContainer);
                
                // Event listener para fechar
                const closeBtn = document.getElementById('close-remote-viewer');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        stopRemoteViewing();
                        if (window.chatSocket && adminCurrentUserId) {
                            window.chatSocket.emit('remote-access-end', { userId: adminCurrentUserId });
                        }
                    });
                }
            }
        }
        
        // Atualizar tela remota
        function updateRemoteScreen(imageData) {
            const img = document.getElementById('remote-screen-image');
            if (img) {
                img.src = imageData;
            }
        }
        
        // Parar visualização remota
        function stopRemoteViewing() {
            remoteViewerActive = false;
            if (remoteViewerContainer) {
                remoteViewerContainer.remove();
                remoteViewerContainer = null;
            }
        }
        
        // Enviar comando remoto (clique, digitação, etc)
        function sendRemoteCommand(command) {
            if (window.chatSocket && window.chatSocket.connected && adminCurrentUserId) {
                window.chatSocket.emit('remote-command-send', {
                    targetUserId: adminCurrentUserId,
                    command: command
                });
            }
        }
        
        // Fechar chat admin
        const adminCloseChatBtn = document.getElementById('admin-close-chat-btn');
        if (adminCloseChatBtn) {
            adminCloseChatBtn.addEventListener('click', async () => {
                // Fechar ticket automaticamente se existir
                if (adminCurrentTicketId && adminCurrentConversationId) {
                    try {
                        await window.apiRequest(`/api/chat/tickets/${adminCurrentTicketId}/close`, 'POST', { 
                            notes: 'Conversa fechada pelo atendente' 
                        });
                        window.showSuccessToast('Ticket fechado automaticamente');
                    } catch (error) {
                        console.error('Erro ao fechar ticket:', error);
                    }
                }
                
                const container = document.getElementById('admin-chat-container');
                if (container) container.classList.add('hidden');
                adminCurrentConversationId = null;
                adminCurrentUserId = null;
                adminCurrentTicketId = null;
                
                // Atualizar painel de tickets
                if (typeof loadTicketsPanel === 'function') {
                    loadTicketsPanel();
                }
            });
        }
        
        // Enviar mensagem do admin
        const adminChatForm = document.getElementById('admin-chat-form');
        if (adminChatForm) {
            adminChatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const input = document.getElementById('admin-chat-input');
                const message = input?.value.trim();
                if (message && adminCurrentConversationId) {
                    input.value = '';
                    try {
                        await window.apiRequest('/api/chat/send', 'POST', {
                            conversationId: adminCurrentConversationId,
                            message,
                            messageType: 'text'
                        });
                        await loadAdminChatMessages(adminCurrentConversationId);
                    } catch (error) {
                        console.error('Erro ao enviar mensagem:', error);
                        window.showSuccessToast('Erro ao enviar mensagem', true);
                    }
                }
            });
        }
        
        // Variáveis globais para chat admin
        let adminCurrentConversationId = null;
        let adminCurrentUserId = null;
        
        // Carregar mensagens do chat admin
        async function loadAdminChatMessages(conversationId) {
            try {
                console.log('📥 [ADMIN] Carregando mensagens da conversa:', conversationId);
                const messages = await window.apiRequest(`/api/chat/messages/${conversationId}`, 'GET');
                const container = document.getElementById('admin-chat-messages');
                if (container && Array.isArray(messages)) {
                    container.innerHTML = messages.map(msg => {
                        const isOwn = msg.sender_id === window.appState.currentUser.id;
                        const time = new Date(msg.created_at || msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        const messageText = msg.message_text || msg.message || '';
                        const messageType = msg.message_type || 'text';
                        const fileUrl = msg.file_url;
                        
                        let contentHtml = '';
                        if (fileUrl) {
                            if (messageType === 'image') {
                                contentHtml = `<img src="${fileUrl}" alt="${escapeHtml(messageText)}" class="max-w-full rounded-lg mb-1" onclick="window.open('${fileUrl}', '_blank')" style="cursor: pointer;">`;
                            } else if (messageType === 'audio') {
                                contentHtml = `<audio controls class="w-full"><source src="${fileUrl}" type="audio/mpeg">Seu navegador não suporta áudio.</audio>`;
                            } else if (messageType === 'video') {
                                contentHtml = `<video controls class="max-w-full rounded-lg"><source src="${fileUrl}" type="video/mp4">Seu navegador não suporta vídeo.</video>`;
                            } else {
                                contentHtml = `<a href="${fileUrl}" target="_blank" class="text-blue-600 hover:underline">📎 ${escapeHtml(messageText || 'Arquivo')}</a>`;
                            }
                        }
                        
                        if (messageText && !fileUrl) {
                            contentHtml += `<p class="text-sm ${isOwn ? 'text-gray-900' : 'text-gray-800 dark:text-gray-100'} whitespace-pre-wrap break-words">${escapeHtml(messageText)}</p>`;
                        }
                        
                        // Checkmarks de visto (WhatsApp style)
                        let readStatusHtml = '';
                        if (isOwn) {
                            // Se a mensagem foi enviada pelo atendente, verificar se foi lida pelo usuário
                            const isRead = msg.is_read_by_user === 1 || msg.is_read === 1;
                            if (isRead) {
                                // 2 tics verdes (visualizado)
                                readStatusHtml = '<span class="inline-flex items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-500 -ml-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></span>';
                            } else {
                                // 1 tic azul (enviado)
                                readStatusHtml = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
                            }
                        }
                        
                        return `
                            <div class="flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1">
                                <div class="max-w-[70%] ${isOwn ? 'bg-[#dcf8c6]' : 'bg-white dark:bg-gray-700'} rounded-lg shadow-sm ${isOwn ? 'rounded-tr-none' : 'rounded-tl-none'} px-3 py-2">
                                    ${contentHtml}
                                    <div class="flex items-center justify-end gap-1 mt-1">
                                        <span class="text-[10px] text-gray-500 dark:text-gray-400">${time}</span>
                                        ${readStatusHtml}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                    container.scrollTop = container.scrollHeight;
                    console.log(`✅ [ADMIN] ${messages.length} mensagem(ns) carregada(s)`);
                } else {
                    console.warn('⚠️ [ADMIN] Container não encontrado ou mensagens não são array');
                }
            } catch (error) {
                console.error('❌ [ADMIN] Erro ao carregar mensagens:', error);
            }
        }
        
        // Carregar fila de atendimento
        async function loadQueue() {
            // Verificar se o usuário está logado e é admin/atendente
            const token = localStorage.getItem('authToken');
            if (!token || !window.appState.currentUser || (window.appState.currentUser.role !== 'admin' && window.appState.currentUser.role !== 'attendant')) {
                return;
            }
            
            try {
                const queue = await window.apiRequest('/api/chat/queue', 'GET');
                const countEl = document.getElementById('admin-queue-count');
                const listEl = document.getElementById('admin-queue-list');
                
                if (countEl) {
                    const count = Array.isArray(queue) ? queue.length : 0;
                    countEl.textContent = `${count} usuário(s) aguardando`;
                }
                
                if (listEl && Array.isArray(queue) && queue.length > 0) {
                    listEl.innerHTML = queue.map((item, index) => `
                        <div class="p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-between">
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">${item.email || 'Usuário'}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Posição: ${item.position || index + 1}</p>
                            </div>
                            <button data-queue-id="${item.id}" class="accept-queue-btn px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded">
                                Atender
                            </button>
                        </div>
                    `).join('');
                    
                    // Adicionar event listeners aos botões
                    listEl.querySelectorAll('.accept-queue-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const queueId = parseInt(btn.dataset.queueId);
                            if (queueId) {
                                acceptFromQueue(queueId);
                            }
                        });
                    });
                } else if (listEl) {
                    listEl.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center">Nenhum usuário na fila</p>';
                }
            } catch (error) {
                // Ignorar erros silenciosamente se não estiver autenticado
                if (error.message && error.message.includes('token')) {
                    return;
                }
                console.error('Erro ao carregar fila:', error);
            }
        }
        
        // Aceitar da fila
        window.acceptFromQueue = async function(queueId) {
            try {
                const result = await window.apiRequest('/api/chat/queue/accept', 'POST', { queueId });
                if (result && result.conversation) {
                    adminCurrentConversationId = result.conversation.id;
                    adminCurrentUserId = result.conversation.user_id;
                    adminCurrentTicketId = result.ticket.id;
                    
                    // Mostrar chat
                    const container = document.getElementById('admin-chat-container');
                    if (container) container.classList.remove('hidden');
                    
                    // Atualizar UI
                    const ticketNumber = document.getElementById('admin-chat-ticket-number');
                    const closeTicketBtn = document.getElementById('admin-chat-close-ticket-btn');
                    const userName = document.getElementById('admin-chat-user-name');
                    
                    if (ticketNumber) {
                        ticketNumber.textContent = `Ticket ${result.ticket.ticket_number}`;
                        ticketNumber.classList.remove('hidden');
                    }
                    if (closeTicketBtn) closeTicketBtn.classList.remove('hidden');
                    
                    // Atualizar nome do usuário com email
                    if (userName && result.ticket.user_email) {
                        userName.textContent = result.ticket.user_email;
                    } else if (userName) {
                        // Buscar email do usuário se não vier no ticket
                        try {
                            const user = await window.apiRequest(`/api/user/${result.conversation.user_id}/details`, 'GET');
                            if (user && user.email) {
                                userName.textContent = user.email;
                            }
                        } catch (error) {
                            console.error('Erro ao buscar email do usuário:', error);
                        }
                    }
                    
                    // Carregar mensagens da conversa ANTES de qualquer outra coisa
                    console.log('📥 [ADMIN] Carregando mensagens da conversa:', result.conversation.id);
                    await loadAdminChatMessages(result.conversation.id);
                    
                    // Aguardar um pouco para garantir que as mensagens foram carregadas
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Conectar ao socket da conversa para receber mensagens em tempo real
                    if (window.chatSocket && window.chatSocket.connected) {
                        window.chatSocket.emit('join-conversation', { conversationId: result.conversation.id });
                        console.log('✅ [ADMIN] Conectado à sala da conversa via WebSocket');
                    }
                    
                    // Marcar mensagens como lidas pelo atendente
                    try {
                        await window.apiRequest(`/api/chat/conversations/${result.conversation.id}/read`, 'POST', {});
                        console.log('✅ [ADMIN] Mensagens marcadas como lidas');
                    } catch (error) {
                        console.error('Erro ao marcar mensagens como lidas:', error);
                    }
                    
                    // Scroll para o final das mensagens
                    const messagesContainer = document.getElementById('admin-chat-messages');
                    if (messagesContainer) {
                        setTimeout(() => {
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }, 500);
                    }
                    
                    // Atualizar fila
                    await loadQueue();
                    
                    // Atualizar painel de tickets
                    if (typeof loadTicketsPanel === 'function') {
                        loadTicketsPanel();
                    }
                    
                    window.showSuccessToast('Usuário aceito da fila! Ticket criado automaticamente.');
                }
            } catch (error) {
                console.error('Erro ao aceitar da fila:', error);
                window.showSuccessToast('Erro ao aceitar da fila', true);
            }
        };
        
        // Botão de atualizar fila
        const refreshQueueBtn = document.getElementById('admin-refresh-queue-btn');
        if (refreshQueueBtn) {
            refreshQueueBtn.addEventListener('click', loadQueue);
        }
        
        // Botão de broadcast
        const broadcastBtn = document.getElementById('admin-broadcast-btn');
        if (broadcastBtn) {
            broadcastBtn.addEventListener('click', async () => {
                const message = prompt('Digite a mensagem para enviar para todos os usuários:');
                if (message) {
                    try {
                        const result = await window.apiRequest('/api/chat/broadcast', 'POST', { message });
                        window.showSuccessToast(`Mensagem enviada para ${result.successCount} usuário(s)!`);
                    } catch (error) {
                        console.error('Erro ao enviar broadcast:', error);
                        window.showSuccessToast('Erro ao enviar broadcast', true);
                    }
                }
            });
        }
        
        // Botão de fechar ticket
        const closeTicketBtn = document.getElementById('admin-chat-close-ticket-btn');
        if (closeTicketBtn) {
            closeTicketBtn.addEventListener('click', async () => {
                if (!adminCurrentTicketId) return;
                
                const notes = prompt('Observações (opcional):');
                try {
                    await window.apiRequest(`/api/chat/tickets/${adminCurrentTicketId}/close`, 'POST', { notes });
                    window.showSuccessToast('Ticket fechado!');
                    
                    const ticketNumber = document.getElementById('admin-chat-ticket-number');
                    const closeBtn = document.getElementById('admin-chat-close-ticket-btn');
                    if (ticketNumber) ticketNumber.classList.add('hidden');
                    if (closeBtn) closeBtn.classList.add('hidden');
                    
                    adminCurrentTicketId = null;
                    
                    // Atualizar painel de tickets
                    if (typeof loadTicketsPanel === 'function') {
                        loadTicketsPanel();
                    }
                } catch (error) {
                    console.error('Erro ao fechar ticket:', error);
                    window.showSuccessToast('Erro ao fechar ticket', true);
                }
            });
        }
        
        // Botão de anexar no chat admin
        const adminAttachBtn = document.getElementById('admin-chat-attach-btn');
        const adminFileInput = document.getElementById('admin-chat-file-input');
        if (adminAttachBtn && adminFileInput) {
            adminAttachBtn.addEventListener('click', () => adminFileInput.click());
            adminFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file && adminCurrentConversationId) {
                    try {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('conversationId', adminCurrentConversationId);
                        formData.append('messageType', file.type.startsWith('image/') ? 'image' : 
                                                      file.type.startsWith('audio/') ? 'audio' : 
                                                      file.type.startsWith('video/') ? 'video' : 'file');
                        
                        const token = localStorage.getItem('authToken');
                        await fetch('/api/chat/send-file', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });
                        
                        await loadAdminChatMessages(adminCurrentConversationId);
                        adminFileInput.value = '';
                    } catch (error) {
                        console.error('Erro ao enviar arquivo:', error);
                        window.showSuccessToast('Erro ao enviar arquivo', true);
                    }
                }
            });
        }
        
        // Botão de resposta rápida no chat admin
        const adminQuickReplyBtn = document.getElementById('admin-chat-quick-reply-btn');
        if (adminQuickReplyBtn) {
            adminQuickReplyBtn.addEventListener('click', async () => {
                try {
                    const quickReplies = await window.apiRequest('/api/chat/quick-replies', 'GET');
                    if (Array.isArray(quickReplies) && quickReplies.length > 0) {
                        const selected = prompt(`Respostas rápidas disponíveis:\n${quickReplies.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}\n\nDigite o número:`);
                        const index = parseInt(selected) - 1;
                        if (index >= 0 && index < quickReplies.length) {
                            const reply = quickReplies[index];
                            const input = document.getElementById('admin-chat-input');
                            if (input) {
                                input.value = reply.message;
                                input.focus();
                            }
                        }
                    } else {
                        window.showSuccessToast('Nenhuma resposta rápida disponível', true);
                    }
                } catch (error) {
                    console.error('Erro ao carregar respostas rápidas:', error);
                }
            });
        }
        
        // Botão de transferir no chat admin
        const adminTransferBtn = document.getElementById('admin-chat-transfer-btn');
        const transferModal = document.getElementById('transfer-chat-modal');
        const closeTransferModal = document.getElementById('close-transfer-modal');
        const cancelTransferBtn = document.getElementById('cancel-transfer-btn');
        const transferAttendantsList = document.getElementById('transfer-attendants-list');
        
        function showTransferModal() {
            if (!adminCurrentConversationId || !adminCurrentUserId) {
                window.showSuccessToast('Nenhuma conversa ativa para transferir', true);
                return;
            }
            if (transferModal) transferModal.style.display = 'flex';
            loadTransferAttendants();
        }
        
        function hideTransferModal() {
            if (transferModal) transferModal.style.display = 'none';
        }
        
        async function loadTransferAttendants() {
            try {
                const attendants = await window.apiRequest('/api/chat/attendants', 'GET');
                if (transferAttendantsList) {
                    if (Array.isArray(attendants) && attendants.length > 0) {
                        transferAttendantsList.innerHTML = attendants.map(att => `
                            <button data-attendant-id="${att.user_id}" class="transfer-attendant-btn w-full p-3 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="font-medium text-gray-900 dark:text-gray-100">${att.email}</p>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">${att.is_online ? '🟢 Online' : '🔴 Offline'}</p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        `).join('');
                        
                        // Adicionar event listeners
                        transferAttendantsList.querySelectorAll('.transfer-attendant-btn').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const targetAttendantId = parseInt(btn.dataset.attendantId);
                                await transferConversation(targetAttendantId);
                            });
                        });
                    } else {
                        transferAttendantsList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center">Nenhum atendente disponível</p>';
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar atendentes:', error);
            }
        }
        
        async function transferConversation(targetAttendantId) {
            try {
                // Transferir conversa
                await window.apiRequest('/api/chat/conversations/transfer', 'POST', {
                    conversationId: adminCurrentConversationId,
                    targetAttendantId: targetAttendantId,
                    returnToQueue: true // Flag para retornar à fila
                });
                
                window.showSuccessToast('Conversa transferida! Usuário retornou à fila.');
                
                // Fechar chat atual
                const container = document.getElementById('admin-chat-container');
                if (container) container.classList.add('hidden');
                adminCurrentConversationId = null;
                adminCurrentUserId = null;
                adminCurrentTicketId = null;
                
                // Atualizar fila
                await loadQueue();
                hideTransferModal();
            } catch (error) {
                console.error('Erro ao transferir:', error);
                window.showSuccessToast('Erro ao transferir conversa', true);
            }
        }
        
        if (adminTransferBtn) {
            adminTransferBtn.addEventListener('click', showTransferModal);
        }
        if (closeTransferModal) {
            closeTransferModal.addEventListener('click', hideTransferModal);
        }
        if (cancelTransferBtn) {
            cancelTransferBtn.addEventListener('click', hideTransferModal);
        }
        if (transferModal) {
            transferModal.addEventListener('click', (e) => {
                if (e.target === transferModal) hideTransferModal();
            });
        }
        
        // Variáveis de paginação de tickets
        let ticketsCurrentPage = 1;
        const ticketsPerPage = 5;
        
        // Carregar painel de tickets
        async function loadTicketsPanel(page = 1) {
            try {
                const tickets = await window.apiRequest('/api/chat/tickets', 'GET');
                const ticketsList = document.getElementById('tickets-list');
                const statusFilter = document.getElementById('ticket-status-filter')?.value || 'all';
                const searchInput = document.getElementById('ticket-search-input')?.value || '';
                
                if (!Array.isArray(tickets)) return;
                
                // Filtrar tickets
                let filteredTickets = tickets;
                
                // Filtrar por status
                if (statusFilter !== 'all') {
                    filteredTickets = filteredTickets.filter(t => t.status === statusFilter);
                }
                
                // Filtrar por busca
                if (searchInput.trim()) {
                    const searchTerm = searchInput.trim().toLowerCase();
                    filteredTickets = filteredTickets.filter(t => 
                        t.ticket_number?.toLowerCase().includes(searchTerm) ||
                        t.user_email?.toLowerCase().includes(searchTerm) ||
                        t.attendant_email?.toLowerCase().includes(searchTerm)
                    );
                }
                
                // Ordenar por data de criação (mais recentes primeiro)
                filteredTickets.sort((a, b) => {
                    const dateA = new Date(a.created_at);
                    const dateB = new Date(b.created_at);
                    return dateB - dateA;
                });
                
                // Atualizar estatísticas (usando todos os tickets, não apenas filtrados)
                const openCount = tickets.filter(t => t.status === 'open').length;
                const closedCount = tickets.filter(t => t.status === 'closed').length;
                const totalCount = tickets.length;
                
                const openCountEl = document.getElementById('tickets-open-count');
                const closedCountEl = document.getElementById('tickets-closed-count');
                const totalCountEl = document.getElementById('tickets-total-count');
                
                if (openCountEl) openCountEl.textContent = openCount;
                if (closedCountEl) closedCountEl.textContent = closedCount;
                if (totalCountEl) totalCountEl.textContent = totalCount;
                
                // Paginação
                const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage);
                ticketsCurrentPage = Math.min(page, totalPages || 1);
                const startIndex = (ticketsCurrentPage - 1) * ticketsPerPage;
                const endIndex = startIndex + ticketsPerPage;
                const paginatedTickets = filteredTickets.slice(startIndex, endIndex);
                
                // Renderizar lista
                if (ticketsList) {
                    if (paginatedTickets.length > 0) {
                        ticketsList.innerHTML = paginatedTickets.map(ticket => {
                            const createdDate = new Date(ticket.created_at).toLocaleString('pt-BR');
                            const closedDate = ticket.closed_at ? new Date(ticket.closed_at).toLocaleString('pt-BR') : null;
                            const statusColor = ticket.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
                            
                            return `
                                <div class="p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                                    <div class="flex items-start justify-between">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2 mb-2">
                                                <span class="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">${ticket.ticket_number}</span>
                                                <span class="px-2 py-1 text-xs rounded ${statusColor}">${ticket.status === 'open' ? 'Aberto' : 'Fechado'}</span>
                                            </div>
                                            <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                <span class="font-medium">Usuário:</span> ${ticket.user_email || 'N/A'}
                                            </p>
                                            ${ticket.attendant_email ? `
                                                <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                    <span class="font-medium">Atendente:</span> ${ticket.attendant_email}
                                                </p>
                                            ` : ''}
                                            <p class="text-xs text-gray-500 dark:text-gray-500">
                                                Criado em: ${createdDate}
                                                ${closedDate ? ` | Fechado em: ${closedDate}` : ''}
                                            </p>
                                            ${ticket.notes ? `
                                                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
                                                    Observações: ${ticket.notes}
                                                </p>
                                            ` : ''}
                                        </div>
                                        <button data-ticket-id="${ticket.id}" class="view-ticket-btn ml-4 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
                                            Ver Detalhes
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('');
                        
                        // Adicionar event listeners
                        ticketsList.querySelectorAll('.view-ticket-btn').forEach(btn => {
                            btn.addEventListener('click', () => {
                                const ticketId = parseInt(btn.dataset.ticketId);
                                viewTicketDetails(ticketId);
                            });
                        });
                        
                        // Adicionar controles de paginação
                        const paginationContainer = document.getElementById('tickets-pagination');
                        if (paginationContainer) {
                            if (totalPages > 1) {
                                let paginationHtml = '<div class="flex items-center justify-center gap-2 mt-4">';
                                
                                // Botão anterior
                                if (ticketsCurrentPage > 1) {
                                    paginationHtml += `<button data-ticket-page="${ticketsCurrentPage - 1}" class="ticket-page-btn px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300">Anterior</button>`;
                                }
                                
                                // Números de página
                                for (let i = 1; i <= totalPages; i++) {
                                    if (i === 1 || i === totalPages || (i >= ticketsCurrentPage - 1 && i <= ticketsCurrentPage + 1)) {
                                        paginationHtml += `<button data-ticket-page="${i}" class="ticket-page-btn px-3 py-1 text-sm ${i === ticketsCurrentPage ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'} rounded">${i}</button>`;
                                    } else if (i === ticketsCurrentPage - 2 || i === ticketsCurrentPage + 2) {
                                        paginationHtml += '<span class="px-2 text-gray-500">...</span>';
                                    }
                                }
                                
                                // Botão próximo
                                if (ticketsCurrentPage < totalPages) {
                                    paginationHtml += `<button data-ticket-page="${ticketsCurrentPage + 1}" class="ticket-page-btn px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300">Próximo</button>`;
                                }
                                
                                paginationHtml += `</div><p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">Página ${ticketsCurrentPage} de ${totalPages} (${filteredTickets.length} ticket(s))</p>`;
                                paginationContainer.innerHTML = paginationHtml;
                                
                                // Adicionar event listeners aos botões de paginação
                                paginationContainer.querySelectorAll('.ticket-page-btn').forEach(btn => {
                                    btn.addEventListener('click', (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const page = parseInt(btn.getAttribute('data-ticket-page'));
                                        if (page && page > 0 && page <= totalPages) {
                                            loadTicketsPanel(page);
                                        }
                                    });
                                });
                            } else {
                                paginationContainer.innerHTML = '';
                            }
                        }
                    } else {
                        ticketsList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Nenhum ticket encontrado</p>';
                        const paginationContainer = document.getElementById('tickets-pagination');
                        if (paginationContainer) paginationContainer.innerHTML = '';
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar tickets:', error);
            }
        }
        
        // Função global para carregar página de tickets
        window.loadTicketsPage = function(page) {
            loadTicketsPanel(page);
        };
        
        async function viewTicketDetails(ticketId) {
            try {
                const tickets = await window.apiRequest('/api/chat/tickets', 'GET');
                const ticket = tickets.find(t => t.id === ticketId);
                if (ticket && ticket.conversation_id) {
                    // Abrir conversa relacionada
                    adminCurrentConversationId = ticket.conversation_id;
                    adminCurrentUserId = ticket.user_id;
                    adminCurrentTicketId = ticket.id;
                    
                    const container = document.getElementById('admin-chat-container');
                    if (container) container.classList.remove('hidden');
                    
                    const ticketNumber = document.getElementById('admin-chat-ticket-number');
                    const closeTicketBtn = document.getElementById('admin-chat-close-ticket-btn');
                    const userName = document.getElementById('admin-chat-user-name');
                    
                    if (ticketNumber) {
                        ticketNumber.textContent = `Ticket ${ticket.ticket_number}`;
                        ticketNumber.classList.remove('hidden');
                    }
                    if (closeTicketBtn) {
                        if (ticket.status === 'open') {
                            closeTicketBtn.classList.remove('hidden');
                        } else {
                            closeTicketBtn.classList.add('hidden');
                        }
                    }
                    if (userName) {
                        userName.textContent = ticket.user_email || 'Usuário';
                    }
                    
                    // Carregar todas as mensagens da conversa
                    await loadAdminChatMessages(ticket.conversation_id);
                    
                    // Scroll para o final da conversa
                    const messagesContainer = document.getElementById('admin-chat-messages');
                    if (messagesContainer) {
                        setTimeout(() => {
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }, 100);
                    }
                } else {
                    window.showSuccessToast('Ticket ou conversa não encontrada', true);
                }
            } catch (error) {
                console.error('Erro ao visualizar ticket:', error);
                window.showSuccessToast('Erro ao visualizar ticket', true);
            }
        }
        
        // Event listeners para busca e filtros de tickets
        const ticketSearchInput = document.getElementById('ticket-search-input');
        const ticketStatusFilter = document.getElementById('ticket-status-filter');
        const refreshTicketsBtn = document.getElementById('refresh-tickets-btn');
        
        if (ticketSearchInput) {
            ticketSearchInput.addEventListener('input', window.debounce(() => {
                ticketsCurrentPage = 1;
                loadTicketsPanel(1);
            }, 300));
        }
        if (ticketStatusFilter) {
            ticketStatusFilter.addEventListener('change', () => {
                ticketsCurrentPage = 1;
                loadTicketsPanel(1);
            });
        }
        if (refreshTicketsBtn) {
            refreshTicketsBtn.addEventListener('click', () => {
                ticketsCurrentPage = 1;
                loadTicketsPanel(1);
            });
        }
        
        // Botão para zerar todos os tickets
        const clearAllTicketsBtn = document.getElementById('clear-all-tickets-btn');
        if (clearAllTicketsBtn) {
            clearAllTicketsBtn.addEventListener('click', () => {
                window.showConfirmationModal(
                    'Zerar Todos os Tickets',
                    'Tem certeza de que deseja deletar TODOS os tickets? Esta ação é irreversível e não pode ser desfeita!',
                    async () => {
                        try {
                            await window.apiRequest('/api/chat/tickets', 'DELETE');
                            window.showSuccessToast('Todos os tickets foram deletados com sucesso!');
                            ticketsCurrentPage = 1;
                            loadTicketsPanel(1);
                        } catch (error) {
                            console.error('Erro ao deletar tickets:', error);
                            window.showSuccessToast(`Erro ao deletar tickets: ${error.message}`, true);
                        }
                    }
                );
            });
        }
        
        // Carregar dados iniciais apenas se estiver logado
        const token = localStorage.getItem('authToken');
        if (token && window.appState.currentUser) {
        loadAttendants();
        loadQuickRepliesAdmin();
            
            // Carregar usuários para chat admin quando o painel for inicializado
            // Usar setTimeout para garantir que o DOM foi atualizado
            setTimeout(() => {
                if (window.appState.currentUser && (window.appState.currentUser.role === 'admin' || window.appState.currentUser.role === 'attendant')) {
                    loadUsersForAdminChat();
                    // Inicializar busca de usuários após carregar
                    setTimeout(() => {
                        if (typeof initializeAdminChatUserSearch === 'function') {
                            initializeAdminChatUserSearch();
                        }
                    }, 300);
                    
                    if (typeof loadQueue === 'function') {
                        loadQueue();
                    }
                    if (typeof loadTicketsPanel === 'function') {
                        loadTicketsPanel();
                    }
                    
                    // Limpar intervalo anterior se existir
                    if (window.queueCheckInterval) {
                        clearInterval(window.queueCheckInterval);
                    }
                    
                    // Criar novo intervalo apenas se estiver logado
                    if (typeof loadQueue === 'function') {
                        window.queueCheckInterval = setInterval(loadQueue, 10000); // Atualizar a cada 10 segundos
                    }
                }
            }, 200);
        }
        
        // Verificar posição na fila (para usuários)
        async function checkQueuePosition() {
            // Verificar se o usuário está logado
            const token = localStorage.getItem('authToken');
            if (!token || !window.appState.currentUser) {
                if (window.queuePositionInterval) {
                    clearInterval(window.queuePositionInterval);
                    window.queuePositionInterval = null;
                }
                return;
            }
            
            try {
                const queueInfo = await window.apiRequest('/api/chat/queue', 'GET');
                if (queueInfo && queueInfo.position) {
                    const widgetStatus = document.getElementById('chat-status');
                    if (widgetStatus) {
                        widgetStatus.textContent = `Aguardando atendimento... Posição ${queueInfo.position} na fila`;
                    }
                }
            } catch (error) {
                // Limpar intervalo se não estiver autenticado
                if (error.message && error.message.includes('token')) {
                    if (window.queuePositionInterval) {
                        clearInterval(window.queuePositionInterval);
                        window.queuePositionInterval = null;
                    }
                }
            }
        }
        
        // Entrar na fila quando usuário abrir chat
        async function joinQueue() {
            // Verificar se o usuário está logado
            const token = localStorage.getItem('authToken');
            if (!token || !window.appState.currentUser || window.appState.currentUser.role !== 'user') {
                return;
            }
            
            // Verificar se o chat está habilitado antes de tentar entrar na fila
            const chatEnabled = await isChatEnabled();
            if (!chatEnabled) {
                // Não tentar entrar na fila se o chat estiver desabilitado
                return;
            }
            
            try {
                await window.apiRequest('/api/chat/queue/join', 'POST', {});
                await checkQueuePosition();
                
                // Limpar intervalo anterior se existir
                if (window.queuePositionInterval) {
                    clearInterval(window.queuePositionInterval);
                }
                
                // Criar novo intervalo apenas se estiver logado
                if (token && window.appState.currentUser) {
                    window.queuePositionInterval = setInterval(checkQueuePosition, 5000);
                }
            } catch (error) {
                // Ignorar erros silenciosamente quando o chat está desabilitado
                // Não fazer log para evitar poluir o console
            }
        }
        
        // Tornar joinQueue global para uso no widget
        window.joinQueue = joinQueue;
    };
    
    // ============================================================================
    // FUNÇÕES DA ACADEMY
    // ============================================================================
    
    // Helper para extrair ID do vídeo do YouTube
    window.getYouTubeVideoId = (url) => {
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
    
    // Helper para obter a classe rounded correta para a tag
    window.getTagRoundedClass = (position) => {
        switch (position) {
            case 'top-2 left-2': return 'rounded-br-lg';
            case 'top-2 right-2': return 'rounded-bl-lg';
            case 'bottom-2 left-2': return 'rounded-tr-lg';
            case 'bottom-2 right-2': return 'rounded-tl-lg';
            default: return 'rounded-br-lg'; // Default to top-left if not specified
        }
    };
    
    // Função para abrir o modal do player de vídeo
    window.openVideoPlayerModal = (youtubeUrl, title, description) => {
        const videoPlayerModal = document.getElementById('video-player-modal');
        const videoPlayerIframe = document.getElementById('video-player-iframe');
        const videoModalTitle = document.getElementById('video-modal-title');
        const videoModalDescription = document.getElementById('video-modal-description');

        if (!videoPlayerModal || !videoPlayerIframe || !videoModalTitle || !videoModalDescription) return;

        const videoId = window.getYouTubeVideoId(youtubeUrl);
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
            window.showSuccessToast('URL do YouTube inválida.');
        }
    };
    
    // Função para mostrar fallback quando o vídeo não carrega
    window.showWelcomeVideoFallback = () => {
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
    };
    
    // Função para inicializar a Academy (PREENCHE OS VÍDEOS)
    window.initializeAcademy = async function() {
        const academyLessonsContainer = document.getElementById('academy-lessons-container');
        if (!academyLessonsContainer) return;

        try {
            const lessons = await window.apiRequest('/api/academy', 'GET');
            if (lessons.length === 0) {
                academyLessonsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhuma aula adicionada ainda.</p>';
            } else {
                academyLessonsContainer.innerHTML = lessons.map(lesson => `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 relative overflow-hidden group cursor-pointer academy-lesson-card"
                         data-youtube-url="${lesson.youtube_url}"
                         data-lesson-title="${lesson.title}"
                         data-lesson-description="${lesson.description || ''}">
                        <div class="relative w-full h-40 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
                            <img src="https://img.youtube.com/vi/${window.getYouTubeVideoId(lesson.youtube_url)}/hqdefault.jpg" 
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
                        ${lesson.tag_text ? `<span class="absolute ${lesson.tag_position || 'top-2 left-2'} bg-blue-600 text-white text-xs font-bold px-2 py-1 ${window.getTagRoundedClass(lesson.tag_position)} z-10">${lesson.tag_text}</span>` : ''}
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
                        window.openVideoPlayerModal(youtubeUrl, title, description);
                    });
                });
            }

            // Show welcome video sempre que entrar na Academy (exceto se marcou "não mostrar mais")
            if (window.appState.currentTab === 'academy' && !window.appState.welcomeVideoDontShow && window.appState.currentUser && window.appState.currentUser.role !== 'admin') {
                const appSettings = await window.apiRequest('/api/app-settings', 'GET');
                const welcomeVideoUrl = appSettings.welcomeVideoUrl;
                if (welcomeVideoUrl) {
                    const welcomeVideoModal = document.getElementById('welcome-video-modal');
                    const welcomeVideoIframe = document.getElementById('welcome-video-iframe');
                    if (welcomeVideoModal && welcomeVideoIframe) {
                        const videoId = window.getYouTubeVideoId(welcomeVideoUrl);
                        if (videoId) {
                            // Esconde o fallback inicialmente
                            const fallbackDiv = document.getElementById('welcome-video-fallback');
                            if (fallbackDiv) {
                                fallbackDiv.classList.add('hidden');
                            }
                            
                            // Marca que o vídeo de boas-vindas está ativo
                            window.appState.isWelcomeVideoActive = true;
                            
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
                                window.appState.isWelcomeVideoActive = false;
                                window.showWelcomeVideoFallback();
                            };
                        } else {
                            window.addToLog(`URL do video de boas-vindas invalida: ${welcomeVideoUrl}`, true);
                        }
                    }
                }
            }

        } catch (error) {
            window.addToLog(`Erro ao carregar aulas da Academy: ${error.message}`, true);
            if (academyLessonsContainer) academyLessonsContainer.innerHTML = `<p class="text-red-500">Erro ao carregar aulas: ${error.message}</p>`;
        }
    };
    
    // ============================================================================
    // EVENT LISTENERS GLOBAIS PARA MODAIS DE VÍDEO
    // ============================================================================
    
    // Video Player Modal - fechar
    const closeVideoModalBtn = document.getElementById('close-video-modal-btn');
    if (closeVideoModalBtn) {
        closeVideoModalBtn.addEventListener('click', () => {
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
    }

    // Welcome Video Modal - fechar
    const closeWelcomeVideoModalBtn = document.getElementById('close-welcome-video-modal-btn');
    if (closeWelcomeVideoModalBtn) {
        closeWelcomeVideoModalBtn.addEventListener('click', () => {
            const welcomeVideoModal = document.getElementById('welcome-video-modal');
            const welcomeVideoIframe = document.getElementById('welcome-video-iframe');
            const dontShowAgainCheckbox = document.getElementById('welcome-video-dont-show');
            
            // Reseta a flag quando o modal é fechado
            window.appState.isWelcomeVideoActive = false;
            
            // Verifica se o usuário marcou "não mostrar mais"
            if (dontShowAgainCheckbox && dontShowAgainCheckbox.checked) {
                localStorage.setItem('welcomeVideoDontShow', 'true');
                window.appState.welcomeVideoDontShow = true;
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
    }
    
    // Detectar erro no iframe do vídeo de boas-vindas usando YouTube API
    // Listener global para mensagens do YouTube Player API (erro 153)
    // Usa uma flag para rastrear se o vídeo de boas-vindas está ativo
    window.addEventListener('message', (event) => {
        if (event.origin !== 'https://www.youtube.com') return;
        if (!window.appState.isWelcomeVideoActive) return; // Só processa se o vídeo de boas-vindas estiver ativo
        
        try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data && (data.event === 'onError' || data.errorCode === 153 || (data.info && data.info.includes('153')))) {
                const welcomeVideoModal = document.getElementById('welcome-video-modal');
                if (welcomeVideoModal && welcomeVideoModal.style.display === 'flex') {
                    window.showWelcomeVideoFallback();
                    window.appState.isWelcomeVideoActive = false; // Reseta a flag após mostrar fallback
                }
            }
        } catch (e) {
            // Ignora erros de parsing
        }
    });
    
    // ============================================================================
    // INICIALIZAÇÕES DE MÓDULOS - FUNÇÕES GLOBAIS
    // ============================================================================
    
    // Inicialização do Divisor de Texto - CÓDIGO COMPLETO DO ORIGINAL
    window.initializeTextDivider = function() {
        // Aguardar um pouco para garantir que o template foi clonado e renderizado
        setTimeout(() => {
            const textDividerInput = document.getElementById('text-divider-input');
            const wordCountEl = document.getElementById('word-count');
            const charCountEl = document.getElementById('char-count');
            const timeEstimateEl = document.getElementById('time-estimate');
            const splitTextBtn = document.getElementById('split-text-btn');
            
            if (!textDividerInput || !wordCountEl || !charCountEl || !timeEstimateEl) {
                // Silenciosamente tentar novamente sem spam de logs
                // Se já inicializou antes, não tentar novamente
                if (!window._textDividerRetryCount) window._textDividerRetryCount = 0;
                window._textDividerRetryCount++;
                if (window._textDividerRetryCount < 3) {
                    setTimeout(() => window.initializeTextDivider(), 300);
                }
                return;
            }
            
            // Resetar contador se encontrou os elementos
            window._textDividerRetryCount = 0;

            const updateCounts = () => {
                const text = textDividerInput.value || '';
                const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
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

            // Verificar se já tem listeners (usar flag para evitar duplicatas)
            if (!textDividerInput.dataset.listenersAttached) {
                // Criar uma função de update que não seja anônima para poder remover depois
                textDividerInput._updateCountsHandler = updateCounts;
                textDividerInput._updateCountsPasteHandler = () => setTimeout(updateCounts, 10);
                textDividerInput._updateCountsKeyupHandler = updateCounts;
                textDividerInput._updateCountsChangeHandler = updateCounts;
                
                // Adicionar listeners diretamente (não clonar para não perder o valor do textarea)
                textDividerInput.addEventListener('input', textDividerInput._updateCountsHandler);
                textDividerInput.addEventListener('paste', textDividerInput._updateCountsPasteHandler);
                textDividerInput.addEventListener('keyup', textDividerInput._updateCountsKeyupHandler);
                textDividerInput.addEventListener('change', textDividerInput._updateCountsChangeHandler);
                
                // Marcar que os listeners foram anexados
                textDividerInput.dataset.listenersAttached = 'true';
            }
            
            // Atualizar contadores imediatamente (importante para texto já existente)
            updateCounts();
            
            // Configurar botão de dividir se necessário
            if (splitTextBtn && !splitTextBtn.dataset.listenerAdded) {
                splitTextBtn.dataset.listenerAdded = 'true';
                // O handler já está registrado globalmente, não precisa duplicar
            }
            
            console.log('✅ Divisor de Texto inicializado e contadores atualizados');
        }, 150);
    };
    
    // Inicialização do Conversor de SRT - CÓDIGO COMPLETO DO ORIGINAL
    window.initializeSrtConverter = function() {
        const textoInput = document.getElementById('textoInput');
        const convertSrtButton = document.getElementById('convert-srt-button');
        const resultadoEl = document.getElementById('resultado');
        const downloadBtn = document.getElementById('downloadBtn');
        const limparBtn = document.getElementById('limparBtn');

        const clearSrtOutput = () => {
            if (textoInput) textoInput.value = '';
            if (resultadoEl) resultadoEl.textContent = '';
            if (downloadBtn) downloadBtn.style.display = 'none';
            if (limparBtn) limparBtn.style.display = 'none';
            window.showSuccessToast('Campos SRT limpos.');
        };
        
        // Handler para download do SRT
        if (downloadBtn) {
            // Remover listener antigo se existir
            const newDownloadBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
            
            newDownloadBtn.addEventListener('click', () => {
                const resultado = resultadoEl?.textContent || '';
                if (!resultado || !resultado.trim()) {
                    window.showSuccessToast("Nenhum resultado SRT disponível para transferir.", true);
                    return;
                }
                
                // Usar safelyDownloadFile para transferir o arquivo
                if (typeof window.safelyDownloadFile === 'function') {
                    window.safelyDownloadFile(resultado.trim(), 'legendas.srt', 'text/plain', 'Transferência do SRT iniciada!');
                } else {
                    // Fallback se safelyDownloadFile não existir
                    const blob = new Blob([resultado.trim()], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'legendas.srt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    window.showSuccessToast('Transferência do SRT iniciada!');
                }
            });
        }

        if (convertSrtButton) {
            // Remover listener antigo se existir
            const newConvertBtn = convertSrtButton.cloneNode(true);
            convertSrtButton.parentNode.replaceChild(newConvertBtn, convertSrtButton);
            
            // Anexar handler do módulo se existir
            if (window.handlers && window.handlers['convert-to-srt']) {
                newConvertBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.handlers['convert-to-srt'](e);
                });
            } else {
                // Fallback: anexar handler do módulo diretamente
                const module = window.moduleLoader?.getModule('srt-converter');
                if (module && module.handler) {
                    newConvertBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        module.handler(e);
                    });
                }
            }
        }
        
        if (limparBtn) {
            // Remover listener antigo se existir
            const newLimparBtn = limparBtn.cloneNode(true);
            limparBtn.parentNode.replaceChild(newLimparBtn, limparBtn);
            newLimparBtn.addEventListener('click', clearSrtOutput);
        }
        
        console.log('✅ Conversor de SRT inicializado');
    };

    // ============================================================================
    // HANDLER COMPLETO: GENERATE-SCENE-PROMPTS
    // Extraído do app1.js (linhas 6643-7990)
    // ============================================================================
    
    // Constantes necessárias
    const RECOMMENDED_MODEL = 'gpt-4o';
    const SCENE_TOKENS_PER_PROMPT = 300;
    
    // TOKEN_LIMITS_FRONTEND - Para cálculos de tokens
    const TOKEN_LIMITS_FRONTEND = {
        'gpt-5.1': { maxContextLength: 200000, maxOutputTokens: 32768 },
        'gpt-4o': { maxContextLength: 128000, maxOutputTokens: 16384 },
        'gpt-4-turbo': { maxContextLength: 128000, maxOutputTokens: 16384 },
        'gpt-3.5-turbo': { maxContextLength: 16385, maxOutputTokens: 4096 },
        'claude-3-5-sonnet': { maxContextLength: 200000, maxOutputTokens: 8192 },
        'claude-3-5-haiku': { maxContextLength: 200000, maxOutputTokens: 4096 },
        'claude-3-opus': { maxContextLength: 200000, maxOutputTokens: 4096 },
        'claude-3-sonnet': { maxContextLength: 200000, maxOutputTokens: 4096 },
        'claude-sonnet-4': { maxContextLength: 200000, maxOutputTokens: 8192 },
        'claude-sonnet-4.5': { maxContextLength: 200000, maxOutputTokens: 8192 },
        'gemini-3-pro-preview': { maxContextLength: 1048576, maxOutputTokens: 65536 },
        'gemini-2.5-pro': { maxContextLength: 2000000, maxOutputTokens: 32768 },
        'gemini-2.5-flash': { maxContextLength: 1000000, maxOutputTokens: 16384 },
        'gemini-2.5-flash-lite': { maxContextLength: 1000000, maxOutputTokens: 8192 },
        'gemini-1.5-pro': { maxContextLength: 2000000, maxOutputTokens: 8192 },
        'gemini-1.5-flash': { maxContextLength: 1000000, maxOutputTokens: 8192 }
    };
    
    // MODEL_ALIAS_RULES - Regras para normalização de nomes de modelos
    const MODEL_ALIAS_RULES = [
        { test: /^claude-sonnet-4-5/, canonical: 'claude-sonnet-4.5' },
        { test: /^claude-sonnet-45/, canonical: 'claude-sonnet-4.5' },
        { test: /^claude-sonnet4-5/, canonical: 'claude-sonnet-4.5' },
        { test: /^claude-3-5-sonnet-/, canonical: 'claude-3-5-sonnet' },
        { test: /^claude-35-sonnet/, canonical: 'claude-3-5-sonnet' },
        { test: /^claude-3-5-haiku-/, canonical: 'claude-3-5-haiku' },
        { test: /^claude-35-haiku/, canonical: 'claude-3-5-haiku' },
        { test: /^claude-3-opus-/, canonical: 'claude-3-opus' },
        { test: /^claude-3-sonnet-/, canonical: 'claude-3-sonnet' },
        { test: /^gpt-4o-mini/, canonical: 'gpt-4o' },
        { test: /^gpt4o/, canonical: 'gpt-4o' },
        { test: /^gpt-51/, canonical: 'gpt-5.1' },
        { test: /^gpt5/, canonical: 'gpt-5.1' },
        { test: /^gpt4-turbo/, canonical: 'gpt-4-turbo' },
        { test: /^gpt-35-turbo/, canonical: 'gpt-3.5-turbo' },
        { test: /^gemini-3-pro-preview/, canonical: 'gemini-3-pro-preview' },
        { test: /^gemini-3-pro/, canonical: 'gemini-3-pro-preview' },
        { test: /^gemini3pro/, canonical: 'gemini-3-pro-preview' },
        { test: /^gemini-2\.0-flash-exp/, canonical: 'gemini-2.5-flash' },
        { test: /^gemini-25-pro/, canonical: 'gemini-2.5-pro' },
        { test: /^gemini-25-flash-lite/, canonical: 'gemini-2.5-flash-lite' },
        { test: /^gemini-25-flash/, canonical: 'gemini-2.5-flash' },
        { test: /^gemini-15-pro/, canonical: 'gemini-1.5-pro' },
        { test: /^gemini-15-flash/, canonical: 'gemini-1.5-flash' },
        { test: /^gemini-pro/, canonical: 'gemini-2.5-pro' },
        { test: /^gemini-flash/, canonical: 'gemini-2.5-flash' }
    ];
    
    // SCENE_MODEL_OUTPUT_LIMITS
    const SCENE_MODEL_OUTPUT_LIMITS = {
        "gemini-3-pro-preview": 65536,
        "gemini-2.5-flash-lite": 8192,
        "gemini-2.5-flash": 16384,
        "gemini-2.5-pro": 32768,
        "gpt-4o": 16384,
        "gpt-4-turbo": 16384,
        "gpt-3.5-turbo": 4096,
        "claude-sonnet-4": 8192,
        "claude-sonnet-4.5": 8192,
        "claude-3.5-haiku": 4096
    };
    
    // Funções auxiliares necessárias para o handler de Prompts para Cenas
    window.normalizeModelName = window.normalizeModelName || function(model = '') {
        let normalized = model.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '').trim();
        normalized = normalized.replace(/-20\d{6,8}$/, '');
        for (const rule of MODEL_ALIAS_RULES) {
            if (rule.test.test(normalized)) {
                normalized = rule.canonical;
                break;
            }
        }
        return normalized;
    };
    
    window.getTokenLimitsFrontend = window.getTokenLimitsFrontend || function(model) {
        const m = window.normalizeModelName(model);
        if (TOKEN_LIMITS_FRONTEND[m]) return TOKEN_LIMITS_FRONTEND[m];
        
        const patterns = [
            { key: 'gpt-5.1', match: ['gpt-5.1', 'gpt51', 'gpt-5-1', 'gpt5.1'] },
            { key: 'gpt-4o', match: ['gpt-4o', 'gpt4o', 'gpt-4.1', 'gpt-4.0'] },
            { key: 'gpt-4-turbo', match: ['gpt-4-turbo', 'gpt4turbo'] },
            { key: 'gpt-3.5-turbo', match: ['gpt-3.5', 'gpt35'] },
            { key: 'claude-3-5-sonnet', match: ['claude-3-5-sonnet', 'claude-3-5', 'claude-35-sonnet'] },
            { key: 'claude-3-5-haiku', match: ['claude-3-5-haiku'] },
            { key: 'claude-3-opus', match: ['claude-3-opus', 'opus'] },
            { key: 'claude-3-sonnet', match: ['claude-3-sonnet'] },
            { key: 'claude-sonnet-4', match: ['claude-sonnet-4', 'claude-sonnet4', 'sonnet-4'] },
            { key: 'claude-sonnet-4.5', match: ['claude-sonnet-4.5', 'claude-sonnet4.5', 'sonnet-4.5'] },
            { key: 'gemini-3-pro-preview', match: ['gemini-3-pro-preview', 'gemini-3-pro', 'gemini3pro'] },
            { key: 'gemini-2.5-pro', match: ['gemini-2.5-pro'] },
            { key: 'gemini-2.5-flash-lite', match: ['gemini-2.5-flash-lite'] },
            { key: 'gemini-2.5-flash', match: ['gemini-2.5-flash'] },
            { key: 'gemini-1.5-pro', match: ['gemini-1.5-pro'] },
            { key: 'gemini-1.5-flash', match: ['gemini-1.5-flash'] }
        ];
        
        for (const p of patterns) {
            for (const rule of p.match) {
                if (m.includes(rule)) return TOKEN_LIMITS_FRONTEND[p.key];
            }
        }
        
        if (m.includes('gpt-5')) return TOKEN_LIMITS_FRONTEND['gpt-5.1'];
        if (m.includes('gpt-4')) return TOKEN_LIMITS_FRONTEND['gpt-4o'];
        if (m.includes('gpt-3.5')) return TOKEN_LIMITS_FRONTEND['gpt-3.5-turbo'];
        if (m.includes('claude-3-5')) return TOKEN_LIMITS_FRONTEND['claude-3-5-sonnet'];
        if (m.includes('claude-3')) return TOKEN_LIMITS_FRONTEND['claude-3-sonnet'];
        if (m.includes('gemini-3')) return TOKEN_LIMITS_FRONTEND['gemini-3-pro-preview'];
        if (m.includes('gemini-2.5')) {
            if (m.includes('flash-lite')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-flash-lite'];
            if (m.includes('flash')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-flash'];
            if (m.includes('pro')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-pro'];
            return TOKEN_LIMITS_FRONTEND['gemini-2.5-pro'];
        }
        if (m.includes('gemini-1.5')) return TOKEN_LIMITS_FRONTEND['gemini-1.5-pro'];
        if (m.includes('gemini')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-flash'];
        
        console.warn(`⚠️ Modelo desconhecido: "${model}". Usando fallback conservador.`);
        return { maxContextLength: 16000, maxOutputTokens: 4000 };
    };
    
    window.getSceneModelOutputLimit = window.getSceneModelOutputLimit || function(modelName) {
        if (!modelName) return 8192;
        const normalized = window.normalizeModelName(modelName);
        const foundKey = Object.keys(SCENE_MODEL_OUTPUT_LIMITS).find(key => normalized.includes(window.normalizeModelName(key)));
        return SCENE_MODEL_OUTPUT_LIMITS[foundKey] || 8192;
    };
    
    window.calcularLotes = window.calcularLotes || function(modelName, totalPrompts, tokensPorPrompt = SCENE_TOKENS_PER_PROMPT) {
        const outputLimit = window.getSceneModelOutputLimit(modelName);
        const maxPromptsPorRequest = Math.max(1, Math.floor(outputLimit / tokensPorPrompt));
        const lotes = [];
        let restante = totalPrompts;
        
        while (restante > 0) {
            const quantidade = Math.min(maxPromptsPorRequest, restante);
            lotes.push(quantidade);
            restante -= quantidade;
        }
        
        return {
            modelo: modelName,
            totalPrompts,
            tokensPorPrompt,
            saidaMax: outputLimit,
            maxPromptsPorRequest,
            lotes,
            totalDeRequests: lotes.length
        };
    };
    
    window.splitTextIntoWordChunks = window.splitTextIntoWordChunks || function(text, maxWords) {
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
    
    window.createSceneProcessingQueue = window.createSceneProcessingQueue || function(segments, sceneDistribution, maxPromptsPerRequest, preferredBatchSize = 2) {
        const batchLimit = Math.max(1, Math.min(maxPromptsPerRequest, preferredBatchSize));
        const queue = [];
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const targetScenes = sceneDistribution[i];
            
            if (targetScenes <= batchLimit) {
                queue.push({ text: segment.text, wordCount: segment.wordCount, sceneTarget: targetScenes });
                continue;
            }
            
            const batchesNeeded = Math.ceil(targetScenes / batchLimit);
            const wordsPerBatch = Math.max(50, Math.ceil(segment.wordCount / batchesNeeded));
            const subSegments = window.splitTextIntoWordChunks(segment.text, wordsPerBatch);
            const usableSegments = subSegments.length ? subSegments : [{ text: segment.text, wordCount: segment.wordCount }];
            
            let remainingScenes = targetScenes;
            const totalWords = usableSegments.reduce((sum, sub) => sum + sub.wordCount, 0) || segment.wordCount;
            
            usableSegments.forEach((sub, idx) => {
                const remainingSegments = usableSegments.length - idx;
                let estimatedScenes = Math.min(batchLimit, Math.max(1, Math.round((sub.wordCount / totalWords) * targetScenes)));
                const minRemainingNeeded = Math.max(remainingSegments - 1, 0);
                if (estimatedScenes > remainingScenes - minRemainingNeeded) {
                    estimatedScenes = remainingScenes - minRemainingNeeded;
                }
                if (estimatedScenes > batchLimit) estimatedScenes = batchLimit;
                if (estimatedScenes < 1) estimatedScenes = Math.min(batchLimit, remainingScenes - minRemainingNeeded);
                if (idx === usableSegments.length - 1) estimatedScenes = remainingScenes;
                remainingScenes -= estimatedScenes;
                queue.push({ text: sub.text, wordCount: sub.wordCount, sceneTarget: estimatedScenes });
            });
            
            if (remainingScenes > 0 && queue.length > 0) {
                queue[queue.length - 1].sceneTarget += remainingScenes;
            }
        }
        return queue;
    };
    
    // Funções de renderização e histórico para Prompts para Cenas
    window.renderSceneGenerationProgress = window.renderSceneGenerationProgress || function(status) {
        let panel = document.getElementById('scene-gen-progress-panel');
        if (!panel) return;
        if (!status || !status.active) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        const { current = 0, total = 0, message, subMessage, chunkTotal = 0, chunkCurrent = 0 } = status;
        const baseProgress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        const stageProgress = status.stageProgress ? Math.min(99, Math.max(0, Math.round(status.stageProgress))) : 0;
        const progress = Math.max(baseProgress, stageProgress);
        const isComplete = total > 0 && current >= total;
        const safeChunkCurrent = chunkTotal > 0 ? Math.min(chunkCurrent, chunkTotal) : 0;
        const chunkPercent = chunkTotal > 0 ? Math.min(100, Math.round((safeChunkCurrent / chunkTotal) * 100)) : 0;
        let title, titleColor, progressBarColor;
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
                    <p class="text-sm text-gray-700 dark:text-gray-300 font-medium break-words" title="${(message || '').substring(0, 100)}">${(message || 'Preparando prompts...').substring(0, 80)}${(message || '').length > 80 ? '...' : ''}</p>
                    ${subMessage ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5 break-words">${subMessage.substring(0, 100)}${subMessage.length > 100 ? '...' : ''}</p>` : ''}
                </div>
                <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-2" onclick="document.getElementById('scene-gen-progress-panel').style.display = 'none';">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
            </div>
            <div class="space-y-3">
                <div>
                    <div class="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        <span>Progresso Geral</span>
                        <span>${Math.min(current, total || current)}/${total || current} cena(s) - ${progress}%</span>
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
    
    // ============================================================================
    // RENDERIZAÇÃO DE PROGRESSO DO TTS (similar ao de prompts para cenas)
    // ============================================================================
    window.renderVoiceGenerationProgress = window.renderVoiceGenerationProgress || function(status) {
        let panel = document.getElementById('voice-gen-progress-panel');
        if (!panel) {
            console.warn('⚠️ Painel de progresso de voz não encontrado no DOM');
            return;
        }
        
        if (!status || !status.active) {
            panel.style.display = 'none';
            return;
        }
        
        // Garantir que o painel está visível e posicionado corretamente
        panel.style.display = 'block';
        panel.style.position = 'relative';
        panel.style.zIndex = '9000';
        const { current = 0, total = 0, message, error = false } = status;
        const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        let title, titleColor, progressBarColor;
        
        if (error) {
            title = 'Erro na Geração';
            titleColor = 'text-red-600 dark:text-red-400';
            progressBarColor = 'bg-red-500';
        } else if (total > 0 && current >= total) {
            title = 'Geração Concluída';
            titleColor = 'text-green-600 dark:text-green-400';
            progressBarColor = 'bg-green-500';
        } else {
            title = 'Gerando Narração...';
            titleColor = 'text-blue-600 dark:text-blue-400';
            progressBarColor = 'bg-blue-500';
        }
        
        panel.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                    <h4 class="font-bold text-base ${titleColor} mb-1">${title}</h4>
                    <p class="text-sm text-gray-700 dark:text-gray-300 font-medium break-words" title="${(message || '').substring(0, 100)}">${(message || 'Preparando narração...').substring(0, 80)}${(message || '').length > 80 ? '...' : ''}</p>
                </div>
                <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-2" onclick="document.getElementById('voice-gen-progress-panel').style.display = 'none';">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
            </div>
            <div class="space-y-3">
                <div>
                    <div class="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        <span>Progresso Geral</span>
                        <span>${Math.min(current, total || current)}/${total || current} parte(s) - ${progress}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                        <div class="h-2.5 rounded-full ${progressBarColor} transition-all duration-300" style="width: ${progress}%;"></div>
                    </div>
                </div>
            </div>
        `;
    };
    
    window.showSceneGenCompleteModal = window.showSceneGenCompleteModal || function(durationInSeconds) {
        const modal = document.getElementById('scene-gen-complete-modal');
        if (!modal) return;
        const durationEl = document.getElementById('scene-gen-duration');
        if (durationEl) {
            durationEl.textContent = durationInSeconds !== undefined ? `Tempo total: ${durationInSeconds} segundos.` : '';
        }
        modal.style.display = 'flex';
        const closeBtn = document.getElementById('close-scene-gen-modal-btn');
        const viewBtn = document.getElementById('view-generated-scenes-btn');
        if (closeBtn && viewBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            const newViewBtn = viewBtn.cloneNode(true);
            viewBtn.parentNode.replaceChild(newViewBtn, viewBtn);
            newCloseBtn.onclick = () => modal.style.display = 'none';
            newViewBtn.onclick = () => {
                modal.style.display = 'none';
                
                // Navegar para a aba scene-prompts
                const scenePromptsTab = document.querySelector('.sidebar-btn[data-tab="scene-prompts"]');
                if (scenePromptsTab) {
                    scenePromptsTab.click();
                }
                
                // Garantir que renderScenePage é chamado após navegar para a aba
                setTimeout(() => {
                    // Verificar se os dados existem antes de renderizar
                    if (window.scenePromptResults && window.scenePromptResults.data && window.scenePromptResults.data.length > 0) {
                        // Atualizar a aba atual no appState
                        window.appState.currentTab = 'scene-prompts';
                        // Renderizar os prompts
                        if (typeof window.renderScenePage === 'function') {
                            window.renderScenePage();
                        }
                        // Scroll para o output
                        const outputEl = document.getElementById('output');
                        if (outputEl) {
                            outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    } else {
                        console.warn('⚠️ Nenhum prompt de cena encontrado para renderizar. Dados:', window.scenePromptResults);
                        window.showSuccessToast('Nenhum prompt de cena encontrado para exibir.', true);
                    }
                }, 300); // Aumentar o timeout para garantir que a aba foi ativada
            };
        }
    };
    
    window.saveSceneToHistory = window.saveSceneToHistory || function(sceneData, title) {
        try {
            console.log('🔍 saveSceneToHistory chamado. Dados recebidos:', {
                hasSceneData: !!sceneData,
                hasScenes: !!(sceneData && sceneData.scenes),
                hasData: !!(sceneData && sceneData.data),
                scenesLength: sceneData?.scenes?.length || sceneData?.data?.length || 0,
                sceneDataKeys: sceneData ? Object.keys(sceneData) : [],
                title: title
            });
            
            // Aceitar tanto sceneData.scenes quanto sceneData.data (ambos os formatos)
            const scenes = sceneData?.scenes || sceneData?.data || [];
            
            console.log('🔍 Validando dados para salvar:', {
                hasSceneData: !!sceneData,
                hasScenes: !!(sceneData && sceneData.scenes),
                hasData: !!(sceneData && sceneData.data),
                scenesLength: scenes.length,
                scenesIsArray: Array.isArray(scenes),
                firstSceneSample: scenes.length > 0 ? scenes[0] : null
            });
            
            if (!sceneData || !Array.isArray(scenes) || scenes.length === 0) {
                console.warn('⚠️ Dados dos prompts de cena inválidos ou vazios, não salvando no histórico. Dados recebidos:', {
                    sceneData: sceneData,
                    scenes: scenes,
                    scenesType: typeof scenes,
                    scenesIsArray: Array.isArray(scenes),
                    scenesLength: scenes.length
                });
                return;
            }
            
            // Normalizar os dados para um formato consistente
            const normalizedData = {
                scenes: scenes,
                data: scenes, // Manter compatibilidade
                total_prompts: sceneData.total_prompts || scenes.length,
                originalScript: sceneData.originalScript || ''
            };
            
            let history = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');
            const finalTitle = title || `Prompts de Cena - ${new Date().toLocaleString('pt-BR')}`;
            const newItem = {
                id: Date.now(),
                title: finalTitle,
                date: new Date().toLocaleString('pt-BR'),
                data: normalizedData
            };
            
            history.unshift(newItem);
            
            // Limitar a 5 itens (últimos 5)
            if (history.length > 5) {
                history = history.slice(0, 5);
            }
            
            history.unshift(newItem);
            
            // REMOVIDO: Limite de 5 itens - agora mantém todos os prompts até o usuário limpar manualmente
            // Os históricos serão mantidos indefinidamente até o usuário clicar no botão "Limpar todo o Histórico"
            
            localStorage.setItem('scenePromptHistory', JSON.stringify(history));
            console.log(`✅ Prompts de cena salvos no histórico com sucesso! Título: "${finalTitle}", Cenas: ${scenes.length}, Total no histórico: ${history.length}`);
            
            // Verificar se foi salvo corretamente
            const verifyHistory = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');
            if (verifyHistory.length > 0 && verifyHistory[0].id === newItem.id) {
                console.log('✅ Verificação: Prompts de cena confirmados no localStorage');
            } else {
                console.error('❌ Verificação: Prompts de cena NÃO encontrados no localStorage após salvar!');
            }
        } catch (error) {
            console.error('❌ Erro ao salvar prompts de cena no histórico:', error);
            console.error('Stack trace:', error.stack);
        }
    };
    
    window.renderSceneHistory = window.renderSceneHistory || function() {
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
        
        // Anexar event listeners para carregar/excluir prompts de cena
        historyContainer.querySelectorAll('.load-scene-prompts-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.historyId);
                const item = history.find(h => h.id === id);
                if (item && item.data) {
                    window.scenePromptResults = window.scenePromptResults || { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
                    window.scenePromptResults.data = item.data.data || item.data.scenes || item.data || [];
                    window.scenePromptResults.total_prompts = item.data.total_prompts || window.scenePromptResults.data.length;
                    window.scenePromptResults.currentPage = 1;
                    if (window.renderScenePage) {
                        window.renderScenePage();
                    }
                    window.showSuccessToast('Prompts de cena carregados!');
                }
            });
        });
        
        // Event listener para excluir prompt de cena individual
        historyContainer.querySelectorAll('.delete-scene-prompts-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.historyId);
                let history = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');
                history = history.filter(h => h.id !== id);
                localStorage.setItem('scenePromptHistory', JSON.stringify(history));
                window.renderSceneHistory();
                window.showSuccessToast('Prompt de cena excluído do histórico!');
            });
        });
        
        // Event listener para limpar todo o histórico de prompts de cena
        const clearSceneHistoryBtn = document.getElementById('clear-scene-history-btn');
        if (clearSceneHistoryBtn) {
            const newClearBtn = clearSceneHistoryBtn.cloneNode(true);
            clearSceneHistoryBtn.parentNode.replaceChild(newClearBtn, clearSceneHistoryBtn);
            newClearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Tem certeza de que deseja limpar TODO o histórico de prompts de cena? Esta ação não pode ser desfeita.')) {
                    localStorage.removeItem('scenePromptHistory');
                    window.renderSceneHistory();
                    window.showSuccessToast('Histórico de prompts de cena limpo com sucesso!');
                }
            });
        }
    };
    
    window.renderScenePage = window.renderScenePage || function() {
        const outputEl = document.getElementById('output');
        const paginationEl = document.getElementById('scene-pagination-controls');
        
        // Verificar se os elementos existem
        if (!outputEl) {
            console.error('❌ Elemento #output não encontrado para renderizar prompts de cena');
            return;
        }
        if (!paginationEl) {
            console.error('❌ Elemento #scene-pagination-controls não encontrado para renderizar prompts de cena');
        }
        
        // Garantir que scenePromptResults está inicializado
        if (!window.scenePromptResults) {
            window.scenePromptResults = { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
        }
        
        let scenePromptResults = window.scenePromptResults;
        const { data, currentPage, scenesPerPage, total_prompts } = scenePromptResults;
        
        // Log para debug
        console.log('🔍 renderScenePage chamado. Dados:', {
            dataLength: data ? data.length : 0,
            currentPage,
            scenesPerPage,
            total_prompts
        });
        
        if (!data || data.length === 0) {
            outputEl.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhum prompt de cena foi gerado ainda.</p>';
            if (paginationEl) paginationEl.innerHTML = '';
            console.warn('⚠️ Nenhum dado de prompt de cena para renderizar');
            return;
        }
        const totalScenes = data.length;
        const totalPages = Math.ceil(total_prompts / scenesPerPage);
        const start = (currentPage - 1) * scenesPerPage;
        const end = start + scenesPerPage;
        const scenesToShow = data.slice(start, end);
        scenePromptResults.allPromptsText = data.map((item, index) => `--- CENA ${index + 1}: ${item.scene_description || 'Descricao da Cena'} ---\nPROMPT: "${item.prompt_text || 'N/A'}"`).join('\n\n');
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
                            ${window.createCopyButton ? window.createCopyButton(item.prompt_text || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600') : ''}
                        </div>
                        <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto whitespace-pre-wrap">${item.prompt_text || 'N/A'}</div>
                    </div>
                `).join('')}
            </div>
        `;
        if (totalPages > 1) {
            paginationEl.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="scene-page-btn px-4 py-2 text-sm rounded-md ${i + 1 === currentPage ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}" data-page="${i + 1}">${i + 1}</button>`).join('');
            paginationEl.querySelectorAll('.scene-page-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    if (!window.scenePromptResults) window.scenePromptResults = { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
                    window.scenePromptResults.currentPage = parseInt(e.target.dataset.page, 10);
                    window.renderScenePage();
                });
            });
        } else {
            paginationEl.innerHTML = '';
        }
        
        // Adicionar event listeners para os botões de ação
        setTimeout(() => {
            // Botão: Copiar Todos (Detalhes)
            const copyAllBtn = document.getElementById('copy-all-scene-prompts');
            if (copyAllBtn) {
                // Remover listener antigo se existir
                const newCopyBtn = copyAllBtn.cloneNode(true);
                copyAllBtn.parentNode.replaceChild(newCopyBtn, copyAllBtn);
                newCopyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const textToCopy = scenePromptResults.allPromptsText || '';
                    if (textToCopy) {
                        navigator.clipboard.writeText(textToCopy).then(() => {
                            if (typeof window.showSuccessToast === 'function') {
                                window.showSuccessToast('Todos os prompts copiados para a área de transferência!');
                            }
                        }).catch(err => {
                            console.error('Erro ao copiar:', err);
                            // Fallback: criar textarea temporário
                            const textarea = document.createElement('textarea');
                            textarea.value = textToCopy;
                            textarea.style.position = 'fixed';
                            textarea.style.opacity = '0';
                            document.body.appendChild(textarea);
                            textarea.select();
                            try {
                                document.execCommand('copy');
                                if (typeof window.showSuccessToast === 'function') {
                                    window.showSuccessToast('Todos os prompts copiados para a área de transferência!');
                                }
                            } catch (fallbackErr) {
                                console.error('Erro no fallback de cópia:', fallbackErr);
                                if (typeof window.showSuccessToast === 'function') {
                                    window.showSuccessToast('Erro ao copiar. Tente novamente.', true);
                                }
                            }
                            document.body.removeChild(textarea);
                        });
                    } else {
                        if (typeof window.showSuccessToast === 'function') {
                            window.showSuccessToast('Nenhum prompt disponível para copiar.', true);
                        }
                    }
                });
            }
            
            // Botão: Transferir Detalhes (.txt)
            const downloadDetailedBtn = document.getElementById('download-scene-prompts-detailed');
            if (downloadDetailedBtn) {
                const newDownloadDetailedBtn = downloadDetailedBtn.cloneNode(true);
                downloadDetailedBtn.parentNode.replaceChild(newDownloadDetailedBtn, downloadDetailedBtn);
                newDownloadDetailedBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const content = scenePromptResults.allPromptsText || '';
                    if (content) {
                        if (typeof window.safelyDownloadFile === 'function') {
                            window.safelyDownloadFile(content, 'prompts-de-cena-detalhes.txt', 'text/plain');
                        } else {
                            // Fallback
                            const blob = new Blob([content], { type: 'text/plain' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'prompts-de-cena-detalhes.txt';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                        }
                        if (typeof window.showSuccessToast === 'function') {
                            window.showSuccessToast('Arquivo de detalhes baixado com sucesso!');
                        }
                    } else {
                        if (typeof window.showSuccessToast === 'function') {
                            window.showSuccessToast('Nenhum prompt disponível para baixar.', true);
                        }
                    }
                });
            }
            
            // Botão: Transferir Prompts Puros (.txt)
            const downloadRawBtn = document.getElementById('download-scene-prompts-raw');
            if (downloadRawBtn) {
                const newDownloadRawBtn = downloadRawBtn.cloneNode(true);
                downloadRawBtn.parentNode.replaceChild(newDownloadRawBtn, downloadRawBtn);
                newDownloadRawBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const content = scenePromptResults.rawPromptsText || '';
                    if (content) {
                        if (typeof window.safelyDownloadFile === 'function') {
                            window.safelyDownloadFile(content, 'prompts-de-cena-puros.txt', 'text/plain');
                        } else {
                            // Fallback
                            const blob = new Blob([content], { type: 'text/plain' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'prompts-de-cena-puros.txt';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                        }
                        if (typeof window.showSuccessToast === 'function') {
                            window.showSuccessToast('Arquivo de prompts puros baixado com sucesso!');
                        }
                    } else {
                        if (typeof window.showSuccessToast === 'function') {
                            window.showSuccessToast('Nenhum prompt disponível para baixar.', true);
                        }
                    }
                });
            }
        }, 100);
    };
    
    // Inicializar scenePromptResults globalmente se não existir
    window.scenePromptResults = window.scenePromptResults || { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
    
    // Inicializar sceneGenStatus no appState
    window.appState.sceneGenStatus = window.appState.sceneGenStatus || { active: false, current: 0, total: 0, message: '', subMessage: '', chunkTotal: 0, chunkCurrent: 0, error: false };
    
    // Expor constantes para o handler
    window.RECOMMENDED_MODEL = window.RECOMMENDED_MODEL || RECOMMENDED_MODEL;
    window.SCENE_TOKENS_PER_PROMPT = window.SCENE_TOKENS_PER_PROMPT || SCENE_TOKENS_PER_PROMPT;
    
    // ============================================================================
    // HANDLER COMPLETO: GENERATE-SCENE-PROMPTS
    // Extraído do app1.js (linhas 6643-7990) - ~1350 linhas
    // ============================================================================
    
    // ============================================================================
    // HANDLER COMPLETO: GENERATE-SCENE-PROMPTS
    // Extraído do app1.js (linhas 6643-7990) - ~1350 linhas
    // O handler completo será inserido abaixo
    // ============================================================================
    
    // ============================================================================
    // HANDLER COMPLETO: GENERATE-SCENE-PROMPTS
    // Extraído do app1.js (linhas 6643-7990) - ~1350 linhas
    // ============================================================================
    
    window.handlers['generate-scene-prompts'] = async (e) => {
            const startTime = Date.now();
            const text = document.getElementById('scene-text')?.value.trim();
            const model = document.getElementById('scene-prompts-model-select')?.value;
            const imageModel = document.getElementById('scene-image-model')?.value;
            const lang = document.getElementById('scene-lang')?.value;
            const includeText = document.getElementById('scene-include-text')?.checked;
            const characters = document.getElementById('scene-characters')?.value.trim();
            
            // Log para debug: verificar qual modelo foi selecionado
            console.log(`ðŸŽ¬ Gerando prompts de cena com modelo: "${model}"`);
            
            if (!text || !model || !imageModel || !lang) {
                window.showSuccessToast("Por favor, preencha todos os campos.");
                return;
            }

            const mode = document.getElementById('generation-mode')?.value;
            const wordCount = parseInt(document.getElementById('scene-word-count')?.value, 10);
            const style = document.getElementById('scene-style')?.value;
            const styleInstruction = style && style !== 'none' ? ` O estilo visual principal deve ser '${window.removeAccents(style)}'.` : '';
            const textInstruction = includeText 
                ? `Se o prompt incluir texto para ser renderizado na imagem, esse texto DEVE estar no idioma "${window.removeAccents(lang)}".`
                : "O prompt NAO DEVE incluir nenhuma instrucao para adicionar texto.";
            const characterInstruction = characters ? ` Mantenha a consistencia dos seguintes personagens em todas as cenas: ${window.removeAccents(characters)}.` : '';
            const rawWords = text.split(/\s+/).filter(Boolean);
            const totalWords = rawWords.length;
            const estimatedScenes = Math.max(1, Math.round(totalWords / 90));
            const minScenes = Math.max(1, Math.floor(totalWords / 140));
            const maxScenes = Math.max(estimatedScenes + 2, Math.ceil(totalWords / 60));

            let chunks = [];
            // LIMPAR RESULTADOS ANTERIORES COMPLETAMENTE
            window.scenePromptResults = window.scenePromptResults || {};
            window.scenePromptResults.data = []; // Limpa os resultados anteriores
            window.scenePromptResults.originalScript = text; // Correção 5: Salvar o roteiro original

            if (mode === 'manual') {
                if (wordCount <= 0) {
                    window.showSuccessToast('Por favor, insira um numero de palavras valido.');
                    return;
                }
                // Calcular número exato de chunks baseado em wordCount
                const exactChunks = Math.ceil(rawWords.length / wordCount);
                for (let i = 0; i < rawWords.length; i += wordCount) {
                    chunks.push(rawWords.slice(i, i + wordCount).join(' '));
                }
                // Garantir que temos exatamente o número calculado
                if (chunks.length !== exactChunks) {
                    console.warn(`⚠️ Ajustando número de chunks: ${chunks.length} → ${exactChunks}`);
                    // Ajustar se necessário
                    while (chunks.length < exactChunks && chunks.length > 0) {
                        // Dividir último chunk se necessário
                        const lastChunk = chunks[chunks.length - 1];
                        const lastWords = lastChunk.split(/\s+/);
                        if (lastWords.length > wordCount) {
                            chunks[chunks.length - 1] = lastWords.slice(0, wordCount).join(' ');
                            chunks.push(lastWords.slice(wordCount).join(' '));
                        } else {
                            break;
                        }
                    }
                    chunks = chunks.slice(0, exactChunks);
                }
                window.scenePromptResults.total_prompts = chunks.length;
                console.log(`📊 Modo manual: ${chunks.length} chunks calculados de ${wordCount} palavras cada`);
            } else { // MODO AUTOMATICO
                chunks.push(text); // No modo automatico, processamos o texto inteiro de uma vez
                window.scenePromptResults.total_prompts = null; // Sera definido apos a resposta da IA
            }

            const totalEstimate = mode === 'manual' ? Math.max(chunks.length, 1) : Math.max(estimatedScenes, 1);
            const initialMessage = mode === 'manual'
                ? `Gerando ${chunks.length} prompt(s) com blocos de ${wordCount} palavra(s)...`
                : `A IA está analisando ${totalWords} palavras para sugerir cerca de ${estimatedScenes} cenas (entre ${minScenes} e ${maxScenes}, se necessário).`;

            window.appState.sceneGenStatus = { 
                active: true, 
                current: 0, 
                total: totalEstimate, 
                message: initialMessage, 
                subMessage: '',
                chunkTotal: 0,
                chunkCurrent: 0,
                error: false 
            };
            window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
            window.addToLog(mode === 'manual'
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

⚠️⚠️⚠️ REGRA CRÍTICA OBRIGATÓRIA - TAMANHO DO PROMPT:
- O prompt_text DEVE ter entre 600 e 1200 caracteres (não mais, não menos)
- Verifique o tamanho do prompt_text antes de responder
- Se o prompt estiver muito longo, reduza detalhes desnecessários mantendo a essência
- Se estiver muito curto, adicione mais detalhes visuais relevantes

CRITICO - FORMATO JSON OBRIGATORIO:
- Responda APENAS com um JSON objeto valido e completo
- Nao inclua texto antes ou depois do JSON
- Nao use markdown code blocks (sem \`\`\`json)
- Todas as strings devem estar entre aspas duplas
- Nao use virgulas finais
- Formato exato: {"prompt_text": "...", "scene_description": "...", "original_text": "..."}
- O JSON deve ser valido e completo, sem cortes

CONTEXTO:
"""${window.removeAccents(text)}"""

TRECHO:
"""${window.removeAccents(chunk)}"""`;
                        
                        window.appState.sceneGenStatus.subMessage = `Trecho ${index + 1} de ${chunks.length}`;
                        window.appState.sceneGenStatus.message = `Gerando cena ${index + 1} de ${chunks.length}...`;
                        window.renderSceneGenerationProgress(window.appState.sceneGenStatus);

                        let retries = 3;
                        let success = false;
                        while (retries > 0 && !success) {
                            try {
                                console.log(`📤 Enviando requisição para API: modelo="${model}"`);
                                
                                // Criar simulador de progresso para modo manual
                                let manualProgressSimulator = null;
                                let manualProgressCancelled = false;
                                const baseProgress = (index / chunks.length) * 100;
                                const progressPerScene = (1 / chunks.length) * 100;
                                
                                const simulateManualProgress = () => {
                                    const progressSteps = [
                                        { offset: 0.2, delay: 300, msg: `Enviando cena ${index + 1}`, sub: `Conectando com IA...` },
                                        { offset: 0.4, delay: 400, msg: `IA analisando cena ${index + 1}`, sub: `Processando ${chunk.split(' ').length} palavras...` },
                                        { offset: 0.6, delay: 500, msg: `âœï¸ IA gerando prompt ${index + 1}`, sub: `Escrevendo descrição em inglês...` },
                                        { offset: 0.8, delay: 300, msg: `IA refinando prompt ${index + 1}`, sub: `Otimizando para ${imageModel}...` }
                                    ];
                                    
                                    let stepIndex = 0;
                                    const runNextStep = () => {
                                        if (manualProgressCancelled || stepIndex >= progressSteps.length) return;
                                        
                                        const step = progressSteps[stepIndex];
                                        window.appState.sceneGenStatus.stageProgress = baseProgress + (progressPerScene * step.offset);
                                        window.appState.sceneGenStatus.message = step.msg;
                                        window.appState.sceneGenStatus.subMessage = step.sub;
                                        window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                        stepIndex++;
                                        
                                        if (stepIndex < progressSteps.length) {
                                            manualProgressSimulator = setTimeout(runNextStep, step.delay);
                                        }
                                    };
                                    
                                    runNextStep();
                                };
                                
                                // Iniciar simulação
                                simulateManualProgress();
                                
                                const result = await window.apiRequestWithFallback('/api/generate-legacy', 'POST', { 
                                    prompt, 
                                    model, 
                                    schema,
                                    maxOutputTokens: 4096
                                });
                                
                                // Cancelar simulação
                                manualProgressCancelled = true;
                                if (manualProgressSimulator) clearTimeout(manualProgressSimulator);
                                
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
                                    // VALIDAÇÃO CRÍTICA: Garantir que prompt_text não ultrapasse 1200 caracteres
                                    const MAX_PROMPT_CHARS = 1200;
                                    if (sceneData.prompt_text.length > MAX_PROMPT_CHARS) {
                                        console.warn(`⚠️ Cena ${index + 1}: prompt_text tem ${sceneData.prompt_text.length} caracteres, truncando para ${MAX_PROMPT_CHARS}`);
                                        // Truncar mantendo palavras completas
                                        let truncated = sceneData.prompt_text.substring(0, MAX_PROMPT_CHARS);
                                        const lastSpace = truncated.lastIndexOf(' ');
                                        if (lastSpace > MAX_PROMPT_CHARS - 50) { // Se o último espaço está próximo do limite
                                            truncated = truncated.substring(0, lastSpace);
                                        }
                                        sceneData.prompt_text = truncated.trim();
                                        // Log interno apenas (não exibir para o usuário)
                                        console.log(`[INTERNO] Cena ${index + 1}: prompt truncado de ${sceneData.prompt_text.length + (sceneData.prompt_text.length - truncated.length)} para ${truncated.length} caracteres`);
                                    }
                                    
                                    // VERIFICAR SE JÁ EXISTE ANTES DE ADICIONAR (PREVENIR DUPLICAÇÃO)
                                    const isDuplicate = window.scenePromptResults.data.some(
                                        existing => existing.original_text === sceneData.original_text && 
                                                   existing.prompt_text === sceneData.prompt_text
                                    );
                                    
                                    if (!isDuplicate) {
                                        window.scenePromptResults.data.push(sceneData);
                                        window.appState.sceneGenStatus.current = window.scenePromptResults.data.length;
                                        const progressPercent = Math.round((window.appState.sceneGenStatus.current / window.appState.sceneGenStatus.total) * 100);
                                        window.appState.sceneGenStatus.message = `Cena ${window.scenePromptResults.data.length}/${chunks.length} pronta.`;
                                        window.appState.sceneGenStatus.subMessage = `Trecho ${index + 1} concluído - ${progressPercent}%`;
                                        window.appState.sceneGenStatus.stageProgress = progressPercent;
                                        window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                        success = true;
                                    } else {
                                        console.warn(`⚠️ Cena ${index + 1} duplicada detectada, ignorando...`);
                                        success = true; // Marcar como sucesso para não tentar novamente
                                    }
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
                                    window.addToLog(`Erro de JSON na cena ${index + 1}. Tentando novamente com instruções mais explícitas... (${retries} tentativas restantes)`, true);
                                    // Adicionar instrução mais explícita no retry
                                    prompt = `${prompt}\n\nLEMBRE-SE: Retorne APENAS o JSON objeto, sem nenhum texto adicional. O JSON deve começar com { e terminar com }. Todas as strings entre aspas duplas.`;
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    continue; // Tenta novamente com o prompt melhorado
                                } else if (retries > 0) {
                                    window.addToLog(`Erro na cena ${index + 1}. Tentando novamente... (${retries} tentativas restantes)`, true);
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                } else {
                                    window.addToLog(`Erro ao gerar prompt para a cena ${index + 1}: ${error.message}`, true);
                                    console.error(`Erro detalhado para cena ${index + 1}:`, error);
                                }
                            }
                        }
                        
                        if (!success) {
                            window.addToLog(`Nao foi possivel gerar prompt para a cena ${index + 1} apos 3 tentativas.`, true);
                        }
                        // Otimização: Reduzir delay para 200ms (era 800ms)
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }

                    // VALIDAÇÃO FINAL: Garantir que temos exatamente o número esperado de cenas
                    const expectedCount = chunks.length;
                    const actualCount = window.scenePromptResults.data.length;
                    
                    if (actualCount !== expectedCount) {
                        console.warn(`⚠️ Modo manual: Esperado ${expectedCount} cenas, mas gerado ${actualCount}. Ajustando...`);
                        // Se faltam cenas, não podemos gerar mais (já tentamos 3 vezes cada)
                        // Se há excesso, remover as últimas
                        if (actualCount > expectedCount) {
                            window.scenePromptResults.data = window.scenePromptResults.data.slice(0, expectedCount);
                            console.log(`✅ Removidas ${actualCount - expectedCount} cena(s) em excesso`);
                        }
                    }
                    
                    window.scenePromptResults.total_prompts = window.scenePromptResults.data.length;
                    window.appState.sceneGenStatus.current = window.scenePromptResults.data.length;
                    window.appState.sceneGenStatus.total = expectedCount;
                    window.appState.sceneGenStatus.message = `Roteiro dividido em ${window.scenePromptResults.data.length} cena(s) (modo manual).`;
                    window.appState.sceneGenStatus.subMessage = actualCount === expectedCount 
                        ? `✅ Total final: ${window.scenePromptResults.data.length} cena(s) conforme esperado.`
                        : `⚠️ Total: ${window.scenePromptResults.data.length}/${expectedCount} cena(s) (${actualCount < expectedCount ? 'faltam ' + (expectedCount - actualCount) : 'excesso de ' + (actualCount - expectedCount)})`;
                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                } else { // MODO AUTOMATICO
                    // PRIMEIRO: Analisar todo o roteiro para calcular quantidade EXATA de prompts
                    window.addToLog(`Analisando roteiro completo (${totalWords} palavras) para calcular quantidade exata de prompts...`, false);
                    
                    // Iniciar progresso em 5%
                    window.appState.sceneGenStatus.stageProgress = 5;
                    window.appState.sceneGenStatus.message = `Analisando roteiro completo...`;
                    window.appState.sceneGenStatus.subMessage = `Calculando quantidade exata de prompts necessários`;
                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                    
                    // Função auxiliar para estimar tokens (aproximação: ~3.5 caracteres por token)
                    const estimateTokens = (text) => Math.ceil(text.length / 3.5);
                    
                    // Obter limites do modelo selecionado usando a função de matching inteligente
                    const tokenLimits = window.getTokenLimitsFrontend(model);
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
                    
                    window.addToLog(`Quantidade exata calculada: ${exactSceneCount} prompts de cena`, false);
                    
                    // Normalizar nome do modelo para verificações
                    const modelLower = window.normalizeModelName(model);
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
                        // Mostrar progresso INICIAL
                        window.appState.sceneGenStatus.active = true;
                        window.appState.sceneGenStatus.current = 0;
                        window.appState.sceneGenStatus.total = exactSceneCount;
                        window.appState.sceneGenStatus.stageProgress = 1;
                        window.appState.sceneGenStatus.message = "🚀 Iniciando geração de prompts";
                        window.appState.sceneGenStatus.subMessage = `Preparando para gerar ${exactSceneCount} cena(s)...`;
                        window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                        await new Promise(resolve => setTimeout(resolve, 500)); // Delay para usuário VER que iniciou
                        
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

                        window.addToLog("Texto extenso detectado. Gemini sera processado em partes para evitar limite de tokens.", false);
                        
                        // Mostrar que está dividindo em partes
                        window.appState.sceneGenStatus.stageProgress = 3;
                        window.appState.sceneGenStatus.message = "ðŸ“ Analisando roteiro";
                        window.appState.sceneGenStatus.subMessage = "Dividindo roteiro em partes processáveis...";
                        window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                        let chunkedSegments = window.splitTextIntoWordChunks(text, MAX_WORDS_PER_AUTO_CHUNK);
                        if (!chunkedSegments.length) {
                            throw new Error("Nao foi possivel preparar o roteiro para o modo automatico.");
                        }

                        // Usar quantidade EXATA calculada para o total
                        window.appState.sceneGenStatus.total = exactSceneCount;
                        window.appState.sceneGenStatus.chunkTotal = chunkedSegments.length;
                        window.appState.sceneGenStatus.chunkCurrent = 0;
                        window.appState.sceneGenStatus.stageProgress = 5;
                        window.appState.sceneGenStatus.message = `Roteiro dividido em ${chunkedSegments.length} parte(s)`;
                        window.appState.sceneGenStatus.subMessage = `Preparando geração de ${exactSceneCount} cena(s) totais`;
                        window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                        await new Promise(resolve => setTimeout(resolve, 500)); // Delay para usuário VER a divisão
                        let accumulatedScenes = 0;

                        // Pré-calcular distribuição aproximada de cenas (meta, não obrigatório)
                        let chunkSceneDistribution = [];
                        let remainingScenes = exactSceneCount;
                        
                        for (let i = 0; i < chunkedSegments.length; i++) {
                            const chunk = chunkedSegments[i];
                            const chunkRatio = chunk.wordCount / totalWords;
                            
                            // Calcular cenas para este chunk baseado na proporção (estimativa)
                            let chunkScenes = Math.max(1, Math.round(chunkRatio * exactSceneCount));
                            
                            // Garantir que não ultrapasse o que resta
                            chunkScenes = Math.min(chunkScenes, remainingScenes);
                            
                            chunkSceneDistribution.push(chunkScenes);
                            remainingScenes -= chunkScenes;
                        }
                        
                        // Se ainda restam cenas, distribuir no último chunk
                        if (remainingScenes > 0) {
                            chunkSceneDistribution[chunkSceneDistribution.length - 1] += remainingScenes;
                        }
                        
                        console.log(`📊 Meta de distribuição por chunk:`, chunkSceneDistribution);
                        console.log(`ðŸ“Š Total estimado: ${chunkSceneDistribution.reduce((a, b) => a + b, 0)}`);

                        const lotesInfo = window.calcularLotes(model, exactSceneCount);
                        const modelOutputLimit = lotesInfo.saidaMax;
                        const maxPromptsPerRequest = lotesInfo.maxPromptsPorRequest;
                        console.log(`ðŸ“ Capacidade do modelo "${model}": ${modelOutputLimit} tokens de saída â†’ ${maxPromptsPerRequest} prompts de ${window.SCENE_TOKENS_PER_PROMPT || 300} tokens por requisição.`);
                        console.log(`Plano de lotes:`, lotesInfo.lotes);

                        if (chunkSceneDistribution.some(value => value > maxPromptsPerRequest)) {
                            window.addToLog(`⚠️ Roteiro muito grande para uma única chamada (${model}). Distribuindo prompts em lotes de até ${maxPromptsPerRequest} cena(s) por requisição.`, false);
                        }

                        const sceneProcessingQueue = window.createSceneProcessingQueue(chunkedSegments, chunkSceneDistribution, maxPromptsPerRequest, 2);
                        window.appState.sceneGenStatus.chunkTotal = sceneProcessingQueue.length;
                        console.log(`📦 Total de lotes a processar (após ajustar pelo limite do modelo): ${sceneProcessingQueue.length}`);
                        
                        for (let chunkIndex = 0; chunkIndex < sceneProcessingQueue.length; chunkIndex++) {
                            const currentChunk = sceneProcessingQueue[chunkIndex];
                            const chunkRatio = currentChunk.wordCount / totalWords;
                            const chunkMaxScenes = currentChunk.sceneTarget;
                            const chunkPercent = Math.max(1, Math.round(chunkRatio * 100));

                            // Preparar informações do modelo (permite fallback automático)
                            let chunkModel = model;
                            let chunkModelLower = window.normalizeModelName(chunkModel);
                            let chunkTokenLimits = window.getTokenLimitsFrontend(chunkModel);
                            let chunkModelMaxTokens = chunkTokenLimits.maxOutputTokens;
                            let chunkIsFlashLite = chunkModelLower.includes('flash-lite');
                            let chunkIsFlash = chunkModelLower.includes('flash') && !chunkIsFlashLite;
                            let chunkIsPro = chunkModelLower.includes('pro') || chunkModelLower.includes('gpt-4');

                            const refreshModelParams = () => {
                                chunkModelLower = window.normalizeModelName(chunkModel);
                                chunkTokenLimits = window.getTokenLimitsFrontend(chunkModel);
                                chunkModelMaxTokens = chunkTokenLimits.maxOutputTokens;
                                chunkIsFlashLite = chunkModelLower.includes('flash-lite');
                                chunkIsFlash = chunkModelLower.includes('flash') && !chunkIsFlashLite;
                                chunkIsPro = chunkModelLower.includes('pro') || chunkModelLower.includes('gpt-4');
                            };

                            const computeTokensPerScene = () => chunkIsFlash ? 600 : (chunkIsPro ? 550 : 500);
                            const computeTargetPromptWords = () => chunkIsFlash ? '100-150' : '150-200';
                            const computeMaxDescWords = () => chunkIsFlash ? '10-15' : '15-20';
                            const computeConcisenessNote = () => chunkIsFlash ? ' EXTREMAMENTE CONCISO mas DESCRITIVO.' : ' Seja CONCISO mas VISUAL.';

                            refreshModelParams();
                            let tokensPerScene = 0;
                            let safetyMargin = 0;
                            let calculatedTokens = 0;
                            let chunkMaxOutputTokens = 0;
                            let chunkPrompt = '';

                            const assignModelParameters = () => {
                                tokensPerScene = computeTokensPerScene();
                                safetyMargin = 1000;
                                calculatedTokens = (chunkMaxScenes * tokensPerScene) + safetyMargin;
                                chunkMaxOutputTokens = Math.min(chunkModelMaxTokens, Math.max(2000, calculatedTokens));
                            };

                            assignModelParameters();

                            if (calculatedTokens > chunkModelMaxTokens && chunkModel !== window.RECOMMENDED_MODEL || "gpt-4o") {
                                window.addToLog(`⚠️ Modelo ${chunkModel} não comporta ${chunkMaxScenes} cenas (${calculatedTokens} tokens). Alternando automaticamente para ${window.RECOMMENDED_MODEL || "gpt-4o"}.`, true);
                                console.warn(`⚠️ Chunk ${chunkIndex + 1}: modelo "${chunkModel}" não suporta ${calculatedTokens} tokens. Fazendo fallback para ${window.RECOMMENDED_MODEL || "gpt-4o"}.`);
                                chunkModel = window.RECOMMENDED_MODEL || "gpt-4o";
                                model = chunkModel; // usar fallback nos próximos chunks também
                                refreshModelParams();
                                chunkModelMaxTokens = chunkTokenLimits.maxOutputTokens;
                                assignModelParameters();
                                console.log(`🔄 Fallback: usando modelo "${chunkModel}" com limite de ${chunkModelMaxTokens} tokens para saída.`);
                            }

                            console.log(`ðŸŽ¯ Chunk ${chunkIndex + 1}: modelo="${chunkModel}", ${chunkMaxScenes} cenas × ${tokensPerScene} tokens/cena = ${calculatedTokens} tokens (usando: ${chunkMaxOutputTokens})`);

                            // CRÍTICO: Calcular maxOutputTokens baseado em prompts de 600-1200 caracteres
                            // Cada cena: ~1000 chars (média) + 100 chars (description + original_text) + overhead JSON
                            // 1000 chars ≈ 250 tokens, então ~400 tokens por cena completa
                            // Para garantir: usar 500 tokens por cena + margem de segurança
                            window.appState.sceneGenStatus.chunkCurrent = chunkIndex + 1;
                            window.appState.sceneGenStatus.message = `Processando parte ${chunkIndex + 1}/${sceneProcessingQueue.length}`;
                            window.appState.sceneGenStatus.subMessage = `Gerando ${chunkMaxScenes} cena(s) para esta parte (~${chunkPercent}% do roteiro)`;
                            // Atualizar progresso visual ANTES de processar
                            window.renderSceneGenerationProgress(window.appState.sceneGenStatus);

                            // Ajustar limites de caracteres para prompts ideais (600-1200 caracteres)
                            // Caracteres â‰ˆ palavras × 6 (média em inglês com espaÃ§os/pontuaÃ§Ã£o)
                            const minPromptChars = 600;
                            const maxPromptChars = 1200;
                            const baseProgressBeforeChunk = window.appState.sceneGenStatus.total > 0
                                ? (window.appState.sceneGenStatus.current / window.appState.sceneGenStatus.total) * 100
                                : 0;
                            const chunkProgressShare = window.appState.sceneGenStatus.total > 0
                                ? (chunkMaxScenes / window.appState.sceneGenStatus.total) * 100
                                : (sceneProcessingQueue.length > 0 ? (100 / sceneProcessingQueue.length) : 0);
                            const updateStageProgress = (fraction) => {
                                const target = baseProgressBeforeChunk + (chunkProgressShare * fraction);
                                window.appState.sceneGenStatus.stageProgress = Math.min(99, Math.max(baseProgressBeforeChunk, target));
                            };
                            
                            let retries = 3;
                            let chunkScenes = null;

                            while (retries > 0) {
                                try {
                                    refreshModelParams();
                                    assignModelParameters();

                                    if (calculatedTokens > chunkModelMaxTokens) {
                                        if (chunkModel !== window.RECOMMENDED_MODEL || "gpt-4o") {
                                            window.addToLog(`⚠️ Modelo ${chunkModel} não comporta ${chunkMaxScenes} cenas (${calculatedTokens} tokens). Alternando automaticamente para ${window.RECOMMENDED_MODEL || "gpt-4o"}.`, true);
                                            console.warn(`⚠️ Chunk ${chunkIndex + 1}: modelo "${chunkModel}" não suporta ${calculatedTokens} tokens. Fazendo fallback para ${window.RECOMMENDED_MODEL || "gpt-4o"}.`);
                                            chunkModel = window.RECOMMENDED_MODEL || "gpt-4o";
                                            model = chunkModel;
                                            continue; // Recalcular com o novo modelo
                                        } else {
                                            throw new Error(`MODEL_CAPACITY_EXCEEDED:${chunkModel}:${calculatedTokens}/${chunkModelMaxTokens}`);
                                        }
                                    }

                                    const targetPromptWords = computeTargetPromptWords(); // ~600-1200 caracteres
                                    const maxDescWords = computeMaxDescWords();
                                    const concisenessNote = computeConcisenessNote();

                                    chunkPrompt = `Diretor de arte: Divida o roteiro em cenas visuais logicas baseadas no CONTEUDO REAL do texto. Este e o trecho ${chunkIndex + 1} de ${sceneProcessingQueue.length} (aprox. ${currentChunk.wordCount} palavras, ${chunkPercent}% do roteiro). 

⚠️ OBRIGATORIO - QUANTIDADE EXATA:
Voce DEVE gerar EXATAMENTE ${chunkMaxScenes} cenas. Nem ${chunkMaxScenes - 1}, nem ${chunkMaxScenes + 1}. EXATAMENTE ${chunkMaxScenes} cenas.

REGRAS CRITICAS:
1. Cada cena deve representar um momento/evento REAL do roteiro fornecido abaixo (na ordem cronologica)
2. NAO invente eventos que nao estao no roteiro - use APENAS o conteudo real
3. NAO repita eventos ja descritos em trechos anteriores (continue da cena ${accumulatedScenes + 1})
4. Distribua as ${chunkMaxScenes} cenas uniformemente ao longo deste trecho completo
5. Cada cena deve cobrir aproximadamente ${Math.floor(currentChunk.wordCount / chunkMaxScenes)}-${Math.ceil(currentChunk.wordCount / chunkMaxScenes)} palavras do roteiro
6. Cubra TODO o conteudo deste trecho, do inicio ao fim, sem pular partes

⚠️⚠️⚠️ REGRA CRÍTICA OBRIGATÓRIA - TAMANHO DO PROMPT:
- O prompt_text DEVE ter entre ${minPromptChars} e ${maxPromptChars} caracteres (não mais, não menos)
- Verifique o tamanho de CADA prompt_text antes de responder
- Se um prompt estiver muito longo, reduza detalhes desnecessários mantendo a essência
- Se estiver muito curto, adicione mais detalhes visuais relevantes
- Esta regra Ã© OBRIGATÓRIA e deve ser respeitada para TODAS as ${chunkMaxScenes} cenas

FORMATO OBRIGATORIO:
- scene_description: 1 frase em PT-BR (${maxDescWords} palavras) descrevendo O QUE acontece nesta parte do roteiro
- prompt_text: prompt em INGLES (${targetPromptWords} palavras = ${minPromptChars}-${maxPromptChars} caracteres) otimizado para '${imageModel}'${concisenessNote}
- original_text: trecho EXATO do roteiro que esta cena representa

⚠️ CRITICO - TAMANHO DO PROMPT_TEXT:
- O prompt_text DEVE ter entre ${minPromptChars}-${maxPromptChars} caracteres (~${targetPromptWords} palavras em ingles)
- Equilibrio ideal: riqueza visual + consistencia de personagem + foco da cena + seguranca de tokens
- Inclua: composicao, iluminacao, estilo visual, personagens (se houver), acao/emocao, atmosfera
- Evite: repeticoes, palavras vazias, excesso de adjetivos, detalhes irrelevantes
- Exemplo de estrutura: "[Subject/Character] [Action/Pose] [Setting/Background] [Lighting/Mood] [Style/Quality] [Camera Angle]"

${styleInstruction} ${textInstruction} ${characterInstruction} 

CRITICO - FORMATO JSON OBRIGATORIO:
- Responda APENAS com um JSON array valido e completo
- Nao inclua texto antes ou depois do JSON
- Nao use markdown code blocks (sem \`\`\`json)
- Todas as strings devem estar entre aspas duplas
- Nao use virgulas finais
- Formato exato: [{"prompt_text": "...", "scene_description": "...", "original_text": "..."}]
- O JSON deve ser valido e completo, sem cortes

TRECHO FOCAL:
"""${window.removeAccents(currentChunk.text)}"""`;

                                    console.log(`ðŸŽ¯ Chunk ${chunkIndex + 1}: modelo="${chunkModel}", ${chunkMaxScenes} cenas × ${tokensPerScene} tokens/cena = ${calculatedTokens} tokens (usando: ${chunkMaxOutputTokens})`);

                                    // ETAPA 1: Preparando requisição
                                    updateStageProgress(0.05);
                                    window.appState.sceneGenStatus.message = `Preparando parte ${chunkIndex + 1}/${sceneProcessingQueue.length}`;
                                    window.appState.sceneGenStatus.subMessage = `Montando requisição para gerar ${chunkMaxScenes} cena(s)...`;
                                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                    await new Promise(resolve => setTimeout(resolve, 200)); // Pequeno delay para UI atualizar
                                    
                                    console.log(`Enviando chunk ${chunkIndex + 1} para API: modelo="${chunkModel}"`);
                                    
                                    // ETAPA 2: Enviando para API
                                    updateStageProgress(0.15);
                                    window.appState.sceneGenStatus.message = `Enviando parte ${chunkIndex + 1}/${sceneProcessingQueue.length} para IA`;
                                    window.appState.sceneGenStatus.subMessage = `Aguardando IA processar ${currentChunk.wordCount} palavras...`;
                                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                    await new Promise(resolve => setTimeout(resolve, 200)); // Pequeno delay para UI atualizar
                                    
                                    // CRIAR SIMULADOR DE PROGRESSO para o chunk
                                    let chunkProgressSimulator = null;
                                    let chunkProgressCancelled = false;
                                    const simulateChunkProgress = () => {
                                        const progressSteps = [
                                            { fraction: 0.2, delay: 400, msg: `Conectando com IA (parte ${chunkIndex + 1})`, sub: `Enviando ${currentChunk.wordCount} palavras...` },
                                            { fraction: 0.3, delay: 600, msg: `IA analisando parte ${chunkIndex + 1}`, sub: `Identificando ${chunkMaxScenes} cena(s) neste trecho...` },
                                            { fraction: 0.4, delay: 800, msg: ` IA processando cenas`, sub: `Gerando descrições para parte ${chunkIndex + 1}...` },
                                            { fraction: 0.55, delay: 700, msg: `âœï¸ IA escrevendo prompts`, sub: `Otimizando ${chunkMaxScenes} prompts em inglês...` },
                                            { fraction: 0.65, delay: 600, msg: `IA refinando detalhes`, sub: `Ajustando composição visual...` }
                                        ];
                                        
                                        let stepIndex = 0;
                                        const runNextStep = () => {
                                            if (chunkProgressCancelled || stepIndex >= progressSteps.length) return;
                                            
                                            const step = progressSteps[stepIndex];
                                            updateStageProgress(step.fraction);
                                            window.appState.sceneGenStatus.message = step.msg;
                                            window.appState.sceneGenStatus.subMessage = step.sub;
                                            window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                            stepIndex++;
                                            
                                            if (stepIndex < progressSteps.length) {
                                                chunkProgressSimulator = setTimeout(runNextStep, step.delay);
                                            }
                                        };
                                        
                                        runNextStep();
                                    };
                                    
                                    // Iniciar simulação de progresso para o chunk
                                    simulateChunkProgress();
                                    
                                    // Fazer a chamada da API
                                    const chunkResult = await window.apiRequestWithFallback('/api/generate-legacy', 'POST', { 
                                        prompt: chunkPrompt, 
                                        model: chunkModel, 
                                        schema: chunkSchema,
                                        maxOutputTokens: chunkMaxOutputTokens
                                    }, 2); // 2 retries = 3 tentativas totais
                                    
                                    // Cancelar simulação quando a resposta chegar
                                    chunkProgressCancelled = true;
                                    if (chunkProgressSimulator) clearTimeout(chunkProgressSimulator);
                                    
                                    // Determinar qual modelo foi realmente usado (pode ter mudado no fallback)
                                    const actualChunkModel = chunkResult.apiSource?.includes('OpenAI') || chunkResult.apiSource?.includes('gpt') 
                                        ? 'gpt-4o' // Se veio do OpenAI, Ã© GPT
                                        : chunkModel; // Caso contrÃ¡rio, usa o modelo original
                                    
                                    // ETAPA 4: Recebido da API
                                    console.log(`✅ Chunk ${chunkIndex + 1} recebido da API para modelo "${actualChunkModel}" (apiSource: ${chunkResult.apiSource || 'N/A'})`);
                                    updateStageProgress(0.5);
                                    window.appState.sceneGenStatus.message = `✅ Parte ${chunkIndex + 1}/${sceneProcessingQueue.length} recebida`;
                                    window.appState.sceneGenStatus.subMessage = `Validando ${chunkMaxScenes} cena(s)...`;
                                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                    await new Promise(resolve => setTimeout(resolve, 200)); // Pequeno delay para UI atualizar

                                    // Processar resposta baseado no modelo REAL usado (não o original)
                                    if (actualChunkModel.startsWith('gpt-') || chunkResult.apiSource?.includes('OpenAI')) {
                                        // GPT retorna: { data: { scenes: [...] } } ou { data: [...] }
                                        chunkScenes = chunkResult.data?.scenes || chunkResult.data?.data?.scenes;
                                        // Se não encontrou em scenes, tenta como array direto
                                        if (!chunkScenes && Array.isArray(chunkResult.data)) {
                                            chunkScenes = chunkResult.data;
                                        }
                                    } else {
                                        // Gemini retorna: { data: [...] } diretamente
                                        if (Array.isArray(chunkResult.data)) {
                                            chunkScenes = chunkResult.data;
                                        } else if (chunkResult.data?.scenes && Array.isArray(chunkResult.data.scenes)) {
                                            chunkScenes = chunkResult.data.scenes;
                                        } else if (chunkResult.data?.data && Array.isArray(chunkResult.data.data)) {
                                            chunkScenes = chunkResult.data.data;
                                        } else {
                                            chunkScenes = chunkResult.data;
                                        }
                                    }

                                    // Debug: verificar se a resposta estÃ¡ vazia
                                    if (!chunkResult.data || (typeof chunkResult.data === 'object' && Object.keys(chunkResult.data).length === 0)) {
                                        console.error(`âŒ Resposta vazia recebida no chunk ${chunkIndex + 1}. apiSource: ${chunkResult.apiSource || 'N/A'}, data:`, chunkResult.data);
                                        throw new Error(`Resposta vazia da API para chunk ${chunkIndex + 1} (modelo: ${actualChunkModel}). Tente novamente ou use outro modelo.`);
                                    }
                                    
                                    if (!Array.isArray(chunkScenes) || chunkScenes.length === 0) {
                                        console.error(`âŒ Chunk ${chunkIndex + 1}: Resposta não Ã© um array vÃ¡lido. apiSource: ${chunkResult.apiSource || 'N/A'}, data:`, chunkResult.data);
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

                                    // Validação CRÍTICA (OBRIGATÓRIA): TODOS os prompts devem ter até 1200 caracteres (mínimo 600)
                                    // PRIMEIRO: Truncar prompts que ultrapassam 1200 caracteres
                                    normalized = normalized.map((scene, idx) => {
                                        if (scene.prompt_text && scene.prompt_text.length > maxPromptChars) {
                                            console.warn(`⚠️ Cena ${accumulatedScenes + idx + 1}: prompt com ${scene.prompt_text.length} caracteres, truncando para ${maxPromptChars}`);
                                            let truncated = scene.prompt_text.substring(0, maxPromptChars);
                                            const lastSpace = truncated.lastIndexOf(' ');
                                            if (lastSpace > maxPromptChars - 50) {
                                                truncated = truncated.substring(0, lastSpace);
                                            }
                                            scene.prompt_text = truncated.trim();
                                        }
                                        return scene;
                                    });
                                    
                                    let promptSizeIssues = 0;
                                    const sizeErrorDetails = [];
                                    normalized.forEach((scene, idx) => {
                                        const promptLength = scene.prompt_text.length;
                                        if (promptLength < minPromptChars) {
                                            promptSizeIssues++;
                                            sizeErrorDetails.push(`Cena ${accumulatedScenes + idx + 1}: ${promptLength} caracteres (mínimo: ${minPromptChars})`);
                                        }
                                    });
                                    
                                    if (promptSizeIssues > 0) {
                                        const errorMsg = `SIZE_VALIDATION_FAILED | ${promptSizeIssues}/${normalized.length} prompts fora do limite (${minPromptChars}-${maxPromptChars}). Detalhes: ${sizeErrorDetails.join(' | ')}`;
                                        console.error(`âŒ ${errorMsg}`);
                                        throw new Error(errorMsg);
                                    }
                                    
                                    console.log(`✅ Chunk ${chunkIndex + 1}: Todos os ${normalized.length} prompts estão dentro do tamanho ideal (600-1200 caracteres)`);

                                    // VALIDAÇÃO CRÍTICA: Verificar se recebeu quantidade aceitÃ¡vel
                                    const receivedPercent = (normalized.length / chunkMaxScenes) * 100;
                                    
                                    if (normalized.length !== chunkMaxScenes) {
                                        console.warn(`⚠️ Chunk ${chunkIndex + 1}: Esperado ${chunkMaxScenes} cenas, recebido ${normalized.length} cenas (${receivedPercent.toFixed(0)}%)`);
                                        
                                        // CRÍTICO: Se recebeu MENOS de 50%, Ã© resultado muito incompleto - REJEITAR
                                        if (receivedPercent < 50 && retries > 0) {
                                            retries--;
                                            console.error(`âŒ CRÍTICO: Recebeu apenas ${receivedPercent.toFixed(0)}% das cenas esperadas (${normalized.length}/${chunkMaxScenes})`);
                                            console.error(`   Isso indica MAX_TOKENS ou resposta cortada. Aumentando tokens e tentando novamente...`);
                                            window.addToLog(`⚠️ Chunk ${chunkIndex + 1}: Recebeu apenas ${normalized.length}/${chunkMaxScenes} cenas. Tentando novamente com mais tokens...`, true);
                                            
                                            // Aumentar tokens para prÃ³xima tentativa (50% a mais)
                                            chunkMaxOutputTokens = Math.min(chunkModelMaxTokens, Math.floor(chunkMaxOutputTokens * 1.5));
                                            console.log(`   ðŸ”§ Aumentando maxOutputTokens para: ${chunkMaxOutputTokens} (limite do modelo: ${chunkModelMaxTokens})`);
                                            
                                            await new Promise(resolve => setTimeout(resolve, 2000));
                                            continue; // Tenta novamente com mais tokens
                                        }
                                        
                                        // Se recebeu 50-99%, tentar novamente se tiver retries
                                        if (normalized.length < chunkMaxScenes && retries > 1) {
                                            retries--;
                                            console.log(`ðŸ”„ Tentando novamente para obter exatamente ${chunkMaxScenes} cenas (${retries} tentativas restantes)...`);
                                            await new Promise(resolve => setTimeout(resolve, 1500));
                                            continue; // Tenta novamente
                                        }

                                        if (normalized.length !== chunkMaxScenes) {
                                            throw new Error(`SCENE_COUNT_MISMATCH:${normalized.length}/${chunkMaxScenes}`);
                                        }
                                    }

                                    // ETAPA 5: Adicionando cenas ao resultado GRADUALMENTE (uma por uma)
                                    updateStageProgress(0.7);
                                    window.appState.sceneGenStatus.message = `Salvando parte ${chunkIndex + 1}/${chunkedSegments.length}`;
                                    window.appState.sceneGenStatus.subMessage = `Adicionando ${normalized.length} cena(s) ao resultado...`;
                                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                    
                                    // Adicionar cenas verificando duplicatas
                                    let addedCount = 0;
                                    for (let sceneIdx = 0; sceneIdx < normalized.length; sceneIdx++) {
                                        const scene = normalized[sceneIdx];
                                        // VERIFICAR DUPLICAÇÃO ANTES DE ADICIONAR
                                        const isDuplicate = window.scenePromptResults.data.some(
                                            existing => existing.original_text === scene.original_text && 
                                                       existing.prompt_text === scene.prompt_text
                                        );
                                        
                                        if (!isDuplicate) {
                                            window.scenePromptResults.data.push(scene);
                                            addedCount++;
                                            accumulatedScenes++;
                                        } else {
                                            console.warn(`⚠️ Cena duplicada detectada no chunk ${chunkIndex + 1}, ignorando...`);
                                        }
                                    }
                                    
                                    // Atualizar progresso uma vez após adicionar todas as cenas (mais eficiente)
                                    window.appState.sceneGenStatus.current = Math.min(exactSceneCount, accumulatedScenes);
                                    const currentPercent = Math.round((window.appState.sceneGenStatus.current / window.appState.sceneGenStatus.total) * 100);
                                    window.appState.sceneGenStatus.message = `Salvando cenas`;
                                    window.appState.sceneGenStatus.subMessage = `${addedCount} cena(s) adicionada(s) - Total: ${window.appState.sceneGenStatus.current}/${window.appState.sceneGenStatus.total} (${currentPercent}%)`;
                                    window.appState.sceneGenStatus.stageProgress = currentPercent;
                                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                    
                                    console.log(`✅ Chunk ${chunkIndex + 1}: ${normalized.length} cenas adicionadas (total acumulado: ${accumulatedScenes}/${exactSceneCount})`);
                                    
                                    // Garantir que não ultrapasse a quantidade exata calculada
                                    if (window.scenePromptResults.data.length > exactSceneCount) {
                                        console.warn(`⚠️ Cortando excesso: ${window.scenePromptResults.data.length} â†’ ${exactSceneCount} cenas`);
                                        window.scenePromptResults.data = window.scenePromptResults.data.slice(0, exactSceneCount);
                                        accumulatedScenes = exactSceneCount;
                                        window.appState.sceneGenStatus.current = exactSceneCount;
                                    }
                                    
                                    // ETAPA 6: Parte concluída - mostrar progresso final da parte
                                    const progressPercent = Math.round((window.appState.sceneGenStatus.current / window.appState.sceneGenStatus.total) * 100);
                                    window.appState.sceneGenStatus.message = `✅ Parte ${chunkIndex + 1}/${chunkedSegments.length} concluída!`;
                                    window.appState.sceneGenStatus.subMessage = `✅ ${window.appState.sceneGenStatus.current}/${window.appState.sceneGenStatus.total} cenas geradas (${progressPercent}%)`;
                                    window.appState.sceneGenStatus.stageProgress = progressPercent;
                                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                                    
                                    // Delay reduzido para melhor performance (era 500ms)
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                    
                                    break;
                                } catch (chunkError) {
                                    const isSizeValidationError = chunkError.message?.includes('SIZE_VALIDATION_FAILED');
                                    const isSceneCountMismatch = chunkError.message?.startsWith('SCENE_COUNT_MISMATCH');
                                    const isModelCapacityError = chunkError.message && chunkError.message.startsWith('MODEL_CAPACITY_EXCEEDED');
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

                                    if (isSizeValidationError) {
                                        if (retries > 0) {
                                            retries--;
                                            const details = chunkError.message.split('Detalhes:')[1] || '';
                                            console.error(`âŒ Tamanho invÃ¡lido detectado: ${details}`);
                                            window.addToLog(`⚠️ Chunk ${chunkIndex + 1}: IA não respeitou o limite de 600-1200 caracteres.${details ? ` (${details.trim()})` : ''} Tentando novamente...`, true);
                                            chunkPrompt += `\n\n⚠️⚠️⚠️ REGRA OBRIGATÓRIA: Cada prompt_text deve conter entre ${minPromptChars} e ${maxPromptChars} caracteres. Verifique cada prompt e ajuste antes de responder.`;                                            
                                            await new Promise(resolve => setTimeout(resolve, 2000));
                                            continue;
                                        }
                                        throw chunkError;
                                    }

                                    if (isModelCapacityError) {
                                        window.addToLog(`âŒ O modelo ${chunkModel} não suporta o tamanho necessÃ¡rio (${calculatedTokens}/${chunkModelMaxTokens} tokens). Divida o roteiro em partes menores ou use um modelo com maior limite.`, true);
                                        throw chunkError;
                                    }

                                    if (isSceneCountMismatch && retries > 0) {
                                        retries--;
                                        const mismatchInfo = chunkError.message.split(':')[1] || '';
                                        console.warn(`⚠️ Quantidade incorreta de cenas retornadas (${mismatchInfo}). ReforÃ§ando instruções e tentando novamente...`);
                                        if (chunkMaxOutputTokens >= chunkModelMaxTokens && chunkModel !== window.RECOMMENDED_MODEL || "gpt-4o") {
                                            window.addToLog(`⚠️ Chunk ${chunkIndex + 1}: IA não retornou todas as cenas e o modelo ${chunkModel} estÃ¡ no limite. Alternando para ${window.RECOMMENDED_MODEL || "gpt-4o"}.`, true);
                                            chunkModel = window.RECOMMENDED_MODEL || "gpt-4o";
                                            model = chunkModel;
                                            refreshModelParams();
                                            assignModelParameters();
                                        } else {
                                            chunkMaxOutputTokens = Math.min(chunkModelMaxTokens, Math.floor(chunkMaxOutputTokens * 1.4));
                                        }
                                        chunkPrompt += `\n\n⚠️⚠️⚠️ VOCÃŠ DEVE retornar exatamente ${chunkMaxScenes} cenas para esta parte. Conte e verifique antes de responder.`;
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                        continue;
                                    } else if (isSceneCountMismatch) {
                                        throw chunkError;
                                    }

                                    if (isMaxTokensError && retries > 0) {
                                        retries--;
                                        if (chunkMaxOutputTokens >= chunkModelMaxTokens && chunkModel !== window.RECOMMENDED_MODEL || "gpt-4o") {
                                            window.addToLog(`⚠️ Chunk ${chunkIndex + 1}: Mesmo após aumento, ${chunkModel} atingiu o limite de tokens. Alternando para ${window.RECOMMENDED_MODEL || "gpt-4o"}.`, true);
                                            chunkModel = window.RECOMMENDED_MODEL || "gpt-4o";
                                            model = chunkModel;
                                            refreshModelParams();
                                            assignModelParameters();
                                            console.warn(`ðŸ”„ Fallback após MAX_TOKENS: novo modelo "${chunkModel}" com limite ${chunkModelMaxTokens}.`);
                                        } else {
                                            chunkMaxOutputTokens = Math.min(chunkModelMaxTokens, Math.floor(chunkMaxOutputTokens * 1.5));
                                            console.warn(`⚠️ MAX_TOKENS detectado. Aumentando maxOutputTokens para ${chunkMaxOutputTokens} e tentando novamente (tentativas restantes: ${retries}).`);
                                        }
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                        continue;
                                    } else if (isJsonError && retries > 0) {
                                        // Erro de JSON - tentar novamente com prompt mais explÃ­cito
                                        window.addToLog(`Parte ${chunkIndex + 1}: erro de JSON detectado. Tentando novamente com instruções mais explÃ­citas... (${retries} restante)`, true);
                                        
                                        // Adicionar instrução ainda mais explÃ­cita no retry
                                        chunkPrompt = `${chunkPrompt}\n\nLEMBRE-SE: Retorne APENAS o JSON array, sem nenhum texto adicional. O JSON deve começar com [ e terminar com ]. Todas as strings entre aspas duplas.`;
                                        
                                        retries--;
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                        continue; // Tenta novamente com o prompt melhorado
                                    } else {
                                        retries--;
                                        if (retries === 0) {
                                            throw new Error(`Falha ao gerar cenas para a parte ${chunkIndex + 1}: ${chunkError.message}`);
                                        }
                                        window.addToLog(`Parte ${chunkIndex + 1}: erro (${chunkError.message}). Tentando novamente... (${retries} restante)`, true);
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                    }
                                }
                            }

                            // Não precisa mais desse delay - jÃ¡ temos delays mais longos dentro do loop
                        }

                        // VALIDAÇÃO FINAL - Garantir quantidade EXATA
                        const generated = window.scenePromptResults.data.length;
                        
                        if (generated !== exactSceneCount) {
                            const mismatchInfo = `${generated}/${exactSceneCount}`;
                            console.error(`âŒ ERRO: Quantidade final incorreta (${mismatchInfo}). Abortando geração.`);
                            throw new Error(`SCENE_TOTAL_MISMATCH:${mismatchInfo}`);
                        }

                        console.log(`✅ PERFEITO: Geradas exatamente ${generated} cenas conforme calculado!`);
                        window.addToLog(`✅ Quantidade exata atingida: ${generated} prompts de cena gerados`, false);
                        
                        window.scenePromptResults.total_prompts = window.scenePromptResults.data.length;
                        window.appState.sceneGenStatus.current = window.scenePromptResults.data.length;
                        window.appState.sceneGenStatus.total = exactSceneCount;
                        window.appState.sceneGenStatus.chunkCurrent = chunkedSegments.length;
                        window.appState.sceneGenStatus.subMessage = generated === exactSceneCount 
                            ? `✅ ${generated} cenas geradas com sucesso!`
                            : `${generated}/${exactSceneCount} cenas (${generated < exactSceneCount ? 'faltam ' + (exactSceneCount - generated) : 'excesso de ' + (generated - exactSceneCount)})`;
                        window.appState.sceneGenStatus.message = `Processamento concluído: ${window.scenePromptResults.data.length} cena(s).`;
                        window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                    } else {
                    let schema;
                    let prompt;
                    if (model.startsWith('gpt-')) {
                        // Limites ideais para prompts (600-1200 caracteres)
                        const minPromptChars = 600;
                        const maxPromptChars = 1200;
                        
                        const strictRulesObject = `
⚠️ CRITICO - CONTAGEM EXATA:
- VocÃª deve gerar EXATAMENTE ${exactSceneCount} cenas.
- Gere exatamente ${exactSceneCount} itens dentro do campo "scenes".
- Cada elemento deve ter scene_description iniciando com "Cena X:" (onde X Ã© o nÃºmero da cena).
- Não pule números, não repita números, não combine duas cenas em um único item.
- Se perceber que irÃ¡ gerar quantidade incorreta, RECONSTRUA a resposta antes de enviar.
`;

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

${strictRulesObject}

⚠️⚠️⚠️ REGRA CRÍTICA OBRIGATÓRIA - TAMANHO DO PROMPT:
- O prompt_text DEVE ter entre ${minPromptChars} e ${maxPromptChars} caracteres (não mais, não menos)
- Verifique o tamanho de CADA prompt_text antes de responder
- Se um prompt estiver muito longo, reduza detalhes desnecessários mantendo a essência
- Se estiver muito curto, adicione mais detalhes visuais relevantes
- Esta regra Ã© OBRIGATÓRIA e deve ser respeitada para TODAS as ${exactSceneCount} cenas
- Equilibrio ideal: riqueza visual + consistencia de personagem + foco da cena + seguranca de tokens
- Inclua: composicao, iluminacao, estilo visual, personagens (se houver), acao/emocao, atmosfera
- Evite: repeticoes, palavras vazias, excesso de adjetivos, detalhes irrelevantes
- Exemplo de estrutura: "[Subject/Character] [Action/Pose] [Setting/Background] [Lighting/Mood] [Style/Quality] [Camera Angle]"

CRITICO - FORMATO JSON OBRIGATORIO:
- Responda APENAS com um JSON objeto valido e completo
- Nao inclua texto antes ou depois do JSON
- Nao use markdown code blocks (sem \`\`\`json)
- Todas as strings devem estar entre aspas duplas
- Nao use virgulas finais
- Formato exato: {"scenes": [{"prompt_text": "...", "scene_description": "...", "original_text": "..."}]}
- O JSON deve ser valido e completo, sem cortes

ROTEIRO:
"""${window.removeAccents(text)}"""`;
                    } else {
                        // Limites ideais para prompts (600-1200 caracteres)
                        const minPromptChars = 600;
                        const maxPromptChars = 1200;
                        
                        const strictRulesArray = `
⚠️ CRITICO - CONTAGEM EXATA:
- VocÃª deve gerar EXATAMENTE ${exactSceneCount} cenas.
- Gere exatamente ${exactSceneCount} objetos no array JSON.
- Cada objeto deve ter scene_description iniciando com "Cena X:" (onde X Ã© o nÃºmero da cena).
- Não pule números, não repita números, não combine duas cenas em um único item.
- Se detectar que irÃ¡ gerar quantidade diferente, reconstrua a resposta antes de finalizar.
`;

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

${strictRulesArray}

⚠️⚠️⚠️ REGRA CRÍTICA OBRIGATÓRIA - TAMANHO DO PROMPT:
- O prompt_text DEVE ter entre ${minPromptChars} e ${maxPromptChars} caracteres (não mais, não menos)
- Verifique o tamanho de CADA prompt_text antes de responder
- Se um prompt estiver muito longo, reduza detalhes desnecessários mantendo a essência
- Se estiver muito curto, adicione mais detalhes visuais relevantes
- Esta regra Ã© OBRIGATÓRIA e deve ser respeitada para TODAS as ${exactSceneCount} cenas
- Equilibrio ideal: riqueza visual + consistencia de personagem + foco da cena + seguranca de tokens
- Inclua: composicao, iluminacao, estilo visual, personagens (se houver), acao/emocao, atmosfera
- Evite: repeticoes, palavras vazias, excesso de adjetivos, detalhes irrelevantes
- Exemplo de estrutura: "[Subject/Character] [Action/Pose] [Setting/Background] [Lighting/Mood] [Style/Quality] [Camera Angle]"

CRITICO - FORMATO JSON OBRIGATORIO:
- Responda APENAS com um JSON array valido e completo
- Nao inclua texto antes ou depois do JSON
- Nao use markdown code blocks (sem \`\`\`json)
- Todas as strings devem estar entre aspas duplas
- Nao use virgulas finais
- Formato exato: [{"prompt_text": "...", "scene_description": "...", "original_text": "..."}]
- O JSON deve ser valido e completo, sem cortes

ROTEIRO:
"""${window.removeAccents(text)}"""`;
                        }

                        let result;
                        let scenesData;
                        let retries = 3;

                        // Calcular maxOutputTokens baseado na quantidade exata de cenas
                        // Estimar tokens por cena de forma mais agressiva para evitar cortes
                        const nonChunkModelLower = window.normalizeModelName(model);
                        const tokensPerSceneEstimate = nonChunkModelLower.includes('gemini')
                            ? 500 // prompts longos + JSON â†’ Gemini tende a precisar de mais tokens
                            : nonChunkModelLower.includes('gpt-4')
                                ? 450
                                : 400;
                        const tokensNeededForScenes = exactSceneCount * tokensPerSceneEstimate;
                        const nonChunkedMaxTokens = Math.min(maxOutputTokens, Math.max(4096, tokensNeededForScenes + 1000)); // Margem de segurança
                        
                        console.log(`ðŸ“Š Requisição completa: ${exactSceneCount} cenas, ~${tokensNeededForScenes} tokens necessários (estimativa ${tokensPerSceneEstimate} tokens/cena), usando ${nonChunkedMaxTokens} tokens máximo`);

                        const updateStageProgress = (progress, msg, subMsg) => {
                            if (!window.appState.sceneGenStatus) return;
                            const currentStage = window.appState.sceneGenStatus.stageProgress || 0;
                            window.appState.sceneGenStatus.stageProgress = Math.max(currentStage, progress);
                            if (msg) window.appState.sceneGenStatus.message = msg;
                            if (subMsg !== undefined) window.appState.sceneGenStatus.subMessage = subMsg;
                            window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                        };

                        updateStageProgress(10, "Analisando roteiro completo", `Identificando ${exactSceneCount} cena(s) ideais...`);
                        await new Promise(resolve => setTimeout(resolve, 200));
                        updateStageProgress(18, "Preparando requisição para a IA", `Estimando tokens necessários (~${tokensNeededForScenes})...`);
                        await new Promise(resolve => setTimeout(resolve, 150));
                        
                        while (retries > 0) {
                            try {
                                updateStageProgress(30, "Enviando requisição completa para a IA", `Modelo selecionado: ${model}`);
                                console.log(`Enviando requisição completa para API: modelo="${model}"`);
                                
                                // Criar simulador de progresso em tempo real durante a chamada da API
                                let progressSimulator = null;
                                let progressCancelled = false;
                                const simulateProgress = () => {
                                    let currentProgress = 30;
                                    const progressSteps = [
                                        { progress: 35, delay: 500, msg: "Conexão estabelecida com a IA", sub: "Enviando roteiro completo..." },
                                        { progress: 42, delay: 800, msg: "IA analisando roteiro", sub: `Identificando ${exactSceneCount} momentos-chave...` },
                                        { progress: 50, delay: 1000, msg: " IA processando cena por cena", sub: "Gerando descrições visuais..." },
                                        { progress: 60, delay: 1200, msg: "âœï¸ IA escrevendo prompts em inglês", sub: "Otimizando para geração de imagens..." },
                                        { progress: 70, delay: 1000, msg: "IA refinando detalhes visuais", sub: "Garantindo coerência narrativa..." },
                                        { progress: 78, delay: 800, msg: "ðŸ” IA verificando qualidade", sub: "Validando todos os prompts..." },
                                        { progress: 85, delay: 1000, msg: "IA finalizando resposta", sub: "Preparando envio dos prompts..." }
                                    ];
                                    
                                    let stepIndex = 0;
                                    const runNextStep = () => {
                                        if (progressCancelled || stepIndex >= progressSteps.length) return;
                                        
                                        const step = progressSteps[stepIndex];
                                        updateStageProgress(step.progress, step.msg, step.sub);
                                        stepIndex++;
                                        
                                        if (stepIndex < progressSteps.length) {
                                            progressSimulator = setTimeout(runNextStep, step.delay);
                                        }
                                    };
                                    
                                    runNextStep();
                                };
                                
                                // Iniciar simulação de progresso
                                simulateProgress();
                                
                                // Fazer a chamada da API
                                result = await window.apiRequestWithFallback('/api/generate-legacy', 'POST', { 
                                    prompt, 
                                    model, 
                                    schema,
                                    maxOutputTokens: nonChunkedMaxTokens
                                });
                                
                                // Cancelar simulação quando a resposta chegar
                                progressCancelled = true;
                                if (progressSimulator) clearTimeout(progressSimulator);
                                
                                // Atualizar para 90% quando receber a resposta
                                updateStageProgress(90, "✅ Resposta recebida da IA", `Validando ${exactSceneCount} cena(s)...`);
                                
                                // Determinar qual modelo foi realmente usado (pode ter mudado no fallback)
                                const actualModel = result.apiSource?.includes('OpenAI') || result.apiSource?.includes('gpt') 
                                    ? 'gpt-4o' // Se veio do OpenAI, Ã© GPT
                                    : model; // Caso contrÃ¡rio, usa o modelo original
                                
                                console.log(`✅ Resposta completa recebida da API para modelo "${actualModel}" (apiSource: ${result.apiSource || 'N/A'})`);
                                
                                // Processar resposta baseado no modelo REAL usado (não o original)
                                if (actualModel.startsWith('gpt-') || result.apiSource?.includes('OpenAI')) {
                                    // GPT retorna: { data: { scenes: [...] } } ou { data: [...] }
                                    scenesData = result.data?.scenes || result.data?.data?.scenes;
                                    // Se não encontrou em scenes, tenta como array direto
                                    if (!scenesData && Array.isArray(result.data)) {
                                        scenesData = result.data;
                                    }
                                } else {
                                    // Gemini retorna: { data: [...] } diretamente
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
                                
                                // Debug: verificar se a resposta estÃ¡ vazia
                                if (!result.data || (typeof result.data === 'object' && Object.keys(result.data).length === 0)) {
                                    console.error(`âŒ Resposta vazia recebida. apiSource: ${result.apiSource || 'N/A'}, data:`, result.data);
                                    throw new Error(`Resposta vazia da API (modelo: ${actualModel}). Tente novamente ou use outro modelo.`);
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
                                        
                                        // Validar e truncar tamanho dos prompts (máximo 1200 caracteres)
                                        const minPromptChars = 600;
                                        const maxPromptChars = 1200;
                                        let promptSizeIssues = 0;
                                        
                                        scenesData.forEach((scene, idx) => {
                                            // PRIMEIRO: Truncar se ultrapassar 1200 caracteres
                                            if (scene.prompt_text && scene.prompt_text.length > maxPromptChars) {
                                                console.warn(`⚠️ Cena ${idx + 1}: prompt com ${scene.prompt_text.length} caracteres, truncando para ${maxPromptChars}`);
                                                let truncated = scene.prompt_text.substring(0, maxPromptChars);
                                                const lastSpace = truncated.lastIndexOf(' ');
                                                if (lastSpace > maxPromptChars - 50) {
                                                    truncated = truncated.substring(0, lastSpace);
                                                }
                                                scene.prompt_text = truncated.trim();
                                            }
                                            
                                            const promptLength = scene.prompt_text.length;
                                            if (promptLength < minPromptChars) {
                                                promptSizeIssues++;
                                                console.warn(`⚠️ Cena ${idx + 1}: prompt com apenas ${promptLength} caracteres (mínimo: ${minPromptChars})`);
                                            }
                                        });
                                        
                                        if (promptSizeIssues > 0) {
                                            throw new Error(`SIZE_VALIDATION_FAILED::${promptSizeIssues}/${scenesData.length} prompts fora do limite de ${minPromptChars}-${maxPromptChars} caracteres.`);
                                        }
                                        
                                        console.log(`✅ Modo completo: Todos os ${scenesData.length} prompts estão dentro do tamanho ideal (600-1200 caracteres)`);
                                        updateStageProgress(75, "✅ Resposta recebida e validada", `${validScenes.length} cena(s) identificadas. Normalizando dados...`);
                                        
                                        break;
                                    }
                                }
                                
                                if (retries > 1) {
                                    console.warn(`Tentativa ${4 - retries} falhou. Resposta recebida:`, result);
                                    window.addToLog(`Tentando novamente... (${retries - 1} tentativas restantes)`, false);
                                    updateStageProgress(Math.max(window.appState.sceneGenStatus.stageProgress || 0, 30), "ðŸ” Repetindo tentativa com ajustes", "Aguardando nova resposta da IA...");
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    retries--;
                                } else {
                                    throw new Error("A IA nao retornou prompts de cena validos no formato esperado.");
                                }
                            } catch (error) {
                                if (error.message?.includes('SIZE_VALIDATION_FAILED')) {
                                    retries--;
                                    if (retries === 0) {
                                        throw error;
                                    }
                                    window.addToLog(`⚠️ Prompt fora do limite de 600-1200 caracteres. Tentando novamente (${retries} restante)...`, true);
                                    prompt += `\n\n⚠️⚠️⚠️ VOCÃŠ DEVE garantir que o prompt_text tenha entre 600 e 1200 caracteres. Ajuste antes de responder.`;
                                    updateStageProgress(Math.max(window.appState.sceneGenStatus.stageProgress || 0, 35), "⚠️ Ajustando tamanho dos prompts", "Reenviando instruções mais rÃ­gidas...");
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    continue;
                                }

                        if (error.message?.startsWith('SCENE_COUNT_MISMATCH')) {
                            const mismatchInfo = error.message.split(':')[1] || '';
                            retries--;
                            if (retries === 0) {
                                throw new Error(`IA nao entregou a quantidade exata de cenas (${mismatchInfo || 'desconhecido'}) após todas as tentativas.`);
                            }
                            window.addToLog(`⚠️ IA não respeitou a quantidade exata (${mismatchInfo.trim()}). Regerando... (${retries} tentativa(s) restante(s))`, true);
                            updateStageProgress(Math.max(window.appState.sceneGenStatus.stageProgress || 0, 40), "⚠️ Corrigindo quantidade de cenas", "Repetindo geração com instruções reforÃ§adas...");
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            continue;
                        }

                                const isJsonError = error.message && (
                                    error.message.includes('JSON') ||
                                    error.message.includes('malformado') ||
                                    error.message.includes('incompleto') ||
                                    error.message.includes('parse') ||
                                    error.message.includes('Unexpected')
                                );
                                
                                if (isJsonError && retries > 0) {
                                    // Erro de JSON - adicionar instrução mais explÃ­cita no retry
                                    window.addToLog(`Erro de JSON detectado. Tentando novamente com instruções mais explÃ­citas... (${retries} restante)`, true);
                                    if (model.startsWith('gpt-')) {
                                        prompt = `${prompt}\n\nLEMBRE-SE: Retorne APENAS o JSON objeto vÃ¡lido, sem nenhum texto adicional. O JSON deve começar com { e terminar com }. Todas as strings entre aspas duplas.`;
                                    } else {
                                        prompt = `${prompt}\n\nLEMBRE-SE: Retorne APENAS o JSON array vÃ¡lido, sem nenhum texto adicional. O JSON deve começar com [ e terminar com ]. Todas as strings entre aspas duplas.`;
                                    }
                                    updateStageProgress(Math.max(window.appState.sceneGenStatus.stageProgress || 0, 35), "⚠️ Ajustando formato para JSON vÃ¡lido", "Refinando instruções e repetindo requisição...");
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    continue;
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
                        if (scenesData.length !== exactSceneCount) {
                            console.warn(`⚠️ Contagem incorreta: recebeu ${scenesData.length} cenas, esperado ${exactSceneCount}. ForÃ§ando nova tentativa...`);
                            throw new Error(`SCENE_COUNT_MISMATCH:${scenesData.length}/${exactSceneCount}`);
                        }
                    
                    // VERIFICAR DUPLICATAS ANTES DE ADICIONAR (MODO COMPLETO)
                    const existingData = window.scenePromptResults.data || [];
                    const uniqueScenes = scenesData.filter(newScene => {
                        return !existingData.some(existing => 
                            existing.original_text === newScene.original_text && 
                            existing.prompt_text === newScene.prompt_text
                        );
                    });
                    
                    if (uniqueScenes.length !== scenesData.length) {
                        console.warn(`⚠️ ${scenesData.length - uniqueScenes.length} cena(s) duplicada(s) removida(s)`);
                    }
                    
                    window.scenePromptResults.data.push(...uniqueScenes);
                    window.scenePromptResults.total_prompts = window.scenePromptResults.data.length;
                    window.appState.sceneGenStatus.current = window.scenePromptResults.data.length;
                        window.appState.sceneGenStatus.total = exactSceneCount;
                        window.appState.sceneGenStatus.subMessage = `Roteiro dividido automaticamente (${window.scenePromptResults.data.length}/${exactSceneCount} cenas).`;
                        window.appState.sceneGenStatus.message = `Roteiro dividido em ${window.scenePromptResults.data.length} cena(s) (calculado: ${exactSceneCount}).`;
                        updateStageProgress(90, window.appState.sceneGenStatus.message, window.appState.sceneGenStatus.subMessage);
                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                    }
                }

                // Garantir que scenePromptResults está acessível globalmente
                if (!window.scenePromptResults) {
                    window.scenePromptResults = { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
                }
                
                window.scenePromptResults.currentPage = 1;
                window.appState.lastGeneratedPrompts = window.scenePromptResults.data.map(item => item.prompt_text || '').filter(Boolean).join('\n');
                
                // Log para debug
                console.log('📊 Preparando para salvar prompts de cena no histórico:', {
                    hasScenePromptResults: !!window.scenePromptResults,
                    hasData: !!(window.scenePromptResults && window.scenePromptResults.data),
                    dataLength: window.scenePromptResults?.data?.length || 0,
                    totalPrompts: window.scenePromptResults?.total_prompts || 0,
                    dataSample: window.scenePromptResults?.data?.slice(0, 2) || []
                });
                
                // Verificar se há dados antes de salvar e renderizar
                if (window.scenePromptResults && window.scenePromptResults.data && Array.isArray(window.scenePromptResults.data) && window.scenePromptResults.data.length > 0) {
                    // Save to history
                    const sceneTitle = document.getElementById('scene-text')?.value.trim().substring(0, 50) || 'Prompts de Cena';
                    console.log(`💾 Salvando ${window.scenePromptResults.data.length} prompts de cena no histórico com título: "${sceneTitle}"`);
                    
                    if (typeof window.saveSceneToHistory === 'function') {
                        try {
                            window.saveSceneToHistory(window.scenePromptResults, sceneTitle);
                            console.log('✅ saveSceneToHistory chamado com sucesso');
                        } catch (error) {
                            console.error('❌ Erro ao chamar saveSceneToHistory:', error);
                            console.error('Stack trace:', error.stack);
                        }
                    } else {
                        console.error('❌ window.saveSceneToHistory não é uma função!');
                    }
                    
                    if (typeof window.renderSceneHistory === 'function') {
                        try {
                            window.renderSceneHistory();
                            console.log('✅ renderSceneHistory chamado com sucesso');
                        } catch (error) {
                            console.error('❌ Erro ao chamar renderSceneHistory:', error);
                        }
                    } else {
                        console.warn('⚠️ window.renderSceneHistory não é uma função!');
                    }

                    // Renderizar imediatamente se a aba estiver ativa
                    if (window.appState.currentTab === 'scene-prompts') {
                        if (typeof window.renderScenePage === 'function') {
                            window.renderScenePage();
                        }
                    } else {
                        // Se a aba não estiver ativa, garantir que será renderizado quando for clicado
                        console.log(`📊 Prompts gerados: ${window.scenePromptResults.data.length} cenas. Aguardando navegação para aba.`);
                    }
                } else {
                    console.warn('⚠️ Nenhum prompt de cena gerado. Dados:', window.scenePromptResults);
                }
                
                const endTime = Date.now();
                const duration = Math.round((endTime - startTime) / 1000);
                
                // Atualizar para 100% ANTES de mostrar modal de conclusÃ£o
                window.appState.sceneGenStatus.stageProgress = 100;
                window.appState.sceneGenStatus.current = window.scenePromptResults.data.length;
                window.appState.sceneGenStatus.total = window.scenePromptResults.data.length;
                window.appState.sceneGenStatus.message = `✅ ConcluÃ­do! ${window.scenePromptResults.data.length} prompts gerados`;
                window.appState.sceneGenStatus.subMessage = `GeraÃ§Ã£o completa em ${duration}s`;
                window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                
                // Pequeno delay para o usuário VER o 100%
                await new Promise(resolve => setTimeout(resolve, 500));
                
                window.showSceneGenCompleteModal(duration);

                window.appState.sceneGenStatus.message = `Concluido. ${window.scenePromptResults.data.length} prompts gerados.`;

            } catch (error) {
                console.error('Erro ao gerar prompts de cena:', error);
                const errorMsg = error.message || "Erro ao gerar prompts de cena";
                const isSizeError = errorMsg.includes('SIZE_VALIDATION_FAILED');
                const isSceneMismatch = errorMsg.startsWith('SCENE_TOTAL_MISMATCH');
                
                if (isSceneMismatch) {
                    window.addToLog('âŒ Falha ao gerar todas as cenas. O sistema não conseguiu chegar Ã  quantidade exata. Tente novamente ou use um modelo mais poderoso.', true);
                    window.appState.sceneGenStatus.message = 'Falha: quantidade de cenas gerada não corresponde ao esperado.';
                } else if (isSizeError) {
                    window.addToLog('âŒ A IA não respeitou o limite de 600-1200 caracteres por prompt. Tente novamente.', true);
                    window.appState.sceneGenStatus.message = 'Erro: Limite de caracteres não respeitado pela IA.';
                } else {
                    window.addToLog(errorMsg, true);
                    window.appState.sceneGenStatus.message = errorMsg;
                }
                
                window.appState.sceneGenStatus.error = true;
                
                // Tentar extrair informações Ãºteis do erro
                if (errorMsg.includes('JSON')) {
                    window.addToLog("Erro de formataÃ§Ã£o JSON detectado. A resposta da IA pode estar malformada.", true);
                    console.error('Detalhes do erro JSON:', error);
                }
            } finally {
                window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                setTimeout(() => {
                    window.appState.sceneGenStatus.active = false;
                    window.renderSceneGenerationProgress(window.appState.sceneGenStatus);
                }, 5000);
            }
        };
    
    // ============================================================================
    // HANDLER: GENERATE-EDITORS-CUT (Guia de Edição)
    // ============================================================================
    window.handlers = window.handlers || {};
    window.handlers['generate-editors-cut'] = async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const scriptInput = document.getElementById('editors-cut-script-input');
        const promptsInput = document.getElementById('editors-cut-prompts-input');
        const modelSelect = document.getElementById('editors-cut-model-select');
        const outputEl = document.getElementById('output');
        
        if (!scriptInput || !promptsInput || !modelSelect || !outputEl) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Erro: Campos não encontrados. Recarregue a página.', true);
            }
            return;
        }
        
        const script = scriptInput.value.trim();
        const prompts = promptsInput.value.trim();
        const model = modelSelect.value;
        
        if (!script || !prompts || !model) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Por favor, preencha o roteiro, os prompts de cena e selecione um modelo de IA.', true);
            }
            return;
        }
        
        // Dividir prompts por linha
        const promptLines = prompts.split('\n').filter(p => p.trim().length > 0);
        
        if (promptLines.length === 0) {
            if (window.showSuccessToast) {
                window.showSuccessToast('Por favor, adicione pelo menos um prompt de cena (um por linha).', true);
            }
            return;
        }
        
        if (window.showProgressModal) {
            window.showProgressModal('Gerando Guia de Edição...', 'A IA está combinando o roteiro com os prompts de cena...');
        }
        
        // Limpar output anterior
        outputEl.innerHTML = '<div class="text-center py-4 text-gray-500 dark:text-gray-400">Gerando guia de edição...</div>';
        
        // Dividir roteiro em partes para melhor casamento
        const scriptParts = script.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        try {
            const prompt = `Você é um especialista em edição de vídeos. Sua tarefa é criar um GUIA DE EDIÇÃO PRÁTICO que case o roteiro com os prompts de cena, mostrando EXATAMENTE onde cada imagem deve ser colocada.

ROTEIRO COMPLETO:
"""
${script}
"""

PROMPTS DE CENA (${promptLines.length} prompts - um por linha):
${promptLines.map((p, i) => `[PROMPT ${i + 1}]\n${p}`).join('\n\n')}

TAREFA PRINCIPAL:
Analise cuidadosamente o roteiro e identifique os momentos ideais para usar cada prompt de cena. Você deve casar cada prompt com o trecho do roteiro que melhor se relaciona com ele, considerando o contexto e o conteúdo.

INSTRUÇÕES CRÍTICAS:
1. Para CADA prompt de cena, você DEVE encontrar o trecho do roteiro que melhor se relaciona semanticamente
2. Use TODOS os ${promptLines.length} prompts fornecidos - não deixe nenhum de fora
3. Se houver mais prompts que segmentos no roteiro, combine múltiplos prompts em um segmento quando fizer sentido narrativo
4. Se houver mais segmentos que prompts, reutilize prompts em momentos diferentes quando apropriado, mas priorize usar todos os prompts primeiro
5. Mantenha a ordem cronológica do roteiro - não altere a sequência

FORMATO OBRIGATÓRIO para cada casamento (use este formato exato):
---
[SEGMENTO X]
📝 TEXTO DO ROTEIRO:
[cole aqui o trecho exato do roteiro que corresponde a este prompt - copie literalmente do roteiro fornecido]

🖼️ IMAGEM A USAR:
[PROMPT Y] - [descrição breve do que a imagem mostra baseada no prompt]

📍 ONDE COLOCAR A IMAGEM:
- Posição: [ANTES / DURANTE / DEPOIS do texto]
- Momento específico: [seja específico - ex: "quando mencionar 'casa misteriosa'", "no início da frase sobre X", etc.]

⏱️ TIMING:
- Início: [quando começar a mostrar a imagem - ex: "no início do trecho", "quando mencionar X", "2 segundos após começar a falar", etc.]
- Duração sugerida: [quanto tempo mostrar a imagem - ex: "3-5 segundos", "até o final do trecho", "enquanto fala sobre X", etc.]

✂️ INSTRUÇÕES DE EDIÇÃO:
- Transição de entrada: [fade in, cut, zoom in, pan, etc.]
- Transição de saída: [fade out, cut, zoom out, etc.]
- Efeitos sugeridos: [se houver efeitos específicos - ex: "correção de cor escura", "saturação aumentada", etc.]
- Observações: [qualquer observação adicional relevante]
---

IMPORTANTE:
- Seja MUITO específico sobre ONDE exatamente no roteiro cada imagem deve aparecer
- Use o número do prompt correto (1, 2, 3, etc.) - não invente números
- O guia deve ser prático e direto - o editor precisa saber exatamente onde colocar cada imagem
- Mantenha a ordem cronológica do roteiro
- Caso cada prompt com o trecho do roteiro que melhor se relaciona com o conteúdo visual descrito no prompt

Gere o guia completo agora, casando todos os ${promptLines.length} prompts com os trechos correspondentes do roteiro. Use o formato exato especificado acima:`;
            
            let guideText = '';
            let isComplete = false;
            
            // Usar streaming para mostrar progresso
            const streamApiRequestFunction = window.streamApiRequest || window.apiRequest;
            
            if (streamApiRequestFunction && typeof streamApiRequestFunction === 'function' && streamApiRequestFunction.length >= 3) {
                // Usar streaming
                await new Promise((resolve, reject) => {
                    streamApiRequestFunction(
                        '/api/generate-stream',
                        { model, prompt, stream: true },
                        (data) => {
                            // Processar chunks
                            let chunk = '';
                            if (data?.choices?.[0]?.delta?.content) {
                                chunk = data.choices[0].delta.content;
                            } else if (data?.delta?.text) {
                                chunk = data.delta.text;
                            } else if (data?.type === 'content_block_delta' && data?.delta?.text) {
                                chunk = data.delta.text;
                            } else if (data?.candidates?.[0]?.content?.parts?.length > 0) {
                                const parts = data.candidates[0].content.parts;
                                chunk = parts.map(p => p.text || '').join('');
                            } else if (data?.text) {
                                chunk = data.text;
                            }
                            
                            if (chunk) {
                                guideText += chunk;
                                
                                // Atualizar preview em tempo real
                                outputEl.innerHTML = `
                                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                                        <div class="flex justify-between items-center mb-4">
                                            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Gerando Guia de Edição...</h3>
                                            <div class="text-sm text-gray-500 dark:text-gray-400">${guideText.length} caracteres</div>
                                        </div>
                                        <div class="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg max-h-96 overflow-y-auto">
                                            ${guideText.replace(/\n/g, '<br>')}
                                        </div>
                                    </div>
                                `;
                            }
                        },
                        (remainingBuffer) => {
                            // Stream concluído
                            if (remainingBuffer && remainingBuffer.trim()) {
                                guideText += remainingBuffer.trim();
                            }
                            isComplete = true;
                            resolve();
                        },
                        (error) => {
                            reject(error);
                        }
                    );
                });
            } else {
                // Fallback para API sem streaming
                const result = await window.apiRequestWithFallback('/api/generate-legacy', 'POST', {
                    prompt: prompt,
                    model: model,
                    maxOutputTokens: 8000
                });
                
                if (result && result.data) {
                    if (result.data.text) {
                        guideText = result.data.text;
                    } else if (typeof result.data === 'string') {
                        guideText = result.data;
                    } else if (result.data.content) {
                        guideText = result.data.content;
                    } else if (result.data.guide) {
                        guideText = result.data.guide;
                    } else if (Array.isArray(result.data) && result.data.length > 0) {
                        guideText = typeof result.data[0] === 'string' 
                            ? result.data[0] 
                            : result.data[0].text || result.data[0].content || JSON.stringify(result.data[0]);
                    }
                }
                
                if (!guideText && result && result.text) {
                    guideText = result.text;
                }
                isComplete = true;
            }
            
            if (!guideText || !guideText.trim()) {
                throw new Error('Não foi possível gerar o guia de edição.');
            }
            
            // Renderizar resultado final com botão de download
            const finalGuideText = guideText.trim();
            const escapedText = finalGuideText.replace(/"/g, '&quot;').replace(/\n/g, '\\n');
            
            outputEl.innerHTML = `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">✅ Guia de Edição Gerado</h3>
                        <div class="flex gap-2">
                            <button id="download-editors-guide-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold">💾 Baixar .txt</button>
                            <button class="copy-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold" data-text="${escapedText}">📋 Copiar</button>
                        </div>
                    </div>
                    <div class="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg max-h-[600px] overflow-y-auto">
                        ${finalGuideText.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
            
            // Adicionar event listener para botão de download
            const downloadBtn = outputEl.querySelector('#download-editors-guide-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    const blob = new Blob([finalGuideText], { type: 'text/plain;charset=utf-8' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `guia_edicao_${new Date().getTime()}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    if (window.showSuccessToast) {
                        window.showSuccessToast('Guia de edição baixado!');
                    }
                });
            }
            
            // Adicionar event listener para botão de copiar
            const copyBtn = outputEl.querySelector('.copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    const text = copyBtn.getAttribute('data-text')?.replace(/\\n/g, '\n');
                    if (text) {
                        navigator.clipboard.writeText(text).then(() => {
                            if (window.showSuccessToast) {
                                window.showSuccessToast('Guia de edição copiado!');
                            }
                        }).catch(err => {
                            console.error('Erro ao copiar:', err);
                        });
                    }
                });
            }
            
            if (window.showSuccessToast) {
                window.showSuccessToast('Guia de edição gerado com sucesso!');
            }
            
        } catch (error) {
            console.error('Erro ao gerar guia de edição:', error);
            outputEl.innerHTML = `
                <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                    <h3 class="text-xl font-bold text-red-900 dark:text-red-100 mb-2">Erro ao Gerar Guia</h3>
                    <p class="text-red-700 dark:text-red-300">${error.message || 'Ocorreu um erro desconhecido.'}</p>
                </div>
            `;
            if (window.showSuccessToast) {
                window.showSuccessToast(`Erro: ${error.message}`, true);
            }
        } finally {
            if (window.hideProgressModal) {
                window.hideProgressModal();
            }
        }
    };
    
    console.log('✅ app-core.js inicializado');
});
