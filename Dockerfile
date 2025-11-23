# Use Node.js LTS como imagem base
FROM node:20-slim

# Instalar dependências do sistema necessárias para FFmpeg, Sharp e outras bibliotecas nativas
# FFmpeg é ESSENCIAL para juntar múltiplos arquivos de áudio em um único arquivo final
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libmp3lame0 \
    libvips-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && ffmpeg -version && echo "✅ FFmpeg instalado com sucesso"

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências primeiro (para cache de layers)
COPY package*.json ./

# Instalar dependências de produção como root
# cross-env é necessário para o CMD, então deve estar em production
RUN npm ci --only=production && npm cache clean --force

# Copiar o resto dos arquivos da aplicação
COPY . .

# Criar diretórios necessários para a aplicação
RUN mkdir -p public/final_audio public/uploads public/audio_parts public/chat_files temp_audio data /data

# Criar usuário não-root para segurança (com diretório home)
RUN groupadd -r appuser && \
    useradd -r -g appuser -d /home/appuser -m -s /bin/bash appuser && \
    chown -R appuser:appuser /app && \
    chmod -R 755 public temp_audio data && \
    mkdir -p /home/appuser /data && \
    chown -R appuser:appuser /home/appuser /data

# Configurar npm para usar diretório dentro de /app (não precisa de home)
ENV NPM_CONFIG_CACHE=/app/.npm-cache
ENV NPM_CONFIG_USERCONFIG=/app/.npmrc

# Criar diretório de cache do npm
RUN mkdir -p /app/.npm-cache && \
    chown -R appuser:appuser /app/.npm-cache

# Mudar para usuário não-root
USER appuser

# Expor a porta da aplicação (padrão 3000, mas pode ser sobrescrita via env)
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS=--tls-min-v1.2

# Healthcheck para verificar se a aplicação está rodando
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Comando para iniciar a aplicação
# Usar node diretamente com NODE_OPTIONS já definido no ENV (mais confiável que cross-env)
CMD ["node", "server.js"]
