$body = @{ text = "வணக்கம்"; lang = "ta" } | ConvertTo-Json
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/tts" -Method Post -Body $body -ContentType "application/json"
$response.StatusCode
$response.Headers
