@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "PYTHON_EXE="
set "BUNDLED_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if exist "%BUNDLED_PYTHON%" set "PYTHON_EXE=%BUNDLED_PYTHON%"
if not defined PYTHON_EXE (
  for /f "delims=" %%P in ('where python.exe 2^>nul') do (
    if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
  )
)

if not defined PYTHON_EXE (
  echo Python 3 was not found.
  echo Install Python 3.11 or 3.12, then run this file again.
  pause
  exit /b 1
)

echo Creating the Brain Care BCI environment...
"%PYTHON_EXE%" -m venv "bci\.venv"
if errorlevel 1 goto :failed

call "bci\.venv\Scripts\activate.bat"
python -m pip install --upgrade pip
if errorlevel 1 goto :failed
python -m pip install -r "bci\requirements-bci.txt"
if errorlevel 1 goto :failed

echo.
echo BCI environment is ready.
echo Next: start OpenBCI GUI on COM6 and enable LSL stream obci_eeg1.
pause
exit /b 0

:failed
echo.
echo BCI environment setup failed. Check the error above.
pause
exit /b 1
