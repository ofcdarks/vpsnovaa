

export default {
    id: 'script-cleaner',
    name: 'Limpador de Roteiro',
    
    
    cleanPart(text) {
        if (!text || typeof text !== 'string') return '';
        
        let cleaned = text;
        
                        cleaned = cleaned.replace(/^###\s*PARTE\s*\d+[:\s]*.*?$/gmi, '');
        cleaned = cleaned.replace(/^###\s*PARTE\s*\d+$/gmi, '');
        
                cleaned = cleaned.replace(/\[--PART\s*\d+[^\]]*?--\]/gi, '');
        cleaned = cleaned.replace(/\[--PART\s*\d+:\s*[^\]]*?--\]/gi, '');
        cleaned = cleaned.replace(/----\[--PART[^\]]*?--\]/gi, '');
        cleaned = cleaned.replace(/\[\s*--\s*PART\s*\d+[^\]]*?\s*--\s*\]/gi, '');
        cleaned = cleaned.replace(/\[--ENDPART--\]/gi, '');
        cleaned = cleaned.replace(/----\[--ENDPART--\]/gi, '');
        cleaned = cleaned.replace(/\[\s*--\s*ENDPART\s*--\s*\]/gi, '');
        cleaned = cleaned.replace(/\[--VOICEOVER_PART_BREAK--\]/gi, '');
        cleaned = cleaned.replace(/----\[--VOICEOVER_PART_BREAK--\]/gi, '');
        
                cleaned = cleaned.replace(/[^\n]*?\[--PART[^\]]*?--\][^\n]*?/gi, '');
        cleaned = cleaned.replace(/[^\n]*?\[--ENDPART--\][^\n]*?/gi, '');
        cleaned = cleaned.replace(/[^\n]*?\[--VOICEOVER[^\]]*?--\][^\n]*?/gi, '');
        
                cleaned = cleaned.replace(/^[^\n]*?Parte\s+\d+[:\s]*[^\n]*?$/gmi, '');
        
                cleaned = cleaned.replace(/^[^\n]*?\[--[^\]]*?--\][^\n]*?$/gmi, '');
        
                cleaned = cleaned.replace(/<internal_thought>[\s\S]*?<\/internal_thought>/gi, '');
        cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
        cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
        cleaned = cleaned.replace(/^\s*\*\*.*?\:\*\*\s*/gm, '');
        cleaned = cleaned.replace(/^\s*#+\s*.*$/gm, '');
        
                cleaned = cleaned.split('\n').filter(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.length < 3) return false;
                        if (/\[--.*?--\]/.test(trimmed)) return false;
                        if (/^Parte\s+\d+[:\s]*$/i.test(trimmed)) return false;
                        if (/^[\d\s\-\[\]\(\)]+$/.test(trimmed)) return false;
                        if (/^[^\w\s]+$/.test(trimmed)) return false;
                        if (/^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{3,}$/.test(trimmed) && trimmed.length < 100) return false;
                        if (/^[📋🔍⚠️✅❌🎬🧠📊📏📦🔄📤]+/.test(trimmed)) return false;
            return true;
        }).join('\n');
        
                cleaned = this.removeDuplicateSentences(cleaned);
        
                cleaned = this.fixTruncatedText(cleaned);
        
                        cleaned = cleaned.replace(/📋\s*/g, '');
        cleaned = cleaned.replace(/^\s*📋\s*$/gm, '');
        cleaned = cleaned.replace(/🔍\s*/g, '');
        cleaned = cleaned.replace(/⚠️\s*/g, '');
        cleaned = cleaned.replace(/✅\s*/g, '');
        cleaned = cleaned.replace(/❌\s*/g, '');
        cleaned = cleaned.replace(/🎬\s*/g, '');
        cleaned = cleaned.replace(/🧠\s*/g, '');
        cleaned = cleaned.replace(/📊\s*/g, '');
        cleaned = cleaned.replace(/📏\s*/g, '');
        cleaned = cleaned.replace(/📦\s*/g, '');
        cleaned = cleaned.replace(/🔄\s*/g, '');
        cleaned = cleaned.replace(/📤\s*/g, '');
                cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');         cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');         cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');         cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');         cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');         
                cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
        
                cleaned = cleaned.replace(/\[--[^\]]*?--\]/gi, '');
        cleaned = cleaned.replace(/--\[--[^\]]*?--\]/gi, '');
        cleaned = cleaned.replace(/\[--[^\]]*?--/gi, '');
        cleaned = cleaned.replace(/--[^\]]*?--\]/gi, '');
        
                const firstValidSentence = cleaned.match(/[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][^.!?]*[.!?]/);
        if (firstValidSentence && firstValidSentence.index > 50) {
            cleaned = cleaned.substring(firstValidSentence.index);
        }
        
        return cleaned.trim();
    },
    
    
    removeDuplicateSentences(text) {
        if (!text) return '';
        
                let result = text.replace(/\b(\w+)\s+\1\b/gi, '$1');
                result = result.replace(/([.!?]\s+)([^\n]+?)\1\2/g, '$1$2');
        
                const paragraphs = result.split(/\n\n+/).filter(p => p.trim().length > 0);
        const uniqueParagraphs = [];
        
        for (let i = 0; i < paragraphs.length; i++) {
            const current = paragraphs[i].trim();
            const prev = i > 0 ? paragraphs[i - 1].trim() : '';
            let isDuplicate = false;
            
                        if (current && prev && current.length > 30 && prev.length > 30) {
                const similarity = this.calculateSimilarity(current, prev);
                if (similarity > 0.6) {
                    console.log(`⚠️ Parágrafo duplicado removido (similaridade: ${(similarity * 100).toFixed(1)}%)`);
                    isDuplicate = true;
                }
            }
            
                        if (!isDuplicate) {
                for (let j = uniqueParagraphs.length - 1; j >= Math.max(0, uniqueParagraphs.length - 3); j--) {
                    const prevPara = uniqueParagraphs[j].trim();
                    if (prevPara && prevPara.length > 30) {
                        const similarity = this.calculateSimilarity(current, prevPara);
                        if (similarity > 0.65) {
                            console.log(`⚠️ Parágrafo duplicado removido (similaridade com parágrafo anterior: ${(similarity * 100).toFixed(1)}%)`);
                            isDuplicate = true;
                            break;
                        }
                    }
                }
            }
            
            if (!isDuplicate) {
                uniqueParagraphs.push(paragraphs[i]);
            }
        }
        
        result = uniqueParagraphs.join('\n\n');
        
                const lines = result.split('\n');
        const deduplicatedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i].trim();
            const prevLine = i > 0 ? lines[i - 1].trim() : '';
            let isDuplicate = false;
            
            if (currentLine && prevLine && currentLine.length > 20 && prevLine.length > 20) {
                const similarity = this.calculateSimilarity(currentLine, prevLine);
                if (similarity > 0.65) {
                    console.log(`⚠️ Linha duplicada removida (similaridade: ${(similarity * 100).toFixed(1)}%)`);
                    isDuplicate = true;
                }
            }
            
                        if (!isDuplicate) {
                for (let j = deduplicatedLines.length - 1; j >= Math.max(0, deduplicatedLines.length - 5); j--) {
                    const prevLineCheck = deduplicatedLines[j].trim();
                    if (prevLineCheck && prevLineCheck.length > 20) {
                        const similarity = this.calculateSimilarity(currentLine, prevLineCheck);
                        if (similarity > 0.7) {
                            console.log(`⚠️ Linha duplicada removida (similaridade com linha anterior: ${(similarity * 100).toFixed(1)}%)`);
                            isDuplicate = true;
                            break;
                        }
                    }
                }
            }
            
            if (!isDuplicate) {
                deduplicatedLines.push(lines[i]);
            }
        }
        
        result = deduplicatedLines.join('\n');
        
                        const textBlocks = result.split(/([.!?]+\s*)/);
        const uniqueBlocks = [];
        
        for (let i = 0; i < textBlocks.length; i++) {
            const current = textBlocks[i].trim();
            
                        if (/^[.!?]+\s*$/.test(current)) {
                uniqueBlocks.push(textBlocks[i]);
                continue;
            }
            
                        if (current && current.length > 15) {
                                let isDuplicate = false;
                for (let j = uniqueBlocks.length - 1; j >= Math.max(0, uniqueBlocks.length - 10); j--) {
                    const prevBlock = uniqueBlocks[j].trim();
                                        if (/^[.!?]+\s*$/.test(prevBlock)) continue;
                    
                    if (prevBlock && prevBlock.length > 15) {
                        const similarity = this.calculateSimilarity(current, prevBlock);
                        if (similarity > 0.70) {
                            console.log(`⚠️ Bloco de texto duplicado removido (similaridade: ${(similarity * 100).toFixed(1)}%)`);
                            isDuplicate = true;
                            break;
                        }
                    }
                }
                
                if (!isDuplicate) {
                    uniqueBlocks.push(textBlocks[i]);
                }
            } else {
                uniqueBlocks.push(textBlocks[i]);
            }
        }
        
        return uniqueBlocks.join('');
    },
    
    
    fixTruncatedText(text) {
        if (!text) return '';
        
                        let fixed = text.replace(/([^\n.!?])\n([a-zàáâãéêíóôõúç])/g, '$1 $2');
        
                fixed = fixed.replace(/([,:])\s*\n\s*([a-zàáâãéêíóôõúç])/g, '$1 $2');
        
                fixed = fixed.replace(/([a-zàáâãéêíóôõúç])\n([a-zàáâãéêíóôõúç])/g, '$1 $2');
        
                const lines = fixed.split('\n');
        const fixedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            if (!line) {
                fixedLines.push('');
                continue;
            }
            
                        if (!/[.!?]$/.test(line)) {
                                if (i < lines.length - 1) {
                    const nextLine = lines[i + 1].trim();
                                        if (nextLine && (/^[a-zàáâãéêíóôõúç]/.test(nextLine) || nextLine.length < 20)) {
                                                line = line + ' ' + nextLine;
                        i++;                     } else if (line.length > 50 && !line.endsWith(',') && !line.endsWith(':')) {
                                                line = line + '.';
                    }
                } else if (line.length > 50 && !line.endsWith(',') && !line.endsWith(':')) {
                                        line = line + '.';
                }
            }
            
            fixedLines.push(line);
        }
        
        return fixedLines.join('\n');
    },
    
    
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1;
        
                const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const n1 = normalize(str1);
        const n2 = normalize(str2);
        
                if (n1 === n2) return 1;
        
                const words1 = n1.split(/\s+/).filter(w => w.length > 2);
        const words2 = n2.split(/\s+/).filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) return 0;
        
        const commonWords = words1.filter(word => words2.includes(word));
        const similarity = (commonWords.length * 2) / (words1.length + words2.length);
        
                let matches = 0;
        const minLength = Math.min(n1.length, n2.length);
        for (let i = 0; i < minLength; i++) {
            if (n1[i] === n2[i]) matches++;
        }
        const charSimilarity = matches / Math.max(n1.length, n2.length);
        
                return (similarity + charSimilarity) / 2;
    },
    
    
    cleanFullScript(scriptData) {
        if (!scriptData || !scriptData.script_parts || !Array.isArray(scriptData.script_parts)) {
            return scriptData;
        }
        
        const cleanedParts = scriptData.script_parts.map((part, index) => {
            const cleanedContent = this.cleanPart(part.part_content || '');
            
                        let partTitle = part.part_title || `Parte ${index + 1}`;
                        partTitle = partTitle.replace(/\[--.*?--\]/gi, '').trim();
            if (!partTitle || partTitle.length < 3) {
                partTitle = `Parte ${index + 1}`;
            }
            
            return {
                part_title: partTitle,
                part_content: cleanedContent
            };
        }).filter(part => part.part_content && part.part_content.trim().length > 20);
        
                const fullScriptText = cleanedParts
            .map(p => p.part_content)
            .join('\n\n')
            .trim();
        
        return {
            ...scriptData,
            script_parts: cleanedParts,
            full_script_text: fullScriptText
        };
    }
};

