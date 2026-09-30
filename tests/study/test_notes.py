import sqlite3,tempfile,unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import server,notes_store

class NotesTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.db=self.root/'test.db'
        self.patches=[patch.object(server,'ROOT',self.root),patch.object(server,'DB_PATH',self.db)]
        for p in self.patches:p.start()
        with closing(sqlite3.connect(self.db)) as con,con:
            con.executescript(server.SCHEMA)
            con.execute("INSERT INTO subjects(id,name) VALUES('a','Computing'),('b','Math')")
            con.execute("INSERT INTO topics(name) VALUES('Networks'),('Algebra')")
            con.execute("INSERT INTO subject_topics(subject_id,topic_name) VALUES('a','Networks'),('b','Algebra')")
            con.execute("INSERT INTO notes(id,title,content,subject_id,topic_name,updated_at) VALUES('legacy','Old note','Preserved content','a','Networks','2024-01-01')")
            con.execute("INSERT INTO notes(id,title,content,updated_at) VALUES('unassigned','Unassigned','Keep me','2024-01-02')")
        server.init_db()
    def tearDown(self):
        for p in reversed(self.patches):p.stop()
        self.tmp.cleanup()
    def save(self,**item):return server.save_portal({'table':'notes','item':item})
    def note(self,id):return next(n for n in server.portal_state()['notes'] if n['id']==id)
    def test_migration_preserves_every_note_and_backs_up(self):
        self.assertEqual(self.note('legacy')['content'],'Preserved content')
        self.assertEqual(self.note('legacy')['topic_name'],'Networks')
        self.assertEqual(self.note('legacy')['created_at'],'2024-01-01')
        self.assertIsNone(self.note('unassigned')['subject_id'])
        self.assertIsNone(self.note('legacy')['last_studied_at'])
        self.assertEqual(len(list((self.root/'backups').glob('before-notes-*.db'))),1)
        server.init_db();self.assertEqual(len(list((self.root/'backups').glob('before-notes-*.db'))),1)
    def test_subject_required_topic_must_belong(self):
        for values in [{},{'subject_id':'missing'},{'subject_id':'a','topic_name':'Algebra'}]:
            with self.subTest(values=values),self.assertRaises(ValueError):self.save(id='bad',title='No',**values)
        self.save(id='good',title='Good',subject_id='a',week=1);self.assertIsNone(self.note('good')['topic_name'])
    def test_rich_content_and_legacy_preservation(self):
        self.assertEqual(self.note('legacy')['content_format'],'markdown')
        self.save(id='rich',title='Document',subject_id='a',week=1,content_format='html',content='<h1>Title</h1><p onclick="bad()"><u>Study</u></p><script>bad()</script>')
        rich=self.note('rich');self.assertEqual(rich['content_format'],'html');self.assertNotIn('script',rich['content']);self.assertNotIn('onclick',rich['content'])
        self.assertEqual(self.note('legacy')['content'],'Preserved content')
    def test_metadata_persists_and_study_is_separate(self):
        self.save(id='legacy',week=3,tags=['HCI','Exam','hci'],is_pinned=1)
        n=self.note('legacy');self.assertEqual(n['tags'],['HCI','Exam']);self.assertEqual(n['week'],3);self.assertEqual(n['is_pinned'],1);self.assertIsNone(n['last_studied_at'])
        with server.connect() as con:con.execute('UPDATE notes SET last_studied_at=? WHERE id=?',('2026-09-20','legacy'))
        self.assertEqual(self.note('legacy')['updated_at'],n['updated_at'])
        self.save(id='legacy',title='Edited');self.assertEqual(self.note('legacy')['last_studied_at'],'2026-09-20')
    def test_stale_save_rejected_and_draft_not_overwritten(self):
        version=self.note('legacy')['updated_at'];self.save(id='legacy',title='From laptop')
        with self.assertRaisesRegex(ValueError,'another device'):self.save(id='legacy',title='Stale phone',base_updated_at=version)
        self.assertEqual(self.note('legacy')['title'],'From laptop')
    def test_subject_deletion_preserves_notes_for_reassignment(self):
        with server.connect() as con:
            con.execute("DELETE FROM subjects WHERE id='a'");notes_store.repair_topics(con)
        self.assertIsNone(self.note('legacy')['subject_id']);self.assertIsNone(self.note('legacy')['topic_name'])
        self.assertEqual(self.note('legacy')['content'],'Preserved content')
        self.save(id='legacy',subject_id='b',topic_name='Algebra');self.assertEqual(self.note('legacy')['subject_id'],'b')
    def test_validation_and_tags_cascade(self):
        for field in [{'week':-1},{'week':101},{'tags':['x'*41]},{'is_pinned':7}]:
            with self.assertRaises(ValueError):self.save(id='legacy',**field)
        self.save(id='legacy',tags=['Keep'])
        server.delete_portal({'table':'notes','id':'legacy'})
        with server.connect() as con:self.assertEqual(con.execute('SELECT count(*) FROM note_tags').fetchone()[0],0)
    def test_batch_rollback_and_retry(self):
        with self.assertRaises(ValueError),server.connect() as con:
            notes_store.save(con,{'id':'one','title':'One','subject_id':'a','week':1},True)
            notes_store.save(con,{'id':'two','title':'Two','subject_id':'b','topic_name':'Networks'},True)
        self.assertFalse(any(n['id']=='one' for n in server.portal_state()['notes']))
        with server.connect() as con:notes_store.save(con,{'id':'legacy','title':'No overwrite','subject_id':'a'},True)
        self.assertEqual(self.note('legacy')['title'],'Old note')

if __name__=='__main__':unittest.main()
