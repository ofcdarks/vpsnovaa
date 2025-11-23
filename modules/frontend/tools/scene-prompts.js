

import { getGlobalUtils } from '../shared/utils.js';


const RECOMMENDED_MODEL = 'gpt-4o';
const SCENE_TOKENS_PER_PROMPT = 300;

const TOKEN_LIMITS_FRONTEND = {
    'gpt-5.1': { maxContextLength: 200000, maxOutputTokens: 32768 },
    'gpt-4o': { maxContextLength: 128000, maxOutputTokens: 16384 },
    'gpt-4-turbo': { maxContextLength: 128000, maxOutputTokens: 16384 },
    'gpt-3.5-turbo': { maxContextLength: 16385, maxOutputTokens: 4096 },
    'claude-3-5-sonnet': { maxContextLength: 200000, maxOutputTokens: 8192 },
    'claude-3-5-haiku': { maxContextLength: 200000, maxOutputTokens: 4096 },
    'claude-3-opus': { maxContextLength: 200000, maxOutputTokens: 4096 },
    'claude-3-sonnet': { maxContextLength: 200000, maxOutputTokens: 4096 },
    'claude-sonnet-4': { maxContextLength: 200000, maxOutputTokens: 8192 },
    'claude-sonnet-4.5': { maxContextLength: 200000, maxOutputTokens: 8192 },
    'gemini-3-pro-preview': { maxContextLength: 1048576, maxOutputTokens: 65536 },
    'gemini-2.5-pro': { maxContextLength: 2000000, maxOutputTokens: 32768 },
    'gemini-2.5-flash': { maxContextLength: 1000000, maxOutputTokens: 16384 },
    'gemini-2.5-flash-lite': { maxContextLength: 1000000, maxOutputTokens: 8192 },
    'gemini-1.5-pro': { maxContextLength: 2000000, maxOutputTokens: 8192 },
    'gemini-1.5-flash': { maxContextLength: 1000000, maxOutputTokens: 8192 }
};

const MODEL_ALIAS_RULES = [
    { test: /^claude-sonnet-4-5/, canonical: 'claude-sonnet-4.5' },
    { test: /^claude-sonnet-45/, canonical: 'claude-sonnet-4.5' },
    { test: /^claude-sonnet4-5/, canonical: 'claude-sonnet-4.5' },
    { test: /^claude-3-5-sonnet-/, canonical: 'claude-3-5-sonnet' },
    { test: /^claude-35-sonnet/, canonical: 'claude-3-5-sonnet' },
    { test: /^claude-3-5-haiku-/, canonical: 'claude-3-5-haiku' },
    { test: /^claude-35-haiku/, canonical: 'claude-3-5-haiku' },
    { test: /^claude-3-opus-/, canonical: 'claude-3-opus' },
    { test: /^claude-3-sonnet-/, canonical: 'claude-3-sonnet' },
    { test: /^gpt-4o-mini/, canonical: 'gpt-4o' },
    { test: /^gpt4o/, canonical: 'gpt-4o' },
    { test: /^gpt-51/, canonical: 'gpt-5.1' },
    { test: /^gpt5/, canonical: 'gpt-5.1' },
    { test: /^gpt4-turbo/, canonical: 'gpt-4-turbo' },
    { test: /^gpt-35-turbo/, canonical: 'gpt-3.5-turbo' },
    { test: /^gemini-3-pro-preview/, canonical: 'gemini-3-pro-preview' },
    { test: /^gemini-3-pro/, canonical: 'gemini-3-pro-preview' },
    { test: /^gemini3pro/, canonical: 'gemini-3-pro-preview' },
    { test: /^gemini-2\.0-flash-exp/, canonical: 'gemini-2.5-flash' },
    { test: /^gemini-25-pro/, canonical: 'gemini-2.5-pro' },
    { test: /^gemini-25-flash-lite/, canonical: 'gemini-2.5-flash-lite' },
    { test: /^gemini-25-flash/, canonical: 'gemini-2.5-flash' },
    { test: /^gemini-15-pro/, canonical: 'gemini-1.5-pro' },
    { test: /^gemini-15-flash/, canonical: 'gemini-1.5-flash' },
    { test: /^gemini-pro/, canonical: 'gemini-2.5-pro' },
    { test: /^gemini-flash/, canonical: 'gemini-2.5-flash' }
];

