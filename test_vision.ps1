$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("c:\agriculture nvidia\assets\tomato_early_blight.png"))
$dataUrl = "data:image/png;base64,$base64"

$body = @{
    model = "microsoft/phi-3-vision-128k-instruct"
    messages = @(
        @{
            role = "user"
            content = @(
                @{
                    type = "text"
                    text = "What is this?"
                },
                @{
                    type = "image_url"
                    image_url = @{
                        url = $dataUrl
                    }
                }
            )
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
