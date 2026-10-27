import tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import server

class MasteryPersistenceTests(unittest.TestCase):
 def test_settings_counts_and_confirmed_deletion_roundtrip(self):
  with tempfile.TemporaryDirectory() as tmp:
   with patch.object(server,'DB_PATH',Path(tmp)/'workspace.db'),patch.object(server,'ROOT',Path(tmp)):
    server.init_db()
    q={'question':'Example','choices':{'A':'Yes','B':'No'},'answer':'A','mastery':{'signature':'test','correct':3}}
    state={'topics':{'Test':[q]},'quizSettings':{'Test':{'mode':'mastery','target':3}}}
    server.import_state(state);loaded=server.export_state()
    self.assertEqual(loaded['quizSettings'],state['quizSettings']);self.assertEqual(loaded['topics']['Test'][0]['mastery']['correct'],3)
    loaded['latestResults']['Test']={'questions':[q],'answers':{'0':'A'},'total':1,'correct':1,'answered':1}
    loaded['topics']['Test']=[];server.import_state(loaded);after=server.export_state()
    self.assertEqual(after['topics']['Test'],[]);self.assertEqual(after['latestResults']['Test']['questions'][0]['question'],'Example')
    loaded['quizSettings']['Test']['target']=0
    with self.assertRaises(ValueError):server.import_state(loaded)
    self.assertEqual(server.export_state()['quizSettings']['Test']['target'],3)

 def test_reshuffled_attempt_order_roundtrip_and_migration(self):
  with tempfile.TemporaryDirectory() as tmp:
   with patch.object(server,'DB_PATH',Path(tmp)/'workspace.db'),patch.object(server,'ROOT',Path(tmp)):
    server.init_db()
    # A database from before reshuffle gains the column without losing saved attempts.
    with server.connect() as c:c.execute('ALTER TABLE topic_sessions DROP COLUMN order_json')
    server.init_db()
    q={'question':'Example','choices':{'A':'Yes','B':'No'},'answer':'A'}
    state={'topics':{'Test':[q,q,q],'Plain':[q]},'sessions':{'Test':{'currentIndex':1,'answers':{'2':'A'},'flags':{},'timer':{},'order':[2,0,1]},'Plain':{'currentIndex':0,'answers':{'0':'A'},'flags':{},'timer':{}}}}
    server.import_state(state);loaded=server.export_state()['sessions']
    self.assertEqual(loaded['Test']['order'],[2,0,1]);self.assertEqual(loaded['Test']['answers'],{'2':'A'});self.assertNotIn('order',loaded['Plain'])
    state['sessions']['Test']['order']=[1,'x',True,-1,0.5,0];server.import_state(state)
    self.assertEqual(server.export_state()['sessions']['Test']['order'],[1,0])

 def test_countdown_timer_settings_attempt_and_result_roundtrip(self):
  with tempfile.TemporaryDirectory() as tmp:
   with patch.object(server,'DB_PATH',Path(tmp)/'workspace.db'),patch.object(server,'ROOT',Path(tmp)):
    server.init_db()
    q={'question':'Example','choices':{'A':'Yes','B':'No'},'answer':'A'}
    timer={'enabled':True,'elapsedMs':61000,'resumeOnOpen':False,'limitMs':1800000}
    state={'topics':{'Test':[q,q]},'quizSettings':{'Test':{'mode':'normal','target':3,'timer':'down','minutes':30}},
           'sessions':{'Test':{'currentIndex':1,'answers':{'0':'A'},'flags':{},'timer':timer}}}
    server.import_state(state);loaded=server.export_state()
    self.assertEqual(loaded['quizSettings'],state['quizSettings']);self.assertEqual(loaded['sessions']['Test']['timer'],timer)
    loaded['latestResults']['Test']={'answers':{'0':'A'},'questions':[q,q],'total':2,'correct':1,'answered':1,'timed':True,'durationMs':1800000,'limitMs':1800000,'timeUp':True}
    del loaded['sessions']['Test'];server.import_state(loaded);result=server.export_state()['latestResults']['Test']
    self.assertEqual((result['limitMs'],result['timeUp']),(1800000,True))
    # Settings saved before timers existed still load; bad timer values are refused and nothing changes.
    loaded['quizSettings']['Test']={'mode':'normal','target':3};server.import_state(loaded)
    self.assertEqual(server.export_state()['quizSettings']['Test'],{'mode':'normal','target':3})
    for bad in ({'timer':'sideways'},{'minutes':0},{'minutes':601},{'minutes':12.5},{'minutes':True}):
     loaded['quizSettings']['Test']={'mode':'normal','target':3,**bad}
     with self.assertRaises(ValueError):server.import_state(loaded)
    self.assertEqual(server.export_state()['quizSettings']['Test'],{'mode':'normal','target':3})
