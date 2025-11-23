

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'viral-titles',
    name: 'Títulos Virais',
    icon: 'M15 15l-2 5L9 9l5-2 2 5z',
    category: 'creation',
    
    
    render(container) {
            },

    
    async handler(e, append = false) {
                const utils = getGlobalUtils();
        const {
            showSuccessToast,
            showProgressModal,
            hideProgressModal,
            addToLog,
            apiRequestWithFallback,
            removeAccents,
            generateRandomScore,
            createCopyButton,
            renderScoreCard,
            getLegendForTool,
            checkApiAvailability
        } = utils;

                if (!checkApiAvailability()) {
            return;
        }

        const output = document.getElementById('output');
        const topic = document.getElementById('viral-topic')?.value.trim();
        const type = document.getElementById('viral-type')?.value;
        const lang = document.getElementById('viral-lang')?.value;
        const model = document.getElementById('viral-titles-model-select')?.value;
        
        if (!topic || !type || !lang || !model) { 
            showSuccessToast("Por favor, preencha todos os campos."); 
            return; 
        }

        let prompt, schema, renderer;
        if (type === 'titles') {
            let jsonInstruction = `Responda APENAS com uma array de objetos JSON, cada um com: 'title', 'category' (OBRIGATORIO: nome exato dos modelos/formulas combinados, ex: "Curiosidade + Urgencia + Controvérsia"), 'suggestion' (1 frase explicando a psicologia), e 'scores' (objeto com as chaves em ingles 'impact', 'clarity', 'curiosity' de 0-100). IMPORTANTE: O campo 'category' DEVE conter os nomes das formulas/modelos usados, nunca "N/A" ou vazio.`;
            if (model.startsWith('gpt-')) {
                jsonInstruction = `Responda APENAS com um objeto JSON contendo uma unica chave "titles", que e uma array de objetos. Cada objeto deve ter: 'title', 'category' (OBRIGATORIO: nome exato dos modelos/formulas combinados, ex: "Curiosidade + Urgencia + Controvérsia"), 'suggestion' (1 frase explicando a psicologia), e 'scores' (objeto com as chaves em ingles 'impact', 'clarity', 'curiosity' de 0-100). IMPORTANTE: O campo 'category' DEVE conter os nomes das formulas/modelos usados, nunca "N/A" ou vazio.`;
            }
            prompt = `Crie 4 titulos virais em "${removeAccents(lang)}" sobre "${removeAccents(topic)}". Max 100 chars por titulo. Combine 2-4 formulas por titulo.

FORMULAS DISPONIVEIS: Curiosidade, Urgencia, Controvérsia, Números, Pergunta, Emoção, Medo, Benefício, Escândalo, Mistério, Comparação, Autoridade.

REGRAS CRITICAS:
- Campo 'category' OBRIGATORIO: nome das formulas combinadas separadas por " + " (ex: "Curiosidade + Urgencia")
- NUNCA use "N/A" ou deixe 'category' vazio
- Seja CONCISO: titulos curtos, formulas claras
- Priorize completar TODOS os 4 titulos com suas formulas

${jsonInstruction}`;
            schema = { 
                type: "ARRAY", 
                items: { 
                    type: "OBJECT", 
                    properties: { 
                        title: { type: "STRING" }, 
                        category: { type: "STRING" }, 
                        suggestion: { type: "STRING" }, 
                        scores: { 
                            type: "OBJECT", 
                            properties: { 
                                impact: { type: "NUMBER" }, 
                                clarity: { type: "NUMBER" }, 
                                curiosity: { type: "NUMBER" } 
                            } 
                        } 
                    } 
                } 
            };
            renderer = (result) => result.map(item => {
                const scores = item.scores || {};
                const impact = scores.impact || 0;
                const clarity = scores.clarity || 0;
                const curiosity = scores.curiosity || 0;
                const mainScore = (impact + clarity + curiosity) / 3;
                const subScores = { 'Impacto': impact, 'Clareza': clarity, 'Curiosidade': curiosity };
                                const category = item.category && item.category.trim() && item.category !== 'N/A' 
                    ? item.category.trim() 
                    : 'Fórmula não especificada';
                return `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start"><div class="flex-1 w-full"><div class="flex justify-between items-center mb-2"><h3 class="font-semibold text-lg text-gray-900 dark:text-gray-100">${item.title || 'N/A'}</h3>${createCopyButton(item.title || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}</div><div class="flex items-center gap-2"><span class="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full dark:bg-blue-900/20 dark:text-blue-300">${category}</span></div></div><div class="w-full md:w-56 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0">${renderScoreCard('Potencial de Cliques', mainScore, subScores, item.suggestion || '')}</div></div>`;
            }).join('');
        } else {             let jsonInstruction = `Responda APENAS com uma array de objetos JSON, cada um com: 'structure', 'category' (OBRIGATORIO: nome exato dos modelos/formulas combinados, ex: "Curiosidade + Urgencia + Controvérsia"), e 'explanation' (1 frase de como usar). IMPORTANTE: O campo 'category' DEVE conter os nomes das formulas/modelos usados, nunca "N/A" ou vazio.`;
            if (model.startsWith('gpt-')) {
                jsonInstruction = `Responda APENAS com um objeto JSON contendo uma unica chave "structures", que e uma array de objetos. Cada objeto deve ter: 'structure', 'category' (OBRIGATORIO: nome exato dos modelos/formulas combinados, ex: "Curiosidade + Urgencia + Controvérsia"), e 'explanation' (1 frase de como usar). IMPORTANTE: O campo 'category' DEVE conter os nomes das formulas/modelos usados, nunca "N/A" ou vazio.`;
            }
            prompt = `Crie 4 estruturas de titulo em "${removeAccents(lang)}" sobre "${removeAccents(topic)}". Use placeholders [DOR], [NUMERO]. Combine 2-4 formulas por estrutura.

FORMULAS DISPONIVEIS: Curiosidade, Urgencia, Controvérsia, Números, Pergunta, Emoção, Medo, Benefício, Escândalo, Mistério, Comparação, Autoridade.

REGRAS CRITICAS:
- Campo 'category' OBRIGATORIO: nome das formulas combinadas separadas por " + " (ex: "Curiosidade + Urgencia")
- NUNCA use "N/A" ou deixe 'category' vazio
- Seja CONCISO: estruturas claras, formulas identificadas
- Priorize completar TODAS as 4 estruturas com suas formulas

${jsonInstruction}`;
            schema = { 
                type: "ARRAY", 
                items: { 
                    type: "OBJECT", 
                    properties: { 
                        structure: { type: "STRING" }, 
                        category: { type: "STRING" }, 
                        explanation: { type: "STRING" } 
                    } 
                } 
            };
            renderer = (result) => result.map(item => {
                                const category = item.category && item.category.trim() && item.category !== 'N/A' 
                    ? item.category.trim() 
                    : 'Fórmula não especificada';
                return `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"><div class="flex justify-between items-start mb-2"><h3 class="font-semibold text-lg text-gray-900 dark:text-gray-100 flex-1">${item.structure || 'N/A'}</h3>${createCopyButton(item.structure || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}</div><div class="flex items-center gap-2 mb-3"><span class="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full dark:bg-green-900/20 dark:text-green-300">${category}</span></div><p class="text-sm text-gray-600 dark:text-gray-300">${item.explanation || ''}</p></div>`;
            }).join('');
        }
        
        try {
            showProgressModal('A gerar conteudo...', 'A comunicar com a IA...');
            const result = await apiRequestWithFallback('/api/generate-legacy', 'POST', { prompt, model, schema });
            hideProgressModal();

            console.log('📦 Resposta dos títulos virais (raw):', result);
            console.log('📦 Tipo de result.data:', typeof result?.data);
            console.log('📦 result.data é array?', Array.isArray(result?.data));
            if (result?.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
                console.log('📦 Chaves em result.data:', Object.keys(result.data));
            }

                        let dataToRender = null;
            if (result && result.data) {
                                if (model.startsWith('gpt-')) {
                    dataToRender = result.data.titles || result.data.structures;
                    console.log('✅ GPT: dados encontrados em result.data.titles ou result.data.structures');
                }
                                else if (Array.isArray(result.data)) {
                    dataToRender = result.data;
                    console.log('✅ Array direto encontrado (provavelmente Gemini)');
                }
                                else if (typeof result.data === 'object') {
                                        dataToRender = result.data.titles || result.data.structures || result.data.ideas || result.data.items;
                    if (dataToRender) {
                        console.log('✅ Array encontrado em propriedade comum (titles/structures/ideas/items)');
                    }
                                        if (!dataToRender) {
                        for (const key in result.data) {
                            if (Array.isArray(result.data[key]) && result.data[key].length > 0) {
                                                                const firstItem = result.data[key][0];
                                if (firstItem && (firstItem.title || firstItem.structure || firstItem.category)) {
                                    dataToRender = result.data[key];
                                    console.log(`✅ Array encontrado na chave "${key}"`);
                                    break;
                                }
                            }
                        }
                    }
                                        if (!dataToRender && result.data.data) {
                        if (Array.isArray(result.data.data)) {
                            dataToRender = result.data.data;
                            console.log('✅ result.data.data encontrado como array (Claude)');
                        } else if (result.data.data.titles || result.data.data.structures) {
                            dataToRender = result.data.data.titles || result.data.data.structures;
                            console.log('✅ result.data.data.titles/structures encontrado (Claude)');
                        }
                    }
                                        if (!dataToRender && result.data.content && Array.isArray(result.data.content)) {
                        dataToRender = result.data.content;
                        console.log('✅ result.data.content encontrado (Gemini)');
                    }
                }
                                else if (typeof result.data === 'string') {
                    try {
                        const parsed = JSON.parse(result.data);
                        console.log('✅ String JSON parseada com sucesso');
                        if (model.startsWith('gpt-')) {
                            dataToRender = parsed.titles || parsed.structures;
                        } else if (Array.isArray(parsed)) {
                            dataToRender = parsed;
                        } else if (parsed.titles || parsed.structures || parsed.ideas) {
                            dataToRender = parsed.titles || parsed.structures || parsed.ideas;
                        } else if (parsed.data) {
                            if (Array.isArray(parsed.data)) {
                                dataToRender = parsed.data;
                            } else if (parsed.data.titles || parsed.data.structures) {
                                dataToRender = parsed.data.titles || parsed.data.structures;
                            }
                        }
                    } catch (e) {
                        console.warn('⚠️ Não foi possível parsear result.data como JSON:', e);
                                                try {
                            const cleaned = result.data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                            const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
                            if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (model.startsWith('gpt-')) {
                                    dataToRender = parsed.titles || parsed.structures;
                                } else if (Array.isArray(parsed)) {
                                    dataToRender = parsed;
                                } else if (parsed.titles || parsed.structures) {
                                    dataToRender = parsed.titles || parsed.structures;
                                }
                                console.log('✅ JSON extraído de markdown');
                            }
                        } catch (e2) {
                            console.error('❌ Falha ao extrair JSON de markdown:', e2);
                        }
                    }
                }
            }
            
            if (!dataToRender || !Array.isArray(dataToRender) || dataToRender.length === 0) {
                console.error('Resposta da IA:', result);
                throw new Error("A resposta da IA esta vazia ou em formato incorreto.");
            }
            
            if (type === 'titles') {
                dataToRender.forEach(item => {
                    if (!item.scores) item.scores = {};
                    const scoreKeys = ['impact', 'clarity', 'curiosity'];
                    scoreKeys.forEach(key => {
                        let score = item.scores[key];
                        if (score === undefined || score === null || isNaN(score) || score < 70) {
                            item.scores[key] = generateRandomScore(75, 95);
                        } else {
                            item.scores[key] = Math.min(score, 100);
                        }
                    });
                });
            }

            let html = renderer(dataToRender);
            if (append) {
                if (output) output.insertAdjacentHTML('beforeend', html);
            } else {
                const legendContainer = document.getElementById('legend-container');
                if (legendContainer) legendContainer.innerHTML = getLegendForTool('viral-titles');
                if (output) output.innerHTML = html;
            }
            const generateMoreViralContentBtn = document.getElementById('generate-more-viral-content');
            if (generateMoreViralContentBtn) generateMoreViralContentBtn.style.display = 'block';
            if(!append) showSuccessToast("Conteudo gerado!");
        } catch (error) {
            hideProgressModal();
            console.error(error);
            addToLog(error.message, true);
            if (output) output.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao gerar o conteudo.</p>`;
        }
    },

    /**
     * Inicialização do módulo (opcional)
     */
    init() {
        console.log('✅ Módulo Títulos Virais inicializado');
    }
};
