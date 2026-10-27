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
    def test_extra_quizzes_are_quiz_sets_of_their_topic(self):
        q=lambda i:dict(question='Extra '+str(i),choices={'A':'yes','B':'no'},answer='A')
        extra='MIPS › Practice exam'
        self.s['topics'][extra]=[q(i) for i in range(3)]
        self.s['topicMeta']={extra:{'parent':'MIPS','quizName':'Practice exam'},'MIPS':{'quizName':'Lecture quiz'}}
        self.s['subjects']['a']['topics'].append(extra);server.import_state(self.s)
        state=server.export_state()
        self.assertEqual(state['topicMeta'][extra],{'color':'#7445f5','parent':'MIPS','quizName':'Practice exam'})
        self.assertEqual(state['topicMeta']['MIPS']['quizName'],'Lecture quiz');self.assertNotIn('parent',state['topicMeta']['MIPS'])
        self.assertEqual(state['subjects']['a']['topics'],['MIPS','Files'],'extra quizzes are never listed as subject topics')
        s=self.report('a','MIPS')['summary'];self.assertEqual((s['quiz_total'],s['quiz_completed'],s['available']),(2,0,13))
        self.assertEqual(self.report('a',extra)['topic'],'MIPS')
        answers={str(i):'A' for i in range(3)};self.s['sessions'][extra]={'answers':answers};server.import_state(self.s)
        self.s['latestResults'][extra]={'answers':answers,'questions':self.s['topics'][extra],'correct':3,'answered':3,'total':3,'completedAt':1}
        del self.s['sessions'][extra];server.import_state(self.s)
        r=self.report('a','MIPS');s=r['summary'];self.assertEqual((s['quiz_total'],s['quiz_completed'],s['answered'],s['unique']),(2,1,3,3))
        self.assertEqual(r['topics'][0]['quiz_status'],'In Progress');self.assertEqual([x['topic'] for x in r['recent']],[extra])
        self.assertEqual(self.report()['summary']['quiz_total'],3)
        # A quiz whose topic disappears, or that points at another quiz, is kept as an ordinary topic.
        self.s['topicMeta']['Nested']={'parent':extra};self.s['topics']['Nested']=[q(9)];server.import_state(self.s)
        self.assertNotIn('parent',server.export_state()['topicMeta']['Nested'])
        del self.s['topics']['MIPS'];self.s['subjects']['a']['topics'].remove('MIPS');server.import_state(self.s)
        self.assertNotIn('parent',server.export_state()['topicMeta'][extra])
    def test_ungrouped_topics_have_their_own_report(self):
        self.s['topics']['Loose']=[dict(question='Loose '+str(i),choices={'A':'yes','B':'no'},answer='A') for i in range(2)]
        server.import_state(self.s);self.checkpoint('Loose',{'0':'A','1':'B'})
        r=self.report(p.UNGROUPED)
        self.assertEqual(r['subject'],{'id':'__ungrouped__','name':'Ungrouped topics'})
        self.assertEqual([t['topic'] for t in r['topics']],['Loose'])
        self.assertEqual((r['summary']['answered'],r['summary']['correct'],r['summary']['quiz_total']),(2,1,1))
        self.assertNotIn('Loose',[t['topic'] for t in self.report('a')['topics']])
        with self.assertRaises(ValueError):self.report('missing-subject')
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
