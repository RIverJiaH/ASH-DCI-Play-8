@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo Brain Care DSTF-Net Research Bridge
echo Mode: frontal EEG mock reconstruction
echo Frequencies: F1=8Hz, F2=9Hz, F3=10Hz
echo.
echo Keep Brain Care Demo running at http://127.0.0.1:8000/
echo This bridge sends simulated DSTF-Net inspired events only.
echo Press Ctrl+C to stop.
echo.

echo Checking Brain Care Demo API...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/bci/events' -UseBasicParsing -TimeoutSec 3; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo.
  echo Brain Care Demo API is not available.
  echo Start start_public_demo.bat first, wait until http://127.0.0.1:8000/ opens, then run this bridge again.
  echo.
  pause
  exit /b 1
)

set "PYTHON_EXE="
set "BUNDLED_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if exist "bci\.venv\Scripts\python.exe" set "PYTHON_EXE=bci\.venv\Scripts\python.exe"
if not defined PYTHON_EXE if exist "%BUNDLED_PYTHON%" set "PYTHON_EXE=%BUNDLED_PYTHON%"
if not defined PYTHON_EXE (
  for /f "delims=" %%P in ('where python.exe 2^>nul') do (
    if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
  )
)

if not defined PYTHON_EXE (
  echo.
  echo Python 3 was not found.
  echo Run setup_bci.bat first or install Python 3.11/3.12.
  pause
  exit /b 1
)

"%PYTHON_EXE%" -u "bci\dstf_research_bridge.py" ^
  --endpoint "http://127.0.0.1:8000/api/bci/events" ^
  --freqs "8,9,10" ^
  --sequence "0,1,2" ^
  --interval-seconds 5

echo.
echo DSTF research bridge stopped.
pause
