@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if not exist "bci\.venv\Scripts\python.exe" (
  echo BCI environment is missing.
  echo Run setup_bci.bat first.
  pause
  exit /b 1
)

echo Brain Care OpenBCI Bridge
echo Board: Cyton+Daisy, 16 channels
echo OpenBCI GUI: COM6
echo LSL stream: obci_eeg1
echo EEG channels: 1,3,4
echo.
echo Keep Brain Care Demo running at http://127.0.0.1:8000/
echo Look away from all targets before repeating the same selection.
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

"bci\.venv\Scripts\python.exe" -u "bci\openbci_lsl_bridge.py" ^
  --stream-name "obci_eeg1" ^
  --channels "1,3,4" ^
  --freqs "6,8.57,13.85,15,10" ^
  --endpoint "http://127.0.0.1:8000/api/bci/events"

echo.
echo OpenBCI bridge stopped.
pause
