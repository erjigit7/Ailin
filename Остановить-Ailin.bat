@echo off
chcp 65001 >nul
title Cinema POS - stop
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Kassa ostanovlena / касса остановлена.'"
timeout /t 2 >nul
