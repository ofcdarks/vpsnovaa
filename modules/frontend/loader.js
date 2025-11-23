

class ModuleLoader {
    constructor() {
        this.modules = new Map();
        this.handlers = new Map();
        this.initialized = false;
    }

    
    async loadModule(moduleName) {
        try {
            console.log(`📦 Carregando módulo: ${moduleName}`);
            
            const module = await import(`./tools/${moduleName}.js`);
            const moduleDefault = module.default || module;
            
            if (!moduleDefault.id) {
                console.warn(`⚠️ Módulo ${moduleName} não tem ID. Usando nome do arquivo.`);
                moduleDefault.id = moduleName;
            }
            
                        this.modules.set(moduleDefault.id, moduleDefault);
            
                                    if (typeof moduleDefault.handler === 'function' && moduleDefault.id !== 'scene-prompts') {
                this.handlers.set(moduleDefault.id, moduleDefault.handler.bind(moduleDefault));
                console.log(`✅ Handler registrado com ID: ${moduleDefault.id}`);
                
                                const handlerName = this.getHandlerName(moduleDefault.id);
                if (handlerName) {
                    this.handlers.set(handlerName, moduleDefault.handler.bind(moduleDefault));
                    console.log(`✅ Handler registrado com nome: ${handlerName}`);
                }
            } else if (moduleDefault.id === 'scene-prompts') {
                console.log('✅ Módulo scene-prompts carregado (handler está no app-core.js, não registrando aqui)');
            } else if (moduleDefault.id === 'script-writer') {
                console.warn(`⚠️ Módulo script-writer carregado mas handler não é uma função!`, {
                    hasHandler: typeof moduleDefault.handler,
                    handlerType: typeof moduleDefault.handler,
                    handlerValue: moduleDefault.handler
                });
            }
            
            console.log(`✅ Módulo ${moduleDefault.id} carregado com sucesso`);
            
            return moduleDefault;
        } catch (error) {
            console.error(`❌ Erro ao carregar módulo ${moduleName}:`, error);
            throw error;
        }
    }

    
    getHandlerName(moduleId) {
        const mapping = {
            'brainstorm-ideas': 'generate-brainstorm-ideas',
            'viral-titles': 'generate-viral-content',
            'script-writer': 'generate-script',
            'script-translator': 'translate-script',
            'scene-prompts': 'generate-scene-prompts',
            'thumbnail-prompts': 'generate-prompts',
            'image-generator': 'generate-imagefx',
            'voice-generator': 'tts-generate-btn',
            'script-reviewer': 'analyze-script-btn',             'description-optimizer': 'optimize-script-btn',
            'video-optimizer': 'analyze-video-btn',
            'text-splitter': 'split-text-btn',
            'srt-converter': 'convert-to-srt',
            'character-detector': 'detect-characters-btn'
        };
        return mapping[moduleId] || null;
    }

    
    async loadAllModules() {
        if (this.initialized) {
            console.log('⚠️ Módulos já foram inicializados');
            return this.handlers;
        }

        const modulesToLoad = [
            'script-cleaner',             'brainstorm',
            'viral-titles',
            'script-writer',
            'translator',
            'scene-prompts',
            'thumbnail-prompts',
            'image-generator',
            'voice-generator',
            'script-reviewer',
            'description-optimizer',
            'video-optimizer',
            'text-splitter',
            'srt-converter',
            'character-detector',
            'academy',
            'settings',
            'faq',
            'admin',
            'chat'
        ];

        console.log('🚀 Iniciando carregamento de módulos...');

        const loadPromises = modulesToLoad.map(async (moduleName) => {
            try {
                return await this.loadModule(moduleName);
            } catch (error) {
                console.error(`❌ Falha ao carregar ${moduleName}:`, error);
                console.error(`Stack trace:`, error.stack);
                
                                if (moduleName === 'script-writer') {
                    console.error('❌❌❌ ERRO CRÍTICO: Falha ao carregar script-writer!');
                    console.error('Erro completo:', error);
                    console.error('Tentando carregar script-writer com fallback...');
                    
                                        try {
                        const module = await import(`./tools/${moduleName}.js`);
                        const moduleDefault = module.default || module;
                        
                        if (moduleDefault && moduleDefault.id) {
                            this.modules.set(moduleDefault.id, moduleDefault);
                            
                                                        if (typeof moduleDefault.handler === 'function') {
                                this.handlers.set(moduleDefault.id, moduleDefault.handler.bind(moduleDefault));
                                const handlerName = this.getHandlerName(moduleDefault.id);
                                if (handlerName) {
                                    this.handlers.set(handlerName, moduleDefault.handler.bind(moduleDefault));
                                }
                            }
                            
                            console.log('✅ script-writer carregado com fallback (sem módulos modulares)');
                            return moduleDefault;
                        }
                    } catch (fallbackError) {
                        console.error('❌ Falha também no fallback:', fallbackError);
                    }
                }
                
                return null;
            }
        });

        await Promise.all(loadPromises);
        
                if (!this.modules.has('script-writer')) {
            console.error('❌❌❌ MÓDULO script-writer NÃO FOI CARREGADO!');
            console.error('Módulos carregados:', Array.from(this.modules.keys()));
                        try {
                console.log('🔄 Tentando carregar script-writer novamente...');
                await this.loadModule('script-writer');
                console.log('✅ script-writer carregado na segunda tentativa');
            } catch (retryError) {
                console.error('❌ Falha na segunda tentativa de carregar script-writer:', retryError);
            }
        } else {
            console.log('✅ Módulo script-writer confirmado carregado');
            const scriptWriterModule = this.modules.get('script-writer');
            console.log('📋 script-writer module:', {
                id: scriptWriterModule?.id,
                hasHandler: typeof scriptWriterModule?.handler === 'function',
                handlerType: typeof scriptWriterModule?.handler
            });
        }

        this.initialized = true;
        console.log(`✅ ${this.modules.size} módulos carregados com sucesso`);
        console.log(`✅ ${this.handlers.size} handlers registrados`);

        return this.handlers;
    }

    
    getHandler(handlerName) {
        return this.handlers.get(handlerName);
    }

    
    getModule(moduleId) {
        return this.modules.get(moduleId);
    }

    
    getAllHandlers() {
        return Object.fromEntries(this.handlers);
    }

    
    integrateWithExistingHandlers(existingHandlers) {
        console.log('🔗 Integrando módulos com handlers existentes...');
        
        const integratedHandlers = { ...existingHandlers };
        
                for (const [handlerName, handlerFunc] of this.handlers.entries()) {
            if (typeof handlerFunc === 'function') {
                console.log(`✅ Integrando handler: ${handlerName}`);
                integratedHandlers[handlerName] = handlerFunc;
            }
        }
        
        return integratedHandlers;
    }

    
    async initModule(moduleId) {
        const module = this.getModule(moduleId);
        if (module && typeof module.init === 'function') {
            try {
                await module.init();
                console.log(`✅ Módulo ${moduleId} inicializado`);
            } catch (error) {
                console.error(`❌ Erro ao inicializar módulo ${moduleId}:`, error);
            }
        }
    }

    
    listModules() {
        return Array.from(this.modules.keys());
    }
}

window.ModuleLoader = window.ModuleLoader || new ModuleLoader();

if (typeof window !== 'undefined') {
    window.moduleLoader = window.ModuleLoader;
}

export default ModuleLoader;

