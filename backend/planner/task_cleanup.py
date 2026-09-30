"""Persistent 24-hour retention for completed personal tasks (UTC, server-owned)."""
import sqlite3, threading, logging
from contextlib import closing
from datetime import datetime

FIELDS={'reminders':('title','description','due_at','priority','subject_id','series_id','status','completed'),
        'general_todos':('title','notes','due_date','due_time','status')}

def migrate(path,backups):
    with closing(sqlite3.connect(path,timeout=20)) as c:
        missing=[t for t in FIELDS if 'cleanup_after' not in {r[1] for r in c.execute('PRAGMA table_info('+t+')')}]
        if not missing:return
        backups.mkdir(parents=True,exist_ok=True)
        with closing(sqlite3.connect(backups/('before-task-cleanup-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))) as dest:c.backup(dest)
        with c:
            c.execute('BEGIN IMMEDIATE')
            for table,fields in FIELDS.items():
                if 'cleanup_after' in {r[1] for r in c.execute('PRAGMA table_info('+table+')')}:continue
                c.execute('ALTER TABLE '+table+' ADD COLUMN cleanup_after TEXT')
                # Old completed items receive a full grace period, not immediate deletion.
                deadline="CASE WHEN NEW.status='done' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now','+24 hours') ELSE NULL END"
                c.execute(f"CREATE TRIGGER {table}_cleanup_insert AFTER INSERT ON {table} BEGIN UPDATE {table} SET cleanup_after={deadline} WHERE id=NEW.id; END")
                changed=' OR '.join('OLD.'+f+' IS NOT NEW.'+f for f in fields)
                c.execute(f"CREATE TRIGGER {table}_cleanup_edit AFTER UPDATE OF {','.join(fields)} ON {table} WHEN {changed} BEGIN UPDATE {table} SET cleanup_after={deadline} WHERE id=NEW.id; END")
                c.execute(f"UPDATE {table} SET cleanup_after=strftime('%Y-%m-%dT%H:%M:%fZ','now','+24 hours') WHERE status='done'")
                c.execute(f'CREATE INDEX {table}_cleanup_due ON {table}(status,cleanup_after)')

def purge(con,now=None):
    counts={}
    for table in FIELDS:
        if 'cleanup_after' not in {r[1] for r in con.execute('PRAGMA table_info('+table+')')}:continue
        counts[table]=con.execute(f"DELETE FROM {table} WHERE status='done' AND cleanup_after IS NOT NULL AND julianday(cleanup_after)<=julianday(COALESCE(?,'now'))",(now,)).rowcount
    return counts

def sweep(base):
    for path in [base,*sorted((base.parent/'users').glob('*/workspace.db'))]:
        if not path.is_file():continue
        try:
            migrate(path,path.parent/'backups')
            with closing(sqlite3.connect(path,timeout=20)) as c,c:
                c.execute('PRAGMA foreign_keys=ON');purge(c)
        except sqlite3.Error:
            logging.exception('Completed-task cleanup failed; will retry on next sweep.')

def start(base):
    stop=threading.Event()
    def worker():
        while not stop.is_set():
            sweep(base)
            stop.wait(60)
    threading.Thread(target=worker,name='completed-task-cleanup',daemon=True).start()
    return stop
