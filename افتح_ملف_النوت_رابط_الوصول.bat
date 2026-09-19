@echo off
title AH.Libya ERP - Open Remote Access URL Note
chcp 65001 >nul

if exist "رابط_الوصول_من_اي_مكان.txt" (
    start notepad "رابط_الوصول_من_اي_مكان.txt"
    exit
)

if exist "REMOTE_ACCESS_URL.txt" (
    start notepad "REMOTE_ACCESS_URL.txt"
    exit
)

echo لم يتم العثور على ملف النوت بعد.
echo يرجى تشغيل المنظومة عبر start-remote-server.bat أو الضغط على "سيرفر PC" من داخل المنظومة لتوليد الرابط والنوت فورياً.
pause
