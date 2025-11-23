

class ModuleRegistry {
    constructor() {
        this.tools = new Map();
        this.routes = new Map();
        this.initialized = false;
    }

    
    registerTool(tool) {
        if (!tool.id || !tool.name || !tool.handler) {
            console.error('❌ Ferramenta inválida:', tool);
            return false;
        }

        this.tools.set(tool.id, tool);
        console.log(`✅ Ferramenta registrada: ${tool.name} (${tool.id})`);
        return true;
    }

    
    registerRoute(routeId, handler) {
        this.routes.set(routeId, handler);
        console.log(`✅ Rota registrada: ${routeId}`);
    }

    
    getTool(toolId) {
        return this.tools.get(toolId);
    }

    
    getAllTools() {
        return Array.from(this.tools.values());
    }

    
    getToolsByCategory(category) {
        return this.getAllTools().filter(tool => tool.category === category);
    }

    
    renderTool(toolId, container) {
        const tool = this.getTool(toolId);
        if (!tool) {
            console.error(`❌ Ferramenta não encontrada: ${toolId}`);
            return false;
        }

        if (typeof tool.render === 'function') {
            tool.render(container);
            if (typeof tool.init === 'function') {
                tool.init();
            }
            return true;
        }

        console.error(`❌ Ferramenta ${toolId} não possui método render`);
        return false;
    }

    
    async executeTool(toolId, ...args) {
        const tool = this.getTool(toolId);
        if (!tool) {
            console.error(`❌ Ferramenta não encontrada: ${toolId}`);
            return false;
        }

        if (typeof tool.handler === 'function') {
            try {
                await tool.handler(...args);
                return true;
            } catch (error) {
                console.error(`❌ Erro ao executar ferramenta ${toolId}:`, error);
                return false;
            }
        }

        console.error(`❌ Ferramenta ${toolId} não possui método handler`);
        return false;
    }

    
    async initialize() {
        if (this.initialized) {
            console.warn('⚠️ Registry já foi inicializado');
            return;
        }

                        
        this.initialized = true;
        console.log(`✅ Module Registry inicializado com ${this.tools.size} ferramentas`);
    }
}

const moduleRegistry = new ModuleRegistry();

if (typeof window !== 'undefined') {
    window.moduleRegistry = moduleRegistry;
}

export default moduleRegistry;

