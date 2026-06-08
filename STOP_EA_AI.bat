@echo off
title EA_AI Platform Shutdown
echo ======================================================
echo   EA_AI Platform - Stopping All Services
echo   %date% %time%
echo ======================================================
echo.

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "scripts\stop_services_safe.ps1"

echo.
echo ======================================================
echo   All services stopped.
echo ======================================================
pause
