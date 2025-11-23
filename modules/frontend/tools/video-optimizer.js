

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'video-optimizer',
    name: 'Otimizador de Vídeo',
    icon: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z',
    category: 'optimization',

    
    async handler() {
        const utils = getGlobalUtils();
        const {
            showSuccessToast,
            showProgressModal,
            hideProgressModal,
            addToLog,
            apiRequestWithFallback,
            apiRequest,
            removeAccents,
            createCopyButton,
            renderScoreCard,
            generateRandomScore
        } = utils;

        const videoUrlInput = document.getElementById('video-url-input');
        const videoUrl = videoUrlInput?.value.trim();
        const model = document.getElementById('video-optimizer-model-select')?.value;
        const outputEl = document.getElementById('output');
    
        if (!videoUrl || !model) {
            showSuccessToast("Por favor, insira a URL do vídeo do YouTube e selecione um modelo de IA.");
            return;
        }
    
        outputEl.innerHTML = '';         showProgressModal("Analisando vídeo...", "A IA está a buscar detalhes e gerar otimizações...");
    
        try {
                                    const isGemini = model && model.toLowerCase().includes('gemini');
            let videoDetails;
            try {
                videoDetails = await apiRequest('/api/youtube/details-v3', 'POST', { 
                    url: videoUrl,
                    useGemini: isGemini,                     model: model                 });
            } catch (error) {
                                const errorMsg = error.message || '';
                if (errorMsg.includes('não configurada') || errorMsg.includes('não encontrada')) {
                    throw new Error(`Não foi possível obter os detalhes do vídeo: O sistema tentou usar a API do YouTube e GPT-4, mas nenhuma chave de API está configurada. Por favor, configure pelo menos uma chave de API (YouTube ou GPT-4) nas Configurações.`);
                }
                                throw new Error(`Não foi possível obter os detalhes do vídeo: ${errorMsg || 'Erro desconhecido'}`);
            }
    
            if (!videoDetails || !videoDetails.title) {
                throw new Error("Não foi possível obter os detalhes do vídeo do YouTube. Verifique a URL e tente novamente.");
            }
            
                        if (videoDetails.source === 'scraping_gpt4') {
                console.log("ℹ️ Dados extraídos via scraping + GPT-4 (sem API do YouTube)");
                addToLog("ℹ️ Dados extraídos via scraping e IA - algumas estatísticas podem ser estimadas", false);
            } else if (videoDetails.source === 'gpt4_estimation') {
                console.log("ℹ️ Dados estimados usando GPT-4 (sem API do YouTube)");
                addToLog("ℹ️ Dados estimados usando IA (GPT-4) - algumas informações podem não estar disponíveis", false);
            }
    
                        const optimizationPrompt = `Especialista SEO YouTube. Analise video e sugira otimizacoes. Titulo: 3-5 variacoes (CTR+SEO). Descricao: 500-1000 chars, SEO, gancho, CTA. Tags: 10-15 relevantes. Pontuacoes: 0-100 para SEO e CTR (original e sugestoes). JSON: {original_title, original_description, original_tags, original_scores: {seo_potential, ctr_potential}, suggested_titles[], suggested_description, suggested_tags[], new_scores: {seo_potential, ctr_potential}}.

VIDEO:
Titulo: "${removeAccents(videoDetails.title)}"
Descricao: "${removeAccents(videoDetails.description)}"
                Tags: ${(videoDetails.tags && Array.isArray(videoDetails.tags) ? videoDetails.tags : []).join(', ')}
                Canal: "${removeAccents(videoDetails.channelTitle || 'N/A')}"
Views: ${videoDetails.viewCount || 0} | Likes: ${videoDetails.likeCount || 0} | Comentarios: ${videoDetails.commentCount || 0} | Publicado: ${videoDetails.publishedAt || 'N/A'}`;
    
            const optimizationSchema = {
                type: "OBJECT",
                properties: {
                    original_title: { type: "STRING" },
                    original_description: { type: "STRING" },
                    original_tags: { type: "ARRAY", items: { type: "STRING" } },
                    original_scores: { type: "OBJECT", properties: { seo_potential: { type: "NUMBER" }, ctr_potential: { type: "NUMBER" } } },
                    suggested_titles: { type: "ARRAY", items: { type: "STRING" } },
                    suggested_description: { type: "STRING" },
                    suggested_tags: { type: "ARRAY", items: { type: "STRING" } },
                    new_scores: { type: "OBJECT", properties: { seo_potential: { type: "NUMBER" }, ctr_potential: { type: "NUMBER" } } }
                },
                required: ["original_title", "original_description", "original_tags", "original_scores", "suggested_titles", "suggested_description", "suggested_tags", "new_scores"]
            };
    
            const aiResult = await apiRequestWithFallback('/api/generate-legacy', 'POST', { prompt: optimizationPrompt, model, schema: optimizationSchema });
    
            console.log('📦 Resposta do otimizador de vídeo (raw):', aiResult);
            console.log('📦 Tipo de aiResult.data:', typeof aiResult?.data);
            if (aiResult?.data && typeof aiResult.data === 'object' && !Array.isArray(aiResult.data)) {
                console.log('📦 Chaves em aiResult.data:', Object.keys(aiResult.data));
            }
    
                        let data = null;
            if (aiResult && aiResult.data) {
                                if (typeof aiResult.data === 'object' && !Array.isArray(aiResult.data)) {
                                        if (aiResult.data.original_title || aiResult.data.suggested_titles || aiResult.data.suggested_description) {
                        data = aiResult.data;
                        console.log('✅ Dados encontrados diretamente em aiResult.data');
                    }
                                        else if (aiResult.data.data && typeof aiResult.data.data === 'object') {
                        data = aiResult.data.data;
                        console.log('✅ Dados encontrados em aiResult.data.data (Claude)');
                    }
                                        else {
                                                for (const key in aiResult.data) {
                            if (aiResult.data[key] && typeof aiResult.data[key] === 'object' && !Array.isArray(aiResult.data[key])) {
                                const candidate = aiResult.data[key];
                                if (candidate.original_title || candidate.suggested_titles || candidate.suggested_description) {
                                    data = candidate;
                                    console.log(`✅ Dados encontrados na chave "${key}"`);
                                    break;
                                }
                            }
                        }
                    }
                }
                                else if (typeof aiResult.data === 'string') {
                    try {
                        const parsed = JSON.parse(aiResult.data);
                        if (parsed.original_title || parsed.suggested_titles || parsed.suggested_description) {
                            data = parsed;
                            console.log('✅ String JSON parseada com sucesso');
                        } else if (parsed.data && typeof parsed.data === 'object') {
                            data = parsed.data;
                            console.log('✅ Dados encontrados em parsed.data');
                        }
                    } catch (e) {
                        console.warn('⚠️ Não foi possível parsear aiResult.data como JSON:', e);
                                                try {
                            const cleaned = aiResult.data.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (parsed.original_title || parsed.suggested_titles || parsed.suggested_description) {
                                    data = parsed;
                                    console.log('✅ JSON extraído de markdown');
                                }
                            }
                        } catch (e2) {
                            console.error('❌ Falha ao extrair JSON de markdown:', e2);
                        }
                    }
                }
            }
    
            if (!data) {
                console.error('❌ Estrutura de resposta não reconhecida:', aiResult);
                throw new Error("A IA não retornou sugestões de otimização válidas. Verifique o console para mais detalhes.");
            }
    
            // Ensure scores are numbers and within range
            const scoreKeys = ['seo_potential', 'ctr_potential'];
            scoreKeys.forEach(key => {
                if (data.original_scores && (data.original_scores[key] === undefined || isNaN(data.original_scores[key]))) {
                    data.original_scores[key] = generateRandomScore(50, 80);
                } else if (data.original_scores) {
                    data.original_scores[key] = Math.min(Math.max(data.original_scores[key], 0), 100);
                }
                if (data.new_scores && (data.new_scores[key] === undefined || isNaN(data.new_scores[key]))) {
                    data.new_scores[key] = generateRandomScore(80, 95);
                } else if (data.new_scores) {
                    data.new_scores[key] = Math.min(Math.max(data.new_scores[key], 0), 100);
                }
            });
    
            // Render video details
            outputEl.innerHTML = `
                <div id="video-details-container" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Detalhes do Vídeo Original</h3>
                    <div class="flex flex-col md:flex-row gap-4">
                        <div class="md:w-1/3 flex-shrink-0">
                            <img src="${videoDetails.thumbnailUrl}" alt="Thumbnail do vídeo" class="w-full h-auto rounded-lg object-cover">
                            <button id="download-thumbnail-btn" class="mt-2 w-full py-2 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" data-thumbnail-url="${videoDetails.thumbnailUrl}" data-video-id="${videoDetails.id}">Baixar Thumbnail</button>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Visualizações: ${parseInt(videoDetails.viewCount).toLocaleString()}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Likes: ${parseInt(videoDetails.likeCount).toLocaleString()}</p>
                        </div>
                        <div class="md:w-2/3">
                            <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">${videoDetails.title}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3 whitespace-pre-wrap">${videoDetails.description || 'N/A'}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Tags: ${(videoDetails.tags && Array.isArray(videoDetails.tags) ? videoDetails.tags : []).join(', ') || 'Nenhuma tag disponível'}</p>
                            <div class="mt-4">
                                ${renderScoreCard('Pontuação Original', (data.original_scores.seo_potential + data.original_scores.ctr_potential) / 2, {
                                    'Potencial de SEO': data.original_scores.seo_potential,
                                    'Potencial de CTR': data.original_scores.ctr_potential
                                })}
                            </div>
                        </div>
                    </div>
                </div>
                <div id="ai-suggestions-container" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Sugestões de Otimização da IA</h3>
                    <div class="space-y-6">
                        <div>
                            <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">Títulos Sugeridos</h4>
                            <ul class="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-300">
                                ${data.suggested_titles.map(title => `<li>${title} ${createCopyButton(title, 'ml-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}</li>`).join('')}
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">Descrição Otimizada</h4>
                            <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 relative">
                                <p class="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${data.suggested_description}</p>
                                ${createCopyButton(data.suggested_description, 'absolute top-2 right-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                            </div>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">Tags Sugeridas</h4>
                            <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 relative flex flex-wrap gap-2">
                                ${data.suggested_tags.map(tag => `<span class="inline-block bg-gray-200 dark:bg-gray-600 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300">${tag}</span>`).join('')}
                                ${createCopyButton(data.suggested_tags.join(', '), 'absolute top-2 right-2 p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                            </div>
                        </div>
                        <div class="mt-4">
                            ${renderScoreCard('Nova Pontuação', (data.new_scores.seo_potential + data.new_scores.ctr_potential) / 2, {
                                'Potencial de SEO': data.new_scores.seo_potential,
                                'Potencial de CTR': data.new_scores.ctr_potential
                            })}
                        </div>
                    </div>
                </div>
            `;
            showSuccessToast("Otimização de vídeo gerada com sucesso!");
    
        } catch (error) {
            addToLog(`Erro ao otimizar vídeo: ${error.message}`, true);
            outputEl.innerHTML = `<p class="text-center text-red-600">Ocorreu um erro ao otimizar o vídeo: ${error.message}</p>`;
        } finally {
            hideProgressModal();
        }
    },

    init() {
        console.log('✅ Módulo Video Optimizer inicializado');
        // Event listeners serão registrados pelo sistema de handlers
    }
};
