# Use Node.js LTS como imagem base
FROM node:20-slim

# Instalar dependências do sistema necessárias para FFmpeg, Sharp e outras bibliotecas nativas
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libvips-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Criar usuário não-root para segurança
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copiar arquivos de dependências primeiro (para cache de layers)
COPY package*.json ./

# Instalar dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar o resto dos arquivos da aplicação
COPY . .

# Criar diretórios necessários para a aplicação
RUN mkdir -p public/final_audio public/uploads temp_audio

# Definir permissões adequadas
RUN chown -R appuser:appuser /app && \
    chmod -R 755 public temp_audio

# Mudar para usuário não-root
USER appuser

# Expor a porta da aplicação (padrão 3000, mas pode ser sobrescrita via env)
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Healthcheck para verificar se a aplicação está rodando
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Comando para iniciar a aplicação
CMD ["npm", "start"]
