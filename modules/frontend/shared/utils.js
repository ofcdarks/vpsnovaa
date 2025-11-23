


export function getGlobalUtils() {
    if (typeof window === 'undefined') {
        return {};
    }

    return {
                showSuccessToast: window.showSuccessToast || ((msg) => console.log(msg)),
        showConfirmationModal: window.showConfirmationModal || ((title, message, onConfirm) => {
                        if (confirm(`${title}\n\n${message}`)) {
                if (onConfirm && typeof onConfirm === 'function') {
                    onConfirm();
                }
                return Promise.resolve(true);
            }
            return Promise.resolve(false);
        }),
        hideConfirmationModal: window.hideConfirmationModal || (() => {}),
        showInfoModal: window.showInfoModal || ((title, message, options) => {
                        return Promise.resolve(alert(`${title}\n\n${message}`));
        }),
        showProgressModal: window.showProgressModal || ((title, msg) => console.log(title, msg)),
        hideProgressModal: window.hideProgressModal || (() => {}),
        addToLog: window.addToLog || ((msg, isError) => console.log(msg, isError)),
        devLog: window.devLog || (() => {}),
        
                apiRequestWithFallback: window.apiRequestWithFallback,
        apiRequest: window.apiRequest || (async (url, method, body) => {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
                body: JSON.stringify(body)
            });
            return await response.json();
        }),
        streamApiRequest: window.streamApiRequest,
        
                removeAccents: window.removeAccents || ((str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
        generateRandomScore: window.generateRandomScore || ((min, max) => Math.floor(Math.random() * (max - min + 1)) + min),
        createCopyButton: window.createCopyButton || ((text, className = '') => {
            return `<button class="${className} copy-btn" data-text="${(text || '').replace(/"/g, '&quot;')}" title="Copiar">📋</button>`;
        }),
        renderScoreCard: window.renderScoreCard || ((title, mainScore, subScores) => {
            return `<div class="text-center"><h4 class="font-semibold text-sm mb-2">${title}</h4><p class="text-3xl font-bold">${mainScore.toFixed(1)}</p></div>`;
        }),
        getLegendForTool: window.getLegendForTool || ((toolId) => ''),
        
                getBrainstormPrompt: window.getBrainstormPrompt || ((lang, niche) => {
            return `Como especialista em YouTube, gere 5 ideias de vídeo virais e inéditas em "${lang}" para um canal sobre "${niche}". Formate como títulos de até 100 caracteres. Para cada uma, forneça pontuações (0-100) para 'potential', 'originality', 'impact', 'search_potential', 'trends_potential' e 3 'sub_niches' relacionados. Responda APENAS com um JSON contendo uma chave "ideas", que é uma array de objetos.`;
        }),
        
                appState: window.appState || {},
        
                checkApiAvailability: () => {
            if (!window.apiRequestWithFallback) {
                console.error('apiRequestWithFallback não disponível');
                if (window.showSuccessToast) {
                    window.showSuccessToast('Erro: API não disponível. Recarregue a página.');
                }
                return false;
            }
            return true;
        }
    };
}


export function initUtils(module) {
    const utils = getGlobalUtils();
    Object.assign(module, utils);
    return utils;
}

