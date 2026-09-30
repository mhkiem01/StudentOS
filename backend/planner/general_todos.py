"""Personal tasks, deliberately independent of academic reminders and events."""
import re
import sqlite3
import uuid
import task_cleanup
from contextlib import closing
from datetime import date, datetime, timezone


def migrate(path, backups):
    with closing(sqlite3.connect(path)) as con:
        if con.execute("SELECT 1 FROM sqlite_master WHERE name='general_todos'").fetchone():
            return
        backups.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(backups / ('before-general-todos-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.db'))) as dest:
            con.backup(dest)
        con.execute('''CREATE TABLE general_todos(
            id TEXT PRIMARY KEY, title TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('no_progress','in_progress','done')),
            due_date TEXT, due_time TEXT, notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT)''')
        con.commit()


def state(con):
    task_cleanup.purge(con)
    pref = con.execute("SELECT value FROM app_meta WHERE key='portal_general_todos_enabled'").fetchone()
    return {'enabled': bool(pref and pref[0] == 'true'),
            'todos': [dict(row) for row in con.execute('SELECT * FROM general_todos ORDER BY created_at DESC,id')]}


def write(con, payload):
    if not isinstance(payload, dict):
        raise ValueError('Invalid request.')
    action = payload.get('action')
    if action == 'settings':
        enabled = payload.get('enabled')
        if not isinstance(enabled, bool):
            raise ValueError('Enabled must be true or false.')
        con.execute("INSERT OR REPLACE INTO app_meta(key,value) VALUES('portal_general_todos_enabled',?)", ('true' if enabled else 'false',))
    elif action == 'delete':
        if not isinstance(payload.get('id'), str):
            raise ValueError('Select a task.')
        con.execute('DELETE FROM general_todos WHERE id=?', (payload['id'],))
    elif action == 'save':
        item = payload.get('item')
        if not isinstance(item, dict):
            raise ValueError('Invalid task.')
        key = item.get('id')
        if key is not None and not isinstance(key, str):
            raise ValueError('Invalid task ID.')
        old = con.execute('SELECT * FROM general_todos WHERE id=?', (key,)).fetchone() if key else None
        if key and not old:
            raise ValueError('This task no longer exists. Refresh your list.')
        values = {**(dict(old) if old else {}), **item}
        title = values.get('title')
        if not isinstance(title, str) or not title.strip() or len(title.strip()) > 500:
            raise ValueError('Enter a task title between 1 and 500 characters.')
        status = values.get('status', 'no_progress')
        if status not in ('no_progress', 'in_progress', 'done'):
            raise ValueError('Choose a valid status.')
        due_date, due_time = values.get('due_date') or None, values.get('due_time') or None
        if due_date:
            if not isinstance(due_date, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', due_date):
                raise ValueError('Use a valid due date.')
            date.fromisoformat(due_date)
        if due_time and (not isinstance(due_time, str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', due_time)):
            raise ValueError('Use a valid due time.')
        if due_time and not due_date:
            raise ValueError('Choose a date for this due time.')
        notes = values.get('notes', '')
        if not isinstance(notes, str) or len(notes) > 10000:
            raise ValueError('Notes must be text, up to 10,000 characters.')
        now = datetime.now(timezone.utc).isoformat()
        completed = (old['completed_at'] if old and old['status'] == 'done' else now) if status == 'done' else None
        con.execute('''INSERT INTO general_todos(id,title,status,due_date,due_time,notes,created_at,updated_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,
            due_date=excluded.due_date,due_time=excluded.due_time,notes=excluded.notes,
            updated_at=excluded.updated_at,completed_at=excluded.completed_at''',
            (key or str(uuid.uuid4()), title.strip(), status, due_date, due_time, notes,
             old['created_at'] if old else now, now, completed))
    else:
        raise ValueError('Unknown General To-Do action.')
    return state(con)
