# Sistema de Testes para Módulos

Este diretório contém o sistema de testes e mocks para testar os módulos sem necessidade de configurar chaves de API.

## Como Usar

### Opção 1: Página de Teste Dedicada

1. Abra `test-modules.html` no navegador
2. Clique em "Ativar Modo de Teste"
3. Recarregue a página (F5)
4. Clique em "Executar Testes"

### Opção 2: Via Console do Navegador

1. Abra a aplicação principal (index.html)
2. Abra o console do navegador (F12)
3. Execute:

```javascript
// Ativar modo de teste
localStorage.setItem('TEST_MODE', 'true');
location.reload();

// Após recarregar, executar testes
import('./modules/testing/test-runner.js').then(() => {
    ModuleTester.runAll();
});
```

### Opção 3: Via URL Parameter

Adicione `?test=true` na URL:
```
http://localhost:3000/?test=true
```

## Arquivos

- **`api-mocks.js`**: Simula as respostas das APIs (generate-legacy, generate-stream)
- **`test-runner.js`**: Executa testes automatizados nos módulos
- **`test-modules.html`**: Página de teste com interface visual

## Funcionalidades dos Mocks

### Mock de `apiRequestWithFallback`

Simula respostas para:
- Brainstorm de ideias
- Títulos virais
- Estruturas de título

### Mock de `streamApiRequest`

Simula streaming para:
- Geração de roteiros
- Tradução de textos
- Suporte a GPT, Claude e Gemini

## Controles Disponíveis

```javascript
// Ativar modo de teste
TEST_MODE_CONTROLS.enable();

// Desativar modo de teste
TEST_MODE_CONTROLS.disable();

// Verificar status
TEST_MODE_CONTROLS.status();

// Executar todos os testes
ModuleTester.runAll();

// Testar módulo específico
ModuleTester.testModule('brainstorm');
```

## Respostas Mockadas

### Brainstorm
Retorna 5 ideias com scores e sub-nichos predefinidos.

### Títulos Virais
Retorna 4 títulos ou estruturas com categorias e scores.

### Geração de Roteiro
Retorna um roteiro de 3 partes com estrutura completa.

### Tradução
Retorna texto traduzido baseado no idioma solicitado.

## Notas

- Os mocks incluem delays simulados para parecer mais realista
- O modo de teste pode ser desativado a qualquer momento
- Os testes verificam estrutura, carregamento e funcionalidade básica
- Use o console do navegador para logs detalhados

