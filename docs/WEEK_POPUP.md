# Detailed weekly timetable checks

Run `python tests/support/run_tests.py --dashboard` from the project folder. Uses a temporary database and browser, never your student records.

The suite checks week navigation, seven day columns, 24 hour rows, proportional positioning, overlap lane calculations, midnight segment rendering, completed and all-day reminders, independent future occurrences, the existing reminder/event editors, updated event time and reminder status, mobile scrolling and Escape. Existing dashboard and calendar regression tests run too.

Quick geometry checks: `node tests/planner/week_popup.js`.

Manual checks: open **View Week** on the dashboard or calendar, scroll to midnight and 11 PM, confirm sticky headers and time labels, try Tab/Shift+Tab and Escape, and check light/dark appearance. Hover or focus short blocks for the complete accessible title; click to open the existing editor. The editor still disallows overnight events; the renderer supports splitting them if the backend later permits them. Timed reminders are due-time markers, not scheduled 30-minute tasks. Undated reminders have no calendar date and are not shown.

All views read the same portal records. Weekly events use `StudentCalendar.eventsOn`; reminder occurrences are already stored separately in SQLite. No schema migration or duplicate timetable storage is used.
