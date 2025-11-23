/**
 * Sistema de Integração de Módulos - Versão Modular
 * Carrega módulos SEM depender do app.js grande
 * Usa apenas o app-core.js mínimo
 */

(async function integrateModulesModular() {
    'use strict';
    
    console.log('🔄 Iniciando integração modular de módulos...');
    
    try {
        // Aguardar app-core.js inicializar (se existir)
        // Se não existir, inicializar diretamente
        function waitForCore() {
            return new Promise((resolve) => {
                // Se handlers já estiver disponível, resolver imediatamente
                if (typeof window.handlers !== 'undefined') {
                    resolve();
                    return;
                }
                
                // Aguardar até 5 segundos
                let attempts = 0;
                const maxAttempts = 50; // 5 segundos
                
                const checkInterval = setInterval(() => {
                    attempts++;
                    
                    if (typeof window.handlers !== 'undefined') {
                        clearInterval(checkInterval);
                        console.log('✅ app-core.js carregado após', attempts * 100, 'ms');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        console.log('⚠️ app-core.js não detectado. Inicializando diretamente...');
                        resolve();
                    }
                }, 100);
            });
        }
        
        // Aguardar core carregar
        await waitForCore();
        
        // Inicializar handlers se não existir
        if (typeof window.handlers === 'undefined') {
            window.handlers = {};
            console.log('📦 Criando window.handlers...');
        }
        
        // Aguardar que o app-core.js tenha inicializado o loader (se existir)
        // Se não existir, criar uma nova instância
        let loader = window.moduleLoader;
        
        if (!loader || typeof loader.loadAllModules !== 'function') {
            // Se não existe ou não é uma instância válida, criar nova
            const { default: ModuleLoader } = await import('./frontend/loader.js');
            loader = new ModuleLoader();
            window.ModuleLoader = ModuleLoader;
            window.moduleLoader = loader;
        }
        
        // Carregar todos os módulos
        console.log('📦 Carregando todos os módulos...');
        const moduleHandlers = await loader.loadAllModules();
        
        // Mapeamento de IDs dos módulos para nomes dos handlers
        const handlerMapping = {
            'brainstorm': 'generate-brainstorm-ideas',
            'viral-titles': 'generate-viral-content',
            'script-writer': 'generate-script',
            'translator': 'translate-script',
            'scene-prompts': 'generate-scene-prompts',
            'thumbnail-prompts': 'generate-prompts',
            'image-generator': 'generate-imagefx',
            'voice-generator': 'tts-generate-btn',
            'script-reviewer': 'analyze-script-btn',
            'description-optimizer': 'optimize-script-btn',
            'video-optimizer': 'analyze-video-btn',
            'text-splitter': 'split-text-btn',
            'srt-converter': 'convert-to-srt',
            'character-detector': 'detect-characters-btn'
        };
        
        // Registrar handlers dos módulos
        let registeredCount = 0;
        for (const [moduleId, handlerName] of Object.entries(handlerMapping)) {
            // IMPORTANTE: Para scene-prompts, NÃO sobrescrever o handler do app-core.js
            // O handler completo já está em app-core.js (linha 7006) e deve ser mantido
            // O módulo scene-prompts NÃO exporta handler para evitar recursão infinita
            if (handlerName === 'generate-scene-prompts') {
                if (window.handlers && window.handlers['generate-scene-prompts']) {
                    console.log(`✅ Handler '${handlerName}' já existe no app-core.js, mantendo handler do app-core.js...`);
                } else {
                    console.warn(`⚠️ Handler '${handlerName}' não encontrado no app-core.js! Verifique se está registrado.`);
                }
                continue; // NUNCA registrar handler do módulo para scene-prompts
            }
            
            const moduleHandler = moduleHandlers.get(moduleId) || moduleHandlers.get(handlerName);
            
            if (moduleHandler && typeof moduleHandler === 'function') {
                window.handlers[handlerName] = moduleHandler;
                registeredCount++;
                console.log(`✅ Handler '${handlerName}' registrado do módulo '${moduleId}'`);
            } else {
                // Se não encontrou no Map, tentar buscar diretamente do módulo
                const module = loader.getModule(moduleId);
                if (module && typeof module.handler === 'function') {
                    window.handlers[handlerName] = module.handler.bind(module);
                    registeredCount++;
                    console.log(`✅ Handler '${handlerName}' registrado diretamente do módulo '${moduleId}'`);
                } else {
                    console.warn(`⚠️ Handler '${handlerName}' não encontrado para módulo '${moduleId}'`);
                }
            }
        }
        
        // GARANTIR que generate-script está registrado
        if (!window.handlers['generate-script'] || typeof window.handlers['generate-script'] !== 'function') {
            console.warn('⚠️ Handler generate-script não foi registrado. Tentando registrar novamente...');
            const scriptWriterModule = loader.getModule('script-writer');
            if (scriptWriterModule && typeof scriptWriterModule.handler === 'function') {
                window.handlers['generate-script'] = scriptWriterModule.handler.bind(scriptWriterModule);
                registeredCount++;
                console.log('✅ Handler generate-script FORÇADO no integration-modular.js');
            } else {
                console.error('❌ Módulo script-writer não encontrado no integration-modular.js!');
            }
        }
        
        console.log(`✅ ${registeredCount} handlers registrados!`);
        console.log(`✅ ${loader.listModules().length} módulos carregados`);
        console.log('📋 Handlers disponíveis:', Object.keys(window.handlers));
        console.log('🔍 Handler generate-script:', typeof window.handlers['generate-script'], window.handlers['generate-script'] ? '✅' : '❌');
        
        // Inicializar todos os módulos
        for (const moduleId of loader.listModules()) {
            await loader.initModule(moduleId);
        }
        
        // VERIFICAÇÃO FINAL: Garantir que script-writer está carregado e handler registrado
        const scriptWriterCheck = loader.getModule('script-writer');
        if (!scriptWriterCheck) {
            console.error('❌❌❌ MÓDULO script-writer NÃO ENCONTRADO NO LOADER!');
            console.error('Módulos disponíveis:', loader.listModules());
            // Tentar carregar manualmente
            try {
                console.log('🔄 Tentando carregar script-writer manualmente...');
                await loader.loadModule('script-writer');
                console.log('✅ script-writer carregado manualmente');
            } catch (manualError) {
                console.error('❌ Erro ao carregar script-writer manualmente:', manualError);
            }
        } else {
            console.log('✅ Módulo script-writer confirmado no loader');
            // Garantir que o handler está registrado
            if (!window.handlers['generate-script'] || typeof window.handlers['generate-script'] !== 'function') {
                if (typeof scriptWriterCheck.handler === 'function') {
                    window.handlers['generate-script'] = scriptWriterCheck.handler.bind(scriptWriterCheck);
                    console.log('✅ Handler generate-script registrado do módulo verificado');
                }
            }
        }
        
        // Configurar event listeners para botões (se não foi configurado pelo app-core)
        if (!window.eventListenersConfigured) {
            setupModularEventListeners();
            window.eventListenersConfigured = true;
        }
        
        console.log('✅ Integração modular concluída!');
        
    } catch (error) {
        console.error('❌ Erro ao integrar módulos modulares:', error);
        console.error('Stack:', error.stack);
    }
    
    /**
     * Configura event listeners para os botões dos módulos
     */
    function setupModularEventListeners() {
        // Event listeners para handlers de botões
        // IMPORTANTE: Usar bubble phase (capture: false) para NÃO interferir com navegação
        // A navegação usa capture phase (capture: true) e tem prioridade
        document.addEventListener('click', (e) => {
            // CRÍTICO: Ignorar COMPLETAMENTE se for um botão da sidebar (navegação tem prioridade absoluta)
            if (e.target.closest('.sidebar-btn')) {
                return; // Não processar botões da sidebar aqui - deixar navegação funcionar
            }
            
            // CRÍTICO: Ignorar se for um formulário ou botão de formulário
            const form = e.target.closest('form');
            if (form) {
                return; // Deixar formulários funcionarem normalmente
            }
            
            // Ignorar botões de submit de formulários
            if (e.target.type === 'submit' || e.target.closest('button[type="submit"]')) {
                return; // Deixar formulários processarem normalmente
            }
            
            const button = e.target.closest('button');
            if (!button || !button.id) return;
            
            const handlerName = button.id;
            const handler = window.handlers[handlerName];
            
            if (handler && typeof handler === 'function') {
                // NÃO usar stopPropagation aqui para não bloquear navegação
                // Apenas preventDefault para evitar comportamento padrão do botão
                e.preventDefault();
                
                // Executar handler de forma assíncrona sem bloquear
                // Usar IIFE para evitar retornar Promise do listener
                (async () => {
                    try {
                        const result = handler(e);
                        if (result instanceof Promise) {
                            await result;
                        }
                    } catch (error) {
                        console.error(`Erro ao executar handler ${handlerName}:`, error);
                        if (window.showSuccessToast) {
                            window.showSuccessToast(`Erro: ${error.message}`, true);
                        }
                    }
                })();
                
                // Não retornar nada para evitar conflitos com extensões
                return;
            }
        }, { capture: false, passive: false }); // Bubble phase - executa DEPOIS da navegação (capture: true)
        
        console.log('✅ Event listeners modulares configurados');
    }
    
})();

