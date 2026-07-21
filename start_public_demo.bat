@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0frontend"

echo Starting Brain Care Demo...
echo Local URL:  http://127.0.0.1:8000/
echo Public URL: https://1cf8b274.r7.cpolar.cn/
echo.
echo Keep this window open while the public Demo is in use.
echo Press Ctrl+C to stop the local Demo server.
echo.

call npm.cmd run dev -- --host 127.0.0.1 --port 8000

echo.
echo Demo server stopped.
pause
