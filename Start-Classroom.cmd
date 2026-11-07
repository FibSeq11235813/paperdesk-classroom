@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 or newer, then open this file again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4170/ in Edge or Chrome.
node server.mjs
pause
