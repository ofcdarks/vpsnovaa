# 📝 Passos para Integração dos 4 Módulos

## ✅ Módulos Criados

1. ✅ **Brainstorm de Ideias** - `modules/frontend/tools/brainstorm.js`
2. ✅ **Títulos Virais** - `modules/frontend/tools/viral-titles.js`
3. ✅ **Criador de Roteiro** - `modules/frontend/tools/script-writer.js`
4. ✅ **Tradutor de Roteiros** - `modules/frontend/tools/translator.js`

## 🚀 Passos para Integrar no app.js

### Passo 1: Carregar o Registry e os Módulos

No início do `app.js`, antes dos handlers, adicione:

```javascript
// Carregar módulos modulares (opcional - migração gradual)
if (typeof window.loadAllModules === 'function') {
    window.loadAllModules().catch(err => {
        console.warn('Módulos modulares não carregados, usando handlers originais:', err);
    });
} else {
    // Importar e carregar manualmente
    import('./modules/frontend/registry.js').then(module => {
        window.moduleRegistry = module.default;
        // Carregar módulos individuais
        Promise.all([
            import('./modules/frontend/tools/brainstorm.js'),
            import('./modules/frontend/tools/viral-titles.js'),
            import('./modules/frontend/tools/script-writer.js'),
            import('./modules/frontend/tools/translator.js')
        ]).then(modules => {
            modules.forEach(mod => {
                if (mod.default) {
                    window.moduleRegistry.registerTool(mod.default);
                }
            });
            console.log('✅ Módulos modulares carregados');
        });
    }).catch(err => {
        console.warn('Não foi possível carregar módulos modulares:', err);
    });
}
```

### Passo 2: Atualizar Handlers para Usar Módulos

Nos handlers existentes, adicione suporte para módulos:

```javascript
const handlers = {
    'generate-brainstorm-ideas': async (e, append = false) => {
        // Tentar usar módulo modular primeiro
        if (window.moduleRegistry && window.moduleRegistry.getTool('brainstorm-ideas')) {
            const tool = window.moduleRegistry.getTool('brainstorm-ideas');
            if (tool && typeof tool.handler === 'function') {
                return await tool.handler(e, append);
            }
        }
        
        // Fallback para código original
        // ... código original do handler ...
    },

    'generate-viral-content': async (e, append = false) => {
        // Tentar usar módulo modular primeiro
        if (window.moduleRegistry && window.moduleRegistry.getTool('viral-titles')) {
            const tool = window.moduleRegistry.getTool('viral-titles');
            if (tool && typeof tool.handler === 'function') {
                return await tool.handler(e, append);
            }
        }
        
        // Fallback para código original
        // ... código original do handler ...
    },

    'generate-script': async (e, continueGeneration = false) => {
        // Tentar usar módulo modular primeiro
        if (window.moduleRegistry && window.moduleRegistry.getTool('script-writer')) {
            const tool = window.moduleRegistry.getTool('script-writer');
            if (tool && typeof tool.handler === 'function') {
                return await tool.handler(e, continueGeneration);
            }
        }
        
        // Fallback para código original
        // ... código original do handler ...
    },

    'translate-script': async () => {
        // Tentar usar módulo modular primeiro
        if (window.moduleRegistry && window.moduleRegistry.getTool('script-translator')) {
            const tool = window.moduleRegistry.getTool('script-translator');
            if (tool && typeof tool.handler === 'function') {
                return await tool.handler();
            }
        }
        
        // Fallback para código original
        // ... código original do handler ...
    },

    // ... outros handlers ...
};
```

### Passo 3: Atualizar renderTabContent para Usar Módulos

No `renderTabContent`, use os módulos para renderizar UI:

```javascript
function renderTabContent(tabId) {
    const container = document.getElementById('tab-content');
    if (!container) return;

    // Tentar renderizar via módulo primeiro
    if (window.moduleRegistry) {
        const tool = window.moduleRegistry.getTool(tabId);
        if (tool && typeof tool.render === 'function') {
            tool.render(container);
            // Inicializar se necessário
            if (typeof tool.init === 'function') {
                tool.init();
            }
            return;
        }
    }

    // Fallback para renderização original
    // ... código original de renderização ...
}
```

### Passo 4: Manter Handlers Originais como Fallback

IMPORTANTE: Mantenha o código original dos handlers como fallback durante a migração. Isso garante que a aplicação continue funcionando mesmo se os módulos falharem.

## 🔄 Estratégia de Migração Gradual

### Fase 1: Teste (Atual)
- ✅ Módulos criados
- ✅ Registry criado
- ⏳ Integração no app.js (próximo passo)
- ⏳ Testes isolados de cada módulo

### Fase 2: Integração Híbrida
- [ ] Adicionar código de carregamento de módulos
- [ ] Atualizar handlers para usar módulos com fallback
- [ ] Testar cada ferramenta
- [ ] Validar funcionamento

### Fase 3: Migração Completa
- [ ] Remover código original após validação
- [ ] Otimizar módulos
- [ ] Documentar mudanças

## ⚠️ Notas Importantes

1. **Compatibilidade**: Os módulos usam funções globais existentes (como `showSuccessToast`, `createCopyButton`, etc.). Certifique-se de que essas funções estão disponíveis globalmente.

2. **Fallback**: Sempre mantenha o código original como fallback durante a migração.

3. **Testes**: Teste cada módulo individualmente antes de remover o código original.

4. **Dependências**: Alguns módulos dependem de:
   - `apiRequestWithFallback`
   - `streamApiRequest`
   - `showProgressModal` / `hideProgressModal`
   - `createCopyButton`
   - `renderScoreCard`
   - `generateRandomScore`
   - `removeAccents`
   - `scriptFormulas` (para script-writer)

## 📋 Checklist de Integração

- [ ] Carregar registry no app.js
- [ ] Carregar todos os módulos
- [ ] Atualizar handler `generate-brainstorm-ideas`
- [ ] Atualizar handler `generate-viral-content`
- [ ] Atualizar handler `generate-script`
- [ ] Atualizar handler `translate-script`
- [ ] Atualizar `renderTabContent` para usar módulos
- [ ] Testar Brainstorm de Ideias
- [ ] Testar Títulos Virais
- [ ] Testar Criador de Roteiro
- [ ] Testar Tradutor de Roteiros
- [ ] Validar que fallbacks funcionam
- [ ] Documentar mudanças

## 🎯 Próximos Passos

1. Integrar código de carregamento no app.js
2. Testar cada módulo isoladamente
3. Validar funcionamento completo
4. Remover código antigo após validação

