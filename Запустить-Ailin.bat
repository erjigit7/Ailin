@echo off
chcp 65001 >nul
title Cinema POS
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
