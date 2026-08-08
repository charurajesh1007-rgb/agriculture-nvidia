$body = @{
    model = "meta/llama-3.2-90b-vision-instruct"
    messages = @(
        @{
            role = "user"
            content = "hello"
        }
    )
    max_tokens = 10
} | ConvertTo-Json -Depth 10

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $response = Invoke-RestMethod -Uri "https://integrate.api.nvidia.com/v1/chat/completions" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer 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"
            "Content-Type" = "application/json"
        } `
        -Body $body

    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error:" $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host "Details:" $_.ErrorDetails.Message
    }
}
