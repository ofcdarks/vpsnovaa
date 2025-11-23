/**
 * Módulo: Gerador de Voz
 * Gera narração de voz a partir de roteiro
 * CÓDIGO COMPLETO - Versão idêntica ao handler original
 */

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'voice-generator',
    name: 'Gerador de Voz',
    icon: 'M12 1a4 4 0 00-4 4v5a4 4 0 008 0V5a4 4 0 00-4-4zm-6 9a6 6 0 0012 0h2a8 8 0 01-7 7.937V21h-2v-3.063A8 8 0 014 10h2z',
    category: 'audio',

    /**
     * Handler principal - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - handler 'tts-generate-btn'
     */
    async handler() {
        const utils = getGlobalUtils();
        const {
            showSuccessToast,
            addToLog,
            apiRequest
        } = utils;

        // Acessar funções globais necessárias
        const getVoiceGeneratorState = window.getVoiceGeneratorState || (() => ({ longGenJobId: null, longGenInterval: null, pollErrorCount: 0 }));
        const renderVoiceGenerationProgress = window.renderVoiceGenerationProgress || (() => {});
        const showVoiceGenCompleteModal = window.showVoiceGenCompleteModal || (() => {});
        
        // Garantir que appState existe e tem voiceGenStatus
        if (!window.appState) {
            window.appState = {};
        }
        const appState = window.appState;
        
        if (!appState.voiceGenStatus) {
            appState.voiceGenStatus = {
                active: false,
                current: 0,
                total: 0,
                message: '',
                error: false
            };
        }

        const scriptInput = document.getElementById('tts-script-input');
        const voiceSelect = document.getElementById('tts-voice-select');
        const modelSelect = document.getElementById('tts-model-select');
        const providerSelect = document.getElementById('tts-provider-select');
        const stylePresetSelect = document.getElementById('tts-style-preset');
        const styleInstructions = document.getElementById('tts-style-instructions');
        const outputContainer = document.getElementById('output');

        const script = scriptInput?.value.trim();
        const voice = voiceSelect?.value;
        const ttsModel = modelSelect?.value || 'gemini-2.5-pro-preview-tts'; // Fallback
        const provider = providerSelect?.value || 'openai'; // OpenAI como padrão (melhor qualidade)
        
        // Obter estilo: se houver preset selecionado e instruções, usar instruções (que já foram preenchidas automaticamente)
        // Se não houver preset mas houver instruções customizadas, usar as customizadas
        let style = styleInstructions?.value.trim() || '';
        
        // Se houver preset selecionado mas não houver instruções, tentar obter do mapa
        if (stylePresetSelect?.value && !style && window.narrationStylesMap) {
            style = window.narrationStylesMap[stylePresetSelect.value] || '';
        }

        if (!script || !voice) {
            showSuccessToast('Por favor, preencha o roteiro e selecione uma voz.');
            return;
        }

        // Sem limite de caracteres - o backend divide automaticamente em partes

        if (outputContainer) outputContainer.innerHTML = ''; // Clear previous results

        try {
            addToLog(`A iniciar geracao de narracao usando ${provider === 'openai' ? 'OpenAI' : 'Gemini'}...`);
            
            // Inicializar status imediatamente para mostrar o modal
            appState.voiceGenStatus = {
                active: true,
                current: 0,
                total: 1,
                message: 'Iniciando geração de narração...',
                error: false,
                status: 'processing'
            };
            renderVoiceGenerationProgress(appState.voiceGenStatus);
            
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
            
            // Atualizar status após receber o jobId
            appState.voiceGenStatus = {
                active: true,
                current: 0,
                total: 1,
                message: 'Processando roteiro...',
                error: false,
                status: 'processing'
            };
            renderVoiceGenerationProgress(appState.voiceGenStatus);

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
                        if (errorMsg.toLowerCase().includes('ffmpeg')) {
                            addToLog(`❌ Erro no processamento de áudio (FFMPEG): O servidor está processando o áudio, mas ocorreu um erro técnico. Por favor, contate o administrador do sistema. Detalhes: ${errorMsg}`, true);
                        } else if (errorMsg.includes('Quota') || errorMsg.includes('quota')) {
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

    /**
     * Handler para preview/teste de voz - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - handler 'tts-preview-btn'
     */
    async previewHandler() {
        const utils = getGlobalUtils();
        const {
            showSuccessToast,
            addToLog,
            apiRequest
        } = utils;

        const previewBtn = document.getElementById('tts-preview-btn');
        const previewPlayer = document.getElementById('tts-preview-player');
        const voice = document.getElementById('tts-voice-select')?.value;
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

    init() {
        console.log('✅ Módulo Voice Generator inicializado');
        // Event listeners serão registrados pelo sistema de handlers
        // Registrar handler de preview também
        if (typeof window.handlers !== 'undefined') {
            window.handlers['tts-preview-btn'] = this.previewHandler.bind(this);
        }
    }
};
