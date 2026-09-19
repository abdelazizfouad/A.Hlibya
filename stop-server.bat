@echo off
title AH.Libya ERP - Stop Server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-server.ps1"