const SCENE_MODEL_OUTPUT_LIMITS = {
    "gemini-3-pro-preview": 65536,
    "gemini-2.5-flash-lite": 8192,
    "gemini-2.5-flash": 16384,
    "gemini-2.5-pro": 32768,
    "gpt-4o": 16384,
    "gpt-4-turbo": 16384,
    "gpt-3.5-turbo": 4096,
    "claude-sonnet-4": 8192,
    "claude-sonnet-4.5": 8192,
    "claude-3.5-haiku": 4096
};



function normalizeModelName(model = '') {
    let normalized = model
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '')
        .trim();

    normalized = normalized.replace(/-20\d{6,8}$/, '');

    for (const rule of MODEL_ALIAS_RULES) {
        if (rule.test.test(normalized)) {
            normalized = rule.canonical;
            break;
        }
    }

    return normalized;
}


function getTokenLimitsFrontend(model) {
    const m = normalizeModelName(model);
    
        if (TOKEN_LIMITS_FRONTEND[m]) {
        return TOKEN_LIMITS_FRONTEND[m];
    }

        const patterns = [
        { key: 'gpt-5.1', match: ['gpt-5.1', 'gpt51', 'gpt-5-1', 'gpt5.1'] },
        { key: 'gpt-4o', match: ['gpt-4o', 'gpt4o', 'gpt-4.1', 'gpt-4.0'] },
        { key: 'gpt-4-turbo', match: ['gpt-4-turbo', 'gpt4turbo'] },
        { key: 'gpt-3.5-turbo', match: ['gpt-3.5', 'gpt35'] },
        { key: 'claude-3-5-sonnet', match: ['claude-3-5-sonnet', 'claude-3-5', 'claude-35-sonnet'] },
        { key: 'claude-3-5-haiku', match: ['claude-3-5-haiku'] },
        { key: 'claude-3-opus', match: ['claude-3-opus', 'opus'] },
        { key: 'claude-3-sonnet', match: ['claude-3-sonnet'] },
        { key: 'claude-sonnet-4', match: ['claude-sonnet-4', 'claude-sonnet4', 'sonnet-4'] },
        { key: 'claude-sonnet-4.5', match: ['claude-sonnet-4.5', 'claude-sonnet4.5', 'sonnet-4.5'] },
        { key: 'gemini-3-pro-preview', match: ['gemini-3-pro-preview', 'gemini-3-pro', 'gemini3pro'] },
        { key: 'gemini-2.5-pro', match: ['gemini-2.5-pro'] },
        { key: 'gemini-2.5-flash-lite', match: ['gemini-2.5-flash-lite'] },
        { key: 'gemini-2.5-flash', match: ['gemini-2.5-flash'] },
        { key: 'gemini-1.5-pro', match: ['gemini-1.5-pro'] },
        { key: 'gemini-1.5-flash', match: ['gemini-1.5-flash'] }
    ];

    for (const p of patterns) {
        for (const rule of p.match) {
            if (m.includes(rule)) {
                return TOKEN_LIMITS_FRONTEND[p.key];
            }
        }
    }

        if (m.includes('gpt-5')) return TOKEN_LIMITS_FRONTEND['gpt-5.1'];
    if (m.includes('gpt-4')) return TOKEN_LIMITS_FRONTEND['gpt-4o'];
    if (m.includes('gpt-3.5')) return TOKEN_LIMITS_FRONTEND['gpt-3.5-turbo'];
    if (m.includes('claude-3-5')) return TOKEN_LIMITS_FRONTEND['claude-3-5-sonnet'];
    if (m.includes('claude-3')) return TOKEN_LIMITS_FRONTEND['claude-3-sonnet'];
    if (m.includes('gemini-3')) return TOKEN_LIMITS_FRONTEND['gemini-3-pro-preview'];
    if (m.includes('gemini-2.5')) {
        if (m.includes('flash-lite')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-flash-lite'];
        if (m.includes('flash')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-flash'];
        if (m.includes('pro')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-pro'];
        return TOKEN_LIMITS_FRONTEND['gemini-2.5-pro'];
    }
    if (m.includes('gemini-1.5')) return TOKEN_LIMITS_FRONTEND['gemini-1.5-pro'];
    if (m.includes('gemini')) return TOKEN_LIMITS_FRONTEND['gemini-2.5-flash'];

        console.warn(`⚠️ Modelo desconhecido: "${model}". Usando fallback conservador.`);
    return { maxContextLength: 16000, maxOutputTokens: 4000 };
}


function getSceneModelOutputLimit(modelName) {
    if (!modelName) return 8192;
    const normalized = normalizeModelName(modelName);
    const foundKey = Object.keys(SCENE_MODEL_OUTPUT_LIMITS).find(key => normalized.includes(normalizeModelName(key)));
    return SCENE_MODEL_OUTPUT_LIMITS[foundKey] || 8192;
}


function calcularLotes(modelName, totalPrompts, tokensPorPrompt = SCENE_TOKENS_PER_PROMPT) {
    const outputLimit = getSceneModelOutputLimit(modelName);
    const maxPromptsPorRequest = Math.max(1, Math.floor(outputLimit / tokensPorPrompt));
    const lotes = [];
    let restante = totalPrompts;

    while (restante > 0) {
        const quantidade = Math.min(maxPromptsPorRequest, restante);
        lotes.push(quantidade);
        restante -= quantidade;
    }

    return {
        modelo: modelName,
        totalPrompts,
        tokensPorPrompt,
        saidaMax: outputLimit,
        maxPromptsPorRequest,
        lotes,
        totalDeRequests: lotes.length
    };
}


function splitTextIntoWordChunks(text, maxWords) {
    if (!text || maxWords <= 0) return [];
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < words.length; i += maxWords) {
        const segmentWords = words.slice(i, i + maxWords);
        chunks.push({
            text: segmentWords.join(' '),
            startIndex: i,
            endIndex: i + segmentWords.length,
            wordCount: segmentWords.length
        });
    }
    return chunks;
}


function createSceneProcessingQueue(segments, sceneDistribution, maxPromptsPerRequest, preferredBatchSize = 2) {
    const batchLimit = Math.max(1, Math.min(maxPromptsPerRequest, preferredBatchSize));
    const queue = [];
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const targetScenes = sceneDistribution[i];

        if (targetScenes <= batchLimit) {
            queue.push({
                text: segment.text,
                wordCount: segment.wordCount,
                sceneTarget: targetScenes
            });
            continue;
        }

        const batchesNeeded = Math.ceil(targetScenes / batchLimit);
        const wordsPerBatch = Math.max(50, Math.ceil(segment.wordCount / batchesNeeded));
        const subSegments = splitTextIntoWordChunks(segment.text, wordsPerBatch);
        const usableSegments = subSegments.length ? subSegments : [{ text: segment.text, wordCount: segment.wordCount }];

        let remainingScenes = targetScenes;
        const totalWords = usableSegments.reduce((sum, sub) => sum + sub.wordCount, 0) || segment.wordCount;

        usableSegments.forEach((sub, idx) => {
            const remainingSegments = usableSegments.length - idx;
            let estimatedScenes = Math.min(
                batchLimit,
                Math.max(1, Math.round((sub.wordCount / totalWords) * targetScenes))
            );

            const minRemainingNeeded = Math.max(remainingSegments - 1, 0);
            if (estimatedScenes > remainingScenes - minRemainingNeeded) {
                estimatedScenes = remainingScenes - minRemainingNeeded;
            }
            if (estimatedScenes > batchLimit) {
                estimatedScenes = batchLimit;
            }
            if (estimatedScenes < 1) {
                estimatedScenes = Math.min(batchLimit, remainingScenes - minRemainingNeeded);
            }
            if (idx === usableSegments.length - 1) {
                estimatedScenes = remainingScenes;
            }
            remainingScenes -= estimatedScenes;

            queue.push({
                text: sub.text,
                wordCount: sub.wordCount,
                sceneTarget: estimatedScenes
            });
        });

        if (remainingScenes > 0 && queue.length > 0) {
            queue[queue.length - 1].sceneTarget += remainingScenes;
        }
    }

    return queue;
}



function renderSceneGenerationProgress(status) {
    let panel = document.getElementById('scene-gen-progress-panel');
    if (!panel) return;

    if (!status || !status.active) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    const {
        current = 0,
        total = 0,
        message,
        subMessage,
        chunkTotal = 0,
        chunkCurrent = 0
    } = status;
    const baseProgress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const stageProgress = status.stageProgress ? Math.min(99, Math.max(0, Math.round(status.stageProgress))) : 0;
    const progress = Math.max(baseProgress, stageProgress);
    const isComplete = total > 0 && current >= total;
    const safeChunkCurrent = chunkTotal > 0 ? Math.min(chunkCurrent, chunkTotal) : 0;
    const chunkPercent = chunkTotal > 0 ? Math.min(100, Math.round((safeChunkCurrent / chunkTotal) * 100)) : 0;

    let title, titleColor, progressBarColor;
    if (isComplete) {
        title = 'Geracao Concluida';
        titleColor = 'text-green-600 dark:text-green-400';
        progressBarColor = 'bg-green-500';
    } else {
        title = 'A gerar prompts de cena...';
        titleColor = 'text-blue-600 dark:text-blue-400';
        progressBarColor = 'bg-blue-500';
    }
    
    panel.innerHTML = `
        <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
                <h4 class="font-bold text-base ${titleColor} mb-1">${title}</h4>
                <p class="text-sm text-gray-700 dark:text-gray-300 font-medium" title="${message || ''}">${message || 'Preparando prompts...'}</p>
                ${subMessage ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">${subMessage}</p>` : ''}
            </div>
            <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-2" onclick="document.getElementById('scene-gen-progress-panel').style.display = 'none';">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
            </button>
        </div>
        <div class="space-y-3">
            <div>
                <div class="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    <span>Progresso Geral</span>
                    <span>${current}/${total || '?'} cena(s) - ${progress}%</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                    <div class="h-2.5 rounded-full ${progressBarColor} transition-all duration-300" style="width: ${progress}%;"></div>
                </div>
            </div>
            ${chunkTotal > 0 ? `
                <div>
                    <div class="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        <span>Progresso por Partes</span>
                        <span>Parte ${safeChunkCurrent}/${chunkTotal}</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div class="h-2 rounded-full bg-indigo-500 transition-all duration-300" style="width: ${chunkPercent}%;"></div>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}


function showSceneGenCompleteModal(durationInSeconds) {
    const modal = document.getElementById('scene-gen-complete-modal');
    if (!modal) return;

    const durationEl = document.getElementById('scene-gen-duration');
    if (durationEl) {
        durationEl.textContent = durationInSeconds !== undefined ? `Tempo total: ${durationInSeconds} segundos.` : '';
    }

    modal.style.display = 'flex';

    const closeBtn = document.getElementById('close-scene-gen-modal-btn');
    const viewBtn = document.getElementById('view-generated-scenes-btn');

        const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    const newViewBtn = viewBtn.cloneNode(true);
    viewBtn.parentNode.replaceChild(newViewBtn, viewBtn);

    newCloseBtn.onclick = () => modal.style.display = 'none';
    
    newViewBtn.onclick = () => {
        modal.style.display = 'none';
        document.querySelector('.sidebar-btn[data-tab="scene-prompts"]').click();
        setTimeout(() => {
            document.getElementById('output')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };
}


function saveSceneToHistory(sceneData, title) {
    let history = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');
    const newItem = {
        id: Date.now(),
        title: title || `Prompts de Cena - ${new Date().toLocaleString('pt-BR')}`,
        date: new Date().toLocaleString('pt-BR'),
        data: sceneData
    };
    history.unshift(newItem);
    if (history.length > 20) history.pop();     localStorage.setItem('scenePromptHistory', JSON.stringify(history));
}


function renderSceneHistory() {
    const historyContainer = document.getElementById('scene-history-container');
    if (!historyContainer) return;

    const history = JSON.parse(localStorage.getItem('scenePromptHistory') || '[]');

    if (history.length === 0) {
        historyContainer.innerHTML = '';
        return;
    }

    let historyHtml = `
        <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Historico de Prompts de Cena</h3>
        <div class="space-y-3">
            ${history.map(item => `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex justify-between items-center">
                    <div>
                        <p class="font-semibold text-gray-900 dark:text-gray-100">${item.title || 'Prompts de Cena sem titulo'}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${item.date}</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="load-scene-prompts-btn text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40" data-history-id="${item.id}">Carregar</button>
                        <button class="delete-scene-prompts-btn text-sm bg-red-100 text-red-800 px-3 py-1 rounded-md hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40" data-history-id="${item.id}">Excluir</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <button id="clear-scene-history-btn" class="w-full mt-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">Limpar todo o Historico</button>
    `;
    historyContainer.innerHTML = historyHtml;
}


function renderScenePage() {
    const outputEl = document.getElementById('output');
    const paginationEl = document.getElementById('scene-pagination-controls');
    if (!outputEl || !paginationEl) return;

    const { createCopyButton } = getGlobalUtils();
    let scenePromptResults = window.scenePromptResults || { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
    const { data, currentPage, scenesPerPage, total_prompts } = scenePromptResults;

    if (!data || data.length === 0) {
        outputEl.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Nenhum prompt de cena foi gerado ainda.</p>';
        paginationEl.innerHTML = '';
        return;
    }

    const totalScenes = data.length;
    const totalPages = Math.ceil(total_prompts / scenesPerPage);
    const start = (currentPage - 1) * scenesPerPage;
    const end = start + scenesPerPage;
    const scenesToShow = data.slice(start, end);

    scenePromptResults.allPromptsText = data.map((item, index) => `--- CENA ${index + 1}: ${item.scene_description || 'Descricao da Cena'} ---\nPROMPT: "${item.prompt_text || 'N/A'}"`).join('\n\n');
    scenePromptResults.rawPromptsText = data.map(item => item.prompt_text || '').filter(Boolean).join('\n');
    
    let continueButtonHtml = '';
    if (data.length < total_prompts) {
         continueButtonHtml = `<div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-4"><button id="continue-scene-prompts-btn" class="w-full text-center py-3 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">Continuar Geracao</button></div>`;
    }

    outputEl.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Prompts de Cena Gerados (${totalScenes} prompts)</h3>
            <div class="flex gap-2">
                <button id="copy-all-scene-prompts" class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 font-semibold dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40">Copiar Todos (Detalhes)</button>
                <button id="download-scene-prompts-detailed" class="text-sm bg-green-100 text-green-800 px-3 py-1 rounded hover:bg-green-200 font-semibold dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40">Transferir Detalhes (.txt)</button>
                <button id="download-scene-prompts-raw" class="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded hover:bg-purple-200 font-semibold dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40">Transferir Prompts Puros (.txt)</button>
            </div>
        </div>
        ${continueButtonHtml}
        <div class="space-y-4">
            ${scenesToShow.map((item, index) => `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-bold text-gray-900 dark:text-gray-100 flex-1">Cena ${start + index + 1}: ${item.scene_description || 'Descricao da Cena'}</h4>
                        ${createCopyButton(item.prompt_text || '', 'p-1 rounded-md text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600')}
                    </div>
                    <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto whitespace-pre-wrap">${item.prompt_text || 'N/A'}</div>
                </div>
            `).join('')}
        </div>
    `;
    if (totalPages > 1) {
        paginationEl.innerHTML = Array.from({ length: totalPages }, (_, i) => `<button class="scene-page-btn px-4 py-2 text-sm rounded-md ${i + 1 === currentPage ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}" data-page="${i + 1}">${i + 1}</button>`).join('');
        paginationEl.querySelectorAll('.scene-page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!window.scenePromptResults) window.scenePromptResults = { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
                window.scenePromptResults.currentPage = parseInt(e.target.dataset.page, 10);
                renderScenePage();
            });
        });
    } else {
        paginationEl.innerHTML = '';
    }
}


if (typeof window !== 'undefined' && !window.scenePromptResults) {
    window.scenePromptResults = { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };
}



async function generateScenePromptsHandler(e) {
    const utils = getGlobalUtils();
    const {
        showSuccessToast,
        addToLog,
        apiRequestWithFallback,
        removeAccents,
        createCopyButton
    } = utils;

        const appState = window.appState || {};
    let scenePromptResults = window.scenePromptResults || { data: [], currentPage: 1, scenesPerPage: 10, allPromptsText: '', rawPromptsText: '', originalScript: '' };

    const startTime = Date.now();
    const text = document.getElementById('scene-text')?.value.trim();
    const model = document.getElementById('scene-prompts-model-select')?.value;
    const imageModel = document.getElementById('scene-image-model')?.value;
    const lang = document.getElementById('scene-lang')?.value;
    const includeText = document.getElementById('scene-include-text')?.checked;
    const characters = document.getElementById('scene-characters')?.value.trim();
    
        console.log(`🎬 Gerando prompts de cena com modelo: "${model}"`);
    
    if (!text || !model || !imageModel || !lang) {
        showSuccessToast("Por favor, preencha todos os campos.");
        return;
    }

    const mode = document.getElementById('generation-mode')?.value;
    const wordCount = parseInt(document.getElementById('scene-word-count')?.value, 10);
    const style = document.getElementById('scene-style')?.value;
    const styleInstruction = style && style !== 'none' ? ` O estilo visual principal deve ser '${removeAccents(style)}'.` : '';
    const textInstruction = includeText 
        ? `Se o prompt incluir texto para ser renderizado na imagem, esse texto DEVE estar no idioma "${removeAccents(lang)}".`
        : "O prompt NAO DEVE incluir nenhuma instrucao para adicionar texto.";
    const characterInstruction = characters ? ` Mantenha a consistencia dos seguintes personagens em todas as cenas: ${removeAccents(characters)}.` : '';
    const rawWords = text.split(/\s+/).filter(Boolean);
    const totalWords = rawWords.length;
    const estimatedScenes = Math.max(1, Math.round(totalWords / 90));
    const minScenes = Math.max(1, Math.floor(totalWords / 140));
    const maxScenes = Math.max(estimatedScenes + 2, Math.ceil(totalWords / 60));

    let chunks = [];
    scenePromptResults.data = [];     scenePromptResults.originalScript = text; 
    if (mode === 'manual') {
        if (wordCount <= 0) {
            showSuccessToast('Por favor, insira um numero de palavras valido.');
            return;
        }
        for (let i = 0; i < rawWords.length; i += wordCount) {
            chunks.push(rawWords.slice(i, i + wordCount).join(' '));
        }
        scenePromptResults.total_prompts = chunks.length;
    } else {         chunks.push(text);         scenePromptResults.total_prompts = null;     }

    const totalEstimate = mode === 'manual' ? Math.max(chunks.length, 1) : Math.max(estimatedScenes, 1);
    const initialMessage = mode === 'manual'
        ? `Gerando ${chunks.length} prompt(s) com blocos de ${wordCount} palavra(s)...`
        : `A IA está analisando ${totalWords} palavras para sugerir cerca de ${estimatedScenes} cenas (entre ${minScenes} e ${maxScenes}, se necessário).`;

    appState.sceneGenStatus = { 
        active: true, 
        current: 0, 
        total: totalEstimate, 
        message: initialMessage, 
        subMessage: '',
        chunkTotal: 0,
        chunkCurrent: 0,
        error: false 
    };
    renderSceneGenerationProgress(appState.sceneGenStatus);
    addToLog(mode === 'manual'
        ? `A gerar ${chunks.length} prompt(s) com blocos de ${wordCount} palavra(s)...`
        : `A IA está a calcular automaticamente o número ideal de cenas (~${estimatedScenes}) para o roteiro.`);

            try {
            } catch (error) {
        console.error('Erro ao gerar prompts de cena:', error);
        const errorMsg = error.message || "Erro ao gerar prompts de cena";
        const isSizeError = errorMsg.includes('SIZE_VALIDATION_FAILED');
        const isSceneMismatch = errorMsg.startsWith('SCENE_TOTAL_MISMATCH');
        
        if (isSceneMismatch) {
            addToLog('❌ Falha ao gerar todas as cenas. O sistema não conseguiu chegar à quantidade exata. Tente novamente ou use um modelo mais poderoso.', true);
            appState.sceneGenStatus.message = 'Falha: quantidade de cenas gerada não corresponde ao esperado.';
        } else if (isSizeError) {
            addToLog('❌ A IA não respeitou o limite de 600-1200 caracteres por prompt. Tente novamente.', true);
            appState.sceneGenStatus.message = 'Erro: Limite de caracteres não respeitado pela IA.';
        } else {
            addToLog(errorMsg, true);
            appState.sceneGenStatus.message = errorMsg;
        }
        
        appState.sceneGenStatus.error = true;
        
                if (errorMsg.includes('JSON')) {
            addToLog("Erro de formatação JSON detectado. A resposta da IA pode estar malformada.", true);
            console.error('Detalhes do erro JSON:', error);
        }
    } finally {
        renderSceneGenerationProgress(appState.sceneGenStatus);
        setTimeout(() => {
            appState.sceneGenStatus.active = false;
            renderSceneGenerationProgress(appState.sceneGenStatus);
        }, 5000);
    }
}


export default {
    id: 'scene-prompts',
    name: 'Prompts para Cenas',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    category: 'media',
    
    
    
    
    init() {
        console.log('✅ Módulo Scene Prompts inicializado');
        
                if (typeof window !== 'undefined') {
                        if (!window.getTokenLimitsFrontend) {
                window.getTokenLimitsFrontend = getTokenLimitsFrontend;
            }
            if (!window.normalizeModelName) {
                window.normalizeModelName = normalizeModelName;
            }
            if (!window.splitTextIntoWordChunks) {
                window.splitTextIntoWordChunks = splitTextIntoWordChunks;
            }
            if (!window.calcularLotes) {
                window.calcularLotes = calcularLotes;
            }
            if (!window.createSceneProcessingQueue) {
                window.createSceneProcessingQueue = createSceneProcessingQueue;
            }
            if (!window.getSceneModelOutputLimit) {
                window.getSceneModelOutputLimit = getSceneModelOutputLimit;
            }
            
                        if (!window.renderSceneGenerationProgress) {
                window.renderSceneGenerationProgress = renderSceneGenerationProgress;
            }
            if (!window.renderScenePage) {
                window.renderScenePage = renderScenePage;
            }
            if (!window.saveSceneToHistory) {
                window.saveSceneToHistory = saveSceneToHistory;
            }
            if (!window.renderSceneHistory) {
                window.renderSceneHistory = renderSceneHistory;
            }
            if (!window.showSceneGenCompleteModal) {
                window.showSceneGenCompleteModal = showSceneGenCompleteModal;
            }
            
                        if (!window.RECOMMENDED_MODEL) {
                window.RECOMMENDED_MODEL = RECOMMENDED_MODEL;
            }
            if (!window.SCENE_TOKENS_PER_PROMPT) {
                window.SCENE_TOKENS_PER_PROMPT = SCENE_TOKENS_PER_PROMPT;
            }
        }
    }
};
