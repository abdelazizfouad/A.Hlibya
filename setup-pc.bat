@echo off
title Setup AH.Libya Local Server on PC
chcp 65001 >nul
color 0B
cd /d "%~dp0"

echo ===================================================================
echo     تهيئة وتثبيت منظومة أشرف وهشام ليبيا على جهاز الكمبيوتر لأول مرة
echo ===================================================================
echo.
echo يرجى التأكد من تثبيت Node.js (الإصدار 18 أو أحدث) على جهازك.
echo.
echo [1/3] جاري تثبيت حزم ومكتبات المنظومة (npm install)...
call npm install
if errorlevel 1 (
	echo فشل تثبيت الحزم. تحقق من تثبيت Node.js واتصال الإنترنت ثم أعد المحاولة.
	pause
	exit /b 1
)
echo.
echo [2/3] جاري تنزيل أداة الرابط الخارجي Cloudflare Tunnel...
if not exist "cloudflared.exe" (
	powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
)
if not exist "cloudflared.exe" (
	echo تعذر تنزيل cloudflared.exe. تحقق من اتصال الإنترنت ثم أعد التشغيل.
	pause
	exit /b 1
)
echo.
echo [3/3] جاري بناء ملفات التشغيل المحلي (npm run build)...
call npm run build
if errorlevel 1 (
	echo فشل بناء ملفات التشغيل. راجع رسالة الخطأ ثم أعد المحاولة.
	pause
	exit /b 1
)
echo.
echo ===================================================================
echo   تم التثبيت والتهيئة بنجاح 100%%!
echo   يمكنك الآن تشغيل المنظومة في أي وقت بالضغط على: start-server.bat
echo ===================================================================
echo.
pause
