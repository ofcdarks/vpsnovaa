# Instalação do FFmpeg na VPS

## ⚠️ IMPORTANTE: FFmpeg é OBRIGATÓRIO

O FFmpeg é **ESSENCIAL** para a aplicação funcionar corretamente, pois é necessário para:
- ✅ Juntar múltiplos arquivos de áudio em um único arquivo final
- ✅ Converter formatos de áudio (Opus → MP3)
- ✅ Otimizar qualidade de áudio

## 🐳 Se estiver usando Docker (EasyPanel)

O Dockerfile já instala o FFmpeg automaticamente. Certifique-se de que:
1. O Dockerfile está sendo usado corretamente
2. A imagem foi reconstruída após as atualizações
3. O container tem permissões para executar o FFmpeg

### Verificar se FFmpeg está instalado no container:
```bash
docker exec -it <nome-do-container> ffmpeg -version
```

## 🖥️ Se estiver usando VPS direto (sem Docker)

### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg libmp3lame0
ffmpeg -version  # Verificar instalação
```

### CentOS/RHEL:
```bash
sudo yum install -y ffmpeg
# ou
sudo dnf install -y ffmpeg
ffmpeg -version  # Verificar instalação
```

### Verificar instalação:
```bash
which ffmpeg
ffmpeg -version
```

## ✅ Verificação Automática

A aplicação verifica automaticamente se o FFmpeg está disponível:
- ✅ Se disponível: usa para otimizar qualidade de áudio
- ❌ Se não disponível: usa áudio direto da API (sem otimização)
- ⚠️ **CRÍTICO**: FFmpeg é OBRIGATÓRIO para juntar múltiplos áudios

## 🔧 Troubleshooting

### Erro: "FFmpeg não está disponível na VPS"
1. Verifique se o FFmpeg está instalado: `ffmpeg -version`
2. Se não estiver, instale usando os comandos acima
3. Reinicie a aplicação após instalar

### Erro: "Erro no FFMPEG ao juntar áudios"
1. Verifique permissões do diretório `temp_audio` e `final_audio`
2. Verifique se há espaço em disco suficiente
3. Verifique logs do servidor para mais detalhes

### No Docker/EasyPanel:
1. Certifique-se de que o Dockerfile está atualizado
2. Reconstrua a imagem: `docker build -t sua-app .`
3. Verifique se o container tem acesso ao FFmpeg

## 📝 Notas

- O FFmpeg é instalado automaticamente no Dockerfile
- A aplicação detecta automaticamente se o FFmpeg está disponível
- Para juntar áudios, o FFmpeg é **OBRIGATÓRIO** (não há fallback)
- Para conversão de áudio individual, há fallback (usa áudio direto da API)

