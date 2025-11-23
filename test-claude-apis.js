/**
 * Script de teste para verificar se todas as ferramentas funcionam com Claude
 * Execute: node test-claude-apis.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_TOKEN = 'test-token'; // Substitua por um token válido se necessário

// Configurações de teste
const testConfig = {
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

// Testes para cada ferramenta
const tests = [
  {
    name: 'Brainstorm de Ideias',
    endpoint: '/api/generate-legacy',
    body: {
      prompt: 'Gere 3 ideias de vídeos virais sobre curiosidades.',
      model: 'claude-sonnet-4',
      schema: {
        type: "OBJECT",
        properties: {
          ideas: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                scores: {
                  type: "OBJECT",
                  properties: {
                    potential: { type: "NUMBER" },
                    originality: { type: "NUMBER" },
                    impact: { type: "NUMBER" },
                    search_potential: { type: "NUMBER" },
                    trends_potential: { type: "NUMBER" }
                  }
                },
                sub_niches: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  minItems: 3,
                  maxItems: 3
                }
              }
            }
          }
        }
      },
      maxOutputTokens: 2000
    }
  },
  {
    name: 'Títulos Virais',
    endpoint: '/api/generate-legacy',
    body: {
      prompt: 'Gere 5 títulos virais sobre investimentos.',
      model: 'claude-sonnet-4',
      schema: {
        type: "OBJECT",
        properties: {
          titles: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                title: { type: "STRING" },
                viral_score: { type: "NUMBER" }
              }
            }
          }
        }
      },
      maxOutputTokens: 2000
    }
  },
  {
    name: 'Prompts de Thumbnail',
    endpoint: '/api/generate-legacy',
    body: {
      prompt: 'Gere 3 prompts de thumbnail para um vídeo sobre gatos.',
      model: 'claude-sonnet-4',
      schema: {
        type: "OBJECT",
        properties: {
          prompts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                prompt: { type: "STRING" },
                description: { type: "STRING" }
              }
            }
          }
        }
      },
      maxOutputTokens: 2000
    }
  }
];

async function runTest(test) {
  console.log(`\n🧪 Testando: ${test.name}`);
  console.log(`   Endpoint: ${test.endpoint}`);
  console.log(`   Modelo: ${test.body.model}`);
  
  try {
    const startTime = Date.now();
    const response = await axios.post(`${BASE_URL}${test.endpoint}`, test.body, testConfig);
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data) {
      console.log(`   ✅ SUCESSO (${duration}ms)`);
      console.log(`   Resposta recebida: ${JSON.stringify(response.data).substring(0, 100)}...`);
      return { success: true, duration, error: null };
    } else {
      console.log(`   ❌ FALHOU: Status ${response.status}`);
      return { success: false, duration, error: `Status ${response.status}` };
    }
  } catch (error) {
    const duration = Date.now() - Date.now();
    if (error.response) {
      console.log(`   ❌ ERRO HTTP ${error.response.status}: ${error.response.data?.error || error.message}`);
      return { success: false, duration, error: `HTTP ${error.response.status}: ${error.response.data?.error || error.message}` };
    } else {
      console.log(`   ❌ ERRO: ${error.message}`);
      return { success: false, duration, error: error.message };
    }
  }
}

async function runAllTests() {
  console.log('🚀 Iniciando testes de integração Claude...\n');
  console.log('⚠️  NOTA: Certifique-se de que o servidor está rodando em http://localhost:3000');
  console.log('⚠️  NOTA: Certifique-se de ter uma chave de API Claude configurada\n');
  
  const results = [];
  
  for (const test of tests) {
    const result = await runTest(test);
    results.push({ name: test.name, ...result });
    // Aguardar um pouco entre testes para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Resumo
  console.log('\n📊 RESUMO DOS TESTES:');
  console.log('='.repeat(50));
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.success ? 'SUCESSO' : 'FALHOU'} (${result.duration}ms)`);
    if (!result.success && result.error) {
      console.log(`   Erro: ${result.error}`);
    }
  });
  
  console.log('='.repeat(50));
  console.log(`✅ Sucessos: ${successful}/${results.length}`);
  console.log(`❌ Falhas: ${failed}/${results.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 Todos os testes passaram!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Alguns testes falharam. Verifique os logs acima.');
    process.exit(1);
  }
}

// Executar testes
runAllTests().catch(error => {
  console.error('❌ Erro ao executar testes:', error);
  process.exit(1);
});

