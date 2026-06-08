@echo off
title EA_AI Platform Startup
echo ======================================================
echo   EA_AI Platform - Starting All Services
echo   %date% %time%
echo ======================================================
echo.

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "scripts\start_services_safe.ps1"

echo.
echo ======================================================
echo   Services startup complete. Check windows above.
echo ======================================================
pause
