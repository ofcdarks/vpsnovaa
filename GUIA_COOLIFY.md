# 🚀 Guia Completo: Deploy no Coolify v4.0.0-beta.444

Este guia mostra como fazer deploy da aplicação DARKSCRIPT AI no Coolify usando Git.

---

## 📋 Pré-requisitos

1. **Conta no Coolify** instalada e configurada
2. **Repositório Git** (GitHub, GitLab, Bitbucket, ou Git auto-hospedado)
3. **Acesso SSH** ao servidor Coolify (se necessário)
4. **Dockerfile** já configurado (✅ já existe no projeto)

---

## 🔧 Passo 1: Preparar o Repositório Git

### 1.1. Verificar arquivos essenciais

Certifique-se de que estes arquivos estão no repositório:

- ✅ `Dockerfile` (já existe)
- ✅ `package.json` (já existe)
- ✅ `.dockerignore` (recomendado - criar se não existir)
- ✅ `.gitignore` (já existe)

### 1.2. Criar/Verificar `.dockerignore`

Crie um arquivo `.dockerignore` na raiz do projeto com:

```dockerignore
node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
*.log
.DS_Store
temp_audio
public/final_audio
public/uploads
darkscript.db
*.db
*.sqlite
*.sqlite3
coverage
.vscode
.idea
*.md
!README.md
```

### 1.3. Fazer commit e push

```bash
git add .
git commit -m "Preparar para deploy no Coolify"
git push origin main
```

---

## 🌐 Passo 2: Configurar o Coolify

### 2.1. Acessar o Coolify

1. Acesse o painel do Coolify (geralmente em `https://seu-coolify.com`)
2. Faça login com suas credenciais

### 2.2. Criar Novo Projeto

1. No dashboard, clique em **"New Resource"** ou **"Novo Recurso"**
2. Selecione **"Application"** ou **"Aplicação"**
3. Escolha **"Git Repository"** como fonte

### 2.3. Conectar Repositório Git

#### Opção A: GitHub/GitLab/Bitbucket (OAuth)

1. Clique em **"Connect Repository"**
2. Selecione seu provedor (GitHub, GitLab, etc.)
3. Autorize o Coolify a acessar seus repositórios
4. Selecione o repositório da aplicação
5. Escolha o branch (geralmente `main` ou `master`)

#### Opção B: Repositório Privado (Token/SSH)

1. Se for repositório privado, você precisará:
   - **GitHub**: Personal Access Token com permissão `repo`
   - **GitLab**: Deploy Token ou Personal Access Token
   - **SSH**: Adicionar chave SSH no Coolify

2. Configure as credenciais no Coolify:
   - Vá em **Settings** → **Source Providers**
   - Adicione suas credenciais

---

## ⚙️ Passo 3: Configurar a Aplicação no Coolify

### 3.1. Informações Básicas

Preencha os campos:

- **Name**: `darkscript-ai` (ou o nome que preferir)
- **Description**: `DARKSCRIPT AI - Plataforma de criação de roteiros`
- **Repository**: Seu repositório Git
- **Branch**: `main` (ou o branch principal)
- **Build Pack**: **Docker** (o Coolify detectará automaticamente o Dockerfile)

### 3.2. Configurações de Build

O Coolify v4 detecta automaticamente o Dockerfile, mas você pode verificar:

- **Dockerfile Path**: `Dockerfile` (deixe vazio se estiver na raiz)
- **Docker Build Context**: `.` (ponto = raiz do projeto)
- **Build Command**: (deixe vazio - o Dockerfile já tem o CMD)

### 3.3. Variáveis de Ambiente

Adicione as variáveis de ambiente necessárias:

#### Variáveis Obrigatórias:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=sua_chave_secreta_jwt_aqui
```

#### Variáveis de API (adicione suas chaves):

```env
# OpenAI (GPT)
OPENAI_API_KEY=sua_chave_openai

