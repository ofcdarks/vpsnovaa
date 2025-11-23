# 🔌 Exemplo de Integração - Como Usar os Módulos

## Backend: Integrar Rotas Modulares

### 1. No server.js atual, adicione no início:

```javascript
// Importar serviços modulares
const DatabaseService = require('./modules/backend/services/database');
const AIService = require('./modules/backend/services/ai-service');

// Importar rotas modulares (opcional - migração gradual)
// const aiGenerationRoutes = require('./modules/backend/routes/ai-generation');
```

### 2. Inicializar serviços:

```javascript
// Substituir ou complementar db existente
const db = new DatabaseService(process.env.DB_PATH || path.join(__dirname, 'darkscript.db'));
await db.connect();
await db.initializeTables();

// Criar serviço de IA
const aiService = new AIService();

const services = {
    db,
    aiService
};
```

### 3. Registrar rotas modulares (gradualmente):

```javascript
// Opção 1: Usar rotas modulares (novo)
// aiGenerationRoutes(app, db, services);

// Opção 2: Manter rotas antigas (atual)
app.post('/api/generate-stream', verifyToken, async (req, res) => {
    // Código atual...
});

// Opção 3: Híbrido - usar serviço modular mas manter estrutura
app.post('/api/generate-stream', verifyToken, async (req, res) => {
    // Usar aiService ao invés de código inline
    const stream = await aiService.generateStream(model, prompt, options);
    stream.pipe(res);
});
```

## Frontend: Integrar Ferramentas Modulares

### 1. No app.js, adicione no início:

```javascript
// Importar registry (se usando ES modules)
// import moduleRegistry from './modules/frontend/registry.js';

// Ou usar global (se CommonJS)
// O registry já está disponível globalmente se carregado
```

### 2. Carregar módulos:

```javascript
// Opção 1: Carregar módulo específico
const translatorModule = await import('./modules/frontend/tools/translator.js');
window.moduleRegistry.registerTool(translatorModule.default);

// Opção 2: Carregar todos os módulos de uma vez
async function loadAllModules() {
    const modules = [
        await import('./modules/frontend/tools/translator.js'),
        // ... outros módulos
    ];
    
    modules.forEach(module => {
        window.moduleRegistry.registerTool(module.default);
    });
}
```

### 3. Usar módulos nos handlers:

```javascript
// Opção 1: Usar registry diretamente
'translate-script': async () => {
    await window.moduleRegistry.executeTool('script-translator');
}

// Opção 2: Híbrido - usar módulo mas manter compatibilidade
'translate-script': async () => {
    const tool = window.moduleRegistry.getTool('script-translator');
    if (tool) {
        await tool.handler();
    } else {
        // Fallback para código antigo
        // ... código original ...
    }
}
```

## Exemplo Completo: Migração Gradual do Translator

### Passo 1: Manter código atual funcionando

```javascript
// app.js - handlers
'translate-script': async () => {
    // Código atual continua funcionando
    // ...
}
```

### Passo 2: Adicionar módulo em paralelo

```javascript
// Carregar módulo
const translatorModule = await import('./modules/frontend/tools/translator.js');
window.moduleRegistry.registerTool(translatorModule.default);

// Handler pode usar módulo ou código antigo
'translate-script': async () => {
    const useModule = true; // Flag para testar
    
    if (useModule && window.moduleRegistry.getTool('script-translator')) {
        await window.moduleRegistry.executeTool('script-translator');
    } else {
        // Código antigo como fallback
        // ...
    }
}
```

### Passo 3: Validar e remover código antigo

```javascript
// Após validação completa
'translate-script': async () => {
    await window.moduleRegistry.executeTool('script-translator');
}
```

## Estrutura Híbrida Recomendada

Durante a migração, use esta estrutura:

```
app.js
├── Código antigo (mantido)
├── Importação de módulos (novo)
├── Registry (novo)
└── Handlers
    ├── Usar módulo se disponível (novo)
    └── Fallback para código antigo (mantido)
```

## Benefícios da Abordagem Gradual

1. ✅ **Sem downtime**: Aplicação continua funcionando
2. ✅ **Teste incremental**: Valida cada módulo antes de remover código antigo
3. ✅ **Rollback fácil**: Se algo der errado, desativa flag e volta ao código antigo
4. ✅ **Baixo risco**: Migração controlada e testada

## Checklist de Integração

Para cada módulo integrado:

- [ ] Módulo criado e testado isoladamente
- [ ] Serviços necessários disponíveis
- [ ] Handler atualizado para usar módulo
- [ ] Fallback para código antigo mantido
- [ ] Testado em ambiente de desenvolvimento
- [ ] Validado funcionamento completo
- [ ] Código antigo removido (após validação)

## Próximos Passos

1. Testar estrutura criada
2. Integrar primeiro módulo (translator)
3. Validar funcionamento
4. Continuar migração gradual

