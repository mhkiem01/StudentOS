# General To-Do regression checks

Run from the project folder:

```powershell
python -m unittest discover -s tests -t . -p test_general_todos.py
python tests/support/run_tests.py --dashboard
```

The browser suite uses an isolated SQLite workspace and headless Edge/Chrome.
It checks unchanged dashboard card coordinates/dimensions, restoring the original
cards, enabling/disabling without data loss, quick add, status, completion,
optional details, duplication, search, scrolling, and mobile/light/dark layouts.
Python checks backup-before-migration, persistence, validation and academic isolation.

Enable in Settings → Modules / Features → General To-Do. It defaults to off.
Click a task title to edit details, duplicate, or delete with confirmation.
Personal task dates do not add calendar entries or academic deadlines.
