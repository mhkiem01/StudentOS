@echo off
cd /d "%~dp0..\.."
python tests\support\run_tests.py --notes
if errorlevel 1 (echo Notes tests FAILED. See above.) else (echo Notes tests PASSED.)
pause
