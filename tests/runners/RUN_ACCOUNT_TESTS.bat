@echo off
cd /d "%~dp0..\.."
python tests\support\run_tests.py --accounts
if errorlevel 1 (echo Account tests FAILED. See above.) else (echo Account tests PASSED.)
pause