# Anthropic (Claude)
ANTHROPIC_API_KEY=sua_chave_anthropic

# Google Gemini
GEMINI_API_KEY_1=sua_chave_gemini_1
GEMINI_API_KEY_2=sua_chave_gemini_2
# ... adicione mais se necessário

# YouTube API
YOUTUBE_API_KEY=sua_chave_youtube

# ImageFX Cookies
IMAGEFX_COOKIES=seus_cookies_imagefx

# Email (para ativação de usuários)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_app
SMTP_FROM=seu_email@gmail.com

# Hotmart Webhook
HOTMART_HOTTOK=seu_token_hotmart
```

#### Como adicionar variáveis no Coolify:

1. Na página da aplicação, vá em **"Environment Variables"** ou **"Variáveis de Ambiente"**
2. Clique em **"Add Variable"** ou **"Adicionar Variável"**
3. Adicione cada variável uma por uma
4. **IMPORTANTE**: Marque como **"Encrypted"** ou **"Criptografada"** para segurança

### 3.4. Configurações de Porta

- **Port**: `3000` (padrão da aplicação)
- **Expose Port**: Deixe marcado se quiser expor diretamente (não recomendado)
- **Use HTTPS**: Marque esta opção

---

## 🔄 Passo 4: Configurar Domínio e SSL

### 4.1. Adicionar Domínio

1. Na seção **"Domains"** ou **"Domínios"**
2. Adicione seu domínio (ex: `app.darkscript.com.br`)
3. O Coolify configurará automaticamente o DNS reverso

### 4.2. Configurar DNS

No seu provedor de DNS (Cloudflare, Registro.br, etc.), adicione:

**Tipo A Record:**
```
Nome: app (ou @ para raiz)
Valor: IP_DO_SERVIDOR_COOLIFY
TTL: 3600
```

**Ou CNAME:**
```
Nome: app
Valor: seu-coolify.com
TTL: 3600
```

### 4.3. SSL Automático

O Coolify v4 configura SSL automaticamente usando Let's Encrypt:
- Certificado será gerado automaticamente
- Renovação automática configurada

---

## 🚀 Passo 5: Fazer o Deploy

### 5.1. Deploy Inicial

1. Na página da aplicação, clique em **"Deploy"** ou **"Fazer Deploy"**
2. O Coolify irá:
   - Clonar o repositório
   - Construir a imagem Docker
   - Iniciar o container
   - Configurar o domínio e SSL

### 5.2. Acompanhar o Build

Você verá logs em tempo real:
- Clonagem do repositório
- Build da imagem Docker
- Instalação de dependências
- Inicialização do container

### 5.3. Verificar Status

Após o deploy, verifique:
- ✅ Status: **Running** ou **Em Execução**
- ✅ Health Check: **Healthy** ou **Saudável**
- ✅ URL: Acesse a URL configurada

---

## 🔍 Passo 6: Verificar e Testar

### 6.1. Verificar Logs

1. Na página da aplicação, vá em **"Logs"**
2. Verifique se não há erros
3. Procure por: `Server running on port 3000`

### 6.2. Testar Endpoints

Acesse no navegador:
- `https://seu-dominio.com/` - Interface principal
- `https://seu-dominio.com/api/health` - Health check (se existir)

### 6.3. Verificar Funcionalidades

Teste as principais funcionalidades:
- ✅ Login/Registro
- ✅ Geração de roteiros
- ✅ Geração de voz
- ✅ Geração de imagens
- ✅ Validação de API keys

---

## 🔄 Passo 7: Configurar Deploy Automático

### 7.1. Webhook de Deploy

O Coolify v4 suporta webhooks automáticos:

1. Na página da aplicação, vá em **"Settings"** → **"Webhooks"**
2. Copie a URL do webhook
3. No seu repositório Git (GitHub/GitLab):
   - Vá em **Settings** → **Webhooks**
   - Adicione a URL do Coolify
   - Evento: **Push** (para deploy automático em cada push)

