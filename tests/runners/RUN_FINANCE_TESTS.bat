@echo off
cd /d "%~dp0..\.."
python tests/support/run_tests.py --dashboard
pause
