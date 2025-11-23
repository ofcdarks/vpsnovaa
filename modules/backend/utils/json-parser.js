/**
 * Parser robusto de JSON
 * Tenta múltiplas estratégias para parsear JSON malformado
 */

function parseJsonRobustly(text, source = "Unknown") {
    if (!text || typeof text !== 'string') {
        throw new Error(`Texto inválido recebido de ${source}`);
    }

    // Limpar o texto
    let cleanedText = text.trim();

    // Estratégia 1: Tentar parse direto
    try {
        return JSON.parse(cleanedText);
    } catch (e1) {
        // Continua para outras estratégias
    }

    // Estratégia 2: Remover markdown code blocks
    cleanedText = cleanedText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/^```/gm, '')
        .replace(/```$/gm, '')
        .trim();

    try {
        return JSON.parse(cleanedText);
    } catch (e2) {
        // Continua
    }

    // Estratégia 3: Remover texto antes/depois do JSON
    const firstBrace = cleanedText.indexOf('{');
    const firstBracket = cleanedText.indexOf('[');
    const lastBrace = cleanedText.lastIndexOf('}');
    const lastBracket = cleanedText.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        try {
            let extracted = cleanedText.substring(firstBracket, lastBracket + 1);
            extracted = extracted.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(extracted);
        } catch (e3) {
            // Continua
        }
    }

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            let extracted = cleanedText.substring(firstBrace, lastBrace + 1);
            extracted = extracted.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(extracted);
        } catch (e4) {
            // Continua
        }
    }

    // Estratégia 4: Tentar corrigir JSON comum
    try {
        let fixed = cleanedText
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            .replace(/:\s*([^",\[\]{}]+)(\s*[,}\]])/g, (match, value, ending) => {
                if (!value.match(/^(true|false|null|\d+)$/)) {
                    return `: "${value.replace(/"/g, '\\"')}"${ending}`;
                }
                return match;
            });
        return JSON.parse(fixed);
    } catch (e5) {
        // Última tentativa falhou
    }

    // Se todas as estratégias falharam
    console.error(`[${source} JSON Parse Error] Todas as estratégias falharam.`);
    console.error(`Texto recebido (primeiros 500 chars):`, cleanedText.substring(0, 500));
    const errorMessage = e1 ? e1.message : 'JSON inválido ou incompleto';
    throw new Error(`Falha ao gerar conteúdo: JSON incompleto ou malformado da ${source} API. Detalhes: ${errorMessage}. Por favor, tente novamente.`);
}

module.exports = { parseJsonRobustly };

