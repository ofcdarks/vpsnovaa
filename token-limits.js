/**
 * Token Limits Dataset (Updated for 2024/2025 APIs)
 * Valores oficiais ou equivalentes por similaridade entre versões.
 */

const TOKEN_LIMITS = {
    // ==============================
    // OPENAI
    // ==============================
    'gpt-5.1': {
        maxContextLength: 200000,
        maxOutputTokens: 32768
    },
    'gpt-4o': {
        maxContextLength: 128000,
        maxOutputTokens: 16384
    },
    'gpt-4-turbo': {
        maxContextLength: 128000,
        maxOutputTokens: 16384
    },
    'gpt-3.5-turbo': {
        maxContextLength: 16385,
        maxOutputTokens: 4096
    },

    // ==============================
    // ANTHROPIC (Claude)
    // ==============================
    'claude-3-5-sonnet': {
        maxContextLength: 200000,
        maxOutputTokens: 8192
    },
    'claude-3-5-haiku': {
        maxContextLength: 200000,
        maxOutputTokens: 4096
    },
    'claude-3-opus': {
        maxContextLength: 200000,
        maxOutputTokens: 4096
    },
    'claude-3-sonnet': {
        maxContextLength: 200000,
        maxOutputTokens: 4096
    },
    'claude-sonnet-4': {
        maxContextLength: 200000,
        maxOutputTokens: 8192
    },
    'claude-sonnet-4.5': {
        maxContextLength: 200000,
        maxOutputTokens: 8192
    },

    // ==============================
    // GOOGLE GEMINI
    // ==============================
    'gemini-2.5-pro': {
        maxContextLength: 2000000,
        maxOutputTokens: 32768
    },
    'gemini-2.5-flash': {
        maxContextLength: 1000000,
        maxOutputTokens: 16384
    },
    'gemini-2.5-flash-lite': {
        maxContextLength: 1000000,
        maxOutputTokens: 8192
    },
    'gemini-1.5-pro': {
        maxContextLength: 2000000,
        maxOutputTokens: 8192
    },
    'gemini-1.5-flash': {
        maxContextLength: 1000000,
        maxOutputTokens: 8192
    }
};

const MODEL_ALIAS_RULES = [
    { test: /^claude-sonnet-4-5/, canonical: 'claude-sonnet-4.5' },
    { test: /^gpt-4o-mini/, canonical: 'gpt-4o' },
    { test: /^gemini-2\.0-flash-exp/, canonical: 'gemini-2.5-flash' }
];

/**
 * Normaliza o nome de um modelo para facilitar matching.
 * Ex: "Claude-4-5-Haiku-20251001" → "claude-4-5-haiku"
 */
function normalizeModelName(model) {
    if (!model) return '';

    let normalized = model
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '')
        .trim();

    // Remover sufixos de data das APIs (ex.: -20250929)
    normalized = normalized.replace(/-20\d{6,8}$/, '');

    // Aplicar regras de alias conhecidas
    for (const rule of MODEL_ALIAS_RULES) {
        if (rule.test.test(normalized)) {
            normalized = rule.canonical;
            break;
        }
    }

    return normalized;
}

/**
 * Smart Matching entre modelo pedido e dataset de limites.
 */
function getTokenLimits(model) {
    const m = normalizeModelName(model);

    // 1) Matching direto
    if (TOKEN_LIMITS[m]) {
        return TOKEN_LIMITS[m];
    }

    // 2) Matching por prefixos bancados pelas APIs reais
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
        { key: 'gemini-2.5-pro', match: ['gemini-2.5-pro'] },
        { key: 'gemini-2.5-flash-lite', match: ['gemini-2.5-flash-lite'] },
        { key: 'gemini-2.5-flash', match: ['gemini-2.5-flash'] },
        { key: 'gemini-1.5-pro', match: ['gemini-1.5-pro'] },
        { key: 'gemini-1.5-flash', match: ['gemini-1.5-flash'] }
    ];

    for (const p of patterns) {
        for (const rule of p.match) {
            if (m.includes(rule)) {
                return TOKEN_LIMITS[p.key];
            }
        }
    }

    // 3) Matching genérico por tipo
    if (m.includes('gpt-5')) return TOKEN_LIMITS['gpt-5.1'];
    if (m.includes('gpt-4')) return TOKEN_LIMITS['gpt-4o'];
    if (m.includes('gpt-3.5')) return TOKEN_LIMITS['gpt-3.5-turbo'];
    if (m.includes('claude-3-5')) return TOKEN_LIMITS['claude-3-5-sonnet'];
    if (m.includes('claude-3')) return TOKEN_LIMITS['claude-3-sonnet'];
    if (m.includes('gemini-2.5')) return TOKEN_LIMITS['gemini-2.5-pro'];
    if (m.includes('gemini-1.5')) return TOKEN_LIMITS['gemini-1.5-pro'];
    if (m.includes('gemini')) return TOKEN_LIMITS['gemini-2.5-flash'];

    // 4) Fallback super seguro
    console.warn(`⚠️ Modelo desconhecido: "${model}". Usando fallback conservador.`);
    return {
        maxContextLength: 16000,
        maxOutputTokens: 4000
    };
}

/**
 * Estimativa de tokens (português ≈ 3.5 chars por token)
 */
function estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / 3.5);
}

/**
 * Verifica se a solicitação cabe nos limites do modelo.
 */
function canFitInLimits(model, promptText, desiredOutputTokens) {
    const limits = getTokenLimits(model);
    const promptTokens = estimateTokens(promptText);

    const outputTokens = desiredOutputTokens || limits.maxOutputTokens;
    const total = promptTokens + outputTokens;

    return {
        fits: total <= limits.maxContextLength,
        promptTokens,
        outputTokens,
        totalNeeded: total,
        maxContextLength: limits.maxContextLength,
        maxOutputTokens: limits.maxOutputTokens,
        remainingTokens: limits.maxContextLength - total
    };
}

module.exports = {
    TOKEN_LIMITS,
    getTokenLimits,
    estimateTokens,
    canFitInLimits,
    normalizeModelName
};
