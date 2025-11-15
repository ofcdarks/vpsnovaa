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
const multer = require('multer');
const helmet = require('helmet');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// ================================================
// 🧠 Diagnóstico: garantir que o Node usa o imagefx.js certo
// ================================================
try {
  // 🔹 importa o arquivo imagefx.js da mesma pasta do server.js
  const ImageFXModule = require('./imagefx'); 

  // 🔹 mostra o caminho EXATO do arquivo que o Node está carregando
  console.log("📂 ImageFX carregado de:", require.resolve('./imagefx'));

  // 🔹 disponibiliza globalmente se precisar em outras partes
  global.ImageFX = ImageFXModule.ImageFX;
  global.ImageFXError = ImageFXModule.ImageFXError;
  global.AccountError = ImageFXModule.AccountError;

} catch (err) {
  console.error("❌ Erro ao carregar imagefx.js:", err);
}



// Importar o módulo imagefx
const ImageFXModule = require('./imagefx');
const ImageFX = ImageFXModule.ImageFX;
const ImageFXError = ImageFXModule.ImageFXError;
const AccountError = ImageFXModule.AccountError;
const Model = ImageFXModule.Model;
const AspectRatio = ImageFXModule.AspectRatio;
const Account = ImageFXModule.Account;

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

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const targetDir = resolveUploadPath(req.body.currentPath || '/');
            await fs.mkdir(targetDir, { recursive: true });
            cb(null, targetDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const originalName = file.originalname ? path.basename(file.originalname) : 'arquivo';
        const safeName = originalName.replace(/[^\w.\-]+/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});
const upload = multer({ storage: storage });


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

const parseJsonRobustly = (text, source = "AI") => {
    let cleanedText = text.replace(/```json\n/g, '').replace(/\n```/g, '').replace(/```\n/g, '').replace(/\n```/g, '');
    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error(`[${source} JSON Parse Error] Could not parse JSON:`, cleanedText, "Error:", e.message);
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                console.error(`[${source} JSON Re-Parse Error] Could not re-parse embedded JSON:`, jsonMatch[0], "Error:", e2.message);
                throw new Error(`Falha ao gerar conteudo: JSON incompleto ou malformado da ${source} API. Detalhes: ${e.message}`);
            }
        }
        throw new Error(`Falha ao gerar conteudo: JSON incompleto ou malformado da ${source} API. Detalhes: ${e.message}`);
    }
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
          speaker: typeof segment?.speaker === 'string' && segment.speaker.trim() ? segment.speaker.trim() : `Speaker ${index + 1}`,
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

const buildTtsPrompt = (styleInstructions = '', segments = []) => {
  const lines = [];
  // A instrução de estilo não deve ser incluída no texto para TTS,
  // pois o modelo tentará lê-la. O estilo é inferido da voz selecionada.
  
  segments.forEach((segment, index) => {
    const text = typeof segment?.text === 'string' ? segment.text.trim() : '';
    if (!text) return;

    const speaker = typeof segment?.speaker === 'string' && segment.speaker.trim()
      ? segment.speaker.trim()
      : `Speaker ${index + 1}`;
    
    lines.push(`${speaker}: ${text}`);
  });

  return lines.join('\n\n');
};

