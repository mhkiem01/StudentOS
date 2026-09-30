"""Dated calendar migration and validation; legacy weekday events stay weekly."""
import re
import sqlite3
from contextlib import closing
from datetime import date, datetime

COLUMNS = ('id', 'subject_id', 'title', 'day', 'start_time', 'end_time',
           'location', 'event_type', 'color', 'event_date', 'recurrence', 'repeat_until')


def migrate(db_path, backup_dir):
    with closing(sqlite3.connect(db_path)) as con, con:
        columns = {r[1] for r in con.execute('PRAGMA table_info(timetable_events)')}
        additions = {'event_date': 'TEXT', 'recurrence': "TEXT NOT NULL DEFAULT 'weekly'",
                     'repeat_until': 'TEXT'}
        reminder_columns = {r[1] for r in con.execute('PRAGMA table_info(reminders)')}
        if all(k in columns for k in additions) and {'series_id','status'} <= reminder_columns:
            return
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup = backup_dir / ('before-calendar-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.db')
        with closing(sqlite3.connect(backup)) as destination:
            con.backup(destination)
        con.execute('BEGIN IMMEDIATE')
        for key, declaration in additions.items():
            if key not in columns:
                con.execute(f'ALTER TABLE timetable_events ADD COLUMN {key} {declaration}')
        if 'series_id' not in reminder_columns:
            con.execute('ALTER TABLE reminders ADD COLUMN series_id TEXT')
        if 'status' not in reminder_columns:
            con.execute("ALTER TABLE reminders ADD COLUMN status TEXT NOT NULL DEFAULT 'no_progress' CHECK(status IN ('no_progress','in_progress','done'))")
            con.execute("UPDATE reminders SET status=CASE WHEN completed=1 THEN 'done' ELSE 'no_progress' END")
        con.execute("INSERT OR REPLACE INTO app_meta(key,value) VALUES('calendar_schema','3')")


def parse_date(value, label):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError(label + ' must be a date (YYYY-MM-DD).')
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(label + ' is not a valid date.') from exc


def validate(item):
    item = dict(item)
    if not str(item.get('id') or '').strip():
        raise ValueError('An event id is required.')
    item['title'] = str(item.get('title') or '').strip()
    if not item['title']:
        raise ValueError('Give the event a name.')
    for key in ('start_time', 'end_time'):
        if not isinstance(item.get(key), str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', item[key]):
            raise ValueError('Start and end times must use HH:MM.')
    if item['end_time'] <= item['start_time']:
        raise ValueError('End time must be later than start time (on the same date).')
    # Old clients and legacy AI imports contain only a weekday: keep their meaning.
    item['event_date'] = item.get('event_date') or None
    item['recurrence'] = item.get('recurrence') or ('none' if item['event_date'] else 'weekly')
    item['repeat_until'] = item.get('repeat_until') or None
    if item['recurrence'] not in ('none', 'weekly'):
        raise ValueError('Repeat must be none or weekly.')
    if item['event_date']:
        start = parse_date(item['event_date'], 'Event date')
        item['day'] = start.weekday()
    else:
        if item['recurrence'] != 'weekly':
            raise ValueError('Choose the event date.')
        if isinstance(item.get('day'), bool) or str(item.get('day')) not in [str(d) for d in range(7)]:
            raise ValueError('Choose a valid weekday.')
        item['day'] = int(item['day'])
    if item['repeat_until']:
        end = parse_date(item['repeat_until'], 'Repeat until')
        if item['event_date'] and end < start:
            raise ValueError('Repeat until must be on or after the first event date.')
    if item['recurrence'] == 'none':
        item['repeat_until'] = None
    item['subject_id'] = item.get('subject_id') or None
    item['color'] = item.get('color') or '#6d4df4'
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', item['color']):
        raise ValueError('Choose a valid event colour.')
    return item


def write(con, item):
    con.execute('INSERT INTO timetable_events (' + ','.join(COLUMNS) + ') VALUES (' +
                ','.join('?' for _ in COLUMNS) + ') ON CONFLICT(id) DO UPDATE SET ' +
                ','.join(f'{c}=excluded.{c}' for c in COLUMNS if c != 'id'),
                [item.get(c) for c in COLUMNS])
