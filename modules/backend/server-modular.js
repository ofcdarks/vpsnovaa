/**
 * Server Modular - Exemplo de como integrar módulos no server.js
 * 
 * Este arquivo mostra como o server.js pode ser refatorado para usar módulos
 * mantendo compatibilidade total com a estrutura atual.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');

// Importar serviços
const DatabaseService = require('./services/database');
const AIService = require('./services/ai-service');

// Importar rotas modulares
const aiGenerationRoutes = require('./routes/ai-generation');
// const authRoutes = require('./routes/auth');
// const imagefxRoutes = require('./routes/imagefx');
// const ttsRoutes = require('./routes/tts');
// const adminRoutes = require('./routes/admin');

// Importar middlewares
const { verifyToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../darkscript.db');

// Configuração do Express
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.static(path.join(__dirname, '../../')));

// Inicializar serviços
const db = new DatabaseService(DB_PATH);
const aiService = new AIService();

const services = {
    db,
    aiService
};

// Inicializar banco de dados
async function initialize() {
    try {
        await db.connect();
        await db.initializeTables();
        console.log('✅ Serviços inicializados');
    } catch (error) {
        console.error('❌ Erro ao inicializar serviços:', error);
        process.exit(1);
    }
}

// Registrar rotas modulares
function registerRoutes() {
    // Rotas de IA
    aiGenerationRoutes(app, db, services);
    
    // Outras rotas serão adicionadas aqui conforme migração
    // authRoutes(app, db, services);
    // imagefxRoutes(app, db, services);
    // ttsRoutes(app, db, services);
    // adminRoutes(app, db, services);
    
    // Rotas estáticas (mantidas do server.js original)
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../../index.html'));
    });
    
    app.get('/health', (req, res) => {
        res.status(200).send('OK');
    });
}

// Inicializar servidor
async function start() {
    await initialize();
    registerRoutes();
    
    const http = require('http').createServer(app);
    http.listen(PORT, () => {
        console.log(`🚀 Servidor modular rodando na porta ${PORT}`);
    });
}

// Iniciar se executado diretamente
if (require.main === module) {
    start().catch(error => {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    });
}

module.exports = { app, db, services };

