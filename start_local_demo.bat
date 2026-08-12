@echo off
setlocal EnableExtensions
chcp 65001 >nul

cd /d "%~dp0frontend"

echo [Brain Care] Starting the local demo...
echo Patient: http://localhost:8000/?view=patient
echo Nurse:   http://localhost:8000/?view=nurse
echo Other computers should replace localhost with this computer's LAN IPv4 address.
echo Press Ctrl+C to stop the service.
echo.

call npm.cmd run dev -- --hostname 0.0.0.0 --port 8000

endlocal
