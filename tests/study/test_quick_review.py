import copy,sqlite3,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import server,quick_review_store as qr

class QuickReviewTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  self.patches=[patch.object(server,'DB_PATH',self.root/'workspace.db'),patch.object(server,'ROOT',self.root)]
  for p in self.patches:p.start()
  server.init_db()
  server.import_state({'topics':{'MIPS':[],'Algebra':[]},'subjects':{'cs':{'id':'cs','name':'Computing','topics':['MIPS']},'math':{'id':'math','name':'Math','topics':['Algebra']}},'flashcards':{'MIPS':[{'id':'old','front':'Prompt','back':'Answer','explain':'Keep'}]},'flashcardProgress':{'MIPS':{'old':{'rating':'good'}}}})
  self.original=server.export_state()
 def tearDown(self):
  for p in reversed(self.patches):p.stop()
  self.tmp.cleanup()
 def write(self,action,data=None,key=None):
  with server.connect() as c:return qr.write(c,{'action':action,'data':data or {},'id':key})
 def get(self,key):
  with server.connect() as c:return qr.get(c,key)
 def make(self,count=13):
  return self.write('import',{'topic_name':'MIPS','text':'Title: Commands\nPoints:\n'+'\n'.join('- Fact '+str(i) for i in range(count))})['ids'][0]
 def test_pages_and_original_data_survive_restart_and_state_save(self):
  key=self.make();self.assertEqual([len(p['points']) for p in self.get(key)['pages']],[5,5,3])
  server.init_db();server.import_state(server.export_state())
  self.assertEqual(len(self.get(key)['pages']),3)
  after=server.export_state();after.pop('_savedAt',None);self.original.pop('_savedAt',None);self.assertEqual(after,self.original)
  self.assertTrue(list((self.root/'data'/'backups').glob('before-quick-review-*.db')) or list(self.root.rglob('before-quick-review-*.db')))
 def test_validation_atomic_and_scope(self):
  errors=['Title: A\nPoints:\n- x','Topic: MIPS\nPoints:\n- x','Topic: MIPS\nTitle: A\nPoints:\n-','Topic: MIPS\nTitle: A\nPoints:\n- x\n----']
  for source in errors:
   result=self.write('import',{'text':source});self.assertFalse(result['ok']);self.assertTrue(all({'section','line','problem','fix'}<=e.keys() for e in result['errors']))
  result=self.write('import',{'text':'Topic: MIPS\nTitle: Good\nPoints:\n- yes\n---\nTopic: Absent\nTitle: Bad\nPoints:\n- no'})
  self.assertFalse(result['ok'])
  with server.connect() as c:self.assertEqual(qr.state(c)['decks'],[])
  self.assertTrue(qr.parse('Topic: Algebra\nTitle: A\nPoints:\n- x','MIPS')['errors'])
 def test_multiple_sections_long_and_code_preserved(self):
  long='Very important '*70;code='```asm\nli $v0, 4\n---\nsyscall\n```'
  source='Title: A\nPoints:\n- '+long+'\n- '+code+'\n---\nTitle: B\nPoints:\n- **Formula**: x = a + b'
  result=self.write('preview',{'text':source,'topic_name':'MIPS'})
  self.assertEqual(result['errors'],[]);pages=result['decks'][0]['pages']
  self.assertEqual(pages[0]['points'],[long.rstrip()]);self.assertEqual(pages[1]['points'],[code]);self.assertEqual(pages[2]['title'],'B')
  self.assertTrue(result['warnings'])
 def test_progress_explicit_resume_finish_and_scope(self):
  key=self.make();pages=self.get(key)['pages']
  with self.assertRaises(ValueError):self.write('finish',key=key)
  for p in pages:self.write('view',{'page':p['id']},key)
  self.assertFalse(any(p['memorised'] for p in self.get(key)['pages']))
  self.write('memorise',{'page':pages[1]['id'],'memorised':True},key)
  self.write('finish',key=key);self.write('finish',key=key)
  self.assertEqual(self.get(key)['progress']['sessions'],1)
  self.assertEqual(self.get(key)['progress']['current_page'],pages[2]['id'])
  with server.connect() as c:
   self.assertEqual(qr.metrics(c,'cs','MIPS'),{'decks':1,'pages':3,'viewed':3,'memorised':1,'sessions':1})
   self.assertEqual(qr.metrics(c,'math')['pages'],0)
  self.write('restart',key=key)
  self.assertEqual(self.get(key)['progress']['run_seen'],[])
  self.assertEqual(self.get(key)['progress']['sessions'],1)
 def test_edit_reorder_move_conflict_delete(self):
  key=self.make();d=self.get(key);first=d['pages'][0]['id'];second=d['pages'][1]['id']
  self.write('view',{'page':first},key);self.write('memorise',{'page':first,'memorised':True},key)
  stale=copy.deepcopy(d);d['pages'].reverse();d['title']='Renamed';self.write('save',d,key)
  self.assertTrue(next(p for p in self.get(key)['pages'] if p['id']==first)['memorised'])
  with self.assertRaises(ValueError):self.write('save',stale,key)
  d=self.get(key);d['pages'][0]['points'].append(d['pages'][2]['points'].pop());self.write('save',d,key)
  self.assertFalse(next(p for p in self.get(key)['pages'] if p['id']==first)['memorised'])
  other=self.make(1);d=self.get(key);d['pages'][0]['id']=self.get(other)['pages'][0]['id']
  with self.assertRaises(ValueError):self.write('save',d,key)
  self.write('delete',key=key)
  with self.assertRaises(ValueError):self.get(key)
  self.assertEqual(server.export_state(),self.original)

if __name__=='__main__':unittest.main()