const generateTtsAudio = async ({ apiKey, model, textInput, speakerVoiceMap }) => {
    const geminiTtsModel = validateTtsModel(model);
    
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
        const result = await modelInstance.generateContent(request);
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
                .inputOptions(['-ar 24000', '-ac 1']) // Specify input sample rate and channels
                .audioCodec('libmp3lame')
                .audioBitrate('256k')
                .audioFrequency(48000)
                .audioChannels(1)
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
        console.error("Erro na chamada da API Gemini TTS (generateContent):", error);
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
        
        await new Promise((resolve, reject) => {
            const command = ffmpeg();
            tempFilePaths.forEach(filePath => command.input(filePath));
            command
                .audioCodec('libmp3lame')
                .audioBitrate('256k')
                .audioFrequency(48000)
                .audioChannels(1)
                .on('error', (err) => reject(new Error(`Erro no FFMPEG durante a conversão: ${err.message}`)))
                .on('end', resolve)
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

  const cleanedWhatsapp = whatsapp.replace(/\D/g, '');
  if (!whatsappRegex.test(cleanedWhatsapp) || cleanedWhatsapp.length < 10) return res.status(400).json({ message: 'Número de WhatsApp inválido.' });
  
  try {
    await dbRun('UPDATE users SET whatsapp = ? WHERE id = ?', [whatsapp, req.user.id]);
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

async function sendPasswordResetEmail(to, tempPassword) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn("As credenciais SMTP não estão configuradas no .env. O e-mail de redefinição de senha não pode ser enviado.");
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

    const transporter = nodemailer.createTransport(transportOptions);

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

const callApiWithRetries = async (apiCallFunction) => {
  let lastError = null;
  for (let i = 0; i < 3; i++) {
    try {
      return await apiCallFunction();
    } catch (error) {
      lastError = error;
      const errorMessage = (error.response?.data?.error?.message || error.message || "").toLowerCase();
      const statusCode = error.response?.status;
      if (error.code === 'ENOTFOUND' || (statusCode >= 400 && statusCode < 500 && statusCode !== 429)) throw error;
      if (statusCode === 429 || errorMessage.includes('overloaded') || (statusCode >= 500 && statusCode <= 599)) {
        console.warn(`Falha na chamada da API (tentativa ${i + 1}), tentando novamente em 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw error;
      }
    }
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

app.post('/api/generate', verifyToken, async (req, res) => {
  const { prompt, schema, model, stream, maxOutputTokens, temperature } = req.body;
  if (!prompt || !model) return res.status(400).json({ message: "O prompt e o modelo são obrigatórios." });

  try {
    const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
    if (!userSettingsRow) throw new Error('Utilizador não encontrado.');
    const userSettings = userSettingsRow.settings ? JSON.parse(userSettingsRow.settings) : {};

    const claudeKey = userSettings.claude;
    const gptKey = userSettings.gpt;
    const geminiKeys = (Array.isArray(userSettings.gemini) ? userSettings.gemini : [userSettings.gemini]).filter(k => k && k.trim() !== '');
    
    let provider;
    if (model.startsWith('claude-')) {
        provider = 'claude';
    } else if (model.startsWith('gpt-')) {
        provider = 'gpt';
    } else {
        provider = 'gemini';
    }

    const sanitizedMaxOutputTokens = typeof maxOutputTokens === 'number' && maxOutputTokens > 0
      ? Math.min(Math.floor(maxOutputTokens), 8192)
      : undefined;
    const sanitizedTemperature = typeof temperature === 'number' && !Number.isNaN(temperature)
      ? Math.min(Math.max(temperature, 0), 1.5)
      : undefined;

    if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let apiResponseStream;
        if (provider === 'claude') {
            if (!claudeKey) throw new Error("Chave de API Claude não configurada.");
            const claudeMaxTokens = Math.min(sanitizedMaxOutputTokens || 8000, 8000);
            const claudeTemperature = sanitizedTemperature ?? 0.7;
            const response = await axios.post('https://api.anthropic.com/v1/messages', {
                model: model,
                max_tokens: claudeMaxTokens,
                temperature: claudeTemperature,
                messages: [{ role: "user", content: prompt }], stream: true
            }, { 
                headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                responseType: 'stream'
            });
            apiResponseStream = response.data;
        } else if (provider === 'gpt') {
            if (!gptKey) throw new Error("Chave de API OpenAI (GPT) não configurada.");
            const body = {
                model: model,
                messages: [{ role: "user", content: prompt }],
                stream: true
            };
            if (sanitizedMaxOutputTokens) body.max_tokens = sanitizedMaxOutputTokens;
            if (sanitizedTemperature !== undefined) body.temperature = sanitizedTemperature;
            const response = await axios.post('https://api.openai.com/v1/chat/completions', body, {
                headers: { 'Authorization': `Bearer ${gptKey}`, 'Content-Type': 'application/json' },
                responseType: 'stream'
            });
            apiResponseStream = response.data;
        } else {
            if (geminiKeys.length === 0) throw new Error("Nenhuma chave de API Gemini está configurada.");
            const key = geminiKeys[0];
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
            const generationConfig = {};
            if (schema) generationConfig.response_mime_type = "application/json";
            generationConfig.maxOutputTokens = sanitizedMaxOutputTokens || 8192;
            if (sanitizedTemperature !== undefined) generationConfig.temperature = sanitizedTemperature;
            const response = await axios.post(apiUrl, {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig
            }, { responseType: 'stream' });
            apiResponseStream = response.data;
        }
        apiResponseStream.pipe(res);
        req.on('close', () => {
            if (apiResponseStream && typeof apiResponseStream.destroy === 'function') apiResponseStream.destroy();
        });
    } else {
        let aiResult, apiSource;
        if (provider === 'claude') {
            if (!claudeKey) throw new Error("A chave da API Claude não está configurada.");
            apiSource = `Claude (${model})`;
            const claudeMaxTokens = Math.min(sanitizedMaxOutputTokens || 8000, 8000);
            const claudeTemperature = sanitizedTemperature ?? 0.7;
            const response = await callApiWithRetries(() => axios.post('https://api.anthropic.com/v1/messages', {
                model: model,
                max_tokens: claudeMaxTokens,
                temperature: claudeTemperature,
                messages: [{ role: "user", content: prompt }],
                ...(schema && { system: "Sua tarefa é gerar uma resposta no formato JSON. Não inclua NENHUM texto explicativo, introduções, ou qualquer formatação fora do próprio JSON. A sua saída deve ser um JSON puro e válido que possa ser diretamente processado por uma máquina." })
            }, {
                headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                timeout: 300000
            }));
            const content = response.data.content[0].text;
            aiResult = schema ? parseJsonRobustly(content, "Claude") : { text: content };
        } else if (provider === 'gpt') {
            if (!gptKey) throw new Error("A chave da API OpenAI (GPT) não está configurada.");
            apiSource = `OpenAI (${model})`;
            const body = {
                model: model,
                messages: [{ role: "user", content: prompt }],
                ...(schema && { response_format: { type: "json_object" } })
            };
            if (sanitizedMaxOutputTokens) body.max_tokens = sanitizedMaxOutputTokens;
            if (sanitizedTemperature !== undefined) body.temperature = sanitizedTemperature;
            const response = await callApiWithRetries(() => axios.post('https://api.openai.com/v1/chat/completions', body, {
                headers: { 'Authorization': `Bearer ${gptKey}`, 'Content-Type': 'application/json' },
                timeout: 300000
            }));
            const content = response.data.choices[0].message.content;
            aiResult = schema ? parseJsonRobustly(content, "OpenAI") : { text: content };
        } else {
             if (geminiKeys.length === 0) throw new Error("Nenhuma chave de API Gemini está configurada.");
             const key = geminiKeys[0];
             apiSource = `Gemini (${model})`;
             const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
             const generationConfig = {};
             if (schema) generationConfig.response_mime_type = "application/json";
             generationConfig.maxOutputTokens = sanitizedMaxOutputTokens || 8192;
             if (sanitizedTemperature !== undefined) generationConfig.temperature = sanitizedTemperature;
             const response = await callApiWithRetries(() => axios.post(apiUrl, {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig
             }, { headers: { 'Content-Type': 'application/json' }, timeout: 300000 }));
             const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
             if (!text) throw new Error('Resposta da API Gemini vazia ou malformada.');
             aiResult = schema ? parseJsonRobustly(text, "Gemini") : { text };
        }
        res.json({ data: aiResult, apiSource });
    }
  } catch (error) {
    if (error.response) {
      console.error("Erro na API de IA - Status:", error.response.status);
      console.error("Erro na API de IA - Detalhes:", error.response.data);
    } else {
      console.error("Erro de requisição para a API de IA:", error.message);
    }

    const apiError = error.response?.data?.error?.message || error.message;

    if (res.headersSent) {
        console.error("Erro ocorreu durante o streaming. Encerrando a resposta.");
        res.end();
    } else {
        return res.status(500).json({ message: `Falha ao gerar conteúdo: ${apiError}` });
    }
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
  let claude_valid = false;
  let gemini_valid = false;
  let gpt_valid = false;
  let imagefx_cookies_valid = false;
  let youtube_key_valid = false;
  const validationTimeout = 30000; // Increased timeout to 30 seconds

  if (claude && claude.trim() !== '') {
    try {
      await axios.post('https://api.anthropic.com/v1/messages', 
        { model: "claude-3-haiku-20240307", max_tokens: 10, messages: [{ role: "user", content: "hello" }] },
        { headers: { 'x-api-key': claude, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: validationTimeout }
      );
      claude_valid = true;
    } catch (error) {}
  }

  if (Array.isArray(gemini) && gemini.length > 0 && gemini[0] && gemini[0].trim() !== '') {
    const key = gemini[0].trim();
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: TEXT_PROCESSING_MODEL });
      await model.generateContent('hello');
      gemini_valid = true;
      
      try {
          const testVideoId = 'dQw4w9WgXcQ';
          const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=${testVideoId}&key=${key}`;
          await axios.get(url, { timeout: validationTimeout });
          youtube_key_valid = true;
      } catch (youtubeError) {}
    } catch (error) {
      console.warn(`Chave Gemini inválida ou erro de rede.`);
    }
  }

  if (gpt && gpt.trim() !== '') {
    try {
      await axios.get('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${gpt.trim()}` },
        timeout: validationTimeout
      });
      gpt_valid = true;
    } catch (error) {
      console.error("OpenAI (GPT) validation failed:", error.response?.data || error.message);
    }
  }

  if (imagefx_cookies && imagefx_cookies.trim() !== '') {
    try {
        const formattedCookieString = formatCookiesForImageFX(imagefx_cookies);
        if (formattedCookieString.length > 0) {
        const tempAccount = new Account(formattedCookieString);
        await Promise.race([
            tempAccount.refreshSession(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de validação de 30 segundos excedido.')), validationTimeout))
        ]);
        imagefx_cookies_valid = true;
        }
    } catch (error) {
        console.error("ImageFX validation failed with error:", error.message);
        imagefx_cookies_valid = false;
    }
  }


  res.json({ claude_valid, gemini_valid, gpt_valid, imagefx_cookies_valid, youtube_key_valid });
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

app.post('/api/tts/preview', verifyToken, async (req, res) => {
    const { voice, model } = req.body || {};
    const previewVoice = typeof voice === 'string' && voice.trim() ? voice.trim() : FALLBACK_TTS_VOICE;
    const previewText = `Speaker 1: ${DEFAULT_TTS_SAMPLE_TEXT}`;
    const validatedModel = validateTtsModel(model);

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        const geminiKey = getFirstGeminiKeyFromSettings(userSettings);

        if (!geminiKey) {
            return res.status(400).json({ message: 'Configure uma chave da API Gemini.' });
        }

        const { audioBase64 } = await generateTtsAudio({
            apiKey: geminiKey,
            model: validatedModel,
            textInput: previewText,
            speakerVoiceMap: new Map([['Speaker 1', previewVoice]])
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

        let chunk = remainingText.substring(0, charLimit);
        let lastSentenceEnd = -1;

        // Tenta encontrar o final de uma frase para uma quebra mais natural
        const sentenceEnders = ['.', '!', '?', '\n'];
        for (const ender of sentenceEnders) {
            const index = chunk.lastIndexOf(ender);
            if (index > lastSentenceEnd) {
                lastSentenceEnd = index;
            }
        }

        if (lastSentenceEnd !== -1) {
            chunk = chunk.substring(0, lastSentenceEnd + 1);
        } else {
            // Se não encontrar fim de frase, quebra na última palavra
            const lastSpace = chunk.lastIndexOf(' ');
            if (lastSpace !== -1) {
                chunk = chunk.substring(0, lastSpace);
            }
        }
        
        chunks.push(chunk.trim());
        remainingText = remainingText.substring(chunk.length).trim();
    }

    return chunks.filter(Boolean); // Remove chunks vazios
}


async function processScriptTtsJob(jobId, jobData) {
    const { apiKey, ttsModel, script, voice, styleInstructions } = jobData;
    const job = ttsJobs[jobId];
    job.status = 'processing';
    job.message = 'Dividindo o roteiro...';
    const tempFilePaths = [];

    try {
        const validatedTtsModel = validateTtsModel(ttsModel);
        
        const charLimit = validatedTtsModel.includes('pro') ? 4500 : 4950;

        // Otimização 6: Usando a função local em vez de uma chamada de IA
        const chunks = splitTextIntoChunks(script, charLimit);

        if (!chunks || chunks.length === 0) {
            throw new Error("Não foi possível dividir o roteiro em partes.");
        }

        job.total = chunks.length;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            job.progress = i;
            job.message = `Gerando parte de áudio ${i + 1} de ${job.total}...`;

            const textInput = buildTtsPrompt('', [{ speaker: 'Narrador', text: chunk }]);
            
            let audioBase64 = null;
            let lastError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const result = await generateTtsAudio({
                        apiKey,
                        model: validatedTtsModel,
                        textInput,
                        speakerVoiceMap: new Map([['Narrador', voice]])
                    });
                    audioBase64 = result.audioBase64;
                    break;
                } catch (error) {
                    lastError = error;
                    console.warn(`Tentativa ${attempt} de gerar áudio para o chunk ${i + 1} falhou: ${error.message}`);
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }

            if (!audioBase64) {
                throw lastError || new Error(`Falha ao gerar áudio para o chunk ${i + 1} após 3 tentativas.`);
            }

            const tempFilePath = path.join(TEMP_AUDIO_DIR, `${jobId}_part_${i}.mp3`);
            await fs.writeFile(tempFilePath, audioBase64, 'base64');
            tempFilePaths.push(tempFilePath);
        }

        job.message = 'Juntando partes de áudio...';
        const finalFilePath = path.join(FINAL_AUDIO_DIR, `${jobId}.mp3`);
        
        await new Promise((resolve, reject) => {
            const command = ffmpeg();
            tempFilePaths.forEach(filePath => command.input(filePath));
            command
                .audioCodec('libmp3lame')
                .audioBitrate('256k')
                .audioFrequency(48000)
                .audioChannels(1)
                .on('error', (err) => reject(new Error(`Erro no FFMPEG: ${err.message}`)))
                .on('end', resolve)
                .mergeToFile(finalFilePath, TEMP_AUDIO_DIR);
        });

        job.status = 'completed';
        job.message = 'Geração concluída!';
        job.downloadUrl = `/final_audio/${jobId}.mp3`;
        job.progress = job.total;

    } catch (error) {
        console.error(`Erro no trabalho TTS de roteiro ${jobId}:`, error);
        job.status = 'failed';
        job.message = error.message || 'Ocorreu um erro desconhecido durante o processamento.';
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
    const { ttsModel, script, voice, styleInstructions } = req.body;

    if (!script || !voice || !ttsModel) {
        return res.status(400).json({ message: 'Roteiro, voz e modelo de IA são obrigatórios.' });
    }

    try {
        const userSettingsRow = await dbGet('SELECT settings FROM users WHERE id = ?', [req.user.id]);
        const userSettings = userSettingsRow?.settings ? JSON.parse(userSettingsRow.settings) : {};
        const geminiKey = getFirstGeminiKeyFromSettings(userSettings);

        if (!geminiKey) {
            return res.status(400).json({ message: 'Configure uma chave da API Gemini.' });
        }

        const jobId = `tts-script-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const jobData = {
            apiKey: geminiKey,
            ttsModel: validateTtsModel(ttsModel),
            script,
            voice,
            styleInstructions,
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
        return res.status(404).json({ message: 'Trabalho não encontrado.' });
    }

    res.json(job);
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
        const apiKey = getFirstGeminiKeyFromSettings(settings);

        if (!apiKey) return res.status(400).json({ message: 'Chave da API Gemini (usada para o YouTube) não configurada. Por favor, adicione-a nas Configurações.' });

        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;
        const { data } = await axios.get(apiUrl);

        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ message: 'Vídeo não encontrado com o ID fornecido.' });
        }

        const video = data.items[0];
        const snippet = video.snippet;
        const statistics = video.statistics;

        res.json({
            title: snippet.title,
            description: snippet.description,
            tags: snippet.tags || [],
            channelTitle: snippet.channelTitle,
            thumbnailUrl: snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url,
            viewCount: statistics.viewCount,
            likeCount: statistics.likeCount,
            commentCount: statistics.commentCount,
            publishedAt: snippet.publishedAt,
            channelId: snippet.channelId,
        });

    } catch (error) {
        console.error("Erro ao buscar detalhes do vídeo do YouTube via API:", error.response?.data || error.message);
        const apiErrorMessage = error.response?.data?.error?.message || 'Erro desconhecido.';
        res.status(500).json({ message: `Falha ao buscar dados da API do YouTube: ${apiErrorMessage}` });
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

app.post('/api/admin/files/upload', verifyToken, requireAdmin, upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }
    res.json({ message: `${req.files.length} arquivo(s) enviado(s) com sucesso.` });
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

        const server = app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
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