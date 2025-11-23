// ================================================
// ✅ SERVER.JS - Início completo com diagnóstico ImageFX
// ================================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const { sanitizePrompt } = require('./sanitizePrompt');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs').promises;
const fsSync = require('fs'); // Para métodos síncronos quando necessário
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const nodemailer = require('nodemailer');
const FormData = require('form-data');
// Multer removido - substituído por função de movimentos ilimitados em imagens
// const multer = require('multer');
const helmet = require('helmet');
// Importar limites de tokens baseados na documentação oficial
const { getTokenLimits, estimateTokens, canFitInLimits, normalizeModelName } = require('./token-limits');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// ================================================
// 🧠 Diagnóstico: garantir que o Node usa o imagefx.js certo
// ================================================
let ImageFXModule, ImageFX, ImageFXError, AccountError, Model, AspectRatio, Account;

try {
  // 🔹 importa o arquivo imagefx.js da mesma pasta do server.js
  ImageFXModule = require('./imagefx'); 

  // 🔹 mostra o caminho EXATO do arquivo que o Node está carregando
  console.log("📂 ImageFX carregado de:", require.resolve('./imagefx'));

  // 🔹 extrai todas as constantes necessárias
  ImageFX = ImageFXModule.ImageFX;
  ImageFXError = ImageFXModule.ImageFXError;
  AccountError = ImageFXModule.AccountError;
  Model = ImageFXModule.Model;
  AspectRatio = ImageFXModule.AspectRatio;
  Account = ImageFXModule.Account;

  // 🔹 disponibiliza globalmente se precisar em outras partes
  global.ImageFX = ImageFX;
  global.ImageFXError = ImageFXError;
  global.AccountError = AccountError;

} catch (err) {
  console.error("❌ Erro ao carregar imagefx.js:", err);
  throw err; // Re-lança o erro para evitar que o servidor inicie sem o módulo essencial
}

if (!process.env.JWT_SECRET) {
  throw new Error('Variável de ambiente JWT_SECRET obrigatória não definida.');
}

const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// Define o caminho do banco de dados, priorizando a variável de ambiente.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'darkscript.db');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'", "https://cdn.tailwindcss.com", "data:", "blob:"],
        scriptSrc: [
          "'self'",
          "https://cdn.tailwindcss.com",
          "https://cdn.socket.io",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'",
          "'unsafe-eval'"
        ],
        connectSrc: [
          "'self'",
          "https://cdn.socket.io",
          "ws:",
          "wss:"
        ],
        styleSrc: [
          "'self'",
          "https://cdn.tailwindcss.com",
          "https://fonts.googleapis.com",
          "'unsafe-inline'"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "https://cdn.tailwindcss.com",
          "https://img.youtube.com",
          "https://i.ytimg.com",
          "https://yt3.ggpht.com"
        ],
        mediaSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'",
          "https://cdn.socket.io",
          "https://www.youtube.com",
          "https://i.ytimg.com",
          "https://yt3.ggpht.com",
          "https://i9.ytimg.com",
          "https://www.google.com",
          "ws:",
          "wss:"
        ],
        objectSrc: ["'none'"],
        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com"
        ]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CRÍTICO: Middleware para servir módulos JavaScript ANTES de qualquer outra coisa
// Isso garante que arquivos em /modules/* sejam servidos com MIME type correto
app.use('/modules', (req, res, next) => {
    // No middleware app.use('/modules', ...), req.path já não inclui '/modules'
    // req.url inclui a query string, então usamos req.path que já está sem '/modules'
    let modulePath = req.path || req.url.split('?')[0];
    
    // Remover barra inicial se existir
    if (modulePath.startsWith('/')) {
        modulePath = modulePath.substring(1);
    }
    
    // Só processar se for um arquivo (não diretório)
    if (modulePath && !modulePath.endsWith('/')) {
        const normalizedPath = modulePath.replace(/\.\./g, '').replace(/\/+/g, '/').replace(/^\/+/, '');
        const filePath = path.join(__dirname, 'modules', normalizedPath);
        
        console.log(`📦 [MODULE MIDDLEWARE] Processando: ${req.originalUrl || req.url}`);
        console.log(`   modulePath: ${modulePath}`);
        console.log(`   filePath: ${filePath}`);
        
        const fs = require('fs');
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            console.log(`✅ [MODULE MIDDLEWARE] Arquivo encontrado: ${filePath}`);
            
            // Definir MIME type correto
            if (filePath.endsWith('.js')) {
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                console.log(`📦 [MODULE MIDDLEWARE] MIME type: application/javascript`);
            } else if (filePath.endsWith('.json')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
            } else if (filePath.endsWith('.md')) {
                res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            }
            
            // Servir o arquivo e PARAR aqui (não chamar next())
            return res.sendFile(filePath, (err) => {
                if (err) {
                    console.error(`❌ [MODULE MIDDLEWARE] Erro ao servir ${req.originalUrl || req.url}:`, err.message);
                    if (!res.headersSent) {
                        res.status(500).json({ message: 'Erro ao servir módulo', path: req.originalUrl || req.url });
                    }
                } else {
                    console.log(`✅ [MODULE MIDDLEWARE] Arquivo servido: ${req.originalUrl || req.url}`);
                }
            });
        } else {
            console.warn(`⚠️ [MODULE MIDDLEWARE] Arquivo não encontrado: ${filePath}`);
        }
    }
    // Se não encontrou, passar para o próximo middleware
    next();
});

// express.static será adicionado DEPOIS da definição de verifyToken e do endpoint de áudio

const STATIC_ASSETS = new Map([
  ['/style.css', path.join(__dirname, 'style.css')],
  ['/app.js', path.join(__dirname, 'app.js')],
  ['/app-core.js', path.join(__dirname, 'app-core.js')], // Versão modular
  ['/formulas.js', path.join(__dirname, 'formulas.js')],
  ['/voices.js', path.join(__dirname, 'voices.js')]
]);

STATIC_ASSETS.forEach((filePath, route) => {
  app.get(route, (_, res) => res.sendFile(filePath));
});

// Health Check Endpoint
app.get('/health', (req, res) => res.status(200).send('OK'));

const TEMP_AUDIO_DIR = path.join(__dirname, 'temp_audio');
const FINAL_AUDIO_DIR = path.join(__dirname, 'public', 'final_audio');
const AUDIO_PARTS_DIR = path.join(__dirname, 'public', 'audio_parts'); // Pasta pública para partes individuais
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

const normalizePath = (reqPath = '/') => {
    const normalized = path
        .normalize(reqPath || '/')
        .replace(/^(\.\.(\/|\\|$))+/, '')
        .replace(/\\/g, '/');

    if (!normalized || normalized === '.' || normalized === path.sep) {
        return '/';
    }

    return normalized.startsWith('/') ? normalized.slice(1) : normalized;
};

const ensureInsideUploads = (targetPath) => {
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(UPLOADS_DIR)) {
        throw new Error('Caminho de upload inválido.');
    }
    return resolved;
};

const resolveUploadPath = (relativePath = '/') => {
    const normalized = normalizePath(relativePath);
    const relative = normalized === '/' ? '' : normalized;
    return ensureInsideUploads(path.join(UPLOADS_DIR, relative));
};

// Função para adicionar movimentos ilimitados em imagens
// Permite aplicar múltiplas animações e transformações CSS/Canvas
const addUnlimitedImageMovements = (imageData, movements = []) => {
    /**
     * Adiciona movimentos/animações ilimitados em imagens
     * @param {string|Buffer} imageData - Dados da imagem (base64, URL ou Buffer)
     * @param {Array} movements - Array de movimentos a aplicar
     * @returns {Object} - Objeto com a imagem processada e os movimentos aplicados
     * 
     * Formato de movements:
     * [
     *   {
     *     type: 'translate' | 'rotate' | 'scale' | 'skew' | 'opacity' | 'blur' | 'custom',
     *     value: number | string,
     *     duration: number (ms),
     *     easing: string,
     *     delay: number (ms),
     *     repeat: number | 'infinite',
     *     direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
     *   }
     * ]
     */
    
    const defaultMovements = [
        {
            type: 'translate',
            value: { x: 0, y: 0 },
            duration: 1000,
            easing: 'ease-in-out',
            delay: 0,
            repeat: 'infinite',
            direction: 'alternate'
        }
    ];
    
    const appliedMovements = movements.length > 0 ? movements : defaultMovements;
    
    // Gera CSS keyframes para as animações
    const generateKeyframes = (movements) => {
        let keyframes = '';
        movements.forEach((movement, index) => {
            const animName = `movement-${index}`;
            switch (movement.type) {
                case 'translate':
                    const { x = 0, y = 0 } = typeof movement.value === 'object' ? movement.value : { x: movement.value, y: movement.value };
                    keyframes += `
                        @keyframes ${animName} {
                            0% { transform: translate(0, 0); }
                            50% { transform: translate(${x}px, ${y}px); }
                            100% { transform: translate(0, 0); }
                        }
                    `;
                    break;
                case 'rotate':
                    keyframes += `
                        @keyframes ${animName} {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(${movement.value}deg); }
                        }
                    `;
                    break;
                case 'scale':
                    keyframes += `
                        @keyframes ${animName} {
                            0% { transform: scale(1); }
                            50% { transform: scale(${movement.value}); }
                            100% { transform: scale(1); }
                        }
                    `;
                    break;
                case 'opacity':
                    keyframes += `
                        @keyframes ${animName} {
                            0%, 100% { opacity: 1; }
                            50% { opacity: ${movement.value}; }
                        }
                    `;
                    break;
                case 'blur':
                    keyframes += `
                        @keyframes ${animName} {
                            0%, 100% { filter: blur(0px); }
                            50% { filter: blur(${movement.value}px); }
                        }
                    `;
                    break;
                case 'custom':
                    keyframes += movement.value || '';
                    break;
            }
        });
        return keyframes;
    };
    
    // Gera CSS de animação combinada
    const generateAnimationCSS = (movements) => {
        return movements.map((movement, index) => {
            const animName = `movement-${index}`;
            const duration = movement.duration || 1000;
            const easing = movement.easing || 'ease-in-out';
            const delay = movement.delay || 0;
            const repeat = movement.repeat || 1;
            const direction = movement.direction || 'normal';
            
            return `${animName} ${duration}ms ${easing} ${delay}ms ${repeat} ${direction}`;
        }).join(', ');
    };
    
    const keyframes = generateKeyframes(appliedMovements);
    const animationCSS = generateAnimationCSS(appliedMovements);
    
    return {
        imageData: imageData,
        movements: appliedMovements,
        css: {
            keyframes: keyframes,
            animation: animationCSS
        },
        html: `
            <style>
                ${keyframes}
                .animated-image {
                    animation: ${animationCSS};
                    display: inline-block;
                }
            </style>
            <img src="${imageData}" class="animated-image" />
        `
    };
};

// Função auxiliar para processar múltiplas imagens com movimentos
const processImagesWithMovements = async (images, movements = []) => {
    const results = [];
    for (const image of images) {
        const processed = addUnlimitedImageMovements(image, movements);
        results.push(processed);
    }
    return results;
};


const ttsJobs = {}; // Armazenamento em memória para os trabalhos de TTS
const JOB_RETENTION_MS = 60 * 60 * 1000; // 1 hora
const scheduleJobCleanup = (jobId) => {
    setTimeout(() => {
        delete ttsJobs[jobId];
    }, JOB_RETENTION_MS);
};
let imageGenJobs = {}; // Armazenamento para trabalhos de geração de imagem

const MAX_AUTO_REWRITE_ATTEMPTS = 2;

// Modelos TTS válidos
const VALID_TTS_MODELS = [
  'gemini-2.5-pro-preview-tts',
  'gemini-2.5-flash-preview-tts'
];
const DEFAULT_TTS_MODEL = 'gemini-2.5-pro-preview-tts';
const GEMINI_TTS_DEFAULT_SAMPLE_RATE = 24000;
const GEMINI_TTS_DEFAULT_CHANNELS = 1;
const GEMINI_TTS_DEFAULT_BIT_DEPTH = 16;

// Modelo para processamento de texto (divisão de roteiro)
const TEXT_PROCESSING_MODEL = 'gemini-2.0-flash-exp';

let db;

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve(this);
    });
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
    });
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('❌ [DB] Erro em dbAll:', err);
            console.error('❌ [DB] SQL:', sql);
            console.error('❌ [DB] Params:', params);
            return reject(err);
        }
        // Garantir que sempre retornamos um array
        if (!Array.isArray(rows)) {
            console.warn('⚠️ [DB] dbAll não retornou array! Tipo:', typeof rows, 'Valor:', rows);
            resolve([]);
        } else {
            resolve(rows);
        }
    });
});

// Função robusta para parsear JSON com múltiplas estratégias de correção
const parseJsonRobustly = (text, source = "AI") => {
    if (!text || typeof text !== 'string') {
        throw new Error(`Resposta vazia ou inválida da ${source} API.`);
    }
    
    // Estratégia 1: Limpeza básica (remover markdown code blocks)
    let cleanedText = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^[\s\n]*/, '')
        .replace(/[\s\n]*$/, '');
    
    // Salvar primeira mensagem de erro para uso posterior
    let firstError = null;
    
    // Estratégia 2: Tentar parse direto
    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        firstError = e;
        console.warn(`[${source} JSON Parse Error] Tentativa 1 falhou:`, e.message.substring(0, 100));
    }
    
    // Estratégia 3: Tentar completar JSON incompleto (strings não terminadas)
    // Se o erro for "Unterminated string", tenta fechar strings abertas
    if (firstError && firstError.message.includes('Unterminated string')) {
        try {
            // Encontrar a última string aberta e fechá-la
            let fixed = cleanedText;
            let openQuotes = 0;
            let lastQuotePos = -1;
            let inString = false;
            let escapeNext = false;
            
            for (let i = 0; i < fixed.length; i++) {
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                if (fixed[i] === '\\') {
                    escapeNext = true;
                    continue;
                }
                if (fixed[i] === '"') {
                    if (inString) {
                        inString = false;
                        openQuotes--;
                    } else {
                        inString = true;
                        openQuotes++;
                        lastQuotePos = i;
                    }
                }
            }
            
            // Se há strings abertas, tentar fechar
            if (inString && lastQuotePos !== -1) {
                // Encontrar onde a string deveria terminar (antes de } ou ] ou fim)
                let endPos = fixed.length;
                const nextBrace = fixed.indexOf('}', lastQuotePos);
                const nextBracket = fixed.indexOf(']', lastQuotePos);
                const nextComma = fixed.indexOf(',', lastQuotePos);
                
                if (nextBrace !== -1) endPos = Math.min(endPos, nextBrace);
                if (nextBracket !== -1) endPos = Math.min(endPos, nextBracket);
                if (nextComma !== -1) endPos = Math.min(endPos, nextComma);
                
                // Fechar a string e tentar completar o JSON
                fixed = fixed.substring(0, endPos) + '"' + fixed.substring(endPos);
                
                // Tentar fechar objetos/arrays abertos
                const openBraces = (fixed.match(/\{/g) || []).length;
                const closeBraces = (fixed.match(/\}/g) || []).length;
                const openBrackets = (fixed.match(/\[/g) || []).length;
                const closeBrackets = (fixed.match(/\]/g) || []).length;
                
                // Adicionar fechamentos necessários
                for (let i = 0; i < openBraces - closeBraces; i++) {
                    fixed += '}';
                }
                for (let i = 0; i < openBrackets - closeBrackets; i++) {
                    fixed += ']';
                }
                
                // Remover vírgulas finais
                fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
                
                try {
                    const parsed = JSON.parse(fixed);
                    console.log(`[${source} JSON] JSON completado e parseado com sucesso`);
                    return parsed;
            } catch (e2) {
                    // Continua para outras estratégias
                }
            }
        } catch (e3) {
            // Continua
        }
    }
    
    // Estratégia 4: Extrair JSON de dentro do texto (procura por { ... } ou [ ... ])
    const jsonPatterns = [
        /\{[\s\S]*\}/,  // Objeto JSON
        /\[[\s\S]*\]/   // Array JSON
    ];
    
    for (const pattern of jsonPatterns) {
        const match = cleanedText.match(pattern);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                console.log(`[${source} JSON] JSON extraído com sucesso usando padrão`);
                return parsed;
            } catch (e2) {
                // Continua tentando outros padrões
            }
        }
    }
    
    // Estratégia 5: Tentar encontrar JSON completo removendo texto antes/depois
    // Procura pelo primeiro { ou [ e último } ou ]
    const firstBrace = cleanedText.indexOf('{');
    const firstBracket = cleanedText.indexOf('[');
    const lastBrace = cleanedText.lastIndexOf('}');
    const lastBracket = cleanedText.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        try {
            let extracted = cleanedText.substring(firstBracket, lastBracket + 1);
            
            // Tentar completar se estiver incompleto
            if (extracted.match(/"[^"]*$/)) {
                // String não terminada no final
                extracted = extracted.replace(/"([^"]*)$/, '"$1"');
            }
            
            // Fechar arrays/objetos abertos
            const openCount = (extracted.match(/\[/g) || []).length;
            const closeCount = (extracted.match(/\]/g) || []).length;
            for (let i = 0; i < openCount - closeCount; i++) {
                extracted += ']';
            }
            
            extracted = extracted.replace(/,(\s*[}\]])/g, '$1');
            
            return JSON.parse(extracted);
        } catch (e4) {
            // Continua
        }
    }
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            let extracted = cleanedText.substring(firstBrace, lastBrace + 1);
            
            // Tentar completar se estiver incompleto
            if (extracted.match(/"[^"]*$/)) {
                extracted = extracted.replace(/"([^"]*)$/, '"$1"');
            }
            
            // Fechar objetos abertos
            const openCount = (extracted.match(/\{/g) || []).length;
            const closeCount = (extracted.match(/\}/g) || []).length;
            for (let i = 0; i < openCount - closeCount; i++) {
                extracted += '}';
            }
            
            extracted = extracted.replace(/,(\s*[}\]])/g, '$1');
            
            return JSON.parse(extracted);
        } catch (e3) {
            // Continua
        }
    }
    
    // Estratégia 6: Tentar corrigir JSON comum (vírgulas finais, aspas não fechadas)
    try {
        let fixed = cleanedText
            .replace(/,(\s*[}\]])/g, '$1')  // Remove vírgulas finais
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')  // Adiciona aspas em chaves sem aspas
            .replace(/:\s*([^",\[\]{}]+)(\s*[,}\]])/g, (match, value, ending) => {
                // Adiciona aspas em valores string sem aspas
                if (!value.match(/^(true|false|null|\d+)$/)) {
                    return `: "${value.replace(/"/g, '\\"')}"${ending}`;
                }
                return match;
            });
        return JSON.parse(fixed);
    } catch (e5) {
        // Última tentativa falhou
    }
    
    // Se todas as estratégias falharam, log detalhado e erro
    console.error(`[${source} JSON Parse Error] Todas as estratégias falharam.`);
    console.error(`Texto recebido (primeiros 500 chars):`, cleanedText.substring(0, 500));
    console.error(`Texto recebido (últimos 500 chars):`, cleanedText.substring(Math.max(0, cleanedText.length - 500)));
    console.error(`Tamanho total:`, cleanedText.length, 'caracteres');
    const errorMessage = firstError ? firstError.message : 'JSON inválido ou incompleto';
    console.error(`Erro original:`, errorMessage);
    
    throw new Error(`Falha ao gerar conteudo: JSON incompleto ou malformado da ${source} API. Detalhes: ${errorMessage}. Por favor, tente novamente.`);
};

const initializeDb = async () => {
  try {
    await fs.mkdir(TEMP_AUDIO_DIR, { recursive: true });
    await fs.mkdir(FINAL_AUDIO_DIR, { recursive: true });
    await fs.mkdir(AUDIO_PARTS_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        whatsapp TEXT,
        settings TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER NOT NULL DEFAULT 0,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME,
        tags TEXT DEFAULT ''
      );
    `);
    
    await dbRun(`
      CREATE TABLE IF NOT EXISTS app_status (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS academy_lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        youtube_url TEXT NOT NULL,
        file_url TEXT,
        file_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        tag_text TEXT,
        tag_position TEXT,
        position INTEGER DEFAULT 0
      );
    `);

    // Tabelas do sistema de chat
    await dbRun(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        attendant_id INTEGER,
        status TEXT NOT NULL DEFAULT 'open',
        last_message_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (attendant_id) REFERENCES users(id)
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        message_type TEXT DEFAULT 'text',
        file_url TEXT,
        is_read_by_user INTEGER DEFAULT 0,
        is_read_by_attendant INTEGER DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id)
      );
    `);
    
    // Migração: adicionar colunas se não existirem
    const messageColumns = await dbAll("PRAGMA table_info(chat_messages)");
    const messageColumnNames = messageColumns.map(col => col.name);
    if (!messageColumnNames.includes('message_type')) {
        await dbRun("ALTER TABLE chat_messages ADD COLUMN message_type TEXT DEFAULT 'text'");
    }
    if (!messageColumnNames.includes('file_url')) {
        await dbRun("ALTER TABLE chat_messages ADD COLUMN file_url TEXT");
    }
    if (!messageColumnNames.includes('message_text')) {
      await dbRun("ALTER TABLE chat_messages ADD COLUMN message_text TEXT");
      await dbRun("UPDATE chat_messages SET message_text = message WHERE message_text IS NULL");
    }
    if (!messageColumnNames.includes('timestamp')) {
      await dbRun("ALTER TABLE chat_messages ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP");
      await dbRun("UPDATE chat_messages SET timestamp = created_at WHERE timestamp IS NULL");
    }
    if (!messageColumnNames.includes('is_read_by_user')) {
      await dbRun("ALTER TABLE chat_messages ADD COLUMN is_read_by_user INTEGER DEFAULT 0");
    }
    if (!messageColumnNames.includes('is_read_by_attendant')) {
      await dbRun("ALTER TABLE chat_messages ADD COLUMN is_read_by_attendant INTEGER DEFAULT 0");
    }

    await dbRun(`
      CREATE TABLE IF NOT EXISTS chat_attendants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        max_conversations INTEGER NOT NULL DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS chat_quick_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS chat_online_status (
        user_id INTEGER PRIMARY KEY,
        is_online INTEGER NOT NULL DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Tabela de fila de atendimento
    await dbRun(`
      CREATE TABLE IF NOT EXISTS chat_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        conversation_id INTEGER,
        status TEXT NOT NULL DEFAULT 'waiting',
        position INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
      );
    `);

    // Tabela de tickets de suporte
    await dbRun(`
      CREATE TABLE IF NOT EXISTS chat_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        attendant_id INTEGER,
        subject TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT DEFAULT 'normal',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        notes TEXT,
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (attendant_id) REFERENCES users(id)
      );
    `);

    console.log("Tabelas verificadas/criadas com sucesso.");

    const userColumns = await dbAll("PRAGMA table_info(users)");
    const userColumnNames = userColumns.map(col => col.name);
    if (!userColumnNames.includes('last_login_at')) await dbRun("ALTER TABLE users ADD COLUMN last_login_at DATETIME");
    if (!userColumnNames.includes('whatsapp')) await dbRun("ALTER TABLE users ADD COLUMN whatsapp TEXT");
    if (!userColumnNames.includes('must_change_password')) await dbRun("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
    if (!userColumnNames.includes('tags')) await dbRun("ALTER TABLE users ADD COLUMN tags TEXT DEFAULT ''");
    if (!userColumnNames.includes('hotmart_product')) await dbRun("ALTER TABLE users ADD COLUMN hotmart_product TEXT");
    if (!userColumnNames.includes('hotmart_transaction_id')) await dbRun("ALTER TABLE users ADD COLUMN hotmart_transaction_id TEXT");
    if (!userColumnNames.includes('hotmart_purchase_date')) await dbRun("ALTER TABLE users ADD COLUMN hotmart_purchase_date DATETIME");
    if (!userColumnNames.includes('hotmart_source')) await dbRun("ALTER TABLE users ADD COLUMN hotmart_source TEXT DEFAULT 'hotmart'");
    if (!userColumnNames.includes('hotmart_subscription_status')) await dbRun("ALTER TABLE users ADD COLUMN hotmart_subscription_status TEXT");
    if (!userColumnNames.includes('hotmart_order_bump')) await dbRun("ALTER TABLE users ADD COLUMN hotmart_order_bump TEXT");

    const academyColumns = await dbAll("PRAGMA table_info(academy_lessons)");
    const academyColumnNames = academyColumns.map(col => col.name);
    if (!academyColumnNames.includes('tag_text')) await dbRun("ALTER TABLE academy_lessons ADD COLUMN tag_text TEXT");
    if (!academyColumnNames.includes('tag_position')) await dbRun("ALTER TABLE academy_lessons ADD COLUMN tag_position TEXT");
    // Add position column if it doesn't exist
    if (!academyColumnNames.includes('position')) {
        await dbRun("ALTER TABLE academy_lessons ADD COLUMN position INTEGER DEFAULT 0");
        // Initialize positions for existing lessons
        const existingLessons = await dbAll("SELECT id FROM academy_lessons ORDER BY created_at ASC");
        for (let i = 0; i < existingLessons.length; i++) {
            await dbRun("UPDATE academy_lessons SET position = ? WHERE id = ?", [i + 1, existingLessons[i].id]);
        }
        console.log("Coluna 'position' adicionada e inicializada para academy_lessons.");
    }


    const adminEmail = 'rudysilvaads@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
        console.warn("AVISO: A variável de ambiente ADMIN_PASSWORD não está definida. O administrador padrão não pode ser criado ou atualizado.");
        return;
    }
    
    const adminUser = await dbGet("SELECT id FROM users WHERE email = ?", [adminEmail]);
    
    if (!adminUser) {
        // Apenas cria o admin se ele não existir, para proteger bases de dados existentes.
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(adminPassword, salt);
        await dbRun("INSERT INTO users (email, password_hash, role, is_active, settings, tags) VALUES (?, ?, 'admin', 1, '{}', '')", [adminEmail, hash]);
        console.log(`Utilizador administrador ${adminEmail} criado com sucesso.`);
    } else {
        console.log(`Utilizador administrador ${adminEmail} já existe. Nenhuma alteração feita.`);
    }
  } catch (err) {
      console.error("Erro durante a inicialização do banco de dados:", err.message);
      throw err; // Lança o erro para ser capturado pelo startServer
  }
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
    req.user = decoded;
    next();
  });
};

// IMPORTANTE: Endpoint específico para áudio DEVE vir ANTES do express.static
// para ter prioridade sobre arquivos estáticos
// Endpoint específico para servir arquivos de áudio grandes com streaming adequado
// Endpoint específico para download de áudio - DEVE vir ANTES do express.static
// CRÍTICO: Esta rota DEVE ter prioridade sobre express.static
app.get('/final_audio/:filename', verifyToken, async (req, res) => {
    try {
        const filename = req.params.filename;
        console.log(`🔍 [DOWNLOAD] Requisição recebida para: ${filename}`);

        // --------------------------------------------
        // 1. VALIDAR NOME DO ARQUIVO (ANTI-PATH TRAVERSAL)
        // --------------------------------------------
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            console.error(`❌ [DOWNLOAD] Nome inválido: ${filename}`);
            return res.status(400).json({ error: 'Nome de arquivo inválido' });
        }

        const filePath = path.join(FINAL_AUDIO_DIR, filename);
        console.log(`📂 [DOWNLOAD] Caminho completo: ${filePath}`);

        // --------------------------------------------
        // 2. VERIFICAR SE O ARQUIVO EXISTE
        // --------------------------------------------
        try {
            const stats = await fs.stat(filePath);
            console.log(`📥 [DOWNLOAD] Arquivo encontrado: ${stats.size} bytes`);

            // --------------------------------------------
            // 3. LER HEADER CORRETAMENTE (WAV / MP3)
            // --------------------------------------------
            let headerBuffer;
            try {
                // Usar método síncrono para ler apenas os primeiros 12 bytes
                const fd = fsSync.openSync(filePath, 'r');
                headerBuffer = Buffer.alloc(12);
                fsSync.readSync(fd, headerBuffer, 0, 12, 0);
                fsSync.closeSync(fd);
            } catch (headerErr) {
                console.error(`❌ [DOWNLOAD] Erro ao ler header:`, headerErr.message);
                return res.status(500).json({ error: 'Erro ao ler arquivo' });
            }

            const headerStr = headerBuffer.toString('ascii', 0, 4);
            const isWav = headerStr === 'RIFF';
            const isMp3 = headerBuffer[0] === 0xFF && (headerBuffer[1] & 0xE0) === 0xE0;

            if (!isWav && !isMp3) {
                console.error(`❌ [DOWNLOAD] Header inválido! Bytes: ${headerBuffer.toString('hex')}`);
                return res.status(500).json({ error: 'Arquivo corrompido (header inválido)' });
            }

            console.log(`✅ [DOWNLOAD] Header válido detectado: ${isWav ? 'WAV' : 'MP3'}`);

            // --------------------------------------------
            // 4. SUPORTE A RANGE (PERMITE STREAM EM PLAYERS)
            // --------------------------------------------
            const range = req.headers.range;
            const mime = isMp3 ? 'audio/mpeg' : 'audio/wav';

            // --------------------------------------------
            // 5. FORÇAR ENTREGAR SEM COMPRESSÃO
            // --------------------------------------------
            res.setHeader('Content-Encoding', 'identity');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Pragma', 'no-cache');

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
                const chunksize = (end - start) + 1;

                console.log(`📡 [DOWNLOAD] RANGE solicitado: ${start}-${end}`);

                const stream = require('fs').createReadStream(filePath, { start, end });

                res.writeHead(206, {
                    "Content-Range": `bytes ${start}-${end}/${stats.size}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": chunksize,
                    "Content-Type": mime,
                    "Content-Disposition": `attachment; filename="${filename}"`
                });

                return stream.pipe(res);

            } else {
                // --------------------------------------------
                // 6. DOWNLOAD COMPLETO (SEM RANGE)
                // --------------------------------------------
                console.log(`📤 [DOWNLOAD] Enviando arquivo completo (${stats.size} bytes)`);

                res.setHeader("Content-Type", mime);
                res.setHeader("Content-Length", stats.size);
                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

                const stream = require('fs').createReadStream(filePath);

                let sent = 0;

                stream.on('data', chunk => {
                    sent += chunk.length;
                });

                stream.on('end', () => {
                    console.log(`✅ [DOWNLOAD] Transferência concluída: ${sent}/${stats.size} bytes`);
                });

                stream.on('error', err => {
                    console.error(`❌ [DOWNLOAD] Erro ao ler arquivo:`, err.message);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Erro ao ler arquivo' });
                    } else {
                        res.end();
                    }
                });

                return stream.pipe(res);
            }
        } catch (statErr) {
            if (statErr.code === 'ENOENT') {
                console.error(`❌ [DOWNLOAD] Arquivo não encontrado: ${filename}`);
                return res.status(404).json({ error: 'Arquivo não encontrado' });
            }
            throw statErr;
        }

    } catch (err) {
        console.error("❌ [DOWNLOAD] Erro geral:", err);
        console.error("❌ [DOWNLOAD] Stack trace:", err.stack);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Erro interno no download', details: err.message });
        }
        res.end();
    }
});

// Servir arquivos estáticos (DEPOIS do endpoint específico de áudio para dar prioridade)
// IMPORTANTE: Excluir final_audio do static para evitar conflitos
app.use('/public', (req, res, next) => {
    // Se for uma requisição para final_audio, não servir via static - deixar o endpoint específico tratar
    if (req.path && req.path.startsWith('/final_audio/')) {
        return next(); // Passa para o próximo middleware/rota
    }
    // Para outros arquivos estáticos, servir normalmente
    express.static(PUBLIC_DIR, {
        maxAge: '1d',
        etag: true,
        lastModified: true
    })(req, res, next);
});

// NOTA: A rota para /modules/* foi movida para um middleware no início do arquivo (linha ~144)
// Isso garante que os módulos sejam servidos com o MIME type correto antes de qualquer outra coisa

// Servir arquivos estáticos normalmente (final_audio já foi filtrado acima)
app.use(express.static(PUBLIC_DIR, {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Recurso exclusivo para administradores.' });
  }
  next();
};

const whatsappRegex = /^\+?[1-9]\d{1,14}$/;

const FALLBACK_TTS_VOICE = 'zephyr';
const DEFAULT_TTS_SAMPLE_TEXT = 'DarkScript, a melhor ferramenta para o seu canal Dark.';

const getFirstGeminiKeyFromSettings = (settings) => {
  if (!settings) return null;
  // Ensure settings.gemini is an array, then filter out empty strings and trim
  const rawKeys = Array.isArray(settings.gemini) ? settings.gemini : [settings.gemini];
  return rawKeys.map(key => (typeof key === 'string' ? key.trim() : '')).filter(Boolean)[0] || null;
};

const validateTtsModel = (model) => {
  if (!model || !VALID_TTS_MODELS.includes(model)) {
    return DEFAULT_TTS_MODEL;
  }
  return model;
};

const mapSegmentsToSpeechConfig = (segments = []) => {
  const normalizedSegments = Array.isArray(segments)
    ? segments
        .map((segment, index) => ({
          speaker: typeof segment?.speaker === 'string' && segment.speaker.trim() ? segment.speaker.trim() : `Narrador ${index + 1}`,
          voice: typeof segment?.voice === 'string' && segment.voice.trim() ? segment.voice.trim() : FALLBACK_TTS_VOICE,
          text: typeof segment?.text === 'string' ? segment.text.trim() : '',
        }))
        .filter(segment => segment.text.length > 0)
    : [];

  if (normalizedSegments.length === 0) {
    throw new Error('Informe ao menos um trecho de narração com texto.');
  }

  const speakerVoiceMap = new Map();
  normalizedSegments.forEach(({ speaker, voice }) => {
    const existingVoice = speakerVoiceMap.get(speaker);
    if (existingVoice && existingVoice !== voice) {
      throw new Error("O locutor está associado a vozes diferentes. Utilize apenas uma voz por locutor ou crie um novo locutor.");
    }
    speakerVoiceMap.set(speaker, voice);
  });
  
  return { speakerVoiceMap, normalizedSegments };
};

const buildTtsPrompt = (styleInstructions = '', segments = [], skipSpeakerPrefix = false) => {
  const lines = [];
  // A instrução de estilo não deve ser incluída no texto para TTS,
  // pois o modelo tentará lê-la. O estilo é inferido da voz selecionada.
  
  segments.forEach((segment, index) => {
    const text = typeof segment?.text === 'string' ? segment.text.trim() : '';
    if (!text) return;

    // Se skipSpeakerPrefix for true, retorna apenas o texto sem prefixo de speaker
    if (skipSpeakerPrefix) {
      lines.push(text);
      return;
    }

    const speaker = typeof segment?.speaker === 'string' && segment.speaker.trim()
      ? segment.speaker.trim()
      : `Narrador ${index + 1}`;
    
    lines.push(`${speaker}: ${text}`);
  });

  return lines.join('\n\n');
};

// Função para verificar se FFmpeg está disponível (com fallback robusto)
const checkFfmpegAvailable = async () => {
    try {
        // Verifica se o FFmpeg está disponível executando um comando simples
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // Tenta executar ffmpeg -version com timeout de 3 segundos
        await Promise.race([
            execAsync(`"${ffmpegPath}" -version`, { timeout: 3000 }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        
        console.log('✅ FFmpeg disponível - usando para concatenação de áudio');
        return true;
    } catch (error) {
        console.log('⚠️ FFmpeg não disponível - usando fallback sem FFmpeg');
        return false;
    }
};

// Função para gerar áudio usando OpenAI TTS com máxima qualidade
const generateOpenAiTtsAudio = async ({ apiKey, textInput, voiceName }) => {
    // Validação inicial conforme documentação
    // https://platform.openai.com/docs/guides/text-to-speech
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        throw new Error('Chave de API OpenAI não fornecida ou inválida');
    }
    
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 3000;
    
    // Vozes disponíveis na API OpenAI conforme documentação oficial
    // https://platform.openai.com/docs/guides/text-to-speech
    // Vozes: alloy, echo, fable, onyx, nova, shimmer
    const validOpenAiVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    
    // Mapeamento de vozes Gemini para OpenAI (aproximado)
    const voiceMapping = {
        'Zephyr': 'nova',      // Brilhante -> Nova (feminina, clara)
        'Puck': 'shimmer',     // Animado -> Shimmer (feminina, expressiva)
        'Charon': 'onyx',      // Informativo -> Onyx (masculina, grave)
        'Kore': 'nova',        // Firme -> Nova
        'Fenrir': 'echo',      // Excitado -> Echo (masculina, energética)
        'Leda': 'alloy',       // Juvenil -> Alloy (neutra, jovem)
        'Orus': 'onyx',        // Firme -> Onyx
        'Aoede': 'shimmer',    // Arejado -> Shimmer
        'Callirrhoe': 'alloy', // Descontraido -> Alloy
        'Autonoe': 'nova',     // Brilhante -> Nova
        'Enceladus': 'shimmer', // Sussurrado -> Shimmer (mais suave)
        'Iapetus': 'echo',     // Claro -> Echo
        'Umbriel': 'alloy',    // Descontraido -> Alloy
        'Algieba': 'onyx',     // Suave -> Onyx
        'Despina': 'nova',     // Suave -> Nova
        'Erinome': 'shimmer',  // Clara -> Shimmer
        'Algenib': 'onyx',     // Grave -> Onyx
        'Rasalgethi': 'echo',  // Informativo -> Echo
        'Laomedeia': 'shimmer', // Animado -> Shimmer
        'Achernar': 'nova',    // Suave -> Nova
        'Alnilam': 'onyx',     // Firme -> Onyx
        'Schedar': 'echo',     // Constante -> Echo
        'Gacrux': 'onyx',      // Maduro -> Onyx
        'Pulcherrima': 'nova', // Projetado -> Nova
        'Achird': 'alloy',     // Amigavel -> Alloy
        'Zubenelgenubi': 'alloy', // Casual -> Alloy
        'Vindemiatrix': 'shimmer', // Gentil -> Shimmer
        'Sadachbia': 'shimmer', // Vivaz -> Shimmer
        'Sadaltager': 'onyx',  // Conhecedor -> Onyx
        'Sulafat': 'nova'      // Acolhedor -> Nova
    };
    
    // Valida e mapeia a voz
    let openAiVoice = voiceMapping[voiceName] || 'alloy';
    
    // Se a voz já for uma voz OpenAI válida, usa diretamente
    if (validOpenAiVoices.includes(voiceName?.toLowerCase())) {
        openAiVoice = voiceName.toLowerCase();
    }
    
    // Validação do texto antes de enviar
    // Conforme documentação: https://platform.openai.com/docs/guides/text-to-speech
    if (!textInput || typeof textInput !== 'string' || textInput.trim().length === 0) {
        throw new Error('Texto de entrada inválido ou vazio');
    }
    
    // Remove caracteres de controle e limita tamanho
    const cleanText = textInput.trim().replace(/[\x00-\x1F\x7F]/g, '');
    if (cleanText.length === 0) {
        throw new Error('Texto de entrada está vazio após limpeza');
    }
    
    // Limite da API OpenAI é 4096 caracteres conforme documentação
    // https://platform.openai.com/docs/guides/text-to-speech
    if (cleanText.length > 4096) {
        throw new Error(`Texto muito longo (${cleanText.length} chars). Limite da API OpenAI é 4096 caracteres.`);
    }
    
    // SEMPRE usar MP3 para garantir compatibilidade e evitar corrupção
    // MP3 é o formato mais compatível e funciona bem com FFmpeg para concatenação
    const responseFormat = 'mp3';
    
    console.log(`🎙️ [OpenAI TTS] Modelo: tts-1-hd, Texto: ${cleanText.length} chars, Voz: ${openAiVoice}, Formato: ${responseFormat}`);
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            // Requisição conforme documentação oficial
            // https://platform.openai.com/docs/guides/text-to-speech
            // POST https://api.openai.com/v1/audio/speech
            const response = await axios.post(
                'https://api.openai.com/v1/audio/speech',
                {
                    model: 'tts-1-hd',        // Modelo de alta qualidade (tts-1 ou tts-1-hd)
                    input: cleanText,          // Texto para converter (máx 4096 caracteres)
                    voice: openAiVoice,        // Voz: alloy, echo, fable, onyx, nova, shimmer
                    response_format: responseFormat, // Formato: mp3, opus, aac, flac
                    speed: 1.0                 // Velocidade: 0.25 a 4.0 (padrão 1.0)
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer', // Resposta é binária (áudio)
                    timeout: 90000              // Timeout de 90s
                }
            );
            
            // Valida a resposta
            if (!response.data || response.data.length === 0) {
                throw new Error('A API retornou uma resposta vazia');
            }
            
            const audioBuffer = Buffer.from(response.data);
            console.log(`✅ [OpenAI TTS] Áudio recebido: ${audioBuffer.length} bytes (formato: ${responseFormat})`);
            
            // Sempre retorna MP3 (formato compatível e sem corrupção)
            const audioBase64 = audioBuffer.toString('base64');
            console.log(`✅ [OpenAI TTS] Retornando MP3 direto (${audioBase64.length} chars base64)`);
            return {
                audioBase64: audioBase64,
                usage: null,
                format: 'mp3'
            };
        } catch (error) {
            // Log detalhado do erro para debug conforme documentação
            // https://platform.openai.com/docs/guides/text-to-speech
            const errorDetails = error.response?.data || error.message;
            const statusCode = error.response?.status;
            
            console.error(`❌ Erro OpenAI TTS (tentativa ${attempt + 1}/${MAX_RETRIES}):`, {
                message: error.message,
                status: statusCode,
                statusText: error.response?.statusText,
                data: typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails,
                textLength: cleanText?.length,
                voice: openAiVoice
            });
            
            // Tratamento de erros específicos da API OpenAI
            if (statusCode === 400) {
                const errorMsg = typeof errorDetails === 'object' ? errorDetails?.error?.message : errorDetails;
                if (errorMsg?.includes('text') || errorMsg?.includes('input')) {
                    throw new Error(`Texto inválido: ${errorMsg}`);
                }
                if (errorMsg?.includes('voice')) {
                    throw new Error(`Voz inválida: ${errorMsg}`);
                }
                if (errorMsg?.includes('model')) {
                    throw new Error(`Modelo inválido: ${errorMsg}`);
                }
            }
            
            if (statusCode === 401) {
                throw new Error('Chave de API inválida ou não autorizada. Verifique suas credenciais.');
            }
            
            if (statusCode === 429) {
                const retryAfter = error.response?.headers?.['retry-after'];
                const delay = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY * (attempt + 1);
                console.warn(`⚠️ Rate limit atingido. Aguardando ${delay / 1000}s antes de tentar novamente...`);
                if (attempt < MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
            
            if (attempt < MAX_RETRIES - 1) {
                const delay = RETRY_DELAY * (attempt + 1);
                console.warn(`Tentativa ${attempt + 1}/${MAX_RETRIES} OpenAI TTS falhou: ${error.message}. Tentando novamente em ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
};

// Função auxiliar para dividir texto tipo CapCut (máx 500 chars por bloco, respeitando frases)
function splitLikeCapcut(text, maxLen = 500) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const blocks = [];
    let current = "";

    for (const sentence of sentences) {
        if (sentence.length > maxLen) {
            // Se uma frase sozinha ultrapassa o limite, divide por palavras
            const words = sentence.split(" ");
            let tempCurrent = "";
            for (const word of words) {
                if ((tempCurrent + " " + word).trim().length <= maxLen) {
                    tempCurrent += " " + word;
                } else {
                    if (tempCurrent.trim().length > 0) {
                        blocks.push(tempCurrent.trim());
                    }
                    tempCurrent = word;
                }
            }
            if (tempCurrent.trim().length > 0) {
                current = tempCurrent.trim();
            }
            continue;
        }

        if ((current + " " + sentence).trim().length <= maxLen) {
            current += " " + sentence;
        } else {
            if (current.trim().length > 0) {
                blocks.push(current.trim());
            }
            current = sentence;
        }
    }

    if (current.trim().length > 0) blocks.push(current.trim());
    return blocks;
}

// Função auxiliar para dividir texto muito grande (fallback para textos muito longos)
function splitTextForTTS(text, maxSize = 20000) {
    const parts = [];
    let current = "";

    for (const word of text.split(" ")) {
        if ((current + " " + word).length > maxSize) {
            parts.push(current.trim());
            current = word;
        } else {
            current += " " + word;
        }
    }

    if (current.length > 0) parts.push(current.trim());
    return parts;
}

// Função para extrair cabeçalho WAV
function parseWavHeader(buffer) {
    return {
        numChannels: buffer.readUInt16LE(22),
        sampleRate: buffer.readUInt32LE(24),
        bitsPerSample: buffer.readUInt16LE(34),
        dataStart: 44
    };
}

// Função para reconstruir arquivo WAV final
function buildWavFile(pcmData, opts) {
    const { sampleRate, channels, bitDepth } = opts;
    const byteRate = (sampleRate * channels * bitDepth) / 8;

    const header = Buffer.alloc(44);

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcmData.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE((channels * bitDepth) / 8, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([header, pcmData]);
}

// Função para unir vários WAVs sem FFmpeg (apenas PCM raw)
function mergeWavBuffers(buffers) {
    const dataParts = [];
    let totalLength = 0;
    let sampleRate = null;
    let channels = null;
    let bitDepth = null;

    for (const buffer of buffers) {
        const header = parseWavHeader(buffer);
        if (!sampleRate) {
            sampleRate = header.sampleRate;
            channels = header.numChannels;
            bitDepth = header.bitsPerSample;
        }
        const pcmData = buffer.slice(header.dataStart);
        dataParts.push(pcmData);
        totalLength += pcmData.length;
    }

    return buildWavFile(Buffer.concat(dataParts), {
        sampleRate,
        channels,
        bitDepth
    });
}

const buildGeminiTtsEndpoints = (model, apiKey) => {
  // Para modelos TTS, usar apenas generateContent com estrutura correta
  // O endpoint generateAudio não existe para modelos TTS
  const endpoints = [
    {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      version: 'v1beta',
      method: 'generateContent',
      type: 'content'
    }
  ];

  return endpoints;
};

const extractGeminiAudioData = (data = {}) => {
  if (!data) {
    return { audioBase64: null, mimeType: null };
  }

  const candidates = Array.isArray(data.candidates) ? data.candidates : null;
  if (candidates && candidates.length > 0) {
    const parts = (candidates[0]?.content?.parts) || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return { audioBase64: part.inlineData.data, mimeType: part.inlineData.mimeType || null };
      }
      if (part?.inline_data?.data) {
        return { audioBase64: part.inline_data.data, mimeType: part.inline_data.mime_type || null };
      }
    }
  }

  if (data.audio?.data) {
    return { audioBase64: data.audio.data, mimeType: data.audio.mimeType || null };
  }

  if (Array.isArray(data.audio)) {
    const entry = data.audio.find(item => item?.data);
    if (entry) {
      return { audioBase64: entry.data, mimeType: entry.mimeType || null };
    }
  }

  if (Array.isArray(data.output)) {
    for (const outputPart of data.output) {
      if (outputPart?.audio?.data) {
        return { audioBase64: outputPart.audio.data, mimeType: outputPart.audio.mimeType || null };
      }
    }
  }

  return { audioBase64: null, mimeType: null };
};

const ensureWavBuffer = (audioBuffer, mimeType = '') => {
  if (!audioBuffer || audioBuffer.length === 0) {
    return audioBuffer;
  }

  const hasWavHeader = audioBuffer.length >= 4 && audioBuffer.slice(0, 4).toString('ascii') === 'RIFF';
  const mimeIsWav = typeof mimeType === 'string' && mimeType.toLowerCase().includes('wav');

  if (hasWavHeader || mimeIsWav) {
    return audioBuffer;
  }

  const numChannels = GEMINI_TTS_DEFAULT_CHANNELS;
  const bitsPerSample = GEMINI_TTS_DEFAULT_BIT_DEPTH;
  const sampleRate = GEMINI_TTS_DEFAULT_SAMPLE_RATE;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = audioBuffer.length;
  const byteRate = sampleRate * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, audioBuffer]);
};

const generateTtsAudio = async ({ apiKey, model, textInput, speakerVoiceMap, provider = 'gemini' }, retryCount = 0) => {
    // Se o provedor for OpenAI, usa a função específica
    if (provider === 'openai') {
        const voiceName = Array.from(speakerVoiceMap.values())[0] || 'alloy';
        return await generateOpenAiTtsAudio({ apiKey, textInput, voiceName });
    }
    
    // Gemini TTS usando REST API diretamente
    const geminiTtsModel = validateTtsModel(model);
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;
    const DELAY_BETWEEN_PARTS = 2000; // 2s entre partes (reduzido para acelerar, ainda seguro)
    
    // Single speaker: um único locutor (padrão: Autonoe conforme exemplo funcional)
    const voiceName = Array.from(speakerVoiceMap.values())[0] || 'Autonoe';
    
    console.log(`🎙️ [Gemini TTS] Modelo: ${geminiTtsModel}, Voz: ${voiceName}, Timeout: 600s (10min)`);
    
    // Divide texto em blocos maiores (2000 chars) para reduzir número de requisições e acelerar
    // Gemini aceita até 4000 bytes por requisição, então 2000 chars é seguro e muito mais rápido
    const textBlocks = splitLikeCapcut(textInput, 2000);
    console.log(`✂️ [Gemini TTS] Texto dividido em ${textBlocks.length} bloco(s) (máx 2000 chars - otimizado para velocidade)`);
    
    // Se for apenas 1 bloco, processa direto
    if (textBlocks.length === 1) {
        const result = await generateGeminiTtsChunk(apiKey, geminiTtsModel, textBlocks[0], voiceName, 0, 1, MAX_RETRIES, RETRY_DELAY);
        return result;
    }
    
    // Múltiplos blocos: processa um por um e junta os WAVs usando FFmpeg quando disponível
    const tempWavFiles = [];
    
    try {
        for (let i = 0; i < textBlocks.length; i++) {
            const blockText = textBlocks[i];
            console.log(`🎙️ [Gemini TTS] Bloco ${i + 1}/${textBlocks.length} (${blockText.length} chars)`);
            
            const result = await generateGeminiTtsChunk(apiKey, geminiTtsModel, blockText, voiceName, i, textBlocks.length, MAX_RETRIES, RETRY_DELAY);
            const wavBuffer = Buffer.from(result.audioBase64, 'base64');
            
            // Salvar arquivo temporário para usar com FFmpeg
            const tempWavPath = path.join(TEMP_AUDIO_DIR, `gemini_tts_temp_${Date.now()}_${i}.wav`);
            await fs.writeFile(tempWavPath, wavBuffer);
            tempWavFiles.push(tempWavPath);
            
            // Delay entre partes (evita limites do Google)
            if (i < textBlocks.length - 1) {
                console.log(`⏳ [Gemini TTS] Aguardando ${DELAY_BETWEEN_PARTS / 1000}s antes do próximo bloco...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PARTS));
            }
        }
        
        // Verificar se FFmpeg está disponível para concatenar
        const ffmpegAvailable = await checkFfmpegAvailable();
        
        if (ffmpegAvailable && tempWavFiles.length > 1) {
            // Usar FFmpeg para concatenar (melhor qualidade e sem corrupção)
            console.log(`🔗 [Gemini TTS] Unindo ${tempWavFiles.length} WAVs com FFmpeg...`);
            
            // Criar arquivo de lista para FFmpeg
            const listFilePath = path.join(TEMP_AUDIO_DIR, `gemini_tts_list_${Date.now()}.txt`);
            const fileListContent = tempWavFiles
                .map(fp => `file '${fp.replace(/\\/g, '/')}'`)
                .join('\n');
            
            await fs.writeFile(listFilePath, fileListContent, 'utf8');
            
            // Arquivo final temporário
            const finalTempPath = path.join(TEMP_AUDIO_DIR, `gemini_tts_final_${Date.now()}.wav`);
            
            // Usar FFmpeg para concatenar
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(listFilePath)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .outputOptions(['-c', 'copy']) // Copia sem re-encodar (mais rápido e sem perda)
                    .output(finalTempPath)
                    .on('start', (cmd) => {
                        console.log(`🎬 [Gemini TTS] FFmpeg iniciado para concatenação`);
                    })
                    .on('end', () => {
                        console.log(`✅ [Gemini TTS] FFmpeg concluído`);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error(`❌ [Gemini TTS] Erro no FFmpeg: ${err.message}`);
                        reject(err);
                    })
                    .run();
            });
            
            // Verificar se o arquivo foi criado corretamente pelo FFmpeg
            const finalStats = await fs.stat(finalTempPath);
            if (finalStats.size === 0) {
                throw new Error('Arquivo final gerado pelo FFmpeg está vazio');
            }
            
            console.log(`✅ [Gemini TTS] FFmpeg gerou arquivo: ${finalStats.size} bytes (${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`);
            
            // Ler arquivo final concatenado
            const finalWavBuffer = await fs.readFile(finalTempPath);
            
            // Validação: arquivo deve ter tamanho razoável
            if (finalWavBuffer.length < 100000) {
                console.warn(`⚠️ [Gemini TTS] AVISO: Arquivo final muito pequeno (${finalWavBuffer.length} bytes). Pode estar corrompido.`);
            }
            
            const finalBase64 = finalWavBuffer.toString('base64');
            
            // Limpar arquivos temporários
            try {
                await fs.unlink(listFilePath);
                await fs.unlink(finalTempPath);
                for (const tempFile of tempWavFiles) {
                    await fs.unlink(tempFile);
                }
            } catch (cleanupErr) {
                console.warn(`⚠️ [Gemini TTS] Erro ao limpar arquivos temporários: ${cleanupErr.message}`);
            }
            
            console.log(`🎉 [Gemini TTS] Áudio final gerado com FFmpeg: ${finalWavBuffer.length} bytes (${textBlocks.length} blocos unidos)`);
            
            return {
                audioBase64: finalBase64,
                usage: null,
                format: 'wav'
            };
        } else {
            // Fallback: usar mergeWavBuffers manualmente
            console.log(`🔗 [Gemini TTS] Unindo ${tempWavFiles.length} WAVs sem FFmpeg (fallback)...`);
            
            const wavBuffers = [];
            for (const tempFile of tempWavFiles) {
                const buffer = await fs.readFile(tempFile);
                wavBuffers.push(buffer);
            }
            
            const finalWavBuffer = mergeWavBuffers(wavBuffers);
            const finalBase64 = finalWavBuffer.toString('base64');
            
            // Limpar arquivos temporários
            for (const tempFile of tempWavFiles) {
                try {
                    await fs.unlink(tempFile);
                } catch (cleanupErr) {
                    console.warn(`⚠️ [Gemini TTS] Erro ao limpar arquivo temporário: ${cleanupErr.message}`);
                }
            }
            
            console.log(`🎉 [Gemini TTS] Áudio final gerado sem FFmpeg: ${finalWavBuffer.length} bytes (${textBlocks.length} blocos unidos)`);
            
            return {
                audioBase64: finalBase64,
                usage: null,
                format: 'wav'
            };
        }
    } catch (error) {
        // Limpar arquivos temporários em caso de erro
        for (const tempFile of tempWavFiles) {
            try {
                await fs.unlink(tempFile);
            } catch (cleanupErr) {
                // Ignorar erros de limpeza
            }
        }
        throw error;
    }
};

// Função auxiliar para gerar um único chunk de áudio usando REST API
async function generateGeminiTtsChunk(apiKey, model, text, voiceName, chunkIndex, totalChunks, maxRetries, retryDelay) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`🔄 [Gemini TTS] Chunk ${chunkIndex + 1}/${totalChunks} - Tentativa ${attempt + 1}/${maxRetries}...`);

            // Payload conforme documentação oficial Gemini TTS
            // https://ai.google.dev/gemini-api/docs/speech-generation
            const payload = {
                contents: [{
                    role: "user",
                    parts: [{ text }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName || "Autonoe"
                            }
                        }
                    }
                }
            };

            const startTime = Date.now();
            const TTS_TIMEOUT = 600000; // 10 minutos (600s) - aumentado para arquivos grandes
            const response = await Promise.race([
                axios.post(API_URL, payload, {
                    headers: { "Content-Type": "application/json" },
                    timeout: TTS_TIMEOUT
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout na requisição TTS (${TTS_TIMEOUT / 1000}s)`)), TTS_TIMEOUT)
                )
            ]);

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`✅ [Gemini TTS] Chunk ${chunkIndex + 1}/${totalChunks} recebido em ${elapsed}s`);

            const { audioBase64, mimeType } = extractGeminiAudioData(response.data);

            if (!audioBase64) {
                console.error("❌ [Gemini TTS] Estrutura da resposta sem áudio:", JSON.stringify(response.data, null, 2).substring(0, 500));
                throw new Error("Resposta sem dados de áudio");
            }

            console.log(`✅ [Gemini TTS] Chunk ${chunkIndex + 1}/${totalChunks} - Áudio recebido (${audioBase64.length} chars base64)`);

            const audioBuffer = Buffer.from(audioBase64, 'base64');
            const wavBuffer = ensureWavBuffer(audioBuffer, mimeType);

            return {
                audioBase64: wavBuffer.toString('base64'),
                usage: null,
                format: 'wav'
            };

        } catch (error) {
            console.error(`❌ [Gemini TTS] Chunk ${chunkIndex + 1}/${totalChunks} - Erro na tentativa ${attempt + 1}/${maxRetries}:`, {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data ? (typeof error.response.data === 'object' ? JSON.stringify(error.response.data).substring(0, 300) : error.response.data) : null
            });

            if (attempt < maxRetries - 1) {
                console.log(`⏳ [Gemini TTS] Aguardando ${retryDelay / 1000}s e tentando novamente...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            } else {
                throw new Error(`Falha permanente ao gerar áudio no chunk ${chunkIndex + 1}: ${error.message}`);
            }
        }
    }
};

async function processLongTtsJob(jobId, jobData) {
    const { apiKey, model, styleInstructions, segments } = jobData;
    const job = ttsJobs[jobId];
    const tempFilePaths = [];

    try {
        const validatedModel = validateTtsModel(model);
        const { speakerVoiceMap, normalizedSegments } = mapSegmentsToSpeechConfig(segments);
        job.status = 'processing';
        job.total = normalizedSegments.length;

        for (let i = 0; i < normalizedSegments.length; i++) {
            const segment = normalizedSegments[i];
            job.progress = i;
            job.message = `Gerando parte ${i + 1} de ${job.total}...`;

            const textInput = buildTtsPrompt(i === 0 ? styleInstructions : '', [segment]);
            
            let audioBase64 = null;
            let lastError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const result = await generateTtsAudio({
                        apiKey,
                        model: validatedModel,
                        textInput,
                        speakerVoiceMap: new Map([[segment.speaker, segment.voice]])
                    });
                    audioBase64 = result.audioBase64;
                    break; 
                } catch (error) {
                    lastError = error;
                    console.warn(`Tentativa ${attempt} falhou para o segmento ${i+1} do trabalho ${jobId}: ${error.message}`);
                    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!audioBase64) {
                throw lastError || new Error(`Falha ao gerar áudio para o segmento ${i + 1} após 3 tentativas.`);
            }

            // Usar .wav para Gemini (PCM), .mp3 para OpenAI
            const audioExt = (jobData.provider === 'gemini') ? 'wav' : 'mp3';
            const tempFilePath = path.join(TEMP_AUDIO_DIR, `${jobId}_part_${i}.${audioExt}`);
            await fs.writeFile(tempFilePath, audioBase64, 'base64');
            tempFilePaths.push(tempFilePath);
        }

        job.message = 'Finalizando áudio...';
        // Usar .wav para Gemini, .mp3 para OpenAI
        const audioExt = (jobData.provider === 'gemini') ? 'wav' : 'mp3';
        const finalFilePath = path.join(FINAL_AUDIO_DIR, `${jobId}.${audioExt}`);
        
        // Verificar disponibilidade do FFmpeg
        const ffmpegAvailableForMerge = await checkFfmpegAvailable();
        
        // Normaliza a lista de arquivos temporários (remove undefined/null)
        let validTempFiles = tempFilePaths.filter(fp => !!fp);
        
        if (validTempFiles.length === 0) {
            throw new Error('Nenhuma parte de áudio foi gerada.');
        }
        
        // CASO 1: só 1 arquivo OU não tem FFmpeg disponível → copia direto (sem concatenação)
        if (validTempFiles.length === 1 || !ffmpegAvailableForMerge) {
            console.log(`ℹ️ Finalização simples - ${validTempFiles.length} arquivo(s). FFmpeg disponível? ${ffmpegAvailableForMerge}`);
            
            const srcPath = validTempFiles[0];
            
            // Verifica se o arquivo existe
            let stats;
            try {
                stats = await fs.stat(srcPath);
                console.log(`✅ Arquivo fonte encontrado: ${srcPath} (${stats.size} bytes)`);
            } catch (err) {
                console.error(`❌ Erro ao verificar arquivo fonte: ${err.message}`);
                throw new Error(`Arquivo de áudio não encontrado: ${srcPath}`);
            }
            
            try {
                // Copia o arquivo para o destino final
                const sourceBuffer = await fs.readFile(srcPath);
                console.log(`📖 Arquivo fonte lido: ${sourceBuffer.length} bytes`);
                
                await fs.writeFile(finalFilePath, sourceBuffer);
                console.log(`✅ Arquivo copiado para: ${finalFilePath}`);
                
                const finalStats = await fs.stat(finalFilePath);
                console.log(`✅ Arquivo final criado: ${finalFilePath} (${finalStats.size} bytes / ${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`);
                
                if (finalStats.size === 0) {
                    throw new Error('Arquivo final está vazio');
                }
                
                // Validações simples de sanidade
                if (finalStats.size < 100000 && stats.size > 1000000) {
                    console.error(`❌ ERRO CRÍTICO: Arquivo final (${finalStats.size} bytes) é muito menor que o fonte (${stats.size} bytes).`);
                    throw new Error(`Arquivo corrompido: tamanho final (${finalStats.size}) muito menor que fonte (${stats.size})`);
                }
            } catch (err) {
                console.error(`❌ Erro ao copiar/verificar arquivo: ${err.message}`);
                throw new Error(`Falha ao criar arquivo final: ${err.message}`);
            }
            
            // Limpa temporários (se forem realmente temporários)
            for (const tempFile of validTempFiles) {
                try {
                    await fs.unlink(tempFile);
                    console.log(`🗑️ Arquivo temporário removido: ${tempFile}`);
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        console.warn(`⚠️ Não foi possível remover arquivo temporário ${tempFile}: ${err.message}`);
                    }
                }
            }
            
            job.status = 'completed';
            job.progress = job.total;
            job.downloadUrl = `/final_audio/${jobId}.${audioExt}`;
            job.message = ffmpegAvailableForMerge
                ? '✅ Áudio gerado com sucesso (sem necessidade de concatenação).'
                : '✅ Áudio gerado com sucesso (FFmpeg indisponível, usando arquivo único).';
            
            console.log(`🎉 TTS concluído (sem concatenação): ${jobId}.${audioExt}`);
            return;
        }
        
        // CASO 2: mais de 1 arquivo E FFmpeg disponível → concatenar com FFmpeg
        job.message = `🔗 Concatenando ${validTempFiles.length} partes com FFmpeg...`;
        console.log(`✅ FFmpeg disponível - concatenando ${validTempFiles.length} arquivos ${audioExt.toUpperCase()}`);
        
        try {
            // Criar arquivo de lista para FFmpeg
            const listFilePath = path.join(TEMP_AUDIO_DIR, `${jobId}_filelist.txt`);
            const fileListContent = validTempFiles
                .map(fp => `file '${fp.replace(/\\/g, '/')}'`)
                .join('\n');
            
            await fs.writeFile(listFilePath, fileListContent, 'utf8');
            
            // Para MP3: copia direto
            // Para WAV: re-encoda para garantir compatibilidade
            const outputOptions = audioExt === 'mp3'
                ? ['-c', 'copy']                       // MP3
                : ['-c:a', 'pcm_s16le', '-ar', '24000', '-ac', '1']; // WAV
            
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(listFilePath)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .outputOptions(outputOptions)
                    .output(finalFilePath)
                    .on('start', (cmd) => {
                        console.log(`🎬 [Gemini TTS] FFmpeg iniciado para concatenação: ${cmd}`);
                    })
                    .on('progress', (progress) => {
                        if (progress.percent) {
                            job.message = `🔗 Concatenando com FFmpeg: ${Math.round(progress.percent)}%`;
                        }
                    })
                    .on('end', () => {
                        console.log(`✅ [Gemini TTS] FFmpeg concluído: ${finalFilePath}`);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error(`❌ [Gemini TTS] Erro no FFmpeg: ${err.message}`);
                        reject(err);
                    })
                    .run();
            });
            
            const finalStats = await fs.stat(finalFilePath);
            if (finalStats.size === 0) {
                throw new Error('Arquivo final gerado pelo FFmpeg está vazio');
            }
            
            const minExpectedSize = audioExt === 'mp3' ? 500000 : 1000000;
            if (finalStats.size < minExpectedSize && validTempFiles.length > 1) {
                console.warn(`⚠️ Arquivo final pequeno (${finalStats.size} bytes). Esperado pelo menos ${minExpectedSize} bytes para ${validTempFiles.length} partes.`);
            }
            
            console.log(`✅ [Gemini TTS] Áudio concatenado com FFmpeg: ${finalStats.size} bytes (${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`);
            
            try {
                await fs.unlink(listFilePath);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.warn(`⚠️ Não foi possível remover lista do FFmpeg: ${err.message}`);
                }
            }
            
            // Limpa arquivos temporários
            for (const tempFile of validTempFiles) {
                try {
                    await fs.unlink(tempFile);
                    console.log(`🗑️ Arquivo temporário removido: ${tempFile}`);
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        console.warn(`⚠️ Não foi possível remover arquivo temporário ${tempFile}: ${err.message}`);
                    }
                }
            }
            
            job.status = 'completed';
            job.progress = job.total;
            job.downloadUrl = `/final_audio/${jobId}.${audioExt}`;
            job.message = '✅ Áudio gerado e concatenado com sucesso (FFmpeg).';
            console.log(`🎉 [Gemini TTS] TTS concluído com FFmpeg: ${jobId}.${audioExt}`);
            return;
            
        } catch (err) {
            console.error(`❌ [Gemini TTS] Falha na concatenação com FFmpeg: ${err.message}`);
            throw err;
        }

    } catch (error) {
        console.error(`Erro no trabalho TTS ${jobId}:`, error);
        job.status = 'failed';
        job.message = error.message || 'Ocorreu um erro desconhecido.';
    } finally {
        for (const filePath of tempFilePaths) {
            try {
                await fs.unlink(filePath);
            } catch (unlinkError) {
                console.warn(`Não foi possível excluir o arquivo temporário ${filePath}: ${unlinkError.message}`);
            }
        }
        job.finishedAt = new Date();
        scheduleJobCleanup(jobId);
    }
}

app.post('/api/register', async (req, res) => {
  const { email, password, whatsapp } = req.body;
  if (!email || !password || !whatsapp) return res.status(400).json({ message: 'E-mail, WhatsApp e senha são obrigatórios.' });
  
  const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
  if (!whatsappRegex.test(cleanedWhatsapp) || cleanedWhatsapp.length < 10) return res.status(400).json({ message: 'Por favor, insira um número de WhatsApp válido.' });
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const result = await dbRun('INSERT INTO users (email, password_hash, whatsapp, settings, is_active) VALUES (?, ?, ?, ?, 0)', [email, hash, whatsapp, '{}']);
    res.status(201).json({ id: result.lastID, email });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    console.error("Erro ao registrar utilizador:", err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  
  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ message: 'Email ou senha inválidos.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Email ou senha inválidos.' });
    if (!user.is_active) return res.status(403).json({ message: 'A sua conta precisa de ser ativada por um administrador.' });

    const expiresIn = rememberMe ? '30d' : '24h';
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn });

    if (user.must_change_password === 1) {
      return res.json({
        message: 'Alteração de senha necessária.',
        mustChangePassword: true,
        token,
        user: { id: user.id, email: user.email, role: user.role, whatsapp: user.whatsapp, mustChangePassword: true }
      });
    }

    await dbRun("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
    res.json({
      message: 'Login bem-sucedido!',
      token,
      user: { id: user.id, email: user.email, role: user.role, whatsapp: user.whatsapp }
    });
  } catch (err) {
    console.error("Erro durante o login:", err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.get('/api/verify-session', verifyToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, email, role, whatsapp, is_active, must_change_password FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado.' });
    if (!user.is_active) return res.status(403).json({ message: 'A sua conta precisa de ser ativada por um administrador.' });
    res.json({
      user: { id: user.id, email: user.email, role: user.role, whatsapp: user.whatsapp, mustChangePassword: user.must_change_password === 1 },
      mustChangePassword: user.must_change_password === 1
    });
  } catch(err) {
    console.error("Erro ao verificar sessão:", err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.get('/api/user/:userId/details', verifyToken, async (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'Acesso negado.' });
  try {
    const user = await dbGet('SELECT id, email, role, whatsapp, must_change_password, is_active, tags FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: 'Utilizador não encontrado.' });
    res.json({
      id: user.id,
      email: user.email,
      whatsapp: user.whatsapp,
      role: user.role,
      mustChangePassword: user.must_change_password === 1,
      isActive: user.is_active === 1,
      tags: user.tags
    });
  } catch (err) {
    console.error("Erro ao buscar detalhes do utilizador:", err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.get('/api/settings', verifyToken, async (req, res) => {
  try {
    const row = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
    res.json(row && row.settings ? JSON.parse(row.settings) : {});
  } catch(err) {
    console.error("Erro ao buscar configurações:", err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.post('/api/settings', verifyToken, async (req, res) => {
  try {
    await dbRun('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify(req.body.settings), req.user.id]);
    res.json({ message: 'Configurações salvas com sucesso!' });
  } catch(err) {
    console.error("Erro ao salvar configurações:", err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.put('/api/user/whatsapp', verifyToken, async (req, res) => {
  const { whatsapp } = req.body;
  if (!whatsapp) return res.status(400).json({ message: 'O número de WhatsApp é obrigatório.' });

  const whatsappRegex = /^\+?[1-9]\d{1,14}$/;
  const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
  if (!whatsappRegex.test(cleanedWhatsapp) || cleanedWhatsapp.length < 10) return res.status(400).json({ message: 'Número de WhatsApp inválido.' });
  
  try {
    // Salvar o WhatsApp limpo (sem caracteres especiais)
    await dbRun('UPDATE users SET whatsapp = ? WHERE id = ?', [cleanedWhatsapp, req.user.id]);
    res.json({ message: 'WhatsApp atualizado com sucesso!' });
  } catch(err) {
    console.error("Erro ao atualizar WhatsApp:", err.message);
    return res.status(500).json({ message: 'Erro ao atualizar o WhatsApp.' });
  }
});

app.post('/api/user/change-password', verifyToken, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres.' });

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        const result = await dbRun('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [hash, req.user.id]);
        if (result.changes === 0) return res.status(404).json({ message: 'Utilizador não encontrado.' });
        res.json({ message: 'Senha atualizada com sucesso!' });
    } catch(err) {
        console.error("Erro ao alterar a senha:", err.message);
        return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

async function getEmailTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("As credenciais SMTP não estão configuradas no .env. O e-mail não pode ser enviado.");
        throw new Error("O serviço de e-mail não está configurado no servidor.");
    }

    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const transportOptions = {
        host: process.env.SMTP_HOST,
        port: port,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    };

    if (port === 465) {
        transportOptions.secure = true;
    } else {
        transportOptions.secure = false;
        transportOptions.requireTLS = true;
    }

    return nodemailer.createTransport(transportOptions);
}

async function sendPasswordResetEmail(to, tempPassword) {
    const transporter = await getEmailTransporter();

    const templatePath = path.join(__dirname, 'email-template.html');
    let emailHtml = await fs.readFile(templatePath, 'utf-8');
    emailHtml = emailHtml.replace('{{TEMP_PASSWORD}}', tempPassword);

    const mailOptions = {
        from: `"DARKSCRIPT AI" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: to,
        subject: 'Sua Senha Temporária da DARKSCRIPT AI',
        html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
}

async function sendActivationEmail(to, loginUrl = process.env.APP_URL || 'https://darkscript.com.br') {
    try {
        const transporter = await getEmailTransporter();

        const templatePath = path.join(__dirname, 'email-activation-template.html');
        let emailHtml = await fs.readFile(templatePath, 'utf-8');
        emailHtml = emailHtml.replace('{{LOGIN_URL}}', loginUrl);

        const mailOptions = {
            from: `"DARKSCRIPT AI" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
            to: to,
            subject: '🎉 Acesso Liberado - DARKSCRIPT AI',
            html: emailHtml,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email de ativação enviado para: ${to}`);
    } catch (error) {
        console.error(`Erro ao enviar email de ativação para ${to}:`, error.message);
        throw error;
    }
}

async function sendCancellationEmail(to) {
    try {
        const transporter = await getEmailTransporter();

        const templatePath = path.join(__dirname, 'email-cancellation-template.html');
        let emailHtml = await fs.readFile(templatePath, 'utf-8');

        const mailOptions = {
            from: `"DARKSCRIPT AI" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
            to: to,
            subject: 'Acesso Encerrado - DARKSCRIPT AI',
            html: emailHtml,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email de cancelamento enviado para: ${to}`);
    } catch (error) {
        console.error(`Erro ao enviar email de cancelamento para ${to}:`, error.message);
        throw error;
    }
}

async function sendWhatsApp(to, message) {
    // Placeholder para a integração da API do WhatsApp
    // Aqui você adicionaria o código para enviar a mensagem usando um serviço como Twilio, Meta API, etc.
    console.log("--- SIMULAÇÃO DE ENVIO DE WHATSAPP ---");
    console.log(`Para: ${to}`);
    console.log(`Mensagem: ${message}`);
    console.log("------------------------------------");
    // Exemplo com Twilio (requer 'npm install twilio'):
    /*
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    try {
        await client.messages.create({
            body: message,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
            to: `whatsapp:${to}` // 'to' deve estar no formato +5511999999999
        });
        console.log("Mensagem de WhatsApp enviada com sucesso.");
    } catch (error) {
        console.error("Erro ao enviar mensagem de WhatsApp:", error);
        throw new Error("Falha ao enviar a mensagem de WhatsApp.");
    }
    */
    return Promise.resolve(); // Retorna uma promessa resolvida para simular sucesso
}

app.post('/api/password-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'O e-mail é obrigatório.' });

    try {
        const user = await dbGet('SELECT id, whatsapp FROM users WHERE email = ?', [email]);
        if (!user) return res.status(404).json({ message: 'E-mail não encontrado.' });

        const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(tempPassword, salt);

        await dbRun('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [hash, user.id]);

        const whatsappMessage = `Sua senha temporária da DARKSCRIPT AI é: ${tempPassword}`;

        try {
            // Envia e-mail e WhatsApp em paralelo (como na versão original)
            await Promise.all([
                sendPasswordResetEmail(email, tempPassword),
                sendWhatsApp(user.whatsapp, whatsappMessage)
            ]);
            
            res.json({ message: 'Uma senha temporária foi enviada para o seu e-mail e WhatsApp cadastrados. Você será solicitado a alterá-la no próximo login.' });
        } catch (sendError) {
            console.error("Erro ao enviar notificação de redefinição de senha:", sendError.message);
            return res.status(500).json({ message: `Não foi possível enviar as notificações. Por favor, verifique as configurações do servidor. Erro: ${sendError.message}` });
        }

    } catch (err) {
        console.error("Erro ao redefinir a senha:", err.message);
        return res.status(500).json({ message: 'Erro interno ao redefinir a senha.' });
    }
});

app.get('/api/status', async (req, res) => {
  try {
    const rows = await dbAll("SELECT key, value FROM app_status WHERE key IN ('maintenance', 'announcement', 'chat_enabled')");
    const status = {
      maintenance: JSON.parse(rows.find(r => r.key === 'maintenance')?.value || '{ "is_on": false, "message": "" }'),
      announcement: JSON.parse(rows.find(r => r.key === 'announcement')?.value || 'null'),
      chatEnabled: rows.find(r => r.key === 'chat_enabled')?.value === 'true' || rows.find(r => r.key === 'chat_enabled') === undefined // Default: true se não existir
    };
    res.json(status);
  } catch (err) {
    console.error("Erro ao buscar status da aplicação:", err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

const callApiWithRetries = async (apiCallFunction, maxRetries = 5) => {
  let lastError = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCallFunction();
    } catch (error) {
      lastError = error;
      const errorMessage = (error.response?.data?.error?.message || error.message || "").toLowerCase();
      const errorMessageFull = error.response?.data?.error?.message || error.message || "";
      const statusCode = error.response?.status;
      const errorCode = error.response?.data?.error?.code;
      
      // Não fazer retry para erros de autenticação, permissão ou dados inválidos (exceto rate limit)
      if (error.code === 'ENOTFOUND' || (statusCode >= 400 && statusCode < 500 && statusCode !== 429)) {
        // Exceção: rate_limit_exceeded sempre deve ter retry
        if (errorCode !== 'rate_limit_exceeded' && !errorMessage.includes('rate limit')) {
          throw error;
        }
      }
      
      // Calcular tempo de espera com backoff exponencial
      let waitTime = Math.min(1000 * Math.pow(2, i), 60000); // Backoff exponencial, máximo 60s
      
      // Verificar se é erro de quota esgotada (não apenas rate limit temporário)
      const isQuotaExhausted = errorMessage.includes('resource has been exhausted') && 
                               (errorMessage.includes('quota') || errorMessage.includes('check quota'));
      
      // Rate limit específico - extrair tempo recomendado da mensagem
      if (statusCode === 429 || errorCode === 'rate_limit_exceeded' || errorMessage.includes('rate limit') || isQuotaExhausted) {
        console.warn(`⚠️ Rate limit/quota atingido (tentativa ${i + 1}/${maxRetries})`);
        console.warn(`   Erro: ${errorMessageFull.substring(0, 200)}`);
        
        // Se for quota esgotada (não temporária), usar backoff mais longo
        if (isQuotaExhausted) {
          // Para quota esgotada, usar backoff exponencial mais agressivo
          waitTime = Math.min(5000 * Math.pow(2, i), 300000); // Até 5 minutos
          console.log(`⏱️ Quota esgotada detectada. Usando backoff exponencial: ${waitTime}ms`);
        } else {
          // Tentar extrair o tempo de espera recomendado da mensagem
          // Exemplos de mensagem:
          // "Please try again in 938ms."
          // "Please try again in 2.5s."
          // "Please try again in 30 seconds."
          const waitMatch = errorMessageFull.match(/try again in (\d+(?:\.\d+)?)\s*(ms|s|second|seconds|millisecond|milliseconds)/i);
          if (waitMatch) {
            const value = parseFloat(waitMatch[1]);
            const unit = waitMatch[2].toLowerCase();
            
            if (unit.startsWith('ms')) {
              waitTime = Math.ceil(value);
            } else {
              waitTime = Math.ceil(value * 1000);
            }
            
            // Adicionar margem de segurança de 10%
            waitTime = Math.ceil(waitTime * 1.1);
            
            console.log(`⏱️ Tempo de espera extraído da API: ${waitTime}ms (com margem de segurança)`);
          } else {
            // Se não conseguir extrair, usar backoff exponencial mais agressivo para rate limits
            waitTime = Math.min(2000 * Math.pow(2, i), 120000); // Até 120 segundos
            console.log(`⏱️ Usando backoff exponencial: ${waitTime}ms`);
          }
        }
        
        // Verificar header Retry-After (alguns providers incluem)
        const retryAfter = error.response?.headers?.['retry-after'];
        if (retryAfter) {
          const retryAfterMs = parseInt(retryAfter) * 1000;
          if (!isNaN(retryAfterMs) && retryAfterMs > 0) {
            waitTime = Math.max(waitTime, retryAfterMs);
            console.log(`⏱️ Header Retry-After encontrado: ${retryAfterMs}ms`);
          }
        }
        
        if (i < maxRetries - 1) {
          console.log(`⏳ Aguardando ${(waitTime / 1000).toFixed(1)}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } else if (errorMessage.includes('overloaded') || (statusCode >= 500 && statusCode <= 599)) {
        // Servidor sobrecarregado ou erro interno - usar backoff exponencial
        console.warn(`⚠️ Servidor sobrecarregado ou erro interno (tentativa ${i + 1}/${maxRetries})`);
        if (i < maxRetries - 1) {
          console.log(`⏳ Aguardando ${(waitTime / 1000).toFixed(1)}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } else {
        // Outros erros - não fazer retry
        throw error;
      }
    }
  }
  
  // Se todas as tentativas falharam, lançar o último erro com mensagem melhorada
  const errorMessage = lastError.response?.data?.error?.message || lastError.message || "";
  const statusCode = lastError.response?.status;
  
  if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
    throw new Error(`❌ Limite de requisições atingido após ${maxRetries} tentativas. A API está temporariamente indisponível devido ao alto volume de uso. Por favor, aguarde alguns minutos e tente novamente.\n\nDetalhes técnicos: ${errorMessage.substring(0, 300)}`);
  }
  
  throw lastError;
};

const buildRewriteInstruction = (failedPrompt, context, policyGuidance = '') => {
  const contextualInfo = (context && context.trim()) ? context.trim() : failedPrompt;
  const safetyBlock = policyGuidance
    ? `\nRegras de segurança obrigatórias:\n${policyGuidance}\n`
    : '';
  return `
Reescreva o seguinte prompt de imagem em INGLÊS para que seja seguro, respeite as políticas do provedor e mantenha a coerência com a história.
Preserve o ESTILO visual original (fotográfico, realista, iluminação, atmosfera). Não transforme o estilo em desenho, ilustração, pintura ou 3D se o prompt original sugeria fotografia.
Não introduza elementos novos inexistentes na história, apenas reformule para passar nos filtros de segurança.

Contexto narrativo e visual:
${contextualInfo}

${safetyBlock}

Prompt original com problema:
"${failedPrompt}"

Novo prompt seguro (apenas o prompt reescrito, sem explicações adicionais):
`.trim();
};

const buildRewriteProviders = (modelHint, { claudeKey, gptKey, geminiKeys }) => {
  if (modelHint) {
    if (modelHint.startsWith('claude-')) {
      if (!claudeKey) throw new Error("A chave da API Claude não está configurada.");
      return [{ name: 'claude', model: modelHint, key: claudeKey }];
    }
    if (modelHint.startsWith('gpt-')) {
      if (!gptKey) throw new Error("A chave da API OpenAI (GPT) não está configurada.");
      return [{ name: 'gpt', model: modelHint, key: gptKey }];
    }
    if (!geminiKeys || geminiKeys.length === 0) {
      throw new Error("Nenhuma chave da API Gemini está configurada.");
    }
    return [{ name: 'gemini', model: modelHint, key: geminiKeys[0] }];
  }

  const providers = [];
  if (geminiKeys && geminiKeys.length > 0) {
    providers.push({ name: 'gemini', model: 'gemini-2.0-flash-exp', key: geminiKeys[0] });
  }
  if (gptKey) {
    providers.push({ name: 'gpt', model: 'gpt-4o-mini', key: gptKey });
  }
  if (claudeKey) {
    providers.push({ name: 'claude', model: 'claude-sonnet-4-20250514', key: claudeKey });
  }
  return providers;
};

const rewriteImagePromptWithAi = async ({ userSettings, failedPrompt, context, modelHint, policyGuidance }) => {
  if (!failedPrompt || !failedPrompt.trim()) {
    throw new Error('Prompt inválido para reescrita.');
  }

  const claudeKey = typeof userSettings.claude === 'string' ? userSettings.claude.trim() : '';
  const gptKey = typeof userSettings.gpt === 'string' ? userSettings.gpt.trim() : '';
  const geminiKeys = getGeminiKeysFromSettings(userSettings);

  const providers = buildRewriteProviders(modelHint, { claudeKey, gptKey, geminiKeys });
  if (providers.length === 0) {
    throw new Error('Nenhuma chave de IA disponível para reescrever prompts.');
  }

  const rewritePrompt = buildRewriteInstruction(failedPrompt, context, policyGuidance);
  let lastError = null;

  for (const provider of providers) {
    try {
      if (provider.name === 'claude') {
        const response = await callApiWithRetries(() => axios.post('https://api.anthropic.com/v1/messages', {
          model: provider.model,
          max_tokens: 1024,
          messages: [{ role: "user", content: rewritePrompt }]
        }, {
          headers: {
            'x-api-key': provider.key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: 90000
        }));
        const text = response.data?.content?.[0]?.text?.trim();
        if (!text) throw new Error('Resposta vazia da Claude.');
        return { newPrompt: text, provider: provider.name, modelUsed: provider.model, rawResponse: text };
      }

      if (provider.name === 'gpt') {
        const response = await callApiWithRetries(() => axios.post('https://api.openai.com/v1/chat/completions', {
          model: provider.model,
          messages: [{ role: "user", content: rewritePrompt }],
          temperature: 0.4
        }, {
          headers: {
            'Authorization': `Bearer ${provider.key}`,
            'Content-Type': 'application/json'
          },
          timeout: 90000
        }));
        const text = response.data?.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error('Resposta vazia da OpenAI.');
        return { newPrompt: text, provider: provider.name, modelUsed: provider.model, rawResponse: text };
      }

      if (provider.name === 'gemini') {
        const key = provider.key;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${key}`;
        const response = await callApiWithRetries(() => axios.post(apiUrl, {
          contents: [{ role: "user", parts: [{ text: rewritePrompt }] }]
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 90000
        }));
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) throw new Error('Resposta vazia da API Gemini.');
        return { newPrompt: text, provider: provider.name, modelUsed: provider.model, rawResponse: text };
      }
    } catch (error) {
      lastError = error;
      console.warn(`[ImageFX Rewrite] Falha com provedor ${provider.name}:`, error.message);
    }
  }

  throw lastError || new Error('Falha ao reescrever o prompt.');
};

// ================================================
// 🔧 FUNÇÃO PARA DIVIDIR PROMPTS LONGOS EM PARTES
// ================================================
const splitPromptIntoParts = (prompt, model, maxOutputTokens) => {
    const tokenLimits = getTokenLimits(model);
    const promptTokens = estimateTokens(prompt);
    const outputTokens = maxOutputTokens || tokenLimits.maxOutputTokens;
    
    // Verificar se o prompt cabe com a saída solicitada
    const totalNeeded = promptTokens + outputTokens;
    
    // Se cabe, não precisa dividir
    if (totalNeeded <= tokenLimits.maxContextLength) {
        console.log(`✅ Prompt cabe no limite: ${promptTokens} tokens (input) + ${outputTokens} tokens (output) = ${totalNeeded}/${tokenLimits.maxContextLength} tokens`);
        return { needsSplit: false, parts: [prompt] };
    }
    
    // Calcular quantas partes são necessárias
    // Deixar margem de segurança de 20% para instruções de continuação
    const safeContextLength = Math.floor(tokenLimits.maxContextLength * 0.7);
    const tokensPerPart = safeContextLength - outputTokens;
    const numParts = Math.ceil(promptTokens / tokensPerPart);
    
    console.log(`⚠️ Prompt muito longo! ${promptTokens} tokens precisa ser dividido em ~${numParts} partes`);
    console.log(`   📊 Limite do modelo: ${tokenLimits.maxContextLength} tokens`);
    console.log(`   📊 Tokens por parte: ~${tokensPerPart} tokens`);
    
    // Dividir o prompt em partes aproximadamente iguais
    // Tenta dividir por parágrafos ou sentenças para manter contexto
    const lines = prompt.split('\n');
    const parts = [];
    let currentPart = '';
    let currentTokens = 0;
    
    for (const line of lines) {
        const lineTokens = estimateTokens(line + '\n');
        
        if (currentTokens + lineTokens > tokensPerPart && currentPart) {
            // Parte cheia, salvar e começar nova
            parts.push(currentPart.trim());
            currentPart = line + '\n';
            currentTokens = lineTokens;
        } else {
            currentPart += line + '\n';
            currentTokens += lineTokens;
        }
    }
    
    // Adicionar última parte
    if (currentPart.trim()) {
        parts.push(currentPart.trim());
    }
    
    console.log(`✅ Prompt dividido em ${parts.length} partes reais`);
    parts.forEach((part, i) => {
        const tokens = estimateTokens(part);
        console.log(`   📄 Parte ${i + 1}: ~${tokens} tokens`);
    });
    
    return { needsSplit: true, parts, totalParts: parts.length };
};

// ==========================
// ANÁLISE INTELIGENTE DO ROTEIRO
// ==========================
function analiseDeRoteiro(roteiro, modelo, tokensPorCena = 300) {
  const palavras = roteiro.trim().split(/\s+/).filter(Boolean).length;
  const tokensScript = Math.round(palavras * 1.9);
  const limits = getTokenLimits(modelo);
  
  const tokensDisponiveis = Math.max(limits.maxContextLength - tokensScript, 0);
  const cenasMaxSaida = Math.max(1, Math.floor(limits.maxOutputTokens / tokensPorCena));
  
  console.log("📊 Análise do roteiro:");
  console.log("   Palavras:", palavras);
  console.log("   Tokens do script: ~", tokensScript);
  console.log("   Tokens disponíveis para saída: ~", tokensDisponiveis);
  console.log("   Cenas máximas por tokens:", cenasMaxSaida);
  
  return {
    palavras,
    tokensScript,
    tokensDisponiveis,
    cenasMaxSaida
  };
}

// ==========================
// CÁLCULO DO maxOutputTokens SEM DESPERDÍCIO
// ==========================
const normalizeModelKey = (modelo = '') => normalizeModelName(modelo || '');

function calcularMaxOutputTokens(modelo, cenasFinal, tokensPorCena = 300) {
  const modelKey = normalizeModelKey(modelo);
  const limits = getTokenLimits(modelo);
  
  const tokensEstimados = cenasFinal * tokensPorCena;
  
  // Fator de segurança inteligente: Gemini precisa de mais margem (1.6), outros modelos 1.3
  const factor = modelKey.includes("gemini") ? 1.6 : 1.3;
  let maxTokensSaida = Math.ceil(tokensEstimados * factor);
  
  // não deixar exceder limite real do modelo
  maxTokensSaida = Math.min(maxTokensSaida, limits.maxOutputTokens);
  
  // não deixar muito baixo para evitar cortes
  if (maxTokensSaida < tokensPorCena * 2) {
    maxTokensSaida = tokensPorCena * 2;
  }
  
  console.log(`   🔧 Cálculo de tokens: ${cenasFinal} cenas × ${tokensPorCena} = ${tokensEstimados} tokens estimados`);
  console.log(`   🔧 Fator de segurança: ${factor} → ${maxTokensSaida} tokens (limite do modelo: ${limits.maxOutputTokens})`);
  
  return maxTokensSaida;
}

function contarCenasGeradas(texto = '') {
  const matches = texto.match(/Cena\s+\d+:/gi);
  return matches ? matches.length : 0;
}

function verificarIntegridade(texto = '', totalCenas) {
  const geradas = contarCenasGeradas(texto);
  if (geradas !== totalCenas) return false;

  for (let i = 1; i <= totalCenas; i++) {
    if (!texto.includes(`Cena ${i}:`)) return false;
  }
  return true;
}

function montarPromptDeCena(roteiro, totalCenas, palavrasPorCena) {
  return `
Você deve gerar EXATAMENTE ${totalCenas} cenas. 
Violar isso é ERRO FATAL.

REGRAS:
- Gerar cenas numeradas de 1 até ${totalCenas}
- Cada cena começa com: "Cena X:"
- Não pular números
- Não repetir cena
- Não gerar cenas extras
- Cada cena deve ter aproximadamente ${palavrasPorCena} palavras
- Não explicar nada, apenas cenas
- Não escrever texto fora das cenas

FORMATO OBRIGATÓRIO:

Cena 1:
[descrição]

Cena 2:
[descrição]

...

Cena ${totalCenas}:
[descrição]

ROTEIRO BASE:
${roteiro}

Reveja sua resposta antes de enviar e garanta que há EXATAMENTE ${totalCenas} cenas.
`.trim();
}

async function chamarGemini(modelo, prompt, maxOutputTokens, apiKey) {
  if (!apiKey) throw new Error("Chave de API Gemini não configurada.");

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens }
  };

  const response = await callApiWithRetries(() =>
    axios.post(apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000
    })
  );

  const candidate = response.data?.candidates?.[0];
  if (!candidate) throw new Error("Resposta vazia do Gemini.");
  if (candidate.finishReason === "MAX_TOKENS") throw new Error("MAX_TOKENS: Gemini cortou a resposta.");

  const text = candidate.content?.parts?.[0]?.text;
  if (!text || !text.trim()) throw new Error("Resposta vazia do Gemini.");
  return text.trim();
}

async function chamarOpenAI(modelo, prompt, maxOutputTokens, apiKey) {
  if (!apiKey) throw new Error("Chave de API OpenAI não configurada.");

  const body = {
    model: modelo,
    max_tokens: maxOutputTokens,
    messages: [{ role: "user", content: prompt }]
  };

  const response = await callApiWithRetries(() =>
    axios.post('https://api.openai.com/v1/chat/completions', body, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 300000
    })
  );

  const text = response.data?.choices?.[0]?.message?.content;
  if (!text || !text.trim()) throw new Error("Resposta vazia do GPT.");
  return text.trim();
}

async function chamarClaude(modelo, prompt, maxOutputTokens, apiKey) {
  if (!apiKey) throw new Error("Chave de API Claude não configurada.");

  const body = {
    model: modelo,
    max_tokens: maxOutputTokens,
    messages: [{ role: "user", content: prompt }]
  };

  const response = await callApiWithRetries(() =>
    axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 300000
    })
  );

  const contentItem = response.data?.content?.[0];
  const text = contentItem?.text || contentItem?.value;
  if (!text || !text.trim()) throw new Error("Resposta vazia do Claude.");
  return text.trim();
}

// ==========================
// GERAR AS CENAS (função principal)
// ==========================
async function generateScenePrompts({
  modelo,
  roteiro,
  totalCenas,
  tokensPorCena = 300,
  geminiKeys,
  gptKey,
  claudeKey,
  schema
}) {
  // 1. Analisar roteiro
  const analise = analiseDeRoteiro(roteiro, modelo, tokensPorCena);
  
  // limitar pelo modelo
  const cenasFinal = Math.min(totalCenas, analise.cenasMaxSaida);
  
  console.log(`   🎬 Cenas solicitadas: ${totalCenas}`);
  console.log(`   🎬 Cenas permitidas pelo modelo: ${analise.cenasMaxSaida}`);
  console.log(`   🎬 Cenas finais a gerar: ${cenasFinal}`);
  
  // 2. Calcular saída ideal sem desperdício
  const maxOutputTokens = calcularMaxOutputTokens(modelo, cenasFinal, tokensPorCena);
  
  console.log(`📊 Requisição completa: ${cenasFinal} cenas, usando ${maxOutputTokens} tokens de saída (dinâmico)`);
  
  // 3. Montar prompt (simplificado - você pode expandir depois)
  const prompt = `Diretor de arte: Divida o roteiro em cenas visuais lógicas. Gere EXATAMENTE ${cenasFinal} cenas. Para cada cena, gere 1 prompt em INGLÊS otimizado para geração de imagens. 

⚠️⚠️⚠️ REGRA CRÍTICA OBRIGATÓRIA: Cada prompt_text DEVE ter entre 600 e 1200 caracteres (não mais, não menos). Verifique o tamanho de cada prompt antes de responder.

Formato JSON array: [{"prompt_text": "...", "scene_description": "...", "original_text": "..."}].

ROTEIRO:
"""${roteiro}"""`;
  
  // 4. Preparar config para API
  const modelLower = modelo.toLowerCase().trim();
    let provider;
  
  if (modelLower.startsWith('claude-')) {
        provider = 'claude';
  } else if (modelLower.startsWith('gpt-')) {
        provider = 'gpt';
    } else {
        provider = 'gemini';
    }

  // 5. CHAMAR A API
  let response;
  let finishReason;
  let texto;
  
  if (provider === 'gemini') {
    if (!geminiKeys || geminiKeys.length === 0) {
      throw new Error("Nenhuma chave de API Gemini está configurada.");
    }
    const key = geminiKeys[0];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`;
    const generationConfig = {
      maxOutputTokens,
      temperature: 0.95,
      topP: 0.95
    };
    if (schema) {
      generationConfig.response_mime_type = "application/json";
    }
    
    response = await callApiWithRetries(() => axios.post(apiUrl, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 300000 }));
    
    const candidate = response.data.candidates?.[0];
    finishReason = candidate?.finishReason;
    texto = candidate?.content?.parts?.[0]?.text || "";
    
        } else if (provider === 'gpt') {
    if (!gptKey) {
      throw new Error("A chave da API OpenAI (GPT) não está configurada.");
    }
            const body = {
      model: modelo,
                messages: [{ role: "user", content: prompt }],
      max_tokens: maxOutputTokens,
      temperature: 0.95
    };
    // Para GPT com schema, precisamos instruir explicitamente no prompt
    if (schema) {
      // Adicionar instrução JSON no prompt ao invés de usar response_format
      // response_format só funciona para objetos JSON, não arrays
      body.messages[0].content += `\n\nIMPORTANTE: Você DEVE responder APENAS com JSON válido (um array) seguindo EXATAMENTE este formato:\n${JSON.stringify(schema, null, 2)}\n\nNÃO inclua markdown, explicações ou texto adicional. Apenas o JSON array.`;
    }
    
    try {
      response = await callApiWithRetries(() => axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: { 'Authorization': `Bearer ${gptKey}`, 'Content-Type': 'application/json' },
        timeout: 300000
      }));
      
      texto = response.data.choices?.[0]?.message?.content;
      if (!texto || !texto.trim()) {
        throw new Error("Resposta vazia da OpenAI.");
      }
      
      // Limpar markdown code blocks se existirem
      texto = texto.trim();
      texto = texto.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      finishReason = response.data.choices?.[0]?.finish_reason || 'stop';
    } catch (apiError) {
      // Tratar erros específicos da API do GPT
      if (apiError.response) {
        const status = apiError.response.status;
        const errorData = apiError.response.data;
        console.error(`❌ Erro HTTP ${status} da OpenAI (generateScenePrompts):`, JSON.stringify(errorData, null, 2));
        
        if (status === 400) {
          const errorMsg = errorData?.error?.message || errorData?.error || JSON.stringify(errorData);
          throw new Error(`Erro 400 da OpenAI: ${errorMsg}. Verifique o prompt e o modelo.`);
        } else if (status === 401) {
          throw new Error("Chave de API OpenAI inválida ou expirada.");
        } else if (status === 429) {
          throw new Error("Limite de requisições da OpenAI excedido. Tente novamente em alguns instantes.");
        } else {
          throw new Error(`Erro ${status} da OpenAI: ${errorData?.error?.message || JSON.stringify(errorData)}`);
        }
      } else {
        console.error('❌ Erro ao chamar OpenAI (generateScenePrompts):', apiError.message);
        throw apiError;
      }
    }
    
  } else if (provider === 'claude') {
    if (!claudeKey) {
      throw new Error("A chave da API Claude não está configurada.");
    }
    
    // Normalizar modelo Claude
    let claudeModel = modelo;
    if (!claudeModel || !claudeModel.startsWith('claude-')) {
      const modelLower = modelo.toLowerCase();
      if (modelLower.includes('sonnet-4.5') || modelLower.includes('sonnet4.5')) {
        claudeModel = 'claude-sonnet-4-20250514';
      } else if (modelLower.includes('sonnet-4') || modelLower.includes('sonnet4')) {
        claudeModel = 'claude-sonnet-4-20250514';
      } else if (modelLower.includes('sonnet')) {
        claudeModel = 'claude-sonnet-4-20250514';
      } else if (modelLower.includes('haiku')) {
        claudeModel = 'claude-3-5-haiku-20241022';
      } else {
        claudeModel = 'claude-sonnet-4-20250514'; // Default
      }
    }
    
    console.log(`🟣 Chamando Claude (generateScenePrompts): ${claudeModel}`);
    
    // Para Claude, colocar tudo no user message (mesma lógica que funciona no Criador de Roteiro)
    let userPrompt = prompt;
    if (schema) {
      userPrompt = prompt + `\n\nIMPORTANTE: Você DEVE responder APENAS com JSON válido seguindo EXATAMENTE este formato:\n${JSON.stringify(schema, null, 2)}\n\nNÃO inclua markdown, explicações ou texto adicional. Apenas o JSON.`;
    }
    
    const body = {
      model: claudeModel,
      max_tokens: maxOutputTokens,
      temperature: 0.95,
      messages: [{ role: "user", content: userPrompt }]
    };
    
    try {
      response = await callApiWithRetries(() => axios.post('https://api.anthropic.com/v1/messages', body, {
        headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        timeout: 300000
      }));
      
      // Verificar estrutura da resposta
      if (!response.data?.content || !Array.isArray(response.data.content) || response.data.content.length === 0) {
        console.error('❌ Resposta da Claude com estrutura inválida:', JSON.stringify(response.data, null, 2));
        throw new Error("Resposta da Claude com estrutura inválida.");
      }
      
      texto = response.data.content[0]?.text;
      if (!texto || !texto.trim()) {
        console.error('❌ Resposta da Claude sem texto:', JSON.stringify(response.data, null, 2));
        throw new Error("Resposta vazia da Claude.");
      }
      
      finishReason = response.data.stop_reason; // 'end_turn', 'max_tokens', etc.
    } catch (apiError) {
      // Tratar erros específicos da API da Claude
      if (apiError.response) {
        const status = apiError.response.status;
        const errorData = apiError.response.data;
        console.error(`❌ Erro HTTP ${status} da Claude (generateScenePrompts):`, JSON.stringify(errorData, null, 2));
        
        if (status === 400) {
          const errorMsg = errorData?.error?.message || errorData?.error || JSON.stringify(errorData);
          throw new Error(`Erro 400 da Claude: ${errorMsg}. Verifique o prompt e o schema.`);
        } else if (status === 401) {
          throw new Error("Chave de API Claude inválida ou expirada.");
        } else if (status === 429) {
          throw new Error("Limite de requisições da Claude excedido. Tente novamente em alguns instantes.");
        } else {
          throw new Error(`Erro ${status} da Claude: ${errorData?.error?.message || JSON.stringify(errorData)}`);
        }
      } else {
        console.error('❌ Erro ao chamar Claude (generateScenePrompts):', apiError.message);
        throw apiError;
      }
    }
  }
  
  // Verificar corte real
  if (finishReason === "MAX_TOKENS" || finishReason === "max_tokens" || finishReason === "length") {
    throw new Error(`A IA cortou a resposta (atingiu ${maxOutputTokens} tokens).`);
  }
  
  if (!texto || !texto.trim()) {
    throw new Error("Resposta da IA vazia — algo está errado.");
  }
  
  return texto;
}

// ==========================
// FALLBACK AUTOMÁTICO
// ==========================
async function gerarComFallback(opcoes) {
  const ordem = [opcoes.modelo, "gpt-4o", "claude-sonnet-4"];
  
  for (const modelo of ordem) {
    try {
      console.log(`⚙️ Tentando com modelo: ${modelo}`);
      const resultado = await generateScenePrompts({ ...opcoes, modelo });
      return { modelo, resultado };
    } catch (err) {
      console.log(`❌ Falhou com ${modelo}:`, err.message);
      if (modelo === ordem[ordem.length - 1]) {
        // Último modelo, lançar erro
        throw err;
      }
    }
  }
  
  throw new Error("Todos modelos falharam.");
}

app.post('/api/generate', verifyToken, async (req, res) => {
  try {
    const { modelo, roteiro, totalCenas, palavrasPorCena = 150 } = req.body || {};

    if (!roteiro || !modelo || !totalCenas) {
      return res.status(400).json({ ok: false, error: 'Parâmetros obrigatórios: modelo, roteiro, totalCenas' });
    }

    const total = Number(totalCenas);
    if (!Number.isInteger(total) || total <= 0) {
      return res.status(400).json({ ok: false, error: 'totalCenas deve ser um número inteiro positivo.' });
    }

    const palavrasCena = Math.max(10, Number(palavrasPorCena) || 150);
    const tokensPorCena = Math.max(50, Math.round(palavrasCena * 1.9));

    const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
    if (!userSettingsRow) throw new Error('Utilizador não encontrado.');

    const userSettings = userSettingsRow.settings ? JSON.parse(userSettingsRow.settings) : {};
    const geminiKeys = (Array.isArray(userSettings.gemini) ? userSettings.gemini : [userSettings.gemini])
      .filter(k => k && typeof k === 'string' && k.trim() !== '');
    const gptKey = (userSettings.gpt || '').trim();
    const claudeKey = (userSettings.claude || '').trim();

    const prompt = montarPromptDeCena(roteiro, total, palavrasCena);

    // Matriz de fallback - 2 modelos por API
    const fallbackMatrix = [
      { provider: 'gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
      { provider: 'gpt', models: ['gpt-4o', 'gpt-4-turbo'] },
      { provider: 'claude', models: ['claude-sonnet-4.5', 'claude-sonnet-4'] }
    ];

    const determineProvider = (modelKey) => {
      if (!modelKey) return null;
      if (modelKey.includes('gemini')) return 'gemini';
      if (modelKey.startsWith('gpt-')) return 'gpt';
      if (modelKey.startsWith('claude')) return 'claude';
      return null;
    };

    const normalizedInitialModel = normalizeModelKey(modelo);
    const primaryProvider = determineProvider(normalizedInitialModel);

    const attempts = [];
    const pushAttempt = (provider, modelName) => {
      if (!provider || !modelName) return;
      if (attempts.find(item => item.model === modelName)) return;
      attempts.push({ provider, model: modelName });
    };

    // Priorizar modelo solicitado
    pushAttempt(primaryProvider, normalizedInitialModel || modelo);

    // Adicionar fallback padrão
    for (const group of fallbackMatrix) {
      for (const m of group.models) {
        pushAttempt(group.provider, m);
      }
    }

    let saidaFinal = null;
    let modeloUtilizado = null;

    console.log(`📊 Requisição de geração: Modelo="${modelo}", totalCenas=${total}, palavrasPorCena=${palavrasCena}, tokensPorCena=${tokensPorCena}`);

    for (const tentativa of attempts) {
      const { provider, model: modelName } = tentativa;
      const modelKey = normalizeModelKey(modelName);

      // Verificar disponibilidade de chave antes de tentar
      if (provider === 'gemini' && geminiKeys.length === 0) {
        console.log(`⚠️ Pulando ${modelName}: nenhuma chave Gemini disponível.`);
        continue;
      }
      if (provider === 'gpt' && !gptKey) {
        console.log(`⚠️ Pulando ${modelName}: chave GPT ausente.`);
        continue;
      }
      if (provider === 'claude' && !claudeKey) {
        console.log(`⚠️ Pulando ${modelName}: chave Claude ausente.`);
        continue;
      }

        let maxOutputTokens;
        try {
          maxOutputTokens = calcularMaxOutputTokens(modelName, total, tokensPorCena);
      } catch (calcErr) {
        console.log(`⚠️ Não foi possível calcular tokens para ${modelName}: ${calcErr.message}`);
        continue;
      }

      console.log(`⚙️ Tentando modelo ${modelName} (provider ${provider}) com maxOutputTokens=${maxOutputTokens}`);

      try {
        let resposta;

        if (provider === 'gemini') {
          const key = geminiKeys[0];
          resposta = await chamarGemini(modelName, prompt, maxOutputTokens, key);
        } else if (provider === 'gpt') {
          resposta = await chamarOpenAI(modelName, prompt, maxOutputTokens, gptKey);
        } else if (provider === 'claude') {
          resposta = await chamarClaude(modelName, prompt, maxOutputTokens, claudeKey);
        } else {
          console.log(`⚠️ Provider desconhecido "${provider}" para modelo ${modelName}.`);
          continue;
        }

        if (verificarIntegridade(resposta, total)) {
          saidaFinal = resposta;
          modeloUtilizado = modelName;
          console.log("✅ Integração perfeita. Todas as cenas estão presentes.");
          break;
        } else {
          console.log(`❌ Modelo ${modelName} NÃO respeitou o número de cenas.`);
        }
      } catch (err) {
        console.log(`❌ Falhou no modelo ${modelName}:`, err.message);
      }
    }

    if (!saidaFinal) {
      throw new Error("Nenhum modelo conseguiu gerar as cenas corretamente.");
    }

    res.json({ ok: true, texto: saidaFinal, modelo: modeloUtilizado || modelo });
  } catch (err) {
    console.error("❌ ERRO /api/generate:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================
// ENDPOINT LEGADO PARA COMPATIBILIDADE (formato antigo: prompt, model, schema, maxOutputTokens)
// ==========================
app.post('/api/generate-legacy', verifyToken, async (req, res) => {
  try {
    const { prompt, model, schema, maxOutputTokens } = req.body;
    
    if (!prompt || !model) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: prompt, model' });
    }
    
    // Buscar configurações do usuário
    const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
    if (!userSettingsRow) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }
    
    const userSettings = userSettingsRow.settings ? JSON.parse(userSettingsRow.settings) : {};
    const geminiKeys = (Array.isArray(userSettings.gemini) ? userSettings.gemini : [userSettings.gemini])
      .filter(k => k && typeof k === 'string' && k.trim() !== '');
    const gptKey = (userSettings.gpt || '').trim();
    const claudeKey = (userSettings.claude || '').trim();
    
    // Debug: mostrar quais chaves estão configuradas
    console.log(`🔑 [${model}] Chaves configuradas - Claude: ${claudeKey ? '✓' : '✗'}, GPT: ${gptKey ? '✓' : '✗'}, Gemini: ${geminiKeys.length > 0 ? '✓' : '✗'}`);
    
    // Normalizar nome do modelo para a API (remover espaços, ajustar formato)
    // Mapeia nomes amigáveis para nomes exatos das APIs
    const normalizeModelName = (modelName) => {
      if (!modelName) return modelName;
      const modelLower = modelName.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '');
      
      // Gemini 2.5 (verificar ordem específica para evitar conflitos)
      if (modelLower.includes('gemini-2.5-flash-lite') || modelLower.includes('gemini-25-flash-lite') || modelLower.includes('flash-lite')) return 'gemini-2.5-flash-lite';
      if (modelLower.includes('gemini-2.5-pro') || modelLower.includes('gemini-25-pro')) return 'gemini-2.5-pro';
      if (modelLower.includes('gemini-2.5-flash') || modelLower.includes('gemini-25-flash')) return 'gemini-2.5-flash';
      if (modelLower.includes('gemini-2.0-flash-exp')) return 'gemini-2.5-flash'; // experimental -> 2.5
      
      // Gemini 1.5
      if (modelLower.includes('gemini-1.5-pro') || modelLower.includes('gemini-15-pro')) return 'gemini-1.5-pro';
      if (modelLower.includes('gemini-1.5-flash') || modelLower.includes('gemini-15-flash')) return 'gemini-1.5-flash';
      
      // Gemini genérico (fallback por tipo)
      if (modelLower.includes('gemini')) {
        if (modelLower.includes('pro')) return 'gemini-2.5-pro';
        if (modelLower.includes('flash')) return 'gemini-2.5-flash';
        return 'gemini-2.5-flash'; // Default
      }
      
      // OpenAI GPT (ordem específica para evitar conflitos)
      if (modelLower.includes('gpt-5.1') || modelLower.includes('gpt-51') || modelLower.includes('gpt5')) return 'gpt-5.1';
      if (modelLower.includes('gpt-4o')) return 'gpt-4o';
      if (modelLower.includes('gpt-4-turbo') || modelLower.includes('gpt4-turbo')) return 'gpt-4-turbo';
      if (modelLower.includes('gpt-4')) return 'gpt-4-turbo'; // fallback gpt-4 genérico
      if (modelLower.includes('gpt-3.5') || modelLower.includes('gpt-35')) return 'gpt-3.5-turbo';
      
      // Claude (usar versão mais recente disponível - tentativa sem sufixo)
      if (modelLower.includes('claude-sonnet-4.5') || modelLower.includes('claude-sonnet-45') || modelLower.includes('sonnet-4.5')) return 'claude-sonnet-4-20250514';
      if (modelLower.includes('claude-sonnet-4') || modelLower.includes('sonnet-4')) return 'claude-sonnet-4-20250514';
      if (modelLower.includes('claude-3-5-sonnet') || modelLower.includes('claude-35-sonnet')) return 'claude-sonnet-4-20250514';
      if (modelLower.includes('claude-3-5-haiku') || modelLower.includes('claude-35-haiku')) return 'claude-3-5-haiku-20241022';
      if (modelLower.includes('claude-3-opus')) return 'claude-3-opus-20240229';
      if (modelLower.includes('claude-3-sonnet')) return 'claude-3-sonnet-20240229';
      if (modelLower.includes('claude')) return 'claude-sonnet-4-20250514'; // Default Claude
      
      // Fallback: retornar normalizado
      return modelName.replace(/\s+/g, '-').replace(/_/g, '-').toLowerCase();
    };
    
    const apiModelName = normalizeModelName(model);
    
    // Determinar provider
    const modelLower = model.toLowerCase();
    const isGemini = modelLower.includes('gemini');
    const isGPT = modelLower.startsWith('gpt-') || modelLower.includes('gpt');
    const isClaude = modelLower.startsWith('claude');
    
    let result;
    let apiSource;
    
    try {
      if (isGemini && geminiKeys.length > 0) {
        const geminiKey = geminiKeys[0];
        
        // Verificar se o modelo é válido
        if (!apiModelName || !apiModelName.includes('gemini')) {
          throw new Error(`Modelo Gemini inválido: ${apiModelName}. Use gemini-2.5-pro, gemini-2.5-flash ou gemini-2.5-flash-lite.`);
        }
        
        // Função auxiliar para fazer a chamada ao Gemini com detecção rápida de quota
        const callGeminiAPIWithQuickQuotaCheck = async (modelName) => {
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
          
          console.log(`🔵 Chamando Gemini: ${modelName} (URL: ${apiUrl.substring(0, 80)}...)`);
          
          // Determinar maxOutputTokens ideal por modelo
          let geminiMaxOutput = maxOutputTokens;
          if (!geminiMaxOutput) {
            // Se não especificado, usar limites do modelo
            const limits = getTokenLimits(modelName);
            // Para schemas, usar mais tokens
            if (schema) {
              if (modelName.includes('gemini-2.5-pro')) {
                geminiMaxOutput = Math.min(limits.maxOutputTokens, 16384); // Gemini 2.5 Pro usa 16384
              } else {
                geminiMaxOutput = Math.min(limits.maxOutputTokens, 16384); // Outros Gemini usam 16384
              }
            } else {
              geminiMaxOutput = 8192;
            }
          }
          
          const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: geminiMaxOutput,
              temperature: 0.7
            }
          };
          
          // Adicionar schema se fornecido (todos os modelos Gemini 2.5 suportam)
          if (schema) {
            payload.generationConfig.response_mime_type = "application/json";
            payload.generationConfig.response_schema = schema;
            console.log(`📋 Schema aplicado para Gemini:`, JSON.stringify(schema).substring(0, 100));
            console.log(`📊 maxOutputTokens ajustado para: ${geminiMaxOutput}`);
          }
          
          // Fazer uma tentativa rápida primeiro para detectar quota esgotada
          try {
            const apiResponse = await axios.post(apiUrl, payload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 300000
            });
            
            // Verificar se há erro na resposta mesmo com status 200
            if (apiResponse.data?.error) {
              const geminiError = apiResponse.data.error;
              console.error('❌ Erro na resposta do Gemini:', geminiError);
              throw new Error(`Erro do Gemini: ${geminiError.message || geminiError.code || 'Erro desconhecido'}`);
            }
            
            return apiResponse;
          } catch (firstError) {
            // Verificar se é erro de quota esgotada
            const errorMessage = (firstError.response?.data?.error?.message || firstError.message || "").toLowerCase();
            const statusCode = firstError.response?.status;
            const errorMessageFull = firstError.response?.data?.error?.message || firstError.message || "";
            
            // Detecção mais ampla de quota esgotada
            const isQuotaExhausted = statusCode === 429 || 
                                     errorMessage.includes('resource has been exhausted') ||
                                     errorMessage.includes('quota') ||
                                     errorMessage.includes('rate limit');
            
            // Se for quota esgotada, lançar erro imediatamente para permitir fallback rápido
            if (isQuotaExhausted) {
              console.warn(`⚠️ Quota esgotada detectada no primeiro erro. Pulando retries para permitir fallback rápido.`);
              console.warn(`   Status: ${statusCode}, Mensagem: ${errorMessageFull.substring(0, 150)}`);
              throw firstError; // Lançar imediatamente sem retries
            }
            
            // Para outros erros, usar retries normais
            return await callApiWithRetries(() =>
              axios.post(apiUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 300000
              })
            );
          }
        };
        
        // Tentar chamar o modelo solicitado
        let response;
        let fallbackUsed = false;
        const isProModel = apiModelName.includes('gemini-2.5-pro') || apiModelName.includes('gemini-1.5-pro');
        
        try {
          response = await callGeminiAPIWithQuickQuotaCheck(apiModelName);
        } catch (error) {
          // Verificar se é erro de quota esgotada
          const errorMessage = (error.response?.data?.error?.message || error.message || "").toLowerCase();
          const statusCode = error.response?.status;
          const errorMessageFull = error.response?.data?.error?.message || error.message || "";
          
          // Detecção mais ampla de quota esgotada
          // Qualquer erro 429 ou mensagem relacionada a quota/rate limit
          const isQuotaExhausted = statusCode === 429 || 
                                   errorMessage.includes('resource has been exhausted') ||
                                   errorMessage.includes('quota') ||
                                   errorMessage.includes('rate limit') ||
                                   errorMessage.includes('exhausted');
          
          console.log(`🔍 [DEBUG] Erro capturado:`, {
            statusCode,
            errorMessage: errorMessageFull.substring(0, 100),
            isQuotaExhausted,
            isProModel,
            apiModelName
          });
          
          // Se for Gemini Pro e der erro de quota (qualquer 429), tentar fallback para Flash
          // Para Gemini Pro, qualquer erro 429 deve tentar fallback
          if ((isQuotaExhausted || statusCode === 429) && isProModel) {
            console.warn(`⚠️ Gemini Pro falhou por quota esgotada. Tentando fallback imediato para Gemini Flash...`);
            try {
              const fallbackModel = 'gemini-2.5-flash';
              console.log(`🔄 [FALLBACK] Tentando usar ${fallbackModel} como alternativa...`);
              response = await callGeminiAPIWithQuickQuotaCheck(fallbackModel);
              fallbackUsed = true;
              apiSource = `Gemini Flash (fallback - Pro com quota esgotada)`;
              console.log(`✅ Fallback para Gemini Flash bem-sucedido!`);
            } catch (fallbackError) {
              // Se o fallback também falhar, lançar o erro original
              const fallbackErrorMessage = fallbackError.response?.data?.error?.message || fallbackError.message || "";
              console.error(`❌ Fallback para Gemini Flash também falhou:`, fallbackErrorMessage.substring(0, 200));
              throw error; // Lançar o erro original do Pro
            }
          } else {
            // Se não for Pro ou não for erro de quota, lançar o erro normalmente
            if (!isProModel) {
              console.warn(`⚠️ Erro em modelo não-Pro (${apiModelName}), não há fallback disponível`);
            } else if (!isQuotaExhausted) {
              console.warn(`⚠️ Erro não é de quota esgotada, não há fallback disponível`);
            }
            throw error;
          }
        }
        
        if (!fallbackUsed) {
          apiSource = `Gemini (${apiModelName})`;
        }
        
        let candidate = response.data?.candidates?.[0];
        if (!candidate) {
          console.error('❌ Resposta do Gemini sem candidates:', JSON.stringify(response.data, null, 2));
          console.error('❌ Response status:', response.status);
          console.error('❌ Response data keys:', response.data ? Object.keys(response.data) : 'N/A');
          
          // Verificar se há erro na resposta
          if (response.data?.error) {
            const geminiError = response.data.error;
            console.error('❌ Erro do Gemini:', geminiError);
            throw new Error(`Erro do Gemini: ${geminiError.message || geminiError.code || 'Erro desconhecido'}. Tente usar outro modelo.`);
          }
          
          // Tentar retry uma vez se não houver candidates
          console.log('🔄 Tentando retry da chamada Gemini...');
          try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2 segundos
            response = await callGeminiAPIWithQuickQuotaCheck(apiModelName);
            
            // Verificar erro na resposta do retry
            if (response.data?.error) {
              const geminiError = response.data.error;
              throw new Error(`Erro do Gemini: ${geminiError.message || geminiError.code || 'Erro desconhecido'}. Tente usar outro modelo.`);
            }
            
            candidate = response.data?.candidates?.[0];
            if (!candidate) {
              throw new Error("Resposta vazia do Gemini após retry. Tente usar outro modelo (GPT ou Claude).");
            }
          } catch (retryError) {
            if (retryError.message.includes('Erro do Gemini')) {
              throw retryError;
            }
            throw new Error("Resposta vazia do Gemini. Tente usar outro modelo (GPT ou Claude).");
          }
        }
        
        // Verificar se foi bloqueado por segurança
        if (candidate.safetyRatings && candidate.safetyRatings.some(r => r.probability === 'HIGH' || r.probability === 'MEDIUM')) {
          const blockedCategories = candidate.safetyRatings.filter(r => r.probability === 'HIGH' || r.probability === 'MEDIUM').map(r => r.category).join(', ');
          console.warn(`⚠️ Gemini bloqueou resposta por segurança: ${blockedCategories}`);
          // Não lançar erro, apenas avisar - tentar continuar
        }
        
        if (candidate.finishReason === "MAX_TOKENS") {
          console.error('❌ Gemini retornou MAX_TOKENS');
          console.warn('⚠️ Tentando usar resposta parcial mesmo com MAX_TOKENS...');
          // Não lançar erro imediatamente - tentar usar o que foi retornado
          // A resposta pode estar incompleta mas ainda útil
        }
        
        if (candidate.finishReason === "SAFETY") {
          console.error('❌ Gemini bloqueou por segurança');
          throw new Error("SAFETY: Resposta bloqueada por filtros de segurança do Gemini. Tente reformular o prompt ou usar outro modelo.");
        }
        
        if (candidate.finishReason && candidate.finishReason !== "STOP") {
          console.warn(`⚠️ Gemini finishReason: ${candidate.finishReason}`);
        }
        
        let text = candidate.content?.parts?.[0]?.text;
        if (!text || !text.trim()) {
          console.error('❌ Resposta do Gemini sem texto:', JSON.stringify(candidate, null, 2));
          console.error('❌ finishReason:', candidate.finishReason);
          console.error('❌ safetyRatings:', candidate.safetyRatings);
          
          // Verificar se foi bloqueado
          if (candidate.finishReason === "SAFETY" || (candidate.safetyRatings && candidate.safetyRatings.some(r => r.probability === 'HIGH'))) {
            throw new Error("SAFETY: Resposta bloqueada por filtros de segurança do Gemini. Tente reformular o prompt ou usar outro modelo.");
          }
          
          // Verificar se há erro específico na resposta
          if (response.data?.error) {
            const geminiError = response.data.error;
            console.error('❌ Erro específico do Gemini:', geminiError);
            throw new Error(`Erro do Gemini: ${geminiError.message || geminiError.code || 'Erro desconhecido'}. Tente usar outro modelo.`);
          }
          
          // Tentar retry uma vez se a resposta estiver vazia
          console.log('🔄 Tentando retry da chamada Gemini (resposta vazia)...');
          try {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar 3 segundos
            response = await callGeminiAPIWithQuickQuotaCheck(apiModelName);
            
            // Verificar erro na resposta do retry
            if (response.data?.error) {
              const geminiError = response.data.error;
              console.error('❌ Erro do Gemini no retry:', geminiError);
              throw new Error(`Erro do Gemini: ${geminiError.message || geminiError.code || 'Erro desconhecido'}. Tente usar outro modelo.`);
            }
            
            const retryCandidate = response.data?.candidates?.[0];
            if (retryCandidate) {
              const retryText = retryCandidate.content?.parts?.[0]?.text;
              if (retryText && retryText.trim()) {
                console.log('✅ Retry bem-sucedido! Gemini retornou texto após retry.');
                // Usar o texto do retry
                text = retryText.trim();
              } else {
                console.error('❌ Retry também retornou texto vazio');
                throw new Error("Gemini retornou resposta vazia. Use outro modelo (GPT ou Claude).");
              }
            } else {
              console.error('❌ Retry também não retornou candidates');
              throw new Error("Gemini retornou resposta vazia. Use outro modelo (GPT ou Claude).");
            }
          } catch (retryError) {
            if (retryError.message.includes('Erro do Gemini')) {
              throw retryError;
            }
            throw new Error("Gemini retornou resposta vazia. Use outro modelo (GPT ou Claude).");
          }
        }
        
        console.log(`✅ Gemini retornou ${text.length} caracteres`);
        
        // Tentar parsear como JSON se schema foi solicitado
        if (schema) {
          // Gemini Pro às vezes retorna JSON com estrutura diferente, usar parseJsonRobustly
          try {
            // Para Gemini Pro, usar parseJsonRobustly que é mais robusto
            const isProModel = apiModelName.includes('gemini-2.5-pro') || 
                              apiModelName.includes('gemini-1.5-pro');
            
            if (isProModel) {
              // Gemini Pro: usar parseJsonRobustly para melhor tratamento
              console.log(`🔵 Gemini Pro detectado, usando parseJsonRobustly para parsing`);
              let parsed = parseJsonRobustly(text, `Gemini Pro (${apiModelName})`);
              
              // PRIMEIRO: Verificar se é objeto com propriedades específicas (titles, structures, ideas)
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                // Verificar se tem titles
                if (parsed.titles && Array.isArray(parsed.titles)) {
                  parsed.titles = parsed.titles.map(item => {
                    if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                      item.category = 'Fórmula não especificada';
                    }
                    return item;
                  });
                  result = { data: parsed };
                }
                // Verificar se tem structures
                else if (parsed.structures && Array.isArray(parsed.structures)) {
                  parsed.structures = parsed.structures.map(item => {
                    if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                      item.category = 'Fórmula não especificada';
                    }
                    return item;
                  });
                  result = { data: parsed };
                }
                // Verificar se tem ideas
                else if (parsed.ideas && Array.isArray(parsed.ideas)) {
                  // Para brainstorm de ideias - garantir que está no formato correto
                  parsed.ideas = parsed.ideas.map(item => {
                    if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                      item.category = 'Fórmula não especificada';
                    }
                    return item;
                  });
                  // Garantir que retorna { data: { ideas: [...] } }
                  result = { data: parsed };
                }
                // Verificar se tem prompts
                else if (parsed.prompts && Array.isArray(parsed.prompts)) {
                  // Para prompts de thumbnail
                  parsed.prompts = parsed.prompts.map(item => {
                    if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                      item.category = 'Fórmula não especificada';
                    }
                    return item;
                  });
                  result = { data: parsed };
                }
                // Se não encontrou propriedades específicas, retornar como está
                else {
                  result = { data: parsed };
                }
              }
              // SEGUNDO: Verificar se é array direto
              else if (Array.isArray(parsed) && parsed.length > 0) {
                // Se parsed é um array direto, verificar o tipo de conteúdo
                const firstItem = parsed[0];
                if (firstItem) {
                  // Verificar se é array de títulos (tem 'title', pode ter 'category' ou 'scores')
                  if (firstItem.title && (firstItem.category !== undefined || firstItem.scores !== undefined || firstItem.suggestion !== undefined)) {
                    console.log(`🔵 Gemini Pro retornou array direto de títulos, mantendo como array`);
                    // Garantir que todos os títulos tenham category preenchido
                    parsed = parsed.map(item => {
                      if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                        item.category = 'Fórmula não especificada';
                      }
                      return item;
                    });
                    result = { data: parsed };
                  }
                  // Verificar se é array de estruturas (tem 'structure' e 'category')
                  else if (firstItem.structure && firstItem.category !== undefined) {
                    console.log(`🔵 Gemini Pro retornou array direto de estruturas, mantendo como array`);
                    result = { data: parsed };
                  }
                  // Verificar se é array de ideias (tem 'idea' ou 'name' ou 'title' com 'scores')
                  else if (firstItem.idea || firstItem.name || (firstItem.title && firstItem.scores)) {
                    console.log(`🔵 Gemini Pro retornou array direto de ideias, convertendo para { ideas: [...] }`);
                    result = { data: { ideas: parsed } };
                  }
                  // Verificar se é array de prompts de thumbnail (tem 'prompt' e 'score')
                  else if (firstItem.prompt && firstItem.score !== undefined) {
                    console.log(`🔵 Gemini Pro retornou array direto de prompts de thumbnail, mantendo como array`);
                    result = { data: parsed };
                  }
                  // Verificar se é array de prompts de cena (tem 'prompt_text' ou 'scene_description')
                  else if (firstItem.prompt_text || firstItem.scene_description || firstItem.original_text) {
                    console.log(`🔵 Gemini Pro retornou array direto de prompts de cena, mantendo como array`);
                    result = { data: parsed };
                  }
                  // Caso padrão: manter como array
                  else {
                    console.log(`🔵 Gemini Pro retornou array direto, mantendo como array`);
                    result = { data: parsed };
                  }
                } else {
                  result = { data: parsed };
                }
              } else {
                result = { data: parsed };
              }
            } else {
              // Gemini Flash: usar parsing direto (já funciona)
              let parsed = JSON.parse(text.trim());
              console.log(`✅ JSON parseado com sucesso do Gemini (${Object.keys(parsed).length} chaves no nível superior)`);
              
              // Garantir que todos os itens tenham category preenchido
              if (Array.isArray(parsed)) {
                parsed = parsed.map(item => {
                  if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                    item.category = 'Fórmula não especificada';
                  }
                  return item;
                });
              } else if (parsed.titles && Array.isArray(parsed.titles)) {
                parsed.titles = parsed.titles.map(item => {
                  if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                    item.category = 'Fórmula não especificada';
                  }
                  return item;
                });
              } else if (parsed.structures && Array.isArray(parsed.structures)) {
                parsed.structures = parsed.structures.map(item => {
                  if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                    item.category = 'Fórmula não especificada';
                  }
                  return item;
                });
              }
              
              result = { data: parsed };
            }
            } catch (e) {
            console.warn(`⚠️ Erro ao parsear JSON do Gemini: ${e.message}`);
            console.log(`📄 Texto recebido (primeiros 500 chars): ${text.trim().substring(0, 500)}`);
            // Se falhar, tentar extrair JSON de markdown ou texto usando parseJsonRobustly
            try {
              let parsed = parseJsonRobustly(text, `Gemini (${apiModelName})`);
              
              // Garantir que todos os itens tenham category preenchido
              if (Array.isArray(parsed)) {
                // Verificar o tipo de conteúdo do array
                const firstItem = parsed[0];
                if (firstItem) {
                  // Verificar se é array de títulos (tem 'title', pode ter 'category' ou 'scores')
                  if (firstItem.title && (firstItem.category !== undefined || firstItem.scores !== undefined || firstItem.suggestion !== undefined)) {
                    console.log(`🔵 parseJsonRobustly retornou array de títulos, mantendo como array`);
                    parsed = parsed.map(item => {
                      if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                        item.category = 'Fórmula não especificada';
                      }
                      return item;
                    });
                    result = { data: parsed };
                  }
                  // Verificar se é array de estruturas (tem 'structure' e 'category')
                  else if (firstItem.structure && firstItem.category !== undefined) {
                    console.log(`🔵 parseJsonRobustly retornou array de estruturas, mantendo como array`);
                    parsed = parsed.map(item => {
                      if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                        item.category = 'Fórmula não especificada';
                      }
                      return item;
                    });
                    result = { data: parsed };
                  }
                  // Verificar se é array de ideias (tem 'idea' ou 'name' ou 'title' com 'scores')
                  else if (firstItem.idea || firstItem.name || (firstItem.title && firstItem.scores)) {
                    console.log(`🔵 parseJsonRobustly retornou array de ideias, convertendo para { ideas: [...] }`);
                    result = { data: { ideas: parsed } };
                  }
                  // Verificar se é array de prompts de thumbnail (tem 'prompt' e 'score')
                  else if (firstItem.prompt && firstItem.score !== undefined) {
                    console.log(`🔵 parseJsonRobustly retornou array de prompts de thumbnail, mantendo como array`);
                    result = { data: parsed };
                  }
                  // Verificar se é array de prompts de cena (tem 'prompt_text' ou 'scene_description')
                  else if (firstItem.prompt_text || firstItem.scene_description || firstItem.original_text) {
                    console.log(`🔵 parseJsonRobustly retornou array de prompts de cena, mantendo como array`);
                    result = { data: parsed };
                  }
                  // Caso padrão: tratar como array genérico
                  else {
                    parsed = parsed.map(item => {
                      if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                        item.category = 'Fórmula não especificada';
                      }
                      return item;
                    });
                    result = { data: parsed };
                  }
                } else {
                  result = { data: parsed };
                }
              } else if (parsed.titles && Array.isArray(parsed.titles)) {
                parsed.titles = parsed.titles.map(item => {
                  if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                    item.category = 'Fórmula não especificada';
                  }
                  return item;
                });
                result = { data: parsed };
              } else if (parsed.structures && Array.isArray(parsed.structures)) {
                parsed.structures = parsed.structures.map(item => {
                  if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                    item.category = 'Fórmula não especificada';
                  }
                  return item;
                });
                result = { data: parsed };
              } else if (parsed.ideas && Array.isArray(parsed.ideas)) {
                parsed.ideas = parsed.ideas.map(item => {
                  if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                    item.category = 'Fórmula não especificada';
                  }
                  return item;
                });
                result = { data: parsed };
              } else if (parsed.prompts && Array.isArray(parsed.prompts)) {
                parsed.prompts = parsed.prompts.map(item => {
                  if (!item.category || item.category === 'N/A' || item.category.trim() === '') {
                    item.category = 'Fórmula não especificada';
                  }
                  return item;
                });
                result = { data: parsed };
              } else {
                result = { data: parsed };
              }
            } catch (e2) {
              console.error('❌ Erro ao extrair e parsear JSON do Gemini:', e2.message);
              console.error('❌ Stack trace:', e2.stack);
              // Tentar retornar o texto como está para o frontend processar
              result = { data: text.trim() };
            }
          }
        } else {
          result = { data: text.trim() };
        }
        
        apiSource = `Gemini (${apiModelName || model})`;
        
      } else if (isGPT && gptKey) {
            const body = {
          model: apiModelName || model,
          max_tokens: maxOutputTokens || 4096,
                messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        };
        
        // GPT não suporta schema nativo, mas podemos incluir no prompt
        if (schema) {
          body.messages[0].content += `\n\nRESPONDA APENAS COM JSON VÁLIDO no seguinte formato:\n${JSON.stringify(schema, null, 2)}`;
        }
        
        const response = await callApiWithRetries(() =>
          axios.post('https://api.openai.com/v1/chat/completions', body, {
            headers: {
              'Authorization': `Bearer ${gptKey}`,
              'Content-Type': 'application/json'
            },
                timeout: 300000
          })
        );
        
        const text = response.data?.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error("Resposta vazia da OpenAI.");
        
        // Tentar parsear como JSON se schema foi solicitado
        if (schema) {
          try {
            // Tentar parsear diretamente
            let parsed = JSON.parse(text);
            result = { data: parsed };
          } catch (e) {
            // Se falhar, tentar extrair JSON de markdown ou texto
            try {
              // Remover markdown code blocks se existirem
              let cleanedText = text.trim();
              cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
              // Tentar encontrar JSON no texto
              const jsonMatch = cleanedText.match(/\{[\s\S]*\}/) || cleanedText.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                result = { data: JSON.parse(jsonMatch[0]) };
        } else {
                result = { data: cleanedText };
              }
            } catch (e2) {
              console.warn('⚠️ Não foi possível parsear JSON do GPT:', e2.message);
              result = { data: text };
            }
          }
        } else {
          result = { data: text };
        }
        
        apiSource = `OpenAI (${apiModelName || model})`;
        
      } else if (isClaude && claudeKey) {
        // Normalizar modelo Claude
        let claudeModel = apiModelName;
        if (!claudeModel || !claudeModel.startsWith('claude-')) {
          // Tentar detectar versão do modelo
          const modelLower = model.toLowerCase();
          if (modelLower.includes('sonnet-4.5') || modelLower.includes('sonnet4.5')) {
            claudeModel = 'claude-sonnet-4-20250514';
          } else if (modelLower.includes('sonnet-4') || modelLower.includes('sonnet4')) {
            claudeModel = 'claude-sonnet-4-20250514';
          } else if (modelLower.includes('sonnet')) {
            claudeModel = 'claude-sonnet-4-20250514';
          } else if (modelLower.includes('haiku')) {
            claudeModel = 'claude-3-5-haiku-20241022';
          } else {
            claudeModel = 'claude-sonnet-4-20250514'; // Default
          }
        }
        
        console.log(`🟣 Chamando Claude: ${claudeModel}`);
        
        // Para Claude, colocar tudo no user message (mesma lógica que funciona no Criador de Roteiro)
        // Não usar system message para evitar erros 400
        let userPrompt = prompt;
        if (schema) {
          // Adicionar instruções explícitas sobre JSON no prompt do usuário
          userPrompt = prompt + `\n\nIMPORTANTE: Você DEVE responder APENAS com JSON válido seguindo EXATAMENTE este formato:\n${JSON.stringify(schema, null, 2)}\n\nNÃO inclua markdown, explicações ou texto adicional. Apenas o JSON.`;
        }
        
        // Log do tamanho do prompt para debug
        console.log(`📏 Tamanho do prompt Claude: ${userPrompt.length} caracteres`);
        if (userPrompt.length > 200000) {
          console.warn(`⚠️ Prompt muito longo para Claude (${userPrompt.length} chars). Limite recomendado: 200k`);
        }
        
        try {
          const response = await callApiWithRetries(() =>
            axios.post('https://api.anthropic.com/v1/messages', {
              model: claudeModel,
              max_tokens: maxOutputTokens || 4096,
              messages: [{ role: "user", content: userPrompt }]
            }, {
              headers: {
                'x-api-key': claudeKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
              },
              timeout: 300000
            })
          );
        
          // Verificar se há erro na resposta da Claude
          if (response.data?.error) {
            console.error('❌ Erro retornado pela Claude:', JSON.stringify(response.data.error, null, 2));
            throw new Error(`Erro da Claude: ${response.data.error.message || JSON.stringify(response.data.error)}`);
          }
          
          // Verificar estrutura da resposta
          if (!response.data?.content || !Array.isArray(response.data.content) || response.data.content.length === 0) {
            console.error('❌ Resposta da Claude com estrutura inválida:', JSON.stringify(response.data, null, 2));
            throw new Error("Resposta da Claude com estrutura inválida.");
          }
          
          const text = response.data.content[0]?.text?.trim();
          if (!text) {
            console.error('❌ Resposta da Claude sem texto:', JSON.stringify(response.data, null, 2));
            throw new Error("Resposta vazia da Claude.");
          }
        
          console.log(`✅ Claude retornou ${text.length} caracteres`);
          
          // Tentar parsear como JSON se schema foi solicitado
          if (schema) {
            try {
              // Tentar parsear diretamente
              let parsed = JSON.parse(text);
              result = { data: parsed };
            } catch (e) {
              // Se falhar, tentar extrair JSON de markdown ou texto
              try {
                // Remover markdown code blocks se existirem
                let cleanedText = text.trim();
                cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                // Tentar encontrar JSON no texto
                const jsonMatch = cleanedText.match(/\{[\s\S]*\}/) || cleanedText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  result = { data: JSON.parse(jsonMatch[0]) };
                } else {
                  result = { data: cleanedText };
                }
              } catch (e2) {
                console.warn('⚠️ Não foi possível parsear JSON do Claude:', e2.message);
                result = { data: text };
              }
            }
          } else {
            result = { data: text };
          }
          
          apiSource = `Claude (${apiModelName || model})`;
        } catch (apiError) {
          // Tratar erros específicos da API da Claude
          if (apiError.response) {
            const status = apiError.response.status;
            const errorData = apiError.response.data;
            console.error(`❌ Erro HTTP ${status} da Claude:`, JSON.stringify(errorData, null, 2));
            
            if (status === 400) {
              const errorMsg = errorData?.error?.message || errorData?.error || JSON.stringify(errorData);
              throw new Error(`Erro 400 da Claude: ${errorMsg}. Verifique o prompt e o schema.`);
            } else if (status === 401) {
              throw new Error("Chave de API Claude inválida ou expirada.");
            } else if (status === 429) {
              throw new Error("Limite de requisições da Claude excedido. Tente novamente em alguns instantes.");
            } else {
              throw new Error(`Erro ${status} da Claude: ${errorData?.error?.message || JSON.stringify(errorData)}`);
            }
          } else {
            // Erro de rede ou outro tipo
            console.error('❌ Erro ao chamar Claude:', apiError.message);
            throw apiError;
          }
        }
        
      } else {
        const missingKey = isClaude ? 'Claude (Anthropic)' : isGPT ? 'OpenAI (GPT)' : 'Gemini';
        throw new Error(`❌ Chave de API do ${missingKey} não configurada. Por favor, configure sua chave nas Configurações.`);
      }
      
      res.json({ 
        ...result,
        apiSource,
        model: apiModelName || model
      });
      
  } catch (error) {
      console.error(`❌ Erro na geração legada (modelo: ${model}, apiModelName: ${apiModelName}):`, error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
    
  } catch (err) {
    console.error("❌ ERRO /api/generate-legacy:", err);
    console.error('Stack trace completo:', err.stack);
    res.status(500).json({ 
      error: err.message || "Erro ao gerar conteúdo",
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ==========================
// ENDPOINT DE STREAMING LEGADO (formato antigo com stream: true)
// ==========================
app.post('/api/generate-stream', verifyToken, async (req, res) => {
  try {
    const { prompt, model, stream, maxOutputTokens, temperature, schema } = req.body;
    
    if (!prompt || !model) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: prompt, model' });
    }
    
    if (!stream) {
      // Se não for streaming, redirecionar para endpoint legado normal
      return res.redirect(307, '/api/generate-legacy');
    }
    
    // Buscar configurações do usuário
    const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
    if (!userSettingsRow) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }
    
    const userSettings = userSettingsRow.settings ? JSON.parse(userSettingsRow.settings) : {};
    const geminiKeys = (Array.isArray(userSettings.gemini) ? userSettings.gemini : [userSettings.gemini])
      .filter(k => k && typeof k === 'string' && k.trim() !== '');
    const gptKey = (userSettings.gpt || '').trim();
    const claudeKey = (userSettings.claude || '').trim();
    
    // Normalizar nome do modelo para a API
    // Mapeia nomes amigáveis para nomes exatos das APIs (duplicado para manter isolamento)
    const normalizeModelName = (modelName) => {
      if (!modelName) return modelName;
      const modelLower = modelName.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '');
      
      // Gemini 2.5 (verificar ordem específica para evitar conflitos)
      if (modelLower.includes('gemini-2.5-flash-lite') || modelLower.includes('gemini-25-flash-lite') || modelLower.includes('flash-lite')) return 'gemini-2.5-flash-lite';
      if (modelLower.includes('gemini-2.5-pro') || modelLower.includes('gemini-25-pro')) return 'gemini-2.5-pro';
      if (modelLower.includes('gemini-2.5-flash') || modelLower.includes('gemini-25-flash')) return 'gemini-2.5-flash';
      if (modelLower.includes('gemini-2.0-flash-exp')) return 'gemini-2.5-flash';
      
      // Gemini 1.5
      if (modelLower.includes('gemini-1.5-pro') || modelLower.includes('gemini-15-pro')) return 'gemini-1.5-pro';
      if (modelLower.includes('gemini-1.5-flash') || modelLower.includes('gemini-15-flash')) return 'gemini-1.5-flash';
      
      // Gemini genérico
      if (modelLower.includes('gemini')) {
        if (modelLower.includes('pro')) return 'gemini-2.5-pro';
        if (modelLower.includes('flash')) return 'gemini-2.5-flash';
        return 'gemini-2.5-flash';
      }
      
      // OpenAI GPT
      if (modelLower.includes('gpt-5.1') || modelLower.includes('gpt-51') || modelLower.includes('gpt5')) return 'gpt-5.1';
      if (modelLower.includes('gpt-4o')) return 'gpt-4o';
      if (modelLower.includes('gpt-4-turbo') || modelLower.includes('gpt4-turbo')) return 'gpt-4-turbo';
      if (modelLower.includes('gpt-4')) return 'gpt-4-turbo';
      if (modelLower.includes('gpt-3.5') || modelLower.includes('gpt-35')) return 'gpt-3.5-turbo';
      
      // Claude
      if (modelLower.includes('claude-sonnet-4.5') || modelLower.includes('claude-sonnet-45') || modelLower.includes('sonnet-4.5')) return 'claude-sonnet-4-20250514';
      if (modelLower.includes('claude-sonnet-4') || modelLower.includes('sonnet-4')) return 'claude-sonnet-4-20250514';
      if (modelLower.includes('claude-3-5-sonnet') || modelLower.includes('claude-35-sonnet')) return 'claude-sonnet-4-20250514';
      if (modelLower.includes('claude-3-5-haiku') || modelLower.includes('claude-35-haiku')) return 'claude-3-5-haiku-20241022';
      if (modelLower.includes('claude-3-opus')) return 'claude-3-opus-20240229';
      if (modelLower.includes('claude-3-sonnet')) return 'claude-3-sonnet-20240229';
      if (modelLower.includes('claude')) return 'claude-sonnet-4-20250514';
      
      // Fallback
      return modelName.replace(/\s+/g, '-').replace(/_/g, '-').toLowerCase();
    };
    
    const apiModelName = normalizeModelName(model);
    
    // Determinar provider
    const modelLower = model.toLowerCase();
    const isGemini = modelLower.includes('gemini');
    const isGPT = modelLower.startsWith('gpt-') || modelLower.includes('gpt');
    const isClaude = modelLower.startsWith('claude');
    
    // Configurar headers para streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    let apiResponseStream;
    
    try {
      if (isGemini && geminiKeys.length > 0) {
        const geminiKey = geminiKeys[0];
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelName}:streamGenerateContent?key=${geminiKey}&alt=sse`;
        
        console.log(`🔵 [Stream] Chamando Gemini: ${apiModelName}`);
        console.log(`🔵 [Stream] URL: ${apiUrl.replace(/\?key=.*/, '?key=***')}`);
        console.log(`🔵 [Stream] Prompt tamanho: ${prompt.length} caracteres`);
        
        // Avisar se o prompt for muito longo (pode causar problemas com streaming)
        if (prompt.length > 50000) {
          console.warn(`⚠️ [Stream] Prompt muito longo (${prompt.length} chars). O Gemini pode ter problemas com prompts muito grandes.`);
        } else if (prompt.length > 20000) {
          console.log(`ℹ️ [Stream] Prompt grande (${prompt.length} chars). Isso pode demorar mais.`);
        }
        
        const generationConfig = {
          maxOutputTokens: maxOutputTokens || 8192,
          temperature: temperature !== undefined ? temperature : 0.7
        };
        
        if (schema) {
          generationConfig.response_mime_type = "application/json";
          generationConfig.response_schema = schema;
        }
        
        try {
          const response = await callApiWithRetries(() =>
            axios.post(apiUrl, {
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig
            }, {
              headers: {
                'Content-Type': 'application/json'
              },
              responseType: 'stream',
              timeout: 300000,
              validateStatus: function (status) {
                return status < 500; // Resolver apenas para status < 500
              }
            })
          );
          
          // Verificar se a resposta tem erro
          if (response.status >= 400) {
            // Tentar ler o erro do stream
            let errorData = '';
            response.data.on('data', (chunk) => {
              errorData += chunk.toString();
            });
            
            await new Promise((resolve) => {
              response.data.on('end', resolve);
            });
            
            let errorMessage = 'Erro desconhecido da API Gemini';
            try {
              const parsedError = JSON.parse(errorData);
              errorMessage = parsedError.error?.message || errorData || errorMessage;
            } catch (e) {
              errorMessage = errorData || errorMessage;
            }
            
            console.error(`❌ [Gemini Stream] Erro HTTP ${response.status}:`, errorMessage);
            throw new Error(`Erro da API Gemini (${response.status}): ${errorMessage}`);
          }
          
          // Verificar headers da resposta para debug
          if (isGemini && response.headers) {
            console.log(`🔵 [Gemini Stream] Headers da resposta:`, {
              'content-type': response.headers['content-type'],
              'content-length': response.headers['content-length'],
              'transfer-encoding': response.headers['transfer-encoding'],
              'x-goog-api-client': response.headers['x-goog-api-client']?.substring(0, 50)
            });
            
            // Se content-length é 0, a resposta está vazia
            if (response.headers['content-length'] === '0') {
              console.error(`❌ [Gemini Stream] Content-Length é 0 - resposta vazia!`);
            }
          }
          
          apiResponseStream = response.data;
          console.log(`✅ [Gemini Stream] Stream criado com sucesso - Status: ${response.status}`);
          
          // Verificar se o stream tem event listeners configurados
          if (apiResponseStream && typeof apiResponseStream.on === 'function') {
            console.log(`✅ [Gemini Stream] Stream tem suporte para eventos (on)`);
          } else {
            console.error(`❌ [Gemini Stream] Stream não tem suporte para eventos!`);
          }
        } catch (error) {
          console.error(`❌ [Gemini Stream] Erro ao criar stream:`, error.message);
          if (error.response) {
            // Tentar ler erro da resposta
            let errorData = '';
            if (error.response.data) {
              if (typeof error.response.data === 'string') {
                errorData = error.response.data;
              } else if (error.response.data.on) {
                // Stream de erro
                error.response.data.on('data', (chunk) => {
                  errorData += chunk.toString();
                });
                await new Promise((resolve) => {
                  error.response.data.on('end', resolve);
                  setTimeout(resolve, 1000); // Timeout de 1s
                });
              }
            }
            
            try {
              const parsedError = JSON.parse(errorData);
              error.message = parsedError.error?.message || error.message;
            } catch (e) {
              if (errorData) error.message = errorData;
            }
          }
          throw error;
        }
        
      } else if (isGPT && gptKey) {
        const body = {
          model: model,
          messages: [{ role: "user", content: prompt }],
          stream: true
        };
        
        if (maxOutputTokens) body.max_tokens = maxOutputTokens;
        if (temperature !== undefined) body.temperature = temperature;
        
        if (schema) {
          body.messages[0].content += `\n\nRESPONDA APENAS COM JSON VÁLIDO no seguinte formato:\n${JSON.stringify(schema, null, 2)}`;
        }
        
        const response = await callApiWithRetries(() =>
          axios.post('https://api.openai.com/v1/chat/completions', body, {
            headers: {
              'Authorization': `Bearer ${gptKey}`,
              'Content-Type': 'application/json'
            },
            responseType: 'stream',
            timeout: 300000
          })
        );
        
        apiResponseStream = response.data;
        
      } else if (isClaude && claudeKey) {
        // Normalizar modelo Claude para streaming (mesma lógica do /api/generate-legacy)
        let claudeModel = apiModelName;
        if (!claudeModel || !claudeModel.startsWith('claude-')) {
          const modelLower = model.toLowerCase();
          if (modelLower.includes('sonnet-4.5') || modelLower.includes('sonnet4.5')) {
            claudeModel = 'claude-sonnet-4-20250514';
          } else if (modelLower.includes('sonnet-4') || modelLower.includes('sonnet4')) {
            claudeModel = 'claude-sonnet-4-20250514';
          } else if (modelLower.includes('sonnet')) {
            claudeModel = 'claude-sonnet-4-20250514';
          } else if (modelLower.includes('haiku')) {
            claudeModel = 'claude-3-5-haiku-20241022';
          } else {
            claudeModel = 'claude-sonnet-4-20250514'; // Default
          }
        }
        
        console.log(`🟣 Chamando Claude (streaming): ${claudeModel}`);
        
        // Para Claude, colocar tudo no user message (mesma lógica que funciona no Criador de Roteiro)
        let userPrompt = prompt;
        if (schema) {
          userPrompt = prompt + `\n\nIMPORTANTE: Você DEVE responder APENAS com JSON válido seguindo EXATAMENTE este formato:\n${JSON.stringify(schema, null, 2)}\n\nNÃO inclua markdown, explicações ou texto adicional. Apenas o JSON.`;
        }
        
        const body = {
          model: claudeModel,
          max_tokens: maxOutputTokens || 4096,
          messages: [{ role: "user", content: userPrompt }],
          stream: true
        };
        
        if (temperature !== undefined) body.temperature = temperature;
        
        // Log do tamanho do prompt para debug
        console.log(`📏 Tamanho do prompt Claude (streaming): ${userPrompt.length} caracteres`);
        if (userPrompt.length > 200000) {
          console.warn(`⚠️ Prompt muito longo para Claude (${userPrompt.length} chars). Limite recomendado: 200k`);
        }
        
        try {
          const response = await callApiWithRetries(() =>
            axios.post('https://api.anthropic.com/v1/messages', body, {
              headers: {
                'x-api-key': claudeKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
              },
              responseType: 'stream',
              timeout: 300000
            })
          );
          
          apiResponseStream = response.data;
        } catch (apiError) {
          // Tratar erros específicos da API da Claude no streaming
          if (apiError.response) {
            const status = apiError.response.status;
            const errorData = apiError.response.data;
            console.error(`❌ Erro HTTP ${status} da Claude (streaming):`, JSON.stringify(errorData, null, 2));
            
            if (status === 400) {
              const errorMsg = errorData?.error?.message || errorData?.error || JSON.stringify(errorData);
              throw new Error(`Erro 400 da Claude: ${errorMsg}. Verifique o prompt e o schema.`);
            } else if (status === 401) {
              throw new Error("Chave de API Claude inválida ou expirada.");
            } else if (status === 429) {
              throw new Error("Limite de requisições da Claude excedido. Tente novamente em alguns instantes.");
            } else {
              throw new Error(`Erro ${status} da Claude: ${errorData?.error?.message || JSON.stringify(errorData)}`);
            }
          } else {
            // Erro de rede ou outro tipo
            console.error('❌ Erro ao chamar Claude (streaming):', apiError.message);
            throw apiError;
          }
        }
        
    } else {
        res.write(`data: ${JSON.stringify({ error: "Nenhuma chave de API disponível para o modelo selecionado." })}\n\n`);
        res.end();
        return;
    }

      // Pipe do stream da API para o cliente
      // Gemini já envia SSE no formato correto (data: {...}), então podemos fazer pipe direto
      let hasReceivedData = false;
      let chunkCount = 0;
      let totalBytes = 0;
      let streamError = null;
      
      // Log quando o stream é criado
      if (isGemini) {
        console.log(`🔵 [Gemini Stream] Stream criado, aguardando dados...`);
        console.log(`🔵 [Gemini Stream] Stream pausado: ${apiResponseStream.isPaused?.() || 'N/A'}`);
        
        // Tentar resumir o stream se estiver pausado
        if (apiResponseStream.resume && typeof apiResponseStream.resume === 'function') {
          apiResponseStream.resume();
          console.log(`🔵 [Gemini Stream] Stream.resume() chamado`);
        }
        
        // Verificar se o stream tem dados para ler
        if (apiResponseStream.readable) {
          console.log(`✅ [Gemini Stream] Stream é legível (readable)`);
        } else {
          console.warn(`⚠️ [Gemini Stream] Stream não é legível (readable = false)`);
        }
      }
      
      // Listener para dados
      apiResponseStream.on('data', (chunk) => {
        chunkCount++;
        const chunkStr = chunk.toString();
        totalBytes += chunk.length;
        
        // Log primeiro chunk para debug (apenas para Gemini)
        if (isGemini && chunkCount === 1) {
          console.log(`🔵 [Gemini Stream] Primeiro chunk recebido! (${chunkStr.length} bytes)`);
          console.log(`🔵 [Gemini Stream] Conteúdo (primeiros 500 chars):`, chunkStr.substring(0, 500));
        }
        
        // Verificar se há dados válidos no chunk
        if (chunkStr.includes('candidates') || chunkStr.includes('data:') || chunkStr.includes('text')) {
          hasReceivedData = true;
          if (isGemini && chunkCount <= 3) {
            console.log(`✅ [Gemini Stream] Chunk ${chunkCount} contém dados válidos`);
          }
        }
        
        // Enviar chunk para o cliente
        try {
          res.write(chunk);
        } catch (writeError) {
          console.error(`❌ [Gemini Stream] Erro ao escrever chunk ${chunkCount}:`, writeError.message);
        }
      });
      
      // Listener para dados legíveis (readable)
      if (isGemini) {
        apiResponseStream.on('readable', () => {
          console.log(`📖 [Gemini Stream] Stream se tornou legível`);
          let chunk;
          while (null !== (chunk = apiResponseStream.read())) {
            chunkCount++;
            const chunkStr = chunk.toString();
            totalBytes += chunk.length;
            
            if (chunkCount === 1) {
              console.log(`🔵 [Gemini Stream] Primeiro chunk via readable! (${chunkStr.length} bytes)`);
              console.log(`🔵 [Gemini Stream] Conteúdo (primeiros 500 chars):`, chunkStr.substring(0, 500));
            }
            
            if (chunkStr.includes('candidates') || chunkStr.includes('data:') || chunkStr.includes('text')) {
              hasReceivedData = true;
            }
            
            try {
              res.write(chunk);
            } catch (writeError) {
              console.error(`❌ [Gemini Stream] Erro ao escrever chunk ${chunkCount}:`, writeError.message);
            }
          }
        });
      }

      apiResponseStream.on('end', () => {
        console.log(`🔵 [Gemini Stream] Stream finalizado para modelo ${apiModelName}`);
        console.log(`🔵 [Gemini Stream] Estatísticas - Total chunks: ${chunkCount}, Total bytes: ${totalBytes}, Dados recebidos: ${hasReceivedData ? 'SIM' : 'NÃO'}`);
        
        if (streamError) {
          console.error(`❌ [Gemini Stream] Erro no stream:`, streamError.message);
        }
        
        if (chunkCount === 0 && isGemini) {
          console.error(`❌ [Gemini Stream] ATENÇÃO: Nenhum chunk foi recebido!`);
          console.error(`❌ [Gemini Stream] Isso pode indicar:`);
          console.error(`   - Problema com a API do Gemini`);
          console.error(`   - Chave de API inválida ou expirada`);
          console.error(`   - Prompt bloqueado por políticas de segurança`);
          console.error(`   - Prompt muito longo (${prompt.length} caracteres)`);
          
          const errorMsg = streamError 
            ? `Erro da API Gemini: ${streamError.message}`
            : "Nenhum dado recebido da API Gemini. Verifique a chave de API e tente novamente.";
          
          res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
        }
        
        // Para Gemini, verificar se já veio [DONE] no stream
        // Se não, adicionar para garantir que o cliente saiba que terminou
        res.write('data: [DONE]\n\n');
        res.end();
      });
      
      apiResponseStream.on('error', (error) => {
        streamError = error;
        console.error('❌ [Stream] Erro no stream:', error.message);
        console.error('❌ [Stream] Erro completo:', error);
        if (error.response) {
          console.error('❌ [Stream] Status HTTP:', error.response.status);
          console.error('❌ [Stream] Headers:', error.response.headers);
        }
        
        let errorMessage = error.message || 'Erro desconhecido no stream';
        if (error.response) {
          errorMessage = `Erro HTTP ${error.response.status}: ${errorMessage}`;
        }
        
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      });
      
      // Limpar stream se cliente desconectar
      req.on('close', () => {
        if (apiResponseStream && typeof apiResponseStream.destroy === 'function') {
          apiResponseStream.destroy();
        }
      });
      
    } catch (error) {
      console.error(`❌ Erro no streaming (modelo: ${model}):`, error.message);
      res.write(`data: ${JSON.stringify({ error: error.message || "Erro ao gerar conteúdo" })}\n\n`);
      res.end();
    }
    
  } catch (err) {
    console.error("❌ ERRO /api/generate-stream:", err);
    res.write(`data: ${JSON.stringify({ error: err.message || "Erro ao gerar conteúdo" })}\n\n`);
    res.end();
  }
});

// ==========================
// ENDPOINT ESPECÍFICO PARA GERAÇÃO DE PROMPTS DE CENA
// ==========================
app.post('/api/generate-scene-prompts', verifyToken, async (req, res) => {
  try {
    const { modelo, roteiro, cenas } = req.body;
    
    if (!modelo || !roteiro || !cenas) {
      return res.status(400).json({ 
        ok: false, 
        error: "Parâmetros obrigatórios: modelo, roteiro, cenas" 
      });
    }
    
    // Obter chaves de API do usuário
    const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
    if (!userSettingsRow) {
      return res.status(404).json({ ok: false, error: 'Utilizador não encontrado.' });
    }
    
    const userSettings = userSettingsRow.settings ? JSON.parse(userSettingsRow.settings) : {};
    const claudeKey = userSettings.claude;
    const gptKey = userSettings.gpt;
    const geminiKeys = (Array.isArray(userSettings.gemini) ? userSettings.gemini : [userSettings.gemini]).filter(k => k && k.trim() !== '');
    
    // Gerar com fallback automático
    const { modelo: modeloUsado, resultado } = await gerarComFallback({
      modelo,
      roteiro,
      totalCenas: cenas,
      geminiKeys,
      gptKey,
      claudeKey,
      schema: true // Sempre usar schema JSON
    });
    
    // Parsear JSON da resposta usando a mesma lógica do /api/generate-legacy para Gemini Pro
    let dados;
    const isProModel = modeloUsado.includes('gemini-2.5-pro') || 
                      modeloUsado.includes('gemini-1.5-pro');
    
    if (isProModel && modeloUsado.includes('gemini')) {
      // Para Gemini Pro, usar parseJsonRobustly e aplicar a mesma lógica do /api/generate-legacy
      let parsed = parseJsonRobustly(resultado, `Gemini Pro (${modeloUsado})`);
      
      // PRIMEIRO: Verificar se é objeto com propriedades específicas
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Se é objeto, manter como está (pode ter propriedades aninhadas)
        dados = parsed;
      }
      // SEGUNDO: Verificar se é array direto de prompts de cena
      else if (Array.isArray(parsed) && parsed.length > 0) {
        const firstItem = parsed[0];
        if (firstItem && (firstItem.prompt_text || firstItem.scene_description || firstItem.original_text)) {
          // É array de prompts de cena, manter como array
          dados = parsed;
        } else {
          dados = parsed;
        }
      } else {
        dados = parsed;
      }
    } else {
      // Para outros modelos (Flash não-Pro), usar parsing direto se possível, senão parseJsonRobustly
      try {
        dados = JSON.parse(resultado.trim());
      } catch (e) {
        dados = parseJsonRobustly(resultado, modeloUsado);
      }
    }
    
    res.json({ 
      ok: true, 
      data: dados,
      modelo: modeloUsado,
      apiSource: modeloUsado.startsWith('gpt') ? `OpenAI (${modeloUsado})` : 
                 modeloUsado.startsWith('claude') ? `Claude (${modeloUsado})` : 
                 `Gemini (${modeloUsado})`
    });
    
  } catch (err) {
    console.error("❌ ERRO /api/generate-scene-prompts:", err);
    res.status(500).json({ 
      ok: false, 
      error: err.message || "Erro ao gerar prompts de cena" 
    });
  }
});

const formatCookiesForImageFX = (cookieInput) => {
  if (!cookieInput || (typeof cookieInput === 'string' && cookieInput.trim() === '')) throw new Error("Dados de cookies ausentes ou vazios.");
  let finalCookieString = '';
  if (typeof cookieInput === 'string') {
    try {
      const parsed = JSON.parse(cookieInput);
      if (Array.isArray(parsed)) finalCookieString = parsed.map(c => `${c.name}=${c.value}`).join('; ');
      else if (typeof parsed === 'object' && parsed !== null) finalCookieString = Object.entries(parsed).map(([key, value]) => `${key}=${value}`).join('; ');
      else finalCookieString = cookieInput;
    } catch (e) { finalCookieString = cookieInput; }
  } else if (typeof cookieInput === 'object' && cookieInput !== null) {
    if (Array.isArray(cookieInput)) finalCookieString = cookieInput.map(c => `${c.name}=${c.value}`).join('; ');
    else finalCookieString = Object.entries(cookieInput).map(([key, value]) => `${key}=${value}`).join('; ');
  } else { throw new Error("Formato de cookies desconhecido."); }
  if (!finalCookieString.trim()) throw new Error("Os dados dos cookies resultaram numa string vazia.");
  return finalCookieString;
};

// Função para formatar cookies do Wisk (formato correto com _Secure-next-auth)
const formatCookiesForWisk = (cookieInput) => {
  if (!cookieInput || (typeof cookieInput === 'string' && cookieInput.trim() === '')) throw new Error("Dados de cookies ausentes ou vazios.");
  let finalCookieString = '';
  if (typeof cookieInput === 'string') {
    try {
      const parsed = JSON.parse(cookieInput);
      if (Array.isArray(parsed)) finalCookieString = parsed.map(c => `${c.name}=${c.value}`).join('; ');
      else if (typeof parsed === 'object' && parsed !== null) finalCookieString = Object.entries(parsed).map(([key, value]) => `${key}=${value}`).join('; ');
      else finalCookieString = cookieInput;
    } catch (e) { finalCookieString = cookieInput; }
  } else if (typeof cookieInput === 'object' && cookieInput !== null) {
    if (Array.isArray(cookieInput)) finalCookieString = cookieInput.map(c => `${c.name}=${c.value}`).join('; ');
    else finalCookieString = Object.entries(cookieInput).map(([key, value]) => `${key}=${value}`).join('; ');
  } else { throw new Error("Formato de cookies desconhecido."); }
  if (!finalCookieString.trim()) throw new Error("Os dados dos cookies resultaram numa string vazia.");
  
  // Garante que _Secure-next-auth.callback-url está presente quando _Secure-next-auth.session-token está presente
  // Formato correto conforme documentação: incluir callback-url quando usar session-token
  if (finalCookieString.includes('_Secure-next-auth.session-token') && !finalCookieString.includes('_Secure-next-auth.callback-url')) {
    finalCookieString += '; _Secure-next-auth.callback-url=https://labs.google';
  }
  
  return finalCookieString;
};

// Função formatCookiesForFlow removida - Flow não é mais usado

const getGeminiKeysFromSettings = (settings = {}) => {
  const raw = Array.isArray(settings.gemini) ? settings.gemini : [settings.gemini];
  return raw
    .map((key) => (typeof key === 'string' ? key.trim() : ''))
    .filter(Boolean);
};

const buildImagePromptForGeneration = ({ basePrompt, style, generationModel, negativePrompt }) => {
  let finalPrompt = (basePrompt || '').trim();
  if (!finalPrompt) {
    throw new Error('Prompt vazio.');
  }

  if (style && style !== 'none') {
    finalPrompt = `${style}, ${finalPrompt}`;
  }

  if (generationModel === 'IMAGEN_3_5') {
    finalPrompt += ', no text, no watermark, no logo';
  }

  if (negativePrompt && negativePrompt.trim()) {
    finalPrompt += `. Avoid: ${negativePrompt.trim()}`;
  }

  return finalPrompt;
};

const shouldAutoRewriteImagePrompt = (message = '') => {
  if (typeof message !== 'string') return false;
  const lowered = message.toLowerCase();
  return lowered.includes('prompt bloqueado') ||
         lowered.includes('conteúdo inseguro') ||
         lowered.includes('conteudo inseguro') ||
         lowered.includes('unsafe');
};

const derivePolicyGuidance = (message = '') => {
  if (typeof message !== 'string') return '';
  const lowered = message.toLowerCase();
  const guidance = [];

  if (lowered.includes('conteúdo inseguro') || lowered.includes('conteudo inseguro') || lowered.includes('unsafe')) {
    guidance.push('Remova qualquer descrição explícita de violência, ferimentos, armas, sangue, tortura, abuso ou situações ameaçadoras. Concentre-se em emoções sutis, narrativa e cenário de forma segura.');
  }
  if (lowered.includes('pessoas famosas') || lowered.includes('celebridade') || lowered.includes('figura pública') || lowered.includes('figura publica')) {
    guidance.push('Substitua referências a pessoas reais ou famosas por personagens genéricos sem nomes identificáveis. Evite qualquer menção a celebridades ou figuras públicas.');
  }
  if (lowered.includes('nudez') || lowered.includes('sexual')) {
    guidance.push('Elimine qualquer menção a nudez, conteúdo sexual ou insinuações. Mantenha a cena apropriada para todos os públicos.');
  }
  if (guidance.length === 0) {
    guidance.push('Certifique-se de que o prompt está totalmente em conformidade com as políticas: sem violência explícita, nudez, drogas, discursos de ódio, armas detalhadas ou pessoas identificáveis.');
  }

  return guidance.join(' ');
};

const createSafeFallbackPrompt = ({ basePrompt, previousPrompt, nextPrompt, violationMessage }) => {
  const normalize = (text = '') => text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  let safe = normalize(basePrompt);
  if (!safe || safe.length < 10) {
    safe = 'a calm everyday scene with everyday people';
  }

  const bannedWordMap = {
    'famous': 'generic',
    'celebrity': 'anonymous',
    'actor': 'anonymous',
    'actress': 'anonymous',
    'president': 'leader',
    'king': 'person',
    'queen': 'person',
    'politician': 'official',
    'gun': '',
    'knife': '',
    'rifle': '',
    'weapon': '',
    'blood': '',
    'violence': '',
    'violent': '',
    'murder': '',
    'kill': '',
    'dead': '',
    'corpse': '',
    'body': '',
    'terror': '',
    'army': ''
  };

  const bannedRegex = new RegExp(`\\b(${Object.keys(bannedWordMap).join('|')})\\b`, 'gi');
  safe = safe.replace(bannedRegex, (match) => bannedWordMap[match.toLowerCase()] ?? '');
  safe = safe.replace(/\s{2,}/g, ' ').trim();

  const contextParts = [];
  if (previousPrompt) {
    contextParts.push(`Maintain continuity with the previous safe scene which showed ${normalize(previousPrompt)}`);
  }
  if (nextPrompt) {
    contextParts.push(`Prepare the visual transition towards the upcoming scene about ${normalize(nextPrompt)}`);
  }

  contextParts.push(`Focus on ${safe} with anonymous fictional characters only, no references to real people or celebrities, strictly wholesome tone`);
  contextParts.push('Ultra realistic photography, natural lighting, documentary style, heartfelt but safe atmosphere');
  contextParts.push('Absolutely no violence, no weapons, no explicit content, no political or public figures, no controversial symbols');

  if (violationMessage) {
    contextParts.push(`Reason detected previously: ${violationMessage.toLowerCase()}. Make sure the new description avoids that completely.`);
  }

  return contextParts.join('. ');
};

app.post('/api/validate-api-keys', verifyToken, async (req, res) => {
  const { claude, gemini, gpt, imagefx_cookies } = req.body;
  // Timeout aumentado para VPS (latência maior) - 20 segundos
  const validationTimeout = 20000;
  
  // Detecta se está rodando em VPS/produção
  const isProduction = process.env.NODE_ENV === 'production' || process.env.PORT;
  console.log(`🔍 Iniciando validação de chaves API... (Ambiente: ${isProduction ? 'VPS/Produção' : 'Local'}, Timeout: ${validationTimeout}ms)`);
  
  // Validar todas as chaves em paralelo para ser mais rápido
  const validationPromises = [];
  
  // Validação Claude
  let claude_valid = false;
  if (claude && claude.trim() !== '') {
    const claudeKey = claude.trim();
    validationPromises.push(
      (async () => {
        try {
          // Tentar com modelo mais recente primeiro
          const response = await axios.post('https://api.anthropic.com/v1/messages', 
            { 
              model: "claude-3-5-haiku-20241022", 
              max_tokens: 10, 
              messages: [{ role: "user", content: "hi" }] 
            },
            { 
              headers: { 
                'x-api-key': claudeKey, 
                'anthropic-version': '2023-06-01', 
                'Content-Type': 'application/json'
              }, 
              timeout: validationTimeout
            }
          );
          
          if (response.status === 200 && response.data) {
            claude_valid = true;
            console.log('✅ Claude: válida');
          } else {
            console.warn(`❌ Claude: resposta inválida (status ${response.status})`);
          }
        } catch (error) {
          // Se falhar com o modelo novo, tentar com modelo antigo
          try {
            const response = await axios.post('https://api.anthropic.com/v1/messages', 
              { 
                model: "claude-3-haiku-20240307", 
                max_tokens: 10, 
                messages: [{ role: "user", content: "hi" }] 
              },
              { 
                headers: { 
                  'x-api-key': claudeKey, 
                  'anthropic-version': '2023-06-01', 
                  'Content-Type': 'application/json'
                }, 
                timeout: validationTimeout
              }
            );
            
            if (response.status === 200 && response.data) {
              claude_valid = true;
              console.log('✅ Claude: válida (modelo antigo)');
            }
          } catch (fallbackError) {
            const errorMsg = error.response?.data?.error?.message || error.message || 'Erro desconhecido';
            const status = error.response?.status || error.code || 'N/A';
            console.warn(`❌ Claude: inválida (Status: ${status}, Erro: ${errorMsg.substring(0, 100)})`);
            if (isProduction) {
              console.warn(`   Detalhes VPS: ${error.code || 'N/A'} - ${error.message?.substring(0, 150)}`);
            }
          }
        }
      })()
    );
  }

  // Validação Gemini (tenta ambos os endpoints)
  let gemini_valid = false;
  let youtube_key_valid = false;
  if (Array.isArray(gemini) && gemini.length > 0 && gemini[0] && gemini[0].trim() !== '') {
    const key = gemini[0].trim();
    console.log(`🔍 Validando Gemini (primeiros 15 chars: ${key.substring(0, 15)}...)`);
    
    validationPromises.push(
      (async () => {
        // Usar o SDK como método principal (mesmo usado no resto do sistema)
        const modelsToTry = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        
        for (const modelName of modelsToTry) {
          try {
            console.log(`📡 Testando modelo ${modelName} com SDK...`);
            
            // Timeout customizado para SDK (cria uma Promise com timeout)
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout na validação Gemini')), validationTimeout)
            );
            
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ 
              model: modelName,
              // Configurações adicionais para VPS
              generationConfig: {
                maxOutputTokens: 10,
                temperature: 0.1
              }
            });
            
            const result = await Promise.race([
              model.generateContent('test'),
              timeoutPromise
            ]);
            
            const text = result.response?.text();
            
            if (text) {
              gemini_valid = true;
              console.log(`✅ Gemini: válida (modelo ${modelName})`);
              return;
            }
          } catch (error) {
            const errorMsg = error.message || 'Erro desconhecido';
            console.warn(`⚠️ Modelo ${modelName} falhou: ${errorMsg.substring(0, 150)}`);
            if (isProduction && error.code) {
              console.warn(`   Código de erro VPS: ${error.code}`);
            }
          }
        }
        
        console.error('❌ Gemini: nenhum modelo disponível funcionou');
      })()
    );
    
    // Teste YouTube (paralelo, independente)
    validationPromises.push(
      axios.get(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${key}`, { 
        timeout: validationTimeout,
        validateStatus: (status) => status < 500,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'DarkScript-Validator/1.0'
        }
      })
      .then((response) => {
        if (response.status === 200) {
          youtube_key_valid = true;
          console.log('✅ YouTube API: válida');
        }
      })
      .catch(error => {
        const status = error.response?.status || error.code || 'N/A';
        console.warn(`⚠️ YouTube API: inválida (Status: ${status})`);
        if (isProduction) {
          console.warn(`   Erro VPS: ${error.code || 'N/A'} - ${error.message?.substring(0, 100)}`);
        }
      })
    );
  }

  // Validação GPT
  let gpt_valid = false;
  if (gpt && gpt.trim() !== '') {
    validationPromises.push(
      axios.get('https://api.openai.com/v1/models', {
        headers: { 
          'Authorization': `Bearer ${gpt.trim()}`,
          'User-Agent': 'DarkScript-Validator/1.0'
        },
        timeout: validationTimeout,
        validateStatus: (status) => status < 500,
        maxRedirects: 5
      })
      .then((response) => {
        if (response.status === 200) {
          gpt_valid = true;
          console.log('✅ GPT: válida');
        } else {
          console.warn(`❌ GPT: resposta inválida (status ${response.status})`);
        }
      })
      .catch(error => {
        const errorMsg = error.response?.data?.error?.message || error.message || 'Erro desconhecido';
        const status = error.response?.status || error.code || 'N/A';
        console.warn(`❌ GPT: inválida (Status: ${status}, Erro: ${errorMsg.substring(0, 100)})`);
        if (isProduction) {
          console.warn(`   Detalhes VPS: ${error.code || 'N/A'} - ${error.message?.substring(0, 150)}`);
        }
      })
    );
  }

  // Validação ImageFX
  let imagefx_cookies_valid = false;
  if (imagefx_cookies && imagefx_cookies.trim() !== '') {
    validationPromises.push(
      (async () => {
        try {
          const formattedCookieString = formatCookiesForImageFX(imagefx_cookies);
          if (formattedCookieString.length > 0) {
            const tempAccount = new Account(formattedCookieString);
            await Promise.race([
              tempAccount.refreshSession(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na validação ImageFX')), validationTimeout))
            ]);
            imagefx_cookies_valid = true;
            console.log('✅ ImageFX: válido');
          }
        } catch (error) {
          const errorMsg = error.message || 'Erro desconhecido';
          console.warn(`❌ ImageFX: inválido (${errorMsg.substring(0, 150)})`);
          if (isProduction) {
            console.warn(`   Stack VPS: ${error.stack?.substring(0, 200)}`);
          }
        }
      })()
    );
  }

  // Aguardar todas as validações em paralelo
  await Promise.allSettled(validationPromises);
  
  console.log('📊 Resultado final:', {
    claude: claude_valid ? '✅' : '❌',
    gemini: gemini_valid ? '✅' : '❌',
    gpt: gpt_valid ? '✅' : '❌',
    imagefx: imagefx_cookies_valid ? '✅' : '❌',
    youtube: youtube_key_valid ? '✅' : '❌'
  });

  res.json({ 
    claude_valid, 
    gemini_valid, 
    gpt_valid, 
    imagefx_cookies_valid, 
    youtube_key_valid 
  });
});

const translateImageFXError = (error) => {
    const message = (error.message || '').toLowerCase();

    if (message.includes('prompt bloqueado')) {
        return error.message; // Keep the specific "Prompt bloqueado" message from imagefx.js
    }
    if (message.includes('autenticação') || message.includes('authentication')) {
        return 'Falha na autenticação. Seus cookies do ImageFX podem ter expirado ou são inválidos.';
    }
    if (message.includes('429') || message.includes('limite de requisições')) {
        return 'Limite de requisições do ImageFX atingido. Tente novamente em alguns minutos.';
    }
    if (message.includes('internal error') || message.includes('erro interno')) {
        return 'O ImageFX encontrou um erro interno. Isso pode ser temporário. Tente gerar novamente.';
    }
    if (message.includes('unexpected')) {
        return 'Ocorreu um erro inesperado no ImageFX. Tente gerar novamente.';
    }

    // Fallback for any other error, but we try to be more specific
    console.error("Unknown ImageFX Error to translate:", error.message);
    return `Erro no ImageFX: ${error.message || 'Erro desconhecido.'}`;
};

app.post('/api/imagefx/generate', verifyToken, async (req, res) => {
  const { prompts, negative_prompt, aspect_ratio, style, num_images = 1, generation_model } = req.body;

  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) return res.status(400).json({ message: "Os prompts são obrigatórios." });
  if (!generation_model) return res.status(400).json({ message: "O modelo de geração é obrigatório." });

  try {
    const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
    const userSettings = JSON.parse(userSettingsRow?.settings || '{}');
    const cookieStringFromSettings = userSettings.imagefx_cookies;

    if (!cookieStringFromSettings || (typeof cookieStringFromSettings === 'string' && cookieStringFromSettings.trim() === '')) return res.status(400).json({ message: "Configure os cookies do ImageFX." });

    const cookiesForImageFX = formatCookiesForImageFX(cookieStringFromSettings);
    const aspectRatioMap = { '1:1': AspectRatio.SQUARE, '16:9': AspectRatio.LANDSCAPE, '9:16': AspectRatio.PORTRAIT };
    const imageFX = new ImageFX(cookiesForImageFX);
    const allGeneratedImages = [];
    const geminiKeys = getGeminiKeysFromSettings(userSettings);
    const rewriteSupportAvailable = Boolean(
        (typeof userSettings.claude === 'string' && userSettings.claude.trim()) ||
        (typeof userSettings.gpt === 'string' && userSettings.gpt.trim()) ||
        geminiKeys.length > 0
    );
    let lastSuccessfulPromptForContext = null;
    let lastSuccessfulSanitizedPromptForContext = null;

    for (const [index, prompt] of prompts.entries()) {
      const sceneNumberForThisPrompt = index + 1;
      const basePrompt = typeof prompt === 'string' ? prompt.trim() : '';
      const nextPlannedPrompt = prompts[index + 1];

      try {
        const finalPrompt = buildImagePromptForGeneration({
            basePrompt,
            style,
            generationModel: generation_model,
            negativePrompt: negative_prompt
        });

        const options = {
            numberOfImages: Math.min(parseInt(num_images, 10) || 1, 4),
            aspectRatio: aspectRatioMap[aspect_ratio] || AspectRatio.SQUARE,
            generationModel: generation_model,
            seed: Math.floor(Math.random() * 1000000),
            retries: 2
        };
        const generatedImages = await imageFX.generateImage(finalPrompt, options);

        const imageResults = generatedImages.map(img => ({
          status: 'success',
          url: img.url,
          prompt: img.prompt,
          mediaId: img.mediaId,
          seed: img.seed,
          sceneNumber: sceneNumberForThisPrompt,
          aspectRatio: aspect_ratio,
          wasRewritten: false,
          sanitizedPrompt: img.sanitizedPrompt,
          wasSanitized: img.wasSanitized,
          alerts: img.alerts
        }));

        allGeneratedImages.push(...imageResults);
        if (imageResults[0]?.prompt) {
            lastSuccessfulPromptForContext = imageResults[0].prompt;
            lastSuccessfulSanitizedPromptForContext = imageResults[0].sanitizedPrompt || imageResults[0].prompt;
        }
      } catch (error) {
          console.error(`Erro na geração ImageFX para o prompt ${index + 1}:`, error.stack || error);
          const userFriendlyMessage = translateImageFXError(error);
          let autoRewriteAttempted = false;
          let autoRewriteErrorMessage = null;

          if (rewriteSupportAvailable && shouldAutoRewriteImagePrompt(userFriendlyMessage)) {
              autoRewriteAttempted = true;
              try {
                  let dynamicPolicyGuidance = derivePolicyGuidance(userFriendlyMessage);
                  let rewriteSuccess = false;
                  let lastRewriteError = null;

                  for (let attempt = 0; attempt < MAX_AUTO_REWRITE_ATTEMPTS && !rewriteSuccess; attempt++) {
                      try {
                          const contextSegments = [];
                          if (lastSuccessfulSanitizedPromptForContext || lastSuccessfulPromptForContext) {
                              contextSegments.push(`Última cena aprovada (prompt sanitizado): ${lastSuccessfulSanitizedPromptForContext || lastSuccessfulPromptForContext}`);
                          }
                          if (nextPlannedPrompt) {
                              contextSegments.push(`Próxima cena planejada: ${nextPlannedPrompt}`);
                          }
                          if (style && style !== 'none') {
                              contextSegments.push(`Estilo definido pelo usuário: ${style}`);
                          } else {
                              contextSegments.push('Estilo definido pelo usuário: fotografia realista');
                          }
                          contextSegments.push(`Cena atual desejada (prompt original bloqueado): ${basePrompt}`);
                          contextSegments.push('Mantenha o estilo fotográfico realista, com iluminação, composição e textura coerentes com as cenas aprovadas. Não altere a estética para desenho, pintura ou 3D.');
                          contextSegments.push('Remova termos que violem políticas (violência explícita, figuras públicas, nudez, armas realistas, drogas, autolesão, etc.). Foque em descrições seguras e sugeridas.');

                          if (attempt > 0) {
                              contextSegments.push('A tentativa anterior ainda violou as políticas. Seja ainda mais conservador, removendo qualquer detalhe potencialmente sensível e descrevendo a cena de forma neutra, focada em expressões e ambientes seguros.');
                          }

                          const rewriteContext = contextSegments.join('\n');
                          const rewriteResult = await rewriteImagePromptWithAi({
                              userSettings,
                              failedPrompt: basePrompt,
                              context: rewriteContext,
                              modelHint: null,
                              policyGuidance: dynamicPolicyGuidance
                          });

                          const rewrittenFinalPrompt = buildImagePromptForGeneration({
                              basePrompt: rewriteResult.newPrompt,
                              style,
                              generationModel: generation_model,
                              negativePrompt: negative_prompt
                          });

                          const retryOptions = {
                              numberOfImages: Math.min(parseInt(num_images, 10) || 1, 4),
                              aspectRatio: aspectRatioMap[aspect_ratio] || AspectRatio.SQUARE,
                              generationModel: generation_model,
                              seed: Math.floor(Math.random() * 1000000),
                              retries: 2
                          };

                          const rewrittenImagesRaw = await imageFX.generateImage(rewrittenFinalPrompt, retryOptions);
                          const rewrittenImageResults = rewrittenImagesRaw.map(img => ({
                              status: 'success',
                              url: img.url,
                              prompt: img.prompt,
                              mediaId: img.mediaId,
                              seed: img.seed,
                              sceneNumber: sceneNumberForThisPrompt,
                              aspectRatio: aspect_ratio,
                              wasRewritten: true,
                              originalPrompt: basePrompt,
                              rewriteSource: userFriendlyMessage,
                              rewriteModel: rewriteResult.modelUsed,
                              rewriteProvider: rewriteResult.provider,
                              sanitizedPrompt: img.sanitizedPrompt,
                              wasSanitized: img.wasSanitized,
                              alerts: img.alerts,
                              rawRewritePrompt: rewriteResult.rawResponse
                          }));

                          allGeneratedImages.push(...rewrittenImageResults);
                          if (rewrittenImageResults[0]?.prompt) {
                              lastSuccessfulPromptForContext = rewrittenImageResults[0].prompt;
                              lastSuccessfulSanitizedPromptForContext = rewrittenImageResults[0].sanitizedPrompt || rewrittenImageResults[0].prompt;
                          }
                          console.info(`Prompt da cena ${sceneNumberForThisPrompt} reescrito automaticamente com sucesso na tentativa ${attempt + 1}.`);
                          rewriteSuccess = true;
                      } catch (rewriteErr) {
                          const translatedMessage = rewriteErr instanceof ImageFXError
                              ? translateImageFXError(rewriteErr)
                              : (rewriteErr instanceof Error ? rewriteErr.message : String(rewriteErr));
                          const newGuidance = derivePolicyGuidance(translatedMessage);
                          if (newGuidance) {
                              dynamicPolicyGuidance = `${dynamicPolicyGuidance} ${newGuidance}`.trim();
                          }
                          lastRewriteError = new Error(translatedMessage);
                      }
                  }

                  if (rewriteSuccess) {
                      continue;
                  }

                  try {
                      const fallbackPromptBase = createSafeFallbackPrompt({
                          basePrompt,
                          previousPrompt: lastSuccessfulSanitizedPromptForContext || lastSuccessfulPromptForContext,
                          nextPrompt: nextPlannedPrompt,
                          violationMessage: userFriendlyMessage
                      });

                      const fallbackFinalPrompt = buildImagePromptForGeneration({
                          basePrompt: fallbackPromptBase,
                          style,
                          generationModel: generation_model,
                          negativePrompt: negative_prompt
                      });

                      const fallbackOptions = {
                          numberOfImages: Math.min(parseInt(num_images, 10) || 1, 4),
                          aspectRatio: aspectRatioMap[aspect_ratio] || AspectRatio.SQUARE,
                          generationModel: generation_model,
                          seed: Math.floor(Math.random() * 1000000),
                          retries: 2
                      };

                      const fallbackImagesRaw = await imageFX.generateImage(fallbackFinalPrompt, fallbackOptions);
                      const fallbackResults = fallbackImagesRaw.map(img => ({
                          status: 'success',
                          url: img.url,
                          prompt: img.prompt,
                          mediaId: img.mediaId,
                          seed: img.seed,
                          sceneNumber: sceneNumberForThisPrompt,
                          aspectRatio: aspect_ratio,
                          wasRewritten: true,
                          originalPrompt: basePrompt,
                          rewriteSource: `${userFriendlyMessage} | fallback`,
                          rewriteModel: 'fallback-heuristic',
                          rewriteProvider: 'fallback',
                          sanitizedPrompt: img.sanitizedPrompt,
                          wasSanitized: img.wasSanitized,
                          alerts: img.alerts,
                          rawRewritePrompt: fallbackPromptBase
                      }));

                      allGeneratedImages.push(...fallbackResults);
                      if (fallbackResults[0]?.prompt) {
                          lastSuccessfulPromptForContext = fallbackResults[0].prompt;
                          lastSuccessfulSanitizedPromptForContext = fallbackResults[0].sanitizedPrompt || fallbackResults[0].prompt;
                      }
                      console.info(`Fallback heurístico aplicado com sucesso para a cena ${sceneNumberForThisPrompt}.`);
                      continue;
                  } catch (fallbackErr) {
                      const translatedFallback = fallbackErr instanceof ImageFXError
                          ? translateImageFXError(fallbackErr)
                          : (fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
                      lastRewriteError = new Error(translatedFallback);
                  }

                  throw lastRewriteError || new Error('Falha desconhecida na reescrita automática, mesmo após fallback.');
              } catch (rewriteErr) {
                  autoRewriteErrorMessage = rewriteErr instanceof Error ? rewriteErr.message : String(rewriteErr);
                  console.warn(`[ImageFX AutoRewrite] Falha ao reescrever prompt da cena ${sceneNumberForThisPrompt}:`, autoRewriteErrorMessage);
              }
          }

          const failureMessage = autoRewriteAttempted && autoRewriteErrorMessage
              ? `${userFriendlyMessage} | Falha na reescrita automática: ${autoRewriteErrorMessage}`
              : userFriendlyMessage;

          allGeneratedImages.push({
              status: 'failed',
              prompt: basePrompt,
              error: failureMessage,
              sceneNumber: sceneNumberForThisPrompt,
              aspectRatio: aspect_ratio,
              autoRewriteAttempted,
              originalPrompt: basePrompt
          });
      }
    }
    res.json({ message: `Processamento concluído.`, images: allGeneratedImages });
  } catch (error) {
    console.error("Erro geral na rota /api/imagefx/generate:", error.stack || error);
    const userFriendlyMessage = translateImageFXError(error);
    return res.status(500).json({ message: userFriendlyMessage });
  }
});

app.post('/api/imagefx/rewrite-prompt', verifyToken, async (req, res) => {
    let { failedPrompt, context, model, policyGuidance } = req.body;
    if (!failedPrompt || !model) {
        return res.status(400).json({ message: "Prompt e modelo são obrigatórios." });
    }

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        if (!userSettingsRow) throw new Error('Utilizador não encontrado.');
        const userSettings = userSettingsRow.settings ? JSON.parse(userSettingsRow.settings) : {};

        const rewriteResult = await rewriteImagePromptWithAi({
            userSettings,
            failedPrompt,
            context: context || failedPrompt,
            modelHint: model,
            policyGuidance
        });

        res.json({
            newPrompt: rewriteResult.newPrompt.trim(),
            provider: rewriteResult.provider,
            modelUsed: rewriteResult.modelUsed
        });

    } catch (error) {
        const apiError = error.response?.data?.error?.message || error.message;
        console.error("Erro ao reescrever prompt:", apiError);
        res.status(500).json({ message: `Falha ao reescrever o prompt: ${apiError}` });
    }
});

// Funções relacionadas ao Grok e Flow foram removidas

// Endpoint para gerar vídeo a partir de imagem do ImageFX
app.post('/api/imagefx/generate-video-from-image', verifyToken, async (req, res) => {
    const { imageUrl, imageBase64, prompt, mode = 'normal', mediaId } = req.body;

    // Para gerar vídeo a partir de imagem, precisa de mediaId OU (imageUrl OU imageBase64)
    if (!mediaId && !imageUrl && !imageBase64) {
        return res.status(400).json({ 
            success: false,
            message: 'É necessário fornecer mediaId, imageUrl ou imageBase64 para gerar vídeo a partir de imagem.' 
        });
    }

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        const imagefxCookiesString = userSettings.imagefx_cookies;

        if (!imagefxCookiesString || (typeof imagefxCookiesString === 'string' && imagefxCookiesString.trim() === '')) {
            return res.status(400).json({ message: 'Configure os cookies do ImageFX nas configurações.' });
        }

        // Formata os cookies do ImageFX
        let cookiesForImageFX;
        try {
            cookiesForImageFX = formatCookiesForImageFX(imagefxCookiesString);
            console.log('✓ Cookies do ImageFX formatados com sucesso.');
        } catch (error) {
            console.error('Erro ao formatar cookies do ImageFX:', error.message);
            throw new Error('Erro ao processar cookies do ImageFX. Verifique se os cookies estão no formato correto.');
        }

        // Usa a estrutura de Account do ImageFX para obter token de sessão
        const { Account, AccountError } = ImageFXModule;
        let account;
        try {
            account = new Account(cookiesForImageFX);
            await account.refreshSession();
            console.log('✓ Sessão do ImageFX autenticada com sucesso.');
        } catch (accountError) {
            console.error('Erro ao autenticar sessão do ImageFX:', accountError.message);
            throw new Error(`Erro ao autenticar com o ImageFX: ${accountError.message}. Verifique os cookies.`);
        }

        // Prepara a imagem para uso
        let finalMediaId = mediaId;
        
        // Se não tem mediaId, tenta extrair da URL
        if (!finalMediaId && imageUrl) {
            // Tenta extrair mediaId da URL se disponível
            if (imageUrl.includes('mediaId=')) {
                const mediaIdMatch = imageUrl.match(/mediaId=([^&]+)/);
                if (mediaIdMatch) {
                    finalMediaId = decodeURIComponent(mediaIdMatch[1]);
                    console.log(`✅ MediaId extraído da URL: ${finalMediaId.substring(0, 50)}...`);
                }
            }
        }
        
        // Validação: precisa ter mediaId para gerar vídeo
        if (!finalMediaId) {
            return res.status(400).json({
                success: false,
                message: 'É necessário fornecer mediaId para gerar vídeo a partir de imagem do ImageFX. Use uma imagem gerada pelo ImageFX que já possui mediaId.',
                suggestion: 'Certifique-se de passar o campo "mediaId" no payload. O mediaId é retornado quando você gera uma imagem usando o ImageFX.'
            });
        }
        
        // Prepara o payload para geração de vídeo (estrutura final válida)
        // Formato do sessionId baseado nas requisições reais da API
        const sessionId = `;${Date.now()}`;
        
        // Prepara o clientContext (estrutura final válida - apenas sessionId e tool)
        const clientContext = {
            sessionId: sessionId,
            tool: "PINHOLE" // Tool correto para vídeo (PINHOLE)
        };
        
        // Mapeia aspectRatio para o formato correto
        // Os valores válidos são: VIDEO_ASPECT_RATIO_LANDSCAPE, VIDEO_ASPECT_RATIO_PORTRAIT, VIDEO_ASPECT_RATIO_SQUARE
        let aspectRatioFormatted = "VIDEO_ASPECT_RATIO_LANDSCAPE"; // Padrão
        if (mode === 'portrait' || mode === '9:16') {
            aspectRatioFormatted = "VIDEO_ASPECT_RATIO_PORTRAIT";
        } else if (mode === 'square' || mode === '1:1') {
            aspectRatioFormatted = "VIDEO_ASPECT_RATIO_SQUARE";
        } else if (mode === 'landscape' || mode === '16:9') {
            aspectRatioFormatted = "VIDEO_ASPECT_RATIO_LANDSCAPE";
        }
        
        // Formata o mediaId - mantém o formato simples do ImageFX
        let formattedMediaId = finalMediaId;
        
        // Estrutura final válida do request (sem seed, sem metadata)
        const videoRequest = {
            videoModelKey: "veo_3_0", // Modelo correto
            aspectRatio: aspectRatioFormatted, // Formato correto: VIDEO_ASPECT_RATIO_*
            referenceImages: [{
                imageUsageType: "IMAGE_USAGE_TYPE_ASSET", // Formato correto
                mediaId: formattedMediaId
            }],
            textInput: {
                prompt: prompt && prompt.trim() ? prompt.trim() : "animate this image"
            }
        };
        
        // Payload no formato correto para batchAsyncGenerateVideoReferenceImages
        const videoPayload = {
            clientContext: clientContext,
            requests: [videoRequest]
        };
        
        // Log do payload para debug
        console.log('📋 Payload completo para geração de vídeo:');
        console.log(JSON.stringify(videoPayload, null, 2));
        
        // Headers para a requisição (usando a mesma estrutura do ImageFX)
        const authHeaders = account.getAuthHeaders();
        const videoHeaders = {
            ...authHeaders,
            'Content-Type': 'text/plain;charset=UTF-8', // O endpoint usa text/plain, não application/json
            'Referer': 'https://labs.google/fx/tools/image-fx', // Mantém o referer do ImageFX
            'Origin': 'https://labs.google',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'x-browser-channel': 'stable',
            'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
            'x-browser-year': '2025',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site'
        };
        
        // Endpoint para gerar vídeo a partir de imagem
        const videoEndpoint = 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoReferenceImages';
        const payloadString = JSON.stringify(videoPayload);
        
        console.log('💡 Payload enviado para a API de vídeo (ImageFX):');
        console.log(payloadString);
        console.log(`🔄 Usando endpoint: ${videoEndpoint}`);
        
        try {
            const response = await axios.post(videoEndpoint, payloadString, {
                headers: videoHeaders,
                timeout: 120000, // 2 minutos de timeout
                validateStatus: (status) => status < 600 // Aceita todos os status codes para processar manualmente
            });
            
            if (response.status === 200 || response.status === 202) {
                console.log('✅ Resposta recebida da API de vídeo:', JSON.stringify(response.data, null, 2));
                
                const responseData = response.data;
                
                // Extrai o videoId/jobId da resposta
                let videoId = null;
                if (responseData.videoId) {
                    videoId = responseData.videoId;
                } else if (responseData.videos && responseData.videos.length > 0 && responseData.videos[0].videoId) {
                    videoId = responseData.videos[0].videoId;
                } else if (responseData.responses && responseData.responses.length > 0) {
                    const firstResponse = responseData.responses[0];
                    videoId = firstResponse.videoId || firstResponse.id || firstResponse.generationId;
                } else if (responseData.id) {
                    videoId = responseData.id;
                } else if (responseData.jobId) {
                    videoId = responseData.jobId;
                }
                
                if (videoId) {
                    console.log(`✅ Geração de vídeo iniciada. VideoId: ${videoId}`);
                    return res.status(202).json({
                        success: true,
                        jobId: videoId,
                        videoId: videoId,
                        message: 'Geração de vídeo iniciada. Use o jobId para verificar o status.',
                        data: responseData,
                        statusEndpoint: `/api/imagefx/video-status/${videoId}`
                    });
                }
                
                // Se a resposta contém o vídeo diretamente (geração síncrona)
                if (responseData.videoUrl || responseData.video?.url || responseData.generatedVideo?.url) {
                    const videoUrl = responseData.videoUrl || responseData.video?.url || responseData.generatedVideo?.url;
                    return res.json({
                        success: true,
                        videoUrl: videoUrl,
                        message: 'Vídeo gerado com sucesso!',
                        data: responseData
                    });
                }
                
                // Se a resposta contém o vídeo em base64
                if (responseData.videoBase64 || responseData.video?.base64 || responseData.generatedVideo?.base64) {
                    const videoBase64 = responseData.videoBase64 || responseData.video?.base64 || responseData.generatedVideo?.base64;
                    return res.json({
                        success: true,
                        videoBase64: videoBase64,
                        message: 'Vídeo gerado com sucesso!',
                        data: responseData
                    });
                }
                
                // Se não reconhece o formato, retorna a resposta completa
                console.log('⚠️ Formato de resposta não reconhecido. Retornando resposta completa.');
                return res.json({
                    success: true,
                    message: 'Geração de vídeo iniciada. Verifique a resposta para mais detalhes.',
                    data: responseData
                });
            }
            
            // Tratamento de erros
            const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            console.error(`❌ Erro ${response.status} ao gerar vídeo:`, errorText);
            console.error('📋 Payload que causou o erro:', payloadString);
            console.error('🔑 MediaId usado:', finalMediaId);
            
            // Tenta extrair detalhes do erro
            if (response.data?.error) {
                const errorData = response.data.error;
                console.error('📋 Estrutura completa do erro:', JSON.stringify(errorData, null, 2));
                
                if (errorData.details) {
                    console.error('📋 Detalhes do erro:', JSON.stringify(errorData.details, null, 2));
                }
                if (errorData.message) {
                    console.error('💬 Mensagem do erro:', errorData.message);
                }
                if (errorData.fieldViolations) {
                    console.error('🚫 Violações de campo:', JSON.stringify(errorData.fieldViolations, null, 2));
                }
                // Loga todos os campos do erro para debug
                console.error('🔍 Todos os campos do erro:', Object.keys(errorData));
            } else {
                // Se não tem estrutura de erro padrão, loga tudo
                console.error('📋 Resposta completa do erro:', JSON.stringify(response.data, null, 2));
            }
            
            // Se for erro 400, tenta usar o Wisk como fallback
            if (response.status === 400) {
                console.log('⚠️ Endpoint do ImageFX falhou com erro 400. Tentando usar Wisk como fallback...');
                
                // Verifica se o usuário tem cookies do Wisk configurados
                const wiskCookiesString = userSettings.wisk_cookies;
                
                if (wiskCookiesString && typeof wiskCookiesString === 'string' && wiskCookiesString.trim() !== '') {
                    try {
                        // Prepara o payload para o Wisk
                        // Passa imageUrl ou imageBase64 se disponível, senão tenta com mediaId
                        const wiskPayload = {
                            prompt: prompt && prompt.trim() ? prompt.trim() : 'animate this image',
                            intensity: 'medium',
                            mode: mode // Passa o mode para mapear o aspectRatio corretamente
                        };
                        
                        // Prioriza imageUrl ou imageBase64 sobre mediaId
                        if (imageUrl) {
                            wiskPayload.imageUrl = imageUrl;
                        } else if (imageBase64) {
                            wiskPayload.imageBase64 = imageBase64;
                        } else if (finalMediaId) {
                            // Se só tem mediaId, tenta usar mas pode não funcionar
                            wiskPayload.mediaId = finalMediaId;
                        }
                        
                        // Tenta usar o Wisk para animar a imagem
                        const wiskResponse = await axios.post(
                            `${req.protocol}://${req.get('host')}/api/wisk/animate-image`,
                            wiskPayload,
                            {
                                headers: {
                                    'Authorization': req.headers.authorization,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        
                        if (wiskResponse.data.success) {
                            console.log('✅ Wisk fallback funcionou!');
                            return res.json({
                                success: true,
                                ...wiskResponse.data,
                                source: 'wisk_fallback',
                                message: 'Vídeo gerado usando Wisk (fallback do ImageFX)'
                            });
                        }
                    } catch (wiskError) {
                        console.error('❌ Wisk fallback também falhou:', wiskError.message);
                        if (wiskError.response?.data) {
                            console.error('Detalhes do erro do Wisk:', JSON.stringify(wiskError.response.data, null, 2));
                        }
                    }
                }
                
                return res.status(400).json({
                    success: false,
                    message: `Erro 400: Argumento inválido na requisição. O mediaId pode não ser compatível com este endpoint.`,
                    error: response.data,
                    suggestion: 'Tente usar o endpoint do Wisk (/api/wisk/animate-image) para animar imagens do ImageFX, ou verifique se o mediaId é válido.',
                    data: response.data
                });
            }
            
            return res.status(response.status).json({
                success: false,
                message: `Erro ao gerar vídeo: ${response.status}`,
                error: response.data,
                data: response.data
            });
            
        } catch (error) {
            console.error('❌ Erro ao gerar vídeo:', error.message);
            
            if (error.response) {
                const errorData = error.response.data;
                const statusCode = error.response.status || 500;
                console.error('Resposta de erro:', JSON.stringify(errorData, null, 2));
                
                return res.status(statusCode).json({
                    success: false,
                    message: `Erro ao gerar vídeo: ${statusCode}`,
                    error: errorData,
                    data: errorData
                });
            }
            
            return res.status(500).json({
                success: false,
                message: `Não foi possível gerar o vídeo: ${error.message}`,
                error: error.message
            });
        }
    } catch (error) {
        console.error('=== ERRO AO GERAR VÍDEO COM IMAGEFX ===');
        console.error('Mensagem de erro:', error.message);
        console.error('Código de erro:', error.code);
        
        return res.status(500).json({
            success: false,
            message: `Não foi possível gerar o vídeo: ${error.message}`
        });
    }
});

// Endpoint para verificar o status de geração de vídeo do ImageFX
app.post('/api/imagefx/video-status/:jobId', verifyToken, async (req, res) => {
    const { jobId } = req.params;
    
    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        const imagefxCookiesString = userSettings.imagefx_cookies;
        
        if (!imagefxCookiesString || (typeof imagefxCookiesString === 'string' && imagefxCookiesString.trim() === '')) {
            return res.status(400).json({ message: 'Configure os cookies do ImageFX nas configurações.' });
        }
        
        // Formata os cookies do ImageFX
        let cookiesForImageFX;
        try {
            cookiesForImageFX = formatCookiesForImageFX(imagefxCookiesString);
        } catch (error) {
            console.error('Erro ao formatar cookies do ImageFX:', error.message);
            throw new Error('Erro ao processar cookies do ImageFX. Verifique se os cookies estão no formato correto.');
        }
        
        // Usa a estrutura de Account do ImageFX
        const { Account, AccountError } = ImageFXModule;
        let account;
        try {
            account = new Account(cookiesForImageFX);
            await account.refreshSession();
        } catch (accountError) {
            console.error('Erro ao autenticar sessão do ImageFX:', accountError.message);
            throw new Error(`Erro ao autenticar com o ImageFX: ${accountError.message}. Verifique os cookies.`);
        }
        
        // Headers para a requisição
        const authHeaders = account.getAuthHeaders();
        const videoHeaders = {
            ...authHeaders,
            'Content-Type': 'text/plain;charset=UTF-8',
            'Referer': 'https://labs.google/fx/tools/image-fx',
            'Origin': 'https://labs.google'
        };
        
        // Endpoint para verificar status
        const statusEndpoint = 'https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus';
        
        // Tenta diferentes formatos de payload para verificar status
        const statusPayloads = [
            JSON.stringify({ operations: [{ operation: { name: jobId } }] }),
            JSON.stringify({ videoIds: [jobId] }),
            JSON.stringify([jobId]),
            JSON.stringify({ id: jobId }),
            jobId
        ];
        
        let lastStatusError = null;
        for (const statusPayload of statusPayloads) {
            try {
                console.log(`🔄 Verificando status do vídeo ${jobId}...`);
                const response = await axios.post(statusEndpoint, statusPayload, {
                    headers: videoHeaders,
                    timeout: 30000
                });
                
                if (response.status === 200) {
                    const responseData = response.data;
                    console.log('✅ Status do vídeo:', JSON.stringify(responseData, null, 2));
                    
                    // Processa a resposta do status
                    let videoStatus = 'unknown';
                    let videoUrl = null;
                    let videoBase64 = null;
                    let operation = null;
                    
                    // Tenta diferentes formatos de resposta
                    if (responseData.operations && responseData.operations.length > 0) {
                        operation = responseData.operations[0];
                        videoStatus = operation.status || 'unknown';
                        // Remove o prefixo MEDIA_GENERATION_STATUS_ se existir
                        if (videoStatus.startsWith('MEDIA_GENERATION_STATUS_')) {
                            videoStatus = videoStatus.replace('MEDIA_GENERATION_STATUS_', '').toLowerCase();
                        }
                        videoUrl = operation.videoUrl || operation.url || operation.downloadUrl || operation.video?.url;
                        videoBase64 = operation.videoBase64 || operation.base64 || operation.encodedVideo || operation.video?.base64;
                    } else if (responseData.videos && responseData.videos.length > 0) {
                        const video = responseData.videos[0];
                        videoStatus = video.status || video.state || 'unknown';
                        videoUrl = video.videoUrl || video.url || video.downloadUrl;
                        videoBase64 = video.videoBase64 || video.base64 || video.encodedVideo;
                    } else if (responseData.video) {
                        videoStatus = responseData.video.status || responseData.video.state || 'unknown';
                        videoUrl = responseData.video.videoUrl || responseData.video.url || responseData.video.downloadUrl;
                        videoBase64 = responseData.video.videoBase64 || responseData.video.base64 || responseData.video.encodedVideo;
                    } else {
                        videoStatus = responseData.status || responseData.state || 'unknown';
                        videoUrl = responseData.videoUrl || responseData.url || responseData.downloadUrl;
                        videoBase64 = responseData.videoBase64 || responseData.base64 || responseData.encodedVideo;
                    }
                    
                    // Se o vídeo está pronto, retorna a URL ou base64
                    if (videoStatus === 'completed' || videoStatus === 'ready' || videoStatus === 'done' || videoStatus === 'success') {
                        if (videoUrl) {
                            return res.json({
                                success: true,
                                jobId: jobId,
                                status: videoStatus,
                                videoUrl: videoUrl,
                                message: 'Vídeo gerado com sucesso!',
                                data: responseData
                            });
                        } else if (videoBase64) {
                            return res.json({
                                success: true,
                                jobId: jobId,
                                status: videoStatus,
                                videoBase64: videoBase64,
                                message: 'Vídeo gerado com sucesso!',
                                data: responseData
                            });
                        }
                    }
                    
                    // Se o vídeo ainda está processando, retorna o status
                    const isProcessing = videoStatus === 'processing' || videoStatus === 'pending' || videoStatus === 'in_progress';
                    return res.json({
                        success: true,
                        jobId: jobId,
                        status: videoStatus,
                        message: isProcessing ? 'Vídeo ainda está sendo processado...' : `Status: ${videoStatus}`,
                        data: responseData,
                        operation: operation || responseData.videos?.[0] || responseData.video || null
                    });
                }
                
                // Se for erro 4xx, tenta próximo formato de payload
                if (response.status >= 400 && response.status < 500) {
                    console.log(`⚠️ Erro ${response.status} com formato de payload. Tentando próximo...`);
                    lastStatusError = new Error(`Erro ${response.status}: ${JSON.stringify(response.data)}`);
                    continue;
                }
                
                return res.status(response.status).json({
                    success: false,
                    message: `Erro ao verificar status: ${response.status}`,
                    data: response.data
                });
                
            } catch (error) {
                lastStatusError = error;
                // Se for erro 4xx, tenta próximo formato de payload
                if (error.response && error.response.status >= 400 && error.response.status < 500) {
                    console.log(`⚠️ Erro ${error.response.status} ao verificar status. Tentando próximo formato de payload...`);
                    continue;
                }
                
                // Se for erro de rede ou timeout, retorna erro
                console.error('Erro ao verificar status do vídeo:', error.message);
                if (error.response) {
                    console.error('Resposta de erro:', error.response.data);
                }
                return res.status(500).json({
                    success: false,
                    message: `Não foi possível verificar o status do vídeo: ${error.message}`,
                    error: error.response?.data || error.message
                });
            }
        }
        
        // Se nenhum formato de payload funcionou, retorna erro
        return res.status(400).json({
            success: false,
            message: `Não foi possível verificar o status do vídeo com nenhum formato de payload.`,
            error: lastStatusError ? lastStatusError.message : 'Todos os formatos de payload falharam',
            triedPayloads: statusPayloads.length
        });
        
    } catch (error) {
        console.error('=== ERRO AO VERIFICAR STATUS DO VÍDEO ===');
        console.error('Mensagem de erro:', error.message);
        
        return res.status(400).json({
            success: false,
            message: `Não foi possível verificar o status do vídeo: ${error.message}`
        });
    }
});

app.post('/api/tts/preview', verifyToken, async (req, res) => {
    const { voice, model, provider = 'gemini' } = req.body || {};
    const previewVoice = typeof voice === 'string' && voice.trim() ? voice.trim() : FALLBACK_TTS_VOICE;
    const previewText = `Narrador: ${DEFAULT_TTS_SAMPLE_TEXT}`;
    const validatedModel = validateTtsModel(model);

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        
        let apiKey;
        if (provider === 'openai') {
            const gptKey = typeof userSettings.gpt === 'string' ? userSettings.gpt.trim() : '';
            if (!gptKey) {
                return res.status(400).json({ message: 'Configure uma chave da API OpenAI (GPT) para usar o TTS da OpenAI.' });
            }
            apiKey = gptKey;
        } else {
            const geminiKey = getFirstGeminiKeyFromSettings(userSettings);
        if (!geminiKey) {
            return res.status(400).json({ message: 'Configure uma chave da API Gemini.' });
            }
            apiKey = geminiKey;
        }

        const { audioBase64 } = await generateTtsAudio({
            apiKey: apiKey,
            model: validatedModel,
            textInput: previewText,
            speakerVoiceMap: new Map([['Narrador', previewVoice]]),
            provider: provider || 'gemini'
        });

        res.json({
            message: 'Prévia gerada.',
            audio: {
                mimeType: 'audio/mpeg',
                base64: audioBase64,
            }
        });
    } catch (err) {
        const apiDetails = err.response?.data?.error?.message || err.message || 'Erro interno ao gerar prévia.';
        console.error('Erro ao gerar prévia de voz:', apiDetails, err.response?.data || err);
        res.status(500).json({ message: `Falha na prévia de voz: ${apiDetails}` });
    }
});

app.post('/api/tts/generate-long', verifyToken, async (req, res) => {
    const { model, styleInstructions, segments } = req.body;
    
    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        const geminiKey = getFirstGeminiKeyFromSettings(userSettings);

        if (!geminiKey) {
            return res.status(400).json({ message: 'Configure uma chave da API Gemini.' });
        }

        const jobId = `tts-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const jobData = {
            apiKey: geminiKey,
            model: validateTtsModel(model),
            styleInstructions,
            segments,
        };

        ttsJobs[jobId] = {
            id: jobId,
            status: 'queued',
            progress: 0,
            total: segments.length,
            message: 'Na fila para processamento...',
            downloadUrl: null,
            createdAt: new Date(),
        };

        processLongTtsJob(jobId, jobData);

        res.status(202).json({ jobId });

    } catch (error) {
        console.error("Erro ao iniciar trabalho de TTS longo:", error);
        res.status(500).json({ message: `Não foi possível iniciar a geração de áudio: ${error.message}` });
    }
});

// Otimização 6: Função local para dividir texto, economizando uma chamada de API.
function splitTextIntoChunks(text, charLimit) {
    const chunks = [];
    let remainingText = text.trim();

    while (remainingText.length > 0) {
        if (remainingText.length <= charLimit) {
            chunks.push(remainingText);
            break;
        }

        // Tenta usar 95% do limite para deixar margem e evitar cortes no meio de palavras
        const safeLimit = Math.floor(charLimit * 0.95);
        let chunk = remainingText.substring(0, safeLimit);
        let lastSentenceEnd = -1;
        let bestBreakPoint = -1;

        // PRIORIDADE 1: Procura por finais de parágrafo (quebra de linha dupla)
        const doubleLineBreak = chunk.lastIndexOf('\n\n');
        if (doubleLineBreak > charLimit * 0.7) { // Se está nos últimos 30% do chunk
            bestBreakPoint = doubleLineBreak + 2;
        }

        // PRIORIDADE 2: Procura por finais de frase (ponto, exclamação, interrogação seguidos de espaço)
        if (bestBreakPoint === -1) {
            const sentenceEnders = ['.', '!', '?'];
            for (const ender of sentenceEnders) {
                // Procura pelo padrão: "encerrador + espaço" ou "encerrador + quebra de linha"
                const pattern1 = `${ender} `;
                const pattern2 = `${ender}\n`;
                const index1 = chunk.lastIndexOf(pattern1);
                const index2 = chunk.lastIndexOf(pattern2);
                const index = Math.max(index1, index2);
                
                if (index > lastSentenceEnd && index > charLimit * 0.7) {
                    lastSentenceEnd = index + (index === index1 ? pattern1.length : pattern2.length);
                    bestBreakPoint = lastSentenceEnd;
                }
            }
        }

        // PRIORIDADE 3: Procura por vírgulas ou ponto-e-vírgula (em posições adequadas)
        if (bestBreakPoint === -1) {
            const commaBreak = chunk.lastIndexOf(', ');
            const semicolonBreak = chunk.lastIndexOf('; ');
            const breakPoint = Math.max(commaBreak, semicolonBreak);
            
            if (breakPoint > charLimit * 0.8) { // Se está nos últimos 20% do chunk
                bestBreakPoint = breakPoint + 2;
            }
        }

        // PRIORIDADE 4: Se não encontrou ponto de quebra natural, quebra na última palavra
        if (bestBreakPoint === -1) {
            const lastSpace = chunk.lastIndexOf(' ');
            if (lastSpace !== -1 && lastSpace > charLimit * 0.5) {
                bestBreakPoint = lastSpace + 1;
            } else {
                // Último recurso: quebra no limite exato (pode cortar palavra, mas é raro)
                bestBreakPoint = safeLimit;
            }
        }

        // Se encontrou um ponto de quebra adequado, usa ele
        if (bestBreakPoint > 0 && bestBreakPoint <= safeLimit) {
            chunk = remainingText.substring(0, bestBreakPoint).trim();
        } else {
            // Fallback: usa o chunk até o limite seguro
            chunk = chunk.trim();
        }
        
        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length).trim();
    }

    return chunks.filter(Boolean); // Remove chunks vazios
}


async function processScriptTtsJob(jobId, jobData) {
    const { apiKey, ttsModel, script, voice, styleInstructions, provider = 'gemini' } = jobData;
    const job = ttsJobs[jobId];
    
    // Garante que o job existe e reinicializa os valores
    if (!job) {
        console.error(`Job ${jobId} não encontrado`);
        return;
    }
    
    // Reinicializa o progresso para garantir que comece do zero
    job.status = 'processing';
    job.progress = 0;
    job.total = 0;
    job.message = 'Dividindo o roteiro...';
    const tempFilePaths = [];

    try {
        // Define o modelo e limite baseado no provedor
        let validatedTtsModel;
        let charLimit;
        let minDelayBetweenRequests;
        
        if (provider === 'openai') {
            // OpenAI TTS: limite REAL é 4096 caracteres por requisição
            validatedTtsModel = 'tts-1-hd';
            charLimit = 4095; // Limite oficial da API OpenAI
            minDelayBetweenRequests = 500; // 0.5s (OpenAI é rápido)
            console.log(`📢 Usando OpenAI TTS para gerar áudio (limite: 4095 chars)`);
        } else {
            // Gemini TTS: aceita textos MUITO longos (até 32k tokens = ~20k chars)
            validatedTtsModel = 'gemini-2.5-flash-preview-tts';
            charLimit = 20000; // Gemini aceita textos longos sem problema
            minDelayBetweenRequests = 2000; // 2s entre requisições
            console.log(`📢 Usando Gemini TTS para gerar áudio (aceita até 20k chars)`);
        }
        
        // Log para monitorar processamento de áudios longos
        const estimatedMinutes = Math.ceil((script.length / charLimit) * 0.5); // ~0.5 min por chunk
        if (estimatedMinutes > 30) {
            console.log(`Processando áudio longo estimado em ~${estimatedMinutes} minutos (${script.length} caracteres)`);
        }

        // Otimização 6: Usando a função local em vez de uma chamada de IA
        const chunks = splitTextIntoChunks(script, charLimit);

        if (!chunks || chunks.length === 0) {
            throw new Error("Não foi possível dividir o roteiro em partes.");
        }
        
        // Validação prévia: verifica se há chunks antes de processar
        console.log(`📊 Roteiro dividido em ${chunks.length} parte(s) de até ${charLimit} caracteres cada.`);
        console.log(`   Total de caracteres: ${script.length.toLocaleString('pt-BR')}`);
        console.log(`   Estimativa de tempo: ~${Math.ceil(chunks.length * 10 / 60)} minutos (com delays de 10s entre partes)`);

        // Atualiza o job com o total de chunks ANTES de começar o processamento
        job.total = chunks.length;
        job.progress = 0;
        job.message = `📋 Roteiro dividido em ${chunks.length} partes. Preparando geração...`;
        
        // Verificar FFmpeg ANTES de começar (para mostrar status correto)
        const ffmpegAvailable = await checkFfmpegAvailable();
        if (ffmpegAvailable) {
            job.message = `✅ FFmpeg detectado. Gerando ${chunks.length} partes de áudio...`;
        } else {
            job.message = `⚠️ FFmpeg não encontrado. Usando método alternativo para ${chunks.length} partes...`;
        }
        
        // Contador atômico para rastrear quantas partes foram completadas
        // Isso garante que o progresso seja atualizado gradualmente, uma parte por vez
        let completedCount = 0;
        
        // Pequeno delay para garantir que a resposta foi enviada ao cliente
        await new Promise(resolve => setImmediate(resolve));
        
        // Otimização para áudios longos: Processa em lotes para melhor gerenciamento de memória
        const BATCH_SIZE = 50; // Processa 50 chunks por vez
        
        for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
            const batch = chunks.slice(batchStart, batchEnd);
            
            // Atualiza a mensagem antes de processar o lote
            job.message = `Processando lote ${Math.floor(batchStart / BATCH_SIZE) + 1} (partes ${batchStart + 1} a ${batchEnd})...`;
            
            // Processa o lote em paralelo (limitado para não sobrecarregar a API)
            const batchPromises = batch.map(async (chunk, batchIndex) => {
                const globalIndex = batchStart + batchIndex;
                
                // Não adiciona prefixo "Narrador:" - apenas o texto puro do roteiro
                const textInput = buildTtsPrompt('', [{ speaker: 'Narrador', text: chunk }], true);
                
                let audioBase64 = null;
                let lastError = null;
                
                // Aumenta tentativas para áudios longos (mais crítico)
                const maxAttempts = chunks.length > 100 ? 5 : 3;
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        // Atualiza mensagem durante tentativas com mais detalhes
                        if (attempt > 1) {
                            job.message = `🔄 Tentativa ${attempt}/${maxAttempts} - Parte ${globalIndex + 1}/${job.total} (${chunk.length} caracteres)`;
                        } else {
                            const progressPercent = Math.round(((globalIndex + 1) / job.total) * 100);
                            job.message = `🎙️ Gerando parte ${globalIndex + 1}/${job.total} (${progressPercent}%) - ${chunk.length} caracteres`;
                        }
                        
                        // Para Gemini, usar generateGeminiTtsChunk diretamente para evitar concatenação interna
                        // Isso permite que processScriptTtsJob controle a concatenação final
                        if (provider === 'gemini') {
                            const result = await generateGeminiTtsChunk(
                                apiKey,
                                validatedTtsModel,
                                textInput,
                                voice || 'Autonoe',
                                globalIndex,
                                chunks.length,
                                maxAttempts,
                                2000
                            );
                            audioBase64 = result.audioBase64;
                        } else {
                            // Para OpenAI, usar generateTtsAudio normalmente
                            const result = await generateTtsAudio({
                                apiKey,
                                model: validatedTtsModel,
                                textInput,
                                speakerVoiceMap: new Map([['Narrador', voice]]),
                                provider: provider || 'openai'
                            });
                            audioBase64 = result.audioBase64;
                        }
                        break;
                    } catch (error) {
                        lastError = error;
                        const isQuotaError = error.status === 429 || 
                                           error.message?.includes('429') || 
                                           error.message?.includes('quota') ||
                                           error.message?.includes('Quota exceeded');
                        
                        // Verifica se é erro de quota diária esgotada (limit: 0) - apenas para Gemini
                        if (provider === 'gemini') {
                            const isDailyQuotaExceeded = error.message?.includes('per_day') || 
                                                        error.message?.includes('limit: 0') ||
                                                        (error.errorDetails && error.errorDetails.some(d => 
                                                            d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' &&
                                                            d.violations?.some(v => 
                                                                v.quotaMetric?.includes('per_day') || 
                                                                v.quotaValue === '0'
                                                            )
                                                        ));
                            
                            if (isDailyQuotaExceeded) {
                                // Quota diária esgotada - para imediatamente
                                console.error(`❌ ERRO CRÍTICO: Quota diária do modelo TTS esgotada ou não configurada (limit: 0).`);
                                console.error(`   A conta pode não ter acesso ao modelo TTS Preview ou a quota diária foi esgotada.`);
                                console.error(`   Verifique: https://ai.dev/usage?tab=rate-limit`);
                                
                            job.status = 'failed';
                            job.message = '❌ Limite diário da API atingido.\n\n' +
                                         '📊 A quota diária do modelo TTS foi esgotada ou não está configurada.\n' +
                                         '🔗 Verifique seu uso em: https://ai.dev/usage?tab=rate-limit\n' +
                                         '💡 Dica: O modelo TTS está em pré-lançamento e pode ter limitações de acesso.';
                                throw new Error('Quota diária do modelo TTS esgotada. Verifique sua conta na Google AI Studio. O modelo TTS está em pré-lançamento e pode ter limitações de acesso.');
                            }
                        }
                        
                        console.warn(`Tentativa ${attempt}/${maxAttempts} de gerar áudio para o chunk ${globalIndex + 1} falhou: ${error.message}`);
                        
                        if (attempt < maxAttempts) {
                            let waitTime;
                            
                            // Se for erro de quota (por minuto), usa o retryDelay sugerido pela API
                            if (isQuotaError) {
                                try {
                                    // Tenta extrair o retryDelay do erro
                                    let retryDelaySeconds = 60; // Padrão conservador
                                    
                                    if (error.errorDetails) {
                                        const retryInfo = error.errorDetails.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                                        if (retryInfo?.retryDelay) {
                                            // retryDelay pode vir como string "12s" ou número
                                            const delayStr = String(retryInfo.retryDelay).replace('s', '').replace(/[^0-9]/g, '');
                                            retryDelaySeconds = parseInt(delayStr) || 60;
                                        }
                                    }
                                    
                                    // Aguarda o tempo sugerido pela API (mínimo 60 segundos)
                                    waitTime = Math.max(60000, retryDelaySeconds * 1000);
                                    console.log(`⚠️ Erro de quota (429) detectado. Aguardando ${waitTime / 1000} segundos (sugerido pela API) antes de tentar novamente...`);
                                } catch {
                                    waitTime = 60000; // 60 segundos padrão
                                }
                            } else {
                                // Para outros erros, aumenta o tempo de espera progressivamente
                                waitTime = 2000 * attempt;
                            }
                            
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    }
                }

                if (!audioBase64) {
                    throw lastError || new Error(`Falha ao gerar áudio para o chunk ${globalIndex + 1} após ${maxAttempts} tentativas.`);
                }

                // Usar extensão correta: .wav para Gemini, .mp3 para OpenAI
                const audioExt = (provider === 'gemini') ? 'wav' : 'mp3';
                // Salvar em pasta PÚBLICA para o cliente poder baixar/deletar
                const partFileName = `${jobId}_part_${globalIndex}.${audioExt}`;
                const partFilePath = path.join(AUDIO_PARTS_DIR, partFileName);
                
                // Salva o arquivo de áudio - usar Buffer direto para evitar corrupção
                console.log(`💾 Salvando parte de áudio: ${partFileName} (${audioBase64.length} chars base64)`);
                
                // Converter base64 para Buffer e salvar diretamente (mais seguro que writeFile com 'base64')
                const audioBuffer = Buffer.from(audioBase64, 'base64');
                await fs.writeFile(partFilePath, audioBuffer);
                
                // Verifica se o arquivo foi salvo corretamente
                let stats;
                try {
                    stats = await fs.stat(partFilePath);
                    console.log(`✅ Parte de áudio salva: ${partFileName} (${stats.size} bytes / ${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                    
                    // Validação crítica: arquivo muito pequeno pode estar corrompido
                    const expectedMinSize = audioBuffer.length * 0.9; // 90% do tamanho esperado
                    if (stats.size < expectedMinSize) {
                        console.error(`❌ ERRO: Arquivo salvo (${stats.size} bytes) é menor que o esperado (${audioBuffer.length} bytes). Pode estar corrompido!`);
                        throw new Error(`Arquivo corrompido: tamanho salvo (${stats.size}) menor que esperado (${audioBuffer.length})`);
                    }
                } catch (err) {
                    console.error(`❌ Erro ao verificar parte de áudio: ${err.message}`);
                    throw new Error(`Falha ao salvar parte de áudio: ${partFilePath}`);
                }
                
                // ATUALIZA o progresso de forma ATÔMICA quando esta parte completa
                completedCount++;
                const progressPercent = Math.round((completedCount / job.total) * 100);
                job.progress = completedCount;
                job.message = `✅ Parte ${completedCount}/${job.total} concluída (${progressPercent}%) - ${chunk.length} caracteres processados`;
                
                // Inicializa array de partes se não existir
                if (!job.parts) {
                    job.parts = [];
                }
                job.parts.push({
                    index: globalIndex,
                    filename: partFileName,
                    size: stats.size,
                    url: `/audio_parts/${partFileName}`
                });
                
                // Pequeno delay para garantir que o frontend veja as atualizações graduais
                await new Promise(resolve => setImmediate(resolve));
                
                return { index: globalIndex, path: partFilePath, filename: partFileName };
            });
            
            // Processamento sequencial com delay entre cada requisição para evitar quota
            // Delay ajustado baseado no provedor (já definido acima)
            const batchResults = [];
            
            // Processa sequencialmente (uma requisição por vez) para garantir que não ultrapasse quota
            for (let i = 0; i < batchPromises.length; i++) {
                try {
                    const result = await batchPromises[i];
                    if (result) {
                        batchResults.push(result);
                    }
                
                // Atualiza mensagem geral com o progresso atual
                const currentProgress = Math.min(job.progress, job.total);
                job.message = `Processadas ${currentProgress} de ${job.total} partes...`;
                
                    // Delay obrigatório entre requisições (exceto na última)
                    if (i < batchPromises.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, minDelayBetweenRequests));
                    }
                } catch (error) {
                    // Se falhar, tenta novamente após delay maior
                    console.warn(`Erro ao processar parte ${i + 1}: ${error.message}`);
                    
                    // Se for erro de quota, aguarda mais tempo
                    const isQuotaError = error.status === 429 || 
                                       error.message?.includes('429') || 
                                       error.message?.includes('quota') ||
                                       error.message?.includes('Quota exceeded');
                    
                    if (isQuotaError) {
                        // Verifica se é erro de quota diária esgotada (limit: 0)
                        const isDailyQuotaExceeded = error.message?.includes('per_day') || 
                                                    error.message?.includes('limit: 0') ||
                                                    (error.errorDetails && error.errorDetails.some(d => 
                                                        d['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' &&
                                                        d.violations?.some(v => v.quotaMetric?.includes('per_day'))
                                                    ));
                        
                        if (isDailyQuotaExceeded) {
                            // Quota diária esgotada ou não configurada - não adianta retry
                            console.error(`❌ ERRO CRÍTICO: Quota diária do modelo TTS esgotada ou não configurada (limit: 0).`);
                            console.error(`   A conta pode não ter acesso ao modelo TTS ou a quota diária foi esgotada.`);
                            console.error(`   Verifique: https://ai.dev/usage?tab=rate-limit`);
                            
                            job.status = 'failed';
                            job.message = '❌ Limite diário da API atingido.\n\n' +
                                         '📊 A quota diária do modelo TTS foi esgotada ou não está configurada.\n' +
                                         '🔗 Verifique seu uso em: https://ai.dev/usage?tab=rate-limit';
                            throw new Error('Quota diária do modelo TTS esgotada. Verifique sua conta na Google AI Studio (https://ai.dev/usage?tab=rate-limit)');
                        }
                        
                        // Para outros erros de quota (por minuto), tenta retry
                        let waitTime = 60000;
                        try {
                            if (error.errorDetails) {
                                const retryInfo = error.errorDetails.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                                if (retryInfo?.retryDelay) {
                                    const delayStr = String(retryInfo.retryDelay).replace('s', '').replace(/[^0-9]/g, '');
                                    const suggestedDelay = parseInt(delayStr) || 60;
                                    waitTime = Math.max(60000, suggestedDelay * 1000); // Mínimo 60 segundos
                                }
                            }
                        } catch {}
                        
                        console.log(`⚠️ Erro de quota (429) na parte ${i + 1}. Aguardando ${waitTime / 1000} segundos conforme sugerido pela API...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        
                        // Tenta novamente esta parte após o delay
                        try {
                            const retryResult = await batchPromises[i];
                            if (retryResult) {
                                batchResults.push(retryResult);
                                console.log(`✅ Parte ${i + 1} processada com sucesso após retry.`);
                            }
                        } catch (retryError) {
                            console.error(`❌ Falha ao reprocessar parte ${i + 1} após erro de quota: ${retryError.message}`);
                            // Continua para a próxima parte para não travar todo o processo
                        }
                    } else {
                        // Para outros erros, também aguarda antes de continuar
                        console.warn(`Erro não relacionado a quota na parte ${i + 1}: ${error.message}`);
                    }
                    
                    // Delay antes da próxima requisição
                    if (i < batchPromises.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, MIN_DELAY_BETWEEN_REQUESTS));
                    }
                }
            }
            
            // Ordena os arquivos para garantir a ordem correta
            batchResults.sort((a, b) => a.index - b.index);
            
            // Adiciona os caminhos dos arquivos ao array (agora são partes públicas)
            batchResults.forEach(result => {
                tempFilePaths.push(result.path);
            });
            
            // Pequeno delay entre lotes para não sobrecarregar o sistema
            if (batchEnd < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Todas as partes foram geradas - agora vamos juntar (se necessário)
        job.parts = job.parts || [];
        job.parts.sort((a, b) => a.index - b.index); // Ordena por índice
        
        // Usar extensão correta: .wav para Gemini, .mp3 para OpenAI
        const audioExt = (provider === 'gemini') ? 'wav' : 'mp3';
        const finalFilePath = path.join(FINAL_AUDIO_DIR, `${jobId}.${audioExt}`);
        
        // Verificar disponibilidade do FFmpeg
        const ffmpegAvailableForMerge = await checkFfmpegAvailable();
        
        // Normaliza a lista de arquivos temporários (remove undefined/null)
        let validTempFiles = tempFilePaths.filter(fp => !!fp);
        
        if (validTempFiles.length === 0) {
            throw new Error('Nenhuma parte de áudio foi gerada.');
        }
        
        // CASO 1: só 1 arquivo OU não tem FFmpeg disponível → copia direto (sem concatenação)
        if (validTempFiles.length === 1 || !ffmpegAvailableForMerge) {
            console.log(`ℹ️ Finalização simples - ${validTempFiles.length} arquivo(s). FFmpeg disponível? ${ffmpegAvailableForMerge}`);
            
            const srcPath = validTempFiles[0];
            
            // Verifica se o arquivo existe
            let stats;
            try {
                stats = await fs.stat(srcPath);
                console.log(`✅ Arquivo fonte encontrado: ${srcPath} (${stats.size} bytes)`);
            } catch (err) {
                console.error(`❌ Erro ao verificar arquivo fonte: ${err.message}`);
                throw new Error(`Arquivo de áudio não encontrado: ${srcPath}`);
            }
            
            try {
                // Copia o arquivo para o destino final
                const sourceBuffer = await fs.readFile(srcPath);
                console.log(`📖 Arquivo fonte lido: ${sourceBuffer.length} bytes`);
                
                await fs.writeFile(finalFilePath, sourceBuffer);
                console.log(`✅ Arquivo copiado para: ${finalFilePath}`);
                
                const finalStats = await fs.stat(finalFilePath);
                console.log(`✅ Arquivo final criado: ${finalFilePath} (${finalStats.size} bytes / ${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`);
                
                if (finalStats.size === 0) {
                    throw new Error('Arquivo final está vazio');
                }
                
                // Validações simples de sanidade
                if (finalStats.size < 100000 && stats.size > 1000000) {
                    console.error(`❌ ERRO CRÍTICO: Arquivo final (${finalStats.size} bytes) é muito menor que o fonte (${stats.size} bytes).`);
                    throw new Error(`Arquivo corrompido: tamanho final (${finalStats.size}) muito menor que fonte (${stats.size})`);
                }
            } catch (err) {
                console.error(`❌ Erro ao copiar/verificar arquivo: ${err.message}`);
                throw new Error(`Falha ao criar arquivo final: ${err.message}`);
            }
            
            // Limpa temporários (se forem realmente temporários)
            for (const tempFile of validTempFiles) {
                try {
                    await fs.unlink(tempFile);
                    console.log(`🗑️ Arquivo temporário removido: ${tempFile}`);
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        console.warn(`⚠️ Não foi possível remover arquivo temporário ${tempFile}: ${err.message}`);
                    }
                }
            }
            
            job.status = 'completed';
            job.progress = job.total;
            job.downloadUrl = `/final_audio/${jobId}.${audioExt}`;
            job.message = ffmpegAvailableForMerge
                ? '✅ Áudio gerado com sucesso (sem necessidade de concatenação).'
                : '✅ Áudio gerado com sucesso (FFmpeg indisponível, usando arquivo único).';
            
            console.log(`🎉 TTS de roteiro concluído (sem concatenação): ${jobId}.${audioExt}`);
            return;
        }
        
        // CASO 2: mais de 1 arquivo E FFmpeg disponível → concatenar com FFmpeg
        job.message = `🔗 Concatenando ${validTempFiles.length} partes com FFmpeg...`;
        console.log(`✅ FFmpeg disponível - concatenando ${validTempFiles.length} arquivos ${audioExt.toUpperCase()}`);
        
        try {
            // Criar arquivo de lista para FFmpeg
            const listFilePath = path.join(TEMP_AUDIO_DIR, `${jobId}_filelist.txt`);
            const fileListContent = validTempFiles
                .map(fp => `file '${fp.replace(/\\/g, '/')}'`)
                .join('\n');
            
            await fs.writeFile(listFilePath, fileListContent, 'utf8');
            
            // Para MP3: copia direto
            // Para WAV: re-encoda para garantir compatibilidade
            const outputOptions = audioExt === 'mp3'
                ? ['-c', 'copy']                       // MP3
                : ['-c:a', 'pcm_s16le', '-ar', '24000', '-ac', '1']; // WAV
            
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(listFilePath)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .outputOptions(outputOptions)
                    .output(finalFilePath)
                    .on('start', (cmd) => {
                        console.log(`🎬 [Gemini TTS] FFmpeg iniciado para concatenação: ${cmd}`);
                    })
                    .on('progress', (progress) => {
                        if (progress.percent) {
                            job.message = `🔗 Concatenando com FFmpeg: ${Math.round(progress.percent)}%`;
                        }
                    })
                    .on('end', () => {
                        console.log(`✅ [Gemini TTS] FFmpeg concluído: ${finalFilePath}`);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error(`❌ [Gemini TTS] Erro no FFmpeg: ${err.message}`);
                        reject(err);
                    })
                    .run();
            });
            
            const finalStats = await fs.stat(finalFilePath);
            if (finalStats.size === 0) {
                throw new Error('Arquivo final gerado pelo FFmpeg está vazio');
            }
            
            const minExpectedSize = audioExt === 'mp3' ? 500000 : 1000000;
            if (finalStats.size < minExpectedSize && validTempFiles.length > 1) {
                console.warn(`⚠️ Arquivo final pequeno (${finalStats.size} bytes). Esperado pelo menos ${minExpectedSize} bytes para ${validTempFiles.length} partes.`);
            }
            
            console.log(`✅ [Gemini TTS] Áudio concatenado com FFmpeg: ${finalStats.size} bytes (${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`);
            
            try {
                await fs.unlink(listFilePath);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.warn(`⚠️ Não foi possível remover lista do FFmpeg: ${err.message}`);
                }
            }
            
            // Limpa arquivos temporários
            for (const tempFile of validTempFiles) {
                try {
                    await fs.unlink(tempFile);
                    console.log(`🗑️ Arquivo temporário removido: ${tempFile}`);
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        console.warn(`⚠️ Não foi possível remover arquivo temporário ${tempFile}: ${err.message}`);
                    }
                }
            }
            
            job.status = 'completed';
            job.progress = job.total;
            job.downloadUrl = `/final_audio/${jobId}.${audioExt}`;
            job.message = '✅ Áudio gerado e concatenado com sucesso (FFmpeg).';
            console.log(`🎉 [Gemini TTS] TTS concluído com FFmpeg: ${jobId}.${audioExt}`);
            return;
            
        } catch (err) {
            console.error(`❌ [Gemini TTS] Falha na concatenação com FFmpeg: ${err.message}`);
            throw err;
        }

    } catch (error) {
        console.error(`Erro no trabalho TTS de roteiro ${jobId}:`, error);
        job.status = 'failed';
        
        // Mensagens mais claras e úteis para o usuário
        let userMessage = error.message || 'Ocorreu um erro desconhecido durante o processamento.';
        
        // Melhorar mensagens específicas
        if (userMessage.includes('Quota') || userMessage.includes('quota')) {
            job.message = userMessage;
        } else if (userMessage.includes('API_KEY_INVALID') || userMessage.includes('chave') || userMessage.includes('autenticação')) {
            job.message = '❌ Chave da API inválida. Verifique suas configurações e certifique-se de que a chave está correta.';
        } else if (userMessage.includes('PERMISSION_DENIED') || userMessage.includes('permissão')) {
            job.message = '❌ Sem permissão para usar este modelo. Verifique se sua conta tem acesso ao modelo TTS selecionado.';
        } else if (userMessage.includes('INVALID_ARGUMENT') || userMessage.includes('argumento')) {
            job.message = '❌ Parâmetros inválidos enviados para a API. Tente usar outro modelo ou configuração.';
        } else if (userMessage.includes('RESOURCE_EXHAUSTED') || userMessage.includes('429')) {
            job.message = '❌ Limite de requisições atingido. Aguarde alguns minutos e tente novamente.';
        } else if (userMessage.includes('UNAVAILABLE') || userMessage.includes('indisponível')) {
            job.message = '⚠️ Serviço temporariamente indisponível. Tente novamente em alguns minutos.';
        } else if (userMessage.includes('DEADLINE_EXCEEDED') || userMessage.includes('timeout')) {
            job.message = '⏱️ Tempo limite excedido. O servidor demorou muito para responder. Tente novamente.';
        } else {
            job.message = `❌ Erro na geração: ${userMessage}`;
        }
    } finally {
        // NÃO remove mais os arquivos - eles ficam disponíveis para o cliente baixar/deletar
        // As partes estão em AUDIO_PARTS_DIR (pasta pública)
        job.finishedAt = new Date();
        scheduleJobCleanup(jobId);
    }
}

app.post('/api/tts/generate-from-script', verifyToken, async (req, res) => {
    const { ttsModel, script, voice, styleInstructions, provider = 'gemini' } = req.body;

    if (!script || !voice || !ttsModel) {
        return res.status(400).json({ message: 'Roteiro, voz e modelo de IA são obrigatórios.' });
    }

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        
        // Respeita a escolha do usuário - sem fallback automático
        let actualProvider = provider;
        let apiKey;
        
        const gptKey = typeof userSettings.gpt === 'string' ? userSettings.gpt.trim() : '';
        const geminiKey = getFirstGeminiKeyFromSettings(userSettings);
        
        if (provider === 'openai') {
            if (!gptKey) {
                // Se não tem OpenAI mas tem Gemini, oferece usar Gemini
                if (geminiKey) {
                    return res.status(400).json({ message: 'Chave OpenAI não configurada. Configure a chave OpenAI ou selecione Gemini como provedor.' });
                } else {
                    return res.status(400).json({ message: 'Configure uma chave da API OpenAI ou Gemini.' });
                }
            }
            apiKey = gptKey;
            actualProvider = 'openai';
        } else {
            // Provider é Gemini - usa Gemini mesmo que tenha OpenAI
            if (!geminiKey) {
                if (gptKey) {
                    return res.status(400).json({ message: 'Chave Gemini não configurada. Configure a chave Gemini ou selecione OpenAI como provedor.' });
                } else {
                    return res.status(400).json({ message: 'Configure uma chave da API Gemini.' });
                }
            }
            apiKey = geminiKey;
            actualProvider = 'gemini';
            console.log(`📢 Usando Gemini TTS conforme selecionado pelo usuário`);
        }

        const jobId = `tts-script-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const jobData = {
            apiKey,
            ttsModel: validateTtsModel(ttsModel),
            script,
            voice,
            styleInstructions,
            provider: actualProvider
        };

        ttsJobs[jobId] = {
            id: jobId,
            status: 'queued',
            progress: 0,
            total: 1,
            message: 'Na fila para processamento...',
            downloadUrl: null,
            createdAt: new Date(),
        };

        processScriptTtsJob(jobId, jobData);

        res.status(202).json({ jobId });

    } catch (error) {
        console.error("Erro ao iniciar trabalho de TTS a partir de roteiro:", error);
        res.status(500).json({ message: `Não foi possível iniciar a geração de áudio: ${error.message}` });
    }
});

app.get('/api/tts/status/:jobId', verifyToken, (req, res) => {
    const { jobId } = req.params;
    const job = ttsJobs[jobId];

    if (!job) {
        console.log(`❌ Job ${jobId} não encontrado. Jobs disponíveis: ${Object.keys(ttsJobs).length}`);
        return res.status(404).json({ 
            message: 'Trabalho de geração não encontrado. O trabalho pode ter sido concluído e removido automaticamente, ou pode ter expirado.',
            suggestion: 'Inicie uma nova geração de voz.' 
        });
    }

    // Incluir informações úteis no status
    const statusResponse = {
        status: job.status,
        progress: job.progress,
        total: job.total,
        message: job.message,
        downloadUrl: job.downloadUrl,
        parts: job.parts || [], // Partes individuais disponíveis
        createdAt: job.createdAt,
        finishedAt: job.finishedAt
    };

    res.json(statusResponse);
});

// Endpoint para listar partes de um job
app.get('/api/tts/parts/:jobId', verifyToken, (req, res) => {
    const { jobId } = req.params;
    const job = ttsJobs[jobId];

    if (!job) {
        return res.status(404).json({ message: 'Trabalho não encontrado.' });
    }

    res.json({ parts: job.parts || [] });
});

// Endpoint para baixar parte individual
app.get('/api/tts/parts/:jobId/:filename', verifyToken, async (req, res) => {
    try {
        const { jobId, filename } = req.params;
        const job = ttsJobs[jobId];

        if (!job) {
            return res.status(404).json({ message: 'Trabalho não encontrado.' });
        }

        // Segurança: validar nome do arquivo
        if (!filename || filename.includes('..') || !filename.startsWith(`${jobId}_part_`)) {
            return res.status(400).json({ error: 'Nome de arquivo inválido' });
        }

        const filePath = path.join(AUDIO_PARTS_DIR, filename);
        
        try {
            const stats = await fs.stat(filePath);
            res.setHeader('Content-Type', filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav');
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            const fileStream = require('fs').createReadStream(filePath);
            fileStream.pipe(res);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Parte não encontrada' });
            }
            throw err;
        }
    } catch (error) {
        console.error('Erro ao servir parte de áudio:', error);
        res.status(500).json({ error: 'Erro ao servir parte de áudio' });
    }
});

// Endpoint para deletar parte individual
app.delete('/api/tts/parts/:jobId/:filename', verifyToken, async (req, res) => {
    try {
        const { jobId, filename } = req.params;
        const job = ttsJobs[jobId];

        if (!job) {
            return res.status(404).json({ message: 'Trabalho não encontrado.' });
        }

        // Segurança: validar nome do arquivo
        if (!filename || filename.includes('..') || !filename.startsWith(`${jobId}_part_`)) {
            return res.status(400).json({ error: 'Nome de arquivo inválido' });
        }

        const filePath = path.join(AUDIO_PARTS_DIR, filename);
        
        try {
            await fs.unlink(filePath);
            
            // Remove da lista de partes do job
            if (job.parts) {
                job.parts = job.parts.filter(p => p.filename !== filename);
            }
            
            res.json({ message: 'Parte deletada com sucesso' });
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Parte não encontrada' });
            }
            throw err;
        }
    } catch (error) {
        console.error('Erro ao deletar parte de áudio:', error);
        res.status(500).json({ error: 'Erro ao deletar parte de áudio' });
    }
});

// Endpoint para juntar todas as partes com FFmpeg
app.post('/api/tts/merge/:jobId', verifyToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = ttsJobs[jobId];

        if (!job) {
            return res.status(404).json({ message: 'Trabalho não encontrado.' });
        }

        if (!job.parts || job.parts.length === 0) {
            return res.status(400).json({ message: 'Nenhuma parte disponível para juntar.' });
        }

        // Verificar se FFmpeg está disponível
        const ffmpegAvailable = await checkFfmpegAvailable();
        if (!ffmpegAvailable) {
            return res.status(400).json({ message: 'FFmpeg não está disponível no servidor. Não é possível juntar as partes.' });
        }

        // Ordenar partes por índice
        const sortedParts = [...job.parts].sort((a, b) => a.index - b.index);
        
        // Determinar extensão baseado na primeira parte
        const audioExt = sortedParts[0].filename.endsWith('.mp3') ? 'mp3' : 'wav';
        const finalFilePath = path.join(FINAL_AUDIO_DIR, `${jobId}.${audioExt}`);

        // Criar arquivo de lista para FFmpeg
        const listFilePath = path.join(TEMP_AUDIO_DIR, `${jobId}_merge_list.txt`);
        const fileListContent = sortedParts
            .map(part => {
                const partPath = path.join(AUDIO_PARTS_DIR, part.filename);
                return `file '${partPath.replace(/\\/g, '/')}'`;
            })
            .join('\n');
        
        await fs.writeFile(listFilePath, fileListContent, 'utf8');

        // Usar FFmpeg para concatenar
        const outputOptions = audioExt === 'mp3' 
            ? ['-c', 'copy'] // MP3: copia direto (mais rápido)
            : ['-c:a', 'pcm_s16le', '-ar', '24000', '-ac', '1']; // WAV: re-encoda

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(listFilePath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions(outputOptions)
                .output(finalFilePath)
                .on('start', (cmd) => {
                    console.log(`🎬 FFmpeg iniciado para juntar ${sortedParts.length} partes`);
                })
                .on('end', () => {
                    console.log(`✅ FFmpeg concluído: ${finalFilePath}`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`❌ Erro no FFmpeg: ${err.message}`);
                    reject(err);
                })
                .run();
        });

        // Verificar se o arquivo foi criado corretamente
        const finalStats = await fs.stat(finalFilePath);
        if (finalStats.size === 0) {
            throw new Error('Arquivo final gerado pelo FFmpeg está vazio');
        }
        
        // Log detalhado do arquivo criado
        console.log(`✅ Arquivo final criado: ${finalFilePath} (${finalStats.size} bytes / ${(finalStats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Verificar header do arquivo para garantir que não está corrompido
        const fileHeader = await fs.readFile(finalFilePath, { start: 0, end: 11 });
        const headerStr = fileHeader.toString('ascii', 0, 4);
        const isValidWav = headerStr === 'RIFF';
        const isValidMp3 = fileHeader[0] === 0xFF && (fileHeader[1] & 0xE0) === 0xE0;
        
        if (!isValidWav && !isValidMp3) {
            console.error(`❌ [MERGE] Arquivo final não tem header válido! Header: ${fileHeader.toString('hex').substring(0, 8)}`);
            throw new Error('Arquivo final gerado está corrompido (header inválido)');
        }
        
        console.log(`✅ [MERGE] Arquivo final válido: ${isValidWav ? 'WAV' : 'MP3'} (${finalStats.size} bytes)`);

        // Limpar arquivo de lista
        try {
            await fs.unlink(listFilePath);
        } catch (err) {
            console.warn(`⚠️ Não foi possível remover lista do FFmpeg: ${err.message}`);
        }

        // Atualizar job com URL de download
        job.downloadUrl = `/final_audio/${jobId}.${audioExt}`;
        job.message = `✅ ${sortedParts.length} partes juntadas com sucesso!`;

        res.json({
            message: 'Partes juntadas com sucesso',
            downloadUrl: job.downloadUrl,
            size: finalStats.size
        });
    } catch (error) {
        console.error('Erro ao juntar partes:', error);
        res.status(500).json({ error: `Erro ao juntar partes: ${error.message}` });
    }
});

// Endpoint para limpar cache (arquivos temporários)
app.post('/api/clear-cache', verifyToken, async (req, res) => {
    try {
        const deletedFiles = {
            tempAudio: 0,
            finalAudio: 0,
            uploads: 0,
            errors: []
        };

        // Função auxiliar para limpar um diretório
        const clearDirectory = async (dirPath, dirName) => {
            let fileCount = 0;
            try {
                // Verifica se o diretório existe
                try {
                    await fs.access(dirPath);
                } catch {
                    // Diretório não existe, cria ele
                    await fs.mkdir(dirPath, { recursive: true });
                    return 0;
                }

                // Lê todos os arquivos do diretório
                const files = await fs.readdir(dirPath);
                
                // Remove cada arquivo
                for (const file of files) {
                    try {
                        const filePath = path.join(dirPath, file);
                        const stats = await fs.stat(filePath);
                        
                        // Remove apenas arquivos (não diretórios)
                        if (stats.isFile()) {
                            await fs.unlink(filePath);
                            fileCount++;
                        } else if (stats.isDirectory()) {
                            // Se for um diretório, limpa recursivamente (mas não remove o diretório em si)
                            const subFiles = await fs.readdir(filePath);
                            for (const subFile of subFiles) {
                                try {
                                    const subFilePath = path.join(filePath, subFile);
                                    const subStats = await fs.stat(subFilePath);
                                    if (subStats.isFile()) {
                                        await fs.unlink(subFilePath);
                                        fileCount++;
                                    }
                                } catch (subError) {
                                    const subFilePath = path.join(filePath, subFile);
                                    deletedFiles.errors.push(`Erro ao remover ${subFilePath}: ${subError.message}`);
                                }
                            }
                        }
                    } catch (fileError) {
                        deletedFiles.errors.push(`Erro ao remover ${path.join(dirPath, file)}: ${fileError.message}`);
                    }
                }
            } catch (dirError) {
                deletedFiles.errors.push(`Erro ao acessar diretório ${dirName}: ${dirError.message}`);
            }
            
            return fileCount;
        };

        // Limpa os diretórios temporários
        deletedFiles.tempAudio = await clearDirectory(TEMP_AUDIO_DIR, 'temp_audio');
        deletedFiles.finalAudio = await clearDirectory(FINAL_AUDIO_DIR, 'final_audio');
        // Não limpa UPLOADS_DIR para não apagar arquivos dos usuários
        // deletedFiles.uploads = await clearDirectory(UPLOADS_DIR, 'uploads');

        const totalDeleted = deletedFiles.tempAudio + deletedFiles.finalAudio + deletedFiles.uploads;
        
        res.json({
            success: true,
            message: `Cache limpo com sucesso. ${totalDeleted} arquivo(s) removido(s).`,
            details: deletedFiles
        });
    } catch (error) {
        console.error('Erro ao limpar cache:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao limpar cache.',
            error: error.message
        });
    }
});

app.post('/api/youtube/details-v3', verifyToken, async (req, res) => { // Changed from app.get to app.post
    const { url, useGemini = false, model } = req.body; // Novo parâmetro para forçar uso do Gemini e detectar modelo
    if (!url) return res.status(400).json({ message: 'URL do YouTube é obrigatória.' });

    const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    if (!videoIdMatch) return res.status(400).json({ message: 'URL do YouTube inválida ou ID do vídeo não encontrado.' });
    const videoId = videoIdMatch[1];

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const settings = JSON.parse(userSettingsRow?.settings || '{}');
        
        // Se useGemini for true, usar YouTube Data V3 API com chave Gemini
        // Caso contrário, usar scraping com GPT-4
        if (useGemini) {
            // Usar YouTube Data V3 API com chave Gemini
            console.log("🔄 Usando YouTube Data V3 API com chave Gemini");
            
            const geminiKeys = (Array.isArray(settings.gemini) ? settings.gemini : [settings.gemini])
                .filter(k => k && typeof k === 'string' && k.trim() !== '');
            
            if (!geminiKeys || geminiKeys.length === 0) {
                return res.status(400).json({ 
                    message: 'Chave da API Gemini não configurada. Por favor, adicione-a nas Configurações para usar a API do YouTube Data V3.' 
                });
            }
            
            const geminiKey = geminiKeys[0];
            
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${geminiKey}`;
                const { data } = await axios.get(apiUrl, { timeout: 10000 });

                if (data.items && data.items.length > 0) {
                    const video = data.items[0];
                    const snippet = video.snippet;
                    const statistics = video.statistics;

                    return res.json({
                        title: snippet.title,
                        description: snippet.description,
                        tags: snippet.tags || [],
                        channelTitle: snippet.channelTitle,
                        thumbnailUrl: snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url,
                        viewCount: statistics.viewCount || '0',
                        likeCount: statistics.likeCount || '0',
                        commentCount: statistics.commentCount || '0',
                        publishedAt: snippet.publishedAt,
                        channelId: snippet.channelId,
                        source: 'youtube_api_v3'
                    });
                } else {
                    return res.status(404).json({ message: 'Vídeo não encontrado com o ID fornecido.' });
                }
            } catch (youtubeError) {
                console.error("❌ Erro ao usar YouTube Data V3 API:", youtubeError.message);
                const errorMsg = youtubeError.response?.data?.error?.message || youtubeError.message;
                return res.status(500).json({ 
                    message: `Erro ao buscar dados da API do YouTube Data V3: ${errorMsg}` 
                });
            }
        } else {
            // Detectar se é Claude ou GPT-4
            const isClaude = model && (model.toLowerCase().includes('claude') || model.toLowerCase().includes('anthropic'));
            const isGPT = !isClaude; // Se não for Claude, assume GPT
            
            if (isClaude) {
                // Usar Claude para extrair dados
                console.log("🔄 Usando Claude para extrair dados do YouTube (sem API do YouTube)");
                
                // Tentar obter chave Claude das configurações do usuário
                const claudeKey = settings.claude || settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
                if (!claudeKey || (typeof claudeKey === 'string' && claudeKey.trim() === '')) {
                    return res.status(400).json({ 
                        message: 'Chave da API do YouTube não configurada e chave Claude também não encontrada. Por favor, configure pelo menos uma delas nas Configurações.' 
                    });
                }
                
                try {
                    // Tentar fazer scraping básico da página do YouTube primeiro
                    let scrapedData = null;
                    try {
                        const youtubePageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
                            timeout: 10000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });
                        
                        const pageContent = youtubePageResponse.data;
                        const titleMatch = pageContent.match(/<title>([^<]+)<\/title>/i) || 
                                          pageContent.match(/"title":"([^"]+)"/i) ||
                                          pageContent.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
                        const descMatch = pageContent.match(/"shortDescription":"([^"]+)"/i) ||
                                        pageContent.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
                        const channelMatch = pageContent.match(/"ownerChannelName":"([^"]+)"/i) ||
                                           pageContent.match(/<link\s+itemprop="name"\s+content="([^"]+)"/i);
                        
                        if (titleMatch) {
                            scrapedData = {
                                title: titleMatch[1].replace(/\s*-\s*YouTube$/, '').trim(),
                                description: descMatch ? descMatch[1].substring(0, 5000) : 'Descrição não disponível',
                                channelTitle: channelMatch ? channelMatch[1] : 'Canal desconhecido',
                                tags: [],
                                viewCount: 'N/A',
                                likeCount: 'N/A',
                                commentCount: 'N/A',
                                publishedAt: 'N/A',
                                channelId: 'N/A'
                            };
                            console.log("✅ Dados extraídos via scraping básico do YouTube (Claude)");
                        }
                    } catch (scrapeError) {
                        console.warn("⚠️ Scraping básico falhou, usando Claude:", scrapeError.message);
                    }
                    
                    const extractionPrompt = scrapedData
                        ? `Você recebeu dados básicos extraídos de um vídeo do YouTube. Enriqueça e complete as informações faltantes:

Dados já extraídos:
- Título: ${scrapedData.title}
- Descrição: ${scrapedData.description.substring(0, 500)}
- Canal: ${scrapedData.channelTitle}

ID do vídeo: ${videoId}
URL: ${url}

Complete as informações faltantes (tags, estatísticas estimadas) e melhore a descrição se necessário. Retorne APENAS JSON válido com todas as chaves.`
                        : `Você é um especialista em analisar vídeos do YouTube. Com base no ID do vídeo fornecido, faça uma estimativa inteligente das informações:

ID do vídeo: ${videoId}
URL: ${url}

IMPORTANTE: Como não temos acesso direto à API, você deve fazer estimativas baseadas em padrões conhecidos. Use "N/A" para valores que não podem ser estimados.

Retorne APENAS um objeto JSON válido com as seguintes chaves:
{
  "title": "título estimado baseado no ID (ou 'Título não disponível')",
  "description": "descrição genérica ou estimada",
  "tags": ["tag1", "tag2", "tag3"] ou [],
  "channelTitle": "Canal desconhecido",
  "viewCount": "N/A",
  "likeCount": "N/A",
  "commentCount": "N/A",
  "publishedAt": "N/A",
  "channelId": "N/A"
}`;

                    // Definir extractionSchema antes de usar
                    const extractionSchema = {
                        type: "OBJECT",
                        properties: {
                            title: { type: "STRING" },
                            description: { type: "STRING" },
                            tags: { type: "ARRAY", items: { type: "STRING" } },
                            channelTitle: { type: "STRING" },
                            viewCount: { type: "STRING" },
                            likeCount: { type: "STRING" },
                            commentCount: { type: "STRING" },
                            publishedAt: { type: "STRING" },
                            channelId: { type: "STRING" }
                        },
                        required: ["title", "description"]
                    };

                    // Normalizar nome do modelo Claude
                    let claudeModel = 'claude-3-5-sonnet-20241022';
                    if (model) {
                        const modelLower = model.toLowerCase();
                        if (modelLower.includes('haiku')) {
                            claudeModel = 'claude-3-haiku-20240307';
                        } else if (modelLower.includes('opus')) {
                            claudeModel = 'claude-3-opus-20240229';
                        } else if (modelLower.includes('sonnet')) {
                            claudeModel = 'claude-3-5-sonnet-20241022';
                        }
                    }

                    const response = await axios.post('https://api.anthropic.com/v1/messages', {
                        model: claudeModel,
                        max_tokens: 2000,
                        messages: [
                            {
                                role: "user",
                                content: `Você é um especialista em extrair informações de vídeos do YouTube. Retorne APENAS JSON válido, sem texto adicional.\n\n${extractionPrompt}\n\nIMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido seguindo EXATAMENTE este formato:\n${JSON.stringify(extractionSchema, null, 2)}\n\nNÃO inclua markdown, explicações ou texto adicional. Apenas o JSON objeto.`
                            }
                        ]
                    }, {
                        headers: { 
                            'x-api-key': claudeKey,
                            'anthropic-version': '2023-06-01',
                            'Content-Type': 'application/json' 
                        },
                        timeout: 30000
                    });

                    // Validar resposta
                    if (!response.data || !response.data.content || response.data.content.length === 0) {
                        throw new Error("Resposta vazia ou inválida da Claude YouTube Extraction API.");
                    }

                    const content = response.data.content[0].text;
                    if (!content || !content.trim()) {
                        throw new Error("Resposta vazia ou inválida da Claude YouTube Extraction API.");
                    }

                    // Limpar markdown code blocks se existirem
                    let cleanedContent = content.trim();
                    cleanedContent = cleanedContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                    
                    let extractedData = null;
                    try {
                        extractedData = parseJsonRobustly(cleanedContent, "Claude YouTube Extraction");
                    } catch (parseError) {
                        console.error("❌ Erro ao parsear resposta do Claude:", parseError.message);
                        console.error("📄 Conteúdo recebido (primeiros 500 chars):", cleanedContent.substring(0, 500));
                        
                        if (scrapedData && scrapedData.title) {
                            console.log("⚠️ Usando dados do scraping básico como fallback (Claude)");
                            extractedData = {
                                title: scrapedData.title,
                                description: scrapedData.description,
                                tags: scrapedData.tags || [],
                                channelTitle: scrapedData.channelTitle,
                                viewCount: scrapedData.viewCount,
                                likeCount: scrapedData.likeCount,
                                commentCount: scrapedData.commentCount,
                                publishedAt: scrapedData.publishedAt,
                                channelId: scrapedData.channelId
                            };
                        } else {
                            throw new Error("Resposta vazia ou inválida da Claude YouTube Extraction API: não foi possível parsear o JSON e não há dados de scraping disponíveis.");
                        }
                    }
                    
                    // Validar se os dados extraídos são válidos
                    if (!extractedData || typeof extractedData !== 'object') {
                        if (scrapedData && scrapedData.title) {
                            console.log("⚠️ Dados do Claude inválidos, usando dados do scraping básico como fallback");
                            extractedData = {
                                title: scrapedData.title,
                                description: scrapedData.description,
                                tags: scrapedData.tags || [],
                                channelTitle: scrapedData.channelTitle,
                                viewCount: scrapedData.viewCount,
                                likeCount: scrapedData.likeCount,
                                commentCount: scrapedData.commentCount,
                                publishedAt: scrapedData.publishedAt,
                                channelId: scrapedData.channelId
                            };
                        } else {
                            throw new Error("Resposta vazia ou inválida da Claude YouTube Extraction API: dados não são um objeto válido.");
                        }
                    }
                    
                    // Validar título
                    if (!extractedData.title || extractedData.title.trim() === '' || extractedData.title === 'Título não disponível') {
                        if (scrapedData && scrapedData.title) {
                            console.log("⚠️ Título do Claude inválido, usando título do scraping básico como fallback");
                            extractedData.title = scrapedData.title;
                        } else {
                            throw new Error("Resposta vazia ou inválida da Claude YouTube Extraction API: título não encontrado.");
                        }
                    }

                    // Combinar dados do scraping (se disponível) com dados do Claude
                    const finalData = scrapedData ? {
                        ...scrapedData,
                        tags: (Array.isArray(extractedData.tags) && extractedData.tags.length > 0) 
                            ? extractedData.tags 
                            : (scrapedData.tags || []),
                        description: (extractedData.description && extractedData.description.length > scrapedData.description.length)
                            ? extractedData.description
                            : scrapedData.description,
                        channelTitle: extractedData.channelTitle || scrapedData.channelTitle || 'Canal desconhecido'
                    } : {
                        title: extractedData.title || 'Título não disponível',
                        description: extractedData.description || 'Descrição não disponível',
                        tags: Array.isArray(extractedData.tags) ? extractedData.tags : [],
                        channelTitle: extractedData.channelTitle || 'Canal desconhecido',
                        viewCount: extractedData.viewCount || 'N/A',
                        likeCount: extractedData.likeCount || 'N/A',
                        commentCount: extractedData.commentCount || 'N/A',
                        publishedAt: extractedData.publishedAt || 'N/A',
                        channelId: extractedData.channelId || 'N/A'
                    };

                    // Garantir que temos pelo menos título válido
                    if (!finalData.title || finalData.title.trim() === '' || finalData.title === 'Título não disponível') {
                        finalData.title = `Vídeo ${videoId}`;
                        console.warn("⚠️ Título não encontrado, usando ID do vídeo como fallback (Claude)");
                    }

                    // Normalizar dados finais
                    res.json({
                        title: finalData.title,
                        description: finalData.description || 'Descrição não disponível',
                        tags: Array.isArray(finalData.tags) ? finalData.tags : [],
                        channelTitle: finalData.channelTitle || 'Canal desconhecido',
                        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                        viewCount: finalData.viewCount || 'N/A',
                        likeCount: finalData.likeCount || 'N/A',
                        commentCount: finalData.commentCount || 'N/A',
                        publishedAt: finalData.publishedAt || 'N/A',
                        channelId: finalData.channelId || 'N/A',
                        source: scrapedData ? 'scraping_claude' : 'claude_estimation'
                    });
                } catch (claudeError) {
                    console.error("❌ Erro ao usar Claude para extrair dados:", claudeError.message);
                    
                    // Tratar erros específicos da API do Anthropic
                    if (claudeError.response) {
                        const status = claudeError.response.status;
                        const errorData = claudeError.response.data;
                        console.error(`❌ Erro HTTP ${status} da Anthropic:`, JSON.stringify(errorData, null, 2));
                        
                        if (status === 400) {
                            const errorMsg = errorData?.error?.message || errorData?.error || JSON.stringify(errorData);
                            throw new Error(`Erro 400 da Anthropic: ${errorMsg}. Verifique o prompt e a chave de API.`);
                        } else if (status === 401) {
                            throw new Error("Chave de API Anthropic inválida ou expirada.");
                        } else if (status === 429) {
                            throw new Error("Limite de requisições da Anthropic excedido. Tente novamente em alguns instantes.");
                        } else {
                            throw new Error(`Erro ${status} da Anthropic: ${errorData?.error?.message || JSON.stringify(errorData)}`);
                        }
                    } else if (claudeError.message && claudeError.message.includes('timeout')) {
                        throw new Error("Timeout ao conectar com a API da Anthropic. Tente novamente.");
                    } else {
                        throw claudeError;
                    }
                }
            } else {
                // Usar GPT-4 (código original)
                console.log("🔄 Usando GPT-4 para extrair dados do YouTube (sem API do YouTube)");
                
                // Tentar obter chave GPT das configurações do usuário
                const gptKey = settings.gpt || settings.openai_api_key || process.env.OPENAI_API_KEY;
                if (!gptKey || (typeof gptKey === 'string' && gptKey.trim() === '')) {
                    return res.status(400).json({ 
                        message: 'Chave da API do YouTube não configurada e chave GPT-4 também não encontrada. Por favor, configure pelo menos uma delas nas Configurações.' 
                    });
                }

            try {
                // Tentar fazer scraping básico da página do YouTube primeiro
                let scrapedData = null;
                try {
                    // Fazer requisição HTTP para a página do YouTube e extrair dados básicos
                    const youtubePageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });
                    
                    const pageContent = youtubePageResponse.data;
                    
                    // Extrair título usando regex (padrão comum no HTML do YouTube)
                    const titleMatch = pageContent.match(/<title>([^<]+)<\/title>/i) || 
                                      pageContent.match(/"title":"([^"]+)"/i) ||
                                      pageContent.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
                    
                    // Extrair descrição
                    const descMatch = pageContent.match(/"shortDescription":"([^"]+)"/i) ||
                                    pageContent.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
                    
                    // Extrair nome do canal
                    const channelMatch = pageContent.match(/"ownerChannelName":"([^"]+)"/i) ||
                                       pageContent.match(/<link\s+itemprop="name"\s+content="([^"]+)"/i);
                    
                    if (titleMatch) {
                        scrapedData = {
                            title: titleMatch[1].replace(/\s*-\s*YouTube$/, '').trim(),
                            description: descMatch ? descMatch[1].substring(0, 5000) : 'Descrição não disponível',
                            channelTitle: channelMatch ? channelMatch[1] : 'Canal desconhecido',
                            tags: [],
                            viewCount: 'N/A',
                            likeCount: 'N/A',
                            commentCount: 'N/A',
                            publishedAt: 'N/A',
                            channelId: 'N/A'
                        };
                        console.log("✅ Dados extraídos via scraping básico do YouTube");
                    }
                } catch (scrapeError) {
                    console.warn("⚠️ Scraping básico falhou, usando GPT-4:", scrapeError.message);
                }
                
                // Se scraping funcionou, usar GPT-4 apenas para melhorar/enriquecer os dados
                // Se não funcionou, usar GPT-4 para fazer estimativa baseada no ID
                const extractionPrompt = scrapedData
                    ? `Você recebeu dados básicos extraídos de um vídeo do YouTube. Enriqueça e complete as informações faltantes:

Dados já extraídos:
- Título: ${scrapedData.title}
- Descrição: ${scrapedData.description.substring(0, 500)}
- Canal: ${scrapedData.channelTitle}

ID do vídeo: ${videoId}
URL: ${url}

Complete as informações faltantes (tags, estatísticas estimadas) e melhore a descrição se necessário. Retorne APENAS JSON válido com todas as chaves.`
                    : `Você é um especialista em analisar vídeos do YouTube. Com base no ID do vídeo fornecido, faça uma estimativa inteligente das informações:

ID do vídeo: ${videoId}
URL: ${url}

IMPORTANTE: Como não temos acesso direto à API, você deve fazer estimativas baseadas em padrões conhecidos. Use "N/A" para valores que não podem ser estimados.

Retorne APENAS um objeto JSON válido com as seguintes chaves:
{
  "title": "título estimado baseado no ID (ou 'Título não disponível')",
  "description": "descrição genérica ou estimada",
  "tags": ["tag1", "tag2", "tag3"] ou [],
  "channelTitle": "Canal desconhecido",
  "viewCount": "N/A",
  "likeCount": "N/A",
  "commentCount": "N/A",
  "publishedAt": "N/A",
  "channelId": "N/A"
}`;

                const extractionSchema = {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING" },
                        description: { type: "STRING" },
                        tags: { type: "ARRAY", items: { type: "STRING" } },
                        channelTitle: { type: "STRING" },
                        viewCount: { type: "STRING" },
                        likeCount: { type: "STRING" },
                        commentCount: { type: "STRING" },
                        publishedAt: { type: "STRING" },
                        channelId: { type: "STRING" }
                    },
                    required: ["title", "description"]
                };

                // Usar GPT-4 para extrair dados
                const { getTokenLimits } = require('./token-limits');
                const tokenLimits = getTokenLimits('gpt-4o');
                
                // Adicionar instrução JSON explícita no prompt ao invés de usar response_format
                const promptWithJsonInstruction = extractionPrompt + `\n\nIMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido seguindo EXATAMENTE este formato:\n${JSON.stringify(extractionSchema, null, 2)}\n\nNÃO inclua markdown, explicações ou texto adicional. Apenas o JSON objeto.`;
                
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: "system",
                            content: "Você é um especialista em extrair informações de vídeos do YouTube. Retorne APENAS JSON válido, sem texto adicional."
                        },
                        {
                            role: "user",
                            content: promptWithJsonInstruction
                        }
                    ],
                    max_tokens: Math.min(2000, tokenLimits.maxOutputTokens),
                    temperature: 0.3
                }, {
                    headers: { 
                        'Authorization': `Bearer ${gptKey}`, 
                        'Content-Type': 'application/json' 
                    },
                    timeout: 30000
                });

                // Validar resposta
                if (!response.data || !response.data.choices || response.data.choices.length === 0) {
                    throw new Error("Resposta vazia ou inválida da GPT-4 YouTube Extraction API.");
                }

                const content = response.data.choices[0].message?.content;
                if (!content || !content.trim()) {
                    throw new Error("Resposta vazia ou inválida da GPT-4 YouTube Extraction API.");
                }

                // Limpar markdown code blocks se existirem
                let cleanedContent = content.trim();
                cleanedContent = cleanedContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
                
                let extractedData = null;
                try {
                    extractedData = parseJsonRobustly(cleanedContent, "GPT-4 YouTube Extraction");
                } catch (parseError) {
                    console.error("❌ Erro ao parsear resposta do GPT-4:", parseError.message);
                    console.error("📄 Conteúdo recebido (primeiros 500 chars):", cleanedContent.substring(0, 500));
                    
                    // Se o scraping básico funcionou, usar apenas esses dados
                    if (scrapedData && scrapedData.title) {
                        console.log("⚠️ Usando dados do scraping básico como fallback");
                        extractedData = {
                            title: scrapedData.title,
                            description: scrapedData.description,
                            tags: scrapedData.tags || [],
                            channelTitle: scrapedData.channelTitle,
                            viewCount: scrapedData.viewCount,
                            likeCount: scrapedData.likeCount,
                            commentCount: scrapedData.commentCount,
                            publishedAt: scrapedData.publishedAt,
                            channelId: scrapedData.channelId
                        };
                    } else {
                        throw new Error("Resposta vazia ou inválida da GPT-4 YouTube Extraction API: não foi possível parsear o JSON e não há dados de scraping disponíveis.");
                    }
                }
                
                // Validar se os dados extraídos são válidos
                if (!extractedData || typeof extractedData !== 'object') {
                    // Se o scraping básico funcionou, usar apenas esses dados
                    if (scrapedData && scrapedData.title) {
                        console.log("⚠️ Dados do GPT-4 inválidos, usando dados do scraping básico como fallback");
                        extractedData = {
                            title: scrapedData.title,
                            description: scrapedData.description,
                            tags: scrapedData.tags || [],
                            channelTitle: scrapedData.channelTitle,
                            viewCount: scrapedData.viewCount,
                            likeCount: scrapedData.likeCount,
                            commentCount: scrapedData.commentCount,
                            publishedAt: scrapedData.publishedAt,
                            channelId: scrapedData.channelId
                        };
                    } else {
                        throw new Error("Resposta vazia ou inválida da GPT-4 YouTube Extraction API: dados não são um objeto válido.");
                    }
                }
                
                // Validar título
                if (!extractedData.title || extractedData.title.trim() === '' || extractedData.title === 'Título não disponível') {
                    // Se o scraping básico funcionou, usar apenas esses dados
                    if (scrapedData && scrapedData.title) {
                        console.log("⚠️ Título do GPT-4 inválido, usando título do scraping básico como fallback");
                        extractedData.title = scrapedData.title;
                    } else {
                        throw new Error("Resposta vazia ou inválida da GPT-4 YouTube Extraction API: título não encontrado.");
                    }
                }

                // Combinar dados do scraping (se disponível) com dados do GPT-4
                const finalData = scrapedData ? {
                    ...scrapedData,
                    // Sobrescrever com dados melhorados do GPT-4 se disponíveis
                    tags: (Array.isArray(extractedData.tags) && extractedData.tags.length > 0) 
                        ? extractedData.tags 
                        : (scrapedData.tags || []),
                    description: (extractedData.description && extractedData.description.length > scrapedData.description.length)
                        ? extractedData.description
                        : scrapedData.description,
                    channelTitle: extractedData.channelTitle || scrapedData.channelTitle || 'Canal desconhecido'
                } : {
                    title: extractedData.title || 'Título não disponível',
                    description: extractedData.description || 'Descrição não disponível',
                    tags: Array.isArray(extractedData.tags) ? extractedData.tags : [],
                    channelTitle: extractedData.channelTitle || 'Canal desconhecido',
                    viewCount: extractedData.viewCount || 'N/A',
                    likeCount: extractedData.likeCount || 'N/A',
                    commentCount: extractedData.commentCount || 'N/A',
                    publishedAt: extractedData.publishedAt || 'N/A',
                    channelId: extractedData.channelId || 'N/A'
                };

                // Garantir que temos pelo menos título válido
                if (!finalData.title || finalData.title.trim() === '' || finalData.title === 'Título não disponível') {
                    // Última tentativa: usar o ID do vídeo como título
                    finalData.title = `Vídeo ${videoId}`;
                    console.warn("⚠️ Título não encontrado, usando ID do vídeo como fallback");
                }

                // Normalizar dados finais
                res.json({
                    title: finalData.title,
                    description: finalData.description || 'Descrição não disponível',
                    tags: Array.isArray(finalData.tags) ? finalData.tags : [],
                    channelTitle: finalData.channelTitle || 'Canal desconhecido',
                    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    viewCount: finalData.viewCount || 'N/A',
                    likeCount: finalData.likeCount || 'N/A',
                    commentCount: finalData.commentCount || 'N/A',
                    publishedAt: finalData.publishedAt || 'N/A',
                    channelId: finalData.channelId || 'N/A',
                    source: scrapedData ? 'scraping_gpt4' : 'gpt4_estimation'
                });
            } catch (gptError) {
                console.error("❌ Erro ao usar GPT-4 para extrair dados:", gptError.message);
                
                // Tratar erros específicos da API do OpenAI
                if (gptError.response) {
                    const status = gptError.response.status;
                    const errorData = gptError.response.data;
                    console.error(`❌ Erro HTTP ${status} da OpenAI:`, JSON.stringify(errorData, null, 2));
                    
                    if (status === 400) {
                        const errorMsg = errorData?.error?.message || errorData?.error || JSON.stringify(errorData);
                        throw new Error(`Erro 400 da OpenAI: ${errorMsg}. Verifique o prompt e a chave de API.`);
                    } else if (status === 401) {
                        throw new Error("Chave de API OpenAI inválida ou expirada.");
                    } else if (status === 429) {
                        throw new Error("Limite de requisições da OpenAI excedido. Tente novamente em alguns instantes.");
                    } else {
                        throw new Error(`Erro ${status} da OpenAI: ${errorData?.error?.message || JSON.stringify(errorData)}`);
                    }
                } else if (gptError.message && gptError.message.includes('timeout')) {
                    throw new Error("Timeout ao conectar com a API da OpenAI. Tente novamente.");
                } else {
                    throw gptError; // Re-lançar para ser capturado pelo catch externo
                }
            }
        }
    }

    } catch (error) {
        console.error("Erro ao buscar detalhes do vídeo do YouTube:", error.response?.data || error.message);
        
        // Mensagem de erro mais amigável
        const errorMsg = error.response?.data?.error?.message || error.message || 'Erro desconhecido';
        
        if (errorMsg.includes('GPT-4 não conseguiu') || errorMsg.includes('Resposta vazia')) {
            return res.status(500).json({ 
                message: 'Erro ao buscar detalhes do vídeo: Resposta vazia ou inválida da API de extração. Verifique se a URL está correta e tente novamente. Se o problema persistir, configure a API do YouTube nas Configurações.' 
            });
        }
        
        return res.status(500).json({ 
            message: `Erro ao buscar detalhes do vídeo: ${errorMsg}` 
        });
    }
});

app.post('/api/youtube/comments', verifyToken, async (req, res) => {
    const { videoId } = req.body;
    if (!videoId) return res.status(400).json({ message: 'ID do vídeo é obrigatório.' });

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const settings = JSON.parse(userSettingsRow?.settings || '{}');
        const apiKey = getFirstGeminiKeyFromSettings(settings);

        if (!apiKey) return res.status(400).json({ message: 'Chave da API Gemini (usada para o YouTube) não configurada.' });

        const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&key=${apiKey}&maxResults=20&order=relevance`;
        const { data } = await axios.get(apiUrl);

        if (!data.items || data.items.length === 0) {
            return res.json({ comments: [] });
        }

        const comments = data.items.map(item => item.snippet.topLevelComment.snippet.textDisplay);
        res.json({ comments });

    } catch (error) {
        console.error("Erro ao buscar comentários do YouTube:", error.response?.data || error.message);
        const apiErrorMessage = error.response?.data?.error?.message || 'Erro desconhecido ao buscar comentários.';
        res.status(500).json({ message: `Falha ao buscar comentários: ${apiErrorMessage}` });
    }
});

// ACADEMY ENDPOINTS
app.get('/api/academy', verifyToken, async (req, res) => {
    try {
        // Order by position for public view
        const lessons = await dbAll("SELECT * FROM academy_lessons ORDER BY position ASC, created_at DESC");
        res.json(lessons);
    } catch (err) {
        console.error("Erro ao buscar aulas da Academy:", err.message);
        res.status(500).json({ message: "Erro ao buscar aulas." });
    }
});

app.get('/api/app-settings', verifyToken, async (req, res) => {
    try {
        const rows = await dbAll("SELECT key, value FROM app_settings");
        const settings = rows.reduce((acc, row) => {
            try {
                acc[row.key] = JSON.parse(row.value);
            } catch (e) {
                acc[row.key] = row.value; // fallback for non-json values
            }
            return acc;
        }, {});
        res.json(settings);
    } catch (err) {
        console.error("Erro ao buscar app settings:", err.message);
        res.status(500).json({ message: "Erro ao buscar configuracoes." });
    }
});

// ADMIN ENDPOINTS
app.get('/api/admin/users', verifyToken, requireAdmin, async (req, res) => {
  const { status = 'active', page = 1, limit = 10, search = '' } = req.query;
  const isActive = status === 'active' ? 1 : 0;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const searchLower = search.trim().toLowerCase();
  
  let whereClause = `WHERE is_active = ?`;
  let queryParams = [isActive];
  if (searchLower) {
    whereClause += ` AND (LOWER(email) LIKE ? OR LOWER(whatsapp) LIKE ? OR LOWER(tags) LIKE ?)`;
    queryParams.push(`%${searchLower}%`, `%${searchLower}%`, `%${searchLower}%`);
  }
  
  try {
    const totalRow = await dbGet(`SELECT COUNT(*) as count FROM users ${whereClause}`, queryParams);
    const totalUsers = totalRow.count;
    const totalPages = Math.ceil(totalUsers / parseInt(limit));
    const users = await dbAll(`SELECT id, email, whatsapp, role, is_active, created_at, last_login_at, tags, must_change_password FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...queryParams, parseInt(limit), offset]);
    res.json({ data: users, totalPages, currentPage: parseInt(page), total: totalUsers });
  } catch(err) {
      console.error("Erro ao buscar utilizadores admin:", err.message);
      return res.status(500).json({ message: "Erro ao buscar utilizadores." });
  }
});

app.put('/api/admin/user/:userId', verifyToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { email, whatsapp, tags } = req.body;
  if (!email || email.trim() === '') return res.status(400).json({ message: 'Email é obrigatório.' });
  if (whatsapp && whatsapp.trim()) {
    const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
    if (!whatsappRegex.test(cleanedWhatsapp) || cleanedWhatsapp.length < 10) return res.status(400).json({ message: 'Número de WhatsApp inválido.' });
  }

  try {
    const result = await dbRun('UPDATE users SET email = ?, whatsapp = ?, tags = ? WHERE id = ?', [email, whatsapp || '', tags || '', userId]);
    if (result.changes === 0) return res.status(404).json({ message: 'Utilizador não encontrado.' });
    res.json({ message: 'Dados atualizados.' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    console.error("Erro ao atualizar utilizador:", err.message);
    return res.status(500).json({ message: 'Erro interno.' });
  }
});

// Novo endpoint para ativar um usuário
app.put('/api/admin/user/:userId/activate', verifyToken, requireAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await dbRun('UPDATE users SET is_active = 1 WHERE id = ?', [userId]);
        if (result.changes === 0) return res.status(404).json({ message: 'Utilizador não encontrado.' });
        res.json({ message: 'Utilizador ativado com sucesso!' });
    } catch (err) {
        console.error("Erro ao ativar utilizador:", err.message);
        return res.status(500).json({ message: 'Erro interno ao ativar utilizador.' });
    }
});

app.post('/api/admin/tags/batch', verifyToken, requireAdmin, async (req, res) => {
  const { userIds, tags, action } = req.body; // action: 'add' or 'remove'
  if (!Array.isArray(userIds) || userIds.length === 0 || !tags || !action) {
    return res.status(400).json({ message: 'Parâmetros inválidos.' });
  }
  const tagsToProcess = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (tagsToProcess.length === 0) {
    return res.status(400).json({ message: 'Nenhuma tag válida fornecida.' });
  }

  try {
    for (const userId of userIds) {
      const user = await dbGet('SELECT tags FROM users WHERE id = ?', [userId]);
      if (user) {
        const existingTags = user.tags ? user.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        let newTagsSet = new Set(existingTags);
        if (action === 'add') {
          tagsToProcess.forEach(tag => newTagsSet.add(tag));
        } else if (action === 'remove') {
          tagsToProcess.forEach(tag => newTagsSet.delete(tag));
        }
        const newTagsString = Array.from(newTagsSet).join(',');
        await dbRun('UPDATE users SET tags = ? WHERE id = ?', [newTagsString, userId]);
      }
    }
    res.json({ message: 'Tags atualizadas em lote com sucesso.' });
  } catch (err) {
    console.error("Erro ao atualizar tags em lote:", err.message);
    return res.status(500).json({ message: "Erro interno." });
  }
});

app.put('/api/admin/user/:userId/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    await dbRun('UPDATE users SET is_active = ? WHERE id = ?', [req.body.isActive ? 1 : 0, req.params.userId]);
    res.json({ message: 'Status atualizado.' });
  } catch(err) {
    console.error("Erro ao atualizar status:", err.message);
    return res.status(500).json({ message: "Erro interno." });
  }
});

app.put('/api/admin/user/:userId/role', verifyToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  if (!role || !['admin', 'user'].includes(role)) return res.status(400).json({ message: 'Cargo inválido.' });
  if (parseInt(userId) === 1 || parseInt(userId) === req.user.id) return res.status(403).json({ message: 'Este cargo não pode ser alterado.' });

  try {
    const result = await dbRun('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    if (result.changes === 0) return res.status(404).json({ message: "Utilizador não encontrado." });
    res.json({ message: 'Cargo atualizado.' });
  } catch (err) {
    console.error("Erro ao atualizar cargo:", err.message);
    return res.status(500).json({ message: "Erro interno." });
  }
});

app.post('/api/admin/user/:userId/reset-password', verifyToken, requireAdmin, async (req, res) => {
    const { userId } = req.params;
    if (parseInt(userId) === 1 || parseInt(userId) === req.user.id) return res.status(403).json({ message: 'A senha deste utilizador não pode ser redefinida.' });
    
    const newPassword = crypto.randomBytes(8).toString('hex');

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        const result = await dbRun('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [hash, userId]);
        if (result.changes === 0) return res.status(404).json({ message: 'Utilizador não encontrado.' });
        res.json({ message: `Senha redefinida. A nova senha temporária é: ${newPassword}` });
    } catch (err) {
        console.error("Erro ao redefinir a senha:", err.message);
        return res.status(500).json({ message: 'Erro interno ao redefinir a senha.' });
    }
});

app.post('/api/admin/approve-all', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await dbRun("UPDATE users SET is_active = 1 WHERE is_active = 0");
    res.json({ message: `${result.changes} utilizador(es) aprovados.` });
  } catch(err) {
    console.error("Erro ao aprovar todos:", err.message);
    return res.status(500).json({ message: "Erro interno." });
  }
});

// ================================================
// 🔗 WEBHOOK HOTMART - Integração Automática
// ================================================

// Função para validar token da Hotmart
// A Hotmart não usa HMAC SHA256, ela usa o próprio token (hottok) como validação
function validateHotmartSignature(payload, hottok, secret) {
    if (!secret) {
        console.warn('HOTMART_SECRET não configurado. Validação de token desativada.');
        return true; // Em desenvolvimento, pode retornar true. Em produção, deve validar sempre.
    }
    
    if (!hottok) {
        console.warn('Token hottok não fornecida no webhook da Hotmart.');
        return false;
    }
    
    // A Hotmart envia o token no header x-hotmart-hottok ou no body como "hottok"
    // O token deve corresponder ao HOTMART_SECRET configurado
    // Também pode estar no body do payload
    const tokenFromBody = payload?.hottok || payload?.data?.hottok;
    const tokenToValidate = hottok || tokenFromBody;
    
    if (!tokenToValidate) {
        console.warn('Nenhum token hottok encontrado no header ou body.');
        return false;
    }
    
    // Comparar o token recebido com o secret configurado
    // Usar comparação constante-time para segurança
    const crypto = require('crypto');
    const receivedBuffer = Buffer.from(tokenToValidate, 'utf8');
    const secretBuffer = Buffer.from(secret, 'utf8');
    
    // Verificar se os tamanhos são iguais antes de comparar
    if (receivedBuffer.length !== secretBuffer.length) {
        console.warn(`Token hottok inválido. Tamanho recebido: ${receivedBuffer.length}, Esperado: ${secretBuffer.length}`);
        return false;
    }
    
    // Comparar usando timing-safe comparison
    return crypto.timingSafeEqual(receivedBuffer, secretBuffer);
}

// Função para extrair dados do webhook da Hotmart (suporta múltiplos formatos)
function extractHotmartData(hotmartData) {
    // A Hotmart pode enviar dados em diferentes formatos, então tentamos vários caminhos
    const data = hotmartData?.data || hotmartData;
    
    // Tentar diferentes caminhos para email
    const email = data?.buyer?.email || 
                  data?.data?.buyer?.email || 
                  data?.purchase?.buyer?.email ||
                  data?.subscription?.user?.email ||
                  data?.user?.email;
    
    // Tentar diferentes caminhos para nome
    const name = data?.buyer?.name || 
                 data?.data?.buyer?.name || 
                 data?.purchase?.buyer?.name ||
                 data?.subscription?.user?.name ||
                 data?.user?.name;
    
    // Tentar diferentes caminhos para produto
    const productName = data?.product?.name || 
                        data?.data?.product?.name || 
                        data?.purchase?.product?.name ||
                        data?.subscription?.plan?.name ||
                        data?.plan?.name ||
                        '';
    
    const productId = data?.product?.id || 
                      data?.data?.product?.id || 
                      data?.purchase?.product?.id ||
                      data?.subscription?.plan?.id ||
                      data?.plan?.id ||
                      '';
    
    // Tentar diferentes caminhos para transação
    const transactionId = data?.purchase?.transaction || 
                          data?.data?.purchase?.transaction || 
                          data?.purchase?.order?.id ||
                          data?.subscription?.code ||
                          data?.code ||
                          data?.purchase?.code ||
                          '';
    
    // Tentar diferentes caminhos para data de compra
    const purchaseDate = data?.purchase?.order_date || 
                         data?.data?.purchase?.order_date || 
                         data?.purchase?.date ||
                         data?.subscription?.date_next_charge ||
                         data?.created_at ||
                         new Date().toISOString();
    
    // Tentar diferentes caminhos para status de assinatura
    const subscriptionStatus = data?.subscription?.status || 
                               data?.data?.subscription?.status || 
                               data?.purchase?.subscription?.status ||
                               data?.status ||
                               'ACTIVE';
    
    return {
        email,
        name,
        productName,
        productId,
        transactionId,
        purchaseDate,
        subscriptionStatus
    };
}

// Função para criar ou atualizar usuário a partir de dados da Hotmart
async function createOrUpdateUserFromHotmart(hotmartData) {
    const {
        email,
        name,
        productName,
        productId,
        transactionId,
        purchaseDate,
        subscriptionStatus
    } = extractHotmartData(hotmartData);

    if (!email) {
        console.error('Dados recebidos da Hotmart:', JSON.stringify(hotmartData, null, 2));
        throw new Error('Email do comprador não encontrado nos dados da Hotmart');
    }

    // Verificar se o usuário já existe
    let user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);

    // Tag VIP para usuários que compraram na Hotmart
    const hotmartTags = 'VIP';
    const purchaseDateTime = purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString();
    const subStatusFinal = subscriptionStatus || 'ACTIVE';

    if (user) {
        // Usuário existe - atualizar informações
        await dbRun(
            `UPDATE users SET 
                hotmart_product = ?, 
                hotmart_transaction_id = ?, 
                hotmart_purchase_date = ?, 
                hotmart_subscription_status = ?,
                hotmart_source = 'hotmart',
                tags = CASE 
                    WHEN tags IS NULL OR tags = '' THEN ?
                    WHEN tags NOT LIKE '%VIP%' THEN tags || ',VIP'
                    ELSE tags
                END
            WHERE email = ?`,
            [productName || '', transactionId || '', purchaseDateTime, subStatusFinal, hotmartTags, email]
        );
        console.log(`Usuário ${email} atualizado com informações da Hotmart`);
        return { user: { ...user, email }, isNew: false };
    } else {
        // Usuário não existe - criar novo usuário
        // Gerar senha aleatória temporária
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(tempPassword, salt);

        const result = await dbRun(
            `INSERT INTO users (
                email, 
                password_hash, 
                whatsapp, 
                settings, 
                role, 
                is_active, 
                must_change_password,
                hotmart_product,
                hotmart_transaction_id,
                hotmart_purchase_date,
                hotmart_subscription_status,
                hotmart_source,
                tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                email,
                hash,
                '', // WhatsApp não disponível na Hotmart inicialmente
                '{}',
                'user',
                1, // Aprovado automaticamente
                1, // Deve alterar senha no primeiro login
                productName || '',
                transactionId || '',
                purchaseDateTime,
                subStatusFinal,
                'hotmart',
                hotmartTags
            ]
        );

        // Enviar email com senha temporária e instruções
        try {
            await sendActivationEmail(email);
            // Também enviar email com senha temporária
            await sendPasswordResetEmail(email, tempPassword);
        } catch (emailError) {
            console.error(`Erro ao enviar email de ativação para ${email}:`, emailError.message);
            // Não falhar a criação do usuário se o email falhar
        }

        console.log(`Novo usuário ${email} criado e ativado via Hotmart`);
        return { user: { id: result.lastID, email }, isNew: true, tempPassword };
    }
}

// Endpoint webhook da Hotmart
// IMPORTANTE: Este endpoint deve ser configurado na Hotmart para receber notificações
// URL do webhook: https://seu-dominio.com/api/webhook/hotmart
// A Hotmart pode enviar dados como JSON ou form-urlencoded (GET/POST)
const handleHotmartWebhook = async (req, res) => {
    try {
        // A Hotmart pode enviar a assinatura em diferentes headers ou query params
        const signature = req.headers['x-hotmart-hottok'] || 
                         req.headers['x-hotmart-signature'] || 
                         req.headers['x-hottok'] ||
                         req.query.hottok ||
                         req.body?.hottok;
        const hotmartSecret = process.env.HOTMART_SECRET;

        // A Hotmart pode enviar dados no body (JSON ou form-urlencoded) ou como query params (GET)
        let hotmartData = req.body || {};
        
        // Se body estiver vazio, tentar query params (Hotmart às vezes envia como GET)
        if (!hotmartData || Object.keys(hotmartData).length === 0) {
            hotmartData = req.query || {};
        }

        // Hotmart pode enviar dados JSON como string no campo 'data'
        if (hotmartData.data && typeof hotmartData.data === 'string') {
            try {
                const parsedData = JSON.parse(hotmartData.data);
                hotmartData = { ...hotmartData, data: parsedData };
            } catch (e) {
                // Se não for JSON, manter como está
            }
        }

        // Se ainda não tem estrutura de evento, tentar detectar do próprio payload
        if (!hotmartData.event && hotmartData.event_name) {
            hotmartData.event = hotmartData.event_name;
        }

        // Log para debug (remover em produção ou deixar apenas erros)
        console.log('=== WEBHOOK HOTMART RECEBIDO ===');
        console.log('Event:', hotmartData.event || hotmartData.event_name || 'NÃO ESPECIFICADO');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Body:', JSON.stringify(hotmartData, null, 2));
        console.log('Query:', JSON.stringify(req.query, null, 2));
        console.log('Headers:', JSON.stringify(req.headers, null, 2));

        // Validar assinatura (se configurada)
        if (hotmartSecret && signature) {
            const isValid = validateHotmartSignature(hotmartData, signature, hotmartSecret);
            if (!isValid) {
                console.error('Assinatura HMAC inválida da Hotmart');
                return res.status(401).json({ message: 'Assinatura inválida' });
            }
        }

        // Determinar tipo de evento - A Hotmart pode enviar eventos em diferentes formatos
        const eventType = hotmartData?.event || 
                         hotmartData?.data?.event || 
                         hotmartData?.event_name ||
                         req.query.event ||
                         'PURCHASE_APPROVED';
        
        console.log(`Processando evento Hotmart: ${eventType}`);

        // Processar eventos de compra aprovada/completa
        if (eventType === 'PURCHASE_APPROVED' || 
            eventType === 'PURCHASE_COMPLETE' || 
            eventType === 'PURCHASE_BILLET_PAYED' ||
            eventType.toLowerCase().includes('approved') ||
            eventType.toLowerCase().includes('complete')) {
            
            // Compra aprovada - criar/ativar usuário
            try {
                const result = await createOrUpdateUserFromHotmart(hotmartData);
                const { user, isNew } = result;
                
                // Ativar usuário se ainda não estiver ativo
                await dbRun('UPDATE users SET is_active = 1 WHERE email = ?', [user.email]);
                
                console.log(`✅ Usuário ${user.email} ativado via Hotmart (${isNew ? 'novo' : 'existente'})`);
                
                // Responder 200 para a Hotmart (ela espera isso)
                return res.status(200).json({ 
                    success: true,
                    message: 'Usuário criado/ativado com sucesso',
                    email: user.email,
                    isNew 
                });
            } catch (error) {
                console.error('❌ Erro ao processar compra aprovada:', error);
                console.error('Stack:', error.stack);
                // Ainda responder 200 para não gerar retry infinito na Hotmart
                return res.status(200).json({ 
                    success: false,
                    message: 'Erro ao processar compra', 
                    error: error.message 
                });
            }
        }
        
        // Processar eventos de cancelamento
        else if (eventType === 'PURCHASE_CANCELED' ||  // Hotmart envia com 1 L
                 eventType === 'PURCHASE_CANCELLED' ||  // Variação com 2 L
                 eventType === 'PURCHASE_REFUNDED' || 
                 eventType === 'PURCHASE_CHARGEBACK' ||
                 eventType === 'SUBSCRIPTION_CANCELLED' ||
                 eventType === 'SUBSCRIPTION_CANCELED' ||
                 eventType.toLowerCase().includes('canceled') ||
                 eventType.toLowerCase().includes('cancelled') ||
                 eventType.toLowerCase().includes('refunded') ||
                 eventType.toLowerCase().includes('chargeback')) {
            
            // Compra cancelada - desativar usuário
            try {
                const { email } = extractHotmartData(hotmartData);
                if (!email) {
                    console.error('❌ Email não encontrado nos dados de cancelamento:', JSON.stringify(hotmartData, null, 2));
                    return res.status(200).json({ 
                        success: false,
                        message: 'Email não encontrado nos dados' 
                    });
                }

                const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
                if (user) {
                    // Desativar usuário
                    await dbRun('UPDATE users SET is_active = 0, hotmart_subscription_status = ? WHERE email = ?', 
                        ['CANCELLED', email]);
                    
                    // Enviar email de cancelamento
                    try {
                        await sendCancellationEmail(email);
                    } catch (emailError) {
                        console.error(`Erro ao enviar email de cancelamento para ${email}:`, emailError.message);
                    }
                    
                    console.log(`🔒 Usuário ${email} desativado via Hotmart (${eventType})`);
                    return res.status(200).json({ 
                        success: true,
                        message: 'Usuário desativado com sucesso', 
                        email 
                    });
                } else {
                    console.warn(`⚠️ Usuário ${email} não encontrado para cancelamento`);
                    return res.status(200).json({ 
                        success: false,
                        message: 'Usuário não encontrado' 
                    });
                }
            } catch (error) {
                console.error('❌ Erro ao processar cancelamento:', error);
                return res.status(200).json({ 
                    success: false,
                    message: 'Erro ao processar cancelamento', 
                    error: error.message 
                });
            }
        }
        
        // Eventos de pagamento pendente - apenas logar, não fazer nada
        else if (eventType === 'PURCHASE_BILLET_PRINTED' || 
                 eventType === 'PURCHASE_WAITING_PAYMENT' ||
                 eventType.toLowerCase().includes('waiting') ||
                 eventType.toLowerCase().includes('billet')) {
            
            const { email } = extractHotmartData(hotmartData);
            console.log(`⏳ Compra aguardando pagamento para: ${email || 'email não encontrado'}`);
            return res.status(200).json({ 
                success: true,
                message: 'Aguardando pagamento' 
            });
        }
        
        // Outros eventos - logar mas não processar
        else {
            console.log(`ℹ️ Evento não tratado: ${eventType}`);
            return res.status(200).json({ 
                success: true,
                message: 'Evento recebido mas não processado',
                event: eventType
            });
        }

    } catch (error) {
        console.error('❌ Erro ao processar webhook da Hotmart:', error);
        console.error('Stack:', error.stack);
        // Sempre responder 200 para a Hotmart, mesmo em erro, para evitar retries infinitos
        return res.status(200).json({ 
            success: false,
            message: 'Erro interno ao processar webhook', 
            error: error.message 
        });
    }
};

// Suportar tanto POST quanto GET (Hotmart pode enviar de ambas as formas)
app.post('/api/webhook/hotmart', handleHotmartWebhook);
app.get('/api/webhook/hotmart', handleHotmartWebhook);

app.delete('/api/admin/user/:userId', verifyToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  if (parseInt(userId) === 1 || parseInt(userId) === req.user.id) return res.status(403).json({ message: 'Este utilizador não pode ser excluído.' });
  
  try {
    const result = await dbRun('DELETE FROM users WHERE id = ?', [userId]);
    if (result.changes === 0) return res.status(404).json({ message: 'Utilizador não encontrado.' });
    res.json({ message: 'Utilizador excluído.' });
  } catch(err) {
    console.error("Erro ao excluir utilizador:", err.message);
    return res.status(500).json({ message: "Erro interno." });
  }
});

app.post('/api/admin/users/batch-delete', verifyToken, requireAdmin, async (req, res) => {
  const { userIds } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'Lista de IDs de utilizadores é obrigatória.' });
  }

  try {
    // Verificar se algum dos IDs é o admin principal (ID 1) ou o próprio usuário
    const invalidIds = userIds.filter(id => parseInt(id) === 1 || parseInt(id) === req.user.id);
    if (invalidIds.length > 0) {
      return res.status(403).json({ message: 'Não é possível excluir o administrador principal ou a sua própria conta.' });
    }

    // Criar placeholders para a query SQL
    const placeholders = userIds.map(() => '?').join(',');
    const result = await dbRun(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
    
    res.json({ 
      message: `${result.changes} utilizador(es) excluído(s) com sucesso.`,
      deletedCount: result.changes
    });
  } catch(err) {
    console.error("Erro ao excluir utilizadores em lote:", err.message);
    return res.status(500).json({ message: "Erro interno ao excluir utilizadores." });
  }
});

app.get('/api/admin/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const [totalUsers, pendingActivation, onlineNow, loginsLast24h] = await Promise.all([
      dbGet("SELECT COUNT(*) as count FROM users"),
      dbGet("SELECT COUNT(*) as count FROM users WHERE is_active = 0"),
      dbGet("SELECT COUNT(*) as count FROM users WHERE last_login_at >= datetime('now', '-15 minutes')"),
      dbGet("SELECT COUNT(*) as count FROM users WHERE last_login_at >= datetime('now', '-24 hours')")
    ]);
    res.json({
        totalUsers: totalUsers.count || 0,
        pendingActivation: pendingActivation.count || 0,
        onlineNow: onlineNow.count || 0,
        loginsLast24h: loginsLast24h.count || 0
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err.message);
    res.status(500).json({ message: 'Erro ao buscar estatísticas.' });
  }
});

app.post('/api/admin/app-settings', verifyToken, requireAdmin, async (req, res) => {
    const { settings } = req.body;
    try {
        for (const [key, value] of Object.entries(settings)) {
            await dbRun("REPLACE INTO app_settings (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
        }
        res.json({ message: 'Configuracoes da aplicacao salvas.' });
    } catch (err) {
        console.error("Erro ao salvar app settings:", err.message);
        res.status(500).json({ message: "Erro ao salvar configuracoes." });
    }
});

app.post('/api/admin/maintenance', verifyToken, requireAdmin, async (req, res) => {
  const { is_on, message } = req.body;
  try {
    await dbRun("REPLACE INTO app_status (key, value) VALUES ('maintenance', ?)", [JSON.stringify({ is_on, message })]);
    res.json({ message: 'Modo de manutenção atualizado.' });
  } catch(err) {
    console.error("Erro ao atualizar manutenção:", err.message);
    return res.status(500).json({ message: "Erro ao atualizar." });
  }
});

app.post('/api/admin/announcement', verifyToken, requireAdmin, async (req, res) => {
  const { message } = req.body;
  try {
    await dbRun("REPLACE INTO app_status (key, value) VALUES ('announcement', ?)", [message ? JSON.stringify({ message }) : 'null']);
    res.json({ message: 'Anúncio atualizado.' });
  } catch (err) {
    console.error("Erro ao atualizar anúncio:", err.message);
    return res.status(500).json({ message: "Erro ao atualizar." });
  }
});

// POST /api/admin/chat/enable - Habilitar/desabilitar chat
app.post('/api/admin/chat/enable', verifyToken, requireAdmin, async (req, res) => {
  const { enabled } = req.body;
  try {
    await dbRun("REPLACE INTO app_status (key, value) VALUES ('chat_enabled', ?)", [enabled ? 'true' : 'false']);
    
    // Se o chat foi desabilitado, limpar a fila de atendimento
    if (!enabled) {
      try {
        const queueItems = await dbAll('SELECT * FROM chat_queue WHERE status = ?', ['waiting']);
        if (queueItems && queueItems.length > 0) {
          await dbRun('DELETE FROM chat_queue WHERE status = ?', ['waiting']);
          console.log(`🧹 [CHAT] Fila limpa: ${queueItems.length} usuário(s) removido(s) da fila (chat desabilitado)`);
          
          // Notificar via WebSocket se disponível
          if (io) {
            io.emit('queue-updated', { action: 'cleared', reason: 'chat_disabled' });
          }
        }
      } catch (queueError) {
        console.error('❌ [CHAT] Erro ao limpar fila:', queueError.message);
        // Não falhar a requisição se houver erro ao limpar a fila
      }
    }
    
    res.json({ message: `Chat ${enabled ? 'habilitado' : 'desabilitado'} com sucesso!`, chatEnabled: enabled });
  } catch (err) {
    console.error("Erro ao atualizar status do chat:", err.message);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ADMIN ACADEMY ENDPOINTS
app.get('/api/admin/academy', verifyToken, requireAdmin, async (req, res) => {
    try {
        // Order by position for admin view
        const lessons = await dbAll("SELECT * FROM academy_lessons ORDER BY position ASC, created_at DESC");
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar aulas." });
    }
});

// Reorder this route to avoid conflict with /api/admin/academy/:id
app.put('/api/admin/academy/reorder', verifyToken, requireAdmin, async (req, res) => {
    const { newOrder } = req.body;
    if (!Array.isArray(newOrder) || newOrder.length === 0) {
        return res.status(400).json({ message: "Ordem inválida fornecida." });
    }

    try {
        await dbRun("BEGIN TRANSACTION");
        for (let i = 0; i < newOrder.length; i++) {
            const lessonId = newOrder[i];
            const newPosition = i + 1;
            await dbRun("UPDATE academy_lessons SET position = ? WHERE id = ?", [newPosition, lessonId]);
        }
        await dbRun("COMMIT");
        res.json({ message: "Ordem das aulas atualizada com sucesso." });
    } catch (err) {
        try {
            await dbRun("ROLLBACK");
        } catch (rollbackErr) {
            console.error("Erro ao reverter a transação:", rollbackErr.message);
        }
        console.error("Erro ao reordenar aulas:", err.message);
        res.status(500).json({ message: "Erro ao reordenar aulas." });
    }
});

app.post('/api/admin/academy', verifyToken, requireAdmin, async (req, res) => {
    const { title, description, youtube_url, file_url, file_name, tag_text, tag_position } = req.body;
    if (!title || !youtube_url) {
        return res.status(400).json({ message: "Título e URL do YouTube são obrigatórios." });
    }
    try {
        // Get the next available position
        const maxPositionRow = await dbGet("SELECT MAX(position) as max_pos FROM academy_lessons");
        const newPosition = (maxPositionRow.max_pos || 0) + 1;

        const result = await dbRun(
            'INSERT INTO academy_lessons (title, description, youtube_url, file_url, file_name, tag_text, tag_position, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, youtube_url, file_url, file_name, tag_text, tag_position, newPosition]
        );
        res.status(201).json({ id: result.lastID, position: newPosition });
    } catch (err) {
        console.error("Erro ao criar aula:", err.message);
        res.status(500).json({ message: "Erro ao criar aula." });
    }
});

app.put('/api/admin/academy/:id', verifyToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, description, youtube_url, file_url, file_name, tag_text, tag_position } = req.body;
    if (!title || !youtube_url) {
        return res.status(400).json({ message: "Título e URL do YouTube são obrigatórios." });
    }
    try {
        await dbRun(
            'UPDATE academy_lessons SET title = ?, description = ?, youtube_url = ?, file_url = ?, file_name = ?, tag_text = ?, tag_position = ? WHERE id = ?',
            [title, description, youtube_url, file_url, file_name, tag_text, tag_position, id]
        );
        res.json({ message: "Aula atualizada." });
    } catch (err) {
        console.error("Erro ao atualizar aula:", err.message);
        res.status(500).json({ message: "Erro ao atualizar aula." });
    }
});

app.delete('/api/admin/academy/:id', verifyToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('DELETE FROM academy_lessons WHERE id = ?', [id]);
        // Re-sequence positions after deletion
        const remainingLessons = await dbAll("SELECT id FROM academy_lessons ORDER BY position ASC");
        for (let i = 0; i < remainingLessons.length; i++) {
            await dbRun("UPDATE academy_lessons SET position = ? WHERE id = ?", [i + 1, remainingLessons[i].id]);
        }
        res.json({ message: "Aula excluída e posições atualizadas." });
    } catch (err) {
        console.error("Erro ao excluir aula:", err.message);
        res.status(500).json({ message: "Erro ao excluir aula." });
    }
});

// --- File Manager Endpoints (Admin) ---
app.get('/api/admin/files', verifyToken, requireAdmin, async (req, res) => {
    const currentPathRaw = req.query.path || '/';
    const currentPath = normalizePath(currentPathRaw);
    const absolutePath = resolveUploadPath(currentPath);

    try {
        const items = await fs.readdir(absolutePath, { withFileTypes: true });
        const files = items.map(item => ({
            name: item.name,
            is_directory: item.isDirectory(),
            path: path.join(currentPath, item.name).replace(/\\/g, '/') // Garante barras para URL
        }));
        res.json(files);
    } catch (err) {
        console.error("Erro ao listar arquivos:", err.message);
        res.status(500).json({ message: `Erro ao listar arquivos: ${err.message}` });
    }
});

app.post('/api/admin/files/folder', verifyToken, requireAdmin, async (req, res) => {
    const { folderName, currentPath } = req.body;
    if (!folderName) return res.status(400).json({ message: 'Nome da pasta é obrigatório.' });

    const targetPath = resolveUploadPath(path.join(currentPath || '/', folderName));
    
    // Verifica se o nome da pasta contém caracteres inválidos
    if (/[<>:"/\\|?*\x00-\x1F]/.test(folderName)) {
        return res.status(400).json({ message: 'Nome da pasta contém caracteres inválidos.' });
    }

    try {
        await fs.mkdir(targetPath, { recursive: true });
        res.status(201).json({ message: `Pasta '${folderName}' criada com sucesso.` });
    } catch (err) {
        console.error("Erro ao criar pasta:", err.message);
        res.status(500).json({ message: `Erro ao criar pasta: ${err.message}` });
    }
});

// Endpoint para adicionar movimentos ilimitados em imagens
app.post('/api/images/add-movements', verifyToken, async (req, res) => {
    try {
        const { imageData, movements = [] } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ 
                success: false,
                message: 'Dados da imagem são obrigatórios.' 
            });
        }
        
        const result = addUnlimitedImageMovements(imageData, movements);
        
        return res.json({
            success: true,
            message: 'Movimentos adicionados com sucesso!',
            data: result
        });
    } catch (error) {
        console.error('Erro ao adicionar movimentos:', error);
        return res.status(500).json({
            success: false,
            message: `Erro ao adicionar movimentos: ${error.message}`
        });
    }
});

// Endpoint para processar múltiplas imagens com movimentos
app.post('/api/images/batch-add-movements', verifyToken, async (req, res) => {
    try {
        const { images = [], movements = [] } = req.body;
        
        if (!Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Array de imagens é obrigatório.' 
            });
        }
        
        const results = await processImagesWithMovements(images, movements);
        
        return res.json({
            success: true,
            message: `${results.length} imagem(ns) processada(s) com sucesso!`,
            data: results
        });
    } catch (error) {
        console.error('Erro ao processar imagens:', error);
        return res.status(500).json({
            success: false,
            message: `Erro ao processar imagens: ${error.message}`
        });
    }
});

// Endpoint para animar imagens usando o Wisk do Google
app.post('/api/wisk/animate-image', verifyToken, async (req, res) => {
    const { imageUrl, imageBase64, mediaId, prompt, intensity = 'medium', aspectRatio, mode } = req.body;
    
    // Validação: precisa de pelo menos uma fonte de imagem
    if (!imageUrl && !imageBase64 && !mediaId) {
        return res.status(400).json({ 
            success: false,
            message: 'É necessário fornecer imageUrl, imageBase64 ou mediaId para animar a imagem.' 
        });
    }
    
    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        const wiskCookiesString = userSettings.wisk_cookies;
        
        if (!wiskCookiesString || (typeof wiskCookiesString === 'string' && wiskCookiesString.trim() === '')) {
            return res.status(400).json({ 
                success: false,
                message: 'Configure os cookies do Wisk nas configurações.' 
            });
        }
        
        // Formata os cookies do Wisk
        let cookiesForWisk;
        try {
            cookiesForWisk = formatCookiesForWisk(wiskCookiesString);
            console.log('✓ Cookies do Wisk formatados com sucesso.');
        } catch (error) {
            console.error('Erro ao formatar cookies do Wisk:', error.message);
            throw new Error('Erro ao processar cookies do Wisk. Verifique se os cookies estão no formato correto.');
        }
        
        // Obtém token de sessão do Wisk (similar ao ImageFX)
        let sessionToken = null;
        try {
            const sessionResponse = await axios.get('https://labs.google/fx/api/auth/session', {
                headers: {
                    Origin: 'https://labs.google',
                    Referer: 'https://labs.google/fx/tools/wisk',
                    Cookie: cookiesForWisk
                }
            });
            
            if (sessionResponse.status === 200 && sessionResponse.data?.access_token) {
                sessionToken = sessionResponse.data.access_token;
                console.log('✓ Sessão do Wisk autenticada com sucesso.');
            } else {
                throw new Error('Não foi possível obter token de sessão do Wisk.');
            }
        } catch (sessionError) {
            console.error('Erro ao autenticar sessão do Wisk:', sessionError.message);
            throw new Error(`Erro ao autenticar com o Wisk: ${sessionError.message}. Verifique os cookies.`);
        }
        
        // Prepara o workflowId e sessionId antes do upload para associar a imagem corretamente
        const sessionId = `;${Date.now()}`;
        const workflowId = crypto.randomUUID();
        
        // Prepara a imagem para upload/animação
        // IMPORTANTE: O mediaId do ImageFX pode não ser compatível com o Wisk
        // Sempre fazemos upload da imagem para obter um mediaId válido do Wisk
        let imageData = null;
        let finalMediaId = null;
        
        // Se tem mediaId do ImageFX, tenta várias formas de obter a imagem
        if (mediaId && !imageData) {
            // Tenta diferentes URLs possíveis para acessar a imagem do ImageFX
            const possibleUrls = [
                `https://storage.googleapis.com/ai-sandbox-videofx/image/${mediaId}`,
                `https://storage.googleapis.com/ai-sandbox-videofx/image/${encodeURIComponent(mediaId)}`,
                `https://aisandbox-pa.googleapis.com/v1/media/${encodeURIComponent(mediaId)}`,
                `https://labs.google/fx/api/media/${encodeURIComponent(mediaId)}`
            ];
            
            for (const imageUrl of possibleUrls) {
                try {
                    const imageResponse = await axios.get(imageUrl, { 
                        responseType: 'arraybuffer',
                        headers: {
                            'Authorization': `Bearer ${sessionToken}`,
                            'Cookie': cookiesForWisk,
                            'Origin': 'https://labs.google',
                            'Referer': 'https://labs.google/fx/tools/image-fx'
                        },
                        timeout: 10000
                    });
                    
                    if (imageResponse.status === 200 && imageResponse.data) {
                        imageData = Buffer.from(imageResponse.data);
                        console.log(`✅ Imagem baixada do ImageFX usando URL: ${imageUrl}`);
                        break;
                    }
                } catch (downloadError) {
                    // Tenta próxima URL
                    continue;
                }
            }
            
            if (!imageData) {
                console.warn('⚠️ Não foi possível baixar imagem do mediaId do ImageFX. Tentando com imageUrl ou imageBase64...');
            }
        }
        
        // Se não tem imageData ainda, tenta obter de imageBase64 ou imageUrl
        if (!imageData) {
            if (imageBase64) {
                // Remove o prefixo data:image/...;base64, se existir
                const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
                imageData = Buffer.from(base64Data, 'base64');
            } else if (imageUrl) {
                // Baixa a imagem da URL
                try {
                    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    imageData = Buffer.from(imageResponse.data);
                } catch (downloadError) {
                    throw new Error(`Erro ao baixar imagem da URL: ${downloadError.message}`);
                }
            }
        }
        
        // Sempre faz upload da imagem para o Wisk para obter um mediaId válido
        // O endpoint de upload pode precisar de formato diferente ou não ser necessário
        let uploadSuccess = false; // Declara fora do bloco para ser acessível depois
        
        if (imageData) {
            // Tenta diferentes métodos de upload
            // Opção 1: Upload direto via endpoint de media
            // Tenta incluir workflowId e sessionId no upload para associar a imagem
            const uploadEndpoints = [
                {
                    url: `https://aisandbox-pa.googleapis.com/v1/media?clientContext.tool=BACKBONE&clientContext.workflowId=${workflowId}&clientContext.sessionId=${encodeURIComponent(sessionId)}`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'image/png',
                        'Authorization': `Bearer ${sessionToken}`,
                        'Cookie': cookiesForWisk,
                        'Origin': 'https://labs.google',
                        'Referer': 'https://labs.google/fx/tools/wisk'
                    }
                },
                {
                    url: `https://aisandbox-pa.googleapis.com/v1:uploadMedia?clientContext.tool=BACKBONE&clientContext.workflowId=${workflowId}&clientContext.sessionId=${encodeURIComponent(sessionId)}`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'image/png',
                        'Authorization': `Bearer ${sessionToken}`,
                        'Cookie': cookiesForWisk,
                        'Origin': 'https://labs.google',
                        'Referer': 'https://labs.google/fx/tools/wisk'
                    }
                }
            ];
            for (const uploadConfig of uploadEndpoints) {
                try {
                    const uploadResponse = await axios.post(
                        uploadConfig.url,
                        imageData,
                        {
                            headers: uploadConfig.headers,
                            timeout: 30000
                        }
                    );
                    
                    if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                        // Tenta extrair mediaId da resposta
                        if (uploadResponse.data?.mediaId) {
                            finalMediaId = uploadResponse.data.mediaId;
                            console.log(`✅ Imagem enviada para o Wisk. MediaId: ${finalMediaId.substring(0, 50)}...`);
                            uploadSuccess = true;
                            break;
                        } else if (uploadResponse.data?.id) {
                            finalMediaId = uploadResponse.data.id;
                            console.log(`✅ Imagem enviada para o Wisk. MediaId: ${finalMediaId.substring(0, 50)}...`);
                            uploadSuccess = true;
                            break;
                        } else if (uploadResponse.headers?.location) {
                            // Pode retornar o mediaId no header Location
                            const locationMatch = uploadResponse.headers.location.match(/media\/([^\/\?]+)/);
                            if (locationMatch) {
                                finalMediaId = locationMatch[1];
                                console.log(`✅ Imagem enviada para o Wisk. MediaId extraído do header: ${finalMediaId.substring(0, 50)}...`);
                                uploadSuccess = true;
                                break;
                            }
                        }
                    }
                } catch (uploadError) {
                    console.warn(`⚠️ Falha no upload usando ${uploadConfig.url}:`, uploadError.response?.status || uploadError.message);
                    continue;
                }
            }
            
            if (!uploadSuccess && !finalMediaId) {
                // Se o upload falhou, mas temos imageData, podemos tentar enviar diretamente no payload
                // ou usar o mediaId original se disponível
                console.warn('⚠️ Upload falhou, mas continuando com mediaId original ou tentando sem upload...');
                console.warn('⚠️ ATENÇÃO: Usar mediaId do ImageFX pode causar erro "Pre-rewriter model config is required"');
                console.warn('⚠️ O Wisk pode não aceitar mediaId do ImageFX diretamente. Tente fornecer imageUrl ou imageBase64.');
                if (mediaId) {
                    finalMediaId = mediaId; // Usa o mediaId original como fallback (pode não funcionar)
                }
            }
        }
        
        if (!finalMediaId) {
            return res.status(400).json({
                success: false,
                message: 'Não foi possível obter ou criar mediaId para a imagem. É necessário fornecer imageUrl, imageBase64 ou mediaId válido.'
            });
        }
        
        // Prepara o payload para animação
        // sessionId e workflowId já foram gerados antes do upload para associar a imagem
        const projectId = crypto.randomUUID();
        
        // Mapeia a intensidade
        let animationIntensity = 'MEDIUM';
        if (intensity === 'low' || intensity === 'subtle') {
            animationIntensity = 'LOW';
        } else if (intensity === 'high' || intensity === 'strong') {
            animationIntensity = 'HIGH';
        }
        
        // Prepara o payload para animação (formato correto baseado na API real do Wisk)
        // O workflowId e sessionId já foram gerados antes e usados no upload
        
        // Estrutura final válida do Wisk (100% funcional e compatível)
        // Usa o mesmo formato do ImageFX: /video:batchAsyncGenerateVideoReferenceImages
        // Mapeia aspectRatio (padrão: LANDSCAPE)
        let aspectRatioFormatted = 'VIDEO_ASPECT_RATIO_LANDSCAPE';
        if (aspectRatio) {
            // Se aspectRatio já está no formato correto, usa diretamente
            if (aspectRatio.startsWith('VIDEO_ASPECT_RATIO_')) {
                aspectRatioFormatted = aspectRatio;
            } else {
                // Mapeia valores comuns
                if (aspectRatio === 'landscape' || aspectRatio === '16:9') {
                    aspectRatioFormatted = 'VIDEO_ASPECT_RATIO_LANDSCAPE';
                } else if (aspectRatio === 'portrait' || aspectRatio === '9:16') {
                    aspectRatioFormatted = 'VIDEO_ASPECT_RATIO_PORTRAIT';
                } else if (aspectRatio === 'square' || aspectRatio === '1:1') {
                    aspectRatioFormatted = 'VIDEO_ASPECT_RATIO_SQUARE';
                }
            }
        } else if (mode) {
            // Mapeia o parâmetro 'mode' para aspectRatio
            if (mode === 'portrait' || mode === '9:16') {
                aspectRatioFormatted = 'VIDEO_ASPECT_RATIO_PORTRAIT';
            } else if (mode === 'square' || mode === '1:1') {
                aspectRatioFormatted = 'VIDEO_ASPECT_RATIO_SQUARE';
            } else if (mode === 'landscape' || mode === '16:9' || mode === 'normal') {
                aspectRatioFormatted = 'VIDEO_ASPECT_RATIO_LANDSCAPE';
            }
        }
        
        // Função para enriquecer prompts curtos automaticamente
        // Solução prática: detecta prompts curtos e expande com contexto cinematográfico
        function enrichPrompt(promptText) {
            // Se for muito curto, expandir automaticamente
            if (!promptText || promptText.trim().split(' ').length < 5) {
                return `A cinematic, detailed, high-quality 4K video scene depicting ${promptText || 'the scene'}, with smooth motion and professional cinematography`;
            }
            return promptText;
        }
        
        // Enriquece o prompt antes de montar o payload
        const userPrompt = prompt && prompt.trim() ? prompt.trim() : 'animate this image';
        const enrichedPrompt = enrichPrompt(userPrompt);
        
        // Estrutura funcional do Wisk (baseada no imagefx.js)
        // Usa modelNameType, promptImageInput.mediaGenerationId, e workflowId
        const animatePayload = {
            clientContext: {
                sessionId: sessionId,
                tool: 'BACKBONE', // Wisk usa BACKBONE
                workflowId: workflowId
            },
            loopVideo: false,
            modelKey: 'veo_3_i2v_12step', // ModelKey estável (minúsculas) - não depende do pre-rewriter
            // modelNameType removido - não é necessário quando modelKey está presente e causa erro de valor inválido
            promptImageInput: {
                prompt: enrichedPrompt // Usa o prompt enriquecido
            },
            userInstructions: enrichedPrompt // Usa o prompt enriquecido também aqui
        };
        
        // Usa mediaGenerationId quando disponível
        // Nota: O campo "image" não é aceito em promptImageInput, apenas mediaGenerationId
        if (finalMediaId) {
            animatePayload.promptImageInput.mediaGenerationId = finalMediaId;
            console.log('✅ Usando mediaGenerationId:', finalMediaId.substring(0, 50) + '...');
            if (!uploadSuccess) {
                console.warn('⚠️ Usando mediaId do ImageFX (upload falhou). Pode não ser compatível com Wisk.');
            }
        } else {
            console.error('❌ ERRO: Nenhum mediaId disponível para enviar ao Wisk!');
            return res.status(400).json({
                success: false,
                message: 'Não foi possível obter mediaId para a imagem. O upload falhou e não há mediaId alternativo.'
            });
        }
        
        // Valida que modelKey está presente
        if (!animatePayload.modelKey) {
            console.error('❌ ERRO: modelKey ausente no payload!');
            console.error('Payload atual:', JSON.stringify(animatePayload, null, 2));
        }
        
        console.log('✅ Payload do Wisk usando estrutura funcional do imagefx.js');
        console.log('✅ ModelKey:', animatePayload.modelKey);
        
        // Se a imagem foi enviada como base64 e não tem mediaId, precisa fazer upload primeiro
        // (já tratado acima no código de upload)
        
        // Headers para a requisição (formato do exemplo funcional)
        const wiskHeaders = {
            'Content-Type': 'application/json', // Formato correto do exemplo funcional
            'Authorization': `Bearer ${sessionToken}`,
            'Cookie': cookiesForWisk,
            'Origin': 'https://labs.google',
            'Referer': 'https://labs.google/fx/tools/wisk'
        };
        
        // Endpoint correto: whisk:generateVideo (do exemplo funcional)
        const animateEndpoint = 'https://aisandbox-pa.googleapis.com/v1/whisk:generateVideo';
        
        const payloadString = JSON.stringify(animatePayload);
        
        console.log('💡 Payload enviado para a API do Wisk:');
        console.log(payloadString);
        console.log(`🔄 Usando endpoint: ${animateEndpoint}`);
        console.log(`🔑 MediaId do upload: ${finalMediaId ? finalMediaId.substring(0, 50) + '...' : 'N/A'}`);
        
        // Headers adicionais baseados na requisição real do Wisk
        const enhancedWiskHeaders = {
            ...wiskHeaders,
            'x-browser-channel': 'stable',
            'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
            'x-browser-year': '2025',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site'
        };
        
        try {
            const response = await axios.post(animateEndpoint, payloadString, {
                headers: enhancedWiskHeaders,
                timeout: 120000, // 2 minutos de timeout
                validateStatus: (status) => status < 600
            });
            
            if (response.status === 200 || response.status === 202) {
                console.log('✅ Resposta recebida da API do Wisk:', JSON.stringify(response.data, null, 2));
                
                const responseData = response.data;
                
                // Extrai o videoId/animatedMediaId da resposta
                // Como agora usa o mesmo endpoint do ImageFX, a resposta pode ter o mesmo formato
                let animatedVideoId = null;
                let animatedVideoUrl = null;
                let animatedVideoBase64 = null;
                
                // Formato do endpoint /video:batchAsyncGenerateVideoReferenceImages
                if (responseData.videoId) {
                    animatedVideoId = responseData.videoId;
                } else if (responseData.videos && responseData.videos.length > 0 && responseData.videos[0].videoId) {
                    animatedVideoId = responseData.videos[0].videoId;
                } else if (responseData.responses && responseData.responses.length > 0) {
                    const firstResponse = responseData.responses[0];
                    animatedVideoId = firstResponse.videoId || firstResponse.id || firstResponse.generationId;
                } else if (responseData.id) {
                    animatedVideoId = responseData.id;
                } else if (responseData.jobId) {
                    animatedVideoId = responseData.jobId;
                } else if (responseData.operation?.operation?.name) {
                    // Formato antigo do Wisk (fallback)
                    animatedVideoId = responseData.operation.operation.name;
                } else if (responseData.operation?.name) {
                    animatedVideoId = responseData.operation.name;
                } else if (responseData.name) {
                    animatedVideoId = responseData.name;
                }
                
                if (animatedVideoId) {
                    console.log(`✅ JobId extraído da resposta: ${animatedVideoId}`);
                }
                
                // Se retornou vídeo diretamente
                if (animatedVideoUrl || animatedVideoBase64) {
                    return res.json({
                        success: true,
                        videoUrl: animatedVideoUrl,
                        videoBase64: animatedVideoBase64,
                        videoId: animatedVideoId,
                        message: 'Imagem animada com sucesso!',
                        data: responseData
                    });
                }
                
                // Se retornou jobId para polling
                if (animatedVideoId) {
                    return res.status(202).json({
                        success: true,
                        jobId: animatedVideoId,
                        videoId: animatedVideoId,
                        message: 'Animação iniciada. Use o jobId para verificar o status.',
                        data: responseData,
                        statusEndpoint: `/api/wisk/animation-status/${animatedVideoId}`
                    });
                }
                
                // Se não reconhece o formato, retorna a resposta completa
                console.log('⚠️ Formato de resposta não reconhecido. Retornando resposta completa.');
                return res.json({
                    success: true,
                    message: 'Animação iniciada. Verifique a resposta para mais detalhes.',
                    data: responseData
                });
            }
            
            // Tratamento de erros
            const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            console.error(`❌ Erro ${response.status} ao animar imagem:`, errorText);
            
            return res.status(response.status).json({
                success: false,
                message: `Erro ao animar imagem: ${response.status}`,
                error: response.data,
                data: response.data
            });
            
        } catch (error) {
            console.error('❌ Erro ao animar imagem:', error.message);
            
            if (error.response) {
                const errorData = error.response.data;
                const statusCode = error.response.status || 500;
                console.error('Resposta de erro:', JSON.stringify(errorData, null, 2));
                
                return res.status(statusCode).json({
                    success: false,
                    message: `Erro ao animar imagem: ${statusCode}`,
                    error: errorData,
                    data: errorData
                });
            }
            
            return res.status(500).json({
                success: false,
                message: `Não foi possível animar a imagem: ${error.message}`,
                error: error.message
            });
        }
    } catch (error) {
        console.error('=== ERRO AO ANIMAR IMAGEM COM WISK ===');
        console.error('Mensagem de erro:', error.message);
        
        return res.status(500).json({
            success: false,
            message: `Não foi possível animar a imagem: ${error.message}`
        });
    }
});

// Endpoint para verificar o status de animação do Wisk
app.post('/api/wisk/animation-status/:jobId', verifyToken, async (req, res) => {
    const { jobId } = req.params;
    
    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        const wiskCookiesString = userSettings.wisk_cookies;
        
        if (!wiskCookiesString || (typeof wiskCookiesString === 'string' && wiskCookiesString.trim() === '')) {
            return res.status(400).json({ message: 'Configure os cookies do Wisk nas configurações.' });
        }
        
        // Formata os cookies do Wisk
        let cookiesForWisk;
        try {
            cookiesForWisk = formatCookiesForWisk(wiskCookiesString);
        } catch (error) {
            console.error('Erro ao formatar cookies do Wisk:', error.message);
            throw new Error('Erro ao processar cookies do Wisk. Verifique se os cookies estão no formato correto.');
        }
        
        // Obtém token de sessão
        let sessionToken = null;
        try {
            const sessionResponse = await axios.get('https://labs.google/fx/api/auth/session', {
                headers: {
                    Origin: 'https://labs.google',
                    Referer: 'https://labs.google/fx/tools/wisk',
                    Cookie: cookiesForWisk
                }
            });
            
            if (sessionResponse.status === 200 && sessionResponse.data?.access_token) {
                sessionToken = sessionResponse.data.access_token;
            } else {
                throw new Error('Não foi possível obter token de sessão do Wisk.');
            }
        } catch (sessionError) {
            console.error('Erro ao autenticar sessão do Wisk:', sessionError.message);
            throw new Error(`Erro ao autenticar com o Wisk: ${sessionError.message}. Verifique os cookies.`);
        }
        
        // Headers para a requisição
        const wiskHeaders = {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Authorization': `Bearer ${sessionToken}`,
            'Cookie': cookiesForWisk,
            'Origin': 'https://labs.google',
            'Referer': 'https://labs.google/fx/tools/wisk'
        };
        
        // Endpoint para verificar status de operações assíncronas do Google
        // O formato padrão do Google para operações assíncronas é: operations/{name}
        const statusEndpoints = [
            `https://aisandbox-pa.googleapis.com/v1/operations/${jobId}`,
            `https://aisandbox-pa.googleapis.com/v1:checkWiskStatus`,
            `https://aisandbox-pa.googleapis.com/v1/media/${jobId}`
        ];
        
        let lastStatusError = null;
        for (const statusEndpoint of statusEndpoints) {
            try {
                console.log(`🔄 Verificando status da animação ${jobId} no endpoint: ${statusEndpoint}...`);
                
                // Para operações assíncronas do Google, geralmente é um GET
                const methods = ['GET', 'POST'];
                const statusPayloads = [
                    null, // Para GET
                    JSON.stringify({ name: jobId }),
                    JSON.stringify({ operation: { name: jobId } })
                ];
                
                for (let i = 0; i < methods.length; i++) {
                    const method = methods[i];
                    const statusPayload = i === 0 ? null : statusPayloads[i];
                    
                    try {
                        let response;
                        if (method === 'GET') {
                            response = await axios.get(statusEndpoint, {
                                headers: wiskHeaders,
                                timeout: 30000
                            });
                        } else {
                            response = await axios.post(statusEndpoint, statusPayload, {
                                headers: wiskHeaders,
                                timeout: 30000
                            });
                        }
                        
                        if (response.status === 200) {
                            const responseData = response.data;
                            console.log('✅ Status da animação:', JSON.stringify(responseData, null, 2));
                            
                            // Processa a resposta do status
                            // Formato do Wisk: operation.operation.status ou operation.status
                            let animationStatus = 'unknown';
                            let videoUrl = null;
                            let videoBase64 = null;
                            let operationData = null;
                            
                            // Tenta diferentes formatos de resposta
                            // Formato do Wisk pode ser: operations[0].operation.status ou operation.operation.status
                            if (responseData.operations && Array.isArray(responseData.operations) && responseData.operations.length > 0) {
                                // Formato com array de operations
                                const firstOp = responseData.operations[0];
                                if (firstOp.operation?.status) {
                                    operationData = firstOp.operation;
                                    animationStatus = firstOp.operation.status;
                                } else if (firstOp.status) {
                                    operationData = firstOp;
                                    animationStatus = firstOp.status;
                                }
                            } else if (responseData.operation?.operation?.status) {
                                operationData = responseData.operation.operation;
                                animationStatus = responseData.operation.operation.status;
                            } else if (responseData.operation?.status) {
                                operationData = responseData.operation;
                                animationStatus = responseData.operation.status;
                            } else if (responseData.status) {
                                animationStatus = responseData.status;
                                operationData = responseData;
                            } else if (responseData.state) {
                                animationStatus = responseData.state;
                                operationData = responseData;
                            } else if (responseData.animatedVideo) {
                                animationStatus = responseData.animatedVideo.status || 'completed';
                                videoUrl = responseData.animatedVideo.url || responseData.animatedVideo.videoUrl;
                                videoBase64 = responseData.animatedVideo.base64 || responseData.animatedVideo.encodedVideo;
                                operationData = responseData.animatedVideo;
                            }
                            
                            // Normaliza o status
                            const normalizedStatus = animationStatus.toLowerCase().replace(/[_-]/g, '');
                            
                            // Verifica se a operação falhou
                            if (normalizedStatus.includes('failed') || normalizedStatus.includes('error') || normalizedStatus.includes('failure')) {
                                // Extrai informações de erro
                                let errorMessage = 'A animação falhou';
                                let errorCode = null;
                                
                                // Tenta extrair erro de diferentes formatos
                                if (responseData.operations?.[0]?.operation?.error) {
                                    // Formato mais comum: operations[0].operation.error
                                    const error = responseData.operations[0].operation.error;
                                    errorCode = error.code;
                                    errorMessage = error.message || errorMessage;
                                    console.error('❌ Erro detectado no Wisk:', {
                                        code: errorCode,
                                        message: errorMessage,
                                        fullError: error
                                    });
                                } else if (operationData?.error) {
                                    errorCode = operationData.error.code;
                                    errorMessage = operationData.error.message || errorMessage;
                                    console.error('❌ Erro detectado no Wisk (operationData):', {
                                        code: errorCode,
                                        message: errorMessage
                                    });
                                } else if (responseData.error) {
                                    errorCode = responseData.error.code;
                                    errorMessage = responseData.error.message || errorMessage;
                                    console.error('❌ Erro detectado no Wisk (responseData):', {
                                        code: errorCode,
                                        message: errorMessage
                                    });
                                } else {
                                    console.error('⚠️ Status indica falha mas erro não encontrado na estrutura esperada');
                                    console.error('📋 Resposta completa:', JSON.stringify(responseData, null, 2));
                                }
                                
                                // Limpa a mensagem de erro se for muito longa
                                if (errorMessage && errorMessage.length > 500) {
                                    errorMessage = errorMessage.substring(0, 500) + '...';
                                }
                                
                                return res.status(500).json({
                                    success: false,
                                    jobId: jobId,
                                    status: animationStatus,
                                    message: `Animação falhou: ${errorMessage}`,
                                    error: {
                                        code: errorCode,
                                        message: errorMessage
                                    },
                                    data: responseData
                                });
                            }
                            
                            // Se a animação está pronta
                            if (normalizedStatus.includes('completed') || normalizedStatus.includes('ready') || 
                                normalizedStatus.includes('done') || normalizedStatus.includes('success') ||
                                normalizedStatus.includes('succeeded')) {
                                
                                // Tenta extrair a URL do vídeo
                                if (operationData?.videoUrl || operationData?.url || operationData?.mediaUrl) {
                                    videoUrl = operationData.videoUrl || operationData.url || operationData.mediaUrl;
                                } else if (responseData.videoUrl || responseData.url || responseData.mediaUrl) {
                                    videoUrl = responseData.videoUrl || responseData.url || responseData.mediaUrl;
                                }
                                
                                if (videoUrl || videoBase64) {
                                    return res.json({
                                        success: true,
                                        jobId: jobId,
                                        status: animationStatus,
                                        videoUrl: videoUrl,
                                        videoBase64: videoBase64,
                                        message: 'Animação concluída com sucesso!',
                                        data: responseData
                                    });
                                }
                            }
                            
                            // Se ainda está processando
                            const isProcessing = animationStatus === 'processing' || animationStatus === 'pending' || animationStatus === 'in_progress';
                            return res.json({
                                success: true,
                                jobId: jobId,
                                status: animationStatus,
                                message: isProcessing ? 'Animação ainda está sendo processada...' : `Status: ${animationStatus}`,
                                data: responseData
                            });
                        }
                    } catch (payloadError) {
                        if (payloadError.response && payloadError.response.status >= 400 && payloadError.response.status < 500) {
                            continue; // Tenta próximo payload
                        }
                        throw payloadError;
                    }
                }
            } catch (endpointError) {
                lastStatusError = endpointError;
                if (endpointError.response && endpointError.response.status >= 400 && endpointError.response.status < 500) {
                    continue; // Tenta próximo endpoint
                }
                break;
            }
        }
        
        // Se nenhum endpoint funcionou, retorna erro
        return res.status(400).json({
            success: false,
            message: `Não foi possível verificar o status da animação.`,
            error: lastStatusError ? lastStatusError.message : 'Todos os endpoints falharam'
        });
        
    } catch (error) {
        console.error('=== ERRO AO VERIFICAR STATUS DA ANIMAÇÃO ===');
        console.error('Mensagem de erro:', error.message);
        
        return res.status(400).json({
            success: false,
            message: `Não foi possível verificar o status da animação: ${error.message}`
        });
    }
});

// Endpoint antigo de upload removido - substituído por função de movimentos ilimitados
app.post('/api/admin/files/upload', verifyToken, requireAdmin, async (req, res) => {
    return res.status(410).json({ 
        message: 'Endpoint de upload removido. Use /api/images/add-movements para adicionar movimentos ilimitados em imagens.',
        newEndpoint: '/api/images/add-movements',
        alternative: '/api/images/batch-add-movements'
    });
});

app.delete('/api/admin/files', verifyToken, requireAdmin, async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ message: 'Caminho do arquivo/pasta é obrigatório.' });

    const absolutePath = resolveUploadPath(filePath);

    // Segurança: Garante que o caminho está dentro de UPLOADS_DIR
    if (!absolutePath.startsWith(UPLOADS_DIR)) {
        return res.status(403).json({ message: 'Operação não permitida fora do diretório de uploads.' });
    }

    try {
        const stats = await fs.stat(absolutePath);
        if (stats.isDirectory()) {
            await fs.rm(absolutePath, { recursive: true, force: true }); // Deleta diretório e conteúdo
            res.json({ message: `Pasta '${filePath}' e seu conteúdo excluídos com sucesso.` });
        } else {
            await fs.unlink(absolutePath); // Deleta arquivo
            res.json({ message: `Arquivo '${filePath}' excluído com sucesso.` });
        }
    } catch (err) {
        console.error("Erro ao excluir arquivo/pasta:", err.message);
        res.status(500).json({ message: `Erro ao excluir: ${err.message}` });
    }
});

// --- Public Downloads Endpoint (Authenticated Users) ---
app.get('/api/downloads', verifyToken, async (req, res) => {
    const currentPathRaw = req.query.path || '/';
    const currentPath = normalizePath(currentPathRaw);
    const absolutePath = resolveUploadPath(currentPath);

    // Segurança: Garante que o caminho está dentro de UPLOADS_DIR
    if (!absolutePath.startsWith(UPLOADS_DIR)) {
        return res.status(403).json({ message: 'Acesso não permitido fora do diretório de downloads.' });
    }

    try {
        const items = await fs.readdir(absolutePath, { withFileTypes: true });
        const files = items.map(item => ({
            name: item.name,
            is_directory: item.isDirectory(),
            // Para download, o path deve ser relativo à raiz pública
            download_url: item.isFile() ? `/uploads/${path.join(currentPath, item.name).replace(/\\/g, '/')}` : null,
            path: path.join(currentPath, item.name).replace(/\\/g, '/')
        }));
        res.json(files);
    } catch (err) {
        console.error("Erro ao listar downloads:", err.message);
        res.status(500).json({ message: `Erro ao listar downloads: ${err.message}` });
    }
});

// Endpoint para servir arquivos para download (autenticado)
app.get('/uploads/*', verifyToken, (req, res) => {
    const filePath = req.params[0]; // O caminho após /uploads/
    const absolutePath = resolveUploadPath(filePath);

    // Segurança: Garante que o arquivo está dentro de UPLOADS_DIR
    if (!absolutePath.startsWith(UPLOADS_DIR)) {
        return res.status(403).send('Acesso negado.');
    }

    res.download(absolutePath, (err) => {
        if (err) {
            console.error("Erro ao baixar arquivo:", err.message);
            if (err.code === 'ENOENT') {
                return res.status(404).send('Arquivo não encontrado.');
            }
            res.status(500).send('Erro ao baixar o arquivo.');
        }
    });
});

async function startServer() {
    try {
        db = await new Promise((resolve, reject) => {
            const database = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Erro ao conectar ao SQLite:', err.message);
                    reject(err);
                } else {
                    resolve(database);
                }
            });
        });
        console.log(`Conectado ao banco de dados SQLite em: ${DB_PATH}`);

        // Habilitar modo WAL para suportar múltiplos usuários simultâneos
        // WAL permite leituras e escritas concorrentes sem bloqueios
        try {
            await dbRun("PRAGMA journal_mode = WAL");
            await dbRun("PRAGMA synchronous = NORMAL");
            await dbRun("PRAGMA busy_timeout = 5000"); // Timeout de 5 segundos para operações concorrentes
            console.log("✅ Modo WAL habilitado para acesso concorrente ao banco de dados");
        } catch (walError) {
            console.warn("⚠️ Aviso: Não foi possível habilitar modo WAL:", walError.message);
            console.warn("⚠️ A aplicação continuará funcionando, mas pode ter limitações com múltiplos usuários simultâneos");
        }

        await initializeDb();
        
        // Endpoint de diagnóstico do sistema (para verificar FFMPEG)
        app.get('/api/system/diagnostics', async (req, res) => {
            try {
                const ffmpegAvailable = await checkFfmpegAvailable();
                res.json({
                    success: true,
                    ffmpeg: {
                        available: ffmpegAvailable,
                        path: ffmpegPath,
                        status: ffmpegAvailable ? 'OK' : 'Não disponível'
                    },
                    server: {
                        nodeVersion: process.version,
                        platform: process.platform,
                        uptime: process.uptime()
                    }
                });
            } catch (error) {
                console.error('Erro ao obter diagnósticos:', error);
                res.status(500).json({
                    success: false,
                    message: error.message
                });
            }
        });

        // ================================================
        // 💬 SISTEMA DE CHAT - Endpoints de API
        // ================================================

        // Armazenamento de usuários online (em memória)
        const onlineUsers = new Map(); // userId -> { socketId, lastSeen }

        // Função helper para verificar se chat está habilitado antes de fazer logs
        const isChatEnabled = async () => {
            try {
                const row = await dbGet("SELECT value FROM app_status WHERE key = 'chat_enabled'");
                return row?.value === 'true' || row === undefined; // Default: true se não existir
            } catch (err) {
                return true; // Default: true em caso de erro
            }
        };

        // WebSocket - Autenticação e conexão
        io.use((socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
            if (!token) {
                return next(new Error('Token não fornecido'));
            }
            jwt.verify(token, JWT_SECRET, (err, decoded) => {
                if (err) {
                    return next(new Error('Token inválido'));
                }
                socket.userId = decoded.id;
                socket.userRole = decoded.role;
                next();
            });
        });

        io.on('connection', async (socket) => {
            const userId = socket.userId;
            const userRole = socket.userRole;

            const chatEnabled = await isChatEnabled();
            const logChat = (...args) => {
                if (chatEnabled) {
                    console.log(...args);
                }
            };
            
            logChat(`💬 Usuário ${userId} conectado ao chat (socket: ${socket.id})`);

            // Marcar usuário como online
            onlineUsers.set(userId, {
                socketId: socket.id,
                lastSeen: new Date()
            });
            dbRun('INSERT OR REPLACE INTO chat_online_status (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP)', [userId]).catch(err => console.error('Erro ao atualizar status online:', err));

            // Notificar outros usuários sobre status online
            socket.broadcast.emit('user-online', { userId });

            // Entrar na sala do usuário
            socket.join(`user-${userId}`);
            if (userRole === 'admin' || userRole === 'attendant') {
                socket.join('attendants');
            }

            // Receber mensagem
            socket.on('send-message', async (data) => {
                try {
                    const { conversationId, message, messageType = 'text' } = data;
                    if (!conversationId || !message) {
                        return socket.emit('error', { message: 'Dados inválidos' });
                    }

                    // Verificar se a conversa existe e pertence ao usuário
                    const conversation = await dbGet(
                        'SELECT * FROM chat_conversations WHERE id = ? AND (user_id = ? OR attendant_id = ?)',
                        [conversationId, userId, userId]
                    );

                    if (!conversation) {
                        return socket.emit('error', { message: 'Conversa não encontrada' });
                    }

                    // Inserir mensagem
                    const result = await dbRun(
                        'INSERT INTO chat_messages (conversation_id, sender_id, message, message_type) VALUES (?, ?, ?, ?)',
                        [conversationId, userId, message, messageType]
                    );

                    // Atualizar última mensagem da conversa
                    await dbRun(
                        'UPDATE chat_conversations SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [conversationId]
                    );

                    const newMessage = {
                        id: result.lastID,
                        conversation_id: conversationId,
                        sender_id: userId,
                        message,
                        message_type: messageType,
                        is_read: 0,
                        created_at: new Date().toISOString()
                    };

                    // Enviar para todos na conversa
                    io.to(`conversation-${conversationId}`).emit('new-message', newMessage);

                    // Notificar o outro participante
                    const otherUserId = conversation.user_id === userId ? conversation.attendant_id : conversation.user_id;
                    if (otherUserId) {
                        io.to(`user-${otherUserId}`).emit('conversation-updated', { conversationId });
                    }
                } catch (error) {
                    console.error('Erro ao enviar mensagem:', error);
                    socket.emit('error', { message: 'Erro ao enviar mensagem' });
                }
            });

            // Entrar em uma conversa
            socket.on('join-conversation', (conversationId) => {
                socket.join(`conversation-${conversationId}`);
            });

            // Sair de uma conversa
            socket.on('leave-conversation', (conversationId) => {
                socket.leave(`conversation-${conversationId}`);
            });

            // Atividade do usuário (para acesso remoto)
            socket.on('user-activity', (data) => {
                // Broadcast para atendentes
                socket.to('attendants').emit('user-activity-update', {
                    userId,
                    activity: data
                });
            });

            // Receber evento de acesso remoto
            socket.on('remote-access', (data) => {
                // Processar comandos remotos se necessário
                console.log(`🔧 Acesso remoto recebido para usuário ${userId}:`, data);
            });
            
            // Escutar solicitações de acesso remoto do atendente
            socket.on('remote-access-request', async (data) => {
                try {
                    const { userId: targetUserId, action, data: actionData } = data;
                    const requesterId = userId;
                    
                    // Verificar se o solicitante é admin ou atendente
                    const requester = await dbGet('SELECT role FROM users WHERE id = ?', [requesterId]);
                    if (!requester || (requester.role !== 'admin' && requester.role !== 'attendant')) {
                        console.error('❌ [REMOTE] Usuário não autorizado a solicitar acesso remoto');
                        return;
                    }
                    
                    console.log(`🔧 [REMOTE] Solicitação de acesso remoto de ${requesterId} para ${targetUserId}`);
                    
                    // Enviar evento para o usuário alvo
                    io.to(`user-${targetUserId}`).emit('remote-access', {
                        action,
                        data: actionData,
                        from: requesterId
                    });
                } catch (error) {
                    console.error('❌ [REMOTE] Erro ao processar solicitação de acesso remoto:', error);
                }
            });
            
            // Escutar respostas de acesso remoto do usuário
            socket.on('remote-access-response', async (data) => {
                try {
                    const { accepted, userId: responderId } = data;
                    const requesterId = userId;
                    
                    console.log(`🔧 [REMOTE] Resposta de acesso remoto: ${accepted ? 'aceito' : 'recusado'} por ${responderId}`);
                    
                    // Notificar o solicitante (atendente)
                    io.to(`user-${requesterId}`).emit('remote-access-response', {
                        accepted,
                        userId: responderId
                    });
                } catch (error) {
                    console.error('❌ [REMOTE] Erro ao processar resposta de acesso remoto:', error);
                }
            });
            
            // Escutar compartilhamento de tela do usuário
            socket.on('remote-screen-share', async (data) => {
                try {
                    const { userId, image, timestamp } = data;
                    console.log(`📺 [REMOTE] Recebendo compartilhamento de tela do usuário ${userId}`);
                    
                    // Buscar conversas abertas com este usuário para encontrar o atendente
                    const conversation = await dbGet(
                        'SELECT attendant_id FROM chat_conversations WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1', 
                        [userId, 'open']
                    );
                    
                    if (conversation && conversation.attendant_id) {
                        console.log(`📺 [REMOTE] Enviando tela para atendente ${conversation.attendant_id}`);
                        io.to(`user-${conversation.attendant_id}`).emit('remote-screen-update', {
                            userId: parseInt(userId),
                            image,
                            timestamp
                        });
                    } else {
                        // Se não encontrar conversa, enviar para todos os atendentes conectados
                        console.log(`⚠️ [REMOTE] Conversa não encontrada para usuário ${userId}, enviando broadcast para atendentes`);
                        // Enviar broadcast para todos (atendentes podem filtrar)
                        io.emit('remote-screen-update', {
                            userId: parseInt(userId),
                            image,
                            timestamp
                        });
                    }
                } catch (error) {
                    console.error('❌ [REMOTE] Erro ao processar compartilhamento de tela:', error);
                }
            });
            
            // Escutar fim de compartilhamento
            socket.on('remote-screen-share-end', (data) => {
                try {
                    const { userId } = data;
                    dbGet('SELECT attendant_id FROM chat_conversations WHERE user_id = ? AND status = ?', [userId, 'open'])
                        .then(conversation => {
                            if (conversation && conversation.attendant_id) {
                                io.to(`user-${conversation.attendant_id}`).emit('remote-screen-end', { userId });
                            }
                        })
                        .catch(err => console.error('Erro ao buscar conversa:', err));
                } catch (error) {
                    console.error('❌ [REMOTE] Erro ao processar fim de compartilhamento:', error);
                }
            });
            
            // Escutar comandos remotos do atendente
            socket.on('remote-command-send', (data) => {
                try {
                    const { targetUserId, command } = data;
                    // Enviar comando para o usuário alvo
                    io.to(`user-${targetUserId}`).emit('remote-command', command);
                } catch (error) {
                    console.error('❌ [REMOTE] Erro ao enviar comando remoto:', error);
                }
            });

            // Marcar mensagens como lidas
            socket.on('mark-read', async (data) => {
                try {
                    const { conversationId } = data;
                    // Marcar como lida baseado no papel do usuário
                    const conversation = await dbGet('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
                    if (conversation) {
                        if (conversation.user_id === userId) {
                            await dbRun(
                                'UPDATE chat_messages SET is_read_by_user = 1 WHERE conversation_id = ? AND sender_id != ?',
                                [conversationId, userId]
                            );
                        } else if (conversation.attendant_id === userId) {
                            await dbRun(
                                'UPDATE chat_messages SET is_read_by_attendant = 1 WHERE conversation_id = ? AND sender_id != ?',
                                [conversationId, userId]
                            );
                        }
                    }
                    io.to(`conversation-${conversationId}`).emit('messages-read', { conversationId });
                } catch (error) {
                    console.error('Erro ao marcar mensagens como lidas:', error);
                }
            });

            // Desconexão
            socket.on('disconnect', async () => {
                const chatEnabledDisconnect = await isChatEnabled();
                if (chatEnabledDisconnect) {
                    console.log(`💬 Usuário ${userId} desconectado do chat`);
                }
                onlineUsers.delete(userId);
                dbRun('UPDATE chat_online_status SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]).catch(err => console.error('Erro ao atualizar status offline:', err));
                socket.broadcast.emit('user-offline', { userId });
            });
        });

        // GET /api/chat/conversations - Listar conversas do usuário
        app.get('/api/chat/conversations', verifyToken, async (req, res) => {
            try {
                const userId = req.user.id;
                const userRole = req.user.role;

                let conversations;
                if (userRole === 'admin' || userRole === 'attendant') {
                    // Atendentes veem todas as conversas
                    conversations = await dbAll(`
                        SELECT c.*, 
                               u.email as user_email,
                               u.whatsapp as user_whatsapp,
                               a.email as attendant_email,
                               (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND sender_id != ? AND is_read_by_attendant = 0) as unread_count
                        FROM chat_conversations c
                        LEFT JOIN users u ON c.user_id = u.id
                        LEFT JOIN users a ON c.attendant_id = a.id
                        ORDER BY c.last_message_at DESC, c.created_at DESC
                    `, [userId]);
                } else {
                    // Usuários veem apenas suas conversas
                    conversations = await dbAll(`
                        SELECT c.*,
                               a.email as attendant_email,
                               (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id AND sender_id != ? AND is_read_by_user = 0) as unread_count
                        FROM chat_conversations c
                        LEFT JOIN users a ON c.attendant_id = a.id
                        WHERE c.user_id = ?
                        ORDER BY c.last_message_at DESC, c.created_at DESC
                    `, [userId, userId]);
                }

                res.json(conversations);
            } catch (error) {
                console.error('Erro ao listar conversas:', error);
                res.status(500).json({ message: 'Erro ao listar conversas' });
            }
        });

        // GET /api/chat/messages/:conversationId - Listar mensagens de uma conversa
        app.get('/api/chat/messages/:conversationId', verifyToken, async (req, res) => {
            try {
                const { conversationId } = req.params;
                const userId = req.user.id;

                // Verificar se a conversa existe e pertence ao usuário
                const userRole = req.user.role;
                let conversation;
                if (userRole === 'admin' || userRole === 'attendant') {
                    // Admins podem ver qualquer conversa
                    conversation = await dbGet('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
                } else {
                    conversation = await dbGet(
                        'SELECT * FROM chat_conversations WHERE id = ? AND (user_id = ? OR attendant_id = ?)',
                        [conversationId, userId, userId]
                    );
                }

                if (!conversation) {
                    return res.status(404).json({ message: 'Conversa não encontrada' });
                }

                const messages = await dbAll(
                    'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY timestamp ASC, created_at ASC',
                    [conversationId]
                );

                res.json(messages);
            } catch (error) {
                console.error('Erro ao listar mensagens:', error);
                res.status(500).json({ message: 'Erro ao listar mensagens' });
            }
        });

        // POST /api/chat/messages/:messageId/read - Marcar mensagem como lida
        app.post('/api/chat/messages/:messageId/read', verifyToken, async (req, res) => {
            try {
                const { messageId } = req.params;
                const userId = req.user.id;
                const userRole = req.user.role;

                // Buscar mensagem
                const message = await dbGet('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
                if (!message) {
                    return res.status(404).json({ message: 'Mensagem não encontrada' });
                }

                // Verificar se a mensagem pertence à conversa do usuário
                const conversation = await dbGet('SELECT * FROM chat_conversations WHERE id = ?', [message.conversation_id]);
                if (!conversation) {
                    return res.status(404).json({ message: 'Conversa não encontrada' });
                }

                // Marcar como lida
                if (userRole === 'admin' || userRole === 'attendant') {
                    // Se for atendente/admin e a mensagem não foi enviada por ele, marcar como lida pelo atendente
                    if (message.sender_id !== userId) {
                        await dbRun(
                            'UPDATE chat_messages SET is_read_by_attendant = 1 WHERE id = ?',
                            [messageId]
                        );
                    }
                } else {
                    // Se for usuário normal e a mensagem não foi enviada por ele, marcar como lida pelo usuário
                    if (message.sender_id !== userId) {
                        await dbRun(
                            'UPDATE chat_messages SET is_read_by_user = 1 WHERE id = ?',
                            [messageId]
                        );
                    }
                }

                // Notificar via WebSocket
                if (io) {
                    io.to(`conversation-${message.conversation_id}`).emit('message-read', { messageId });
                }

                res.json({ success: true });
            } catch (error) {
                console.error('Erro ao marcar mensagem como lida:', error);
                res.status(500).json({ message: 'Erro ao marcar mensagem como lida' });
            }
        });

        // POST /api/chat/send - Enviar mensagem
        app.post('/api/chat/send', verifyToken, async (req, res) => {
            try {
                // Verificar se o chat está habilitado
                const chatStatus = await dbGet("SELECT value FROM app_status WHERE key = 'chat_enabled'");
                const chatEnabled = chatStatus?.value !== 'false'; // Default: true se não existir
                
                if (!chatEnabled) {
                    return res.status(503).json({ message: 'O chat está temporariamente desabilitado. Tente novamente mais tarde.' });
                }
                
                const { conversationId, message, messageType = 'text' } = req.body;
                const userId = req.user.id;
                const userRole = req.user.role;
                
                if (chatEnabled) {
                    console.log('📨 [CHAT] Recebendo mensagem:', { conversationId, message: message?.substring(0, 50), userId, userRole });
                }

                if (!conversationId || !message) {
                    if (chatEnabled) console.error('❌ [CHAT] Dados faltando:', { conversationId: !!conversationId, message: !!message });
                    return res.status(400).json({ message: 'Conversa e mensagem são obrigatórios' });
                }

                // Verificar se a conversa existe
                // Admin/atendente pode enviar para qualquer conversa, usuário normal apenas para suas próprias
                let conversation;
                if (req.user.role === 'admin' || req.user.role === 'attendant') {
                    conversation = await dbGet(
                        'SELECT * FROM chat_conversations WHERE id = ?',
                        [conversationId]
                    );
                } else {
                    conversation = await dbGet(
                        'SELECT * FROM chat_conversations WHERE id = ? AND (user_id = ? OR attendant_id = ?)',
                        [conversationId, userId, userId]
                    );
                }

                if (!conversation) {
                    if (chatEnabled) console.error('❌ [CHAT] Conversa não encontrada:', conversationId, 'User:', userId, 'Role:', req.user.role);
                    return res.status(404).json({ message: 'Conversa não encontrada' });
                }

                if (chatEnabled) console.log('✅ [CHAT] Conversa encontrada:', conversation.id);

                // Inserir mensagem
                let result;
                try {
                    result = await dbRun(
                        'INSERT INTO chat_messages (conversation_id, sender_id, message_text, message_type, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                        [conversationId, userId, message, messageType || 'text']
                    );

                    if (!result || !result.lastID) {
                        if (chatEnabled) {
                            console.error('❌ [CHAT] Erro ao inserir mensagem: lastID não retornado');
                            console.error('❌ [CHAT] Result:', result);
                        }
                        return res.status(500).json({ message: 'Erro ao salvar mensagem no banco de dados' });
                    }
                    
                    if (chatEnabled) console.log('✅ [CHAT] Mensagem inserida com ID:', result.lastID);
                } catch (dbError) {
                    if (chatEnabled) {
                        console.error('❌ [CHAT] Erro ao inserir no banco:', dbError);
                        console.error('❌ [CHAT] Stack:', dbError.stack);
                    }
                    // Tentar com query alternativa caso message_text não exista
                    try {
                        result = await dbRun(
                            'INSERT INTO chat_messages (conversation_id, sender_id, message, message_type, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                            [conversationId, userId, message, messageType || 'text']
                        );
                        if (!result || !result.lastID) {
                            throw new Error('lastID não retornado');
                        }
                        if (chatEnabled) console.log('✅ [CHAT] Mensagem inserida com query alternativa, ID:', result.lastID);
                    } catch (altError) {
                        if (chatEnabled) console.error('❌ [CHAT] Erro também com query alternativa:', altError);
                        return res.status(500).json({ message: 'Erro ao salvar mensagem no banco de dados', error: dbError.message });
                    }
                }

                if (!result || !result.lastID) {
                    if (chatEnabled) console.error('❌ [CHAT] Erro: result não disponível após inserção');
                    return res.status(500).json({ message: 'Erro ao salvar mensagem no banco de dados' });
                }

                // Atualizar última mensagem
                await dbRun(
                    'UPDATE chat_conversations SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [conversationId]
                );

                let newMessage = {
                    id: result.lastID,
                    conversation_id: conversationId,
                    sender_id: userId,
                    message_text: message,
                    message_type: messageType,
                    is_read: 0,
                    created_at: new Date().toISOString()
                };

                // Enviar via WebSocket (se disponível)
                if (io) {
                    try {
                        // Buscar mensagem completa do banco para garantir dados corretos
                        const fullMessage = await dbGet('SELECT * FROM chat_messages WHERE id = ?', [result.lastID]);
                        if (fullMessage) {
                            newMessage = fullMessage;
                        }
                        
                        // Emitir para a sala da conversa
                        io.to(`conversation-${conversationId}`).emit('new-message', newMessage);
                        
                        // Se for usuário enviando, emitir para o atendente
                        if (req.user.role === 'user' && conversation.attendant_id) {
                            // Emitir diretamente para o atendente
                            io.to(`user-${conversation.attendant_id}`).emit('new-message', newMessage);
                            // Também emitir para a sala da conversa (garantir que chegue)
                            io.to(`conversation-${conversationId}`).emit('new-message', newMessage);
                            if (chatEnabled) console.log(`✅ [CHAT] Mensagem do usuário enviada via WebSocket para atendente ${conversation.attendant_id} (conversation ${conversationId})`);
                        }
                        
                        // Se for atendente enviando, emitir para o usuário
                        if ((req.user.role === 'admin' || req.user.role === 'attendant') && conversation.user_id) {
                            // Emitir diretamente para o usuário
                            io.to(`user-${conversation.user_id}`).emit('new-message', newMessage);
                            // Também emitir para a sala da conversa (garantir que chegue)
                            io.to(`conversation-${conversationId}`).emit('new-message', newMessage);
                            if (chatEnabled) console.log(`✅ [CHAT] Mensagem do atendente enviada via WebSocket para usuário ${conversation.user_id} (conversation ${conversationId})`);
                        }
                        
                        // Se for atendente enviando, também emitir para outro atendente (caso tenha transferência)
                        if (req.user.role === 'admin' || req.user.role === 'attendant') {
                            if (conversation.attendant_id && conversation.attendant_id !== userId) {
                                io.to(`user-${conversation.attendant_id}`).emit('new-message', newMessage);
                            }
                        }
                        
                        if (chatEnabled) console.log('✅ [CHAT] Mensagem enviada via WebSocket');
                    } catch (wsError) {
                        if (chatEnabled) console.warn('⚠️ [CHAT] Erro ao enviar via WebSocket (não crítico):', wsError.message);
                    }
                } else {
                    if (chatEnabled) console.warn('⚠️ [CHAT] Socket.IO não disponível para enviar mensagem');
                }

                res.json(newMessage);
            } catch (error) {
                const chatEnabledMsgError = await isChatEnabled();
                if (chatEnabledMsgError) {
                    console.error('❌ [CHAT] Erro ao enviar mensagem:', error);
                    console.error('❌ [CHAT] Stack trace:', error.stack);
                }
                res.status(500).json({ message: 'Erro ao enviar mensagem', error: error.message });
            }
        });

        // POST /api/chat/send-file - Enviar arquivo (imagem, áudio, vídeo, etc)
        // Verificar se multer está disponível
        let multer, upload;
        try {
            multer = require('multer');
            // Criar pasta de arquivos do chat se não existir
            const chatFilesDir = path.join(__dirname, 'public', 'chat_files');
            await fs.mkdir(chatFilesDir, { recursive: true });
            
            upload = multer({ 
                dest: chatFilesDir,
                limits: { fileSize: 5 * 1024 * 1024 } // 5MB
            });
        } catch (error) {
            console.warn('⚠️ Multer não disponível. Instale com: npm install multer');
        }

        if (upload) {
            app.post('/api/chat/send-file', verifyToken, upload.single('file'), async (req, res) => {
                try {
                    if (!req.file) {
                        return res.status(400).json({ message: 'Arquivo não fornecido' });
                    }

                const { conversationId, messageType } = req.body;
                const userId = req.user.id;

                const chatEnabledFile = await isChatEnabled();
                if (chatEnabledFile) {
                    console.log('📎 [CHAT] Recebendo arquivo:', { 
                        conversationId, 
                        messageType, 
                        filename: req.file.filename,
                        originalname: req.file.originalname,
                        size: req.file.size,
                        userId 
                    });
                }

                if (!conversationId) {
                    // Remover arquivo se não houver conversa
                    await fs.unlink(req.file.path).catch(() => {});
                    return res.status(400).json({ message: 'ID da conversa é obrigatório' });
                }

                // Verificar se a conversa existe
                let conversation;
                if (req.user.role === 'admin' || req.user.role === 'attendant') {
                    conversation = await dbGet('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
                } else {
                    conversation = await dbGet(
                        'SELECT * FROM chat_conversations WHERE id = ? AND (user_id = ? OR attendant_id = ?)',
                        [conversationId, userId, userId]
                    );
                }

                if (!conversation) {
                    await fs.unlink(req.file.path).catch(() => {});
                    return res.status(404).json({ message: 'Conversa não encontrada' });
                }

                // Mover arquivo para pasta permanente com nome único
                const fileExt = path.extname(req.file.originalname);
                const fileName = `${Date.now()}-${req.file.filename}${fileExt}`;
                const finalPath = path.join(__dirname, 'public', 'chat_files', fileName);
                await fs.rename(req.file.path, finalPath);

                const fileUrl = `/chat_files/${fileName}`;

                // Inserir mensagem com arquivo
                // Garantir que message_text não seja NULL (usar nome do arquivo ou string vazia)
                const messageText = req.file.originalname || 'Arquivo enviado';
                const result = await dbRun(
                    'INSERT INTO chat_messages (conversation_id, sender_id, message_text, timestamp, message_type, file_url) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)',
                    [conversationId, userId, messageText, messageType || 'file', fileUrl]
                );

                if (!result || !result.lastID) {
                    await fs.unlink(finalPath).catch(() => {});
                    return res.status(500).json({ message: 'Erro ao salvar mensagem no banco de dados' });
                }

                // Atualizar última mensagem
                await dbRun(
                    'UPDATE chat_conversations SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [conversationId]
                );

                const newMessage = {
                    id: result.lastID,
                    conversation_id: conversationId,
                    sender_id: userId,
                    message_text: req.file.originalname,
                    message_type: messageType || 'file',
                    file_url: fileUrl,
                    is_read: 0,
                    created_at: new Date().toISOString()
                };

                // Enviar via WebSocket
                if (io) {
                    try {
                        io.to(`conversation-${conversationId}`).emit('new-message', newMessage);
                    } catch (wsError) {
                        if (chatEnabledFile) console.warn('⚠️ [CHAT] Erro ao enviar via WebSocket:', wsError.message);
                    }
                }

                res.json(newMessage);
            } catch (error) {
                const chatEnabledFileError = await isChatEnabled();
                if (chatEnabledFileError) {
                    console.error('❌ [CHAT] Erro ao enviar arquivo:', error);
                }
                if (req.file) {
                    await fs.unlink(req.file.path).catch(() => {});
                }
                // Verificar se é erro de tamanho
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: 'Arquivo muito grande! Tamanho máximo: 5MB' });
                }
                res.status(500).json({ message: 'Erro ao enviar arquivo', error: error.message });
            }
        });
        } else {
            app.post('/api/chat/send-file', verifyToken, async (req, res) => {
                res.status(503).json({ message: 'Upload de arquivos não disponível. Instale multer: npm install multer' });
            });
        }

        // POST /api/chat/start-conversation - Iniciar nova conversa
        app.post('/api/chat/start-conversation', verifyToken, async (req, res) => {
            try {
                const userId = req.user.id;
                const userRole = req.user.role;
                const { targetUserId } = req.body; // Para atendentes iniciarem conversa com usuário específico

                // Verificar se o chat está habilitado (apenas para usuários comuns)
                if (userRole === 'user') {
                    const chatStatus = await dbGet("SELECT value FROM app_status WHERE key = 'chat_enabled'");
                    const chatEnabled = chatStatus?.value !== 'false'; // Default: true se não existir
                    
                    if (!chatEnabled) {
                        return res.status(403).json({ message: 'O chat está desabilitado no momento. Não é possível iniciar conversas.' });
                    }
                }

                console.log('📝 [CHAT] Iniciando conversa:', { userId, userRole, targetUserId });

                let conversation;

                // Se for atendente/admin e tiver targetUserId, criar conversa com aquele usuário
                if ((userRole === 'admin' || userRole === 'attendant') && targetUserId) {
                    // Verificar se o usuário alvo existe
                    const targetUser = await dbGet('SELECT id, email FROM users WHERE id = ?', [targetUserId]);
                    if (!targetUser) {
                        return res.status(404).json({ message: 'Usuário não encontrado' });
                    }

                    // Verificar se já existe conversa entre atendente e usuário
                    conversation = await dbGet(
                        'SELECT * FROM chat_conversations WHERE user_id = ? AND attendant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
                        [targetUserId, userId, 'open']
                    );

                    if (!conversation) {
                        // Criar nova conversa
                        console.log('➕ [CHAT] Criando conversa entre atendente', userId, 'e usuário', targetUserId);
                        const result = await dbRun(
                            'INSERT INTO chat_conversations (user_id, attendant_id, status) VALUES (?, ?, ?)',
                            [targetUserId, userId, 'open']
                        );
                        
                        if (!result || !result.lastID) {
                            if (chatEnabledConv) console.error('❌ [CHAT] Erro: lastID não retornado ao criar conversa');
                            return res.status(500).json({ message: 'Erro ao criar conversa', error: 'ID não retornado' });
                        }
                        
                        conversation = await dbGet('SELECT * FROM chat_conversations WHERE id = ?', [result.lastID]);
                        if (!conversation) {
                            if (chatEnabledConv) console.error('❌ [CHAT] Erro: Conversa não encontrada após criar');
                            return res.status(500).json({ message: 'Erro ao recuperar conversa criada', error: 'Conversa não encontrada' });
                        }
                    }
                } else {
                    // Usuário normal ou atendente sem targetUserId
                    // PRIMEIRO: Verificar se já existe ticket aberto para o usuário
                    if (userRole === 'user') {
                        const existingTicketForUser = await dbGet(
                            `SELECT t.*, c.id as conversation_id, c.attendant_id 
                             FROM chat_tickets t
                             JOIN chat_conversations c ON t.conversation_id = c.id
                             WHERE c.user_id = ? AND t.status = ? AND c.status = ?
                             ORDER BY t.created_at DESC LIMIT 1`,
                            [userId, 'open', 'open']
                        );
                        
                        if (existingTicketForUser) {
                            console.log(`🎫 [TICKET] Ticket aberto encontrado: ${existingTicketForUser.ticket_number}, vinculando conversa ${existingTicketForUser.conversation_id}`);
                            // Retornar a conversa vinculada ao ticket existente
                            conversation = await dbGet(
                                'SELECT * FROM chat_conversations WHERE id = ?',
                                [existingTicketForUser.conversation_id]
                            );
                            
                            if (conversation) {
                                if (chatEnabledConv) console.log(`✅ [CHAT] Usando conversa existente vinculada ao ticket ${existingTicketForUser.ticket_number}`);
                                return res.json(conversation);
                            }
                        }
                    }
                    
                    // Se não encontrou ticket aberto, buscar conversa aberta
                    conversation = await dbGet(
                        'SELECT * FROM chat_conversations WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
                        [userId, 'open']
                    );
                    
                    // Se encontrou conversa, retornar ela SEM criar ticket (ticket só é criado quando não existe conversa)
                    if (conversation) {
                        if (chatEnabledConv) console.log(`✅ [CHAT] Conversa aberta encontrada: ${conversation.id}, retornando sem criar ticket`);
                        return res.json(conversation);
                    }

                    if (!conversation) {
                        // Criar nova conversa apenas se não houver ticket aberto
                        if (chatEnabledConv) console.log('➕ [CHAT] Criando nova conversa para usuário:', userId);
                        const result = await dbRun(
                            'INSERT INTO chat_conversations (user_id, status) VALUES (?, ?)',
                            [userId, 'open']
                        );
                        
                        if (!result || !result.lastID) {
                            if (chatEnabledConv) console.error('❌ [CHAT] Erro: lastID não retornado ao criar conversa');
                            return res.status(500).json({ message: 'Erro ao criar conversa', error: 'ID não retornado' });
                        }
                        
                        if (chatEnabledConv) console.log('✅ [CHAT] Conversa criada com ID:', result.lastID);
                        conversation = await dbGet('SELECT * FROM chat_conversations WHERE id = ?', [result.lastID]);
                        
                        if (!conversation) {
                            if (chatEnabledConv) console.error('❌ [CHAT] Erro: Conversa não encontrada após criar');
                            return res.status(500).json({ message: 'Erro ao recuperar conversa criada', error: 'Conversa não encontrada' });
                        }
                        
                        // Se for usuário comum, criar ticket automaticamente APENAS se não existir ticket aberto
                        if (userRole === 'user') {
                            // Verificar novamente se não existe ticket aberto (pode ter sido criado entre as verificações)
                            const finalCheckTicket = await dbGet(
                                `SELECT t.* FROM chat_tickets t
                                 JOIN chat_conversations c ON t.conversation_id = c.id
                                 WHERE c.user_id = ? AND t.status = ? AND c.status = ?
                                 ORDER BY t.created_at DESC LIMIT 1`,
                                [userId, 'open', 'open']
                            );
                            
                            if (!finalCheckTicket) {
                                console.log(`🎫 [TICKET] Criando novo ticket para conversa ${conversation.id}`);
                                // Gerar número do ticket amigável (TKT-YYYY-MM-DD-001)
                                const now = new Date();
                                const year = now.getFullYear();
                                const month = String(now.getMonth() + 1).padStart(2, '0');
                                const day = String(now.getDate()).padStart(2, '0');
                                const dateStr = `${year}-${month}-${day}`;
                                
                                // Buscar último ticket do dia para gerar número sequencial
                                const lastTicket = await dbGet(
                                    `SELECT ticket_number FROM chat_tickets 
                                     WHERE ticket_number LIKE ? 
                                     ORDER BY id DESC LIMIT 1`,
                                    [`TKT-${dateStr}-%`]
                                );
                                
                                let sequence = 1;
                                if (lastTicket && lastTicket.ticket_number) {
                                    const match = lastTicket.ticket_number.match(/TKT-\d{4}-\d{2}-\d{2}-(\d+)/);
                                    if (match && match[1]) {
                                        sequence = parseInt(match[1]) + 1;
                                    }
                                }
                                
                                const ticketNumber = `TKT-${dateStr}-${String(sequence).padStart(3, '0')}`;
                                
                                // Buscar email do usuário
                                const user = await dbGet('SELECT email FROM users WHERE id = ?', [userId]);
                                
                                // Criar ticket
                                await dbRun(
                                    `INSERT INTO chat_tickets (ticket_number, conversation_id, user_id, status, priority)
                                     VALUES (?, ?, ?, ?, ?)`,
                                    [ticketNumber, conversation.id, userId, 'open', 'normal']
                                );
                                
                                if (chatEnabledConv) console.log(`✅ [CHAT] Ticket criado automaticamente: ${ticketNumber} para usuário ${user?.email || userId}`);
                            } else {
                                if (chatEnabledConv) console.log(`⚠️ [CHAT] Ticket aberto encontrado durante criação de conversa, vinculando conversa ${conversation.id} ao ticket ${finalCheckTicket.ticket_number}`);
                                // Vincular a nova conversa ao ticket existente
                                await dbRun(
                                    'UPDATE chat_tickets SET conversation_id = ? WHERE id = ?',
                                    [conversation.id, finalCheckTicket.id]
                                );
                            }
                        }
                    } else {
                        if (chatEnabledConv) console.log(`✅ [CHAT] Conversa aberta existente encontrada: ${conversation.id}`);
                    }
                }

                if (chatEnabledConv) console.log('✅ [CHAT] Retornando conversa:', conversation.id);
                res.json(conversation);
            } catch (error) {
                const chatEnabledConvError = await isChatEnabled();
                if (chatEnabledConvError) {
                    console.error('❌ [CHAT] Erro ao iniciar conversa:', error);
                    console.error('❌ [CHAT] Stack trace:', error.stack);
                }
                res.status(500).json({ message: 'Erro ao iniciar conversa', error: error.message });
            }
        });

        // GET /api/chat/users - Listar usuários para atendentes iniciarem conversa
        app.get('/api/chat/users', verifyToken, async (req, res) => {
            // Verificar se é admin ou atendente
            if (req.user.role !== 'admin' && req.user.role !== 'attendant') {
                return res.status(403).json({ message: 'Acesso negado' });
            }
            try {
                const users = await dbAll(`
                    SELECT id, email, whatsapp, role, is_active, created_at
                    FROM users
                    WHERE role = 'user'
                    ORDER BY email ASC
                `);
                res.json(users);
            } catch (error) {
                const chatEnabledUsers = await isChatEnabled();
                if (chatEnabledUsers) {
                    console.error('❌ [CHAT] Erro ao listar usuários:', error);
                }
                res.status(500).json({ message: 'Erro ao listar usuários', error: error.message });
            }
        });

        // GET /api/chat/online-status - Status online/offline
        app.get('/api/chat/online-status', verifyToken, async (req, res) => {
            try {
                const statuses = await dbAll('SELECT user_id, is_online, last_seen FROM chat_online_status');
                res.json(statuses);
            } catch (error) {
                console.error('Erro ao obter status online:', error);
                res.status(500).json({ message: 'Erro ao obter status online' });
            }
        });

        // GET /api/chat/attendants - Listar atendentes (admin ou público para widget)
        app.get('/api/chat/attendants', verifyToken, async (req, res) => {
            try {
                const chatEnabledAtt = await isChatEnabled();
                const userRole = req.user.role;
                let attendants = [];
                
                // Apenas admin pode ver todos os atendentes, usuários normais veem apenas online
                if (userRole === 'admin') {
                    attendants = await dbAll(`
                        SELECT ca.*, u.email, u.role, u.is_active as user_active,
                               COALESCE((SELECT COUNT(*) FROM chat_conversations WHERE attendant_id = ca.user_id AND status = 'open'), 0) as active_conversations,
                               COALESCE((SELECT is_online FROM chat_online_status WHERE user_id = ca.user_id), 0) as is_online
                        FROM chat_attendants ca
                        JOIN users u ON ca.user_id = u.id
                        WHERE u.role = 'admin'
                        ORDER BY ca.created_at DESC
                    `);
                    if (chatEnabledAtt) {
                        console.log(`📊 [CHAT] Query admin retornou ${attendants?.length || 0} atendente(s)`);
                    }
                } else {
                    // Usuários normais veem apenas atendentes online
                    attendants = await dbAll(`
                        SELECT ca.*, u.email, u.role,
                               COALESCE(cos.is_online, 0) as is_online
                        FROM chat_attendants ca
                        JOIN users u ON ca.user_id = u.id
                        LEFT JOIN chat_online_status cos ON ca.user_id = cos.user_id
                        WHERE u.role = 'admin' AND ca.is_active = 1 AND COALESCE(cos.is_online, 0) = 1
                        ORDER BY ca.created_at DESC
                    `);
                    if (chatEnabledAtt) {
                        console.log(`📊 [CHAT] Query usuário retornou ${attendants?.length || 0} atendente(s) online`);
                    }
                }
                
                // Garantir que sempre retornamos um array
                if (!Array.isArray(attendants)) {
                    if (chatEnabledAtt) {
                        console.warn('⚠️ [CHAT] dbAll não retornou array para atendentes:', typeof attendants);
                    }
                    attendants = [];
                }
                
                // Garantir que sempre retornamos um array válido
                if (!Array.isArray(attendants)) {
                    if (chatEnabledAtt) {
                        console.error('❌ [CHAT] CRÍTICO: attendants não é array! Tipo:', typeof attendants, 'Valor:', attendants);
                    }
                    attendants = [];
                }
                
                if (chatEnabledAtt) {
                    console.log(`✅ [CHAT] Retornando ${attendants.length} atendente(s) como array`);
                    console.log(`📋 [CHAT] Primeiro atendente (se houver):`, attendants[0] || 'Nenhum');
                }
                
                // Forçar resposta como array JSON
                res.setHeader('Content-Type', 'application/json');
                res.json(Array.isArray(attendants) ? attendants : []);
            } catch (error) {
                console.error('❌ [CHAT] Erro ao listar atendentes:', error);
                console.error('❌ [CHAT] Stack trace:', error.stack);
                res.status(500).json({ message: 'Erro ao listar atendentes', error: error.message });
            }
        });

        // POST /api/chat/attendants - Criar/editar atendente (admin)
        app.post('/api/chat/attendants', verifyToken, requireAdmin, async (req, res) => {
            try {
                const chatEnabledAttPost = await isChatEnabled();
                const { userId, isActive, maxConversations } = req.body;
                if (chatEnabledAttPost) {
                    console.log('📥 [CHAT] Recebendo requisição para criar/editar atendente:', { userId, isActive, maxConversations });
                }

                if (!userId) {
                    console.error('❌ [CHAT] ID do usuário não fornecido');
                    return res.status(400).json({ message: 'ID do usuário é obrigatório' });
                }

                // Verificar se o usuário existe e é admin
                const user = await dbGet('SELECT * FROM users WHERE id = ? AND role = ?', [userId, 'admin']);
                if (!user) {
                    console.error('❌ [CHAT] Usuário não encontrado ou não é administrador:', userId);
                    return res.status(404).json({ message: 'Usuário não encontrado ou não é administrador' });
                }

                if (chatEnabledAttPost) console.log('✅ [CHAT] Usuário encontrado:', user.email);

                // Verificar se já existe
                const existing = await dbGet('SELECT * FROM chat_attendants WHERE user_id = ?', [userId]);
                
                if (existing) {
                    // Atualizar
                    await dbRun(
                        'UPDATE chat_attendants SET is_active = ?, max_conversations = ? WHERE user_id = ?',
                        [isActive ? 1 : 0, maxConversations || 5, userId]
                    );
                    if (chatEnabledAttPost) console.log('✅ [CHAT] Atendente atualizado no banco de dados');
                } else {
                    // Criar novo
                    await dbRun(
                        'INSERT INTO chat_attendants (user_id, is_active, max_conversations) VALUES (?, ?, ?)',
                        [userId, isActive ? 1 : 0, maxConversations || 5]
                    );
                    if (chatEnabledAttPost) console.log('✅ [CHAT] Atendente criado no banco de dados');
                }

                // Atualizar status online também
                await dbRun(
                    'INSERT OR REPLACE INTO chat_online_status (user_id, is_online, last_seen) VALUES (?, ?, CURRENT_TIMESTAMP)',
                    [userId, isActive ? 1 : 0]
                );
                if (chatEnabledAttPost) console.log('✅ [CHAT] Status online atualizado');

                // Buscar o atendente recém-criado/atualizado para retornar
                const savedAttendant = await dbGet(`
                    SELECT ca.*, u.email, u.role, u.is_active as user_active,
                           COALESCE((SELECT COUNT(*) FROM chat_conversations WHERE attendant_id = ca.user_id AND status = 'open'), 0) as active_conversations
                    FROM chat_attendants ca
                    JOIN users u ON ca.user_id = u.id
                    WHERE ca.user_id = ?
                `, [userId]);
                
                if (!savedAttendant) {
                    console.error('❌ [CHAT] Erro: Atendente não foi encontrado após salvar!');
                    return res.status(500).json({ message: 'Erro ao recuperar atendente após salvar', error: 'Atendente não encontrado' });
                }
                
                if (chatEnabledAttPost) console.log('✅ [CHAT] Atendente recuperado:', savedAttendant);

                res.json({ success: true, message: 'Atendente salvo com sucesso', data: savedAttendant });
            } catch (error) {
                console.error('❌ [CHAT] Erro ao criar/editar atendente:', error);
                res.status(500).json({ message: 'Erro ao criar/editar atendente', error: error.message });
            }
        });

        // DELETE /api/chat/attendants/:id - Deletar atendente (admin)
        app.delete('/api/chat/attendants/:id', verifyToken, requireAdmin, async (req, res) => {
            try {
                const { id } = req.params;
                await dbRun('DELETE FROM chat_attendants WHERE user_id = ?', [id]);
                res.json({ success: true });
            } catch (error) {
                console.error('Erro ao deletar atendente:', error);
                res.status(500).json({ message: 'Erro ao deletar atendente' });
            }
        });

        // GET /api/chat/quick-replies - Listar respostas rápidas (admin)
        app.get('/api/chat/quick-replies', verifyToken, requireAdmin, async (req, res) => {
            try {
                const chatEnabledReplies = await isChatEnabled();
                if (chatEnabledReplies) {
                    console.log('📥 [CHAT] Buscando respostas rápidas...');
                }
                let replies = await dbAll('SELECT * FROM chat_quick_replies ORDER BY created_at DESC');
                
                // Garantir que sempre retornamos um array
                if (!Array.isArray(replies)) {
                    if (chatEnabledReplies) console.warn('⚠️ [CHAT] dbAll não retornou array para respostas rápidas:', typeof replies);
                    replies = [];
                }
                
                // Garantir que sempre retornamos um array válido
                if (!Array.isArray(replies)) {
                    if (chatEnabledReplies) console.error('❌ [CHAT] CRÍTICO: replies não é array! Tipo:', typeof replies, 'Valor:', replies);
                    replies = [];
                }
                
                if (chatEnabledReplies) {
                    console.log(`✅ [CHAT] Retornando ${replies.length} resposta(s) rápida(s) como array`);
                    if (replies.length > 0) {
                        console.log(`📋 [CHAT] Primeira resposta:`, { id: replies[0].id, title: replies[0].title });
                    }
                }
                
                // Forçar resposta como array JSON
                res.setHeader('Content-Type', 'application/json');
                res.json(Array.isArray(replies) ? replies : []);
            } catch (error) {
                console.error('❌ [CHAT] Erro ao listar respostas rápidas:', error);
                console.error('❌ [CHAT] Stack trace:', error.stack);
                res.status(500).json({ message: 'Erro ao listar respostas rápidas', error: error.message });
            }
        });

        // POST /api/chat/quick-replies - Criar/editar resposta rápida (admin)
        app.post('/api/chat/quick-replies', verifyToken, requireAdmin, async (req, res) => {
            try {
                const { id, title, message, messageText, link, isActive } = req.body;
                const messageContent = messageText || message;
                const chatEnabledRepliesPost = await isChatEnabled();
                if (chatEnabledRepliesPost) {
                    console.log('📥 [CHAT] Recebendo requisição para criar/editar resposta rápida:', { id, title, messageContent: messageContent?.substring(0, 50) + '...', link, isActive });
                }

                if (!title || !messageContent) {
                    console.error('❌ [CHAT] Título ou mensagem não fornecidos');
                    return res.status(400).json({ message: 'Título e mensagem são obrigatórios' });
                }

                let savedReply;
                if (id) {
                    // Atualizar
                    if (chatEnabledRepliesPost) console.log('🔄 [CHAT] Atualizando resposta rápida:', id);
                    await dbRun(
                        'UPDATE chat_quick_replies SET title = ?, message = ?, link = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [title, messageContent, link || null, isActive ? 1 : 0, id]
                    );
                    if (chatEnabledRepliesPost) console.log('✅ [CHAT] Resposta rápida atualizada');
                    // Buscar a resposta atualizada
                    savedReply = await dbGet('SELECT * FROM chat_quick_replies WHERE id = ?', [id]);
                } else {
                    // Criar
                    if (chatEnabledRepliesPost) console.log('➕ [CHAT] Criando nova resposta rápida');
                    const result = await dbRun(
                        'INSERT INTO chat_quick_replies (title, message, link, is_active) VALUES (?, ?, ?, ?)',
                        [title, messageContent, link || null, isActive ? 1 : 0]
                    );
                    const newId = result.lastID;
                    if (chatEnabledRepliesPost) console.log('✅ [CHAT] Resposta rápida criada, ID:', newId);
                    
                    if (!newId) {
                        console.error('❌ [CHAT] Erro: lastID não retornado após INSERT');
                        // Tentar buscar pelo título e mensagem
                        savedReply = await dbGet(
                            'SELECT * FROM chat_quick_replies WHERE title = ? AND message = ? ORDER BY id DESC LIMIT 1',
                            [title, messageContent]
                        );
                        if (savedReply) {
                            if (chatEnabledRepliesPost) console.log('✅ [CHAT] Resposta encontrada por título/mensagem, ID:', savedReply.id);
                        } else {
                            if (chatEnabledRepliesPost) console.error('❌ [CHAT] Não foi possível encontrar a resposta criada');
                            return res.status(500).json({ message: 'Erro ao recuperar resposta criada', error: 'ID não retornado' });
                        }
                    } else {
                        // Buscar a resposta recém-criada
                        savedReply = await dbGet('SELECT * FROM chat_quick_replies WHERE id = ?', [newId]);
                        if (!savedReply) {
                            if (chatEnabledRepliesPost) console.error('❌ [CHAT] Resposta não encontrada após criar com ID:', newId);
                            return res.status(500).json({ message: 'Erro ao recuperar resposta criada', error: 'Resposta não encontrada' });
                        }
                    }
                }
                
                if (!savedReply) {
                    if (chatEnabledRepliesPost) console.error('❌ [CHAT] Erro: Resposta não foi recuperada após salvar!');
                    return res.status(500).json({ message: 'Erro ao recuperar resposta após salvar', error: 'Resposta não encontrada' });
                }
                
                if (chatEnabledRepliesPost) console.log('✅ [CHAT] Resposta rápida recuperada:', { id: savedReply.id, title: savedReply.title });

                res.json({ success: true, message: 'Resposta rápida salva com sucesso', data: savedReply });
            } catch (error) {
                console.error('❌ [CHAT] Erro ao criar/editar resposta rápida:', error);
                res.status(500).json({ message: 'Erro ao criar/editar resposta rápida', error: error.message });
            }
        });

        // DELETE /api/chat/quick-replies/:id - Deletar resposta rápida (admin)
        app.delete('/api/chat/quick-replies/:id', verifyToken, requireAdmin, async (req, res) => {
            try {
                const { id } = req.params;
                await dbRun('DELETE FROM chat_quick_replies WHERE id = ?', [id]);
                res.json({ success: true });
            } catch (error) {
                console.error('Erro ao deletar resposta rápida:', error);
                res.status(500).json({ message: 'Erro ao deletar resposta rápida' });
            }
        });

        // POST /api/chat/remote-access - Acesso remoto (atendente pode ver atividade do usuário)
        app.post('/api/chat/remote-access', verifyToken, async (req, res) => {
            try {
                const { userId, action, data } = req.body;
                const attendantId = req.user.id;
                const userRole = req.user.role;

                // Apenas admin e atendentes podem acessar
                if (userRole !== 'admin' && userRole !== 'attendant') {
                    return res.status(403).json({ message: 'Acesso negado' });
                }

                // Verificar se o atendente está configurado
                const attendant = await dbGet('SELECT * FROM chat_attendants WHERE user_id = ? AND is_active = 1', [attendantId]);
                if (!attendant && userRole !== 'admin') {
                    return res.status(403).json({ message: 'Você não está configurado como atendente' });
                }

                // Enviar evento via WebSocket para o usuário
                io.to(`user-${userId}`).emit('remote-access', {
                    action,
                    data,
                    from: attendantId
                });

                res.json({ success: true });
            } catch (error) {
                console.error('Erro no acesso remoto:', error);
                res.status(500).json({ message: 'Erro no acesso remoto' });
            }
        });

        // GET /api/chat/user-activity/:userId - Obter atividade do usuário (atendente)
        // GET /api/chat/queue - Listar fila de atendimento
        app.get('/api/chat/queue', verifyToken, async (req, res) => {
            try {
                const userRole = req.user.role;
                
                if (userRole === 'admin' || userRole === 'attendant') {
                    // Para atendentes: listar todos na fila
                    const queue = await dbAll(`
                        SELECT q.*, u.email, u.whatsapp 
                        FROM chat_queue q
                        JOIN users u ON q.user_id = u.id
                        WHERE q.status = 'waiting'
                        ORDER BY q.position ASC, q.created_at ASC
                    `);
                    return res.json(Array.isArray(queue) ? queue : []);
                } else {
                    // Para usuários: verificar posição na fila
                    const queueItem = await dbGet(`
                        SELECT q.*, 
                               (SELECT COUNT(*) FROM chat_queue WHERE status = 'waiting' AND position < q.position) as position_in_queue
                        FROM chat_queue q
                        WHERE q.user_id = ? AND q.status = 'waiting'
                        ORDER BY q.created_at DESC LIMIT 1
                    `, [req.user.id]);
                    
                    if (queueItem) {
                        const totalWaiting = await dbGet('SELECT COUNT(*) as count FROM chat_queue WHERE status = ?', ['waiting']);
                        return res.json({
                            ...queueItem,
                            position: queueItem.position_in_queue + 1,
                            totalWaiting: totalWaiting?.count || 0
                        });
                    }
                    return res.json(null);
                }
            } catch (error) {
                console.error('❌ [CHAT] Erro ao buscar fila:', error);
                res.status(500).json({ message: 'Erro ao buscar fila', error: error.message });
            }
        });

        // POST /api/chat/queue/join - Usuário entrar na fila
        app.post('/api/chat/queue/join', verifyToken, async (req, res) => {
            try {
                // Verificar se o chat está habilitado
                const chatStatus = await dbGet("SELECT value FROM app_status WHERE key = 'chat_enabled'");
                const chatEnabled = chatStatus?.value !== 'false'; // Default: true se não existir
                
                if (!chatEnabled) {
                    return res.status(403).json({ message: 'O chat está desabilitado no momento. Não é possível entrar na fila de atendimento.' });
                }
                
                const userId = req.user.id;
                const userRole = req.user.role;
                
                if (userRole === 'admin' || userRole === 'attendant') {
                    return res.status(403).json({ message: 'Atendentes não podem entrar na fila' });
                }
                
                // Verificar se já está na fila
                const existing = await dbGet('SELECT * FROM chat_queue WHERE user_id = ? AND status = ?', [userId, 'waiting']);
                if (existing) {
                    return res.json({ message: 'Você já está na fila', queueItem: existing });
                }
                
                // Obter última posição
                const lastPosition = await dbGet('SELECT MAX(position) as max_pos FROM chat_queue WHERE status = ?', ['waiting']);
                const newPosition = (lastPosition?.max_pos || 0) + 1;
                
                // Adicionar à fila
                const result = await dbRun(
                    'INSERT INTO chat_queue (user_id, status, position) VALUES (?, ?, ?)',
                    [userId, 'waiting', newPosition]
                );
                
                const queueItem = await dbGet('SELECT * FROM chat_queue WHERE id = ?', [result.lastID]);
                
                // Notificar atendentes via WebSocket
                if (io) {
                    io.emit('queue-updated', { action: 'joined', queueItem });
                }
                
                res.json({ message: 'Você entrou na fila', queueItem, position: newPosition });
            } catch (error) {
                console.error('❌ [CHAT] Erro ao entrar na fila:', error);
                res.status(500).json({ message: 'Erro ao entrar na fila', error: error.message });
            }
        });

        // POST /api/chat/queue/accept - Atendente aceitar usuário da fila
        app.post('/api/chat/queue/accept', verifyToken, async (req, res) => {
            try {
                const attendantId = req.user.id;
                const userRole = req.user.role;
                const { queueId } = req.body;
                
                if (userRole !== 'admin' && userRole !== 'attendant') {
                    return res.status(403).json({ message: 'Apenas atendentes podem aceitar da fila' });
                }
                
                if (!queueId) {
                    return res.status(400).json({ message: 'queueId é obrigatório' });
                }
                
                // Buscar item da fila
                const queueItem = await dbGet('SELECT * FROM chat_queue WHERE id = ? AND status = ?', [queueId, 'waiting']);
                if (!queueItem) {
                    return res.status(404).json({ message: 'Item da fila não encontrado' });
                }
                
                // Criar conversa e ticket
                const convResult = await dbRun(
                    'INSERT INTO chat_conversations (user_id, attendant_id, status) VALUES (?, ?, ?)',
                    [queueItem.user_id, attendantId, 'open']
                );
                
                // Gerar número do ticket amigável (TKT-YYYY-MM-DD-001)
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                // Buscar último ticket do dia para gerar número sequencial
                const lastTicket = await dbGet(
                    `SELECT ticket_number FROM chat_tickets 
                     WHERE ticket_number LIKE ? 
                     ORDER BY id DESC LIMIT 1`,
                    [`TKT-${dateStr}-%`]
                );
                
                let sequence = 1;
                if (lastTicket && lastTicket.ticket_number) {
                    const match = lastTicket.ticket_number.match(/TKT-\d{4}-\d{2}-\d{2}-(\d+)/);
                    if (match && match[1]) {
                        sequence = parseInt(match[1]) + 1;
                    }
                }
                
                // Verificar se já existe conversa aberta com este usuário (caso o usuário já tenha enviado mensagem)
                const existingConversation = await dbGet(
                    'SELECT * FROM chat_conversations WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
                    [queueItem.user_id, 'open']
                );
                
                let conversationId;
                let ticketResult;
                
                if (existingConversation) {
                    // Usar conversa existente
                    conversationId = existingConversation.id;
                    console.log(`ℹ️ [CHAT] Usando conversa existente: ${conversationId}`);
                    
                    // Verificar se já existe ticket aberto para esta conversa
                    const existingTicket = await dbGet(
                        'SELECT * FROM chat_tickets WHERE conversation_id = ? AND status = ?',
                        [conversationId, 'open']
                    );
                    
                    if (existingTicket) {
                        // Atualizar ticket existente com o atendente
                        await dbRun(
                            'UPDATE chat_tickets SET attendant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [attendantId, existingTicket.id]
                        );
                        ticketResult = { lastID: existingTicket.id };
                        
                        // Buscar email do usuário
                        const user = await dbGet('SELECT email FROM users WHERE id = ?', [queueItem.user_id]);
                        console.log(`✅ [CHAT] Ticket existente atualizado: ${existingTicket.ticket_number} para usuário ${user?.email || queueItem.user_id}`);
                    } else {
                        // Criar novo ticket para conversa existente
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const dateStr = `${year}-${month}-${day}`;
                        
                        const lastTicket = await dbGet(
                            `SELECT ticket_number FROM chat_tickets 
                             WHERE ticket_number LIKE ? 
                             ORDER BY id DESC LIMIT 1`,
                            [`TKT-${dateStr}-%`]
                        );
                        
                        let sequence = 1;
                        if (lastTicket && lastTicket.ticket_number) {
                            const match = lastTicket.ticket_number.match(/TKT-\d{4}-\d{2}-\d{2}-(\d+)/);
                            if (match && match[1]) {
                                sequence = parseInt(match[1]) + 1;
                            }
                        }
                        
                        const ticketNumber = `TKT-${dateStr}-${String(sequence).padStart(3, '0')}`;
                        const user = await dbGet('SELECT email FROM users WHERE id = ?', [queueItem.user_id]);
                        
                        ticketResult = await dbRun(
                            `INSERT INTO chat_tickets (ticket_number, conversation_id, user_id, attendant_id, status, priority)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [ticketNumber, conversationId, queueItem.user_id, attendantId, 'open', 'normal']
                        );
                        console.log(`✅ [CHAT] Novo ticket criado: ${ticketNumber} para usuário ${user?.email || queueItem.user_id}`);
                    }
                    
                    // Atualizar conversa existente com o atendente
                    await dbRun(
                        'UPDATE chat_conversations SET attendant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [attendantId, conversationId]
                    );
                } else {
                    // Criar nova conversa
                    conversationId = convResult.lastID;
                    
                    const ticketNumber = `TKT-${dateStr}-${String(sequence).padStart(3, '0')}`;
                    const user = await dbGet('SELECT email FROM users WHERE id = ?', [queueItem.user_id]);
                    const userEmail = user?.email || 'N/A';
                    
                    console.log(`📋 [CHAT] Criando ticket ${ticketNumber} para usuário ${userEmail} (ID: ${queueItem.user_id})`);
                    
                    ticketResult = await dbRun(
                        `INSERT INTO chat_tickets (ticket_number, conversation_id, user_id, attendant_id, status, priority)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [ticketNumber, conversationId, queueItem.user_id, attendantId, 'open', 'normal']
                    );
                    console.log(`✅ [CHAT] Novo ticket criado: ${ticketNumber} para usuário ${userEmail}`);
                }
                
                // Atualizar fila
                await dbRun(
                    'UPDATE chat_queue SET status = ?, conversation_id = ?, started_at = ? WHERE id = ?',
                    ['in_progress', convResult.lastID, new Date().toISOString(), queueId]
                );
                
                // Reordenar posições
                await dbRun(`
                    UPDATE chat_queue 
                    SET position = position - 1 
                    WHERE status = 'waiting' AND position > ?
                `, [queueItem.position]);
                
                const ticket = await dbGet('SELECT * FROM chat_tickets WHERE id = ?', [ticketResult.lastID]);
                const conversation = await dbGet('SELECT * FROM chat_conversations WHERE id = ?', [convResult.lastID]);
                
                // Notificar via WebSocket
                if (io) {
                    io.emit('queue-updated', { action: 'accepted', queueId, ticket, conversation });
                    io.to(`user-${queueItem.user_id}`).emit('queue-accepted', { ticket, conversation });
                }
                
                res.json({ message: 'Usuário aceito da fila', ticket, conversation });
            } catch (error) {
                console.error('❌ [CHAT] Erro ao aceitar da fila:', error);
                res.status(500).json({ message: 'Erro ao aceitar da fila', error: error.message });
            }
        });

        // POST /api/chat/tickets - Criar ticket
        app.post('/api/chat/tickets', verifyToken, async (req, res) => {
            try {
                const userRole = req.user.role;
                const { ticket_number, conversation_id, user_id, attendant_id, status, priority, subject, notes } = req.body;
                
                if (userRole !== 'admin' && userRole !== 'attendant') {
                    return res.status(403).json({ message: 'Apenas atendentes podem criar tickets' });
                }
                
                if (!ticket_number || !conversation_id || !user_id) {
                    return res.status(400).json({ message: 'ticket_number, conversation_id e user_id são obrigatórios' });
                }
                
                const result = await dbRun(
                    `INSERT INTO chat_tickets (ticket_number, conversation_id, user_id, attendant_id, status, priority, subject, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ticket_number, conversation_id, user_id, attendant_id || req.user.id, status || 'open', priority || 'normal', subject || null, notes || null]
                );
                
                const ticket = await dbGet('SELECT * FROM chat_tickets WHERE id = ?', [result.lastID]);
                
                res.json(ticket);
            } catch (error) {
                console.error('❌ [CHAT] Erro ao criar ticket:', error);
                res.status(500).json({ message: 'Erro ao criar ticket', error: error.message });
            }
        });

        // DELETE /api/chat/tickets - Deletar todos os tickets (apenas admin)
        app.delete('/api/chat/tickets', verifyToken, requireAdmin, async (req, res) => {
            try {
                // Deletar todos os tickets
                await dbRun('DELETE FROM chat_tickets');
                console.log('🗑️ [TICKETS] Todos os tickets foram deletados pelo admin');
                res.json({ message: 'Todos os tickets foram deletados com sucesso!' });
            } catch (error) {
                console.error('❌ [TICKETS] Erro ao deletar tickets:', error);
                res.status(500).json({ message: 'Erro ao deletar tickets', error: error.message });
            }
        });

        // DELETE /api/chat/tickets - Deletar todos os tickets (apenas admin)
        app.delete('/api/chat/tickets', verifyToken, requireAdmin, async (req, res) => {
            try {
                // Deletar todos os tickets
                await dbRun('DELETE FROM chat_tickets');
                console.log('🗑️ [TICKETS] Todos os tickets foram deletados pelo admin');
                res.json({ message: 'Todos os tickets foram deletados com sucesso!' });
            } catch (error) {
                console.error('❌ [TICKETS] Erro ao deletar tickets:', error);
                res.status(500).json({ message: 'Erro ao deletar tickets', error: error.message });
            }
        });

        // GET /api/chat/tickets - Listar tickets
        app.get('/api/chat/tickets', verifyToken, async (req, res) => {
            try {
                const userRole = req.user.role;
                const userId = req.user.id;
                
                let tickets;
                if (userRole === 'admin' || userRole === 'attendant') {
                    tickets = await dbAll(`
                        SELECT t.*, u.email as user_email, a.email as attendant_email
                        FROM chat_tickets t
                        JOIN users u ON t.user_id = u.id
                        LEFT JOIN users a ON t.attendant_id = a.id
                        ORDER BY t.created_at DESC
                    `);
                } else {
                    tickets = await dbAll(`
                        SELECT t.*, u.email as user_email, a.email as attendant_email
                        FROM chat_tickets t
                        JOIN users u ON t.user_id = u.id
                        LEFT JOIN users a ON t.attendant_id = a.id
                        WHERE t.user_id = ?
                        ORDER BY t.created_at DESC
                    `, [userId]);
                }
                
                res.json(Array.isArray(tickets) ? tickets : []);
            } catch (error) {
                console.error('❌ [CHAT] Erro ao listar tickets:', error);
                res.status(500).json({ message: 'Erro ao listar tickets', error: error.message });
            }
        });

        // POST /api/chat/tickets/:id/close - Fechar ticket
        app.post('/api/chat/tickets/:id/close', verifyToken, async (req, res) => {
            try {
                const ticketId = req.params.id;
                const userRole = req.user.role;
                const { notes } = req.body;
                
                if (userRole !== 'admin' && userRole !== 'attendant') {
                    return res.status(403).json({ message: 'Apenas atendentes podem fechar tickets' });
                }
                
                await dbRun(
                    'UPDATE chat_tickets SET status = ?, closed_at = ?, notes = ?, updated_at = ? WHERE id = ?',
                    ['closed', new Date().toISOString(), notes || null, new Date().toISOString(), ticketId]
                );
                
                const ticket = await dbGet('SELECT * FROM chat_tickets WHERE id = ?', [ticketId]);
                
                // Fechar conversa também
                if (ticket?.conversation_id) {
                    await dbRun('UPDATE chat_conversations SET status = ? WHERE id = ?', ['closed', ticket.conversation_id]);
                }
                
                if (io) {
                    // Emitir para todos (admin/atendente)
                    io.emit('ticket-closed', { ticketId, ticket });
                    
                    // Emitir especificamente para o usuário da conversa
                    if (ticket?.user_id) {
                        io.to(`user-${ticket.user_id}`).emit('ticket-closed', { ticketId, ticket });
                    }
                }
                
                res.json({ message: 'Ticket fechado', ticket });
            } catch (error) {
                console.error('❌ [CHAT] Erro ao fechar ticket:', error);
                res.status(500).json({ message: 'Erro ao fechar ticket', error: error.message });
            }
        });

        // POST /api/chat/broadcast - Enviar mensagem para todos os usuários
        app.post('/api/chat/broadcast', verifyToken, async (req, res) => {
            try {
                const userRole = req.user.role;
                const { message, messageType = 'text' } = req.body;
                
                if (userRole !== 'admin' && userRole !== 'attendant') {
                    return res.status(403).json({ message: 'Apenas atendentes podem enviar broadcast' });
                }
                
                if (!message) {
                    return res.status(400).json({ message: 'Mensagem é obrigatória' });
                }
                
                // Buscar todos os usuários
                const users = await dbAll('SELECT id FROM users WHERE role = ?', ['user']);
                
                let successCount = 0;
                let errorCount = 0;
                
                for (const user of users) {
                    try {
                        // Criar ou buscar conversa
                        let conversation = await dbGet(
                            'SELECT * FROM chat_conversations WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
                            [user.id, 'open']
                        );
                        
                        if (!conversation) {
                            const convResult = await dbRun(
                                'INSERT INTO chat_conversations (user_id, status) VALUES (?, ?)',
                                [user.id, 'open']
                            );
                            conversation = await dbGet('SELECT * FROM chat_conversations WHERE id = ?', [convResult.lastID]);
                        }
                        
                        // Enviar mensagem
                        const msgResult = await dbRun(
                            `INSERT INTO chat_messages (conversation_id, sender_id, message_text, message_type, is_read_by_user, is_read_by_attendant)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [conversation.id, req.user.id, message, messageType, 0, 1]
                        );
                        
                        // Atualizar conversa
                        await dbRun(
                            'UPDATE chat_conversations SET last_message_at = ?, updated_at = ? WHERE id = ?',
                            [new Date().toISOString(), new Date().toISOString(), conversation.id]
                        );
                        
                        // Enviar via WebSocket
                        if (io) {
                            const newMessage = await dbGet('SELECT * FROM chat_messages WHERE id = ?', [msgResult.lastID]);
                            io.to(`user-${user.id}`).emit('new-message', newMessage);
                        }
                        
                        successCount++;
                    } catch (error) {
                        console.error(`❌ [CHAT] Erro ao enviar broadcast para usuário ${user.id}:`, error);
                        errorCount++;
                    }
                }
                
                res.json({ 
                    message: `Broadcast enviado para ${successCount} usuário(s)`, 
                    successCount, 
                    errorCount,
                    total: users.length 
                });
            } catch (error) {
                console.error('❌ [CHAT] Erro ao enviar broadcast:', error);
                res.status(500).json({ message: 'Erro ao enviar broadcast', error: error.message });
            }
        });

        // POST /api/chat/conversations/transfer - Transferir conversa para outro atendente
        app.post('/api/chat/conversations/transfer', verifyToken, async (req, res) => {
            try {
                const userRole = req.user.role;
                const { conversationId, targetAttendantId, returnToQueue } = req.body;
                
                if (userRole !== 'admin' && userRole !== 'attendant') {
                    return res.status(403).json({ message: 'Apenas atendentes podem transferir conversas' });
                }
                
                if (!conversationId || !targetAttendantId) {
                    return res.status(400).json({ message: 'conversationId e targetAttendantId são obrigatórios' });
                }
                
                // Verificar se a conversa existe e pertence ao atendente atual
                const conversation = await dbGet(
                    'SELECT * FROM chat_conversations WHERE id = ? AND (attendant_id = ? OR ? = ?)',
                    [conversationId, req.user.id, userRole, 'admin']
                );
                
                if (!conversation) {
                    return res.status(404).json({ message: 'Conversa não encontrada ou sem permissão' });
                }
                
                // Verificar se o atendente alvo existe
                const targetAttendant = await dbGet('SELECT id, email FROM users WHERE id = ? AND (role = ? OR role = ?)', 
                    [targetAttendantId, 'attendant', 'admin']);
                
                if (!targetAttendant) {
                    return res.status(404).json({ message: 'Atendente alvo não encontrado' });
                }
                
                // Se returnToQueue for true, colocar usuário de volta na fila
                if (returnToQueue) {
                    // Fechar conversa atual
                    await dbRun('UPDATE chat_conversations SET status = ?, attendant_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        ['closed', conversationId]);
                    
                    // Fechar ticket atual
                    await dbRun('UPDATE chat_tickets SET status = ?, closed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?',
                        ['closed', new Date().toISOString(), conversationId]);
                    
                    // Verificar se já está na fila
                    const existingQueue = await dbGet('SELECT * FROM chat_queue WHERE user_id = ? AND status = ?', 
                        [conversation.user_id, 'waiting']);
                    
                    if (!existingQueue) {
                        // Obter última posição
                        const lastPosition = await dbGet('SELECT MAX(position) as max_pos FROM chat_queue WHERE status = ?', ['waiting']);
                        const newPosition = (lastPosition?.max_pos || 0) + 1;
                        
                        // Adicionar à fila
                        await dbRun(
                            'INSERT INTO chat_queue (user_id, status, position) VALUES (?, ?, ?)',
                            [conversation.user_id, 'waiting', newPosition]
                        );
                    }
                    
                    // Notificar via WebSocket
                    if (io) {
                        io.to(`user-${conversation.user_id}`).emit('conversation-transferred', {
                            conversationId,
                            message: 'Sua conversa foi transferida. Você retornou à fila de atendimento.'
                        });
                        io.emit('queue-updated', { action: 'user-returned', userId: conversation.user_id });
                    }
                } else {
                    // Transferir conversa normalmente
                    await dbRun(
                        'UPDATE chat_conversations SET attendant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [targetAttendantId, conversationId]
                    );
                    
                    // Atualizar ticket se existir
                    await dbRun(
                        'UPDATE chat_tickets SET attendant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?',
                        [targetAttendantId, conversationId]
                    );
                    
                    // Notificar via WebSocket
                    if (io) {
                        io.to(`conversation-${conversationId}`).emit('conversation-transferred', {
                            conversationId,
                            newAttendantId: targetAttendantId,
                            newAttendantEmail: targetAttendant.email
                        });
                        io.to(`user-${conversation.user_id}`).emit('conversation-transferred', {
                            conversationId,
                            newAttendantId: targetAttendantId,
                            newAttendantEmail: targetAttendant.email
                        });
                    }
                }
                
                res.json({ 
                    message: returnToQueue ? 'Conversa transferida e usuário retornou à fila' : 'Conversa transferida com sucesso',
                    conversationId,
                    newAttendantId: targetAttendantId,
                    newAttendantEmail: targetAttendant.email,
                    returnToQueue
                });
            } catch (error) {
                console.error('❌ [CHAT] Erro ao transferir conversa:', error);
                res.status(500).json({ message: 'Erro ao transferir conversa', error: error.message });
            }
        });

        app.get('/api/chat/user-activity/:userId', verifyToken, async (req, res) => {
            try {
                const { userId } = req.params;
                const attendantId = req.user.id;
                const userRole = req.user.role;

                // Apenas admin e atendentes podem acessar
                if (userRole !== 'admin' && userRole !== 'attendant') {
                    return res.status(403).json({ message: 'Acesso negado' });
                }

                // Verificar se há conversa ativa com este usuário
                const conversation = await dbGet(
                    'SELECT * FROM chat_conversations WHERE user_id = ? AND (attendant_id = ? OR attendant_id IS NULL) ORDER BY created_at DESC LIMIT 1',
                    [userId, attendantId]
                );

                // Obter status online
                const onlineStatus = await dbGet('SELECT * FROM chat_online_status WHERE user_id = ?', [userId]);

                res.json({
                    conversation: conversation || null,
                    isOnline: onlineStatus?.is_online === 1,
                    lastSeen: onlineStatus?.last_seen || null
                });
            } catch (error) {
                console.error('Erro ao obter atividade do usuário:', error);
                res.status(500).json({ message: 'Erro ao obter atividade do usuário' });
            }
        });

        // Função para verificar se a porta está disponível
        const isPortAvailable = (port) => {
            return new Promise((resolve) => {
                const net = require('net');
                const tester = net.createServer()
                    .once('error', (err) => {
                        if (err.code === 'EADDRINUSE') {
                            resolve(false);
                        } else {
                            resolve(false);
                        }
                    })
                    .once('listening', () => {
                        tester.once('close', () => resolve(true))
                            .close();
                    })
                    .listen(port);
            });
        };

        // Tenta iniciar na porta especificada ou uma alternativa
        let currentPort = PORT;
        let portAvailable = await isPortAvailable(currentPort);
        
        if (!portAvailable) {
            console.warn(`⚠️  Porta ${currentPort} já está em uso. Tentando porta alternativa...`);
            // Tenta portas alternativas (3001, 3002, etc.)
            for (let i = 1; i <= 10; i++) {
                currentPort = PORT + i;
                portAvailable = await isPortAvailable(currentPort);
                if (portAvailable) {
                    console.log(`✅ Porta alternativa ${currentPort} disponível.`);
                    break;
                }
            }
            
            if (!portAvailable) {
                console.error(`❌ Erro: Não foi possível encontrar uma porta disponível (tentadas ${PORT}-${PORT + 10}).`);
                console.error(`   A porta ${PORT} está em uso. Para resolver:`);
                console.error(`   1. Execute o script: kill-port-3000.bat (recomendado)`);
                console.error(`   2. Ou manualmente: netstat -ano | findstr :${PORT}`);
                console.error(`   3. Depois: taskkill /PID <PID> /F`);
                process.exit(1);
            }
        }

        // Rotas específicas para páginas HTML ANTES da rota catch-all
        app.get('/test-modules.html', (req, res) => {
            res.sendFile(path.join(__dirname, 'test-modules.html'));
        });
        
        // Rota para versão modular (sem app.js grande)
        app.get('/modular', (req, res) => {
            res.sendFile(path.join(__dirname, 'index-modular.html'));
        });
        
        // NOTA: A rota para /modules/* foi movida para ANTES do express.static (linha ~995)
        // para garantir que tenha prioridade e seja executada primeiro
        
        // Registrar rota catch-all DEPOIS de todas as rotas da API
        // IMPORTANTE: Esta rota deve ser a ÚLTIMA a ser registrada
        app.get('*', (req, res) => {
            // Não retornar HTML para rotas da API - retornar JSON 404
            if (req.path.startsWith('/api/')) {
                console.warn(`⚠️ [ROUTE] Rota da API não encontrada: ${req.path}`);
                return res.status(404).json({ message: 'Rota da API não encontrada', path: req.path });
            }
            // Não interceptar rotas dos módulos - já foram tratadas acima
            if (req.path.startsWith('/modules/')) {
                // Se chegou aqui, o arquivo realmente não existe
                console.warn(`⚠️ [MODULE] Módulo não encontrado: ${req.path}`);
                return res.status(404).json({ message: 'Módulo não encontrado', path: req.path });
            }
            // Para outras rotas, retornar index.html (SPA)
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        const server = http.listen(currentPort, () => {
            console.log(`✅ Servidor rodando na porta ${currentPort}`);
            if (currentPort !== PORT) {
                console.log(`   (Porta original ${PORT} estava ocupada)`);
            }
        });
        
        // Trata erros após o servidor iniciar
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Erro: Porta ${currentPort} foi ocupada após a verificação.`);
                console.error(`   Execute: kill-port-3000.bat`);
                process.exit(1);
            } else {
                console.error(`❌ Erro no servidor:`, err);
                process.exit(1);
            }
        });
        
        server.timeout = 0;

        process.on('SIGINT', () => {
            db.close((err) => {
                if (err) console.error(err.message);
                console.log('Conexão com o banco de dados fechada.');
                process.exit(0);
            });
        });

    } catch (err) {
        console.error("FALHA CRÍTICA AO INICIAR O SERVIDOR:", err.message);
        process.exit(1);
    }
}

startServer();
