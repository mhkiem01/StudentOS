import unittest,tempfile
from pathlib import Path
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import server,progress_service as p

class StudyProgressTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name)
        self.patches=[patch.object(server,'ROOT',root),patch.object(server,'DB_PATH',root/'test.db')]
        for patcher in self.patches:patcher.start()
        server.init_db()
        q=lambda i:dict(question='Question '+str(i),choices={'A':'yes','B':'no'},answer='A')
        self.s=dict(subjects={'a':{'name':'A','topics':['MIPS','Files']},'b':{'name':'B','topics':['Other']}},topics={'MIPS':[q(i) for i in range(10)],'Files':[q(20)],'Other':[q(30)]},sessions={},latestResults={},progress={})
        server.import_state(self.s)
    def tearDown(self):
        for patcher in self.patches:patcher.stop()
        self.tmp.cleanup()
    def report(self,s='a',t=None):
        with server.connect() as c:return p.report(c,s,t)
    def checkpoint(self,t,answers):
        self.s['sessions'][t]={'answers':answers};server.import_state(self.s)
    def test_weighted_scope_and_unique(self):
        self.checkpoint('MIPS',{str(i):'A' for i in range(10)})
        self.checkpoint('Files',{'0':'B'});self.checkpoint('Other',{'0':'B'})
        s=self.report()['summary'];self.assertEqual(s['answered'],11);self.assertEqual(s['correct'],10);self.assertEqual(s['accuracy'],91)
        self.assertEqual(self.report('a','MIPS')['summary']['accuracy'],100)
        server.import_state(self.s);self.assertEqual(self.report()['summary']['answered'],11)
        with self.assertRaises(ValueError):self.report('a','Other')
    def test_completion_retry_history_and_coverage(self):
        self.checkpoint('MIPS',{str(i):'A' for i in range(10)})
        self.s['latestResults']['MIPS']={'answers':self.s['sessions']['MIPS']['answers'],'questions':self.s['topics']['MIPS'],'correct':10,'answered':10,'total':10,'completedAt':1}
        del self.s['sessions']['MIPS'];server.import_state(self.s)
        s=self.report('a','MIPS');self.assertEqual(s['summary']['quiz_completed'],1);self.assertEqual(s['summary']['answered'],10);self.assertEqual(len(s['recent']),1)
        self.checkpoint('MIPS',{'0':'B'});s=self.report('a','MIPS');self.assertEqual(s['summary']['answered'],11);self.assertEqual(s['summary']['unique'],10);self.assertEqual(s['summary']['quiz_completed'],1)
    def test_zero_and_tiny_mastery(self):
        self.assertIsNone(self.report()['summary']['accuracy']);self.assertEqual(self.report()['summary']['not_started'],2)
        self.checkpoint('Files',{'0':'A'});self.assertEqual(self.report('a','Files')['topics'][0]['mastery'],'Developing')
    def test_notes_new_organisation_legacy_edit(self):
        with self.assertRaisesRegex(ValueError,'Topic or Week'):server.save_portal({'table':'notes','item':{'id':'new','subject_id':'a','title':'Draft'}})
        server.save_portal({'table':'notes','item':{'id':'new','subject_id':'a','title':'Draft','week':4}})
        server.save_portal({'table':'notes','item':{'id':'topic','subject_id':'a','topic_name':'MIPS','title':'Topic','week':4}})
        self.assertEqual(self.report('a','MIPS')['summary']['notes'],1);self.assertEqual(self.report()['summary']['notes'],2)
        with server.connect() as c:c.execute("UPDATE notes SET week=NULL WHERE id='new'")
        server.save_portal({'table':'notes','item':{'id':'new','subject_id':'a','title':'Legacy edit'}})
        self.assertEqual(self.report()['summary']['notes'],2)

    def test_legacy_migration_preserves_records_and_is_idempotent(self):
        self.s['progress']={'MIPS':{'answered':100,'correct':82}}
        server.import_state(self.s)
        with server.connect() as c:
            for table in ('study_legacy','study_answers','study_runs','study_active','study_known'):c.execute('DROP TABLE '+table)
        p.migrate(server.DB_PATH,Path(self.tmp.name)/'backups')
        p.migrate(server.DB_PATH,Path(self.tmp.name)/'backups')
        s=self.report()['summary'];self.assertEqual(s['answered'],100);self.assertEqual(s['correct'],82);self.assertEqual(s['detailed_attempts'],0)
        self.assertEqual(s['unique'],0)
        with server.connect() as c:self.assertEqual(c.execute('SELECT answered FROM progress WHERE topic_name=?',('MIPS',)).fetchone()[0],100)
