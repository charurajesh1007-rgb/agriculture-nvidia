$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server started! Open http://localhost:$port/ in your browser."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath
        
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
            $response.AddHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            $response.StatusCode = 200
            $response.Close()
            continue
        }
        
        $response.AddHeader("Access-Control-Allow-Origin", "*")

        if ($localPath -eq "/api/diagnose" -and $request.HttpMethod -eq "POST") {
            # Explicitly use UTF-8 to prevent mangling symbols like °C
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                
                # Convert the body to UTF8 bytes to ensure strict JSON payload format
                $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

                $req = [System.Net.HttpWebRequest]::Create("https://integrate.api.nvidia.com/v1/chat/completions")
                $req.Method = "POST"
                $req.ContentType = "application/json"
                $req.Headers.Add("Authorization", "Bearer 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")
                $req.Timeout = 300000 # 300 seconds timeout for large vision models
                
                $reqStream = $req.GetRequestStream()
                $reqStream.Write($bodyBytes, 0, $bodyBytes.Length)
                $reqStream.Close()

                $res = $req.GetResponse()
                $resStream = $res.GetResponseStream()
                
                $response.ContentType = "text/event-stream; charset=utf-8"
                
                $streamReader = New-Object System.IO.StreamReader($resStream)
                $streamWriter = New-Object System.IO.StreamWriter($response.OutputStream, [System.Text.Encoding]::UTF8)
                $streamWriter.AutoFlush = $true
                
                while (($line = $streamReader.ReadLine()) -ne $null) {
                    $streamWriter.Write($line + "`n")
                }
                
                $streamReader.Close()
                
                $resStream.Close()
            } catch {
                try {
                    $errorMsg = $_.Exception.Message
                    if ($_.ErrorDetails) { $errorMsg += " " + $_.ErrorDetails.Message }
                    $errObj = @{ error = $errorMsg } | ConvertTo-Json -Compress
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($errObj)
                    $response.StatusCode = 500
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                } catch {}
            }
            $response.Close()
            $response.Close()
            continue
        }

        if ($localPath -eq "/api/tts" -and $request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            
            try {
                Add-Type -AssemblyName System.Web.Extensions
                $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
                $json = $serializer.DeserializeObject($body)
                if ($json -and $json["text"] -and $json["lang"]) {
                    $encText = [uri]::EscapeDataString($json["text"])
                    $ttsUrl = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=$($json["lang"])&q=$encText"
                    
                    $ttsReq = [System.Net.HttpWebRequest]::Create($ttsUrl)
                    $ttsReq.Method = "GET"
                    $ttsReq.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                    
                    $ttsRes = $ttsReq.GetResponse()
                    $ttsStream = $ttsRes.GetResponseStream()
                    
                    $response.ContentType = "audio/mpeg"
                    $ttsStream.CopyTo($response.OutputStream)
                    
                    $ttsStream.Close()
                    $ttsRes.Close()
                } else {
                    $response.StatusCode = 400
                }
            } catch {
                $response.StatusCode = 500
            }
            $response.Close()
            continue
        }

        if ($localPath -eq "/") { $localPath = "/index.html" }
        $localPath = $localPath -replace '/', '\'
        $localPath = $localPath -replace '\.\.', ''
        
        $filePath = Join-Path (Get-Location).Path $localPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $buffer = [System.IO.File]::ReadAllBytes($filePath)
            
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".png"  { $response.ContentType = "image/png" }
                default { $response.ContentType = "application/octet-stream" }
            }
            
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
