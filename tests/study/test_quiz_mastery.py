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
