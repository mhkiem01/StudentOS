@echo off
setlocal
cd /d "%~dp0"
title Student Helper Portal - Anywhere (Tailscale)
echo Starting Student Helper Portal on port 8765 (laptop will stay awake)...
rem Ask Tailscale for THIS laptop's address, so the link is right on whichever laptop runs the app.
set "TSIP="
for /f "delims=" %%i in ('tailscale ip -4 2^>nul') do if not defined TSIP set "TSIP=%%i"
if defined TSIP goto :tailscale
echo Tailscale is not running on this laptop, so other devices can only reach it on the same Wi-Fi.
echo To use it from anywhere: install Tailscale here and sign in with the same account as your phone.
goto :local
:tailscale
echo On your phone (Tailscale on): http://%TSIP%:8765/
:local
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