### 7.2. Deploy Manual

Para fazer deploy manual:
1. Na página da aplicação
2. Clique em **"Redeploy"** ou **"Refazer Deploy"**
3. Ou use o botão **"Deploy Latest"**

---

## 🛠️ Passo 8: Troubleshooting

### Problema: Build Falha

**Solução:**
1. Verifique os logs de build
2. Certifique-se de que o Dockerfile está correto
3. Verifique se todas as dependências estão no `package.json`
4. Verifique se o `.dockerignore` não está excluindo arquivos necessários

### Problema: Container não inicia

**Solução:**
1. Verifique os logs do container
2. Verifique se a porta 3000 está configurada corretamente
3. Verifique as variáveis de ambiente
4. Verifique se o `CMD` no Dockerfile está correto

### Problema: Erro de permissão

**Solução:**
1. Verifique se os diretórios `public`, `temp_audio`, `data` têm permissões corretas
2. O Dockerfile já configura permissões, mas pode ser necessário ajustar

### Problema: FFmpeg não funciona

**Solução:**
1. O Dockerfile já instala FFmpeg
2. Verifique os logs para ver se há erros de FFmpeg
3. Teste com: `docker exec -it container_name ffmpeg -version`

### Problema: Variáveis de ambiente não funcionam

**Solução:**
1. Verifique se as variáveis estão marcadas como **"Encrypted"**
2. Certifique-se de que não há espaços extras nos valores
3. Reinicie o container após adicionar novas variáveis

---

## 📊 Passo 9: Monitoramento

### 9.1. Logs em Tempo Real

- Acesse **"Logs"** na página da aplicação
- Os logs são atualizados em tempo real
- Use filtros para buscar erros específicos

### 9.2. Métricas

O Coolify v4 mostra:
- Uso de CPU
- Uso de Memória
- Uso de Disco
- Tráfego de Rede

### 9.3. Health Checks

O Dockerfile já inclui um healthcheck:
- Intervalo: 30 segundos
- Timeout: 3 segundos
- Retries: 3

---

## 🔐 Passo 10: Segurança

### 10.1. Variáveis Sensíveis

- ✅ Sempre marque variáveis sensíveis como **"Encrypted"**
- ✅ Nunca commite `.env` no Git
- ✅ Use tokens com permissões mínimas necessárias

### 10.2. Firewall

Configure o firewall do servidor:
- Porta 80 (HTTP) - aberta
- Porta 443 (HTTPS) - aberta
- Porta 3000 - apenas interna (não expor diretamente)

### 10.3. Atualizações

- Mantenha o Coolify atualizado
- Mantenha as dependências atualizadas
- Configure atualizações automáticas se possível

---

## 📝 Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] Repositório Git configurado e com código atualizado
- [ ] Dockerfile funcionando localmente
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Domínio configurado e apontando para o servidor
- [ ] SSL funcionando (certificado válido)
- [ ] Aplicação acessível via HTTPS
- [ ] Logs sem erros críticos
- [ ] Health check passando
- [ ] Funcionalidades principais testadas
- [ ] Webhook de deploy automático configurado (opcional)

---

## 🆘 Suporte

Se encontrar problemas:

1. **Logs do Coolify**: Verifique os logs detalhados
2. **Logs da Aplicação**: Verifique os logs do container
3. **Documentação do Coolify**: https://coolify.io/docs
4. **Comunidade**: Discord do Coolify

---

## 🎉 Pronto!

Sua aplicação DARKSCRIPT AI está no ar no Coolify! 🚀

**Lembre-se:**
- Cada push no branch principal pode fazer deploy automático (se configurado)
- Monitore os logs regularmente
- Mantenha as variáveis de ambiente atualizadas
- Faça backups regulares do banco de dados

---

**Última atualização:** Janeiro 2025
**Versão do Coolify:** v4.0.0-beta.444

