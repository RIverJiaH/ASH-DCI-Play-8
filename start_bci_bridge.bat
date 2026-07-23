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

"bci\.venv\Scripts\python.exe" -u "bci\openbci_lsl_bridge.py" ^
  --stream-name "obci_eeg1" ^
  --channels "1,3,4" ^
  --freqs "6,8.57,13.85,15" ^
  --endpoint "http://127.0.0.1:8000/api/bci/events"

echo.
echo OpenBCI bridge stopped.
pause
