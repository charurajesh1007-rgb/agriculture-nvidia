$body = @{ text = "வணக்கம்"; lang = "ta" } | ConvertTo-Json
$response = Invoke-WebRequest -Uri "http://localhost:8081/" -Method Post -Body $body -ContentType "application/json"
$response.Content
