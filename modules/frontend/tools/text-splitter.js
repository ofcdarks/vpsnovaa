/**
 * Módulo: Divisor de Texto
 * Divide textos em partes menores para processamento
 * CÓDIGO COMPLETO - Versão idêntica à função original
 */

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'text-splitter',
    name: 'Divisor de Texto',
    icon: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
    category: 'utility',

    /**
     * Handler principal - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - handler 'split-text-btn' dentro de initializeTextDivider
     */
    async handler() {
        const utils = getGlobalUtils();
        const {
            showSuccessToast,
            createCopyButton
        } = utils;

        const textDividerInput = document.getElementById('text-divider-input');
        const splitChunkSizeInput = document.getElementById('split-chunk-size');
        const splitChunkTypeSelect = document.getElementById('split-chunk-type');
        const outputEl = document.getElementById('output');

        const text = textDividerInput?.value.trim();
        const chunkSize = parseInt(splitChunkSizeInput?.value, 10);
        const chunkType = splitChunkTypeSelect?.value;

        if (!text) {
            showSuccessToast("Por favor, insira o roteiro completo para dividir.");
            return;
        }
        if (isNaN(chunkSize) || chunkSize <= 0) {
            showSuccessToast("Por favor, insira um tamanho de divisao valido.");
            return;
        }

        let parts = [];
        if (chunkType === 'word') {
            const words = text.split(/\s+/).filter(Boolean);
            for (let i = 0; i < words.length; i += chunkSize) {
                parts.push(words.slice(i, i + chunkSize).join(' '));
            }
        } else { // char
            for (let i = 0; i < text.length; i += chunkSize) {
                parts.push(text.slice(i, i + chunkSize));
            }
        }

        if (outputEl) {
            outputEl.innerHTML = parts.map((part, index) => `
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-bold text-gray-900 dark:text-gray-100">Parte ${index + 1}</h4>
                        ${createCopyButton(part)}
                    </div>
                    <div class="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap">${part}</div>
                </div>
            `).join('');
        }
        showSuccessToast("Texto dividido com sucesso!");
    },

    /**
     * Inicialização - CÓDIGO COMPLETO DO ORIGINAL
     * Extraído do app.js - função initializeTextDivider
     */
    init() {
        console.log('✅ Módulo Text Splitter inicializado');
        
        // Aguardar um pouco para garantir que o template foi renderizado
        setTimeout(() => {
            // Chamar a função global se existir (prioridade)
            if (typeof window.initializeTextDivider === 'function') {
                window.initializeTextDivider();
                return;
            }
            
            // Se não existir, inicializar manualmente
            const textDividerInput = document.getElementById('text-divider-input');
            const wordCountEl = document.getElementById('word-count');
            const charCountEl = document.getElementById('char-count');
            const timeEstimateEl = document.getElementById('time-estimate');
            const splitTextBtn = document.getElementById('split-text-btn');
            
            if (!textDividerInput || !wordCountEl || !charCountEl || !timeEstimateEl) {
                // Limitar tentativas para evitar loop infinito
                if (!this._initAttempts) this._initAttempts = 0;
                this._initAttempts++;
                
                if (this._initAttempts < 3) {
                    console.warn('⚠️ Elementos do Divisor de Texto não encontrados. Tentando novamente...');
                    setTimeout(() => this.init(), 500);
                } else {
                    console.warn('⚠️ Divisor de Texto: Elementos não encontrados após 3 tentativas. Aguardando renderização do template...');
                    this._initAttempts = 0; // Reset para próxima vez
                }
                return;
            }
            
            // Reset contador se encontrou os elementos
            this._initAttempts = 0;

            const updateCounts = () => {
                const text = textDividerInput.value || '';
                const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
                const chars = text.length;
                
                // Estimativa: 150 palavras por minuto para narração
                const wordsPerMinute = 150;
                const totalMinutes = words / wordsPerMinute;
                const totalSeconds = Math.round(totalMinutes * 60);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

                if (wordCountEl) wordCountEl.textContent = words;
                if (charCountEl) charCountEl.textContent = chars;
                if (timeEstimateEl) timeEstimateEl.textContent = formattedTime;
            };

            // Verificar se já tem listeners (usar flag para evitar duplicatas)
            if (!textDividerInput.dataset.listenersAttached) {
                // Adicionar listeners diretamente
                textDividerInput.addEventListener('input', updateCounts);
                textDividerInput.addEventListener('paste', () => setTimeout(updateCounts, 10));
                textDividerInput.addEventListener('keyup', updateCounts);
                textDividerInput.addEventListener('change', updateCounts);
                
                // Marcar que os listeners foram anexados
                textDividerInput.dataset.listenersAttached = 'true';
            }
            
            // Atualizar contadores imediatamente (importante para texto já existente)
            updateCounts();
            
            // Configurar botão de dividir se necessário
            if (splitTextBtn && !splitTextBtn.dataset.listenerAdded) {
                splitTextBtn.dataset.listenerAdded = 'true';
                // O handler já está registrado globalmente, não precisa duplicar
            }
            
            console.log('✅ Event listeners do Divisor de Texto configurados e contadores atualizados');
        }, 200);
    }
};
