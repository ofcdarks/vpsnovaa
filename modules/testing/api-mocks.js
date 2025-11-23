/**
 * Sistema de Mocks para Testes
 * Simula as respostas das APIs para testar os módulos sem configuração de chaves
 */

// Ativar modo de teste via localStorage ou URL parameter
const TEST_MODE = localStorage.getItem('TEST_MODE') === 'true' || 
                  new URLSearchParams(window.location.search).get('test') === 'true';

// Substituir funções de API quando em modo de teste
if (TEST_MODE) {
    console.log('🧪 MODO DE TESTE ATIVADO - APIs mockadas');
    
    // Mock de apiRequestWithFallback
    if (typeof window.apiRequestWithFallback === 'undefined') {
        window.apiRequestWithFallback = async (url, method, body) => {
            console.log('🧪 [MOCK] apiRequestWithFallback:', { url, method, body });
            await simulateDelay(500); // Simular delay de rede
            
            if (url === '/api/generate-legacy') {
                return mockGenerateLegacy(body);
            }
            
            return { data: null, error: 'Mock endpoint not implemented' };
        };
    }
    
    // Mock de streamApiRequest
    if (typeof window.streamApiRequest === 'undefined') {
        window.streamApiRequest = async (url, body, onChunk, onDone, onError) => {
            console.log('🧪 [MOCK] streamApiRequest:', { url, body });
            
            try {
                if (url === '/api/generate-stream') {
                    await mockGenerateStream(body, onChunk, onDone);
                } else {
                    throw new Error('Mock endpoint not implemented');
                }
            } catch (error) {
                onError?.(error);
            }
        };
    }
    
    // Adicionar função de simulação de delay
    window.simulateDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock para /api/generate-legacy
 */
function mockGenerateLegacy({ prompt, model, schema }) {
    const modelType = model.toLowerCase();
    
    // Brainstorm de Ideias
    if (prompt.includes('ideias de vídeo virais') || prompt.includes('brainstorm')) {
        return {
            data: {
                ideas: [
                    {
                        title: 'Como os Dinossauros Realmente Se Comunicavam (Nova Descoberta Científica)',
                        scores: {
                            potential: 95,
                            originality: 92,
                            impact: 98,
                            search_potential: 88,
                            trends_potential: 90
                        },
                        sub_niches: ['Paleontologia', 'Animais Pré-Históricos', 'Ciência']
                    },
                    {
                        title: '10 Fatos Sobre o Universo Que Vão Explodir Sua Mente',
                        scores: {
                            potential: 93,
                            originality: 85,
                            impact: 96,
                            search_potential: 92,
                            trends_potential: 87
                        },
                        sub_niches: ['Astronomia', 'Ciência', 'Curiosidades']
                    },
                    {
                        title: 'O Mistério Por Trás dos Números Perfeitos (Matemática Fascinante)',
                        scores: {
                            potential: 89,
                            originality: 97,
                            impact: 91,
                            search_potential: 84,
                            trends_potential: 88
                        },
                        sub_niches: ['Matemática', 'Educação', 'Curiosidades']
                    },
                    {
                        title: 'Por Que Nossos Sonhos São Tão Estranhos? Neurociência Explica',
                        scores: {
                            potential: 94,
                            originality: 90,
                            impact: 93,
                            search_potential: 91,
                            trends_potential: 89
                        },
                        sub_niches: ['Psicologia', 'Saúde Mental', 'Ciência']
                    },
                    {
                        title: 'O Segredo Por Trás dos Idiomas Mais Difíceis do Mundo',
                        scores: {
                            potential: 91,
                            originality: 88,
                            impact: 92,
                            search_potential: 87,
                            trends_potential: 85
                        },
                        sub_niches: ['Linguística', 'Educação', 'Cultura']
                    }
                ]
            },
            apiSource: `Mock (${model})`
        };
    }
    
    // Títulos Virais
    if (prompt.includes('titulos virais') || prompt.includes('títulos virais')) {
        const isStructures = prompt.includes('estruturas de título');
        
        if (isStructures) {
            return {
                data: [
                    {
                        structure: '[NUMERO] Coisas Que [DOR] Que Você Precisa Saber AGORA',
                        category: 'Números + Urgencia + DOR',
                        explanation: 'Combine números com urgência e uma dor específica do público'
                    },
                    {
                        structure: 'Por Que [PROBLEMA] e Como Resolver em [TEMPO]',
                        category: 'Pergunta + Benefício + Números',
                        explanation: 'Use pergunta para despertar curiosidade, problema e solução rápida'
                    },
                    {
                        structure: '[SECRETO] Que [AUTORIDADE] Não Quer Que Você Saiba',
                        category: 'Mistério + Autoridade + Controvérsia',
                        explanation: 'Crie mistério com autoridade e um toque de controvérsia'
                    },
                    {
                        structure: '[COMPARAÇÃO]: [ANTES] vs [DEPOIS] (Resultados Reais)',
                        category: 'Comparação + Prova Social',
                        explanation: 'Mostre transformação real através de comparação'
                    }
                ],
                apiSource: `Mock (${model})`
            };
        } else {
            return {
                data: modelType.includes('gpt') ? {
                    titles: [
                        {
                            title: '10 Segredos Sobre o Cérebro Que Cientistas Acabaram de Descobrir',
                            category: 'Números + Mistério + Autoridade',
                            suggestion: 'Combina curiosidade numérica com autoridade científica',
                            scores: { impact: 95, clarity: 92, curiosity: 98 }
                        },
                        {
                            title: 'URGENTE: Nova Descoberta Pode Mudar Tudo O Que Sabíamos',
                            category: 'Urgencia + Mistério + Impacto',
                            suggestion: 'Cria urgência e curiosidade imediata',
                            scores: { impact: 97, clarity: 89, curiosity: 96 }
                        },
                        {
                            title: 'Por Que Esta Única Coisa Está Destruindo Seu Foco?',
                            category: 'Pergunta + Medo + Benefício',
                            suggestion: 'Usa pergunta com medo para engajamento',
                            scores: { impact: 94, clarity: 91, curiosity: 95 }
                        },
                        {
                            title: 'O Método [NOME] Que Está Revolucionando [NICHO]',
                            category: 'Autoridade + Benefício + Tendência',
                            suggestion: 'Demonstra autoridade e tendência do momento',
                            scores: { impact: 96, clarity: 93, curiosity: 92 }
                        }
                    ]
                } : [
                    {
                        title: '10 Segredos Sobre o Cérebro Que Cientistas Acabaram de Descobrir',
                        category: 'Números + Mistério + Autoridade',
                        suggestion: 'Combina curiosidade numérica com autoridade científica',
                        scores: { impact: 95, clarity: 92, curiosity: 98 }
                    },
                    {
                        title: 'URGENTE: Nova Descoberta Pode Mudar Tudo O Que Sabíamos',
                        category: 'Urgencia + Mistério + Impacto',
                        suggestion: 'Cria urgência e curiosidade imediata',
                        scores: { impact: 97, clarity: 89, curiosity: 96 }
                    },
                    {
                        title: 'Por Que Esta Única Coisa Está Destruindo Seu Foco?',
                        category: 'Pergunta + Medo + Benefício',
                        suggestion: 'Usa pergunta com medo para engajamento',
                        scores: { impact: 94, clarity: 91, curiosity: 95 }
                    },
                    {
                        title: 'O Método [NOME] Que Está Revolucionando [NICHO]',
                        category: 'Autoridade + Benefício + Tendência',
                        suggestion: 'Demonstra autoridade e tendência do momento',
                        scores: { impact: 96, clarity: 93, curiosity: 92 }
                    }
                ],
                apiSource: `Mock (${model})`
            };
        }
    }
    
    // Resposta padrão
    return {
        data: { message: 'Mock response - endpoint not specifically mocked' },
        apiSource: `Mock (${model})`
    };
}

/**
 * Mock para /api/generate-stream
 */
async function mockGenerateStream({ prompt, model }, onChunk, onDone) {
    const modelType = model.toLowerCase();
    let simulatedText = '';
    
    // Geração de roteiro
    if (prompt.includes('roteiro') || prompt.includes('DARKSCRIP AI')) {
        simulatedText = `[--PART 1: Introdução Impactante--]

Bem-vindos ao nosso canal! Hoje vamos falar sobre algo que vai mudar completamente sua perspectiva.

Imagine se eu te dissesse que existe uma técnica simples que pode transformar completamente sua produtividade em apenas 30 dias. Parece impossível, não é mesmo? Mas é exatamente isso que vamos descobrir hoje.

Neste vídeo, você vai aprender:
- O segredo que poucas pessoas conhecem
- Como aplicar essa técnica na prática
- Os resultados reais que você pode esperar

Mas antes de começarmos, não esqueça de se inscrever no canal e ativar o sininho para não perder nenhum conteúdo novo!

[--ENDPART--]

[--PART 2: Desenvolvimento Principal--]

Agora vamos mergulhar no conteúdo principal. Essa técnica que vamos compartilhar não é algo novo - na verdade, ela existe há décadas, mas foi recentemente validada por estudos científicos.

O primeiro passo é entender o conceito básico. Quando aplicamos essa técnica corretamente, nosso cérebro começa a criar conexões neurais mais fortes, o que resulta em melhor performance em todas as áreas da vida.

Estudos realizados pela Universidade de Stanford mostraram que pessoas que aplicam essa técnica regularmente têm uma melhoria de até 300% em sua produtividade diária. Não é incrível?

[--ENDPART--]

[--PART 3: Conclusão e CTA--]

Como você viu, essa técnica é realmente poderosa e pode transformar sua vida completamente.

Agora é sua vez de colocar isso em prática! Comece hoje mesmo e você verá resultados em poucos dias.

Se esse conteúdo foi útil para você, deixe seu like e compartilhe com alguém que precisa ver isso. Não esqueça de se inscrever para mais conteúdo como este!

[--ENDPART--]`;
    }
    // Tradução
    else if (prompt.includes('tradutor') || prompt.includes('Traduza')) {
        simulatedText = prompt.includes('Inglês') || prompt.includes('English') 
            ? 'This is a sample translation of the text you provided. The mock system is simulating a real translation response.'
            : 'Esta é uma tradução de exemplo do texto fornecido. O sistema de mock está simulando uma resposta de tradução real.';
    }
    // Outros casos
    else {
        simulatedText = 'Esta é uma resposta simulada do sistema de mock. O texto foi gerado para testes sem necessidade de chaves de API.';
    }
    
    // Simular streaming baseado no tipo de modelo
    if (modelType.includes('gemini')) {
        // Gemini envia texto completo acumulado
        let fullText = '';
        const words = simulatedText.split(' ');
        
        for (let i = 0; i < words.length; i++) {
            fullText += words[i] + (i < words.length - 1 ? ' ' : '');
            
            if (onChunk) {
                onChunk({
                    candidates: [{
                        content: {
                            parts: [{
                                text: fullText
                            }]
                        }
                    }]
                });
            }
            
            await simulateDelay(50); // Simular delay entre chunks
        }
    } else {
        // GPT/Claude enviam incrementalmente
        const words = simulatedText.split(' ');
        
        for (const word of words) {
            const chunk = word + ' ';
            
            if (onChunk) {
                if (modelType.includes('gpt')) {
                    onChunk({
                        choices: [{
                            delta: {
                                content: chunk
                            }
                        }]
                    });
                } else {
                    // Claude
                    onChunk({
                        type: 'content_block_delta',
                        delta: {
                            text: chunk
                        }
                    });
                }
            }
            
            await simulateDelay(30); // Simular delay entre chunks
        }
    }
    
    // Finalizar stream
    if (onDone) {
        await simulateDelay(100);
        onDone(simulatedText);
    }
}

/**
 * Função de delay simulado
 */
function simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Interface para controlar modo de teste
 */
window.TEST_MODE_CONTROLS = {
    enable: () => {
        localStorage.setItem('TEST_MODE', 'true');
        console.log('🧪 Modo de teste ATIVADO. Recarregue a página para aplicar.');
        return true;
    },
    disable: () => {
        localStorage.removeItem('TEST_MODE');
        console.log('🧪 Modo de teste DESATIVADO. Recarregue a página para aplicar.');
        return true;
    },
    status: () => {
        const isEnabled = localStorage.getItem('TEST_MODE') === 'true';
        console.log(`🧪 Modo de teste: ${isEnabled ? 'ATIVADO' : 'DESATIVADO'}`);
        return isEnabled;
    }
};

// Expor para uso global
if (typeof window !== 'undefined') {
    window.TEST_MODE = TEST_MODE;
    window.apiMocks = {
        mockGenerateLegacy,
        mockGenerateStream,
        simulateDelay
    };
}

