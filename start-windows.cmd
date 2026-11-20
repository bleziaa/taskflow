@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\node.exe" (
  "runtime\node.exe" scripts\start-local.js %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-windows.ps1" %*
)
if errorlevel 1 (
  echo TaskFlow no pudo iniciarse. Revisa el mensaje anterior.
  pause
  exit /b 1
)
