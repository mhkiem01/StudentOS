# Calendar

Open **Timetable** to use the dated calendar. Use the arrows to move between
months, **Today** to return to the current date, or **Go to date** to jump to
any month or year. Month, Week, and Day views include weekends.

Click a date (or **Add event**) and choose the date, start/end time, subject,
location, type, and colour. Choose **Does not repeat** for appointments or
**Every week** for classes. The optional **Repeat until** date is inclusive;
leave it empty for an ongoing weekly series.

Click an event to edit, duplicate, or delete it. Editing/deleting a recurring
event applies to the entire series, as indicated in the editor. Individual
occurrence exceptions, overnight events, and external calendar sync are not
currently supported.

Existing weekday-only timetable entries are preserved as weekly series.
Their dates were never recorded, so no historical start date is invented.
You can set their first date and semester end in the editor.

AI Tutor and photo imports open an editable date review before saving. Select
the first week, correct individual dates/times, and set when repeats end.
The whole import saves in one transaction.

The dashboard shows this calendar week's entries and today's actual schedule.
Calendar data lives in the existing SQLite database. The first migration makes
a SQLite backup under `backups/before-calendar-*.db` before adding date fields.

Verification:

    python -m unittest discover -s tests -t .
    node tests/planner/calendar_dates.js

The optional browser fixture/tests in `tests/calendar_browser*` use a separate
temporary database and a headless browser for real navigation, saving, reload,
recurrence, and mobile layout checks.
