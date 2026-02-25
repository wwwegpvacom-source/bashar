# PowerShell Web Server for CMS
# Listens on http://localhost:8080/

$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Host "Error starting listener. Port $port might be in use." -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit
}

Write-Host "CMS Server Running at http://localhost:$port/index.html" -ForegroundColor Cyan
Write-Host "Do not close this window while editing." -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop."

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    
    $path = $request.Url.LocalPath
    $method = $request.HttpMethod

    # API Endpoint: Save Data
    if ($path -eq "/api/save" -and $method -eq "POST") {
        try {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $content = $reader.ReadToEnd()
            $reader.Close()

            # Save to site_data.js
            $filePath = Join-Path $root "site_data.js"
            [System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)

            Write-Host "[$([DateTime]::Now)] Saved site_data.js" -ForegroundColor Green
            
            # --- TRIGGER BUILD ---
            Write-Host "Triggering Site Build..." -ForegroundColor Yellow
            $buildOk = $false
            $buildError = $null
            try {
                # Run node build_site.js
                $buildProcess = Start-Process -FilePath "node" -ArgumentList "build_site.js" -WorkingDirectory $root -NoNewWindow -PassThru -Wait
                if ($buildProcess.ExitCode -eq 0) {
                    Write-Host "Build Successful!" -ForegroundColor Green
                    $buildOk = $true
                } else {
                    $buildError = "Build failed with exit code $($buildProcess.ExitCode)."
                    Write-Host $buildError -ForegroundColor Red
                }
            } catch {
                $buildError = "Failed to execute build script: $($_.Exception.Message)"
                Write-Host $buildError -ForegroundColor Red
            }
            # ---------------------

            $response.ContentType = "text/plain; charset=utf-8"
            $response.AddHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            $response.AddHeader("Pragma", "no-cache")
            $response.AddHeader("Expires", "0")
            
            # CORS headers just in case
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

            if ($buildOk) {
                $response.StatusCode = 200
                $response.StatusDescription = "OK"
                $bytesOut = [System.Text.Encoding]::UTF8.GetBytes("OK")
                $response.OutputStream.Write($bytesOut, 0, $bytesOut.Length)
            } else {
                $response.StatusCode = 500
                $response.StatusDescription = "Build Failed"
                $msg = if ($buildError) { $buildError } else { "Build failed." }
                $bytesOut = [System.Text.Encoding]::UTF8.GetBytes($msg)
                $response.OutputStream.Write($bytesOut, 0, $bytesOut.Length)
            }
        } catch {
            Write-Host "Error saving file: $_" -ForegroundColor Red
            $response.StatusCode = 500
        }
    }
    else {
        # Serve Static Files
        if ($path -eq "/") { $path = "/index.html" }
        
        $localPath = Join-Path $root $path.TrimStart('/')
        
        # If the path is a directory, try to serve index.html inside it
        if (Test-Path $localPath -PathType Container) {
            $localPath = Join-Path $localPath "index.html"
        }
        
        if (Test-Path $localPath -PathType Leaf) {
            try {
                $bytes = [System.IO.File]::ReadAllBytes($localPath)
                $response.ContentLength64 = $bytes.Length
                $response.AddHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                $response.AddHeader("Pragma", "no-cache")
                $response.AddHeader("Expires", "0")
                
                # Basic MIME types
                $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
                switch ($ext) {
                    ".html" { $response.ContentType = "text/html" }
                    ".js"   { $response.ContentType = "application/javascript" }
                    ".css"  { $response.ContentType = "text/css" }
                    ".png"  { $response.ContentType = "image/png" }
                    ".jpg"  { $response.ContentType = "image/jpeg" }
                    ".svg"  { $response.ContentType = "image/svg+xml" }
                    Default { $response.ContentType = "application/octet-stream" }
                }
                
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 500
            }
        } else {
            $response.StatusCode = 404
        }
    }

    $response.Close()
}
