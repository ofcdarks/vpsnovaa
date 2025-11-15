# 🚀 Guia de Deploy no EasyPanel

Este guia mostra passo a passo como fazer o deploy da aplicação DarkScript AI no EasyPanel.

## 📋 Pré-requisitos

1. ✅ Conta no EasyPanel criada
2. ✅ Repositório Git com o código (GitHub, GitLab, etc.)
3. ✅ Todos os arquivos commitados (`Dockerfile`, `dockerfile`, `.dockerignore`)

---

## 🔧 Passo 1: Criar Novo Projeto no EasyPanel

1. Acesse o painel do EasyPanel
2. Clique em **"New Project"** ou **"Novo Projeto"**
3. Selecione **"App"** ou **"Aplicação"**
4. Escolha **"Docker"** como tipo de aplicação

---

## 🔗 Passo 2: Conectar Repositório Git

1. Na seção **"Source"** ou **"Origem"**:
   - Conecte seu repositório Git (GitHub/GitLab)
   - Selecione o repositório correto
   - Escolha o **branch** (geralmente `main` ou `master`)
   - **Path do Dockerfile**: deixe como `dockerfile` (minúsculas) ou `/dockerfile`

---

## ⚙️ Passo 3: Configurações Básicas

### 3.1 Informações do Projeto
- **Nome do Projeto**: `darkscript-ai` (ou o nome que preferir)
- **Nome do App**: `dark` (ou o nome que preferir)

### 3.2 Configurações de Porta
- **Port**: `3000`
- O EasyPanel vai automaticamente configurar o proxy reverso

---

## 🔐 Passo 4: Variáveis de Ambiente (CRÍTICO)

Adicione todas as variáveis de ambiente necessárias na seção **"Environment Variables"** ou **"Variáveis de Ambiente"**:

### 🔑 Variáveis Obrigatórias

```env
# JWT Secret (OBRIGATÓRIO - gere uma chave forte)
JWT_SECRET=seu_jwt_secret_muito_seguro_aqui

# Porta (opcional, padrão é 3000)
PORT=3000

# Ambiente
NODE_ENV=production

# Opcional: Caminho do banco de dados (se quiser persistência)
DB_PATH=/app/data/darkscript.db
```

### 🤖 Chaves de API (Adicione conforme usar)

```env
# Claude API (Anthropic)
CLAUDE_API_KEY=sua_chave_claude_aqui

# Gemini API (Google)
GEMINI_API_KEY=sua_chave_gemini_aqui

# OpenAI API
OPENAI_API_KEY=sua_chave_openai_aqui

# ImageFX Cookies (para gerador de imagens)
IMAGEFX_COOKIES=seu_cookie_imagfx_aqui
```

### 📧 Configuração de Email (Opcional)

```env
# SMTP para emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_app
SMTP_FROM=noreply@seudominio.com
```

### 🛒 Webhook Hotmart (Opcional)

```env
# Token do webhook Hotmart
HOTMART_TOKEN=seu_token_hotmart_aqui
```

**⚠️ IMPORTANTE**: 
- Use o painel de **"Secrets"** do EasyPanel para variáveis sensíveis
- NÃO commite chaves de API no código
- Gere um `JWT_SECRET` forte (mínimo 32 caracteres aleatórios)

---

## 💾 Passo 5: Volumes Persistentes (Opcional mas Recomendado)

Para persistir o banco de dados SQLite:

1. Vá em **"Volumes"** ou **"Storage"**
2. Adicione um volume:
   - **Path**: `/app/data`
   - **Mount Path**: `/app/data`
   - **Size**: 1GB (ou mais, conforme necessário)

Isso garantirá que o banco de dados não seja perdido ao recriar o container.

---

## 🚀 Passo 6: Build e Deploy

1. Clique em **"Deploy"** ou **"Build"**
2. O EasyPanel vai:
   - Clonar o repositório
   - Fazer build da imagem Docker usando o `dockerfile`
   - Criar e iniciar o container
3. Aguarde o build completar (pode demorar alguns minutos na primeira vez)

---

## 🔍 Passo 7: Verificar Deploy

### 7.1 Logs
- Acesse a aba **"Logs"** para ver os logs em tempo real
- Procure por mensagens como:
  ```
  ✅ Servidor iniciado na porta 3000
  ✅ Conectado ao banco de dados SQLite
  ```

### 7.2 Healthcheck
- O Dockerfile inclui um healthcheck automático
- Verifique se o status está **"Healthy"** no dashboard

### 7.3 Acessar a Aplicação
- O EasyPanel vai criar um domínio automático (ex: `seuapp.easypanel.app`)
- Ou configure um domínio customizado em **"Domains"**

---

## 🐛 Troubleshooting (Solução de Problemas)

### ❌ Erro: "failed to read dockerfile"
- ✅ Certifique-se que o arquivo `dockerfile` (minúsculas) existe no repositório
- ✅ Faça commit e push do arquivo

### ❌ Erro: "Port already in use"
- ✅ Verifique se a porta está configurada como `3000` nas configurações
- ✅ O EasyPanel deve gerenciar isso automaticamente

### ❌ Erro: "JWT_SECRET obrigatória não definida"
- ✅ Adicione a variável `JWT_SECRET` nas variáveis de ambiente
- ✅ Gere uma chave forte: `openssl rand -hex 32`

### ❌ Erro: "FFmpeg not found"
- ✅ O Dockerfile já instala FFmpeg, mas se ocorrer, verifique os logs do build

### ❌ Aplicação não inicia
- ✅ Verifique os logs em tempo real
- ✅ Confirme que todas as variáveis de ambiente obrigatórias estão configuradas
- ✅ Verifique se o `package.json` tem o script `start` correto

### ❌ Banco de dados não persiste
- ✅ Configure um volume persistente em `/app/data`
- ✅ Ajuste a variável `DB_PATH` para apontar para o volume

---

## 🔄 Deploy Contínuo (CI/CD)

O EasyPanel suporta deploy automático:

1. Vá em **"Settings"** > **"Build Settings"**
2. Ative **"Auto Deploy"** quando houver push no branch principal
3. Cada push no repositório vai gerar um novo deploy automaticamente

---

## 📊 Monitoramento

- **Logs**: Acesse logs em tempo real na aba "Logs"
- **Status**: Veja o status do container (Running, Stopped, Healthy, Unhealthy)
- **Recursos**: Monitore CPU, RAM e disco em "Resources"

---

## 🔐 Segurança

1. ✅ Use **Secrets** do EasyPanel para chaves sensíveis
2. ✅ Configure **Rate Limiting** (já incluído no código)
3. ✅ Use **HTTPS** (EasyPanel fornece automaticamente)
4. ✅ Mantenha dependências atualizadas

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do container
2. Confirme que todas as variáveis de ambiente estão configuradas
3. Verifique se o build do Docker foi bem-sucedido
4. Consulte a documentação do EasyPanel

---

## ✅ Checklist Final

Antes de fazer deploy, confirme:

- [ ] `Dockerfile` e `dockerfile` estão no repositório
- [ ] `.dockerignore` está configurado
- [ ] `JWT_SECRET` foi gerado e adicionado
- [ ] Todas as chaves de API necessárias foram adicionadas
- [ ] Volume persistente configurado (recomendado)
- [ ] Porta 3000 configurada
- [ ] Repositório Git conectado

---

**Boa sorte com o deploy! 🚀**

