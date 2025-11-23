

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'srt-converter',
    name: 'Conversor de SRT',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    category: 'utility',

    
    async handler(e) {
                if (this._isConverting) {
            console.warn('⚠️ Conversão já em andamento, ignorando nova solicitação');
            return;
        }
        
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        this._isConverting = true;         
        try {
            const utils = getGlobalUtils();
            const {
                showSuccessToast,
                showProgressModal,
                hideProgressModal,
                addToLog
            } = utils;

            const textoInput = document.getElementById('textoInput');
            const resultadoEl = document.getElementById('resultado');
            const downloadBtn = document.getElementById('downloadBtn');
            const limparBtn = document.getElementById('limparBtn');

            if (!textoInput) {
                console.error('❌ Campo textoInput não encontrado');
                if (showSuccessToast) showSuccessToast("Erro: Campo de texto não encontrado.", true);
                return;
            }

            const texto = textoInput.value || '';
            if (!texto || !texto.trim()) {
                if (showSuccessToast) {
                    showSuccessToast("Por favor, cole um texto para converter.");
                }
                return;
            }
        
                        if (showProgressModal) {
                showProgressModal("Convertendo para SRT...", "Processando texto...");
            }
            await new Promise(resolve => setTimeout(resolve, 100));         
                        const DURACAO_BLOCO = 30;             const INTERVALO_ENTRE_BLOCOS = 10;             const PALAVRAS_MIN_BLOCO = 80;
            const PALAVRAS_MAX_BLOCO = 100;
            const CARACTERES_POR_BLOCO = 500;         
            function formatTime(totalSeconds) {
                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = Math.floor(totalSeconds % 60);
                const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
            }
        
                        const isSentenceEnd = (word) => {
                const trimmed = word.trim();
                return /[.!?;:]$/.test(trimmed);
            };
            
                        const hasIntermediatePunctuation = (word) => {
                const trimmed = word.trim();
                return /[,;:]$/.test(trimmed);
            };
        
            const words = texto.split(/\s+/).filter(Boolean);
            let srtContent = '';
            let subtitleIndex = 1;
            let currentTime = 0;             let wordPointer = 0;
        
            while (wordPointer < words.length) {
                let currentBlockWords = [];
                let currentBlockChars = 0;
                let tempWordPointer = wordPointer;
                let bestBreakPoint = -1;                 let foundSentenceEnd = false;
        
                                while (tempWordPointer < words.length) {
                    const word = words[tempWordPointer];
                    const potentialWordLength = word.length + (currentBlockWords.length > 0 ? 1 : 0);         
                                                            const wouldExceedLimit = (currentBlockChars + potentialWordLength) >= CARACTERES_POR_BLOCO || currentBlockWords.length >= PALAVRAS_MAX_BLOCO;
                    
                                        if (wouldExceedLimit || (currentBlockWords.length >= PALAVRAS_MIN_BLOCO && isSentenceEnd(word))) {
                                                if (isSentenceEnd(word) && currentBlockWords.length >= PALAVRAS_MIN_BLOCO) {
                            currentBlockWords.push(word);
                            currentBlockChars += potentialWordLength;
                            tempWordPointer++;
                            foundSentenceEnd = true;
                            break;
                        }
                        
                                                if (wouldExceedLimit && isSentenceEnd(word) && currentBlockWords.length > 0) {
                            currentBlockWords.push(word);
                            currentBlockChars += potentialWordLength;
                            tempWordPointer++;
                            foundSentenceEnd = true;
                            break;
                        }
                        
                                                if (wouldExceedLimit) {
                                                        if (bestBreakPoint > 0) {
                                                                const wordsToKeep = currentBlockWords.slice(0, bestBreakPoint + 1);
                                currentBlockWords = wordsToKeep;
                                tempWordPointer = wordPointer + wordsToKeep.length;
                                foundSentenceEnd = true;
                                break;
                            }
                                                        if (bestBreakPoint === -1) {
                                for (let i = currentBlockWords.length - 1; i >= Math.max(0, currentBlockWords.length - 10); i--) {
                                    if (hasIntermediatePunctuation(currentBlockWords[i])) {
                                        bestBreakPoint = i;
                                        break;
                                    }
                                }
                                if (bestBreakPoint > 0) {
                                    const wordsToKeep = currentBlockWords.slice(0, bestBreakPoint + 1);
                                    currentBlockWords = wordsToKeep;
                                    tempWordPointer = wordPointer + wordsToKeep.length;
                                    break;
                                }
                            }
                                                        break;
                        }
                    }
        
                                        currentBlockWords.push(word);
                    currentBlockChars += potentialWordLength;
                    
                                        if (isSentenceEnd(word)) {
                        bestBreakPoint = currentBlockWords.length - 1;
                                                if (currentBlockWords.length >= PALAVRAS_MIN_BLOCO) {
                            tempWordPointer++;
                            foundSentenceEnd = true;
                            break;
                        }
                    } else if (hasIntermediatePunctuation(word) && bestBreakPoint === -1) {
                                                bestBreakPoint = currentBlockWords.length - 1;
                    }
                    
                    tempWordPointer++;
                }
        
                                if (currentBlockWords.length < PALAVRAS_MIN_BLOCO && !foundSentenceEnd && tempWordPointer < words.length) {
                    while (currentBlockWords.length < PALAVRAS_MIN_BLOCO && tempWordPointer < words.length) {
                        const word = words[tempWordPointer];
                        const potentialWordLength = word.length + (currentBlockWords.length > 0 ? 1 : 0);
        
                                                if ((currentBlockChars + potentialWordLength) >= CARACTERES_POR_BLOCO || currentBlockWords.length >= PALAVRAS_MAX_BLOCO) {
                                                        if (bestBreakPoint > 0 && bestBreakPoint < currentBlockWords.length) {
                                const wordsToKeep = currentBlockWords.slice(0, bestBreakPoint + 1);
                                currentBlockWords = wordsToKeep;
                                tempWordPointer = wordPointer + wordsToKeep.length;
                                break;
                            }
                            break;
                        }
                        
                        currentBlockWords.push(word);
                        currentBlockChars += potentialWordLength;
                        
                                                if (isSentenceEnd(word)) {
                            tempWordPointer++;
                            foundSentenceEnd = true;
                            break;
                        }
                        
                        tempWordPointer++;
                    }
                }
        
                                if (currentBlockWords.length === 0 && wordPointer < words.length) {
                                        currentBlockWords.push(words[wordPointer]);
                    tempWordPointer = wordPointer + 1;
                } else if (currentBlockWords.length === 0) {
                    break;                 }
        
                let blockText = currentBlockWords.join(' ');
                
                                if (blockText.length > CARACTERES_POR_BLOCO) {
                                        let truncatedText = blockText.substring(0, CARACTERES_POR_BLOCO);
                    const lastSpaceIndex = truncatedText.lastIndexOf(' ');
                    
                    if (lastSpaceIndex > 0) {
                        truncatedText = truncatedText.substring(0, lastSpaceIndex);
                    } else {
                                                truncatedText = truncatedText.substring(0, CARACTERES_POR_BLOCO);
                    }
                    
                    blockText = truncatedText.trim();
                    
                                        const usedWords = blockText.split(/\s+/).filter(Boolean);
                    if (usedWords.length < currentBlockWords.length) {
                        tempWordPointer = wordPointer + usedWords.length;
                    }
                }
                
                                if (blockText.length > CARACTERES_POR_BLOCO) {
                    blockText = blockText.substring(0, CARACTERES_POR_BLOCO).trim();
                }
                
                const startTime = currentTime;
                const endTime = startTime + DURACAO_BLOCO;
        
                srtContent += `${subtitleIndex}\n`;
                srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
                srtContent += blockText;
                srtContent += '\n\n';
                
                currentTime = endTime + INTERVALO_ENTRE_BLOCOS;
                wordPointer = tempWordPointer;                 subtitleIndex++;
        
                if (subtitleIndex % 100 === 0) {                     await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        
            if (resultadoEl) {
                resultadoEl.textContent = srtContent.trim();
                resultadoEl.style.display = 'block';
            }
            if (downloadBtn) {
                downloadBtn.style.display = 'block';
            }
            if (limparBtn) {
                limparBtn.style.display = 'block';
            }
            
                        if (hideProgressModal) {
                hideProgressModal();
            }
            if (showSuccessToast) {
                showSuccessToast("Texto convertido para SRT!");
            }
        
        } catch (error) {
            console.error("Erro no conversor SRT:", error);
            
                        try {
                if (hideProgressModal) {
                    hideProgressModal();
                }
                if (addToLog) {
                    addToLog(`Erro ao converter para SRT: ${error.message}`, true);
                }
                if (resultadoEl) {
                    resultadoEl.textContent = `Ocorreu um erro inesperado. Por favor, tente novamente. Detalhes: ${error.message}`;
                    resultadoEl.style.display = 'block';
                }
                if (showSuccessToast) {
                    showSuccessToast(`Erro ao converter: ${error.message}`, true);
                }
            } catch (closeError) {
                console.error("Erro ao fechar modal:", closeError);
            }
        } finally {
                        this._isConverting = false;
        }
    },

    
    init() {
        console.log('✅ Módulo SRT Converter inicializado');
        
                setTimeout(() => {
                        if (typeof window.initializeSrtConverter === 'function') {
                window.initializeSrtConverter();
            } else {
                                const textoInput = document.getElementById('textoInput');
                const convertSrtButton = document.getElementById('convert-srt-button');
                const resultadoEl = document.getElementById('resultado');
                const downloadBtn = document.getElementById('downloadBtn');
                const limparBtn = document.getElementById('limparBtn');

                const clearSrtOutput = () => {
                    if (textoInput) textoInput.value = '';
                    if (resultadoEl) resultadoEl.textContent = '';
                    if (downloadBtn) downloadBtn.style.display = 'none';
                    if (limparBtn) limparBtn.style.display = 'none';
                    const { showSuccessToast } = getGlobalUtils();
                    showSuccessToast('Campos SRT limpos.');
                };
                
                                if (downloadBtn) {
                                        const newDownloadBtn = downloadBtn.cloneNode(true);
                    downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
                    
                    newDownloadBtn.addEventListener('click', () => {
                        const resultado = resultadoEl?.textContent || '';
                        if (!resultado || !resultado.trim()) {
                            const { showSuccessToast } = getGlobalUtils();
                            showSuccessToast("Nenhum resultado SRT disponível para transferir.", true);
                            return;
                        }
                        
                                                if (typeof window.safelyDownloadFile === 'function') {
                            window.safelyDownloadFile(resultado.trim(), 'legendas.srt', 'text/plain', 'Transferência do SRT iniciada!');
                        } else {
                                                        const blob = new Blob([resultado.trim()], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'legendas.srt';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            const { showSuccessToast } = getGlobalUtils();
                            showSuccessToast('Transferência do SRT iniciada!');
                        }
                    });
                }

                if (convertSrtButton && !convertSrtButton.dataset.listenerAdded) {
                    convertSrtButton.dataset.listenerAdded = 'true';
                    convertSrtButton.addEventListener('click', (e) => this.handler(e));
                }
                
                if (limparBtn) {
                                        const newLimparBtn = limparBtn.cloneNode(true);
                    limparBtn.parentNode.replaceChild(newLimparBtn, limparBtn);
                    newLimparBtn.addEventListener('click', clearSrtOutput);
                }
            }
        }, 150);
    }
};
