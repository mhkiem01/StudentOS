@echo off
cd /d "%~dp0..\.."
python -m unittest discover -s tests -t . -p "test_gym*.py"
if errorlevel 1 goto failed
node tests\gym\gym_rules.js
if errorlevel 1 goto failed
python tests\support\run_browser_check.py --gym
if errorlevel 1 goto failed
echo Gym tests PASSED.
goto end
:failed
echo Gym tests FAILED. See above.
:end
pause
