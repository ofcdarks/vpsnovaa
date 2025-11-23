


let modulesLoaded = false;


async function loadAllModules() {
    if (modulesLoaded) {
        console.log('⚠️ Módulos já foram carregados');
        return;
    }

    try {
                if (typeof window.moduleRegistry === 'undefined') {
            console.warn('⚠️ ModuleRegistry não está disponível. Carregando...');
                        const { default: moduleRegistry } = await import('./registry.js');
            window.moduleRegistry = moduleRegistry;
        }

                const brainstormModule = await import('./tools/brainstorm.js');
        const viralTitlesModule = await import('./tools/viral-titles.js');
        const scriptWriterModule = await import('./tools/script-writer.js');
        const translatorModule = await import('./tools/translator.js');

                window.moduleRegistry.registerTool(brainstormModule.default);
        window.moduleRegistry.registerTool(viralTitlesModule.default);
        window.moduleRegistry.registerTool(scriptWriterModule.default);
        window.moduleRegistry.registerTool(translatorModule.default);

        modulesLoaded = true;
        console.log('✅ Todos os módulos foram carregados e registrados');

                if (typeof window.moduleRegistry !== 'undefined' && window.moduleRegistry.initialized) {
            window.moduleRegistry.getAllTools().forEach(tool => {
                if (typeof tool.init === 'function') {
                    tool.init();
                }
            });
        }
    } catch (error) {
        console.error('❌ Erro ao carregar módulos:', error);
            }
}


function loadAllModulesCommonJS() {
    if (modulesLoaded) {
        return;
    }

    try {
                const brainstormModule = require('./tools/brainstorm.js');
        const viralTitlesModule = require('./tools/viral-titles.js');
        const scriptWriterModule = require('./tools/script-writer.js');
        const translatorModule = require('./tools/translator.js');

                if (typeof window.moduleRegistry !== 'undefined') {
            window.moduleRegistry.registerTool(brainstormModule.default || brainstormModule);
            window.moduleRegistry.registerTool(viralTitlesModule.default || viralTitlesModule);
            window.moduleRegistry.registerTool(scriptWriterModule.default || scriptWriterModule);
            window.moduleRegistry.registerTool(translatorModule.default || translatorModule);

            modulesLoaded = true;
            console.log('✅ Módulos carregados via CommonJS');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar módulos (CommonJS):', error);
    }
}


if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
                                    if (typeof import !== 'undefined') {
                loadAllModules().catch(console.error);
            } else {
                loadAllModulesCommonJS();
            }
        });
    } else {
                if (typeof import !== 'undefined') {
            loadAllModules().catch(console.error);
        } else {
            loadAllModulesCommonJS();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadAllModules,
        loadAllModulesCommonJS
    };
}

export { loadAllModules, loadAllModulesCommonJS };

window.loadAllModules = loadAllModules;

