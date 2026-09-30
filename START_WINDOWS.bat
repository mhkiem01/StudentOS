@echo off
setlocal
cd /d "%~dp0"
title Student Helper Portal - Local Database
echo Starting Student Helper Portal...
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server.py
    goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
    python server.py
    goto :end
)

echo.
echo ERROR: Python 3 was not found on this computer.
echo Install Python 3, then run this file again.
echo.
pause

:end
