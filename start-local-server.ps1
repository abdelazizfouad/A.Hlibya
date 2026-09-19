$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$env:ENABLE_REMOTE_TUNNEL = 'false'
$env:NODE_ENV = 'production'
$distPath = Join-Path $PSScriptRoot 'dist\server.cjs'
$logPath = Join-Path $PSScriptRoot 'startup-local.log'
$errorLogPath = Join-Path $PSScriptRoot 'startup-local-error.log'

if (-not (Test-Path -LiteralPath $distPath)) {
    Write-Host 'Production build is missing. Building it now...' -ForegroundColor Yellow
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $distPath)) {
        throw 'The production build failed. Run setup-pc.bat and try again.'
    }
}

# Reuse a healthy server already listening on port 3000 instead of starting a duplicate.
$existingConnection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingConnection) {
    try {
        $health = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 3
        if ($health.StatusCode -eq 200) {
            Start-Process 'http://localhost:3000'
            Write-Host 'An active server was found. Opening the application.' -ForegroundColor Green
            exit 0
        }
    } catch {
    }
    throw "Port 3000 is already in use by another application (PID $($existingConnection.OwningProcess)). Stop it and try again."
}

Remove-Item -LiteralPath $logPath, $errorLogPath -Force -ErrorAction SilentlyContinue
$server = Start-Process -FilePath 'node.exe' -ArgumentList '.\dist\server.cjs' -WorkingDirectory $PSScriptRoot -WindowStyle Normal -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru
Set-Content -LiteralPath (Join-Path $PSScriptRoot '.server.pid') -Value $server.Id -Encoding ascii

Write-Host 'Starting local server...' -ForegroundColor Cyan
for ($attempt = 1; $attempt -le 180; $attempt++) {
    try {
        if ($server.HasExited) {
            throw "Server exited. See $errorLogPath"
        }
        if (-not (Test-NetConnection -ComputerName '127.0.0.1' -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue)) {
            throw 'Port 3000 is not ready'
        }
        Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 5 | Out-Null
        Start-Process 'http://localhost:3000'
        Write-Host 'Server is running on http://localhost:3000' -ForegroundColor Green
        Write-Host 'Use stop-server.bat to stop it.' -ForegroundColor Yellow
        exit 0
    } catch {
        Start-Sleep -Seconds 1
    }
}

Write-Error 'Server did not start. Check the server window.'
if (Test-Path -LiteralPath $errorLogPath) { Get-Content -LiteralPath $errorLogPath -Tail 30 }
exit 1