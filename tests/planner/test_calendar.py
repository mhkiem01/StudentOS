import json
import sqlite3
import tempfile
import threading
import unittest
import gc
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from urllib import request, error
from http.server import ThreadingHTTPServer

import backend  # adds backend/<feature> folders to the import path
import server
import calendar_store
import accounts


class CalendarTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.db = self.root / 'test.db'
        self.patches = [patch.object(server, 'ROOT', self.root), patch.object(server, 'DB_PATH', self.db)]
        for p in self.patches:
            p.start()
        with closing(sqlite3.connect(self.db)) as con, con:
            con.executescript(server.SCHEMA)
            con.execute("INSERT INTO timetable_events(id,title,day,start_time,end_time) VALUES('legacy','Existing class',0,'09:00','10:00')")
        server.init_db()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        gc.collect()
        self.tmp.cleanup()

    def event(self, **overrides):
        return {'id': 'future', 'title': 'Next month', 'event_date': '2027-01-10',
                'start_time': '14:30', 'end_time': '15:45', 'recurrence': 'none', **overrides}

    def test_migration_preserves_legacy_event_and_creates_recoverable_backup(self):
        legacy = server.portal_state()['timetable_events'][0]
        self.assertEqual(legacy['title'], 'Existing class')
        self.assertEqual(legacy['recurrence'], 'weekly')
        self.assertIsNone(legacy['event_date'])
        backups = list((self.root/'backups').glob('before-calendar-*.db'))
        self.assertEqual(len(backups), 1)
        with closing(sqlite3.connect(backups[0])) as con:
            self.assertEqual(con.execute('SELECT title FROM timetable_events').fetchone()[0], 'Existing class')
        server.init_db()
        self.assertEqual(len(list((self.root/'backups').glob('before-calendar-*.db'))), 1)

    def test_future_date_edit_and_restart_persist(self):
        server.save_portal({'table': 'timetable_events', 'item': self.event()})
        server.init_db()
        event = next(x for x in server.portal_state()['timetable_events'] if x['id']=='future')
        self.assertEqual(event['event_date'], '2027-01-10')
        self.assertEqual(event['day'], 6)
        event.update(event_date='2027-02-01',recurrence='weekly',repeat_until='2027-05-31')
        server.save_portal({'table':'timetable_events','item':event})
        event = next(x for x in server.portal_state()['timetable_events'] if x['id']=='future')
        self.assertEqual((event['day'],event['repeat_until']), (0,'2027-05-31'))
        server.delete_portal({'table':'timetable_events','id':'future'})
        self.assertEqual(len(server.portal_state()['timetable_events']), 1)

    def test_invalid_dates_and_ranges_rejected(self):
        for changes in [{'event_date':'2027-02-30'}, {'end_time':'14:00'},
                        {'start_time':'25:00'}, {'recurrence':'daily'},
                        {'recurrence':'weekly','repeat_until':'2026-01-01'}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                calendar_store.validate(self.event(**changes))

    def test_quiz_save_does_not_unlink_calendar_subjects(self):
        state={'subjects':{'s1':{'name':'Math','topics':['Algebra']}},'topics':{'Algebra':[]}}
        server.import_state(state)
        server.save_portal({'table':'timetable_events','item':self.event(subject_id='s1')})
        server.import_state(server.export_state())
        event=next(x for x in server.portal_state()['timetable_events'] if x['id']=='future')
        self.assertEqual(event['subject_id'],'s1')

    def test_bulk_import_transaction_does_not_save_partial_events(self):
        httpd=ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        httpd.accounts_path=self.root/'accounts.db'
        accounts.initialize(httpd.accounts_path,password='Fixture-password-123!',must_change=False)
        _,token=accounts.login(httpd.accounts_path,'admin','Fixture-password-123!','127.0.0.1','Unit test')
        thread=threading.Thread(target=httpd.serve_forever,daemon=True)
        thread.start()
        try:
            req=request.Request(f'http://127.0.0.1:{httpd.server_port}/api/calendar/import',
                                data=json.dumps({'events':[self.event(),self.event(id='bad',subject_id='missing')]}).encode(),
                                headers={'Content-Type':'application/json','X-Portal-Request':'1','X-Portal-Account':'admin','Cookie':'portal_session='+token})
            with self.assertRaises(error.HTTPError):
                request.urlopen(req)
            self.assertEqual(len(server.portal_state()['timetable_events']),1)
        finally:
            httpd.shutdown()
            httpd.server_close()


if __name__=='__main__':
    unittest.main()
