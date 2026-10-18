@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-mi-estudio.ps1" -Detener
if errorlevel 1 pause
