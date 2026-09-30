import unittest
import backend  # adds backend/<feature> folders to the import path
import reminders_store as R
from tests.planner.test_calendar import CalendarTests
import server


class ReminderTests(CalendarTests):
    def draft(self, **changes):
        return dict(id='reviewed-draft',title='COMP1521 lab submission',
                    due_date='2026-09-21',due_time='',recurrence='weekly',
                    repeat_until='2026-11-16',**changes)

    def test_weekly_inclusive_and_independent_completion(self):
        rows=R.expand([self.draft()])
        self.assertEqual(len(rows),9)
        self.assertEqual(rows[-1]['due_at'],'2026-11-16')
        with server.connect() as con:
            for row in rows: R.write(con,row,create_only=True)
        server.save_portal({'table':'reminders','item':{'id':rows[0]['id'],'completed':1}})
        with server.connect() as con:
            for row in rows: R.write(con,row,create_only=True)
        server.init_db()
        stored=server.portal_state()['reminders']
        self.assertEqual(len(stored),9)
        self.assertEqual(sum(r['completed'] for r in stored),1)
        self.assertTrue(all(r['series_id']=='reviewed-draft' for r in stored))

    def test_invalid_range_and_time(self):
        for change in [{'repeat_until':'2026-09-20'},{'due_time':'25:00'}, {'due_date':''}]:
            draft=self.draft();draft.update(change)
            with self.assertRaises(ValueError): R.expand([draft])

    def test_undated_reminder(self):
        rows=R.expand([{'id':'undated','title':'Read notes'}])
        self.assertIsNone(rows[0]['due_at'])

    def test_status_updates_keep_legacy_completion_consistent(self):
        server.save_portal({'table':'reminders','item':{'id':'status','title':'Test','completed':0}})
        for status in ('in_progress','done','no_progress'):
            server.save_portal({'table':'reminders','item':{'id':'status','status':status}})
            row=server.portal_state()['reminders'][0]
            self.assertEqual(row['status'],status)
            self.assertEqual(row['completed'],int(status=='done'))
        server.save_portal({'table':'reminders','item':{'id':'status','completed':1}})
        self.assertEqual(server.portal_state()['reminders'][0]['status'],'done')
        with self.assertRaises(ValueError):
            server.save_portal({'table':'reminders','item':{'id':'status','status':'invalid'}})

    def test_status_migration_preserves_completed_reminders(self):
        import sqlite3
        from contextlib import closing
        import calendar_store
        db=self.root/'legacy-reminders.db'
        with closing(sqlite3.connect(db)) as con,con:
            con.executescript(server.SCHEMA)
            con.execute("INSERT INTO reminders(id,title,completed,created_at) VALUES('done','Already done',1,'2026-09-01')")
            con.execute("INSERT INTO reminders(id,title,completed,created_at) VALUES('todo','Still to do',0,'2026-09-01')")
        calendar_store.migrate(db,self.root/'status-backups')
        with closing(sqlite3.connect(db)) as con:
            self.assertEqual(con.execute('SELECT id,status FROM reminders ORDER BY id').fetchall(),[('done','done'),('todo','no_progress')])
        self.assertEqual(len(list((self.root/'status-backups').glob('*.db'))),1)
