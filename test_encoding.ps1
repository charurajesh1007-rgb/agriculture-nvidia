$jsonStr = '{"text": "வணக்கம்", "lang": "ta"}'
$json = $jsonStr | ConvertFrom-Json
$encText = [uri]::EscapeDataString($json.text)
Write-Output "Encoded: $encText"
