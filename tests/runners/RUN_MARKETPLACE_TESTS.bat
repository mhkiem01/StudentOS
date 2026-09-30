@echo off
cd /d "%~dp0..\.."
python tests\support\run_tests.py --dashboard
if errorlevel 1 (
  echo Marketplace checks failed. Review the output above.
) else (
  echo All selected isolated checks passed.
)
pause
