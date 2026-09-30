import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
import backend  # adds backend/<feature> folders to the import path
import general_todos as todos


class GeneralTodoTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'workspace.db'
        self.backups = Path(self.tmp.name) / 'backups'
        self.con = sqlite3.connect(self.path)
        self.con.row_factory = sqlite3.Row
        self.con.execute('CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)')
        self.con.execute('CREATE TABLE reminders(title TEXT)')
        self.con.execute("INSERT INTO reminders VALUES('Keep academic task')")
        self.con.commit()
        todos.migrate(self.path, self.backups)

    def tearDown(self):
        self.con.close()
        self.tmp.cleanup()

    def save(self, **item):
        with self.con:
            return todos.write(self.con, {'action': 'save', 'item': item})['todos'][0]

    def test_defaults_and_persistence(self):
        self.assertFalse(todos.state(self.con)['enabled'])
        item = self.save(title='  Buy groceries  ')
        self.assertEqual(item['title'], 'Buy groceries')
        self.assertEqual(item['status'], 'no_progress')
        self.assertIsNone(item['due_date'])
        self.con.close()
        self.con = sqlite3.connect(self.path)
        self.con.row_factory = sqlite3.Row
        self.assertEqual(todos.state(self.con)['todos'][0], item)

    def test_status_and_optional_details(self):
        item = self.save(title='Rent', due_date='2026-09-25', due_time='12:00', notes='Monthly')
        done = self.save(id=item['id'], status='done')
        self.assertTrue(done['completed_at'])
        self.assertEqual(done['created_at'], item['created_at'])
        self.assertEqual(done['notes'], 'Monthly')
        self.assertIsNone(self.save(id=item['id'], status='no_progress')['completed_at'])

    def test_validation(self):
        for item in [{'title':'  '}, {'title':'x','status':'bogus'}, {'title':'x','due_date':'2026-02-30'}, {'title':'x','due_time':'12:00'}, {'title':'x','due_date':'2026-09-25','due_time':'25:00'}, {'title':'x','id':'missing'}, {'title':'x','notes':[]}]:
            with self.subTest(item=item), self.assertRaises(ValueError):
                self.save(**item)
        self.assertEqual(todos.state(self.con)['todos'], [])

    def test_toggle_migration_backup_and_isolation(self):
        item = self.save(title='Keep me')
        for enabled in [True, False, True]:
            with self.con:
                result = todos.write(self.con, {'action':'settings', 'enabled':enabled})
            self.assertEqual(result['enabled'], enabled)
            self.assertEqual(result['todos'][0], item)
        todos.migrate(self.path, self.backups)
        backups = list(self.backups.glob('before-general-todos-*.db'))
        self.assertEqual(len(backups), 1)
        with closing(sqlite3.connect(backups[0])) as backup:
            self.assertEqual(backup.execute('SELECT title FROM reminders').fetchone()[0], 'Keep academic task')
        self.assertEqual(self.con.execute('SELECT title FROM reminders').fetchone()[0], 'Keep academic task')
        with self.con:
            todos.write(self.con, {'action':'delete','id':item['id']})
        self.assertEqual(todos.state(self.con)['todos'], [])
