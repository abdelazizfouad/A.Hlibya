@echo off
title AH.Libya ERP - Start Server
choice /c 12 /t 4 /d 1 /m "اضغط 1 للرابط الخارجي أو 2 للتشغيل المحلي فقط: "
if errorlevel 2 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local-server.ps1"
if errorlevel 1 if not errorlevel 2 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-remote-server.ps1"