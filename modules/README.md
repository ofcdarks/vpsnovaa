# Estrutura Modular - DARKSCRIPT AI

## 📁 Organização

Esta aplicação foi refatorada para uma arquitetura modular que facilita manutenção e escalabilidade.

### Estrutura de Diretórios

```
modules/
├── frontend/              # Módulos do frontend (app.js)
│   ├── tools/            # Ferramentas individuais
│   │   ├── brainstorm.js
│   │   ├── script-writer.js
│   │   ├── translator.js
│   │   ├── viral-titles.js
│   │   ├── scene-prompts.js
│   │   ├── imagefx.js
│   │   ├── script-optimizer.js
│   │   ├── video-analyzer.js
│   │   └── tts.js
│   ├── core/             # Core do frontend
│   │   ├── app-core.js
│   │   ├── ui-utils.js
│   │   └── api-client.js
│   └── registry.js       # Registro de módulos
│
├── backend/              # Módulos do backend (server.js)
│   ├── routes/           # Rotas organizadas por funcionalidade
│   │   ├── auth.js
│   │   ├── ai-generation.js
│   │   ├── imagefx.js
│   │   ├── tts.js
│   │   ├── youtube.js
│   │   ├── admin.js
│   │   └── chat.js
│   ├── services/         # Serviços compartilhados
│   │   ├── database.js
│   │   ├── ai-service.js
│   │   ├── auth-service.js
│   │   └── file-service.js
│   └── utils/            # Utilitários
│       ├── json-parser.js
│       ├── token-limits.js
│       └── validators.js
│
└── shared/               # Código compartilhado
    ├── constants.js
    └── config.js
```

## 🚀 Como Adicionar uma Nova Ferramenta

### 1. Criar o módulo frontend
```javascript
// modules/frontend/tools/nova-ferramenta.js
export default {
    id: 'nova-ferramenta',
    name: 'Nova Ferramenta',
    icon: 'M...', // SVG path
    handler: async (params) => {
        // Sua lógica aqui
    },
    render: (container) => {
        // Renderização da UI
    }
};
```

### 2. Registrar no registry
```javascript
// modules/frontend/registry.js
import novaFerramenta from './tools/nova-ferramenta.js';
registerTool(novaFerramenta);
```

### 3. Criar rota backend (se necessário)
```javascript
// modules/backend/routes/nova-ferramenta.js
export default (app, db, services) => {
    app.post('/api/nova-ferramenta', verifyToken, async (req, res) => {
        // Sua lógica aqui
    });
};
```

### 4. Registrar a rota
```javascript
// server.js
import novaFerramentaRoute from './modules/backend/routes/nova-ferramenta.js';
novaFerramentaRoute(app, db, services);
```

## ✅ Benefícios

- ✅ **Manutenção fácil**: Cada ferramenta em seu próprio arquivo
- ✅ **Escalável**: Adicionar novas ferramentas sem quebrar existentes
- ✅ **Testável**: Módulos isolados são mais fáceis de testar
- ✅ **Reutilizável**: Serviços compartilhados evitam duplicação
- ✅ **Compatível**: Mantém banco de dados e estrutura VPS atual

