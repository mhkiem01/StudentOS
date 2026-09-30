#!/bin/bash
cd "$(dirname "$0")"
echo "Starting QuizPrep AI..."
if command -v python3 >/dev/null 2>&1; then
  python3 server.py
elif command -v python >/dev/null 2>&1; then
  python server.py
else
  echo "Python 3 was not found. Install Python 3 and try again."
  read -p "Press Enter to close..."
fi
