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
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const nodemailer = require('nodemailer');
const FormData = require('form-data');
// Multer removido - substituído por função de movimentos ilimitados em imagens
// const multer = require('multer');
const helmet = require('helmet');
// Importar limites de tokens baseados na documentação oficial
const { getTokenLimits, estimateTokens, canFitInLimits } = require('./token-limits');

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
          "'unsafe-inline'",
          "'unsafe-eval'"
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
          "https://www.youtube.com",
          "https://i.ytimg.com",
          "https://yt3.ggpht.com",
          "https://i9.ytimg.com",
          "https://www.google.com"
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
app.use(express.static(PUBLIC_DIR));

const STATIC_ASSETS = new Map([
  ['/style.css', path.join(__dirname, 'style.css')],
  ['/app.js', path.join(__dirname, 'app.js')],
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
        if (err) return reject(err);
        resolve(rows);
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

// Função para verificar se FFmpeg está disponível
const checkFfmpegAvailable = async () => {
    try {
        const { execSync } = require('child_process');
        // Tenta usar o caminho do @ffmpeg-installer primeiro
        if (ffmpegPath && ffmpegPath !== '') {
            try {
                execSync(`"${ffmpegPath}" -version`, { stdio: 'ignore', timeout: 5000 });
                console.log(`✅ FFmpeg disponível em: ${ffmpegPath}`);
                return true;
            } catch (err) {
                console.warn(`⚠️ FFmpeg do @ffmpeg-installer falhou: ${err.message}`);
            }
        }
        
        // Fallback: tenta usar ffmpeg do sistema
        try {
            execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5000 });
            console.log('✅ FFmpeg disponível no sistema (PATH)');
            return true;
        } catch (err) {
            console.warn('⚠️ FFmpeg não encontrado no sistema');
        }
        
        return false;
    } catch (error) {
        console.warn('⚠️ FFmpeg não disponível ou com erro. Usando áudio direto da API.');
        return false;
    }
};

