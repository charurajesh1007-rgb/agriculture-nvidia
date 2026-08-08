$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8081/")
$listener.Start()

$context = $listener.GetContext()
$request = $context.Request
$response = $context.Response

$reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
$body = $reader.ReadToEnd()
$json = $body | ConvertFrom-Json
$encText = [uri]::EscapeDataString($json.text)

$output = "Original text: $($json.text) `r`nEncoded: $encText"
$buffer = [System.Text.Encoding]::UTF8.GetBytes($output)

$response.ContentLength64 = $buffer.Length
$response.OutputStream.Write($buffer, 0, $buffer.Length)
$response.Close()
$listener.Stop()
