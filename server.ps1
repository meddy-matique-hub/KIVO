$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "KIVO Web Server listening on http://localhost:8080..."
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        $localPath = $req.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($localPath)) { $localPath = "index.html" }
        $filePath = Join-Path "c:\KIVO" $localPath
        if (-not (Test-Path $filePath) -or (Get-Item $filePath).PSIsContainer) {
            $filePath = "c:\KIVO\index.html"
        }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $res.ContentLength64 = $bytes.Length
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        if ($ext -eq ".html") { $res.ContentType = "text/html; charset=utf-8" }
        elseif ($ext -eq ".css") { $res.ContentType = "text/css" }
        elseif ($ext -eq ".js") { $res.ContentType = "application/javascript" }
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.OutputStream.Close()
    } catch {
        Write-Host "Request error: $_"
    }
}
