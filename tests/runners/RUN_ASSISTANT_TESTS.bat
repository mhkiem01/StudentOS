@echo off
cd /d "%~dp0..\.."
python -m unittest discover -s tests -t . -p "test_assistant*.py"
if errorlevel 1 goto failed
python -m unittest discover -s tests -t . -p test_ai_chat.py
if errorlevel 1 goto failed
python tests\support\run_browser_check.py --assistant
if errorlevel 1 goto failed
echo Assistant tests PASSED.
goto end
:failed
echo Assistant tests FAILED. See above.
:end
pause
