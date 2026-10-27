@echo off
setlocal
cd /d "%~dp0"
title Student Helper Portal - Anywhere (Tailscale)
echo Starting Student Helper Portal on port 8765 (laptop will stay awake)...
echo On your phone (Tailscale on): http://100.118.32.76:8765/
echo Voice Tutor on this laptop:     http://localhost:8765/  (microphone needs localhost)
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server.py --port 8765 --stay-awake
    goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
    python server.py --port 8765 --stay-awake
    goto :end
)

echo.
echo ERROR: Python 3 was not found on this computer.
echo Install Python 3, then run this file again.
echo.
pause

:end
