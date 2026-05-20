@echo off
setlocal

echo ========================================
echo TradeAlphaAI GitHub Push Helper
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
echo 2. Git status
echo ========================================
call git status
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

echo ========================================
echo 3. Stage all changes
echo ========================================
call git add .
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

echo ========================================
echo 4. Commit message
echo ========================================
set /p COMMIT_MSG=Enter commit message: 
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Update TradeAlphaAI site"
echo.

echo ========================================
echo 5. Create commit
echo ========================================
call git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

echo ========================================
echo 6. Push to GitHub
echo ========================================
call git push origin main
if errorlevel 1 (
  echo.
  echo ERROR DETECTED
  pause
  goto :end
)
echo.

:end
pause
endlocal
