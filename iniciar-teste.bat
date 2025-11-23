@echo off
echo ========================================
echo   DARKSCRIPT AI - Iniciar Servidor
echo ========================================
echo.

REM Verificar se Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo.
    echo Por favor, instale o Node.js em:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
echo.

REM Verificar se node_modules existe
if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    call npm install
    echo.
)

REM Verificar se .env existe
if not exist ".env" (
    echo [AVISO] Arquivo .env nao encontrado.
    echo [AVISO] Criando .env padrao...
    echo PORT=3000 > .env
    echo JWT_SECRET=seu-jwt-secret-aqui >> .env
    echo.
)

echo [INFO] Iniciando servidor...
echo.
echo ========================================
echo   Servidor iniciando na porta 3000
echo   Acesse: http://localhost:3000
echo   Testes: http://localhost:3000/test-modules.html
echo ========================================
echo.
echo Para parar o servidor, pressione Ctrl+C
echo.

REM Iniciar o servidor
call npm start

