# Script para testar Gemini API
$apiKey = "AIzaSyAfzU_dEPrIegXUwRHYEXvzKAKmRf8dbDA"
$url = "https://ai.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

$body = @{
    contents = @(
        @{
            role = "user"
            parts = @(
                @{
                    text = "Traduza para inglês: Olá, como você está?"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Testando Gemini API..."
Write-Host "URL: $url"
Write-Host "Enviando requisição..."

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    Write-Host "✅ SUCESSO!" -ForegroundColor Green
    Write-Host "Resposta:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ ERRO:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalhes:"
        Write-Host $_.ErrorDetails.Message
    }
}

