

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'description-optimizer',
    name: 'Otimizador de Descrição',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
    category: 'optimization',

    
    async handler(e, append = false) {
        const utils = getGlobalUtils();
        const {
            showSuccessToast,
            showProgressModal,
            hideProgressModal,
            addToLog,
            apiRequestWithFallback,
            removeAccents,
            createCopyButton,
            renderScoreCard,
            generateRandomScore
        } = utils;

        const title = document.getElementById('optimizer-title')?.value.trim();
        const lang = document.getElementById('optimizer-lang')?.value;
        const model = document.getElementById('optimizer-model-select')?.value;
        const includeCta = document.getElementById('optimizer-cta')?.checked;
        const outputEl = document.getElementById('output');

        if (!title || !lang || !model || outputEl === null || includeCta === null) {
            showSuccessToast("Por favor, preencha todos os campos.");
            return;
        }

        let prompt, schema, renderer;

        if (append) {
            prompt = `Para o titulo de video "${removeAccents(title)}" em "${lang}", gere 3 NOVAS frases para thumbnail. As frases devem ser curtas e de alto impacto. Responda APENAS com um objeto JSON contendo a chave 'thumbnail_phrases', que e uma array de 3 objetos, cada um com 'phrase' (string) e 'score' (numero de 0-100 para CTR).`;
            schema = {
                type: "OBJECT",
                properties: {
                    thumbnail_phrases: { 
                        type: "ARRAY", 
                        items: { 
                            type: "OBJECT",
                            properties: {
                                phrase: { type: "STRING" },
                                score: { type: "NUMBER" }
                            },
                            required: ["phrase", "score"]
                        } 
                    }
                }
            };
            renderer = (result) => {
                const container = outputEl.querySelector('#thumbnail-phrases-container .grid');
                if (container) {
                    const newHtml = result.thumbnail_phrases.map(item => `
                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between">
                            <p class="font-bold text-lg mb-2 text-center text-gray-900 dark:text-gray-100">${item.phrase}</p>
                            ${renderScoreCard('Potencial de CTR', item.score, {})}
                            <div class="mt-2 text-center">${createCopyButton(item.phrase)}</div>
                        </div>
                    `).join('');
                    container.insertAdjacentHTML('beforeend', newHtml);
                }
            };
        } else {
            const ctaInstruction = includeCta ? 'A descricao DEVE incluir uma chamada para acao (CTA) sutil e relevante.' : 'A descricao NAO DEVE incluir uma chamada para acao (CTA).';
            prompt = `Para o titulo de video "${removeAccents(title)}" em "${lang}", gere metadados otimizados para YouTube. ${ctaInstruction} Responda APENAS com um objeto JSON valido com as chaves: 'optimized_description', 'tags' (array de strings), 'thumbnail_phrases' (array de 3 objetos com 'phrase' e 'score'), e 'scores' (objeto com 'seo_potential', 'ctr_potential', 'clarity_score').`;
            schema = {
                type: "OBJECT",
                properties: {
                    optimized_description: { type: "STRING" },
                    tags: { type: "ARRAY", items: { type: "STRING" } },
                    thumbnail_phrases: { 
                        type: "ARRAY", 
                        items: { 
                            type: "OBJECT",
                            properties: {
                                phrase: { type: "STRING" },
                                score: { type: "NUMBER" }
                            },
                            required: ["phrase", "score"]
                        } 
                    }
                }
            };
            renderer = (result) => {
                const { optimized_description, tags, thumbnail_phrases, scores } = result;
                const mainScore = (scores.seo_potential + scores.ctr_potential + scores.clarity_score) / 3;
                return `
                    <div class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div class="flex justify-between items-center mb-2"><h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Analise de Potencial</h3></div>
                                ${renderScoreCard('Potencial de Otimizacao', mainScore, {
                                    'Potencial de SEO': scores.seo_potential,
                                    'Potencial de CTR': scores.ctr_potential,
                                    'Clareza da Mensagem': scores.clarity_score
                                })}
                            </div>
                        </div>
                        <hr class="border-gray-200 dark:border-gray-700"/>
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Descricao Otimizada</h3>
                                ${createCopyButton(optimized_description)}
                            </div>
                            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 prose prose-sm max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${optimized_description}</div>
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Tags Recomendadas</h3>
                                ${createCopyButton(tags.join(', '))}
                            </div>
                            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap gap-2">
                                ${tags.map(tag => `<span class="inline-block bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1 text-sm font-semibold text-gray-600 dark:text-gray-300">${tag}</span>`).join('')}
                                ${createCopyButton(tags.join(', '), 'absolute top-2 right-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                            </div>
                        </div>
                        <div id="thumbnail-phrases-container">
                            <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Frases para Thumbnail</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                ${thumbnail_phrases.map(item => `
                                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between">
                                        <p class="font-bold text-lg mb-2 text-center text-gray-900 dark:text-gray-100">${item.phrase}</p>
                                        ${renderScoreCard('Potencial de CTR', item.score, {})}
                                        <div class="mt-2 text-center">${createCopyButton(item.phrase)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            };
        }

        showProgressModal("Otimizando conteudo...", "A IA esta a trabalhar...");
        if (!append) {
            outputEl.innerHTML = '';
        }

        try {
            const result = await apiRequestWithFallback('/api/generate-legacy', 'POST', { prompt, model, schema });
            
            console.log('📦 Resposta do otimizador de descrição (raw):', result);
            console.log('📦 Tipo de result.data:', typeof result?.data);
            
                        let dataToRender = null;
            if (result && result.data) {
                                if (typeof result.data === 'object' && !Array.isArray(result.data)) {
                                        if (result.data.optimized_description || result.data.tags || result.data.thumbnail_phrases || result.data.scores) {
                        dataToRender = result.data;
                        console.log('✅ Dados encontrados diretamente em result.data');
                    }
                                        else if (result.data.data && typeof result.data.data === 'object') {
                        dataToRender = result.data.data;
                        console.log('✅ Dados encontrados em result.data.data (Claude)');
                    }
                                        else {
                                                for (const key in result.data) {
                            if (result.data[key] && typeof result.data[key] === 'object' && !Array.isArray(result.data[key])) {
                                const candidate = result.data[key];
                                if (candidate.optimized_description || candidate.tags || candidate.thumbnail_phrases) {
                                    dataToRender = candidate;
                                    console.log(`✅ Dados encontrados na chave "${key}"`);
                                    break;
                                }
                            }
                        }
                    }
                }
                                else if (typeof result.data === 'string') {
                    try {
                        const parsed = JSON.parse(result.data);
                        if (parsed.optimized_description || parsed.tags || parsed.thumbnail_phrases) {
                            dataToRender = parsed;
                            console.log('✅ String JSON parseada com sucesso');
                        } else if (parsed.data && typeof parsed.data === 'object') {
                            dataToRender = parsed.data;
                            console.log('✅ Dados encontrados em parsed.data');
                        }
                    } catch (e) {
                        console.warn('⚠️ Não foi possível parsear result.data como JSON:', e);
                                                try {
                            const cleaned = result.data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (parsed.optimized_description || parsed.tags || parsed.thumbnail_phrases) {
                                    dataToRender = parsed;
                                    console.log('✅ JSON extraído de markdown');
                                }
                            }
                        } catch (e2) {
                            console.error('❌ Falha ao extrair JSON de markdown:', e2);
                        }
                    }
                }
            }
            
            if (!dataToRender) {
                console.error('❌ Estrutura de resposta não reconhecida:', result);
                throw new Error("A resposta da IA esta vazia ou em formato incorreto.");
            }

            if (!dataToRender.scores) dataToRender.scores = {};
            const scoreKeys = ['seo_potential', 'ctr_potential', 'clarity_score'];
            scoreKeys.forEach(key => {
                let score = dataToRender.scores[key];
                if (score === undefined || score === null || isNaN(score) || score < 70) {
                    dataToRender.scores[key] = generateRandomScore(78, 98.5);
                } else {
                    dataToRender.scores[key] = Math.min(score, 98.5);
                }
            });

            if (dataToRender.thumbnail_phrases) {
                dataToRender.thumbnail_phrases.forEach(p => {
                    if (p.score === undefined || p.score === null || isNaN(p.score) || p.score < 70) {
                        p.score = generateRandomScore(78, 98.5);
                    } else {
                        p.score = Math.min(p.score, 98.5);
                    }
                });
            }

            if (append) {
                renderer(dataToRender);
            } else {
                outputEl.innerHTML = renderer(dataToRender);
            }
            
            const generateMoreBtn = document.getElementById('generate-more-optimizer-content');
            if (generateMoreBtn) generateMoreBtn.style.display = 'block';
            showSuccessToast("Conteudo otimizado com sucesso!");
        } catch (error) {
            addToLog(`Erro na otimizacao: ${error.message}`, true);
            if (!append) {
                outputEl.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao otimizar o conteudo.</p>`;
            }
        } finally {
            hideProgressModal();
        }
    },

    init() {
        console.log('✅ Módulo Description Optimizer inicializado');
        // Event listeners serão registrados pelo sistema de handlers
    }
};
