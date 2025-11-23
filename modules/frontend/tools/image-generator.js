

import { getGlobalUtils } from '../shared/utils.js';


function createProcessFailedImageRetry(form) {
    return async (failedImage, imageIndex) => {
                const apiRequestWithFallback = window.apiRequestWithFallback;
        const apiRequest = window.apiRequest;
        const showSuccessToast = window.showSuccessToast || ((msg) => console.log(msg));
        const addToLog = window.addToLog || ((msg) => console.log(msg));
        const renderImageFxOutput = window.renderImageFxOutput || (() => {});
        const appState = window.appState || {};
        const imageFxResults = window.imageFxResults || { images: [] };
        const removeAccents = window.removeAccents || ((str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        
        if (!apiRequestWithFallback || !apiRequest) {
            console.error('API functions not available');
            return false;
        }

        try {
                        imageFxResults.images[imageIndex] = {
                ...failedImage,
                status: 'retrying',
                error: 'Reescrevendo prompt automaticamente...'
            };
            renderImageFxOutput();

                        const rewriteModel = document.getElementById('imagefx-rewrite-model')?.value || 
                                document.getElementById('scene-prompts-model-select')?.value || 
                                'gpt-4o';
            
                        const rewritePrompt = `O prompt a seguir foi bloqueado por violar políticas de conteúdo. Reescreva-o mantendo a essência visual, história e estilo, mas removendo qualquer conteúdo que possa ser considerado inseguro ou inadequado. O prompt reescrito deve ser em INGLÊS e otimizado para geração de imagens.

PROMPT ORIGINAL:
"""${removeAccents(failedImage.prompt)}"""

INSTRUÇÕES:
1. Mantenha a essência visual, composição e estilo do prompt original
2. Remova qualquer referência a violência, conteúdo adulto ou conteúdo inadequado
3. Mantenha a narrativa e a atmosfera geral
4. O prompt reescrito deve ter entre 600-1200 caracteres
5. Responda APENAS com o prompt reescrito, sem explicações adicionais

PROMPT REWRITTEN:`;

                        const rewriteResult = await apiRequestWithFallback('/api/generate-legacy', 'POST', {
                prompt: rewritePrompt,
                model: rewriteModel,
                maxOutputTokens: 2000
            });

            let rewrittenPrompt = '';
            if (rewriteResult && rewriteResult.data) {
                if (typeof rewriteResult.data === 'string') {
                    rewrittenPrompt = rewriteResult.data.trim();
                } else if (rewriteResult.data.text) {
                    rewrittenPrompt = rewriteResult.data.text.trim();
                } else if (rewriteResult.data.rewritten_prompt) {
                    rewrittenPrompt = rewriteResult.data.rewritten_prompt.trim();
                } else if (rewriteResult.data.prompt) {
                    rewrittenPrompt = rewriteResult.data.prompt.trim();
                }
            }

            if (!rewrittenPrompt || rewrittenPrompt.length < 50) {
                throw new Error('Prompt reescrito inválido ou muito curto');
            }

                        imageFxResults.images[imageIndex] = {
                ...failedImage,
                status: 'pending',
                prompt: rewrittenPrompt,
                error: 'Gerando com prompt reescrito...',
                wasRewritten: true
            };
            renderImageFxOutput();

            const res = await apiRequest('/api/imagefx/generate', 'POST', {
                prompts: [rewrittenPrompt],
                negative_prompt: form.negativePrompt,
                aspect_ratio: form.aspectRatio || failedImage.aspectRatio,
                style: form.style,
                num_images: form.numImages || 1,
                generation_model: form.generationModel
            });

            const imageResults = res.images.map(img => ({ 
                ...img, 
                sceneNumber: failedImage.sceneNumber,
                wasRewritten: true,
                originalPrompt: failedImage.prompt
            }));

            if (imageResults.length > 0) {
                imageFxResults.images[imageIndex] = imageResults[0];
                renderImageFxOutput();
                addToLog(`Cena ${failedImage.sceneNumber}: Prompt reescrito e imagem gerada com sucesso!`, false);
                return true;
            } else {
                throw new Error('A API retornou uma resposta vazia após reescrever o prompt.');
            }
        } catch (error) {
            console.error(`Erro ao reescrever prompt para cena ${failedImage.sceneNumber}:`, error);
            imageFxResults.images[imageIndex] = {
                ...failedImage,
                status: 'failed',
                error: `Erro ao reescrever: ${error.message || 'Erro desconhecido'}`
            };
            renderImageFxOutput();
            addToLog(`Erro ao reescrever prompt para cena ${failedImage.sceneNumber}: ${error.message}`, true);
            return false;
        }
    };
}

export default {
    id: 'image-generator',
    name: 'Gerador de Imagens',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    category: 'media',

    
    async handler(promptsToGenerate, isRetry = false, originalIndex = -1, originalAspectRatio = null) {
                const utils = getGlobalUtils();
        const {
            showSuccessToast,
            addToLog,
            apiRequest
        } = utils;

                const appState = window.appState || {};
        const imageFxResults = window.imageFxResults || { images: [], lastClearedImages: [], lastPrompt: '' };
        const renderImageGenerationProgress = window.renderImageGenerationProgress || (() => {});
        const renderImageFxOutput = window.renderImageFxOutput || (() => {});
        const showImageGenCompleteModal = window.showImageGenCompleteModal || (() => {});

                if (!window.imageFxResults) {
            window.imageFxResults = imageFxResults;
        }

        const form = {
            promptInput: document.getElementById('imagefx-prompt'),
            negativePrompt: document.getElementById('imagefx-negative-prompt')?.value.trim(),
            aspectRatio: originalAspectRatio || document.getElementById('imagefx-aspect-ratio')?.value,
            style: document.getElementById('imagefx-style')?.value,
            numImages: parseInt(document.getElementById('imagefx-num-images')?.value, 10),
            batchFileInput: document.getElementById('imagefx-batch-file'),
            generationModel: document.getElementById('imagefx-model')?.value
        };

        const processFailedImageRetry = createProcessFailedImageRetry(form);
        
        const runGeneration = async (promptsBatch, isBulkRetry = false) => {
            if (!promptsBatch || promptsBatch.length === 0) {
                showSuccessToast("Nenhum prompt valido foi fornecido.");
                return;
            }
            
            imageFxResults.lastPrompt = promptsBatch.join('\n');
            const totalPrompts = promptsBatch.length;
            let generatedCount = 0;
            const generationStartTime = Date.now();
            
            if (!isRetry && !isBulkRetry) {
                appState.imageGenStatus = { active: true, current: 0, total: totalPrompts, message: `A iniciar ${totalPrompts} prompt(s)...`, error: false };
                renderImageGenerationProgress(appState.imageGenStatus);
                addToLog(`A gerar imagens para ${totalPrompts} prompt(s) com ImageFX...`);
            }

            const allowConcurrent = (!isRetry && !isBulkRetry && form.numImages === 1 && totalPrompts > 1);

            const runTasksWithConcurrency = async (tasks, limit, processor) => {
                return new Promise((resolve) => {
                    let nextIndex = 0;
                    let active = 0;

                    const launchNext = () => {
                        if (nextIndex >= tasks.length && active === 0) {
                            resolve();
                            return;
                        }
                        while (active < limit && nextIndex < tasks.length) {
                            const task = tasks[nextIndex++];
                            active++;
                            processor(task).finally(() => {
                                active--;
                                launchNext();
                            });
                        }
                    };

                    launchNext();
                });
            };

            if (allowConcurrent) {
                const baseIndex = imageFxResults.images.length;
                const baseSceneNumber = baseIndex + 1;
                const tasks = promptsBatch.map((prompt, idx) => {
                    const sceneNumber = baseSceneNumber + idx;
                    const imageIndex = baseIndex + idx;
                    imageFxResults.images.push({
                        status: 'pending',
                        prompt,
                        error: 'A gerar...',
                        sceneNumber,
                        aspectRatio: form.aspectRatio
                    });
                    return { prompt, sceneNumber, imageIndex };
                });
                renderImageFxOutput();

                const totalTasks = tasks.length;
                let completed = 0;

                const updateProgress = () => {
                    if (!isRetry && !isBulkRetry) {
                        appState.imageGenStatus.current = completed;
                        appState.imageGenStatus.message = `Processando ${completed}/${totalTasks} cenas...`;
                        renderImageGenerationProgress(appState.imageGenStatus);
                    }
                };

                const processTask = async (task) => {
                                        if (appState.imageGenStatus.cancelled) {
                        return;
                    }
                    
                    const { prompt: currentPrompt, sceneNumber: currentSceneNumber, imageIndex: currentImageIndex } = task;
                    try {
                        const res = await apiRequest('/api/imagefx/generate', 'POST', {
                            prompts: [currentPrompt],
                            negative_prompt: form.negativePrompt,
                            aspect_ratio: form.aspectRatio,
                            style: form.style,
                            num_images: form.numImages,
                            generation_model: form.generationModel
                        });

                        const imageResults = res.images.map(img => ({ ...img, sceneNumber: currentSceneNumber }));
                        if (imageResults.length > 0) {
                            imageFxResults.images[currentImageIndex] = imageResults[0];
                        } else {
                            imageFxResults.images[currentImageIndex] = {
                                status: 'failed',
                                prompt: currentPrompt,
                                error: 'A API retornou uma resposta vazia.',
                                sceneNumber: currentSceneNumber,
                                aspectRatio: form.aspectRatio
                            };
                        }

                        if (appState.currentTab === 'image-generator') {
                            renderImageFxOutput();
                        }
                    } catch (error) {
                        console.error(`Erro na geração ImageFX para o prompt ${currentSceneNumber}:`, error.stack || error);
                        const userFriendlyMessage = error.message || 'Erro desconhecido.';
                        const errorLower = userFriendlyMessage.toLowerCase();

                                                const isCookieError = errorLower.includes('cookie') || 
                                            errorLower.includes('autenticar') || 
                                            errorLower.includes('sessão') ||
                                            errorLower.includes('session') ||
                                            errorLower.includes('invalid cookie') ||
                                            errorLower.includes('cookie inválido') ||
                                            errorLower.includes('verifique os cookies') ||
                                            errorLower.includes('refresh session') ||
                                            errorLower.includes('expired');

                        if (isCookieError) {
                            alert('⚠️ COOKIES DO IMAGEFX EXPIRADOS!\n\nOs cookies do ImageFX expiraram ou são inválidos.\n\nPor favor:\n1. Abra o ImageFX no navegador e faça login\n2. Use a extensão "Cookie Editor" para exportar os cookies atualizados\n3. Vá em Configurações e cole os novos cookies\n4. Tente gerar as imagens novamente\n\nOs cookies precisam ser renovados periodicamente.');
                            
                            imageFxResults.images[currentImageIndex] = {
                                status: 'failed',
                                prompt: currentPrompt,
                                error: 'Cookies do ImageFX expirados. Renove os cookies nas Configurações.',
                                sceneNumber: currentSceneNumber,
                                aspectRatio: form.aspectRatio
                            };
                            renderImageFxOutput();
                            completed++;
                            updateProgress();
                            return;
                        }

                        if (userFriendlyMessage.includes('Prompt bloqueado') || errorLower.includes('conteúdo inseguro') || errorLower.includes('conteudo inseguro')) {
                            const success = await processFailedImageRetry({
                                status: 'failed',
                                prompt: currentPrompt,
                                error: userFriendlyMessage,
                                sceneNumber: currentSceneNumber,
                                aspectRatio: form.aspectRatio
                            }, currentImageIndex);

                            if (success) {
                                if (!isRetry && !isBulkRetry) {
                                    appState.imageGenStatus.message = `Cena ${currentSceneNumber}: prompt original bloqueado. Reescrevendo automaticamente...`;
                                    renderImageGenerationProgress(appState.imageGenStatus);
                                }
                                generatedCount++;
                                completed++;
                                updateProgress();
                                return;
                            }
                        }

                        imageFxResults.images[currentImageIndex] = {
                            status: 'failed',
                            prompt: currentPrompt,
                            error: userFriendlyMessage,
                            sceneNumber: currentSceneNumber,
                            aspectRatio: form.aspectRatio
                        };
                        renderImageFxOutput();
                        completed++;
                        updateProgress();
                        return;
                    }

                    generatedCount++;
                    completed++;
                    updateProgress();
                };

                await runTasksWithConcurrency(tasks, 3, processTask);

                                if (appState.imageGenStatus.cancelled) {
                    appState.imageGenStatus.active = false;
                    appState.imageGenStatus.message = 'Geração cancelada pelo usuário.';
                    renderImageGenerationProgress(appState.imageGenStatus);
                    addToLog('Geração de imagens cancelada pelo usuário.', false);
                    return;
                }

                                if (!isRetry && !isBulkRetry) {
                    const delay = (ms) => new Promise(res => setTimeout(res, ms));
                    let attempt = 0;
                    const maxAttempts = 50;                     
                    while (true) {
                                                if (appState.imageGenStatus.cancelled) {
                            appState.imageGenStatus.active = false;
                            appState.imageGenStatus.message = 'Geração cancelada pelo usuário.';
                            renderImageGenerationProgress(appState.imageGenStatus);
                            addToLog('Geração de imagens cancelada pelo usuário.', false);
                            break;
                        }
                        
                        const failedImages = imageFxResults.images.filter(img => img.status === 'failed');
                        
                        if (failedImages.length === 0) {
                            addToLog(`Todas as imagens foram geradas com sucesso!`);
                            break;
                        }
                        
                        attempt++;
                        if (attempt > maxAttempts) {
                            addToLog(`Limite de tentativas atingido. Parando retry automático.`, true);
                            break;
                        }
                        
                        addToLog(`Tentativa ${attempt}: Regenerando ${failedImages.length} imagem(ns) com erro (3 por vez)...`);
                        appState.imageGenStatus.message = `Tentativa ${attempt}: Regenerando ${failedImages.length} imagem(ns) com erro...`;
                        renderImageGenerationProgress(appState.imageGenStatus);
                        
                                                const retryTasks = [];
                        for (let i = 0; i < imageFxResults.images.length; i++) {
                            const img = imageFxResults.images[i];
                            if (img.status === 'failed') {
                                retryTasks.push({ img, index: i });
                            }
                        }
                        
                                                const processRetryTask = async (task) => {
                                                        if (appState.imageGenStatus.cancelled) {
                                return;
                            }
                            
                            const { img, index } = task;
                            addToLog(`[Retry Paralelo] Iniciando retry para cena ${img.sceneNumber}...`);
                            
                            const errorMessage = (img.error || '').toLowerCase();
                            const isThrottlingError = errorMessage.includes('throttled') || 
                                                     errorMessage.includes('limite de requisições') ||
                                                     errorMessage.includes('429') ||
                                                     errorMessage.includes('too many requests') ||
                                                     errorMessage.includes('limite temporário');
                            
                                                                                    if (isThrottlingError) {
                                imageFxResults.images[index] = {
                                    ...img,
                                    status: 'retrying',
                                    error: 'Aguardando 5 segundos antes de tentar novamente (limite temporário)...'
                                };
                                renderImageFxOutput();
                                addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: aguardando 5s (throttling)...`);
                                await delay(5000);
                            }
                            
                                                        const currentForm = {
                                negativePrompt: document.getElementById('imagefx-negative-prompt')?.value.trim(),
                                aspectRatio: img.aspectRatio,
                                style: document.getElementById('imagefx-style')?.value,
                                numImages: parseInt(document.getElementById('imagefx-num-images')?.value, 10),
                                generationModel: document.getElementById('imagefx-model')?.value
                            };
                            const processFailedImageRetryCurrent = createProcessFailedImageRetry(currentForm);
                            addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: processando retry...`);
                            await processFailedImageRetryCurrent(img, index);
                            addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: retry concluído.`);
                        };
                        
                                                addToLog(`[Retry Paralelo] Processando ${retryTasks.length} imagens com erro (3 por vez em paralelo)...`);
                        await runTasksWithConcurrency(retryTasks, 3, processRetryTask);
                        addToLog(`[Retry Paralelo] Lote de 3 concluído.`);
                        
                                                await delay(2000);
                    }
                    
                    addToLog(`Processo de retry automático concluído.`);
                }

                const durationSeconds = Math.max(1, Math.round((Date.now() - generationStartTime) / 1000));

                if (!isRetry && !isBulkRetry) {
                    const successCount = imageFxResults.images.filter(img => img.status === 'success').length;
                    const failedCount = imageFxResults.images.filter(img => img.status === 'failed').length;
                    
                    appState.imageGenStatus.message = `Concluído. ${successCount} sucesso, ${failedCount} erro(s).`;
                    renderImageGenerationProgress(appState.imageGenStatus);
                    
                    if (successCount > 0) {
                        showImageGenCompleteModal(durationSeconds);
                    }
                    
                    setTimeout(() => {
                        appState.imageGenStatus.active = false;
                        renderImageGenerationProgress(appState.imageGenStatus);
                    }, 5000);
                }
                addToLog(`Processo concluído para ${totalTasks} prompt(s).`);
                renderImageFxOutput();
                return;
            }

                        for (let i = 0; i < totalPrompts; i++) {
                let currentPrompt = promptsBatch[i];
                let currentImageIndex = isRetry ? originalIndex : (imageFxResults.images.length);
                let currentSceneNumber = isRetry ? imageFxResults.images[originalIndex].sceneNumber : (imageFxResults.images.length + 1);
                
                if (!isRetry && !isBulkRetry) {
                    imageFxResults.images.push({
                        status: 'pending',
                        prompt: currentPrompt,
                        error: 'A gerar...',
                        sceneNumber: currentSceneNumber,
                        aspectRatio: form.aspectRatio
                    });
                    renderImageFxOutput();
                } else if (isBulkRetry) {
                    currentImageIndex = imageFxResults.images.findIndex(img => img.prompt === currentPrompt && img.status === 'failed');
                    if (currentImageIndex === -1) continue;
                    currentSceneNumber = imageFxResults.images[currentImageIndex].sceneNumber;
                    imageFxResults.images[currentImageIndex] = {
                        ...imageFxResults.images[currentImageIndex],
                        status: 'retrying',
                        error: 'A tentar gerar novamente...'
                    };
                    renderImageFxOutput();
                }

                try {
                    appState.imageGenStatus.message = `A gerar imagem para a cena ${currentSceneNumber}: "${currentPrompt.substring(0, 30)}"...`;
                    renderImageGenerationProgress(appState.imageGenStatus);
                    
                    const res = await apiRequest('/api/imagefx/generate', 'POST', {
                        prompts: [currentPrompt], 
                        negative_prompt: form.negativePrompt,
                        aspect_ratio: form.aspectRatio,
                        style: form.style,
                        num_images: form.numImages,
                        generation_model: form.generationModel
                    });

                    const imageResults = res.images.map(img => ({ ...img, sceneNumber: currentSceneNumber }));
                    
                    imageFxResults.images.splice(currentImageIndex, 1, ...imageResults);
                    generatedCount++;
                    
                    if (appState.currentTab === 'image-generator') {
                        renderImageFxOutput(); 
                    }
                } catch (error) {
                    console.error(`Erro na geração ImageFX para o prompt ${currentSceneNumber}:`, error.stack || error);
                    const userFriendlyMessage = error.message || 'Erro desconhecido.';
                    
                                        if (userFriendlyMessage.includes('Prompt bloqueado') || userFriendlyMessage.toLowerCase().includes('conteúdo inseguro') || userFriendlyMessage.toLowerCase().includes('conteudo inseguro')) {
                        const success = await processFailedImageRetry({
                            status: 'failed',
                            prompt: currentPrompt,
                            error: userFriendlyMessage,
                            sceneNumber: currentSceneNumber,
                            aspectRatio: form.aspectRatio
                        }, currentImageIndex);
                
                        if (success) {
                            if (!isRetry) {
                                appState.imageGenStatus.message = `Cena ${currentSceneNumber}: prompt original bloqueado. Reescrevendo automaticamente...`;
                                renderImageGenerationProgress(appState.imageGenStatus);
                            }
                            generatedCount++;
                            continue;
                        }
                    } else {
                                                imageFxResults.images[currentImageIndex] = {
                            ...imageFxResults.images[currentImageIndex],
                            status: 'failed',
                            error: userFriendlyMessage
                        };
                        renderImageFxOutput();
                    }
                } finally {
                    if (!isRetry) {
                        appState.imageGenStatus.current = i + 1;
                        renderImageGenerationProgress(appState.imageGenStatus);
                    }
                }
            }
            
                        if (!isRetry && !isBulkRetry) {
                const delay = (ms) => new Promise(res => setTimeout(res, ms));
                let attempt = 0;
                const maxAttempts = 50;
                
                while (true) {
                    const failedImages = imageFxResults.images.filter(img => img.status === 'failed');
                    
                    if (failedImages.length === 0) {
                        addToLog(`Todas as imagens foram geradas com sucesso!`);
                        break;
                    }
                    
                    attempt++;
                    if (attempt > maxAttempts) {
                        addToLog(`Limite de tentativas atingido. Parando retry automático.`, true);
                        break;
                    }
                    
                    addToLog(`Tentativa ${attempt}: Regenerando ${failedImages.length} imagem(ns) com erro (3 por vez)...`);
                    appState.imageGenStatus.message = `Tentativa ${attempt}: Regenerando ${failedImages.length} imagem(ns) com erro...`;
                    renderImageGenerationProgress(appState.imageGenStatus);
                    
                                        const retryTasks = [];
                    for (let i = 0; i < imageFxResults.images.length; i++) {
                        const img = imageFxResults.images[i];
                        if (img.status === 'failed') {
                            retryTasks.push({ img, index: i });
                        }
                    }
                    
                                        const processRetryTask = async (task) => {
                        const { img, index } = task;
                        addToLog(`[Retry Paralelo] Iniciando retry para cena ${img.sceneNumber}...`);
                        
                        const errorMessage = (img.error || '').toLowerCase();
                        const isThrottlingError = errorMessage.includes('throttled') || 
                                                 errorMessage.includes('limite de requisições') ||
                                                 errorMessage.includes('429') ||
                                                 errorMessage.includes('too many requests') ||
                                                 errorMessage.includes('limite temporário');
                        
                                                if (isThrottlingError) {
                            imageFxResults.images[index] = {
                                ...img,
                                status: 'retrying',
                                error: 'Aguardando 5 segundos antes de tentar novamente (limite temporário)...'
                            };
                            renderImageFxOutput();
                            addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: aguardando 5s (throttling)...`);
                            await delay(5000);
                        }
                        
                                                const currentForm = {
                            negativePrompt: document.getElementById('imagefx-negative-prompt')?.value.trim(),
                            aspectRatio: img.aspectRatio,
                            style: document.getElementById('imagefx-style')?.value,
                            numImages: parseInt(document.getElementById('imagefx-num-images')?.value, 10),
                            generationModel: document.getElementById('imagefx-model')?.value
                        };
                        const processFailedImageRetryCurrent = createProcessFailedImageRetry(currentForm);
                        addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: processando retry...`);
                        await processFailedImageRetryCurrent(img, index);
                        addToLog(`[Retry Paralelo] Cena ${img.sceneNumber}: retry concluído.`);
                    };
                    
                                        addToLog(`[Retry Paralelo] Processando ${retryTasks.length} imagens com erro (3 por vez em paralelo)...`);
                    await runTasksWithConcurrency(retryTasks, 3, processRetryTask);
                    addToLog(`[Retry Paralelo] Lote de 3 concluído.`);
                    
                                        await delay(2000);
                }
                
                addToLog(`Processo de retry automático concluído.`);
            }
            
            if (!isRetry && !isBulkRetry) {
                const durationSeconds = Math.max(1, Math.round((Date.now() - generationStartTime) / 1000));
                const successCount = imageFxResults.images.filter(img => img.status === 'success').length;
                const failedCount = imageFxResults.images.filter(img => img.status === 'failed').length;
                
                appState.imageGenStatus.message = `Concluído. ${successCount} sucesso, ${failedCount} erro(s).`;
                renderImageGenerationProgress(appState.imageGenStatus);
                
                if (successCount > 0) {
                    showImageGenCompleteModal(durationSeconds);
                }

                setTimeout(() => {
                    appState.imageGenStatus.active = false;
                    renderImageGenerationProgress(appState.imageGenStatus);
                }, 5000);
            }

            if (form.batchFileInput && form.batchFileInput.files[0]) form.batchFileInput.value = '';
            if (form.promptInput) form.promptInput.value = '';
        };

                if (isRetry && promptsToGenerate && promptsToGenerate.length > 0) {
            await runGeneration(promptsToGenerate);
        } else {
                        const batchFile = form.batchFileInput ? form.batchFileInput.files[0] : null;
            if (batchFile) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const prompts = event.target.result.split('\n').map(p => p.trim()).filter(Boolean);
                    runGeneration(prompts);
                };
                reader.onerror = () => {
                     showSuccessToast("Erro ao ler o ficheiro em lote.");
                     addToLog("Erro ao ler o ficheiro em lote.", true);
                }
                reader.readAsText(batchFile);
            } else if (form.promptInput && form.promptInput.value.trim()) {
                const prompts = form.promptInput.value.split('\n').map(p => p.trim()).filter(Boolean);
                runGeneration(prompts);
            } else {
                showSuccessToast("Por favor, insira um prompt ou carregue um ficheiro em lote.");
            }
        }
    },

    init() {
        console.log('✅ Módulo Image Generator inicializado');
                if (!window.imageFxResults) {
            window.imageFxResults = { images: [], lastClearedImages: [], lastPrompt: '' };
        }
    }
};