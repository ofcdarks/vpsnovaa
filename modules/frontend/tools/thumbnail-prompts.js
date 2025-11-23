

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'thumbnail-prompts',
    name: 'Prompts de Thumbnail',
    icon: 'M2.25 15.75l1.5 1.5a.75.75 0 001.06 0l1.5-1.5M21.75 15.75l-1.5 1.5a.75.75 0 01-1.06 0l-1.5-1.5M19.5 12h-15',
    category: 'media',

    
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
            getLegendForTool,
            checkApiAvailability
        } = utils;

                if (!checkApiAvailability()) {
            return;
        }

                const thumbnailPromptResults = window.thumbnailPromptResults || { data: [], allPromptsText: '', rawPromptsText: '' };
        const appState = window.appState || {};

        const output = document.getElementById('output');
        const title = document.getElementById('thumb-title')?.value.trim();
        const platform = document.getElementById('thumb-platform')?.value;
        const lang = document.getElementById('thumb-lang')?.value;
        const includeText = document.getElementById('thumb-include-text')?.checked;
        const model = document.getElementById('thumbnail-prompts-model-select')?.value;
        
        if (!title || !platform || !lang || !model) { 
            showSuccessToast("Por favor, preencha todos os campos."); 
            return; 
        }

        let textInstruction = includeText 
            ? `O prompt DEVE incluir uma instrucao clara para adicionar um texto curto e impactante na imagem, relacionado ao titulo. ESSE TEXTO DEVE ESTAR NO IDIOMA: "${removeAccents(lang)}".`
            : "O prompt NAO DEVE incluir nenhuma instrucao para adicionar texto. O foco deve ser 100% na composicao visual.";

        let prompt, schema;
        if (model.startsWith('gpt-')) {
            prompt = `Gere 2 prompts em INGLES para thumbnail '${platform}' sobre "${removeAccents(title)}". ${textInstruction} Diretriz: alta resolucao, cores vibrantes, clareza maxima, elementos fortes. JSON: {prompts: [{prompt, score (CTR 0-100), suggestion (PT, curta)}]}.`;
            schema = {
                type: "OBJECT",
                properties: {
                    prompts: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                prompt: { type: "STRING" },
                                score: { type: "NUMBER" },
                                suggestion: { type: "STRING" }
                            },
                            required: ["prompt", "score", "suggestion"]
                        }
                    }
                },
                required: ["prompts"]
            };
        } else {
            prompt = `Gere 2 prompts em INGLES para thumbnail '${platform}' sobre "${removeAccents(title)}". ${textInstruction} Diretriz: alta resolucao, cores vibrantes, clareza maxima, elementos fortes. JSON array: [{prompt, score (CTR 0-100), suggestion (PT, curta)}].`;
            schema = {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        prompt: { type: "STRING" },
                        score: { type: "NUMBER" },
                        suggestion: { type: "STRING" }
                    },
                    required: ["prompt", "score", "suggestion"]
                }
            };
        }
        
        try {
            showProgressModal('A gerar prompts de thumbnail...');
            const result = await apiRequestWithFallback('/api/generate-legacy', 'POST', {prompt, model, schema});
            hideProgressModal();

            console.log('📦 Resposta dos prompts de thumbnail (raw):', result);
            console.log('📦 Tipo de result.data:', typeof result?.data);
            console.log('📦 result.data é array?', Array.isArray(result?.data));
            if (result?.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
                console.log('📦 Chaves em result.data:', Object.keys(result.data));
            }

                        let dataToRender = null;
            if (result && result.data) {
                                if (model.startsWith('gpt-')) {
                                        if (result.data.prompts && Array.isArray(result.data.prompts)) {
                        dataToRender = result.data.prompts;
                        console.log('✅ GPT: dados encontrados em result.data.prompts');
                    } else if (typeof result.data === 'string') {
                                                try {
                            const parsed = JSON.parse(result.data);
                            dataToRender = parsed.prompts || (Array.isArray(parsed) ? parsed : null);
                            console.log('✅ GPT: dados parseados de string JSON');
                        } catch (e) {
                            console.warn('⚠️ GPT: falha ao parsear string JSON:', e);
                                                        try {
                                const cleaned = result.data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                                if (jsonMatch) {
                                    const parsed = JSON.parse(jsonMatch[0]);
                                    dataToRender = parsed.prompts || (Array.isArray(parsed) ? parsed : null);
                                    console.log('✅ GPT: JSON extraído de markdown');
                                }
                            } catch (e2) {
                                console.error('❌ GPT: Falha ao extrair JSON de markdown:', e2);
                            }
                        }
                    } else if (typeof result.data === 'object' && !Array.isArray(result.data)) {
                        // Tentar buscar prompts em diferentes níveis
                        dataToRender = result.data.prompts || result.data.data?.prompts;
                        if (dataToRender) {
                            console.log('✅ GPT: dados encontrados em objeto');
                        } else {
                            // Procurar em todas as propriedades do objeto
                            for (const key in result.data) {
                                if (Array.isArray(result.data[key]) && result.data[key].length > 0) {
                                    const firstItem = result.data[key][0];
                                    if (firstItem && (firstItem.prompt || firstItem.text || firstItem.description)) {
                                        dataToRender = result.data[key];
                                        console.log(`✅ GPT: Array encontrado na chave "${key}"`);
                                        break;
                                    }
                                }
                            }
                        }
                    } else if (Array.isArray(result.data)) {
                        // Se result.data é array direto, usar
                        dataToRender = result.data;
                        console.log('✅ GPT: Array direto encontrado');
                    }
                }
                // Para Claude, verificar especificamente
                else if (model.toLowerCase().includes('claude')) {
                    // Claude pode retornar como objeto com prompts ou como array direto
                    if (result.data.prompts && Array.isArray(result.data.prompts)) {
                        dataToRender = result.data.prompts;
                        console.log('✅ Claude: dados encontrados em result.data.prompts');
                    } else if (Array.isArray(result.data)) {
                        dataToRender = result.data;
                        console.log('✅ Claude: Array direto encontrado');
                    } else if (typeof result.data === 'object' && !Array.isArray(result.data)) {
                        // Tentar buscar prompts em diferentes níveis
                        dataToRender = result.data.prompts || result.data.data?.prompts;
                        if (dataToRender) {
                            console.log('✅ Claude: dados encontrados em objeto');
                        } else if (result.data.data) {
                            if (Array.isArray(result.data.data)) {
                                dataToRender = result.data.data;
                                console.log('✅ Claude: result.data.data encontrado como array');
                            } else if (result.data.data.prompts && Array.isArray(result.data.data.prompts)) {
                                dataToRender = result.data.data.prompts;
                                console.log('✅ Claude: result.data.data.prompts encontrado');
                            }
                        }
                        // Procurar em todas as propriedades do objeto
                        if (!dataToRender) {
                            for (const key in result.data) {
                                if (Array.isArray(result.data[key]) && result.data[key].length > 0) {
                                    const firstItem = result.data[key][0];
                                    if (firstItem && (firstItem.prompt || firstItem.text || firstItem.description)) {
                                        dataToRender = result.data[key];
                                        console.log(`✅ Claude: Array encontrado na chave "${key}"`);
                                        break;
                                    }
                                }
                            }
                        }
                    } else if (typeof result.data === 'string') {
                        // Se result.data é string, tentar parsear
                        try {
                            const parsed = JSON.parse(result.data);
                            if (Array.isArray(parsed)) {
                                dataToRender = parsed;
                                console.log('✅ Claude: dados parseados de string JSON (array)');
                            } else if (parsed.prompts && Array.isArray(parsed.prompts)) {
                                dataToRender = parsed.prompts;
                                console.log('✅ Claude: dados parseados de string JSON (objeto com prompts)');
                            } else if (parsed.data && Array.isArray(parsed.data)) {
                                dataToRender = parsed.data;
                                console.log('✅ Claude: dados parseados de string JSON (objeto com data)');
                            }
                        } catch (e) {
                            console.warn('⚠️ Claude: falha ao parsear string JSON:', e);
                            // Tentar extrair JSON de markdown
                            try {
                                const cleaned = result.data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                                const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
                                if (jsonMatch) {
                                    const parsed = JSON.parse(jsonMatch[0]);
                                    if (Array.isArray(parsed)) {
                                        dataToRender = parsed;
                                    } else if (parsed.prompts && Array.isArray(parsed.prompts)) {
                                        dataToRender = parsed.prompts;
                                    }
                                    console.log('✅ Claude: JSON extraído de markdown');
                                }
                            } catch (e2) {
                                console.error('❌ Claude: Falha ao extrair JSON de markdown:', e2);
                            }
                        }
                    }
                }
                                else if (Array.isArray(result.data)) {
                    dataToRender = result.data;
                    console.log('✅ Array direto encontrado (provavelmente Gemini)');
                }
                                else if (typeof result.data === 'object') {
                                        dataToRender = result.data.prompts || result.data.items || result.data.data;
                    if (dataToRender) {
                        console.log('✅ Array encontrado em propriedade comum (prompts/items/data)');
                    }
                                        if (!dataToRender) {
                        for (const key in result.data) {
                            if (Array.isArray(result.data[key]) && result.data[key].length > 0) {
                                                                const firstItem = result.data[key][0];
                                if (firstItem && (firstItem.prompt || firstItem.text || firstItem.description)) {
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
                        } else if (result.data.data.prompts && Array.isArray(result.data.data.prompts)) {
                            dataToRender = result.data.data.prompts;
                            console.log('✅ result.data.data.prompts encontrado (Claude)');
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
                            dataToRender = parsed.prompts || (Array.isArray(parsed) ? parsed : null);
                        } else if (Array.isArray(parsed)) {
                            dataToRender = parsed;
                        } else if (parsed.prompts) {
                            dataToRender = parsed.prompts;
                        } else if (parsed.data) {
                            if (Array.isArray(parsed.data)) {
                                dataToRender = parsed.data;
                            } else if (parsed.data.prompts) {
                                dataToRender = parsed.data.prompts;
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
                                    dataToRender = parsed.prompts || (Array.isArray(parsed) ? parsed : null);
                                } else if (Array.isArray(parsed)) {
                                    dataToRender = parsed;
                                } else if (parsed.prompts) {
                                    dataToRender = parsed.prompts;
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
                console.error('❌ Resposta da IA não pôde ser processada:', result);
                console.error('❌ Tipo de result.data:', typeof result?.data);
                console.error('❌ result.data:', result?.data);
                console.error('❌ Modelo usado:', model);
                throw new Error("A resposta da IA esta vazia ou em formato incorreto. Verifique o console para mais detalhes.");
            }

            // Atualizar variável global (como no original)
            if (append) thumbnailPromptResults.data.push(...dataToRender);
            else thumbnailPromptResults.data = dataToRender;
            
            thumbnailPromptResults.rawPromptsText = thumbnailPromptResults.data.map(p => p.prompt).filter(Boolean).join('\n');
            appState.lastGeneratedPrompts = thumbnailPromptResults.rawPromptsText;

            let html = dataToRender.map(item => {
                const mainScore = item.score || 0;
                const subScores = { 'Impacto Visual': item.score, 'Clareza': item.score > 10 ? item.score - 5 : item.score };
                return `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start"><div class="flex-1"><div class="flex justify-between items-start"><p class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded flex-1">${item.prompt}</p>${createCopyButton(item.prompt, 'ml-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}</div></div><div class="w-full md:w-56 flex-shrink-0">${renderScoreCard('Potencial de CTR', mainScore, subScores, item.suggestion)}</div></div>`;
            }).join('');
            
            if (append) {
                if (output) output.insertAdjacentHTML('beforeend', html);
            } else {
                const legendContainer = document.getElementById('legend-container');
                if (legendContainer) legendContainer.innerHTML = getLegendForTool('thumbnail-prompts');
                if (output) output.innerHTML = html;
            }
            
            const generateMorePromptsBtn = document.getElementById('generate-more-prompts');
            if (generateMorePromptsBtn) generateMorePromptsBtn.style.display = 'block';
            if(!append) showSuccessToast("Prompts de thumbnail gerados!");
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
        console.log('✅ Módulo Prompts de Thumbnail inicializado');
    }
};
