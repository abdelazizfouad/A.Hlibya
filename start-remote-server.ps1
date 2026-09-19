$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$env:ENABLE_REMOTE_TUNNEL = 'true'
$env:NODE_ENV = 'production'
$notePath = Join-Path $PSScriptRoot 'REMOTE_ACCESS_URL.txt'
$arabicNotePath = Join-Path $PSScriptRoot 'رابط_الوصول_من_اي_مكان.txt'
$logPath = Join-Path $PSScriptRoot 'startup-remote.log'
$errorLogPath = Join-Path $PSScriptRoot 'startup-remote-error.log'
Remove-Item -LiteralPath $notePath, $arabicNotePath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $errorLogPath -Force -ErrorAction SilentlyContinue

# Stop a previous copy so it cannot occupy port 3000 or own an old tunnel.
$oldPidPath = Join-Path $PSScriptRoot '.server.pid'
if (Test-Path $oldPidPath) {
    $oldPid = Get-Content -LiteralPath $oldPidPath -Raw
    if ($oldPid -match '^\d+$') { Stop-Process -Id ([int]$oldPid.Trim()) -Force -ErrorAction SilentlyContinue }
}

$server = Start-Process -FilePath 'node.exe' -ArgumentList @('.\dist\server.cjs', '--remote') -WorkingDirectory $PSScriptRoot -WindowStyle Normal -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru
Set-Content -LiteralPath (Join-Path $PSScriptRoot '.server.pid') -Value $server.Id -Encoding ascii

Write-Host 'Starting server and waiting for remote URL...' -ForegroundColor Cyan
for ($attempt = 1; $attempt -le 180; $attempt++) {
    try {
        $health = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 3
        if ($health.StatusCode -ne 200) { throw 'Backend health check failed' }
        if (Test-Path $notePath) {
            $note = Get-Content -LiteralPath $notePath -Raw
            if ($note -match 'https://') {
                Start-Process 'notepad.exe' -ArgumentList $notePath
                Start-Process 'http://localhost:3000'
                Write-Host 'Remote URL is ready and the note file is open.' -ForegroundColor Green
                Write-Host 'Use stop-server.bat to stop it.' -ForegroundColor Yellow
                exit 0
            }
        }
        if ($server.HasExited) {
            throw "Server exited. See $logPath"
        }
    } catch {
    }
    Start-Sleep -Seconds 1
}

Write-Host "Remote URL was not created within the timeout. Details: $logPath" -ForegroundColor Red
if (Test-Path $logPath) { Get-Content -LiteralPath $logPath -Tail 30 }
if (Test-Path $errorLogPath) { Get-Content -LiteralPath $errorLogPath -Tail 30 }
exit 1