// Função para gerar áudio usando OpenAI TTS com máxima qualidade
const generateOpenAiTtsAudio = async ({ apiKey, textInput, voiceName }) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 3000;
    
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
    
    // Usa o mapeamento ou padrão
    const openAiVoice = voiceMapping[voiceName] || 'alloy';
    
    // Verifica se FFmpeg está disponível (apenas uma vez por execução)
    const ffmpegAvailable = await checkFfmpegAvailable();
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            // Se FFmpeg não estiver disponível, usa MP3 direto (mais compatível)
            // Se FFmpeg estiver disponível, tenta Opus primeiro para melhor qualidade
            const responseFormat = ffmpegAvailable ? 'opus' : 'mp3';
            
            const response = await axios.post(
                'https://api.openai.com/v1/audio/speech',
                {
                    model: 'tts-1-hd', // Modelo de alta qualidade (melhor disponível)
                    input: textInput,
                    voice: openAiVoice,
                    response_format: responseFormat,
                    speed: 1.0 // Velocidade natural
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer',
                    timeout: 90000 // Timeout maior para garantir qualidade
                }
            );
            
            const audioBuffer = Buffer.from(response.data);
            
            // Se FFmpeg não estiver disponível ou se já recebeu MP3, retorna direto
            if (!ffmpegAvailable || responseFormat === 'mp3') {
                const audioBase64 = audioBuffer.toString('base64');
                return {
                    audioBase64: audioBase64,
                    usage: null
                };
            }
            
            // Se chegou aqui, temos Opus e FFmpeg está disponível - tenta converter
            try {
                const tempOpusPath = path.join(TEMP_AUDIO_DIR, `temp_opus_${crypto.randomBytes(4).toString('hex')}.opus`);
                const tempMp3Path = path.join(TEMP_AUDIO_DIR, `temp_mp3_${crypto.randomBytes(4).toString('hex')}.mp3`);
                
                await fs.writeFile(tempOpusPath, audioBuffer);
                
                // Converte Opus para MP3 de alta qualidade usando FFmpeg
                await new Promise((resolve, reject) => {
                    ffmpeg(tempOpusPath)
                        .audioCodec('libmp3lame')
                        .audioBitrate('320k') // Bitrate máximo para MP3 (máxima qualidade)
                        .audioFrequency(48000) // 48kHz (alta qualidade)
                        .audioChannels(1) // Mono para narração
                        .outputOptions([
                            '-q:a', '0', // VBR de máxima qualidade (0 = melhor)
                            '-joint_stereo', '0', // Sem joint stereo (mono)
                            '-af', 'highpass=f=80,lowpass=f=15000', // Filtros para melhorar clareza
                            '-compression_level', '0' // Sem compressão adicional
                        ])
                        .on('error', (err) => {
                            console.warn(`⚠️ Erro no FFMPEG durante otimização: ${err.message}. Usando áudio direto.`);
                            reject(err);
                        })
                        .on('end', resolve)
                        .save(tempMp3Path);
                });
                
                // Lê o MP3 otimizado e converte para base64
                const mp3Buffer = await fs.readFile(tempMp3Path);
                const audioBase64 = mp3Buffer.toString('base64');
                
                // Limpa arquivos temporários
                try {
                    await fs.unlink(tempOpusPath);
                    await fs.unlink(tempMp3Path);
                } catch (cleanupError) {
                    console.warn(`Aviso: Não foi possível limpar arquivos temporários: ${cleanupError.message}`);
                }
                
                return {
                    audioBase64: audioBase64,
                    usage: null
                };
            } catch (ffmpegError) {
                // Se FFmpeg falhar, retorna o áudio Opus direto (melhor que falhar completamente)
                console.warn(`⚠️ FFmpeg falhou durante conversão. Retornando áudio Opus direto: ${ffmpegError.message}`);
                const audioBase64 = audioBuffer.toString('base64');
                return {
                    audioBase64: audioBase64,
                    usage: null,
                    format: 'opus' // Indica que é Opus para o frontend saber
                };
            }
        } catch (error) {
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

const generateTtsAudio = async ({ apiKey, model, textInput, speakerVoiceMap, provider = 'gemini' }, retryCount = 0) => {
    // Se o provedor for OpenAI, usa a função específica
    if (provider === 'openai') {
        const voiceName = Array.from(speakerVoiceMap.values())[0] || 'alloy';
        return await generateOpenAiTtsAudio({ apiKey, textInput, voiceName });
    }
    
    // Código original do Gemini TTS
    const geminiTtsModel = validateTtsModel(model);
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 3000; // 3 segundos
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelInstance = genAI.getGenerativeModel({ model: geminiTtsModel });

    let speechConfig;
    if (speakerVoiceMap.size > 1) {
        speechConfig = {
            multi_speaker_voice_config: {
                speaker_voice_configs: Array.from(speakerVoiceMap.entries()).map(([speakerId, voiceName]) => ({
                    speaker: speakerId,
                    voice_config: { prebuilt_voice_config: { voice_name: voiceName } }
                }))
            }
        };
    } else {
        const voiceName = Array.from(speakerVoiceMap.values())[0];
        speechConfig = {
            voice_config: {
                prebuilt_voice_config: { voice_name: voiceName }
            }
        };
    }

    const request = {
        contents: [{
            role: "user",
            parts: [{ text: textInput }]
        }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speech_config: speechConfig
        }
    };

    try {
        // Tentar gerar áudio com retry automático em caso de erro de rede
        let result;
        let lastError;
        
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                // Timeout maior para evitar fetch failed (60 segundos)
                result = await Promise.race([
                    modelInstance.generateContent(request),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout na requisição TTS (60s)')), 60000)
                    )
                ]);
                
                // Se chegou aqui, a requisição foi bem-sucedida
                break;
            } catch (error) {
                lastError = error;
                const isNetworkError = error.message.includes('fetch failed') || 
                                       error.message.includes('timeout') ||
                                       error.message.includes('Timeout') ||
                                       error.message.includes('ECONNRESET') ||
                                       error.message.includes('ETIMEDOUT') ||
                                       error.message.includes('ENOTFOUND') ||
                                       error.message.includes('ECONNREFUSED');
                
                const isQuotaError = error.status === 429 || 
                                   error.message?.includes('429') || 
                                   error.message?.includes('quota') ||
                                   error.message?.includes('Quota exceeded');
                
                if (attempt < MAX_RETRIES - 1) {
                    let delay;
                    
                    if (isQuotaError) {
                        // Para erro de quota, usa o retryDelay sugerido pela API
                        try {
                            let retryDelaySeconds = 10; // Padrão menor para contas Pro
                            
                            if (error.errorDetails) {
                                const retryInfo = error.errorDetails.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                                if (retryInfo?.retryDelay) {
                                    // retryDelay pode vir como string "12s" ou número
                                    const delayStr = String(retryInfo.retryDelay).replace('s', '');
                                    retryDelaySeconds = parseInt(delayStr) || 10;
                                }
                            }
                            
                            // Para contas Pro, usa o delay sugerido pela API (geralmente 10-15s)
                            delay = Math.max(10000, retryDelaySeconds * 1000); // Mínimo 10 segundos
                            console.log(`⚠️ Erro de quota (429) detectado. Aguardando ${delay / 1000} segundos (sugerido pela API) antes de tentar novamente...`);
                        } catch {
                            delay = 10000; // 10 segundos padrão para contas Pro
                        }
                    } else if (isNetworkError) {
                        delay = RETRY_DELAY * (attempt + 1);
                        console.log(`Tentativa ${attempt + 1}/${MAX_RETRIES} falhou (${error.message}). Tentando novamente em ${delay / 1000} segundos...`);
                    } else {
                        delay = RETRY_DELAY * (attempt + 1);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    throw error;
                }
            }
        }
        
        if (!result) {
            throw lastError || new Error('Falha ao gerar áudio TTS');
        }
        
        const response = result.response;
        const audioPart = response?.candidates?.[0]?.content?.parts?.[0];
        const audioData = audioPart?.inlineData?.data || audioPart?.audioData;

        if (!audioData) {
            console.error("Resposta da API Gemini TTS (generateContent) inesperada:", JSON.stringify(response, null, 2));
            throw new Error('O modelo não retornou áudio.');
        }

        // Convert raw PCM to MP3 using ffmpeg
        const audioBuffer = Buffer.from(audioData, 'base64');
        const tempRawPath = path.join(TEMP_AUDIO_DIR, `temp_raw_${crypto.randomBytes(4).toString('hex')}.raw`);
        const tempMp3Path = path.join(TEMP_AUDIO_DIR, `temp_mp3_${crypto.randomBytes(4).toString('hex')}.mp3`);

        await fs.writeFile(tempRawPath, audioBuffer);

        await new Promise((resolve, reject) => {
            ffmpeg(tempRawPath)
                .inputFormat('s16le')
                .inputOptions(['-ar', '24000', '-ac', '1']) // Specify input sample rate and channels
                .audioCodec('libmp3lame')
                .audioBitrate('320k') // Aumentado para 320kbps para melhor qualidade
                .audioFrequency(48000) // Mantém 48kHz para alta qualidade
                .audioChannels(1)
                .outputOptions([
                    '-q:a', '0', // VBR de alta qualidade (0 = melhor, 9 = pior)
                    '-joint_stereo', '0' // Sem joint stereo (mono)
                ])
                .on('error', (err) => reject(new Error(`Erro no FFMPEG durante a conversão: ${err.message}`)))
                .on('end', resolve)
                .save(tempMp3Path);
        });

        const mp3Buffer = await fs.readFile(tempMp3Path);
        const mp3Base64 = mp3Buffer.toString('base64');

        // Cleanup temporary files
        await fs.unlink(tempRawPath);
        await fs.unlink(tempMp3Path);

        return {
            audioBase64: mp3Base64,
            usage: null,
        };
    } catch (error) {
        console.error(`Erro na chamada da API Gemini TTS (generateContent):`, error.message);
        throw error;
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

            const tempFilePath = path.join(TEMP_AUDIO_DIR, `${jobId}_part_${i}.mp3`);
            await fs.writeFile(tempFilePath, audioBase64, 'base64');
            tempFilePaths.push(tempFilePath);
        }

        job.message = 'Juntando partes de áudio...';
        const finalFilePath = path.join(FINAL_AUDIO_DIR, `${jobId}.mp3`);
        
        // Verifica se FFmpeg está disponível antes de juntar os áudios
        // FFmpeg é ESSENCIAL para juntar múltiplos arquivos de áudio
        const ffmpegAvailableForMerge = await checkFfmpegAvailable();
        if (!ffmpegAvailableForMerge) {
            throw new Error('FFmpeg não está disponível na VPS. FFmpeg é necessário para juntar os arquivos de áudio. Por favor, instale o FFmpeg no servidor.');
        }
        
        console.log(`🔧 Preparando para juntar ${tempFilePaths.length} arquivos de áudio...`);
        console.log(`🔧 FFmpeg Path: ${ffmpegPath}`);
        
        // Verificar se todos os arquivos existem antes de tentar juntar
        for (const filePath of tempFilePaths) {
            try {
                const stats = await fs.stat(filePath);
                console.log(`   ✅ Arquivo encontrado: ${filePath} (${stats.size} bytes)`);
            } catch (err) {
                console.error(`   ❌ Arquivo não encontrado: ${filePath}`);
                throw new Error(`Arquivo de áudio não encontrado: ${filePath}`);
            }
        }
        
        await new Promise((resolve, reject) => {
            const command = ffmpeg();
            tempFilePaths.forEach(filePath => command.input(filePath));
            command
                .audioCodec('libmp3lame')
                .audioBitrate('320k') // Aumentado para 320kbps para melhor qualidade
                .audioFrequency(48000) // Mantém 48kHz para alta qualidade
                .audioChannels(1)
                .outputOptions([
                    '-q:a', '0', // VBR de alta qualidade (0 = melhor, 9 = pior)
                    '-joint_stereo', '0', // Sem joint stereo (mono)
                    '-fflags', '+genpts', // Gera timestamps para melhor sincronização
                    '-avoid_negative_ts', 'make_zero' // Evita problemas de timestamps negativos
                ])
                .on('start', (commandLine) => {
                    console.log(`🚀 Iniciando FFMPEG com comando: ${commandLine}`);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error(`❌ Erro crítico no FFMPEG ao juntar áudios: ${err.message}`);
                    console.error(`   Stdout: ${stdout || 'N/A'}`);
                    console.error(`   Stderr: ${stderr || 'N/A'}`);
                    console.error(`   FFmpeg Path: ${ffmpegPath}`);
                    console.error(`   Verifique se o FFmpeg está instalado corretamente na VPS.`);
                    reject(new Error(`Erro no FFMPEG ao juntar áudios: ${err.message}. Verifique os logs do servidor para mais detalhes.`));
                })
                .on('end', () => {
                    console.log(`✅ Áudios juntados com sucesso: ${tempFilePaths.length} partes combinadas em ${finalFilePath}`);
                    resolve();
                })
                .mergeToFile(finalFilePath, TEMP_AUDIO_DIR);
        });

        job.status = 'completed';
        job.message = 'Geração concluída!';
        job.downloadUrl = `/final_audio/${jobId}.mp3`;
        job.progress = job.total;

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
            // Envia e-mail e WhatsApp em paralelo
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
    const rows = await dbAll("SELECT key, value FROM app_status WHERE key IN ('maintenance', 'announcement')");
    const status = {
      maintenance: JSON.parse(rows.find(r => r.key === 'maintenance')?.value || '{ "is_on": false, "message": "" }'),
      announcement: JSON.parse(rows.find(r => r.key === 'announcement')?.value || 'null')
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
      
      // Rate limit específico - extrair tempo recomendado da mensagem
      if (statusCode === 429 || errorCode === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
        console.warn(`⚠️ Rate limit atingido (tentativa ${i + 1}/${maxRetries})`);
        console.warn(`   Erro: ${errorMessageFull.substring(0, 200)}`);
        
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
    providers.push({ name: 'claude', model: 'claude-3-5-sonnet-20240620', key: claudeKey });
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
// LIMITES REAIS DOS MODELOS
// ==========================
const MODEL_LIMITS = {
  // Google Gemini
  "gemini-2.5-flash-lite": { context: 1_000_000, output: 8192 },
  "gemini-2.5-flash": { context: 1_000_000, output: 16384 },
  "gemini-2.5-pro": { context: 2_000_000, output: 32768 },
  
  // OpenAI
  "gpt-4o": { context: 128_000, output: 16384 },
  "gpt-4-turbo": { context: 128_000, output: 16384 },
  "gpt-3.5-turbo": { context: 16385, output: 4096 },
  
  // Anthropic Claude
  "claude-3-5-sonnet": { context: 200_000, output: 8192 },
  "claude-sonnet-4": { context: 200_000, output: 8192 },
  "claude-sonnet-4.5": { context: 200_000, output: 8192 },
  "claude-3.5-haiku": { context: 200_000, output: 4096 }
};

// ==========================
// ANÁLISE INTELIGENTE DO ROTEIRO
// ==========================
function analiseDeRoteiro(roteiro, modelo, tokensPorCena = 300) {
  const palavras = roteiro.trim().split(/\s+/).filter(Boolean).length;
  const tokensScript = Math.round(palavras * 1.9);
  const limit = MODEL_LIMITS[modelo];
  
  if (!limit) {
    throw new Error(`Modelo "${modelo}" não encontrado em MODEL_LIMITS.`);
  }
  
  const tokensDisponiveis = limit.context - tokensScript;
  const cenasMaxSaida = Math.floor(limit.output / tokensPorCena);
  
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
const normalizeModelKey = (modelo = '') => modelo.toLowerCase().trim();

function calcularMaxOutputTokens(modelo, cenasFinal, tokensPorCena = 300) {
  const modelKey = normalizeModelKey(modelo);
  const limit = MODEL_LIMITS[modelKey];
  
  if (!limit) {
    throw new Error(`Modelo "${modelo}" não encontrado em MODEL_LIMITS.`);
  }
  
  const tokensEstimados = cenasFinal * tokensPorCena;
  
  // Fator de segurança inteligente: Gemini precisa de mais margem (1.6), outros modelos 1.3
  const factor = modelKey.includes("gemini") ? 1.6 : 1.3;
  let maxTokensSaida = Math.ceil(tokensEstimados * factor);
  
  // não deixar exceder limite real do modelo
  maxTokensSaida = Math.min(maxTokensSaida, limit.output);
  
  // não deixar muito baixo para evitar cortes
  if (maxTokensSaida < tokensPorCena * 2) {
    maxTokensSaida = tokensPorCena * 2;
  }
  
  console.log(`   🔧 Cálculo de tokens: ${cenasFinal} cenas × ${tokensPorCena} = ${tokensEstimados} tokens estimados`);
  console.log(`   🔧 Fator de segurança: ${factor} → ${maxTokensSaida} tokens (limite do modelo: ${limit.output})`);
  
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
  const prompt = `Diretor de arte: Divida o roteiro em cenas visuais lógicas. Gere EXATAMENTE ${cenasFinal} cenas. Para cada cena, gere 1 prompt em INGLÊS otimizado para geração de imagens. Formato JSON array: [{"prompt_text": "...", "scene_description": "...", "original_text": "..."}].

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
    if (schema) {
      body.response_format = { type: "json_object" };
    }
    
    response = await callApiWithRetries(() => axios.post('https://api.openai.com/v1/chat/completions', body, {
      headers: { 'Authorization': `Bearer ${gptKey}`, 'Content-Type': 'application/json' },
      timeout: 300000
    }));
    
    texto = response.data.choices[0].message.content;
    finishReason = response.data.choices[0].finish_reason; // 'stop', 'length', etc.
    
  } else if (provider === 'claude') {
    if (!claudeKey) {
      throw new Error("A chave da API Claude não está configurada.");
    }
    const body = {
      model: modelo,
      max_tokens: maxOutputTokens,
      temperature: 0.95,
      messages: [{ role: "user", content: prompt }]
    };
    
    response = await callApiWithRetries(() => axios.post('https://api.anthropic.com/v1/messages', body, {
      headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      timeout: 300000
    }));
    
    texto = response.data.content[0].text;
    finishReason = response.data.stop_reason; // 'end_turn', 'max_tokens', etc.
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

    const fallbackMatrix = [
      { provider: 'gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
      { provider: 'gpt', models: ['gpt-4o'] },
      { provider: 'claude', models: ['claude-3-5-sonnet'] }
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
        maxOutputTokens = calcularMaxOutputTokens(modelKey, total, tokensPorCena);
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
    
    // Normalizar nome do modelo para a API (remover espaços, ajustar formato)
    const normalizeModelName = (modelName) => {
      if (!modelName) return modelName;
      // Mapear nomes comuns para IDs de API
      const modelLower = modelName.toLowerCase().trim();
      if (modelLower.includes('gemini-2.5-pro')) return 'gemini-2.5-pro';
      if (modelLower.includes('gemini-2.5-flash')) return 'gemini-2.5-flash';
      if (modelLower.includes('gemini-1.5-pro')) return 'gemini-1.5-pro';
      if (modelLower.includes('gemini-1.5-flash')) return 'gemini-1.5-flash';
      if (modelLower.includes('gpt-4o')) return 'gpt-4o';
      if (modelLower.includes('gpt-4')) return 'gpt-4';
      if (modelLower.includes('claude-3-5-sonnet')) return 'claude-3-5-sonnet';
      if (modelLower.includes('claude-3-5-haiku')) return 'claude-3-5-haiku';
      // Retornar original se não encontrar mapeamento
      return modelName.replace(/\s+/g, '-').toLowerCase();
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
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelName}:generateContent?key=${geminiKey}`;
        
        const payload = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxOutputTokens || 8192,
            temperature: 0.7
          }
        };
        
        // Adicionar schema se fornecido
        if (schema) {
          payload.generationConfig.response_mime_type = "application/json";
          payload.generationConfig.response_schema = schema;
        }
        
        const response = await callApiWithRetries(() =>
          axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 300000
          })
        );
        
        const candidate = response.data?.candidates?.[0];
        if (!candidate) throw new Error("Resposta vazia do Gemini.");
        if (candidate.finishReason === "MAX_TOKENS") throw new Error("MAX_TOKENS: Resposta cortada");
        
        const text = candidate.content?.parts?.[0]?.text;
        if (!text || !text.trim()) throw new Error("Resposta vazia do Gemini.");
        
        // Tentar parsear como JSON se schema foi solicitado
        if (schema) {
          try {
            result = { data: JSON.parse(text.trim()) };
          } catch (e) {
            result = { data: text.trim() };
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
            result = { data: JSON.parse(text) };
          } catch (e) {
            result = { data: text };
          }
        } else {
          result = { data: text };
        }
        
        apiSource = `OpenAI (${apiModelName || model})`;
        
      } else if (isClaude && claudeKey) {
        const response = await callApiWithRetries(() =>
          axios.post('https://api.anthropic.com/v1/messages', {
            model: apiModelName,
            max_tokens: maxOutputTokens || 4096,
            messages: [{ role: "user", content: prompt + (schema ? `\n\nRESPONDA APENAS COM JSON VÁLIDO.` : '') }]
          }, {
            headers: {
              'x-api-key': claudeKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            },
            timeout: 300000
          })
        );
        
        const text = response.data?.content?.[0]?.text?.trim();
        if (!text) throw new Error("Resposta vazia da Claude.");
        
        // Tentar parsear como JSON se schema foi solicitado
        if (schema) {
          try {
            result = { data: JSON.parse(text) };
          } catch (e) {
            result = { data: text };
          }
        } else {
          result = { data: text };
        }
        
        apiSource = `Claude (${apiModelName || model})`;
        
      } else {
        throw new Error("Nenhuma chave de API disponível para o modelo selecionado.");
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
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${geminiKey}&alt=sse`;
        
        const generationConfig = {
          maxOutputTokens: maxOutputTokens || 8192,
          temperature: temperature !== undefined ? temperature : 0.7
        };
        
        if (schema) {
          generationConfig.response_mime_type = "application/json";
          generationConfig.response_schema = schema;
        }
        
        const response = await callApiWithRetries(() =>
          axios.post(apiUrl, {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig
          }, {
            responseType: 'stream',
            timeout: 300000
          })
        );
        
        apiResponseStream = response.data;
        
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
        const body = {
          model: model,
          max_tokens: maxOutputTokens || 4096,
          messages: [{ role: "user", content: prompt + (schema ? `\n\nRESPONDA APENAS COM JSON VÁLIDO.` : '') }],
          stream: true
        };
        
        if (temperature !== undefined) body.temperature = temperature;
        
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
        
      } else {
        res.write(`data: ${JSON.stringify({ error: "Nenhuma chave de API disponível para o modelo selecionado." })}\n\n`);
        res.end();
        return;
      }
      
      // Pipe do stream da API para o cliente
      apiResponseStream.on('data', (chunk) => {
        res.write(chunk);
      });
      
      apiResponseStream.on('end', () => {
        res.write('data: [DONE]\n\n');
        res.end();
      });
      
      apiResponseStream.on('error', (error) => {
        console.error('Erro no stream:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
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
    
    // Parsear JSON da resposta usando a função existente
    const dados = parseJsonRobustly(resultado, modeloUsado);
    
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
    validationPromises.push(
      axios.post('https://api.anthropic.com/v1/messages', 
        { model: "claude-3-haiku-20240307", max_tokens: 10, messages: [{ role: "user", content: "test" }] },
        { 
          headers: { 
            'x-api-key': claude, 
            'anthropic-version': '2023-06-01', 
            'Content-Type': 'application/json',
            'User-Agent': 'DarkScript-Validator/1.0'
          }, 
          timeout: validationTimeout,
          // Configurações adicionais para VPS
          validateStatus: (status) => status < 500, // Não lançar erro para 4xx
          maxRedirects: 5
        }
      )
      .then((response) => {
        if (response.status === 200) {
          claude_valid = true;
          console.log('✅ Claude: válida');
        } else {
          console.warn(`❌ Claude: resposta inválida (status ${response.status})`);
        }
      })
      .catch(error => {
        const errorMsg = error.response?.data?.error?.message || error.message || 'Erro desconhecido';
        const status = error.response?.status || error.code || 'N/A';
        console.warn(`❌ Claude: inválida (Status: ${status}, Erro: ${errorMsg.substring(0, 100)})`);
        if (isProduction) {
          console.warn(`   Detalhes VPS: ${error.code || 'N/A'} - ${error.message?.substring(0, 150)}`);
        }
      })
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
            // OpenAI TTS: limite de 4096 caracteres por requisição
            validatedTtsModel = 'tts-1-hd'; // Não usado, mas mantido para compatibilidade
            charLimit = 4000; // 4000 caracteres para margem de segurança (limite OpenAI: 4096)
            minDelayBetweenRequests = 2000; // 2 segundos (OpenAI tem limites mais generosos)
            console.log(`📢 Usando OpenAI TTS para gerar áudio`);
        } else {
            // Gemini TTS: limite de 32k tokens por sessão
            validatedTtsModel = 'gemini-2.5-flash-preview-tts';
            charLimit = 6000; // 6000 caracteres (baseado em 32k tokens)
            minDelayBetweenRequests = 10000; // 10 segundos (mais conservador para Gemini)
            console.log(`📢 Usando Gemini TTS para gerar áudio`);
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
        job.message = `Dividindo roteiro em ${chunks.length} partes...`;
        
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
                        // Atualiza mensagem durante tentativas
                        if (attempt > 1) {
                            job.message = `Tentando novamente parte ${globalIndex + 1} (tentativa ${attempt}/${maxAttempts})...`;
                        } else {
                            job.message = `Gerando parte de áudio ${globalIndex + 1} de ${job.total}...`;
                        }
                        
                        const result = await generateTtsAudio({
                            apiKey,
                            model: validatedTtsModel,
                            textInput,
                            speakerVoiceMap: new Map([['Narrador', voice]]),
                            provider: provider || 'gemini'
                        });
                        audioBase64 = result.audioBase64;
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

                const tempFilePath = path.join(TEMP_AUDIO_DIR, `${jobId}_part_${globalIndex}.mp3`);
                await fs.writeFile(tempFilePath, audioBase64, 'base64');
                
                // ATUALIZA o progresso de forma ATÔMICA quando esta parte completa
                // Incrementa o contador de forma sequencial para garantir progresso gradual
                // Pequeno delay para garantir que o frontend veja as atualizações graduais
                await new Promise(resolve => setImmediate(resolve));
                
                completedCount++;
                job.progress = completedCount;
                job.message = `Parte de áudio ${globalIndex + 1} de ${job.total} concluída (${completedCount}/${job.total})...`;
                
                return { index: globalIndex, path: tempFilePath };
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
            
            // Adiciona os caminhos dos arquivos ao array de arquivos temporários
            batchResults.forEach(result => {
                tempFilePaths.push(result.path);
            });
            
            // Pequeno delay entre lotes para não sobrecarregar o sistema
            if (batchEnd < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        job.message = 'Juntando partes de áudio...';
        const finalFilePath = path.join(FINAL_AUDIO_DIR, `${jobId}.mp3`);
        
        // Verifica se FFmpeg está disponível antes de juntar os áudios
        // FFmpeg é ESSENCIAL para juntar múltiplos arquivos de áudio
        const ffmpegAvailableForMerge = await checkFfmpegAvailable();
        if (!ffmpegAvailableForMerge) {
            throw new Error('FFmpeg não está disponível na VPS. FFmpeg é necessário para juntar os arquivos de áudio. Por favor, instale o FFmpeg no servidor.');
        }
        
        console.log(`🔧 Preparando para juntar ${tempFilePaths.length} arquivos de áudio...`);
        console.log(`🔧 FFmpeg Path: ${ffmpegPath}`);
        
        // Verificar se todos os arquivos existem antes de tentar juntar
        for (const filePath of tempFilePaths) {
            try {
                const stats = await fs.stat(filePath);
                console.log(`   ✅ Arquivo encontrado: ${filePath} (${stats.size} bytes)`);
            } catch (err) {
                console.error(`   ❌ Arquivo não encontrado: ${filePath}`);
                throw new Error(`Arquivo de áudio não encontrado: ${filePath}`);
            }
        }
        
        await new Promise((resolve, reject) => {
            const command = ffmpeg();
            tempFilePaths.forEach(filePath => command.input(filePath));
            command
                .audioCodec('libmp3lame')
                .audioBitrate('320k') // Aumentado para 320kbps para melhor qualidade
                .audioFrequency(48000) // Mantém 48kHz para alta qualidade
                .audioChannels(1)
                .outputOptions([
                    '-q:a', '0', // VBR de alta qualidade (0 = melhor, 9 = pior)
                    '-joint_stereo', '0', // Sem joint stereo (mono)
                    '-fflags', '+genpts', // Gera timestamps para melhor sincronização
                    '-avoid_negative_ts', 'make_zero' // Evita problemas de timestamps negativos
                ])
                .on('start', (commandLine) => {
                    console.log(`🚀 Iniciando FFMPEG com comando: ${commandLine}`);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error(`❌ Erro crítico no FFMPEG ao juntar áudios: ${err.message}`);
                    console.error(`   Stdout: ${stdout || 'N/A'}`);
                    console.error(`   Stderr: ${stderr || 'N/A'}`);
                    console.error(`   FFmpeg Path: ${ffmpegPath}`);
                    console.error(`   Verifique se o FFmpeg está instalado corretamente na VPS.`);
                    reject(new Error(`Erro no FFMPEG ao juntar áudios: ${err.message}. Verifique os logs do servidor para mais detalhes.`));
                })
                .on('end', () => {
                    console.log(`✅ Áudios juntados com sucesso: ${tempFilePaths.length} partes combinadas em ${finalFilePath}`);
                    resolve();
                })
                .mergeToFile(finalFilePath, TEMP_AUDIO_DIR);
        });

        job.status = 'completed';
        job.message = 'Geração concluída!';
        job.downloadUrl = `/final_audio/${jobId}.mp3`;
        job.progress = job.total;

    } catch (error) {
        console.error(`Erro no trabalho TTS de roteiro ${jobId}:`, error);
        job.status = 'failed';
        
        // Mensagens mais claras e úteis para o usuário
        let userMessage = error.message || 'Ocorreu um erro desconhecido durante o processamento.';
        
        // Melhorar mensagens específicas
        if (userMessage.includes('Quota') || userMessage.includes('quota')) {
            // Já tem uma boa mensagem de quota
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
            // Manter mensagem original se não for reconhecida
            job.message = `❌ Erro na geração: ${userMessage}`;
        }
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

app.post('/api/tts/generate-from-script', verifyToken, async (req, res) => {
    const { ttsModel, script, voice, styleInstructions, provider = 'gemini' } = req.body;

    if (!script || !voice || !ttsModel) {
        return res.status(400).json({ message: 'Roteiro, voz e modelo de IA são obrigatórios.' });
    }

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

        const jobId = `tts-script-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const jobData = {
            apiKey,
            ttsModel: validateTtsModel(ttsModel),
            script,
            voice,
            styleInstructions,
            provider: provider || 'gemini'
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
        partDownloads: job.partDownloads || [],
        createdAt: job.createdAt,
        finishedAt: job.finishedAt
    };

    res.json(statusResponse);
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
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL do YouTube é obrigatória.' });

    const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    if (!videoIdMatch) return res.status(400).json({ message: 'URL do YouTube inválida ou ID do vídeo não encontrado.' });
    const videoId = videoIdMatch[1];

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const settings = JSON.parse(userSettingsRow?.settings || '{}');
        
        // Tentar primeiro com API do YouTube (se disponível)
        const youtubeApiKey = settings.youtube_api_key || process.env.YOUTUBE_API_KEY;
        
        if (youtubeApiKey && youtubeApiKey.trim() !== '') {
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${youtubeApiKey}`;
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
                        source: 'youtube_api'
                    });
                }
            } catch (youtubeError) {
                console.warn("⚠️ API do YouTube falhou, tentando com GPT-4:", youtubeError.message);
                // Continua para fallback com GPT-4
            }
        }
        
        // Fallback: Usar GPT-4 para extrair dados do YouTube
        console.log("🔄 Usando GPT-4 para extrair dados do YouTube (sem API do YouTube)");
        
        const gptKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
        if (!gptKey || gptKey.trim() === '') {
            return res.status(400).json({ 
                message: 'Chave da API do YouTube não configurada e chave GPT-4 também não encontrada. Por favor, configure pelo menos uma delas nas Configurações.' 
            });
        }

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
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [
                {
                    role: "system",
                    content: "Você é um especialista em extrair informações de vídeos do YouTube. Retorne APENAS JSON válido, sem texto adicional."
                },
                {
                    role: "user",
                    content: extractionPrompt
                }
            ],
            response_format: { type: "json_object" },
            max_tokens: Math.min(2000, tokenLimits.maxOutputTokens),
            temperature: 0.3
        }, {
            headers: { 
                'Authorization': `Bearer ${gptKey}`, 
                'Content-Type': 'application/json' 
            },
            timeout: 30000
        });

        const content = response.data.choices[0].message.content;
        const extractedData = parseJsonRobustly(content, "GPT-4 YouTube Extraction");

        // Combinar dados do scraping (se disponível) com dados do GPT-4
        const finalData = scrapedData ? {
            ...scrapedData,
            // Sobrescrever com dados melhorados do GPT-4 se disponíveis
            tags: Array.isArray(extractedData.tags) && extractedData.tags.length > 0 
                ? extractedData.tags 
                : scrapedData.tags,
            description: extractedData.description && extractedData.description.length > scrapedData.description.length
                ? extractedData.description
                : scrapedData.description
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

        // Garantir que temos pelo menos título
        if (!finalData.title || finalData.title === 'Título não disponível') {
            throw new Error('Não foi possível extrair o título do vídeo. Verifique se a URL está correta.');
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

    } catch (error) {
        console.error("Erro ao buscar detalhes do vídeo do YouTube:", error.response?.data || error.message);
        
        // Mensagem de erro mais amigável
        if (error.message.includes('GPT-4 não conseguiu')) {
            return res.status(500).json({ 
                message: 'Não foi possível extrair os dados do vídeo. Verifique se a URL está correta e tente novamente. Se o problema persistir, configure a API do YouTube nas Configurações.' 
            });
        }
        
        return res.status(500).json({ 
            message: `Erro ao buscar detalhes do vídeo: ${error.response?.data?.error?.message || error.message}` 
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
app.post('/api/webhook/hotmart', async (req, res) => {
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
});

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


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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

        const server = app.listen(currentPort, () => {
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