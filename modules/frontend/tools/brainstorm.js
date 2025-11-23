

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'brainstorm-ideas',
    name: 'Brainstorm de Ideias',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    category: 'creation',
    
    
    render(container) {
                    },

    
    async handler(e, append = false) {
                if (typeof window === 'undefined') {
            console.error('Window não disponível');
            return;
        }

                const devLog = window.devLog || (() => {});
        const showSuccessToast = window.showSuccessToast || ((msg) => console.log(msg));
        const showProgressModal = window.showProgressModal || ((title, msg) => console.log(title, msg));
        const hideProgressModal = window.hideProgressModal || (() => {});
        const addToLog = window.addToLog || ((msg, isError) => console.log(msg, isError));
        const apiRequestWithFallback = window.apiRequestWithFallback;
        const removeAccents = window.removeAccents || ((str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        const getBrainstormPrompt = window.getBrainstormPrompt || ((lang, niche) => {
            return `Como especialista em YouTube, gere 5 ideias de vídeo virais e inéditas em "${lang}" para um canal sobre "${niche}". Formate como títulos de até 100 caracteres. Para cada uma, forneça pontuações (0-100) para 'potential', 'originality', 'impact', 'search_potential', 'trends_potential' e 3 'sub_niches' relacionados. Responda APENAS com um JSON contendo uma chave "ideas", que é uma array de objetos.`;
        });
        const generateRandomScore = window.generateRandomScore || ((min, max) => Math.floor(Math.random() * (max - min + 1)) + min);
        const createCopyButton = window.createCopyButton || ((text, className = '') => {
            return `<button class="${className} copy-btn" data-text="${(text || '').replace(/"/g, '&quot;')}" title="Copiar">📋</button>`;
        });
        const renderScoreCard = window.renderScoreCard || ((title, mainScore, subScores) => {
            return `<div class="text-center"><h4 class="font-semibold text-sm mb-2">${title}</h4><p class="text-3xl font-bold">${mainScore.toFixed(1)}</p></div>`;
        });
        const getLegendForTool = window.getLegendForTool || ((toolId) => '');

        if (!apiRequestWithFallback) {
            console.error('apiRequestWithFallback não disponível');
            showSuccessToast('Erro: API não disponível. Recarregue a página.');
            return;
        }

        const timerId = `brainstorm-${Date.now()}`;
        devLog(`Starting: ${timerId}`);
        if (typeof console !== 'undefined' && console.time) console.time(timerId);

        const niche = document.getElementById('brainstorm-niche')?.value.trim();
        const model = document.getElementById('brainstorm-ideas-model-select')?.value;
        const lang = document.getElementById('brainstorm-lang')?.value;
        const outputEl = document.getElementById('output');

        if (!niche) {
            showSuccessToast("Por favor, insira um nicho para o seu canal.");
            return;
        }
        
        if (!model) {
            showSuccessToast("Por favor, selecione um modelo de IA.");
            return;
        }

        const prompt = getBrainstormPrompt(lang, niche);
        const schema = {
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
        };

        showProgressModal("Gerando ideias virais...", "A IA esta buscando os melhores topicos...");
        if (!append) {
            if (outputEl) outputEl.innerHTML = '';
            const legendContainer = document.getElementById('legend-container');
            if (legendContainer) legendContainer.innerHTML = getLegendForTool('brainstorm-ideas');
        }

        try {
            const result = await apiRequestWithFallback('/api/generate-legacy', 'POST', { prompt, model, schema });
            
            console.log('📦 Resposta do brainstorm (raw):', result);
            console.log('📦 Tipo de result.data:', typeof result?.data);
            console.log('📦 result.data é array?', Array.isArray(result?.data));
            if (result?.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
                console.log('📦 Chaves em result.data:', Object.keys(result.data));
            }
            
                        let ideasData = null;
            if (result && result.data) {
                                if (Array.isArray(result.data)) {
                    ideasData = result.data;
                    console.log('✅ Array direto encontrado (provavelmente Gemini)');
                }
                                else if (result.data.ideas && Array.isArray(result.data.ideas)) {
                    ideasData = result.data.ideas;
                    console.log('✅ result.data.ideas encontrado');
                }
                                else if (typeof result.data === 'object') {
                                        for (const key in result.data) {
                        if (Array.isArray(result.data[key]) && result.data[key].length > 0) {
                                                        const firstItem = result.data[key][0];
                            if (firstItem && (firstItem.title || firstItem.idea || firstItem.name)) {
                                ideasData = result.data[key];
                                console.log(`✅ Array encontrado na chave "${key}"`);
                                break;
                            }
                        }
                    }
                                        if (!ideasData) {
                                                if (result.data.data && result.data.data.ideas && Array.isArray(result.data.data.ideas)) {
                            ideasData = result.data.data.ideas;
                            console.log('✅ result.data.data.ideas encontrado (Claude)');
                        }
                                                else if (result.data.content && Array.isArray(result.data.content)) {
                            ideasData = result.data.content;
                            console.log('✅ result.data.content encontrado (Gemini)');
                        }
                    }
                }
                                else if (typeof result.data === 'string') {
                    try {
                        const parsed = JSON.parse(result.data);
                        console.log('✅ String JSON parseada com sucesso');
                        if (parsed.ideas && Array.isArray(parsed.ideas)) {
                            ideasData = parsed.ideas;
                        } else if (Array.isArray(parsed)) {
                            ideasData = parsed;
                        } else if (parsed.data && Array.isArray(parsed.data)) {
                            ideasData = parsed.data;
                        } else if (parsed.data && parsed.data.ideas && Array.isArray(parsed.data.ideas)) {
                            ideasData = parsed.data.ideas;
                        }
                    } catch (e) {
                        console.warn('⚠️ Não foi possível parsear result.data como JSON:', e);
                                                try {
                            const cleaned = result.data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                            const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
                            if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (parsed.ideas && Array.isArray(parsed.ideas)) {
                                    ideasData = parsed.ideas;
                                } else if (Array.isArray(parsed)) {
                                    ideasData = parsed;
                                }
                                console.log('✅ JSON extraído de markdown');
                            }
                        } catch (e2) {
                            console.error('❌ Falha ao extrair JSON de markdown:', e2);
                        }
                    }
                }
            }
            
            if (ideasData && ideasData.length > 0) {
                ideasData.forEach(idea => {
                    if (!idea.scores) idea.scores = {};
                    const scoreKeys = ['potential', 'originality', 'impact', 'search_potential', 'trends_potential'];
                    scoreKeys.forEach(key => {
                        let score = idea.scores[key];
                        if (score === undefined || score === null || isNaN(score) || score < 70) {
                            idea.scores[key] = generateRandomScore(78, 98.5);
                        } else {
                            idea.scores[key] = Math.min(score, 98.5);
                        }
                    });
                });

                const ideasHtml = ideasData.map(item => {
                    const scores = item.scores || {};
                    const potential = scores.potential || 0;
                    const originality = scores.originality || 0;
                    const impact = scores.impact || 0;
                    const search_potential = scores.search_potential || 0;
                    const trends_potential = scores.trends_potential || 0;

                    const mainScore = (potential + originality + impact + search_potential + trends_potential) / 5;
                    const subNichesHtml = item.sub_niches && item.sub_niches.length > 0 
                        ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Sub-nichos: ${item.sub_niches.map(sn => `<span class="inline-block bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300 mr-1">${sn}</span>`).join('')}</p>`
                        : '';
                    return `
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start">
                        <div class="flex-1 w-full">
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="font-semibold text-lg text-gray-900 dark:text-gray-100">${item.title || 'N/A'}</h3>
                                ${createCopyButton(item.title || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                            </div>
                            ${subNichesHtml}
                        </div>
                        <div class="w-full md:w-56 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0">
                            ${renderScoreCard('Analise da Ideia', mainScore, {
                                'Potencial': potential,
                                'Originalidade': originality,
                                'Impacto': impact,
                                'Busca Google': search_potential,
                                'Tendencias Google': trends_potential
                            })}
                        </div>
                    </div>`;
                }).join('');

                if (append) {
                    if (outputEl) outputEl.insertAdjacentHTML('beforeend', ideasHtml);
                } else {
                    if (outputEl) outputEl.innerHTML = ideasHtml;
                }
                const generateMoreBrainstormIdeasBtn = document.getElementById('generate-more-brainstorm-ideas');
                if (generateMoreBrainstormIdeasBtn) generateMoreBrainstormIdeasBtn.style.display = 'block';
                showSuccessToast("Ideias geradas com sucesso!");
            } else {
                console.error('❌ Nenhuma ideia válida encontrada na resposta:', result);
                throw new Error("A IA nao retornou ideias validas. Verifique o console para mais detalhes.");
            }
        } catch (error) {
            addToLog(`Erro ao gerar ideias: ${error.message}`, true);
            if (!append) {
                if (outputEl) outputEl.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao gerar as ideias.</p>`;
            }
        } finally {
            hideProgressModal();
            if (typeof console !== 'undefined' && console.timeEnd) console.timeEnd(timerId);
            devLog(`Finished: ${timerId}. Chars in prompt: ${prompt.length}`);
        }
    },

    /**
     * Inicialização do módulo (opcional)
     */
    init() {
        console.log('✅ Módulo Brainstorm de Ideias inicializado');
    }
};
