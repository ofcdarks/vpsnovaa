/**
 * Serviço de Banco de Dados
 * Abstração para operações com SQLite
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseService {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, '../../darkscript.db');
        this.db = null;
    }

    /**
     * Inicializa a conexão com o banco de dados
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Erro ao conectar ao banco de dados:', err);
                    reject(err);
                } else {
                    console.log('✅ Banco de dados conectado:', this.dbPath);
                    resolve();
                }
            });
        });
    }

    /**
     * Executa uma query que não retorna dados (INSERT, UPDATE, DELETE)
     */
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Erro ao executar query:', err);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Executa uma query que retorna uma única linha
     */
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('❌ Erro ao executar query:', err);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Executa uma query que retorna múltiplas linhas
     */
    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ Erro ao executar query:', err);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Inicializa as tabelas do banco de dados
     */
    async initializeTables() {
        const fs = require('fs').promises;
        const path = require('path');

        // Criar diretórios necessários
        const dirs = [
            'temp_audio',
            'public/final_audio',
            'public/audio_parts',
            'public/uploads',
            'public/chat_files'
        ];

        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (err) {
                console.warn(`⚠️ Erro ao criar diretório ${dir}:`, err.message);
            }
        }

        // Criar tabelas
        await this.run(`
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

        await this.run(`
            CREATE TABLE IF NOT EXISTS app_status (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);

        await this.run(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);

        await this.run(`
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

        // Tabelas de chat
        await this.run(`
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

        await this.run(`
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

        await this.run(`
            CREATE TABLE IF NOT EXISTS chat_attendants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                is_available INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `);

        console.log('✅ Tabelas do banco de dados inicializadas');
    }

    /**
     * Fecha a conexão com o banco de dados
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Conexão com banco de dados fechada');
                    resolve();
                }
            });
        });
    }
}

module.exports = DatabaseService;

