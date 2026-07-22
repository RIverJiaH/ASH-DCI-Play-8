@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

cd /d "%~dp0frontend"

set "CPOLAR_LOG=%USERPROFILE%\.cpolar\logs\cpolar_service.log"
set "PUBLIC_URL="
set "PUBLIC_HTTP_URL="
set "PUBLIC_HOST="

sc query cpolar | findstr /I "RUNNING" >nul 2>&1
if errorlevel 1 (
  echo Starting cpolar service...
  net start cpolar >nul 2>&1
  timeout /t 5 /nobreak >nul
)

for /l %%I in (1,1,15) do (
  if not defined PUBLIC_URL (
    for /f "usebackq delims=" %%U in (`powershell.exe -NoProfile -Command "$m = Select-String -Path '%CPOLAR_LOG%' -Pattern 'Tunnel established at https://' -ErrorAction SilentlyContinue | Select-Object -Last 1; if ($m -and $m.Line -match 'https://[A-Za-z0-9.-]+') { $Matches[0] }" 2^>nul`) do set "PUBLIC_URL=%%U"
  )
  if not defined PUBLIC_URL timeout /t 1 /nobreak >nul
)

if defined PUBLIC_URL (
  for /f "usebackq delims=" %%H in (`powershell.exe -NoProfile -Command "([uri]'!PUBLIC_URL!').Host"`) do set "PUBLIC_HOST=%%H"
  set "PUBLIC_HTTP_URL=!PUBLIC_URL:https://=http://!"
  set "__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=!PUBLIC_HOST!"
)

echo Starting Brain Care Demo...
echo Local URL:  http://127.0.0.1:8000/
if defined PUBLIC_URL (
  echo Public HTTPS: !PUBLIC_URL!/
  echo Public HTTP:  !PUBLIC_HTTP_URL!/
) else (
  echo Public URL: unavailable
  echo Check cpolar dashboard: http://127.0.0.1:9200/
)
echo.
echo Keep this window open while the public Demo is in use.
echo Press Ctrl+C to stop the local Demo server.
echo.

call npm.cmd run dev -- --host 127.0.0.1 --port 8000

echo.
echo Demo server stopped.
pause
