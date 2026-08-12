@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

cd /d "%~dp0frontend"

set "CPOLAR_LOG=%USERPROFILE%\.cpolar\logs\cpolar_service.log"
set "PUBLIC_HOST="
set "PUBLIC_HTTP_URL="
set "PUBLIC_HTTPS_URL="

sc query cpolar | findstr /I "RUNNING" >nul 2>&1
if errorlevel 1 (
  echo Starting cpolar service...
  net start cpolar >nul 2>&1
  timeout /t 5 /nobreak >nul
)

for /l %%I in (1,1,15) do (
  if not defined PUBLIC_HOST (
    for /f "usebackq delims=" %%H in (`powershell.exe -NoProfile -Command "$files = Get-ChildItem -Path '%CPOLAR_LOG%*' -File -ErrorAction SilentlyContinue ^| Where-Object { $_.Name -notlike '*master*' } ^| Sort-Object LastWriteTime; $m = $files ^| Select-String -Pattern 'https?://[A-Za-z0-9.-]+\.cpolar\.(cn^|io^|top)' -ErrorAction SilentlyContinue ^| Select-Object -Last 1; if ($m -and $m.Line -match 'https?://([A-Za-z0-9.-]+\.cpolar\.(?:cn^|io^|top))') { $Matches[1] }" 2^>nul`) do set "PUBLIC_HOST=%%H"
  )
  if not defined PUBLIC_HOST timeout /t 1 /nobreak >nul
)

if defined PUBLIC_HOST (
  set "PUBLIC_HTTP_URL=http://!PUBLIC_HOST!"
  set "PUBLIC_HTTPS_URL=https://!PUBLIC_HOST!"
  set "__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=!PUBLIC_HOST!"
)

echo Starting Brain Care Demo...
echo Local SAH-DCI: http://127.0.0.1:8000/?view=dci
echo Local patient: http://127.0.0.1:8000/?view=patient
echo Local nurse:   http://127.0.0.1:8000/?view=nurse
if defined PUBLIC_HOST (
  echo Public SAH-DCI: !PUBLIC_HTTPS_URL!/?view=dci
  echo Public patient: !PUBLIC_HTTPS_URL!/?view=patient
  echo Public nurse:   !PUBLIC_HTTPS_URL!/?view=nurse
) else (
  echo Public URL: unavailable
  echo Check cpolar dashboard: http://127.0.0.1:9200/
)
echo.
echo Keep this window open while the public Demo is in use.
echo Press Ctrl+C to stop the local Demo server.
echo.

call npm.cmd run dev -- --hostname 0.0.0.0 --port 8000

echo.
echo Demo server stopped.
pause
