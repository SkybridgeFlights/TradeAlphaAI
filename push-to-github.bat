@echo off
setlocal

echo ========================================
echo TradeAlphaAI GitHub Push Helper
echo ========================================
echo.

cd /d "C:\EA_AI\TradeAlphaAI Final"
if errorlevel 1 (
  echo ERROR: Could not change to project directory.
  goto :end
)

echo ========================================
echo Git Status
echo ========================================
git status
echo.

REM ── Check if there are any uncommitted changes ──────────────
git diff --quiet --exit-code 2>nul
set UNSTAGED=%errorlevel%

git diff --cached --quiet --exit-code 2>nul
set STAGED=%errorlevel%

git ls-files --others --exclude-standard --quiet 2>nul | findstr /r "." >nul 2>nul
set UNTRACKED=%errorlevel%

REM ── Check if branch is ahead of origin/main ─────────────────
git rev-list --count origin/main..HEAD >nul 2>nul
if errorlevel 1 (
  echo WARNING: Cannot compare with origin/main. Ensure remote is reachable.
  set AHEAD=0
) else (
  for /f %%A in ('git rev-list --count origin/main..HEAD 2^>nul') do set AHEAD=%%A
)

REM ── No changes and not ahead: nothing to do ─────────────────
if "%UNSTAGED%"=="0" if "%STAGED%"=="0" if "%UNTRACKED%"=="0" (
  if "%AHEAD%"=="0" (
    echo.
    echo Nothing to commit or push. Working tree is clean and branch is up to date.
    goto :end
  )
)

REM ── No working tree changes but branch is ahead: push only ──
if "%UNSTAGED%"=="0" if "%STAGED%"=="0" if "%UNTRACKED%"=="0" (
  echo.
  echo Branch is %AHEAD% commit(s) ahead of origin/main. Pushing...
  git push origin main
  if errorlevel 1 (
    echo ERROR: Push failed.
    goto :end
  )
  echo Push complete.
  goto :end
)

REM ── Changes exist: stage, commit, push ──────────────────────
echo.
echo ========================================
echo Staging all changes
echo ========================================
git add .
if errorlevel 1 (
  echo ERROR: git add failed.
  goto :end
)
echo.

echo ========================================
echo Commit message
echo ========================================
set /p COMMIT_MSG=Enter commit message (leave blank to cancel):
if "%COMMIT_MSG%"=="" (
  echo Commit cancelled. No commit was made.
  goto :end
)
echo.

echo ========================================
echo Committing
echo ========================================
git commit -m "%COMMIT_MSG%"
set COMMIT_STATUS=%errorlevel%

REM errorlevel 1 from git commit means "nothing to commit" - not fatal
if "%COMMIT_STATUS%"=="1" (
  echo Nothing new to commit. Checking if push is still needed...
)
echo.

REM Refresh ahead count after potential commit
for /f %%A in ('git rev-list --count origin/main..HEAD 2^>nul') do set AHEAD=%%A

if "%AHEAD%"=="0" (
  echo Branch is already up to date with origin/main. Nothing to push.
  goto :end
)

echo ========================================
echo Pushing to GitHub
echo ========================================
git push origin main
if errorlevel 1 (
  echo ERROR: Push failed.
  goto :end
)
echo Push complete.

:end
echo.
pause
endlocal
