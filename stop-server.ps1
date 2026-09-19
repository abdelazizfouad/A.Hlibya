$ErrorActionPreference = 'SilentlyContinue'
Set-Location -LiteralPath $PSScriptRoot

$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen
foreach ($connection in $connections) {
    Stop-Process -Id $connection.OwningProcess -Force
}

$pidPath = Join-Path $PSScriptRoot '.server.pid'
if (Test-Path $pidPath) {
    $serverPid = Get-Content -LiteralPath $pidPath -Raw
    if ($serverPid -match '^\d+$') { Stop-Process -Id ([int]$serverPid.Trim()) -Force }
    Remove-Item -LiteralPath $pidPath -Force
}

Write-Host 'Server and remote tunnel stopped.' -ForegroundColor Green
Write-Host 'The remote URL is unavailable after stopping.' -ForegroundColor Yellow
