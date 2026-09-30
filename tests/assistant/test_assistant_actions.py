import unittest,tempfile,json,uuid
from pathlib import Path
from unittest.mock import patch
from datetime import date
import backend  # adds backend/<feature> folders to the import path
import server,accounts,assistant_actions as a,assistant_catalog,ai_provider

class AssistantActionsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name);self.patches=[patch.object(server,'ROOT',root),patch.object(server,'DB_PATH',root/'test.db')]
        for p in self.patches:p.start()
        server.init_db();self.auth=root/'accounts.db';accounts.initialize(self.auth,password='Fixture-password-123!',must_change=False)
    def tearDown(self):
        for p in self.patches:p.stop()
        self.tmp.cleanup()
    def prepare(self,op,data=None,id=None):
        key=uuid.uuid4().hex
        with server.connect() as c:a.prepare(c,dict(request_id=key,proposal=dict(operation=op,data=data or {},id=id)))
        return key
    def execute(self,key,**kw):return a.execute(server.connect,{'request_id':key,'confirmed':True,'acknowledged':True,**kw},self.auth,'admin')
    def apply(self,op,data=None,id=None):return self.execute(self.prepare(op,data,id))
    def count(self,table):
        with server.connect() as c:return c.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]
    def test_review_and_retry_do_not_duplicate_income(self):
        self.apply('finance.profile',{'enabled':True});key=self.prepare('finance.transactions',dict(kind='income',amount='500',date=date.today().isoformat(),description='Work'))
        self.assertEqual(self.count('finance_transactions'),0)
        with self.assertRaises(ValueError):self.execute(key,confirmed=False)
        first=self.execute(key);self.assertEqual(self.execute(key),first);self.assertEqual(self.count('finance_transactions'),1)
        with server.connect() as c:self.assertEqual(c.execute('SELECT amount FROM finance_transactions').fetchone()[0],50000)
    def test_mixed_income_expenses_and_nutrients(self):
        self.apply('finance.profile',{'enabled':True});self.apply('gym.profile',{'enabled':True})
        for kind,amount,cat in [('income','500','Income'),('expense','200','Rent'),('expense','35.50','Groceries')]:self.apply('finance.transactions',dict(kind=kind,amount=amount,category=cat,date=date.today().isoformat(),description=cat))
        self.apply('gym.food',dict(name='Breakfast',date=date.today().isoformat(),calories=600,protein=60,carbs=50,fat=18))
        self.assertEqual(self.count('finance_transactions'),3);self.assertEqual(self.count('gym_food_logs'),1)
        with server.connect() as c:self.assertEqual(json.loads(c.execute('SELECT data FROM gym_food_logs').fetchone()[0])['protein'],60)
    def test_missing_macros_not_invented_and_disabled_module(self):
        with self.assertRaises(ValueError):self.apply('gym.food',dict(name='Breakfast',date=date.today().isoformat(),protein=60))
        self.apply('gym.profile',{'enabled':True})
        with self.assertRaises(ValueError):self.apply('gym.food',dict(name='Breakfast',date=date.today().isoformat(),protein=60))
        self.assertEqual(self.count('gym_food_logs'),0)
    def test_allowlist_and_proposal_tampering(self):
        for op,data in [('admin.reset',{}),('finance.transactions',{'sql':'DELETE FROM users'}),('settings.preferences',{'password':'secret'}),('navigate.open',{'view':'https://example.com'})]:
            with self.assertRaises(ValueError):self.prepare(op,data)
        key=self.prepare('todos.save',{'title':'Buy milk'})
        with server.connect() as c:
            with self.assertRaises(ValueError):a.prepare(c,dict(request_id=key,proposal=dict(operation='todos.save',data={'title':'Different'})))
    def test_delete_needs_acknowledgement(self):
        result=self.apply('subjects.save',{'name':'Computing'});key=self.prepare('subjects.delete',{},result['id'])
        with self.assertRaises(ValueError):self.execute(key,acknowledged=False)
        self.assertEqual(self.count('subjects'),1);self.execute(key);self.assertEqual(self.count('subjects'),0)
    def test_study_content_scoped_and_preserved(self):
        subject=self.apply('subjects.save',{'name':'Computing'})['id'];self.apply('topics.create',{'name':'Networks','subject_id':subject})
        question=self.apply('questions.save',dict(topic_name='Networks',question='Reliable transport?',choices={'A':'TCP','B':'UDP'},answer='A'))['id']
        card=self.apply('flashcards.save',dict(topic_name='Networks',front='TCP',back='Reliable transport'))['id']
        note=self.apply('notes.save',dict(subject_id=subject,topic_name='Networks',title='Revision',content='Preserve this note'))['id']
        self.apply('notes.save',{'is_pinned':True},note)
        self.apply('questions.save',{'question':'Which transport is reliable?'},question)
        self.apply('quizzes.settings',dict(topic_name='Networks',mode='mastery',target=4))
        self.apply('flashcards.reorder',dict(topic_name='Networks',ids=[card]))
        self.apply('quizzes.delete',dict(topic_name='Networks'));self.assertEqual(self.count('questions'),0);self.assertEqual(self.count('flashcards'),1)
        with server.connect() as c:self.assertEqual(c.execute('SELECT content FROM notes').fetchone()[0],'Preserve this note')
    def test_todo_reminder_calendar(self):
        self.apply('todos.save',dict(title='Groceries',status='done'))
        rid=self.apply('reminders.save',dict(title='Lab',due_at='2026-10-01T17:00'))['id'];self.apply('reminders.save',{'status':'done'},rid)
        cid=self.apply('calendar.save',dict(title='Study',event_date='2026-10-01',start_time='12:00',end_time='13:00'))['id']
        self.apply('calendar.save',{'location':'Library'},cid)
        self.assertEqual(self.count('general_todos'),1)
        with server.connect() as c:
            self.assertEqual(c.execute('SELECT completed FROM reminders').fetchone()[0],1)
            self.assertEqual(c.execute('SELECT location FROM timetable_events').fetchone()[0],'Library')
    def test_gym_and_quick_nested_transactions(self):
        self.apply('gym.profile',{'enabled':True})
        wid=self.apply('gym.workout',dict(name='A',exercises=[dict(id='squat',sets=2,reps=8)]))['id']
        self.apply('gym.calendar_workout',dict(workout_id=wid,date='2026-10-01',start_time='17:00',end_time='18:00'))
        sid=self.apply('subjects.save',{'name':'Computing'})['id'];self.apply('topics.create',{'name':'Networks','subject_id':sid})
        self.apply('quick.import',dict(topic_name='Networks',text='Title: Transport\nPoints:\n- TCP is reliable\n- UDP uses datagrams',points_per_page=5))
        self.assertEqual(self.count('quick_decks'),1);self.assertEqual(self.count('gym_calendar_links'),1)
    def test_settings_use_real_account_profile(self):
        self.apply('settings.preferences',dict(theme='dark',display_name='New name'))
        with accounts.db(self.auth) as c:
            row=c.execute("SELECT * FROM users WHERE id='admin'").fetchone();self.assertEqual(row['display_name'],'New name');self.assertEqual(json.loads(row['profile'])['theme'],'dark')
    def test_shared_permission_check_and_retry_receipt(self):
        self.apply('social.profile',{'enabled':True})
        key=self.prepare('social.post',dict(body='Hello',audience='friends'));self.execute(key);self.execute(key)
        import social_store
        with accounts.db(self.auth) as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM social_posts').fetchone()[0],1)
        with self.assertRaises(ValueError):self.apply('social.message',{'body':'Not permitted'},'a'*32)
    def test_context_and_model_proposals(self):
        with server.connect() as c:context=a.context(c,[{'role':'user','content':'I earned money and ate breakfast'}],self.auth,'admin')
        self.assertIn('finance.transactions',context['capabilities']);self.assertIn('gym.food',context['capabilities']);self.assertNotIn('password',context)
        proposal={'type':'app_action','operation':'finance.transactions','data':dict(kind='income',amount='500',date=date.today().isoformat(),description='Work')}
        with patch.object(ai_provider,'_ollama_chat',return_value={'message':{'content':json.dumps({'reply':'Proposed','actions':[proposal]})}}):
            result=ai_provider.chat([{'role':'user','content':'I earned $500 today'}],context={'app':context})
        self.assertEqual(result['action_status'],'review_ready');self.assertEqual(result['actions'][0]['operation'],'finance.transactions');self.assertEqual(self.count('finance_transactions'),0)
    def test_expired_review_is_not_applied(self):
        key=self.prepare('todos.save',dict(title='Old draft'))
        with server.connect() as c:c.execute("UPDATE assistant_requests SET created_at='2000-01-01T00:00:00+00:00' WHERE id=?",(key,))
        with self.assertRaises(ValueError):self.execute(key)
        self.assertEqual(self.count('general_todos'),0)

if __name__=='__main__':unittest.main()
