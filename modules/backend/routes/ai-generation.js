/**
 * Rotas de Geração de IA
 * Centraliza todas as rotas relacionadas à geração de conteúdo com IA
 */

module.exports = (app, db, services) => {
    const { aiService } = services;
    const { verifyToken } = require('../middleware/auth');

    /**
     * POST /api/generate-stream
     * Gera conteúdo usando streaming
     */
    app.post('/api/generate-stream', verifyToken, async (req, res) => {
        try {
            const { model, prompt, stream, maxOutputTokens, temperature, schema } = req.body;

            if (!model || !prompt) {
                return res.status(400).json({ message: 'Modelo e prompt são obrigatórios' });
            }

            // Obter configurações do usuário
            const user = await db.get('SELECT settings FROM users WHERE id = ?', [req.user.id]);
            const settings = user ? JSON.parse(user.settings || '{}') : {};

            // Configurar chaves de API
            aiService.apiKeys = {
                gpt: settings.gpt || process.env.GPT_API_KEY,
                claude: settings.claude || process.env.CLAUDE_API_KEY,
                gemini: Array.isArray(settings.gemini) ? settings.gemini : [settings.gemini].filter(Boolean)
            };

            // Gerar stream
            const streamData = await aiService.generateStream(model, prompt, {
                maxOutputTokens,
                temperature,
                schema
            });

            // Pipe do stream para resposta
            streamData.pipe(res);

            req.on('close', () => {
                if (streamData && typeof streamData.destroy === 'function') {
                    streamData.destroy();
                }
            });
        } catch (error) {
            console.error('Erro ao gerar stream:', error);
            if (res.headersSent) {
                res.end();
            } else {
                res.status(500).json({ 
                    message: error.response?.data?.error?.message || error.message 
                });
            }
        }
    });

    /**
     * POST /api/generate
     * Gera conteúdo sem streaming
     */
    app.post('/api/generate', verifyToken, async (req, res) => {
        try {
            const { model, prompt, maxOutputTokens, temperature, schema } = req.body;

            if (!model || !prompt) {
                return res.status(400).json({ message: 'Modelo e prompt são obrigatórios' });
            }

            // Obter configurações do usuário
            const user = await db.get('SELECT settings FROM users WHERE id = ?', [req.user.id]);
            const settings = user ? JSON.parse(user.settings || '{}') : {};

            // Configurar chaves de API
            aiService.apiKeys = {
                gpt: settings.gpt || process.env.GPT_API_KEY,
                claude: settings.claude || process.env.CLAUDE_API_KEY,
                gemini: Array.isArray(settings.gemini) ? settings.gemini : [settings.gemini].filter(Boolean)
            };

            // Gerar conteúdo
            const result = await aiService.generate(model, prompt, {
                maxOutputTokens,
                temperature,
                schema
            });

            res.json({ 
                data: result, 
                apiSource: `AI Service (${aiService.detectProvider(model)})` 
            });
        } catch (error) {
            console.error('Erro ao gerar conteúdo:', error);
            res.status(500).json({ 
                message: error.response?.data?.error?.message || error.message 
            });
        }
    });

    /**
     * POST /api/generate-legacy
     * Endpoint legado para compatibilidade
     */
    app.post('/api/generate-legacy', verifyToken, async (req, res) => {
        // Redireciona para /api/generate
        req.url = '/api/generate';
        app._router.handle(req, res);
    });
};

