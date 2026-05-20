@echo off
setlocal

echo ========================================
echo TradeAlphaAI Insights Review Workflow
echo ========================================
echo.

echo ========================================
echo 1. Change to project directory
echo ========================================
call cd /d "C:\EA_AI\TradeAlphaAI Final"
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

echo ========================================
echo 2. Discover insight topics
echo ========================================
call npm run insights:discover
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

echo ========================================
echo 3. Run insights pipeline in review mode
echo ========================================
call npm run insights:pipeline
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

echo ========================================
echo 4. Detect newest generated insight article
echo ========================================
if not exist "C:\EA_AI\TradeAlphaAI Final\insights\" (
  echo.
  echo ERROR DETECTED
  echo Insights folder is missing:
  echo C:\EA_AI\TradeAlphaAI Final\insights\
  pause
  goto :end
)

set "LATEST_INSIGHT="
for /f "delims=" %%F in ('dir /b /a:-d /o:-d "C:\EA_AI\TradeAlphaAI Final\insights\*.html" 2^>nul') do (
  if /i not "%%F"=="index.html" (
    set "LATEST_INSIGHT=%%F"
    goto :latest_found
  )
)

:latest_found
if "%LATEST_INSIGHT%"=="" (
  echo.
  echo ERROR DETECTED
  echo No generated insight article was found in:
  echo C:\EA_AI\TradeAlphaAI Final\insights\
  pause
  goto :end
)

set "LATEST_URL=http://localhost:8098/insights/%LATEST_INSIGHT%"
echo Newest article:
echo %LATEST_INSIGHT%
echo.

echo ========================================
echo 5. Run production readiness checks
echo ========================================
call npm run check:production
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

echo ========================================
echo 6. Check local static server dependency
echo ========================================
call where serve >nul 2>nul
if errorlevel 1 (
  echo.
  echo serve is not installed globally.
  echo Run this command:
  echo npm install -g serve
  echo.
  pause
  goto :end
)
echo.

echo ========================================
echo 7. Start local static server
echo ========================================
call start "TradeAlphaAI Static Server" cmd /k "cd /d ""C:\EA_AI\TradeAlphaAI Final"" && call npx serve . -l 8098"
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  echo Server failed to start.
  pause
  goto :end
)
echo.

echo Waiting 35 seconds for the server to become ready...
call timeout /t 35 /nobreak
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

echo ========================================
echo 8. Open newest article
echo ========================================
echo Opened article filename:
echo %LATEST_INSIGHT%
echo.
echo Opened URL:
echo %LATEST_URL%
echo.
call start "" "%LATEST_URL%"
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  echo Failed to open browser.
  pause
  goto :end
)
echo.

:end
pause
endlocal
