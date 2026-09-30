import tempfile,unittest,sqlite3
from pathlib import Path
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import server,general_todos,task_cleanup,reminders_store

class CleanupTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  self.patches=[patch.object(server,'ROOT',self.root),patch.object(server,'DB_PATH',self.root/'workspace.db')]
  for p in self.patches:p.start()
  server.init_db()
 def tearDown(self):
  for p in self.patches:p.stop()
  self.tmp.cleanup()
 def row(self,t):
  with server.connect() as c:return dict(c.execute('SELECT * FROM '+t).fetchone())
 def seed(self,t):
  if t=='reminders':server.save_portal({'table':t,'item':{'id':'r','title':'Reminder','status':'done'}})
  else:
   with server.connect() as c:general_todos.write(c,{'action':'save','item':{'title':'Task','status':'done'}})
  return self.row(t)['id']
 def edit(self,t,key,**values):
  if t=='reminders':server.save_portal({'table':t,'item':{'id':key,**values}})
  else:
   with server.connect() as c:general_todos.write(c,{'action':'save','item':{'id':key,**values}})
 def test_both_expire_at_boundary_only(self):
  for t in task_cleanup.FIELDS:
   self.seed(t)
   with server.connect() as c:
    c.execute('UPDATE '+t+" SET cleanup_after='2030-01-02T10:00:00Z'")
    self.assertEqual(task_cleanup.purge(c,'2030-01-02T09:59:59Z')[t],0)
    self.assertEqual(task_cleanup.purge(c,'2030-01-02T10:00:00Z')[t],1)
 def test_edits_restart_reopen_cancels_and_redone_restarts(self):
  for t in task_cleanup.FIELDS:
   key=self.seed(t)
   with server.connect() as c:c.execute('UPDATE '+t+" SET cleanup_after='2000-01-01T00:00:00Z'")
   self.edit(t,key,title='Edited while done');self.assertGreater(self.row(t)['cleanup_after'],'2026')
   self.edit(t,key,status='in_progress');self.assertIsNone(self.row(t)['cleanup_after'])
   self.edit(t,key,title='Still working');self.assertIsNone(self.row(t)['cleanup_after'])
   self.edit(t,key,status='done');self.assertIsNotNone(self.row(t)['cleanup_after'])
 def test_unchanged_save_does_not_restart_timer(self):
  for t in task_cleanup.FIELDS:
   key=self.seed(t)
   with server.connect() as c:c.execute('UPDATE '+t+" SET cleanup_after='2030-01-01T00:00:00Z'")
   self.edit(t,key,title=self.row(t)['title']);self.assertEqual(self.row(t)['cleanup_after'],'2030-01-01T00:00:00Z')
 def test_recurring_occurrences_independent(self):
  rows=reminders_store.expand([{'id':'series','title':'Weekly','due_date':'2026-09-21','recurrence':'weekly','repeat_until':'2026-09-28'}])
  with server.connect() as c:
   for r in rows:reminders_store.write(c,r,True)
  self.edit('reminders',rows[0]['id'],status='done')
  with server.connect() as c:
   c.execute("UPDATE reminders SET cleanup_after='2000-01-01T00:00:00Z' WHERE id=?",(rows[0]['id'],));task_cleanup.purge(c)
   self.assertEqual(c.execute('SELECT id FROM reminders').fetchone()[0],rows[1]['id'])
 def test_background_sweep_and_startup_grace(self):
  key=self.seed('general_todos')
  with server.connect() as c:c.execute("UPDATE general_todos SET cleanup_after='2000-01-01T00:00:00Z'")
  task_cleanup.sweep(server.DB_PATH)
  with server.connect() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM general_todos').fetchone()[0],0)
 def test_old_done_items_get_full_grace_and_migration_is_repeatable(self):
  for t in task_cleanup.FIELDS:self.seed(t)
  with server.connect() as c:
   for t in task_cleanup.FIELDS:
    c.execute('DROP TRIGGER '+t+'_cleanup_insert');c.execute('DROP TRIGGER '+t+'_cleanup_edit');c.execute('DROP INDEX '+t+'_cleanup_due');c.execute('ALTER TABLE '+t+' DROP COLUMN cleanup_after')
  task_cleanup.migrate(server.DB_PATH,self.root/'backups');task_cleanup.migrate(server.DB_PATH,self.root/'backups')
  with server.connect() as c:
   self.assertEqual(sum(task_cleanup.purge(c).values()),0)
   for t in task_cleanup.FIELDS:
    hours=c.execute("SELECT (julianday(cleanup_after)-julianday('now'))*24 FROM "+t).fetchone()[0]
    self.assertGreater(hours,23.99);self.assertLessEqual(hours,24)
