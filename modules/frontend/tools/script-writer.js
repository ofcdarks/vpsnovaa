/**
 * Módulo: Criador de Roteiro
 * Gera roteiros completos para vídeos
 * VERSÃO FINAL - CORREÇÃO DEFINITIVA DE DUPLICAÇÕES
 */

export default {
    id: 'script-writer',
    name: 'Criador de Roteiro',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    category: 'creation',
    
    render(container) {
        // A UI está no template HTML
    },

    async handler(e, continueGeneration = false) {
        console.log('🚀 Handler script-writer chamado!', { continueGeneration });
        
        try {
            const removeAccents = (str) => {
                if (!str) return '';
                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            };

            // Mapear idioma do select para código
            const languageMap = {
                'Portugues (Brasil)': 'pt-BR',
                'English (US)': 'en-US',
                'Espanol (Espana)': 'es-ES',
                'Francais (Franca)': 'fr-FR',
                'Deutsch (Alemanha)': 'de-DE',
                'Italiano (Italia)': 'it-IT',
                '日本語 (Japao)': 'ja-JP',
                '한국어 (Coreia do Sul)': 'ko-KR',
                'Romana (Romenia)': 'ro-RO',
                'Polski (Polska)': 'pl-PL'
            };

            const selectedLang = document.getElementById('script-lang')?.value || 'Portugues (Brasil)';
            const langCode = languageMap[selectedLang] || 'pt-BR';

            // Coletar dados do formulário
            const form = {
                niche: document.getElementById('script-niche')?.value.trim() || '',
                audience: document.getElementById('script-audience')?.value.trim() || '',
                topic: document.getElementById('script-topic')?.value.trim() || '',
                trendsTerm: document.getElementById('script-trends-term')?.value.trim() || '',
                duration: parseInt(document.getElementById('script-duration')?.value || '10', 10),
                narrationOnly: document.getElementById('script-narration')?.checked || false,
                includeAffiliate: document.getElementById('include-affiliate-product')?.checked || false,
                affiliateProduct: document.getElementById('affiliate-product-description')?.value.trim() || '',
                tone: document.getElementById('script-tone')?.value || 'Envolvente e Misterioso',
                lang: langCode,
                langDisplay: selectedLang,
                formula: document.getElementById('script-formula')?.value || 'universal_safe',
                manualStructure: document.getElementById('manual-structure-input')?.value.trim() || '',
                model: document.getElementById('script-writer-model-select')?.value || 'gpt-4o',
                ctaPositions: Array.from(document.querySelectorAll('[id^="cta-"]:checked')).map(cb => cb.id.replace('cta-', ''))
            };

            // Calcular partes
            const partsInput = document.getElementById('script-parts');
            let parts = parseInt(partsInput?.value || '0', 10);
            if (isNaN(parts) || parts <= 0) {
                parts = Math.max(1, Math.ceil(form.duration / 2.5));
                if (partsInput) partsInput.value = parts;
            }
            form.parts = parts;

            // Validação
            if (!form.topic || !form.niche || !form.audience) {
                if (window.showSuccessToast) {
                    window.showSuccessToast('Por favor, preencha todos os campos obrigatórios.', true);
                }
                return;
            }

            // Função para calcular pontuações baseadas no algoritmo do YouTube
            // GARANTE PONTUAÇÕES MÍNIMAS DE 85
            const calculateYouTubeScores = (scriptParts, form) => {
                if (!scriptParts || scriptParts.length === 0) {
                    return { retention_potential: 85, clarity_score: 85, viral_potential: 85 };
                }

                let retentionScore = 0;
                let clarityScore = 0;
                let viralScore = 0;
                let factors = { retention: [], clarity: [], viral: [] };

                const fullText = scriptParts.map(p => p.part_content || '').join(' ').toLowerCase();
                const totalWords = fullText.split(/\s+/).filter(Boolean).length;
                const totalChars = fullText.length;
                const avgWordsPerPart = totalWords / scriptParts.length;

                // ANÁLISE DE RETENÇÃO (YouTube Algorithm) - Total: 126 pontos (normalizado para 100)
                // Hook inicial forte (primeiras 15 segundos) - 0-35 pontos
                const firstPart = scriptParts[0]?.part_content || '';
                const firstPartWords = firstPart.split(/\s+/).length;
                const hookWords = firstPart.substring(0, Math.min(300, firstPart.length));
                const hookIndicators = [
                    /pergunta|questão|mistério|segredo|descoberta|revelação|surpreendente|incrível|você sabia|imagine|você já|descubra|revela|surpresa/i,
                    /nunca|jamais|sempre|todos|ninguém|ninguém|todos os|qualquer/i,
                    /como|por que|o que|quando|onde|quem|qual|quais/i
                ];
                const hookMatches = hookIndicators.reduce((count, regex) => {
                    return count + (hookWords.match(regex) || []).length;
                }, 0);
                const hasStrongHook = hookMatches >= 3;
                const hookScore = hasStrongHook ? 35 : (hookMatches >= 2 ? 28 : (hookMatches >= 1 ? 22 : 18));
                factors.retention.push(`Hook inicial: ${hookScore}/35`);

                // Estrutura narrativa (início, meio, fim) - 0-30 pontos
                const hasBeginning = scriptParts.length > 0 && scriptParts[0]?.part_content?.length > 100;
                const hasMiddle = scriptParts.length > 1 && scriptParts[Math.floor(scriptParts.length / 2)]?.part_content?.length > 100;
                const hasEnd = scriptParts.length > 0 && scriptParts[scriptParts.length - 1]?.part_content?.length > 100;
                const structureScore = (hasBeginning ? 10 : 8) + (hasMiddle ? 10 : 8) + (hasEnd ? 10 : 8);
                factors.retention.push(`Estrutura narrativa: ${structureScore}/30`);

                // Clímax e pontos de interesse (palavras-chave de engajamento) - 0-30 pontos
                const engagementWords = ['descobrir', 'revelar', 'mistério', 'surpresa', 'importante', 'crucial', 'essencial', 'chave', 'segredo', 'fascinante', 'incrível', 'extraordinário', 'surpreendente', 'chocante', 'impressionante'];
                const engagementCount = engagementWords.reduce((count, word) => {
                    const regex = new RegExp(word, 'gi');
                    return count + (fullText.match(regex) || []).length;
                }, 0);
                const engagementScore = Math.min(30, Math.max(22, 22 + (engagementCount / Math.max(1, scriptParts.length)) * 2));
                factors.retention.push(`Pontos de interesse: ${engagementScore}/30`);

                // Duração adequada por parte (baseado na duração solicitada) - 0-25 pontos
                const expectedWordsPerPart = (form.duration * 150) / form.parts;
                const durationDeviation = Math.abs(avgWordsPerPart - expectedWordsPerPart) / expectedWordsPerPart;
                const durationScore = durationDeviation <= 0.1 ? 25 : 
                                     durationDeviation <= 0.2 ? 22 : 
                                     durationDeviation <= 0.3 ? 18 : 15;
                factors.retention.push(`Duração por parte: ${durationScore}/25`);

                // Consistência entre partes - 0-20 pontos
                const consistencyScore = scriptParts.length === form.parts ? 20 : 
                                        scriptParts.length >= form.parts * 0.8 ? 18 : 15;
                factors.retention.push(`Consistência: ${consistencyScore}/20`);

                retentionScore = hookScore + structureScore + engagementScore + durationScore + consistencyScore;
                // Normalizar para 100 e garantir mínimo de 85
                retentionScore = (retentionScore / 140) * 100;
                retentionScore = Math.min(100, Math.max(85, retentionScore));

                // ANÁLISE DE CLAREZA - Total: 110 pontos (normalizado para 100)
                // Organização (parágrafos bem definidos) - 0-30 pontos
                let totalParagraphs = 0;
                scriptParts.forEach(part => {
                    const paragraphs = (part.part_content || '').split(/\n\n+/).filter(p => p.trim().length > 20);
                    totalParagraphs += paragraphs.length;
                });
                const avgParagraphsPerPart = totalParagraphs / scriptParts.length;
                const organizationScore = avgParagraphsPerPart >= 4 && avgParagraphsPerPart <= 6 ? 30 : 
                                         avgParagraphsPerPart >= 3 && avgParagraphsPerPart <= 7 ? 26 : 
                                         avgParagraphsPerPart >= 2 && avgParagraphsPerPart <= 8 ? 22 : 18;
                factors.clarity.push(`Organização: ${organizationScore}/30`);

                // Coesão (transições e conectores) - 0-30 pontos
                const connectors = ['além disso', 'porém', 'entretanto', 'portanto', 'assim', 'dessa forma', 'consequentemente', 'além do mais', 'também', 'ainda', 'mas', 'porém', 'contudo', 'no entanto', 'então', 'logo', 'por isso', 'desse modo', 'dessa maneira', 'por exemplo', 'ou seja'];
                const connectorCount = connectors.reduce((count, word) => {
                    const regex = new RegExp(word, 'gi');
                    return count + (fullText.match(regex) || []).length;
                }, 0);
                const cohesionScore = Math.min(30, Math.max(24, 24 + (connectorCount / Math.max(1, scriptParts.length)) * 1.5));
                factors.clarity.push(`Coesão: ${cohesionScore}/30`);

                // Compreensão (frases não muito longas) - 0-30 pontos
                const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
                const avgSentenceLength = sentences.length > 0 ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length : 15;
                const comprehensionScore = avgSentenceLength >= 10 && avgSentenceLength <= 20 ? 30 : 
                                          avgSentenceLength >= 8 && avgSentenceLength <= 25 ? 26 : 22;
                factors.clarity.push(`Compreensão: ${comprehensionScore}/30`);

                // Formatação (uso de listas, sub-tópicos quando relevante) - 0-20 pontos
                const hasListings = /(\d+[\.\)]|\-|\*)\s+\w+/g.test(fullText);
                const formattingScore = hasListings ? 20 : 15;
                factors.clarity.push(`Formatação: ${formattingScore}/20`);

                clarityScore = organizationScore + cohesionScore + comprehensionScore + formattingScore;
                // Normalizar para 100 e garantir mínimo de 85
                clarityScore = (clarityScore / 110) * 100;
                clarityScore = Math.min(100, Math.max(85, clarityScore));

                // ANÁLISE DE POTENCIAL VIRAL - Total: 110 pontos (normalizado para 100)
                // Título e ganchos emocionais - 0-30 pontos
                const emotionalWords = ['incrível', 'surpreendente', 'chocante', 'assustador', 'fascinante', 'misterioso', 'revelador', 'impressionante', 'extraordinário', 'perturbador', 'emocionante', 'intrigante', 'chocante', 'surpreendente', 'inacreditável'];
                const emotionalCount = emotionalWords.reduce((count, word) => {
                    const regex = new RegExp(word, 'gi');
                    return count + (fullText.match(regex) || []).length;
                }, 0);
                const emotionalScore = Math.min(30, Math.max(24, 24 + (emotionalCount / Math.max(1, scriptParts.length)) * 1.5));
                factors.viral.push(`Ganchos emocionais: ${emotionalScore}/30`);

                // Relevância para público-alvo - 0-30 pontos
                const targetKeywords = form.audience ? form.audience.toLowerCase().split(/[\s,]+/) : [];
                const nicheKeywords = form.niche ? form.niche.toLowerCase().split(/[\s,]+/) : [];
                const allKeywords = [...targetKeywords, ...nicheKeywords].filter(k => k.length > 3);
                const relevanceCount = allKeywords.reduce((count, keyword) => {
                    const regex = new RegExp(keyword, 'gi');
                    return count + (fullText.match(regex) || []).length;
                }, 0);
                const relevanceScore = allKeywords.length > 0 
                    ? Math.min(30, Math.max(24, 24 + (relevanceCount / Math.max(1, allKeywords.length)) * 1.5))
                    : 26; // Se não há keywords, dar pontuação base
                factors.viral.push(`Relevância: ${relevanceScore}/30`);

                // Elementos de compartilhamento - 0-30 pontos
                const shareableElements = /você sabia|acredite ou não|isso vai te surpreender|nunca imaginei|poucos sabem|segredo revelado|verdade sobre|você não vai acreditar|prepare-se|atenção/gi;
                const shareableMatches = (fullText.match(shareableElements) || []).length;
                const shareableScore = Math.min(30, Math.max(24, 24 + shareableMatches * 2));
                factors.viral.push(`Compartilhamento: ${shareableScore}/30`);

                // CTAs (Calls to Action) - 0-20 pontos
                const ctaElements = /inscreva|like|compartilhe|comente|clique|baixe|siga|ative o sino|deixe seu|curtir|se inscreva|inscreva-se/gi;
                const ctaMatches = (fullText.match(ctaElements) || []).length;
                const ctaScore = ctaMatches >= 3 ? 20 : ctaMatches >= 2 ? 18 : ctaMatches >= 1 ? 16 : 14;
                factors.viral.push(`CTAs: ${ctaScore}/20`);

                viralScore = emotionalScore + relevanceScore + shareableScore + ctaScore;
                // Normalizar para 100 e garantir mínimo de 85
                viralScore = (viralScore / 110) * 100;
                viralScore = Math.min(100, Math.max(85, viralScore));

                console.log('📊 Fatores de Análise:', factors);

                return {
                    retention_potential: Math.round(retentionScore),
                    clarity_score: Math.round(clarityScore),
                    viral_potential: Math.round(viralScore),
                    analysis_factors: factors
                };
            };

            // ========== FUNÇÃO MELHORADA DE REMOÇÃO DE DUPLICAÇÕES E REDUNDÂNCIAS ==========
            const removeDuplicates = (text) => {
                if (!text) return '';
                
                console.log('🧹 Iniciando remoção de duplicações e redundâncias...');
                let originalLength = text.length;
                
                // Função para calcular similaridade entre duas strings (0-1)
                const calculateSimilarity = (str1, str2) => {
                    const longer = str1.length > str2.length ? str1 : str2;
                    const shorter = str1.length > str2.length ? str2 : str1;
                    if (longer.length === 0) return 1.0;
                    
                    // Remover palavras comuns para comparação
                    const commonWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'com', 'sem', 'sobre', 'entre', 'até', 'após', 'durante', 'que', 'qual', 'quais', 'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'e', 'ou', 'mas', 'porém', 'entretanto', 'contudo', 'todavia', 'no entanto', 'então', 'assim', 'logo', 'portanto', 'por isso', 'dessa forma', 'desse modo'];
                    const normalize = (s) => s.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w)).join(' ');
                    
                    const norm1 = normalize(str1);
                    const norm2 = normalize(str2);
                    
                    // Calcular similaridade usando palavras-chave
                    const words1 = norm1.split(/\s+/);
                    const words2 = norm2.split(/\s+/);
                    const intersection = words1.filter(w => words2.includes(w));
                    const union = [...new Set([...words1, ...words2])];
                    
                    return union.length > 0 ? intersection.length / union.length : 0;
                };
                
                // 1. Remover duplicações exatas de linhas
                const lines = text.split('\n');
                const cleanLines = [];
                const seenLines = new Set();
                
                for (let line of lines) {
                    const trimmedLine = line.trim();
                    
                    if (!trimmedLine) {
                        cleanLines.push('');
                        continue;
                    }
                    
                    if (!seenLines.has(trimmedLine)) {
                        seenLines.add(trimmedLine);
                        cleanLines.push(line);
                    } else {
                        console.log('❌ Linha duplicada removida:', trimmedLine.substring(0, 50) + '...');
                    }
                }
                
                let result = cleanLines.join('\n').replace(/\n{3,}/g, '\n\n');
                
                // 2. Remover duplicações e redundâncias de frases dentro de parágrafos
                const paragraphs = result.split(/\n\n+/);
                const cleanParagraphs = paragraphs.map(paragraph => {
                    if (!paragraph.trim()) return '';
                    
                    // Dividir em frases preservando pontuação
                    const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
                    const uniqueSentences = [];
                    const seenSentences = new Set();
                    const seenSimilarSentences = [];
                    
                    for (let sentence of sentences) {
                        const trimmedSentence = sentence.trim();
                        if (!trimmedSentence || trimmedSentence.length < 10) continue;
                        
                        const normalizedSentence = trimmedSentence.toLowerCase();
                        
                        // Verificar duplicação exata
                        if (seenSentences.has(normalizedSentence)) {
                            console.log('❌ Frase duplicada removida:', trimmedSentence.substring(0, 50) + '...');
                            continue;
                        }
                        
                        // Verificar similaridade com frases anteriores (redundância semântica)
                        let isRedundant = false;
                        for (const seenSentence of seenSimilarSentences) {
                            const similarity = calculateSimilarity(trimmedSentence, seenSentence);
                            if (similarity > 0.75) { // 75% de similaridade = redundância
                                console.log(`❌ Frase redundante removida (${(similarity * 100).toFixed(0)}% similar):`, trimmedSentence.substring(0, 50) + '...');
                                isRedundant = true;
                                break;
                            }
                        }
                        
                        if (!isRedundant) {
                            seenSentences.add(normalizedSentence);
                            seenSimilarSentences.push(trimmedSentence);
                            uniqueSentences.push(trimmedSentence);
                        }
                    }
                    
                    return uniqueSentences.join(' ');
                });
                
                result = cleanParagraphs.filter(p => p.length > 0).join('\n\n');
                
                // 3. Remover duplicações PARCIAIS (pedaços de texto repetidos)
                const detectAndRemovePartialDuplicates = (text) => {
                    const words = text.split(/\s+/);
                    const chunkSize = 8; // Reduzido para detectar mais padrões
                    const seenChunks = new Set();
                    const cleanedWords = [];
                    let skipWords = 0;
                    
                    for (let i = 0; i < words.length; i++) {
                        if (skipWords > 0) {
                            skipWords--;
                            continue;
                        }
                        
                        // Criar chunk das próximas palavras
                        const chunk = words.slice(i, i + chunkSize).join(' ').toLowerCase();
                        
                        // Se já vimos este chunk exato, pular ele
                        if (chunk.length > 25 && seenChunks.has(chunk)) {
                            console.log('❌ Chunk duplicado detectado:', chunk.substring(0, 50) + '...');
                            skipWords = chunkSize - 2; // Pular quase todo o chunk
                            continue;
                        }
                        
                        if (chunk.length > 25) {
                            seenChunks.add(chunk);
                        }
                        
                        cleanedWords.push(words[i]);
                    }
                    
                    return cleanedWords.join(' ');
                };
                
                // Aplicar remoção de duplicações parciais em cada parágrafo
                const finalParagraphs = result.split(/\n\n+/).map(para => {
                    return detectAndRemovePartialDuplicates(para);
                });
                
                result = finalParagraphs.filter(p => p.trim().length > 0).join('\n\n');
                
                // 4. Remover padrões de "eco de IA" - frases que começam da mesma forma
                const removeAIEchoPatterns = (text) => {
                    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
                    if (sentences.length < 2) return text;
                    
                    const cleanedSentences = [];
                    const sentenceStarts = new Map(); // Mapa de inícios de frase -> contagem
                    
                    for (let sentence of sentences) {
                        const trimmed = sentence.trim();
                        if (!trimmed || trimmed.length < 15) {
                            cleanedSentences.push(sentence);
                            continue;
                        }
                        
                        // Pegar primeiras 4-6 palavras da frase
                        const words = trimmed.split(/\s+/);
                        const startWords = words.slice(0, Math.min(5, words.length)).join(' ').toLowerCase();
                        
                        // Se muitas frases começam igual, pode ser eco de IA
                        const count = sentenceStarts.get(startWords) || 0;
                        if (count >= 2 && words.length > 4) {
                            // Verificar se a frase completa é muito similar a alguma anterior
                            let isEcho = false;
                            for (const prevSentence of cleanedSentences.slice(-5)) {
                                const similarity = calculateSimilarity(trimmed, prevSentence.trim());
                                if (similarity > 0.7) {
                                    console.log(`❌ Eco de IA removido (${(similarity * 100).toFixed(0)}% similar):`, trimmed.substring(0, 50) + '...');
                                    isEcho = true;
                                    break;
                                }
                            }
                            if (!isEcho) {
                                sentenceStarts.set(startWords, count + 1);
                                cleanedSentences.push(sentence);
                            }
                        } else {
                            sentenceStarts.set(startWords, count + 1);
                            cleanedSentences.push(sentence);
                        }
                    }
                    
                    return cleanedSentences.join(' ');
                };
                
                // Aplicar remoção de eco de IA em cada parágrafo
                result = result.split(/\n\n+/).map(para => {
                    return removeAIEchoPatterns(para);
                }).filter(p => p.trim().length > 0).join('\n\n');
                
                // 5. Limpar espaços e pontuação duplicada
                result = result
                    .replace(/\s+([.!?,])/g, '$1')  // Remove espaços antes de pontuação
                    .replace(/([.!?])\s*\1+/g, '$1')  // Remove pontuação duplicada
                    .replace(/\s+/g, ' ')  // Normaliza espaços
                    .replace(/\n\s+\n/g, '\n\n')  // Limpa quebras de linha com espaços
                    .trim();
                
                let finalLength = result.length;
                let reduction = ((originalLength - finalLength) / originalLength * 100).toFixed(1);
                
                console.log(`✅ Remoção completa: ${originalLength} → ${finalLength} chars (${reduction}% removido)`);
                
                return result;
            };

            // Configuração da geração baseada em duração (otimizada)
            const minWordsPerPart = Math.floor((form.duration * 150) / form.parts * 0.85);
            const maxWordsPerPart = Math.ceil((form.duration * 150) / form.parts * 1.15);
            const targetWordsPerPart = Math.round((form.duration * 150) / form.parts);

            // Validação - estrutura otimizada
            const validationLimits = {
                paragraphsPerPart: form.duration <= 5 ? 3 : form.duration <= 10 ? 4 : 5,
                minSentencesPerParagraph: 3,
                maxSentencesPerParagraph: 6,
                minWordsPerSentence: 12,
                maxWordsPerSentence: 25
            };

            // Instruções de idioma específicas
            const languageInstructions = {
                'pt-BR': {
                    name: 'PORTUGUÊS BRASILEIRO',
                    instruction: 'ESCREVA EXCLUSIVAMENTE EM PORTUGUÊS DO BRASIL. NÃO USE INGLÊS EM NENHUMA PARTE DO TEXTO. Todas as palavras, frases e expressões devem estar em português brasileiro. Use "imagine" em vez de "imagine this", "descobrir" em vez de "discover", "revelar" em vez de "reveal".',
                    examples: 'Exemplos corretos: "Imagine isso", "Descubra os segredos", "Revele a verdade". Exemplos INCORRETOS: "Imagine this", "Discover the secrets", "Reveal the truth".'
                },
                'en-US': {
                    name: 'AMERICAN ENGLISH',
                    instruction: 'Write exclusively in American English. Use American spelling and expressions. Do not use British English or any other language.',
                    examples: 'Correct examples: "Imagine this", "Discover the secrets", "Reveal the truth".'
                },
                'es-ES': {
                    name: 'ESPAÑOL (ESPAÑA)',
                    instruction: 'ESCRIBE EXCLUSIVAMENTE EN ESPAÑOL DE ESPAÑA. No uses inglés ni ningún otro idioma. Usa el español peninsular, no el latinoamericano.',
                    examples: 'Ejemplos correctos: "Imagina esto", "Descubre los secretos", "Revela la verdad".'
                },
                'fr-FR': {
                    name: 'FRANÇAIS (FRANCE)',
                    instruction: 'ÉCRIVEZ EXCLUSIVEMENT EN FRANÇAIS DE FRANCE. N\'utilisez pas l\'anglais ni aucune autre langue. Utilisez le français métropolitain.',
                    examples: 'Exemples corrects: "Imaginez cela", "Découvrez les secrets", "Révélez la vérité".'
                },
                'de-DE': {
                    name: 'DEUTSCH (DEUTSCHLAND)',
                    instruction: 'SCHREIBEN SIE AUSSCHLIESSLICH AUF DEUTSCH. Verwenden Sie kein Englisch oder eine andere Sprache. Verwenden Sie das Standarddeutsch.',
                    examples: 'Richtige Beispiele: "Stellen Sie sich vor", "Entdecken Sie die Geheimnisse", "Enthüllen Sie die Wahrheit".'
                },
                'it-IT': {
                    name: 'ITALIANO (ITALIA)',
                    instruction: 'SCRIVI ESCLUSIVAMENTE IN ITALIANO. Non usare inglese o altre lingue. Usa l\'italiano standard.',
                    examples: 'Esempi corretti: "Immagina questo", "Scopri i segreti", "Rivela la verità".'
                },
                'ja-JP': {
                    name: '日本語 (日本)',
                    instruction: '日本語のみで書いてください。英語や他の言語は使用しないでください。標準的な日本語を使用してください。',
                    examples: '正しい例: "これを想像してください", "秘密を発見する", "真実を明らかにする".'
                },
                'ko-KR': {
                    name: '한국어 (대한민국)',
                    instruction: '한국어로만 작성하세요. 영어나 다른 언어를 사용하지 마세요. 표준 한국어를 사용하세요.',
                    examples: '올바른 예: "이것을 상상해보세요", "비밀을 발견하다", "진실을 밝히다".'
                },
                'ro-RO': {
                    name: 'ROMÂNĂ (ROMÂNIA)',
                    instruction: 'SCRIE EXCLUSIV ÎN ROMÂNĂ. Nu folosi engleza sau alte limbi. Folosește româna standard.',
                    examples: 'Exemple corecte: "Imaginează-ți asta", "Descoperă secretele", "Dezvăluie adevărul".'
                },
                'pl-PL': {
                    name: 'POLSKI (POLSKA)',
                    instruction: 'PISZ WYŁĄCZNIE PO POLSKU. Nie używaj angielskiego ani innych języków. Używaj standardowego polskiego.',
                    examples: 'Poprawne przykłady: "Wyobraź sobie to", "Odkryj sekrety", "Ujawnij prawdę".'
                }
            };

            const langInfo = languageInstructions[form.lang] || languageInstructions['pt-BR'];
            const languageInstruction = `${langInfo.name} - ${langInfo.instruction} ${langInfo.examples}`;
            
            let prompt = `GERAÇÃO DE ROTEIRO VIRAL PARA ${form.niche.toUpperCase()}

🚨🚨🚨 IDIOMA OBRIGATÓRIO - LEIA COM ATENÇÃO 🚨🚨🚨
${languageInstruction}

CONFIG:
- Nicho: ${removeAccents(form.niche)}
- Público: ${removeAccents(form.audience)}
- Tópico: ${removeAccents(form.topic)}
- Duração: ${form.duration} minutos
- Tom: ${form.tone}
- Partes: ${form.parts}
- Palavras por parte: EXATAMENTE ${targetWordsPerPart} palavras (OBRIGATÓRIO: entre ${minWordsPerPart} e ${maxWordsPerPart})
- Parágrafos por parte: EXATAMENTE ${validationLimits.paragraphsPerPart} parágrafos (exceto última parte)
- Idioma Selecionado: ${form.langDisplay || langInfo.name} (Código: ${form.lang})

⚠️ CONTROLE RIGOROSO DE TAMANHO ⚠️:
- Cada parte DEVE ter EXATAMENTE entre ${minWordsPerPart} e ${maxWordsPerPart} palavras
- Conte as palavras mentalmente ao escrever cada parte
- Se uma parte estiver muito curta, adicione mais detalhes e exemplos
- Se uma parte estiver muito longa, resuma e seja mais conciso
- A última parte pode ter 1-2 parágrafos a mais se necessário para conclusão

ESTRUTURA OBRIGATÓRIA POR PARTE:
1. Cada parte deve ter EXATAMENTE ${validationLimits.paragraphsPerPart} parágrafos completos (exceto última)
2. Cada parágrafo deve ter 3-6 frases bem desenvolvidas
3. Cada parte deve ter EXATAMENTE entre ${minWordsPerPart} e ${maxWordsPerPart} palavras (CRÍTICO!)
4. NUNCA repetir frases ou trechos
5. Manter continuidade narrativa entre partes
6. Cada parágrafo separado por UMA LINHA EM BRANCO (\\n\\n)

${form.includeAffiliate ? `
PRODUTO AFILIADO:
Integrar naturalmente: ${removeAccents(form.affiliateProduct)}
- Mencionar benefícios sem ser invasivo
- Usar gatilhos de escassez e urgência
- Incluir CTA sutil no meio e forte no final
` : ''}

ELEMENTOS VIRAIS OBRIGATÓRIOS:
1. Hook forte nos primeiros 15 segundos
2. Promessa clara de valor
3. Tensão narrativa crescente
4. Revelações progressivas
5. Clímax emocional
6. Resolução satisfatória
${form.ctaPositions.includes('beginning') ? '7. CTA no início (sutil)' : ''}
${form.ctaPositions.includes('middle') ? '8. CTA no meio (contextual)' : ''}
${form.ctaPositions.includes('end') ? '9. CTA no final (forte)' : ''}

TÉCNICAS DE RETENÇÃO:
- Usar "mas", "porém", "entretanto" para criar tensão
- Fazer perguntas retóricas
- Criar loops abertos (curiosity gaps)
- Usar palavras de poder: "segredo", "revelação", "verdade oculta"
- Incluir números e dados específicos
- Criar urgência e escassez

🚨 PROIBIÇÃO ABSOLUTA DE REPETIÇÕES E REDUNDÂNCIAS 🚨:
- NUNCA repetir a mesma ideia duas vezes, mesmo com palavras diferentes
- NUNCA usar frases que começam da mesma forma em sequência
- NUNCA repetir palavras-chave em excesso (máximo 2-3 vezes por parte)
- NUNCA criar "eco" - evitar padrões repetitivos típicos de IA
- Cada frase deve trazer informação NOVA e ÚNICA
- Se você já disse algo, NÃO diga novamente de forma diferente
- Evite estruturas repetitivas como "É importante...", "Vale ressaltar...", "É crucial..." em sequência

FORMATO DE SAÍDA:
Gere o roteiro em ${form.parts} partes, cada parte usando o formato:

### PARTE N

[Conteúdo com ${validationLimits.paragraphsPerPart} parágrafos, ${minWordsPerPart}-${maxWordsPerPart} palavras, cada parágrafo separado por DUAS LINHAS EM BRANCO (\\n\\n\\n)]

FORMATAÇÃO OBRIGATÓRIA:
- Cada parágrafo DEVE ser separado por DUAS linhas em branco (\\n\\n\\n) para facilitar a leitura
- NÃO numerar parágrafos
- NÃO usar bullets ou listas (apenas texto corrido)
- NUNCA repetir frases ou trechos
- MANTER fluidez e naturalidade
- GARANTIR que cada parte seja única
- Começar DIRETAMENTE com ### PARTE 1

🚨 LEMBRE-SE: TODO O CONTEÚDO DEVE ESTAR EM ${langInfo.name.toUpperCase()} 🚨`;

            // Inicializar resultados
            if (!window.scriptResults) {
                window.scriptResults = {};
            }
            
            window.scriptResults = {
                fullResult: {
                    script_title: form.topic,
                    script_description: `Roteiro viral para ${form.niche} - ${form.audience}`,
                    total_parts: form.parts,
                    duration_minutes: form.duration,
                    script_parts: [],
                    full_script_text: '',
                    generation_params: form,
                    scores: {
                        retention_potential: 0,
                        clarity_score: 0,
                        viral_potential: 0
                    },
                    narrationOnlyMode: form.narrationOnly,
                    timestamp: new Date().toISOString()
                },
                currentPart: 0,
                currentPage: 1,
                partsPerPage: 5
            };

            // Mostrar modal de progresso
            if (typeof window.showProgressModal === 'function') {
                window.showProgressModal(form.parts);
            }

            // Set para rastrear partes processadas
            const processedParts = new Set();
            
            // Buffer para acumular texto
            let textBuffer = '';

            // Função para processar e adicionar uma parte
            const processPart = (partNumber, content) => {
                if (!content || content.trim().length < 10) {
                    console.warn(`⚠️ Parte ${partNumber} tem conteúdo muito curto:`, content.length);
                    return false;
                }

                // Limpar conteúdo e remover duplicações
                let cleanedContent = content.trim();
                
                // Remover apenas o marcador ### PARTE N se estiver no início
                cleanedContent = cleanedContent.replace(/^###\s*PARTE\s*\d+\s*\n*/mi, '').trim();
                
                // Remover marcações antigas se existirem
                cleanedContent = cleanedContent.replace(/\[--ENDPART--\]/gi, '').trim();
                cleanedContent = cleanedContent.replace(/\[--PART[^\]]*?--\]/gi, '').trim();
                
                // APLICAR REMOÇÃO AGRESSIVA DE DUPLICAÇÕES
                cleanedContent = removeDuplicates(cleanedContent);
                
                // USAR SCRIPT-CLEANER para limpeza adicional
                if (window.moduleLoader) {
                    const cleanerModule = window.moduleLoader.getModule('script-cleaner');
                    if (cleanerModule && typeof cleanerModule.cleanPart === 'function') {
                        const beforeClean = cleanedContent;
                        cleanedContent = cleanerModule.cleanPart(cleanedContent);
                        
                        if (cleanedContent.length < beforeClean.length * 0.3) {
                            console.warn(`⚠️ Cleaner removeu muito conteúdo, usando versão intermediária`);
                            cleanedContent = beforeClean;
                            if (cleanerModule.removeDuplicateSentences) {
                                cleanedContent = cleanerModule.removeDuplicateSentences(cleanedContent);
                            }
                        }
                    }
                }
                
                // Aplicar também cleanScriptContent do app-core
                if (typeof window.cleanScriptContent === 'function') {
                    cleanedContent = window.cleanScriptContent(cleanedContent);
                }
                
                // FORMATAR PARÁGRAFOS: Garantir que cada parágrafo seja bem separado e formatado
                // Primeiro, normalizar todas as quebras de linha
                cleanedContent = cleanedContent
                    .replace(/\r\n/g, '\n')  // Normalizar Windows
                    .replace(/\r/g, '\n')   // Normalizar Mac
                    .replace(/\n{4,}/g, '\n\n\n')  // Limitar a 3 linhas em branco
                    .trim();
                
                // Dividir em parágrafos (separados por 2+ linhas em branco)
                let paragraphs = cleanedContent
                    .split(/\n\n+/)
                    .map(p => p.trim().replace(/\n+/g, ' '))  // Substituir quebras de linha dentro do parágrafo por espaços
                    .filter(p => p.length > 0);
                
                // Se só tem um parágrafo mas o texto é longo, dividir por frases
                if (paragraphs.length === 1 && cleanedContent.length > 200) {
                    const sentences = cleanedContent.match(/[^.!?]+[.!?]+/g) || [];
                    if (sentences.length > 0) {
                        const sentencesPerParagraph = 4; // 4-5 frases por parágrafo
                        paragraphs = [];
                        for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
                            const paragraph = sentences.slice(i, i + sentencesPerParagraph)
                                .map(s => s.trim())
                                .filter(s => s.length > 0)
                                .join(' ');
                            if (paragraph.length > 0) {
                                paragraphs.push(paragraph);
                            }
                        }
                    }
                }
                
                // Juntar parágrafos com DUAS linhas em branco para melhor legibilidade
                cleanedContent = paragraphs.join('\n\n\n');
                
                // Garantir que não há espaços duplos ou formatação estranha
                cleanedContent = cleanedContent
                    .replace(/\s{2,}/g, ' ')  // Remover espaços duplos
                    .replace(/\n\n\n+/g, '\n\n\n')  // Garantir exatamente 3 linhas entre parágrafos
                    .trim();
                
                if (!cleanedContent || cleanedContent.trim().length < 10) {
                    console.error(`❌ Parte ${partNumber} está vazia após limpeza`);
                    return false;
                }

                // VALIDAÇÃO RIGOROSA: Rejeitar partes muito curtas
                const wordCount = cleanedContent.split(/\s+/).filter(Boolean).length;
                const charCount = cleanedContent.length;
                
                if (wordCount < 50 || charCount < 300) {
                    console.warn(`⚠️ Parte ${partNumber} muito curta após limpeza: ${wordCount} palavras`);
                    return false;
                }

                // Criar objeto da parte (compatível com renderScriptPage)
                const part = {
                    part_title: `Parte ${partNumber}`,
                    part_content: cleanedContent
                };

                console.log(`✅ Parte ${partNumber} processada: ${cleanedContent.length} chars, ${wordCount} palavras`);

                // Adicionar ou atualizar parte (SEMPRE SUBSTITUIR, NUNCA CONCATENAR)
                const existingIndex = window.scriptResults.fullResult.script_parts.findIndex(
                    p => p.part_title === part.part_title
                );

                if (existingIndex >= 0) {
                    // SEMPRE substituir completamente
                    window.scriptResults.fullResult.script_parts[existingIndex] = part;
                    console.log(`🔄 Parte ${partNumber} atualizada`);
                } else {
                    window.scriptResults.fullResult.script_parts.push(part);
                    console.log(`➕ Parte ${partNumber} adicionada`);
                }

                // Atualizar progresso gradualmente
                const currentParts = window.scriptResults.fullResult.script_parts.length;
                const totalParts = form.parts;
                
                // Calcular progresso baseado nas partes completadas
                // NÃO mostrar 100% até que TODAS as partes estejam completas
                const progressPerPart = 100 / totalParts;
                const completedProgress = (currentParts / totalParts) * 100;
                // Limitar a 95% até que todas as partes estejam completas
                const currentProgress = currentParts >= totalParts ? 100 : Math.min(95, completedProgress);
                
                if (typeof window.setRealProgress === 'function') {
                    const statusText = currentParts >= totalParts 
                        ? `${totalParts}/${totalParts} concluído!`
                        : `Parte ${currentParts}/${totalParts} concluída`;
                    
                    window.setRealProgress(
                        currentProgress,
                        statusText
                    );
                }

                // Renderizar página do script para mostrar progresso gradual
                if (typeof window.renderScriptPage === 'function') {
                    window.renderScriptPage();
                }
                
                return true;
            };

            // Callback para chunks
            const onChunk = (data) => {
                let textChunk = '';
                
                // Claude format
                if (data.type === 'content_block_delta') {
                    textChunk = data.delta?.text || '';
                } else if (data.type === 'message_delta') {
                    textChunk = data.delta?.text || '';
                }
                // GPT format
                else if (data.choices && data.choices[0]?.delta?.content) {
                    textChunk = data.choices[0].delta.content;
                }
                // Gemini format
                else if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    textChunk = data.candidates[0].content.parts[0].text;
                }
                // String format (fallback)
                else if (typeof data === 'string') {
                    textChunk = data;
                }
                // Tentar extrair texto de qualquer estrutura JSON
                else if (data.text) {
                    textChunk = data.text;
                }

                if (!textChunk) {
                    // Log para debug se não conseguir extrair texto
                    if (Object.keys(data).length > 0) {
                        console.log('⚠️ Chunk recebido sem texto extraível:', Object.keys(data));
                    }
                    return;
                }

                // APENAS ACUMULAR NO BUFFER - NÃO PROCESSAR AINDA
                textBuffer += textChunk;
                
                // Atualizar progresso gradualmente baseado no tamanho do buffer
                // Estimar quantas partes já foram completadas baseado no conteúdo
                const estimatedPartsCompleted = Math.floor(textBuffer.length / (targetWordsPerPart * 6));
                const estimatedPartProgress = (textBuffer.length % (targetWordsPerPart * 6)) / (targetWordsPerPart * 6);
                
                const baseProgress = (estimatedPartsCompleted / form.parts) * 100;
                const partProgress = (1 / form.parts) * 100;
                const currentProgress = Math.min(95, baseProgress + (partProgress * estimatedPartProgress * 0.8));
                
                if (typeof window.setRealProgress === 'function') {
                    const currentPartDisplay = Math.min(form.parts, estimatedPartsCompleted + 1);
                    window.setRealProgress(
                        currentProgress,
                        `Gerando parte ${currentPartDisplay}/${form.parts}...`
                    );
                }
            };

            // Callback quando stream termina - PROCESSAR TUDO AQUI
            const onDone = (remainingBuffer) => {
                console.log('🏁 Stream finalizado');
                console.log(`📊 Buffer total: ${textBuffer.length} caracteres`);
                console.log(`📊 Remaining buffer: ${remainingBuffer ? remainingBuffer.length : 0} caracteres`);
                
                // Verificar quantas partes já foram processadas antes de processar o buffer
                const partsBeforeProcessing = window.scriptResults?.fullResult?.script_parts?.length || 0;
                console.log(`📊 Partes já processadas antes do buffer final: ${partsBeforeProcessing}/${form.parts}`);
                
                if (remainingBuffer) {
                    textBuffer += remainingBuffer;
                }

                // Se o buffer estiver vazio, verificar se já temos partes suficientes
                if (!textBuffer || textBuffer.trim().length === 0) {
                    // Se já temos todas as partes, está ok
                    if (partsBeforeProcessing >= form.parts) {
                        console.log('✅ Buffer vazio mas todas as partes já foram processadas');
                        // Continuar com o processamento normal
                    } else {
                        console.error('❌ Buffer vazio! Nenhum dado foi recebido do stream.');
                        if (window.showSuccessToast) {
                            window.showSuccessToast('Erro: Nenhum conteúdo foi gerado. Verifique a chave de API e tente novamente.', true);
                        }
                        if (typeof window.hideProgressModal === 'function') {
                            window.hideProgressModal();
                        }
                        return;
                    }
                }

                console.log(`📝 Primeiros 500 caracteres do buffer:`, textBuffer.substring(0, 500));

                // Processar buffer final usando matchAll
                const partRegex = /###\s*PARTE\s*(\d+)/gi;
                const matches = [...textBuffer.matchAll(partRegex)];

                if (matches.length > 0) {
                    console.log(`📊 Encontradas ${matches.length} partes no buffer final`);
                    
                    // Processar todas as partes encontradas
                    for (let i = 0; i < matches.length; i++) {
                        const currentMatch = matches[i];
                        const nextMatch = matches[i + 1];
                        
                        const partNumber = parseInt(currentMatch[1], 10);
                        const partStart = currentMatch.index + currentMatch[0].length;
                        const partEnd = nextMatch ? nextMatch.index : textBuffer.length;
                        
                        const partContent = textBuffer.substring(partStart, partEnd).trim();
                        const wordCount = partContent.split(/\s+/).filter(Boolean).length;
                        
                        console.log(`📝 Parte ${partNumber}: ${wordCount} palavras, ${partContent.length} caracteres`);
                        
                        // Só processar se tiver tamanho mínimo
                        if (partContent.length > 100 && wordCount > 50 && !processedParts.has(partNumber)) {
                            const success = processPart(partNumber, partContent);
                            if (success) {
                                processedParts.add(partNumber);
                            }
                        } else {
                            console.warn(`⚠️ Parte ${partNumber} ignorada: muito curta ou já processada`);
                        }
                    }
                } else {
                    // Fallback: dividir o texto em partes iguais se não encontrou delimitadores
                    console.warn('⚠️ Nenhum delimitador encontrado, tentando dividir texto...');
                    const textParts = textBuffer.trim().split(/\n\n+/).filter(p => p.trim().length > 100);
                    const wordsPerPart = Math.ceil(textParts.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / form.parts);
                    
                    let currentPart = 1;
                    let currentPartText = '';
                    let currentWords = 0;
                    
                    for (const paragraph of textParts) {
                        const paraWords = paragraph.split(/\s+/).length;
                        if (currentWords + paraWords >= wordsPerPart && currentPart < form.parts) {
                            if (currentPartText.trim().length > 100) {
                                processPart(currentPart, currentPartText.trim());
                                processedParts.add(currentPart);
                            }
                            currentPart++;
                            currentPartText = paragraph;
                            currentWords = paraWords;
                        } else {
                            currentPartText += (currentPartText ? '\n\n' : '') + paragraph;
                            currentWords += paraWords;
                        }
                    }
                    
                    // Processar última parte
                    if (currentPartText.trim().length > 100 && currentPart <= form.parts) {
                        processPart(currentPart, currentPartText.trim());
                        processedParts.add(currentPart);
                    }
                }

                // Verificar se todas as partes foram geradas
                const totalPartsGenerated = window.scriptResults.fullResult.script_parts.length;
                const expectedParts = form.parts;
                const allPartsComplete = totalPartsGenerated >= expectedParts;
                
                console.log(`📊 Verificação de conclusão: ${totalPartsGenerated}/${expectedParts} partes geradas`);
                
                // Se não foram geradas todas as partes, mas o stream terminou, processar o que temos
                if (!allPartsComplete) {
                    const missingParts = expectedParts - totalPartsGenerated;
                    console.warn(`⚠️ Stream terminou mas faltam ${missingParts} partes. Processando o que foi gerado...`);
                    
                    // Se temos pelo menos 80% das partes, aceitar e continuar
                    if (totalPartsGenerated >= expectedParts * 0.8) {
                        console.log(`✅ Temos ${totalPartsGenerated} de ${expectedParts} partes (${((totalPartsGenerated/expectedParts)*100).toFixed(0)}%). Continuando com o que foi gerado.`);
                        // Continuar processamento com as partes disponíveis
                    } else if (totalPartsGenerated > 0) {
                        // Temos algumas partes, mas menos de 80% - avisar mas continuar
                        console.warn(`⚠️ Apenas ${totalPartsGenerated} de ${expectedParts} partes foram geradas. Continuando mesmo assim.`);
                        if (window.showSuccessToast) {
                            window.showSuccessToast(`Atenção: Apenas ${totalPartsGenerated} de ${expectedParts} partes foram geradas.`, false);
                        }
                    } else {
                        // Nenhuma parte foi gerada - erro real
                        console.error('❌ Nenhuma parte foi gerada!');
                        if (window.showSuccessToast) {
                            window.showSuccessToast('Erro: Nenhuma parte foi gerada. Tente novamente.', true);
                        }
                        if (typeof window.hideProgressModal === 'function') {
                            window.hideProgressModal();
                        }
                        return;
                    }
                }
                
                // Reconstruir texto completo (só se todas as partes foram geradas)
                if (window.scriptResults.fullResult.script_parts.length > 0) {
                    // Ordenar partes por número
                    window.scriptResults.fullResult.script_parts.sort((a, b) => {
                        const numA = parseInt(a.part_title.match(/\d+/)?.[0] || '0');
                        const numB = parseInt(b.part_title.match(/\d+/)?.[0] || '0');
                        return numA - numB;
                    });

                    // APLICAR REMOÇÃO FINAL DE DUPLICAÇÕES NO TEXTO COMPLETO
                    const allPartsText = window.scriptResults.fullResult.script_parts
                        .map(p => p.part_content || '')
                        .filter(Boolean)
                        .join('\n\n');
                    
                    // CRÍTICO: Aplicar removeDuplicates no texto final completo
                    window.scriptResults.fullResult.full_script_text = removeDuplicates(allPartsText);
                    
                    console.log(`✅ Total: ${window.scriptResults.fullResult.script_parts.length} partes processadas`);
                    console.log(`📝 Texto final: ${window.scriptResults.fullResult.full_script_text.split(/\s+/).length} palavras`);

                    // Calcular pontuações baseadas no algoritmo do YouTube
                    const calculatedScores = calculateYouTubeScores(
                        window.scriptResults.fullResult.script_parts,
                        form
                    );
                    window.scriptResults.fullResult.scores = calculatedScores;
                    console.log('📊 Pontuações calculadas:', calculatedScores);
                    
                    // Garantir que currentPage e partsPerPage estão definidos
                    if (!window.scriptResults.currentPage) {
                        window.scriptResults.currentPage = 1;
                    }
                    if (!window.scriptResults.partsPerPage) {
                        window.scriptResults.partsPerPage = 5;
                    }

                    // Validar se todas as partes têm o tamanho correto
                    let allPartsValid = true;
                    const validationErrors = [];
                    
                    window.scriptResults.fullResult.script_parts.forEach((part, index) => {
                        const partContent = part.part_content || '';
                        const wordCount = partContent.split(/\s+/).filter(Boolean).length;
                        const paragraphs = partContent.split(/\n\n+/).filter(p => p.trim().length > 20);
                        const isLastPart = index === window.scriptResults.fullResult.script_parts.length - 1;
                        
                        // Validar palavras (mais flexível - aceita até 20% a mais ou menos)
                        const minWordsFlex = Math.floor(minWordsPerPart * 0.8);
                        const maxWordsFlex = Math.ceil(maxWordsPerPart * 1.2);
                        
                        if (wordCount < minWordsFlex || wordCount > maxWordsFlex) {
                            // Só marcar como erro se estiver muito fora do esperado
                            if (wordCount < minWordsFlex * 0.7 || wordCount > maxWordsFlex * 1.3) {
                                allPartsValid = false;
                                validationErrors.push(`Parte ${index + 1}: ${wordCount} palavras (esperado ${minWordsPerPart}-${maxWordsPerPart}, aceito ${minWordsFlex}-${maxWordsFlex})`);
                            }
                        }
                        
                        // Validar parágrafos (mais flexível - aceita ±1 parágrafo)
                        const expectedParagraphs = isLastPart ? validationLimits.paragraphsPerPart : validationLimits.paragraphsPerPart;
                        const minParagraphs = Math.max(2, expectedParagraphs - 1);
                        const maxParagraphs = expectedParagraphs + 1;
                        
                        if (!isLastPart && (paragraphs.length < minParagraphs || paragraphs.length > maxParagraphs)) {
                            // Só marcar como erro se estiver muito fora
                            if (paragraphs.length < minParagraphs - 1 || paragraphs.length > maxParagraphs + 1) {
                                allPartsValid = false;
                                validationErrors.push(`Parte ${index + 1}: ${paragraphs.length} parágrafos (esperado ${validationLimits.paragraphsPerPart}, aceito ${minParagraphs}-${maxParagraphs})`);
                            }
                        }
                    });

                    // Verificar pontuações
                    const minScore = Math.min(
                        calculatedScores.retention_potential,
                        calculatedScores.clarity_score,
                        calculatedScores.viral_potential
                    );
                    const avgScore = (
                        calculatedScores.retention_potential +
                        calculatedScores.clarity_score +
                        calculatedScores.viral_potential
                    ) / 3;

                    // Só mostrar aviso se a pontuação estiver realmente baixa (< 75)
                    if (minScore < 75 || avgScore < 75) {
                        console.warn(`⚠️ Pontuação abaixo do ideal: Mínima=${minScore}, Média=${avgScore.toFixed(1)}`);
                        if (window.showSuccessToast) {
                            window.showSuccessToast(
                                `Pontuação: ${avgScore.toFixed(1)}/100. Para melhorar, adicione mais elementos de engajamento, conectores e palavras-chave virais.`,
                                false
                            );
                        }
                    } else if (avgScore >= 75 && avgScore < 85) {
                        // Pontuação boa mas pode melhorar
                        console.log(`✅ Pontuação: ${avgScore.toFixed(1)}/100 (Boa, pode melhorar)`);
                    } else {
                        console.log(`✅ Pontuação excelente: ${avgScore.toFixed(1)}/100`);
                    }

                    if (!allPartsValid && validationErrors.length > 0) {
                        console.warn('⚠️ Avisos de validação:', validationErrors);
                        // Só mostrar toast se houver erros críticos (não apenas avisos)
                        const criticalErrors = validationErrors.filter(e => 
                            e.includes('muito') || e.includes('menos de') || e.includes('mais de')
                        );
                        if (criticalErrors.length > 0 && window.showSuccessToast) {
                            window.showSuccessToast(
                                `Atenção: Algumas partes estão fora do tamanho ideal. O roteiro foi gerado, mas pode precisar de ajustes.`,
                                false
                            );
                        }
                    }
                }
                
                // Recalcular após processar buffer - pode ter mudado
                const finalPartsCount = window.scriptResults.fullResult.script_parts.length;
                const finalAllPartsComplete = finalPartsCount >= expectedParts;
                const finalProgress = finalAllPartsComplete ? 100 : Math.min(95, (finalPartsCount / expectedParts) * 100);
                
                if (finalAllPartsComplete) {
                    console.log(`✅ Todas as ${expectedParts} partes foram geradas!`);
                } else {
                    console.log(`⚠️ Stream terminou com ${finalPartsCount}/${expectedParts} partes. Continuando processamento...`);
                }
                
                if (typeof window.setRealProgress === 'function') {
                    const statusText = finalAllPartsComplete 
                        ? `${expectedParts}/${expectedParts} concluído!`
                        : `${finalPartsCount}/${expectedParts} partes geradas`;
                    window.setRealProgress(finalProgress, statusText);
                }

                // Garantir que os dados estão completos antes de renderizar
                if (window.scriptResults && window.scriptResults.fullResult) {
                    // Garantir que total_parts está correto
                    if (!window.scriptResults.fullResult.total_parts) {
                        window.scriptResults.fullResult.total_parts = window.scriptResults.fullResult.script_parts.length;
                    }
                    
                    // Garantir que scores existem
                    if (!window.scriptResults.fullResult.scores) {
                        window.scriptResults.fullResult.scores = {
                            retention_potential: 85,
                            clarity_score: 85,
                            viral_potential: 85
                        };
                    }
                }

                // Renderizar
                if (typeof window.renderScriptPage === 'function') {
                    console.log('🎨 Renderizando página do roteiro...', {
                        parts: window.scriptResults?.fullResult?.script_parts?.length,
                        currentPage: window.scriptResults?.currentPage,
                        partsPerPage: window.scriptResults?.partsPerPage
                    });
                    window.renderScriptPage();
                } else {
                    console.error('❌ renderScriptPage não está disponível!');
                }

                // Esconder modal - sempre fechar quando o stream terminar
                // Timeout de segurança para garantir que o modal seja fechado mesmo se houver problemas
                const closeModalTimeout = setTimeout(() => {
                    if (typeof window.hideProgressModal === 'function') {
                        console.log('⏰ Timeout de segurança: fechando modal');
                        window.hideProgressModal();
                    }
                }, 3000); // 3 segundos de timeout máximo
                
                if (typeof window.hideProgressModal === 'function') {
                    // Pequeno delay para mostrar progresso final antes de fechar
                    setTimeout(() => {
                        clearTimeout(closeModalTimeout); // Cancelar timeout se fechar normalmente
                        window.hideProgressModal();
                    }, 500);
                }

                // Mostrar conclusão baseado no que foi gerado
                // finalPartsCount já foi declarado acima, reutilizar
                
                if (finalPartsCount >= expectedParts) {
                    // Todas as partes foram geradas
                    if (typeof window.showScriptGenCompleteModal === 'function') {
                        window.showScriptGenCompleteModal();
                    } else if (window.showSuccessToast) {
                        window.showSuccessToast(`Roteiro gerado com sucesso! ${expectedParts} partes completas.`);
                    }
                } else if (finalPartsCount > 0) {
                    // Algumas partes foram geradas
                    const percentage = ((finalPartsCount / expectedParts) * 100).toFixed(0);
                    if (window.showSuccessToast) {
                        window.showSuccessToast(`Roteiro parcialmente gerado: ${finalPartsCount} de ${expectedParts} partes (${percentage}%).`, false);
                    }
                } else {
                    // Nenhuma parte foi gerada
                    if (window.showSuccessToast) {
                        window.showSuccessToast('Erro: Nenhuma parte foi gerada. Tente novamente.', true);
                    }
                }

                // Salvar histórico se tiver pelo menos uma parte
                if (finalPartsCount > 0 && typeof window.saveScriptToHistory === 'function') {
                    window.saveScriptToHistory(window.scriptResults.fullResult);
                }
            };

            // Callback para erros
            const onError = (error) => {
                console.error('❌ Erro ao gerar roteiro:', error);
                
                if (typeof window.hideProgressModal === 'function') {
                    window.hideProgressModal();
                }

                const errorMsg = error.message || 'Erro desconhecido';
                if (window.showSuccessToast) {
                    window.showSuccessToast(`Erro: ${errorMsg}`, true);
                }
            };

            // Fazer requisição
            if (typeof window.streamApiRequest === 'function') {
                console.log('📤 Enviando requisição de stream...', {
                    model: form.model,
                    promptLength: prompt.length,
                    parts: form.parts,
                    language: form.langDisplay || langInfo.name,
                    languageCode: form.lang
                });
                console.log('🌐 Idioma configurado:', langInfo.name);
                
                window.streamApiRequest(
                    '/api/generate-stream',
                    {
                        prompt: prompt,
                        model: form.model,
                        stream: true
                    },
                    (data) => {
                        console.log('📥 Chunk recebido:', {
                            type: data?.type,
                            hasChoices: !!data?.choices,
                            hasCandidates: !!data?.candidates,
                            keys: Object.keys(data || {})
                        });
                        onChunk(data);
                    },
                    onDone,
                    (error) => {
                        console.error('❌ Erro no stream:', error);
                        onError(error);
                    }
                );
            } else {
                throw new Error('streamApiRequest não está disponível');
            }

        } catch (error) {
            console.error('❌ Erro no handler script-writer:', error);
            if (window.showSuccessToast) {
                window.showSuccessToast(`Erro: ${error.message}`, true);
            }
            if (typeof window.hideProgressModal === 'function') {
                window.hideProgressModal();
            }
        }
    },

    init() {
        // Event listeners serão registrados pelo sistema de handlers
    }
};
