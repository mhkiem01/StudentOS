# Completed reminder / General To-Do retention

Both lists put Done items below unfinished items, including General To-Do's alternative sorting modes.

- Mark Done: start a server-owned 24-hour timer.
- Save an actual edit while Done: restart the full 24 hours.
- Change to No Progress or In Progress: cancel the timer.
- Mark Done again: start a new timer.
- Simply viewing, refreshing or saving unchanged fields does not extend retention.

After expiry, the row is permanently deleted from SQLite, not just hidden. Each recurring reminder occurrence is independent; completing one never deletes future occurrences. The rule also applies when the General To-Do module is hidden.

The background worker checks every minute while the portal server runs. If the computer/server is off, deletion catches up when it starts again. Open lists refresh periodically when no form is being edited. Unsaved text is not a saved edit and does not extend the deadline.

Deadlines use UTC SQLite timestamps and survive restarts. Existing Done rows get a fresh 24-hour grace period when this update is installed. Migration creates a `before-task-cleanup-*.db` backup; expired rows have no undo in the app but may exist in an older backup.

Run `python tests/support/run_tests.py --dashboard` for backend and browser regression checks. Focused timing tests: `python -m unittest discover -s tests -t . -p test_task_cleanup.py`. Tests use temporary databases and simulated cutoff timestamps; no real 24-hour wait is required.
