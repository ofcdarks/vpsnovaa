// Lista de palavras-chave sensíveis que podem acionar filtros de segurança.
// Esta lista é conservadora para evitar falsos positivos.
const sensitiveKeywords = [
    'sangue', 'violencia', 'morte', 'explicito', 'sensual', 'sexual',
    'ferida', 'gore', 'macabro', 'assustador', 'perturbador', 'exposto',
    'tortura', 'abuso', 'suicidio', 'cadaver', 'partes do corpo',
    'celebridade', 'famoso', 'politico', 'realista', 'foto de'
    // Adicionar outras palavras conforme necessário
];

// Regex para detectar as palavras-chave como palavras inteiras (evita falsos positivos)
const keywordRegex = new RegExp(`\\b(${sensitiveKeywords.join('|')})\\b`, 'gi');

const keywordReplacements = {
    'sangue': 'fluido vermelho',
    'violencia': 'conflito',
    'morte': 'final dramático',
    'explicito': 'detalhado',
    'sensual': 'elegante',
    'sexual': 'romântico',
    'ferida': 'marca',
    'gore': 'detalhes intensos',
    'macabro': 'sombrio',
    'assustador': 'intenso',
    'perturbador': 'impactante',
    'exposto': 'visível',
    'tortura': 'sofrimento extremo',
    'abuso': 'tratamento inadequado',
    'suicidio': 'autoagressao',
    'cadaver': 'figura inerte',
    'partes do corpo': 'detalhes anatômicos',
    'celebridade': 'pessoa conhecida',
    'famoso': 'pessoa conhecida',
    'politico': 'figura pública',
    'realista': 'hiper-realista',
    'foto de': 'retrato de'
};

/**
 * Remove ou substitui palavras-chave sensíveis de um prompt.
 * @param {string} prompt - O prompt original.
 * @returns {{sanitized: string, alerts: string[]}} - O prompt limpo e uma lista de alertas.
 */
function sanitizePrompt(prompt) {
    const alerts = [];
    let sanitized = prompt;

    const matches = prompt.match(keywordRegex);

    if (matches) {
        const uniqueMatches = [...new Set(matches.map(m => m.toLowerCase()))];
        alerts.push(`As seguintes palavras foram removidas ou podem ser sensíveis: ${uniqueMatches.join(', ')}.`);
        
        sanitized = prompt.replace(keywordRegex, (match) => {
            const replacement = keywordReplacements[match.toLowerCase()];
            return replacement ? replacement : '';
        }).replace(/\s\s+/g, ' ').trim();
    }

    return {
        sanitized: sanitized || "imagem abstrata colorida", // Fallback para evitar prompt vazio
        alerts
    };
}

module.exports = { sanitizePrompt };