# Guia de Diagnóstico do FFMPEG

## ❓ O que é FFMPEG?

O FFMPEG é uma ferramenta essencial para processar áudio e vídeo. Este servidor usa o FFMPEG para:
- Juntar múltiplos arquivos de áudio em um único arquivo
- Converter formatos de áudio (Opus → MP3)
- Otimizar qualidade do áudio

## 🔍 Como Verificar se o FFMPEG Está Funcionando

### 1. Via API (Recomendado)

Acesse no navegador ou Postman:
```
http://localhost:3000/api/system/diagnostics
```

Resposta esperada:
```json
{
  "success": true,
  "ffmpeg": {
    "available": true,
    "path": "C:\\caminho\\para\\ffmpeg.exe",
    "status": "OK"
  },
  "server": {
    "nodeVersion": "v20.x.x",
    "platform": "win32",
    "uptime": 123.45
  }
}
```

### 2. Via Terminal/CMD

No diretório do projeto, execute:
```bash
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"
```

Deve mostrar o caminho do FFMPEG, exemplo:
```
C:\Users\...\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe
```

### 3. Verificar Instalação Manual

Se o FFMPEG estiver instalado no sistema:
```bash
ffmpeg -version
```

Deve mostrar a versão do FFMPEG instalado.

## ✅ Soluções para Problemas Comuns

### Problema 1: "FFmpeg não está disponível na VPS"

**Solução 1**: Reinstalar o pacote
```bash
npm uninstall @ffmpeg-installer/ffmpeg
npm install @ffmpeg-installer/ffmpeg --save
```

**Solução 2**: Instalar FFMPEG no sistema
- Windows: Baixar de https://ffmpeg.org/download.html
- Linux: `sudo apt install ffmpeg`
- Mac: `brew install ffmpeg`

### Problema 2: "Erro no FFMPEG ao juntar áudios"

**Causas possíveis**:
1. Arquivos de áudio temporários corrompidos
2. Permissões de arquivo insuficientes
3. Espaço em disco insuficiente

**Solução**:
1. Verificar logs do servidor para detalhes específicos
2. Limpar pasta `temp_audio/`: `rm -rf temp_audio/*`
3. Limpar pasta `final_audio/`: `rm -rf final_audio/*`
4. Reiniciar o servidor

### Problema 3: "Erro no FFMPEG durante otimização"

**Solução**:
O sistema já tem fallback automático. Se der erro, o áudio será retornado sem otimização.
Nenhuma ação necessária do usuário.

## 📊 Logs Detalhados

O servidor agora mostra logs detalhados para diagnóstico:

```
🔧 Preparando para juntar 3 arquivos de áudio...
🔧 FFmpeg Path: C:\...\ffmpeg.exe
   ✅ Arquivo encontrado: temp_audio/job123_part_0.mp3 (45678 bytes)
   ✅ Arquivo encontrado: temp_audio/job123_part_1.mp3 (45678 bytes)
   ✅ Arquivo encontrado: temp_audio/job123_part_2.mp3 (45678 bytes)
🚀 Iniciando FFMPEG com comando: ffmpeg -i temp_audio/job123_part_0.mp3 ...
✅ Áudios juntados com sucesso: 3 partes combinadas em final_audio/job123.mp3
```

## 🆘 Ainda com Problemas?

1. **Ative logs detalhados**: O servidor já mostra logs automáticos
2. **Verifique o console**: Procure por mensagens de erro com `❌`
3. **Verifique permissões**: Garanta que o servidor tem permissão para criar/ler/escrever nas pastas `temp_audio/` e `final_audio/`
4. **Verifique espaço em disco**: Garanta que há espaço suficiente

## 🔧 Melhorias Implementadas

- ✅ Verificação dupla de FFMPEG (@ffmpeg-installer + sistema)
- ✅ Logs detalhados para diagnóstico
- ✅ Verificação de arquivos antes de juntar
- ✅ Fallback automático em caso de erro
- ✅ Mensagens de erro mais claras para usuários
- ✅ Endpoint de diagnóstico (`/api/system/diagnostics`)

