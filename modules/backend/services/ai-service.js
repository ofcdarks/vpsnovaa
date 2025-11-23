/**
 * Serviço de IA
 * Centraliza todas as chamadas para APIs de IA (GPT, Claude, Gemini)
 */

const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { parseJsonRobustly } = require('../utils/json-parser');
const { getTokenLimits, normalizeModelName } = require('../../token-limits');

class AIService {
    constructor(apiKeys) {
        this.apiKeys = apiKeys || {};
        this.geminiClients = new Map();
    }

    /**
     * Detecta o provedor da API baseado no nome do modelo
     */
    detectProvider(model) {
        const modelLower = model.toLowerCase();
        if (modelLower.includes('gpt') || modelLower.includes('o1')) {
            return 'gpt';
        } else if (modelLower.includes('claude')) {
            return 'claude';
        } else if (modelLower.includes('gemini')) {
            return 'gemini';
        }
        throw new Error(`Modelo desconhecido: ${model}`);
    }

    /**
     * Obtém cliente Gemini (com cache)
     */
    getGeminiClient(key) {
        if (!this.geminiClients.has(key)) {
            this.geminiClients.set(key, new GoogleGenerativeAI(key));
        }
        return this.geminiClients.get(key);
    }

    /**
     * Gera conteúdo usando streaming
     */
    async generateStream(model, prompt, options = {}) {
        const provider = this.detectProvider(model);
        const { maxOutputTokens, temperature, schema } = options;

        if (provider === 'gpt') {
            return this._generateGPTStream(model, prompt, { maxOutputTokens, temperature });
        } else if (provider === 'claude') {
            return this._generateClaudeStream(model, prompt, { maxOutputTokens, temperature });
        } else if (provider === 'gemini') {
            return this._generateGeminiStream(model, prompt, { maxOutputTokens, temperature, schema });
        }
    }

    /**
     * Gera conteúdo sem streaming
     */
    async generate(model, prompt, options = {}) {
        const provider = this.detectProvider(model);
        const { maxOutputTokens, temperature, schema } = options;

        if (provider === 'gpt') {
            return this._generateGPT(model, prompt, { maxOutputTokens, temperature });
        } else if (provider === 'claude') {
            return this._generateClaude(model, prompt, { maxOutputTokens, temperature });
        } else if (provider === 'gemini') {
            return this._generateGemini(model, prompt, { maxOutputTokens, temperature, schema });
        }
    }

    /**
     * Geração GPT com streaming
     */
    async _generateGPTStream(model, prompt, options) {
        const { maxOutputTokens, temperature } = options;
        const gptKey = this.apiKeys.gpt;
        if (!gptKey) throw new Error("Chave de API OpenAI (GPT) não configurada.");

        const body = {
            model: model,
            messages: [{ role: "user", content: prompt }],
            stream: true
        };
        if (maxOutputTokens) body.max_tokens = maxOutputTokens;
        if (temperature !== undefined) body.temperature = temperature;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', body, {
            headers: { 'Authorization': `Bearer ${gptKey}`, 'Content-Type': 'application/json' },
            responseType: 'stream'
        });

        return response.data;
    }

    /**
     * Geração GPT sem streaming
     */
    async _generateGPT(model, prompt, options) {
        const { maxOutputTokens, temperature } = options;
        const gptKey = this.apiKeys.gpt;
        if (!gptKey) throw new Error("Chave de API OpenAI (GPT) não configurada.");

        const body = {
            model: model,
            messages: [{ role: "user", content: prompt }]
        };
        if (maxOutputTokens) body.max_tokens = maxOutputTokens;
        if (temperature !== undefined) body.temperature = temperature;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', body, {
            headers: { 'Authorization': `Bearer ${gptKey}`, 'Content-Type': 'application/json' }
        });

        const content = response.data.choices[0].message.content;
        return { text: content };
    }

    /**
     * Geração Claude com streaming
     */
    async _generateClaudeStream(model, prompt, options) {
        const { maxOutputTokens, temperature } = options;
        const claudeKey = this.apiKeys.claude;
        if (!claudeKey) throw new Error("Chave de API Anthropic (Claude) não configurada.");

        const body = {
            model: model,
            max_tokens: maxOutputTokens || 4096,
            messages: [{ role: "user", content: prompt }],
            stream: true
        };
        if (temperature !== undefined) body.temperature = temperature;

        const response = await axios.post('https://api.anthropic.com/v1/messages', body, {
            headers: {
                'x-api-key': claudeKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });

        return response.data;
    }

    /**
     * Geração Claude sem streaming
     */
    async _generateClaude(model, prompt, options) {
        const { maxOutputTokens, temperature } = options;
        const claudeKey = this.apiKeys.claude;
        if (!claudeKey) throw new Error("Chave de API Anthropic (Claude) não configurada.");

        const body = {
            model: model,
            max_tokens: maxOutputTokens || 4096,
            messages: [{ role: "user", content: prompt }]
        };
        if (temperature !== undefined) body.temperature = temperature;

        const response = await axios.post('https://api.anthropic.com/v1/messages', body, {
            headers: {
                'x-api-key': claudeKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        });

        const content = response.data.content[0].text;
        return { text: content };
    }

    /**
     * Geração Gemini com streaming
     */
    async _generateGeminiStream(model, prompt, options) {
        const { maxOutputTokens, temperature, schema } = options;
        const geminiKeys = this.apiKeys.gemini || [];
        if (geminiKeys.length === 0) throw new Error("Nenhuma chave de API Gemini está configurada.");

        const key = geminiKeys[0];
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
        
        const generationConfig = {
            maxOutputTokens: maxOutputTokens || 8192
        };
        if (temperature !== undefined) generationConfig.temperature = temperature;
        if (schema) generationConfig.response_mime_type = "application/json";

        const response = await axios.post(apiUrl, {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig
        }, { responseType: 'stream' });

        return response.data;
    }

    /**
     * Geração Gemini sem streaming
     */
    async _generateGemini(model, prompt, options) {
        const { maxOutputTokens, temperature, schema } = options;
        const geminiKeys = this.apiKeys.gemini || [];
        if (geminiKeys.length === 0) throw new Error("Nenhuma chave de API Gemini está configurada.");

        const key = geminiKeys[0];
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        
        const generationConfig = {
            maxOutputTokens: maxOutputTokens || 8192
        };
        if (temperature !== undefined) generationConfig.temperature = temperature;
        if (schema) generationConfig.response_mime_type = "application/json";

        const response = await axios.post(apiUrl, {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig
        }, { headers: { 'Content-Type': 'application/json' }, timeout: 300000 });

        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Resposta da API Gemini vazia ou malformada.');

        if (schema) {
            return parseJsonRobustly(text, "Gemini");
        }

        return { text };
    }
}

module.exports = AIService;

