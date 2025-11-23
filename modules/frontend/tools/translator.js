/**
 * Módulo: Tradutor de Roteiro
 * Traduz roteiros para múltiplos idiomas usando IA
 * CÓDIGO COMPLETO - Versão idêntica ao handler original
 */

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'script-translator',
    name: 'Tradutor de Roteiro',
    icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129',
    category: 'creation',

    /**
     * Handler principal - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - handler 'translate-script'
     */
    async handler() {
        try {
            console.log('🟢 Handler translate-script iniciado');
            
        const utils = getGlobalUtils();
        const {
            showSuccessToast,
            addToLog,
            streamApiRequest,
            checkApiAvailability
        } = utils;

            if (!checkApiAvailability || !checkApiAvailability()) {
                console.error('❌ checkApiAvailability falhou ou não disponível');
                if (showSuccessToast) {
                    showSuccessToast('Erro: API não disponível. Recarregue a página.', true);
                }
            return;
        }

        // Verificar se streamApiRequest está disponível (do utils ou window como fallback)
        const streamApiRequestFunction = streamApiRequest || window.streamApiRequest;
        
        if (!streamApiRequestFunction) {
                console.error('❌ streamApiRequest não disponível');
                if (showSuccessToast) {
                    showSuccessToast('Erro: API de streaming não disponível. Recarregue a página.', true);
                }
            return;
        }

        const text = document.getElementById('translator-input-text')?.value.trim();
        const selectedLanguages = Array.from(document.querySelectorAll('#translator-lang-options input:checked')).map(cb => cb.value);
        const model = document.getElementById('script-translator-model-select')?.value;
        const outputEl = document.getElementById('output');

            console.log('🔍 Validação de entrada:', {
                hasText: !!text,
                textLength: text?.length || 0,
                selectedLanguages: selectedLanguages.length,
                languages: selectedLanguages,
                model: model,
                hasOutputEl: !!outputEl
            });

        if (!text || selectedLanguages.length === 0 || !model) {
                if (showSuccessToast) {
                    showSuccessToast("Por favor, cole o roteiro, selecione pelo menos um idioma e um modelo de IA.", true);
                }
            return;
        }

        if (outputEl) outputEl.innerHTML = '';
        
        /////////////////////////////////////////////////////////////////
        // DIVISÃO INTELIGENTE DO TEXTO EM PARTES PEQUENAS            //
        /////////////////////////////////////////////////////////////////
        function splitTextIntoSegments(text, maxChars = 2000) {
            // PRIMEIRO: Tentar dividir por partes do roteiro (Parte 1:, Parte 2:, etc.)
            const partRegex = /(?:^|\n)(?:###\s*)?PARTE\s*\d+[:\s]/gmi;
            const partMatches = [...text.matchAll(partRegex)];
            
            if (partMatches.length > 1) {
                // Dividir por partes do roteiro
                const segments = [];
                for (let i = 0; i < partMatches.length; i++) {
                    const start = partMatches[i].index;
                    const end = i < partMatches.length - 1 ? partMatches[i + 1].index : text.length;
                    const partText = text.substring(start, end).trim();
                    
                    if (partText.length > 0) {
                        // Se a parte for muito grande, dividir ainda mais
                        if (partText.length > maxChars) {
                            const subSegments = splitLargeSegment(partText, maxChars);
                            segments.push(...subSegments);
                        } else {
                            segments.push(partText);
                        }
                    }
                }
                
                if (segments.length > 0) {
                    console.log(`📝 Roteiro dividido em ${segments.length} segmentos baseados em partes`);
                    return segments.filter(s => s.trim().length > 0);
                }
            }
            
            // FALLBACK: Dividir por parágrafos se não encontrou partes
            const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
            const segments = [];
            let currentSegment = "";

            for (const para of paragraphs) {
                const trimmedPara = para.trim();
                // Se um parágrafo sozinho é maior que o limite, dividir por sentenças
                if (trimmedPara.length > maxChars) {
                    if (currentSegment.trim()) {
                        segments.push(currentSegment.trim());
                        currentSegment = "";
                    }
                    // Dividir parágrafo grande por sentenças
                    const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
                    for (const sentence of sentences) {
                        if ((currentSegment + " " + sentence).length > maxChars && currentSegment.trim()) {
                            segments.push(currentSegment.trim());
                            currentSegment = sentence;
                        } else {
                            currentSegment += (currentSegment ? " " : "") + sentence;
                        }
                    }
                } else {
                    // Parágrafo normal
                    if ((currentSegment + "\n\n" + trimmedPara).length > maxChars && currentSegment.trim()) {
                        segments.push(currentSegment.trim());
                        currentSegment = trimmedPara;
                    } else {
                        currentSegment += (currentSegment ? "\n\n" : "") + trimmedPara;
                    }
                }
            }

            if (currentSegment.trim()) {
                segments.push(currentSegment.trim());
            }

            console.log(`📝 Texto dividido em ${segments.length} segmentos baseados em parágrafos`);
            return segments.filter(s => s.trim().length > 0);
        }
        
            // Função auxiliar para dividir segmentos muito grandes
            function splitLargeSegment(segment, maxChars) {
            const subSegments = [];
            const paragraphs = segment.split(/\n\s*\n/).filter(p => p.trim());
            let currentSubSegment = "";
            
            for (const para of paragraphs) {
                if ((currentSubSegment + "\n\n" + para).length > maxChars && currentSubSegment.trim()) {
                    subSegments.push(currentSubSegment.trim());
                    currentSubSegment = para;
                } else {
                    currentSubSegment += (currentSubSegment ? "\n\n" : "") + para;
                }
            }
            
            if (currentSubSegment.trim()) {
                subSegments.push(currentSubSegment.trim());
            }
            
            return subSegments.filter(s => s.trim().length > 0);
        }

        /////////////////////////////////////////////////////////////////
        // PROMPT DE TRADUÇÃO LITERAL                                  //
        /////////////////////////////////////////////////////////////////
        function buildTranslationPrompt(lang, segment, segmentIndex, totalSegments) {
            return `Você é um tradutor profissional especializado em tradução LITERAL e COMPLETA.

TAREFA OBRIGATÓRIA:
Traduza o texto abaixo para ${lang} mantendo FIDELIDADE ABSOLUTA de 100% ao original.

REGRAS ABSOLUTAS (VIOLAÇÃO = ERRO):
1. Traduza TODAS as palavras - NÃO corte palavras no meio
2. Traduza TODOS os parágrafos - NÃO omita nenhum
3. Mantenha EXATAMENTE o mesmo conteúdo - NÃO invente, NÃO adicione, NÃO remova
4. Preserve a estrutura completa - todos os parágrafos, todas as frases
5. NÃO duplique texto - cada frase deve aparecer apenas UMA vez
6. NÃO reescreva - apenas traduza palavra por palavra mantendo o significado
7. Complete TODAS as palavras - NÃO deixe palavras cortadas (ex: "expl" deve ser "explora")

VALIDAÇÃO OBRIGATÓRIA:
- O texto traduzido deve ter aproximadamente o mesmo número de parágrafos do original
- O texto traduzido deve ter aproximadamente o mesmo número de palavras do original
- Cada parágrafo do original DEVE ter um parágrafo correspondente na tradução
- NÃO pode haver duplicações de parágrafos ou frases

TEXTO ORIGINAL (${segment.length} caracteres, ${segment.split(/\n\s*\n/).filter(p => p.trim()).length} parágrafos):

"""
${segment}
"""

TRADUZA COMPLETAMENTE este texto para ${lang}. Retorne APENAS a tradução completa e fiel, sem explicações, sem comentários, sem duplicações, sem palavras cortadas.`;
        }

        /////////////////////////////////////////////////////////////////
        // FUNÇÃO DE STREAMING UNIFICADA                                //
        /////////////////////////////////////////////////////////////////
        async function translateSegment(model, prompt, onProgress) {
            return new Promise((resolve, reject) => {
                let translatedText = "";
                let lastGeminiFullText = "";
                let isGemini = model.toLowerCase().includes("gemini");
                let streamCompleted = false;

                streamApiRequestFunction(
                    '/api/generate-stream',
                    { model, prompt, stream: true },
                    (data) => {
                        let chunk = "";

                        // GPT - incremental
                        if (data?.choices?.[0]?.delta?.content) {
                            chunk = data.choices[0].delta.content;
                            if (chunk) {
                                translatedText += chunk;
                                onProgress?.(translatedText);
                            }
                        }
                        // Claude - incremental
                        else if (data?.delta?.text) {
                            chunk = data.delta.text;
                            if (chunk) {
                                translatedText += chunk;
                                onProgress?.(translatedText);
                            }
                        }
                        // Claude com type
                        else if (data?.type === 'content_block_delta' && data?.delta?.text) {
                            chunk = data.delta.text;
                            if (chunk) {
                                translatedText += chunk;
                                onProgress?.(translatedText);
                            }
                        }
                        // Gemini - acumulado (texto completo)
                        else if (data?.candidates?.[0]?.content?.parts?.length > 0) {
                            const parts = data.candidates[0].content.parts;
                            const fullText = parts.map(p => p.text || "").join("").trim();
                            
                            // Gemini envia o texto completo acumulado, usar sempre o mais longo
                            if (fullText && (!lastGeminiFullText || fullText.length > lastGeminiFullText.length)) {
                                lastGeminiFullText = fullText;
                                translatedText = fullText;
                                onProgress?.(translatedText);
                            }
                        }
                    },
                    (remainingBuffer) => {
                        // Stream terminou (onDone callback)
                        if (streamCompleted) return;
                        streamCompleted = true;
                        
                        // Processar buffer restante se houver
                        if (remainingBuffer && remainingBuffer.trim() && !isGemini) {
                            translatedText += remainingBuffer.trim();
                        }
                        
                        // Resolver com o texto final
                        const finalText = isGemini && lastGeminiFullText ? lastGeminiFullText : translatedText.trim();
                        
                        if (finalText && finalText.length > 0) {
                            resolve(finalText);
                        } else {
                            reject(new Error("Nenhum texto traduzido recebido do stream"));
                        }
                    },
                    (error) => {
                        // Erro no stream
                        if (streamCompleted) return;
                        streamCompleted = true;
                        reject(error);
                    }
                ).catch((error) => {
                    // Erro ao iniciar o stream
                    if (streamCompleted) return;
                    streamCompleted = true;
                    reject(error);
                });
            });
        }

        /////////////////////////////////////////////////////////////////
        // TRADUÇÃO POR IDIOMA                                         //
        /////////////////////////////////////////////////////////////////
        const isGemini = model.toLowerCase().includes("gemini");
        
        // Dividir texto em segmentos pequenos para garantir tradução completa
        const textSegments = splitTextIntoSegments(text, isGemini ? 15000 : 2000);
        console.log(`📝 Texto dividido em ${textSegments.length} segmento(s)`);

        for (const lang of selectedLanguages) {
            try {
                // Criar container para o idioma
                const container = `
                    <div class="bg-white dark:bg-gray-800 border border-gray-600 rounded p-4 mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-lg font-bold">${lang}</h3>
                            <span id="status-${lang}" class="text-xs font-semibold text-gray-400">Aguardando...</span>
                        </div>
                        <div class="w-full bg-gray-700 rounded-full h-2 mb-3" id="progress-bar-${lang}">
                            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" id="progress-fill-${lang}" style="width: 0%"></div>
                        </div>
                        <pre id="output-${lang}" class="whitespace-pre-wrap mt-3 text-gray-200 min-h-[100px] max-h-[500px] overflow-y-auto p-3 bg-gray-900 rounded"></pre>
                        <div id="actions-${lang}" style="display:none;" class="flex gap-2 mt-3">
                            <button class="copy-translation-btn flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold" data-lang="${lang}">📋 Copiar Tradução</button>
                            <button class="download-translation-btn flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold" data-lang="${lang}">💾 Baixar .txt</button>
                        </div>
                    </div>
                `;
                
                if (!outputEl) {
                    addToLog(`❌ Erro: elemento output não encontrado para ${lang}`, true);
                    continue;
                }
                
                outputEl.insertAdjacentHTML("beforeend", container);

                const out = document.getElementById(`output-${lang}`);
                const status = document.getElementById(`status-${lang}`);
                const progressFill = document.getElementById(`progress-fill-${lang}`);
                
                if (!out || !status || !progressFill) {
                    addToLog(`❌ Erro: elementos DOM não criados para ${lang}`, true);
                    continue;
                }

                let fullTranslatedText = "";
                let completedSegments = 0;
                let successfulSegments = 0;
                let failedSegments = 0;

                // Traduzir cada segmento sequencialmente
                for (let i = 0; i < textSegments.length; i++) {
                    const segment = textSegments[i];
                    const segmentNum = i + 1;
                    
                    status.textContent = `Traduzindo parte ${segmentNum}/${textSegments.length}...`;
                    status.classList.remove("text-red-600", "text-green-600");
                    status.classList.add("text-blue-500");

                    try {
                        const prompt = buildTranslationPrompt(lang, segment, i, textSegments.length);
                        
                        // Traduzir com retry (até 3 tentativas)
                        let segmentTranslated = "";
                        let attempts = 0;
                        const maxAttempts = 3;

                        while (!segmentTranslated && attempts < maxAttempts) {
                            attempts++;
                            try {
                                if (attempts > 1) {
                                    status.textContent = `Tentativa ${attempts}/${maxAttempts} - Parte ${segmentNum}/${textSegments.length}...`;
                                    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay entre tentativas
                                }

                                segmentTranslated = await translateSegment(
                                    model,
                                    prompt,
                                    (partialText) => {
                                        // Atualizar exibição em tempo real
                                        const currentText = fullTranslatedText + (fullTranslatedText ? "\n\n" : "") + partialText;
                                        out.textContent = currentText;
                                    }
                                );

                                if (!segmentTranslated || !segmentTranslated.trim()) {
                                    throw new Error("Tradução vazia recebida");
                                }
                            } catch (error) {
                                console.error(`Erro na tentativa ${attempts} para segmento ${segmentNum}:`, error);
                                if (attempts >= maxAttempts) {
                                    throw new Error(`Falha após ${maxAttempts} tentativas: ${error.message}`);
                                }
                            }
                        }

                        // Adicionar segmento traduzido ao texto completo
                        if (segmentTranslated && segmentTranslated.trim()) {
                            // Limpar possíveis duplicações e mensagens de erro no texto traduzido
                            let cleanedTranslation = segmentTranslated.trim();
                            
                            // REMOVER MENSAGENS DE ERRO DA IA
                            const errorMessages = [
                                /lo siento,? pero no puedo ayudar con esa solicitud/gi,
                                /i'm sorry,? but i cannot help with that request/gi,
                                /desculpe,? mas não posso ajudar com essa solicitação/gi,
                                /je suis désolé,? mais je ne peux pas aider avec cette demande/gi,
                                /mi dispiace,? ma non posso aiutare con questa richiesta/gi,
                                /es tut mir leid,? aber ich kann bei dieser anfrage nicht helfen/gi,
                                /sorry,? but i cannot assist with that request/gi,
                                /não posso ajudar|cannot help|no puedo ayudar|je ne peux pas|non posso aiutare/gi
                            ];
                            
                            errorMessages.forEach(pattern => {
                                cleanedTranslation = cleanedTranslation.replace(pattern, '');
                            });
                            
                            // Detectar e remover palavras cortadas e duplicações parciais
                            // Padrão 1: palavra muito curta (1-4 chars) seguida de espaço e maiúscula
                            // Padrão 2: palavras cortadas no meio (ex: "expl" seguido de "ora")
                            const cutWordPattern1 = /\b(\w{1,4})\s+(?=[A-Z])/g;
                            const cutWordPattern2 = /\b(\w{1,4})\s+(?=\w{3,})/g; // Palavra curta seguida de outra palavra
                            
                            // Remover palavras cortadas
                            cleanedTranslation = cleanedTranslation.replace(cutWordPattern1, ' ');
                            cleanedTranslation = cleanedTranslation.replace(cutWordPattern2, ' ');
                            
                            // Detectar e remover duplicações onde uma frase começa igual à anterior
                            // Ex: "A los jóvenes les encanta..." aparece duas vezes
                            const sentences = cleanedTranslation.split(/([.!?]+\s*)/);
                            const uniqueSentences = [];
                            const seenStarts = new Set();
                            
                            for (let i = 0; i < sentences.length; i += 2) {
                                const sentence = sentences[i]?.trim();
                                const punctuation = sentences[i + 1] || '';
                                
                                if (!sentence) {
                                    if (punctuation) uniqueSentences.push(punctuation);
                                    continue;
                                }
                                
                                // Criar chave baseada nos primeiros 100 caracteres
                                const startKey = sentence.substring(0, 100).toLowerCase().replace(/\s+/g, ' ');
                                
                                // Verificar se já vimos uma frase que começa igual
                                let isDuplicate = false;
                                for (const seenKey of seenStarts) {
                                    const minLen = Math.min(startKey.length, seenKey.length, 80);
                                    if (startKey.substring(0, minLen) === seenKey.substring(0, minLen)) {
                                        console.warn(`⚠️ Frase duplicada detectada e removida: ${sentence.substring(0, 50)}...`);
                                        isDuplicate = true;
                                        break;
                                    }
                                }
                                
                                if (!isDuplicate) {
                                    seenStarts.add(startKey);
                                    uniqueSentences.push(sentence + punctuation);
                                }
                            }
                            
                            cleanedTranslation = uniqueSentences.join('').trim();
                            
                            // Remover duplicações de parágrafos completos PRIMEIRO (mais eficiente)
                            const paragraphs = cleanedTranslation.split(/\n\s*\n/).filter(p => p.trim());
                            const uniqueParagraphs = [];
                            const seenFullParagraphs = new Map(); // Usar Map para rastrear posição
                            
                            for (const para of paragraphs) {
                                const paraTrimmed = para.trim();
                                
                                // Criar chave mais robusta: primeiras 100 chars + últimas 50 chars + hash do meio
                                // Isso ajuda a detectar duplicações mesmo com pequenas variações
                                const startKey = paraTrimmed.substring(0, 100).toLowerCase().replace(/\s+/g, ' ');
                                const endKey = paraTrimmed.length > 50 
                                    ? paraTrimmed.substring(paraTrimmed.length - 50).toLowerCase().replace(/\s+/g, ' ')
                                    : '';
                                const middleKey = paraTrimmed.length > 150 
                                    ? paraTrimmed.substring(50, 150).toLowerCase().replace(/\s+/g, ' ')
                                    : '';
                                const paraKey = `${startKey}|${middleKey}|${endKey}`;
                                
                                // Verificar também se é uma duplicação parcial (começa igual)
                                let isDuplicate = false;
                                for (const [key, index] of seenFullParagraphs.entries()) {
                                    const keyStart = key.split('|')[0];
                                    if (keyStart.length > 80 && (startKey.startsWith(keyStart.substring(0, 80)) || keyStart.startsWith(startKey.substring(0, 80)))) {
                                        console.warn(`⚠️ Parágrafo duplicado/parcial detectado e removido (similar ao parágrafo ${index})`);
                                        isDuplicate = true;
                                        break;
                                    }
                                }
                                
                                if (!isDuplicate && !seenFullParagraphs.has(paraKey)) {
                                    seenFullParagraphs.set(paraKey, uniqueParagraphs.length);
                                    uniqueParagraphs.push(paraTrimmed);
                                } else if (!isDuplicate) {
                                    const existingIndex = seenFullParagraphs.get(paraKey);
                                    console.warn(`⚠️ Parágrafo duplicado exato detectado e removido (índice ${existingIndex})`);
                                }
                            }
                            
                            cleanedTranslation = uniqueParagraphs.join('\n\n').trim();
                            
                            // Remover duplicações de frases dentro do mesmo parágrafo
                            // Primeiro, dividir por sentenças (pontos, exclamações, interrogações)
                            const sentences = cleanedTranslation.split(/([.!?]+\s+)/).filter(s => s.trim());
                            const uniqueSentences = [];
                            const seenSentences = new Set();
                            
                            for (let j = 0; j < sentences.length; j++) {
                                const sentence = sentences[j].trim();
                                if (!sentence) continue;
                                
                                // Criar chave baseada no início da frase (primeiros 80 caracteres)
                                const sentenceKey = sentence.substring(0, 80).toLowerCase().replace(/\s+/g, ' ');
                                
                                // Verificar se já vimos uma frase que começa igual
                                let isDuplicate = false;
                                for (const seenKey of seenSentences) {
                                    if (sentenceKey.startsWith(seenKey.substring(0, 60)) || seenKey.startsWith(sentenceKey.substring(0, 60))) {
                                        console.warn(`⚠️ Frase duplicada/parcial removida: ${sentence.substring(0, 50)}...`);
                                        isDuplicate = true;
                                        break;
                                    }
                                }
                                
                                if (!isDuplicate && !seenSentences.has(sentenceKey)) {
                                    seenSentences.add(sentenceKey);
                                    uniqueSentences.push(sentences[j]);
                                }
                            }
                            
                            cleanedTranslation = uniqueSentences.join('').trim();
                            
                            // Agora remover duplicações de linhas completas
                            const lines = cleanedTranslation.split('\n');
                            const deduplicatedLines = [];
                            
                            for (let j = 0; j < lines.length; j++) {
                                const currentLine = lines[j].trim();
                                
                                // Pular linhas vazias duplicadas
                                if (!currentLine) {
                                    if (deduplicatedLines.length === 0 || deduplicatedLines[deduplicatedLines.length - 1].trim() !== '') {
                                        deduplicatedLines.push('');
                                    }
                                    continue;
                                }
                                
                                // Verificar se a linha não é idêntica à anterior
                                const prevLine = j > 0 && deduplicatedLines.length > 0 
                                    ? deduplicatedLines[deduplicatedLines.length - 1].trim() 
                                    : '';
                                
                                // Verificar se não é uma duplicação parcial (começa igual) - mais rigoroso
                                const prevStart = prevLine.substring(0, Math.min(80, prevLine.length));
                                const currStart = currentLine.substring(0, Math.min(80, currentLine.length));
                                
                                if (currentLine !== prevLine && prevStart !== currStart) {
                                    deduplicatedLines.push(lines[j]);
                                } else if (currentLine === prevLine) {
                                    console.warn(`⚠️ Linha duplicada exata removida: ${currentLine.substring(0, 50)}...`);
                                } else if (prevStart === currStart && prevLine.length > 50) {
                                    console.warn(`⚠️ Linha duplicada parcial removida: ${currentLine.substring(0, 50)}...`);
                                }
                            }
                            
                            cleanedTranslation = deduplicatedLines.join('\n').trim();
                            
                            // Remover linhas vazias excessivas
                            cleanedTranslation = cleanedTranslation.replace(/\n{3,}/g, '\n\n').trim();
                            
                            // Validar se há palavras cortadas (palavras que terminam abruptamente)
                            const cutWords = cleanedTranslation.match(/\b\w{1,4}\s+(?=[A-Z])/g);
                            if (cutWords && cutWords.length > 0) {
                                console.warn(`⚠️ Possíveis palavras cortadas detectadas: ${cutWords.join(', ')}`);
                            }
                            
                            // Verificar se o segmento traduzido tem tamanho razoável
                            const originalLength = segment.length;
                            const translatedLength = cleanedTranslation.length;
                            const sizeRatio = translatedLength / originalLength;
                            
                            // Validação: verificar se a tradução está completa
                            const originalParagraphs = segment.split(/\n\s*\n/).filter(p => p.trim()).length;
                            const translatedParagraphs = cleanedTranslation.split(/\n\s*\n/).filter(p => p.trim()).length;
                            
                            // Validação: tamanho muito pequeno ou muito grande pode indicar problema
                            if (sizeRatio < 0.2 && originalLength > 100) {
                                console.warn(`⚠️ Segmento ${segmentNum} traduzido parece muito curto (${translatedLength}/${originalLength} chars, ratio: ${(sizeRatio*100).toFixed(1)}%). Tentando retry...`);
                                
                                // Tentar traduzir novamente uma vez
                                try {
                                    await new Promise(resolve => setTimeout(resolve, 1500));
                                    const retryPrompt = buildTranslationPrompt(lang, segment, i, textSegments.length);
                                    const retryTranslation = await translateSegment(model, retryPrompt, () => {});
                                    
                                    if (retryTranslation && retryTranslation.trim().length > translatedLength * 1.2) {
                                        cleanedTranslation = retryTranslation.trim();
                                        console.log(`✅ Retry bem-sucedido: segmento ${segmentNum} agora tem ${cleanedTranslation.length} caracteres`);
                                    } else {
                                        console.warn(`⚠️ Retry não melhorou significativamente, mantendo tradução original`);
                                    }
                                } catch (retryError) {
                                    console.warn(`⚠️ Retry falhou para segmento ${segmentNum}, usando tradução original:`, retryError.message);
                                }
                            }
                            
                            // Validação: verificar se número de parágrafos corresponde
                            if (originalParagraphs > 0 && translatedParagraphs < originalParagraphs * 0.7) {
                                console.warn(`⚠️ Segmento ${segmentNum} pode estar incompleto: ${translatedParagraphs} parágrafos traduzidos vs ${originalParagraphs} originais. Tentando retry...`);
                                
                                try {
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                    const retryPrompt = buildTranslationPrompt(lang, segment, i, textSegments.length);
                                    const retryTranslation = await translateSegment(model, retryPrompt, () => {});
                                    
                                    if (retryTranslation) {
                                        const retryParagraphs = retryTranslation.split(/\n\s*\n/).filter(p => p.trim()).length;
                                        if (retryParagraphs >= originalParagraphs * 0.8) {
                                            cleanedTranslation = retryTranslation.trim();
                                            console.log(`✅ Retry bem-sucedido: segmento ${segmentNum} agora tem ${retryParagraphs} parágrafos`);
                                        }
                                    }
                                } catch (retryError) {
                                    console.warn(`⚠️ Retry para parágrafos falhou:`, retryError.message);
                                }
                            }
                            
                            // Validação adicional: verificar se a tradução não é completamente diferente
                            // (verificação básica de palavras-chave do original)
                            const originalLower = segment.toLowerCase();
                            const translatedLower = cleanedTranslation.toLowerCase();
                            
                            // Extrair algumas palavras-chave do original (palavras com mais de 4 caracteres)
                            const originalKeywords = originalLower.match(/\b\w{5,}\b/g) || [];
                            const translatedKeywords = translatedLower.match(/\b\w{5,}\b/g) || [];
                            
                            // Se não houver nenhuma palavra-chave em comum e o texto for longo, pode ser tradução incorreta
                            if (originalKeywords.length > 3 && translatedKeywords.length > 3) {
                                const commonKeywords = originalKeywords.filter(kw => translatedKeywords.includes(kw));
                                const similarityRatio = commonKeywords.length / Math.min(originalKeywords.length, translatedKeywords.length);
                                
                                if (similarityRatio < 0.1 && originalLength > 200) {
                                    console.warn(`⚠️ Segmento ${segmentNum} pode ter conteúdo muito diferente do original (similaridade: ${(similarityRatio*100).toFixed(1)}%). Tentando retry...`);
                                    
                                    // Tentar retry com prompt mais enfático
                                    try {
                                        await new Promise(resolve => setTimeout(resolve, 2000));
                                        const strictPrompt = `TRADUÇÃO LITERAL OBRIGATÓRIA: Traduza EXATAMENTE este texto para ${lang}. NÃO invente conteúdo. NÃO reescreva. Apenas traduza palavra por palavra mantendo o significado exato.\n\nTEXTO:\n"""\n${segment}\n"""\n\nRetorne APENAS a tradução literal, sem explicações.`;
                                        const retryTranslation = await translateSegment(model, strictPrompt, () => {});
                                        
                                        if (retryTranslation && retryTranslation.trim()) {
                                            cleanedTranslation = retryTranslation.trim();
                                            console.log(`✅ Retry com prompt estrito bem-sucedido para segmento ${segmentNum}`);
                                        }
                                    } catch (retryError) {
                                        console.warn(`⚠️ Retry estrito falhou para segmento ${segmentNum}:`, retryError.message);
                                    }
                                }
                            }
                            
                            fullTranslatedText += (fullTranslatedText ? "\n\n" : "") + cleanedTranslation;
                            completedSegments++;
                            successfulSegments++;
                            
                            // Atualizar progresso
                            const progress = Math.round((completedSegments / textSegments.length) * 100);
                            progressFill.style.width = `${progress}%`;
                            
                            // Atualizar exibição final
                            out.textContent = fullTranslatedText;
                            
                            console.log(`✅ Segmento ${segmentNum}/${textSegments.length} traduzido para ${lang} (${cleanedTranslation.length} chars, original: ${originalLength} chars)`);
                        } else {
                            console.warn(`⚠️ Segmento ${segmentNum} traduzido está vazio ou inválido`);
                            throw new Error("Segmento traduzido está vazio");
                        }

                    } catch (error) {
                        console.error(`❌ Erro ao traduzir segmento ${segmentNum} para ${lang}:`, error);
                        addToLog(`❌ Erro no segmento ${segmentNum}/${textSegments.length} para ${lang}: ${error.message}`, true);
                        
                        // Tentar adicionar o segmento original se a tradução falhar completamente
                        // Isso garante que nenhuma parte seja perdida
                        if (!segmentTranslated || !segmentTranslated.trim()) {
                            console.warn(`⚠️ Segmento ${segmentNum} não traduzido, adicionando original como fallback`);
                            const fallbackText = segment.trim();
                            fullTranslatedText += (fullTranslatedText ? "\n\n" : "") + `[SEGMENTO ${segmentNum} NÃO TRADUZIDO - ORIGINAL:]\n${fallbackText}`;
                            completedSegments++; // Contar como "completado" para progresso
                            failedSegments++; // Mas marcar como falha
                            
                            // Atualizar progresso
                            const progress = Math.round((completedSegments / textSegments.length) * 100);
                            progressFill.style.width = `${progress}%`;
                            out.textContent = fullTranslatedText;
                        } else {
                            // Se segmentTranslated existe mas houve erro, ainda contar como falha
                            failedSegments++;
                        }
                        
                        // Tentar continuar com os próximos segmentos
                        status.textContent = `Erro no segmento ${segmentNum}, continuando... (${successfulSegments} sucesso, ${failedSegments} falhas)`;
                        status.classList.add("text-yellow-500");
                    }
                }

                // Finalização - Verificar se TODOS os segmentos foram traduzidos
                const allSegmentsTranslated = completedSegments === textSegments.length;
                const allSegmentsSuccessful = successfulSegments === textSegments.length;
                
                // SEMPRE limpar o texto final antes de exibir, independente do status
                let finalText = fullTranslatedText.trim();
                
                if (finalText) {
                    // Remover mensagens de erro da IA
                    const errorMessages = [
                        /lo siento,? pero no puedo ayudar con esa solicitud/gi,
                        /i'm sorry,? but i cannot help with that request/gi,
                        /desculpe,? mas não posso ajudar com essa solicitação/gi,
                        /je suis désolé,? mais je ne peux pas aider avec cette demande/gi,
                        /mi dispiace,? ma non posso aiutare con questa richiesta/gi,
                        /es tut mir leid,? aber ich kann bei dieser anfrage nicht helfen/gi,
                        /sorry,? but i cannot assist with that request/gi
                    ];
                    
                    errorMessages.forEach(pattern => {
                        finalText = finalText.replace(pattern, '');
                    });
                    
                    // Remover palavras cortadas
                    finalText = finalText.replace(/\b(\w{1,4})\s+(?=[A-Z])/g, ' ');
                    finalText = finalText.replace(/\b(\w{1,4})\s+(?=\w{3,})/g, ' ');
                    
                    // Remover duplicações finais de parágrafos
                    const paragraphs = finalText.split(/\n\s*\n/).filter(p => p.trim());
                    const uniqueParagraphs = [];
                    const seenFullParagraphs = new Map();
                    
                    for (const para of paragraphs) {
                        const paraTrimmed = para.trim();
                        const startKey = paraTrimmed.substring(0, 100).toLowerCase().replace(/\s+/g, ' ');
                        const endKey = paraTrimmed.length > 50 
                            ? paraTrimmed.substring(paraTrimmed.length - 50).toLowerCase().replace(/\s+/g, ' ')
                            : '';
                        const paraKey = `${startKey}|${endKey}`;
                        
                        let isDuplicate = false;
                        for (const [key] of seenFullParagraphs.entries()) {
                            const keyStart = key.split('|')[0];
                            if (keyStart.length > 70 && (startKey.startsWith(keyStart.substring(0, 70)) || keyStart.startsWith(startKey.substring(0, 70)))) {
                                isDuplicate = true;
                                break;
                            }
                        }
                        
                        if (!isDuplicate && !seenFullParagraphs.has(paraKey)) {
                            seenFullParagraphs.set(paraKey, uniqueParagraphs.length);
                            uniqueParagraphs.push(paraTrimmed);
                        }
                    }
                    
                    finalText = uniqueParagraphs.join('\n\n').trim();
                    
                    // Remover duplicações de frases que começam iguais
                    const sentences = finalText.split(/([.!?]+\s*)/);
                    const uniqueSentences = [];
                    const seenStarts = new Set();
                    
                    for (let i = 0; i < sentences.length; i += 2) {
                        const sentence = sentences[i]?.trim();
                        const punctuation = sentences[i + 1] || '';
                        
                        if (!sentence) {
                            if (punctuation) uniqueSentences.push(punctuation);
                            continue;
                        }
                        
                        const startKey = sentence.substring(0, 80).toLowerCase().replace(/\s+/g, ' ');
                        
                        let isDuplicate = false;
                        for (const seenKey of seenStarts) {
                            const minLen = Math.min(startKey.length, seenKey.length, 60);
                            if (startKey.substring(0, minLen) === seenKey.substring(0, minLen)) {
                                isDuplicate = true;
                                break;
                            }
                        }
                        
                        if (!isDuplicate) {
                            seenStarts.add(startKey);
                            uniqueSentences.push(sentence + punctuation);
                        }
                    }
                    
                    finalText = uniqueSentences.join('').trim();
                    finalText = finalText.replace(/\n{3,}/g, '\n\n').trim();
                }
                
                if (fullTranslatedText && fullTranslatedText.trim() && allSegmentsSuccessful) {
                    // Tradução completa e bem-sucedida
                    // finalText já foi limpo acima
                    out.textContent = finalText;
                    
                    // Armazenar para botões de copiar/baixar
                    out.dataset.fullTranslation = finalText;
                    
                    if (!window.translationResults) {
                        window.translationResults = {};
                    }
                    window.translationResults[lang] = {
                        fullText: fullTranslatedText.trim(),
                        model: model,
                        segmentsTranslated: successfulSegments,
                        totalSegments: textSegments.length,
                        success: true
                    };
                    
                    status.textContent = `✓ Concluído: ${successfulSegments}/${textSegments.length} sucesso, ${failedSegments} falhas`;
                    status.classList.remove("text-red-600", "text-blue-500", "text-yellow-500");
                    status.classList.add("text-green-600");
                    progressFill.style.width = "100%";
                    
                    // SEMPRE mostrar botões se houver texto
                    const actionsEl = document.getElementById(`actions-${lang}`);
                    if (actionsEl && finalText && finalText.trim()) {
                        actionsEl.style.display = "flex";
                    }
                    
                    console.log(`✅ Tradução completa para ${lang}: ${fullTranslatedText.length} caracteres, ${successfulSegments}/${textSegments.length} segmentos bem-sucedidos`);
                } else if (fullTranslatedText && fullTranslatedText.trim() && successfulSegments > 0) {
                    // Tradução parcial - alguns segmentos falharam, mas ainda mostrar botões
                    status.textContent = `⚠️ Parcial: ${successfulSegments}/${textSegments.length} sucesso, ${failedSegments} falhas`;
                    status.classList.remove("text-red-600", "text-blue-500");
                    status.classList.add("text-yellow-500");
                    progressFill.style.width = `${Math.round((completedSegments / textSegments.length) * 100)}%`;
                    
                    // Usar o finalText já limpo acima
                    const errorMessages = [
                        /lo siento,? pero no puedo ayudar con esa solicitud/gi,
                        /i'm sorry,? but i cannot help with that request/gi,
                        /desculpe,? mas não posso ajudar com essa solicitação/gi,
                        /je suis désolé,? mais je ne peux pas aider avec cette demande/gi,
                        /mi dispiace,? ma non posso aiutare con questa richiesta/gi,
                        /es tut mir leid,? aber ich kann bei dieser anfrage nicht helfen/gi,
                        /sorry,? but i cannot assist with that request/gi
                    ];
                    
                    errorMessages.forEach(pattern => {
                        finalText = finalText.replace(pattern, '');
                    });
                    
                    // Remover duplicações finais de parágrafos completos
                    const paragraphs = finalText.split(/\n\s*\n/).filter(p => p.trim());
                    const uniqueParagraphs = [];
                    const seenFullParagraphs = new Set();
                    
                    for (const para of paragraphs) {
                        const paraKey = para.trim().toLowerCase().substring(0, 200);
                        if (!seenFullParagraphs.has(paraKey)) {
                            seenFullParagraphs.add(paraKey);
                            uniqueParagraphs.push(para);
                        }
                    }
                    
                    finalText = uniqueParagraphs.join('\n\n').trim();
                    finalText = finalText.replace(/\n{3,}/g, '\n\n').trim();
                    
                    // Ainda mostrar o que foi traduzido
                    out.textContent = finalText;
                    out.dataset.fullTranslation = finalText;
                    
                    if (!window.translationResults) {
                        window.translationResults = {};
                    }
                    window.translationResults[lang] = {
                        fullText: finalText,
                        model: model,
                        segmentsTranslated: successfulSegments,
                        totalSegments: textSegments.length,
                        success: false,
                        failedSegments: failedSegments
                    };
                    
                    // MOSTRAR BOTÕES MESMO COM FALHAS PARCIAIS
                    const actionsEl = document.getElementById(`actions-${lang}`);
                    if (actionsEl && finalText && finalText.trim()) {
                        actionsEl.style.display = "flex";
                    }
                    
                    addToLog(`⚠️ Tradução parcial para ${lang}: ${successfulSegments}/${textSegments.length} segmentos traduzidos com sucesso. ${failedSegments} segmentos falharam.`, true);
                    console.warn(`⚠️ Tradução parcial para ${lang}: ${successfulSegments}/${textSegments.length} segmentos bem-sucedidos, ${failedSegments} falhas`);
                } else {
                    status.textContent = `✗ Falha: ${successfulSegments}/${textSegments.length} sucesso, ${failedSegments} falhas`;
                    status.classList.remove("text-blue-500", "text-yellow-500");
                    status.classList.add("text-red-600");
                    
                    // Se houver algum texto, ainda mostrar botões
                    if (finalText && finalText.trim()) {
                        out.textContent = finalText;
                        out.dataset.fullTranslation = finalText;
                        
                        const actionsEl = document.getElementById(`actions-${lang}`);
                        if (actionsEl) {
                            actionsEl.style.display = "flex";
                        }
                    }
                    
                    addToLog(`❌ Tradução falhou para ${lang}: ${successfulSegments} sucesso, ${failedSegments} falhas`, true);
                    console.error(`❌ Falha na tradução para ${lang}: ${successfulSegments} sucesso, ${failedSegments} falhas`);
                }

            } catch (error) {
                console.error(`❌ Erro fatal ao processar tradução para ${lang}:`, error);
                addToLog(`❌ Erro fatal: ${lang}: ${error.message}`, true);
                const statusEl = document.getElementById(`status-${lang}`);
                if (statusEl) {
                    statusEl.textContent = "✗ Erro fatal";
                    statusEl.classList.add("text-red-600");
                }
            }
        }

        showSuccessToast("Processo de tradução iniciado! Aguarde a conclusão.");
            
            // Configurar event listeners para botões de copiar/baixar (usando delegação de eventos)
            setTimeout(() => {
                const outputContainer = document.getElementById('output');
                if (outputContainer) {
                    // Copiar tradução
                    outputContainer.addEventListener('click', (e) => {
                        if (e.target.classList.contains('copy-translation-btn') || e.target.closest('.copy-translation-btn')) {
                            const btn = e.target.classList.contains('copy-translation-btn') ? e.target : e.target.closest('.copy-translation-btn');
                            const lang = btn.dataset.lang;
                            const outputEl = document.getElementById(`output-${lang}`);
                            
                            if (outputEl) {
                                const textToCopy = outputEl.dataset.fullTranslation || outputEl.textContent || '';
                                if (textToCopy.trim()) {
                                    navigator.clipboard.writeText(textToCopy.trim()).then(() => {
                                        showSuccessToast(`Tradução em ${lang} copiada!`);
                                    }).catch(err => {
                                        console.error('Erro ao copiar:', err);
                                        showSuccessToast('Erro ao copiar tradução', true);
                                    });
                                } else {
                                    showSuccessToast('Nenhum texto para copiar', true);
                                }
                            }
                        }
                        
                        // Baixar tradução
                        if (e.target.classList.contains('download-translation-btn') || e.target.closest('.download-translation-btn')) {
                            const btn = e.target.classList.contains('download-translation-btn') ? e.target : e.target.closest('.download-translation-btn');
                            const lang = btn.dataset.lang;
                            const outputEl = document.getElementById(`output-${lang}`);
                            
                            if (outputEl) {
                                const textToDownload = outputEl.dataset.fullTranslation || outputEl.textContent || '';
                                if (textToDownload.trim()) {
                                    const blob = new Blob([textToDownload.trim()], { type: 'text/plain;charset=utf-8' });
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    
                                    // Nome do arquivo baseado no idioma
                                    const langName = lang.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                                    a.download = `traducao_${langName}_${new Date().getTime()}.txt`;
                                    
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    document.body.removeChild(a);
                                    
                                    showSuccessToast(`Tradução em ${lang} baixada!`);
                                } else {
                                    showSuccessToast('Nenhum texto para baixar', true);
                                }
                            }
                        }
                    });
                }
            }, 100);
        } catch (error) {
            console.error('❌ Erro fatal no handler translate-script:', error);
            console.error('Stack trace:', error.stack);
            if (window.showSuccessToast) {
                window.showSuccessToast(`Erro ao iniciar tradução: ${error.message}`, true);
            }
        }
    },

    init() {
        console.log('✅ Módulo Tradutor de Roteiro inicializado');
    }
};
