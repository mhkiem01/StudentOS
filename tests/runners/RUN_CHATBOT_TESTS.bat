@echo off
cd /d "%~dp0..\.."
python tests\support\run_tests.py --browser
if errorlevel 1 (echo Tests FAILED. See the details above.) else (echo Tests PASSED.)
pause
