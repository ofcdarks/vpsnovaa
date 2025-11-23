/**
 * Sistema de Integração de Módulos
 * Integra os módulos com o código existente do app.js
 */

// Aguardar o DOM e o app.js carregarem
(async function integrateModules() {
    'use strict';
    
    // Aguardar app.js carregar completamente
    function waitForAppJS() {
        return new Promise((resolve) => {
            // Se já estiver disponível, resolver imediatamente
            if (typeof window.handlers !== 'undefined' && Object.keys(window.handlers).length > 0) {
                resolve();
                return;
            }
            
            console.log('⏳ Aguardando app.js carregar...');
            let attempts = 0;
            const maxAttempts = 100; // 10 segundos (100 * 100ms)
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                if (typeof window.handlers !== 'undefined' && Object.keys(window.handlers).length > 0) {
                    clearInterval(checkInterval);
                    console.log('✅ app.js carregado após', attempts * 100, 'ms');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.warn('⚠️ app.js não carregou dentro de 10 segundos. Tentando mesmo assim...');
                    resolve();
                }
            }, 100);
        });
    }
    
    // Carregar módulos e integrar
    async function loadAndIntegrateModules() {
        try {
            console.log('🔄 Iniciando integração de módulos...');
            
            // Carregar ModuleLoader
            const ModuleLoader = await import('./frontend/loader.js');
            const loader = window.ModuleLoader || ModuleLoader.default;
            
            // Carregar todos os módulos
            const moduleHandlers = await loader.loadAllModules();
            
            // Aguardar handlers do app.js estarem disponíveis
            await waitForAppJS();
            
            // Integrar handlers dos módulos com os existentes
            if (typeof window.handlers !== 'undefined') {
                console.log('🔗 Integrando handlers dos módulos...');
                
                // Mapeamento de IDs dos módulos para nomes dos handlers
                // Nota: Academy, Settings, FAQ, Admin e Chat não têm handlers diretos, 
                // mas têm funções de inicialização que são chamadas quando a aba é aberta
                const handlerMapping = {
                    'brainstorm-ideas': 'generate-brainstorm-ideas',
                    'viral-titles': 'generate-viral-content',
                    'script-writer': 'generate-script',
                    'script-translator': 'translate-script',
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
                    // Academy, Settings, FAQ, Admin e Chat são inicializados diretamente
                    // quando a aba é aberta através das funções initializeAcademy, etc.
                };
                
                // Substituir handlers existentes pelos dos módulos
                let integratedCount = 0;
                for (const [moduleId, handlerName] of Object.entries(handlerMapping)) {
                    const moduleHandler = moduleHandlers.get(moduleId) || moduleHandlers.get(handlerName);
                    
                    if (moduleHandler && typeof window.handlers[handlerName] !== 'undefined') {
                        // Backup do handler original (opcional, para debug)
                        if (!window.originalHandlers) {
                            window.originalHandlers = {};
                        }
                        window.originalHandlers[handlerName] = window.handlers[handlerName];
                        
                        // Substituir pelo handler do módulo
                        window.handlers[handlerName] = moduleHandler;
                        integratedCount++;
                        console.log(`✅ Handler '${handlerName}' substituído pelo módulo '${moduleId}'`);
                    } else if (!moduleHandler) {
                        console.warn(`⚠️ Handler do módulo '${moduleId}' não encontrado`);
                    }
                }
                
                console.log(`✅ ${integratedCount} handlers integrados com sucesso!`);
                console.log('📋 Handlers disponíveis:', Object.keys(window.handlers));
                
                // Expor loader globalmente para debug
                window.moduleLoader = loader;
                
            } else {
                console.warn('⚠️ window.handlers não está disponível. Módulos não foram integrados.');
            }
            
        } catch (error) {
            console.error('❌ Erro ao integrar módulos:', error);
            console.error('Stack:', error.stack);
        }
    }
    
            // Iniciar após um pequeno delay para garantir que app.js tenha tempo de carregar
    function startIntegration() {
        // Aguardar um pouco para que app.js tenha tempo de carregar
        setTimeout(() => {
            loadAndIntegrateModules();
        }, 500);
    }
    
    // Iniciar quando DOM estiver pronto ou já estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startIntegration);
    } else {
        // DOM já está pronto, mas aguardar um pouco para app.js carregar
        startIntegration();
    }
    
})();

