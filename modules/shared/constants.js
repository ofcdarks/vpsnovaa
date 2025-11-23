/**
 * Constantes compartilhadas entre frontend e backend
 */

// Limites de tokens por modelo
export const TOKEN_LIMITS = {
    'gpt-5.1': { maxContextLength: 200000, maxOutputTokens: 32768 },
    'gpt-4o': { maxContextLength: 128000, maxOutputTokens: 16384 },
    'gpt-4-turbo': { maxContextLength: 128000, maxOutputTokens: 16384 },
    'gpt-3.5-turbo': { maxContextLength: 16385, maxOutputTokens: 4096 },
    'claude-3-5-sonnet': { maxContextLength: 200000, maxOutputTokens: 8192 },
    'claude-3-5-haiku': { maxContextLength: 200000, maxOutputTokens: 4096 },
    'claude-3-opus': { maxContextLength: 200000, maxOutputTokens: 4096 },
    'claude-3-sonnet': { maxContextLength: 200000, maxOutputTokens: 4096 },
    'claude-sonnet-4': { maxContextLength: 200000, maxOutputTokens: 8192 },
    'claude-sonnet-4.5': { maxContextLength: 200000, maxOutputTokens: 8192 },
    'gemini-3-pro-preview': { maxContextLength: 1048576, maxOutputTokens: 65536 },
    'gemini-2.5-pro': { maxContextLength: 2000000, maxOutputTokens: 32768 },
    'gemini-2.5-flash': { maxContextLength: 1000000, maxOutputTokens: 16384 },
    'gemini-2.5-flash-lite': { maxContextLength: 1000000, maxOutputTokens: 8192 },
    'gemini-1.5-pro': { maxContextLength: 2000000, maxOutputTokens: 8192 },
    'gemini-1.5-flash': { maxContextLength: 1000000, maxOutputTokens: 8192 }
};

// Modelos de TTS válidos
export const VALID_TTS_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
];

// Vozes TTS disponíveis
export const TTS_VOICES = [
    { value: 'zephyr', label: 'Zephyr' },
    { value: 'echo', label: 'Echo' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'sage', label: 'Sage' }
];

// Idiomas disponíveis
export const LANGUAGES = [
    { value: 'Portugues (Brasil)', text: 'Portugues (Brasil)' },
    { value: 'English (US)', text: 'English (US)' },
    { value: 'Espanol (Espana)', text: 'Espanol (Espana)' },
    { value: 'Francais (Franca)', text: 'Francais (Franca)' },
    { value: 'Deutsch (Alemanha)', text: 'Deutsch (Alemanha)' },
    { value: 'Italiano (Italia)', text: 'Italiano (Italia)' },
    { value: '日本語 (Japao)', text: '日本語 (Japao)' },
    { value: '한국어 (Coreia do Sul)', text: '한국어 (Coreia do Sul)' },
    { value: 'Romana (Romenia)', text: 'Romana (Romenia)' },
    { value: 'Polski (Polska)', text: 'Polski (Polska)' }
];

// Roles de usuário
export const USER_ROLES = {
    USER: 'user',
    ADMIN: 'admin',
    ATTENDANT: 'attendant'
};

// Status de conversas de chat
export const CHAT_STATUS = {
    OPEN: 'open',
    CLOSED: 'closed',
    PENDING: 'pending'
};

// Diretórios
export const DIRECTORIES = {
    TEMP_AUDIO: 'temp_audio',
    FINAL_AUDIO: 'public/final_audio',
    AUDIO_PARTS: 'public/audio_parts',
    UPLOADS: 'public/uploads',
    CHAT_FILES: 'public/chat_files'
};

