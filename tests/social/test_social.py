import unittest,tempfile,base64
from pathlib import Path
import backend  # adds backend/<feature> folders to the import path
import accounts,social_store as s

class SocialTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'accounts.db';accounts.initialize(self.path,password='Test-password-123!',must_change=False)
  self.a='admin';self.b=accounts.create_user(self.path,{'username':'student','display_name':'Student','password':'Test-password-123!'});self.c=accounts.create_user(self.path,{'username':'outsider','display_name':'Outsider','password':'Test-password-123!'})
  for u in (self.a,self.b,self.c):self.w(u,'profile',{'enabled':True,'discoverable':True})
 def tearDown(self):self.tmp.cleanup()
 def w(self,u,action,data=None,key=None):return s.write(self.path,u,{'action':action,'data':data or {},'id':key})
 def friend(self):self.w(self.a,'friend',{'user_id':self.b,'operation':'request'});self.w(self.b,'friend',{'user_id':self.a,'operation':'accept'})
 def room(self,kind='project',private=False):return self.w(self.a,'space',{'kind':kind,'name':'Real test project','private':private})['id']
 def join(self,key):self.friend();self.w(self.a,'membership',{'operation':'invite','user_id':self.b},key);self.w(self.b,'membership',{'operation':'accept_invite'},key)
 def test_task_board_moves_log_and_delete(self):
  key=self.room();self.join(key)
  first=self.w(self.a,'task',{'space_id':key,'title':'Research'})['id'];second=self.w(self.b,'task',{'space_id':key,'title':'Slides'})['id']
  project=lambda:s.state(self.path,self.a)['spaces'][0];tasks=lambda:{t['title']:t for t in project()['tasks']}
  self.assertEqual([tasks()[t]['data']['position'] for t in ('Research','Slides')],[0,1]);self.assertEqual(tasks()['Slides']['data']['created_by'],self.b)
  # Dragging changes only the column and place; each status change is logged with who did it.
  self.w(self.b,'task_move',{'status':'in_progress','position':-1},first);self.w(self.a,'task_move',{'status':'in_progress','position':-2},second);self.w(self.b,'task_move',{'status':'done','position':0},first)
  log=lambda:[(x['actor'],x['kind'],x['data'].get('title'),x['data'].get('from'),x['data'].get('to')) for x in reversed(project()['activity'])]
  self.assertEqual(log(),[(self.a,'task_created','Research',None,'todo'),(self.b,'task_created','Slides',None,'todo'),(self.b,'task_status','Research','todo','in_progress'),(self.a,'task_status','Slides','todo','in_progress'),(self.b,'task_done','Research','in_progress','done')])
  self.assertEqual((tasks()['Research']['data']['status'],tasks()['Slides']['data']['position']),('done',-2))
  # Reordering inside a column is saved without adding to the log.
  self.w(self.a,'task_move',{'status':'in_progress','position':4.5},second);self.assertEqual(len(log()),5);self.assertEqual(tasks()['Slides']['data']['position'],4.5)
  for bad in ({'status':'nope','position':1},{'status':'todo','position':'1'},{'status':'todo','position':float('inf')},{'status':'todo','position':True}):
   with self.subTest(bad=bad),self.assertRaises(ValueError):self.w(self.a,'task_move',bad,second)
  with self.assertRaises(s.Forbidden):self.w(self.c,'task_move',{'status':'todo','position':0},second)
  # Edits name the fields that changed; creator and position survive an edit.
  t=tasks()['Slides'];self.w(self.a,'task',{'space_id':key,'title':'Slides v2','status':'in_progress','priority':'high','updated_at':t['updated_at']},second)
  self.assertEqual(log()[-1][:2],(self.a,'task_updated'));self.assertEqual(project()['activity'][0]['data']['fields'],['priority','title'])
  self.assertEqual((tasks()['Slides v2']['data']['created_by'],tasks()['Slides v2']['data']['position']),(self.b,4.5))
  # Only the project owner or the task's creator can delete a task, and the deletion is logged.
  with self.assertRaises(s.Forbidden):self.w(self.b,'task_delete',{},first)
  self.w(self.b,'task_delete',{},second);self.w(self.a,'task_delete',{},first)
  self.assertEqual(tasks(),{});self.assertEqual([x[:3] for x in log()[-2:]],[(self.b,'task_deleted','Slides v2'),(self.a,'task_deleted','Research')])
  with self.assertRaises(ValueError):self.w(self.a,'task_delete',{},first)
 def test_profile_privacy_toggle(self):
  self.w(self.a,'profile',{'university':'UNSW','subjects':['COMP1521'],'bio':'Hello'})
  view=next(p for p in s.state(self.path,self.b)['people'] if p['id']==self.a)
  self.assertEqual(view['subjects'],[]);self.assertEqual(view['university'],'');self.assertNotIn('email',view)
  key=self.room();self.w(self.a,'profile',{'enabled':False});self.assertNotIn('spaces',s.state(self.path,self.a))
  with self.assertRaises(s.Forbidden):self.w(self.a,'space',{'kind':'club','name':'No'})
  self.w(self.a,'profile',{'enabled':True});self.assertEqual(s.state(self.path,self.a)['spaces'][0]['id'],key)
 def test_friend_permissions_and_block(self):
  self.w(self.a,'friend',{'user_id':self.b,'operation':'request'})
  with self.assertRaises(s.Forbidden):self.w(self.c,'friend',{'user_id':self.a,'operation':'accept'})
  self.w(self.b,'friend',{'user_id':self.a,'operation':'accept'});self.assertEqual(s.state(self.path,self.a)['notifications'][0]['kind'],'friend_accepted')
  self.w(self.b,'block',{'user_id':self.a})
  with self.assertRaises(s.Forbidden):self.w(self.a,'dm',{'user_id':self.b})
 def test_shared_messages_and_removed_access(self):
  key=self.room();self.join(key);self.w(self.b,'message',{'body':'Project hello'},key)
  self.assertEqual(s.messages(self.path,self.a,key)['messages'][0]['body'],'Project hello')
  with self.assertRaises(s.Forbidden):s.messages(self.path,self.c,key)
  self.w(self.a,'membership',{'operation':'remove','user_id':self.b},key)
  with self.assertRaises(s.Forbidden):s.messages(self.path,self.b,key)
  self.assertNotIn(key,[v['id'] for v in s.state(self.path,self.c)['spaces']])
 def test_private_club_approval(self):
  key=self.room('club',True);self.w(self.b,'membership',{'operation':'join'},key)
  with self.assertRaises(s.Forbidden):s.messages(self.path,self.b,key)
  with self.assertRaises(s.Forbidden):self.w(self.c,'membership',{'operation':'approve','user_id':self.b},key)
  self.w(self.a,'membership',{'operation':'approve','user_id':self.b},key);self.w(self.b,'message',{'body':'Joined'},key)
 def test_tasks_history_and_files(self):
  key=self.room();self.join(key);task={'space_id':key,'title':'Implement','assigned':[self.b],'checklist':[{'text':'Test','done':False}]}
  t=self.w(self.a,'task',task)['id'];before=s.state(self.path,self.b)['spaces'][0]['tasks'][0];task.update(status='done',updated_at=before['updated_at']);self.w(self.b,'task',task,t)
  result=s.state(self.path,self.a)['spaces'][0];self.assertEqual(len(result['activity']),2);self.assertEqual(result['tasks'][0]['data']['status'],'done')
  with self.assertRaises(s.Forbidden):self.w(self.c,'task',task,t)
  with self.assertRaises(ValueError):self.w(self.b,'task',task,t)
  self.w(self.b,'file',{'name':'work.txt','base64':base64.b64encode(b'private').decode()},key)
  file=s.state(self.path,self.a)['spaces'][0]['files'][0];self.assertEqual(s.download(self.path,self.a,file['id'])[0],b'private')
  with self.assertRaises(s.Forbidden):s.download(self.path,self.c,file['id'])
 def test_private_posts_events_and_dm(self):
  self.friend();key=self.w(self.a,'dm',{'user_id':self.b})['id'];self.w(self.a,'message',{'body':'Hi'},key)
  self.w(self.b,'profile',{'dm':'nobody'})
  with self.assertRaises(s.Forbidden):self.w(self.a,'message',{'body':'No'},key)
  self.w(self.a,'post',{'body':'Friends only'});self.assertEqual(len(s.state(self.path,self.c)['posts']),0);self.assertEqual(len(s.state(self.path,self.b)['posts']),1)
  project=self.room();self.w(self.a,'event',{'space_id':project,'title':'Private meeting','start':'2026-10-01T14:00'})
  self.assertEqual(s.state(self.path,self.c)['events'],[])
 def test_malformed_ids_and_notification_preferences(self):
  with self.assertRaises(ValueError):self.w(self.a,'task',{'space_id':self.room(),'title':'Unsafe'},'\" onfocus=alert(1)')
  self.w(self.b,'profile',{'notify_friend_request':False})
  self.w(self.a,'friend',{'user_id':self.b,'operation':'request'})
  self.assertEqual(s.state(self.path,self.b)['notifications'],[])
  self.w(self.b,'read',{},'')
 def test_disabled_profiles_not_discovered_and_migration_repeat(self):
  with accounts.db(self.path) as c:c.execute('UPDATE users SET disabled=1 WHERE id=?',(self.b,))
  self.assertNotIn(self.b,[p['id'] for p in s.state(self.path,self.a)['people']])
  key=self.room();s.migrate(self.path)
  self.assertEqual(s.state(self.path,self.a)['spaces'][0]['id'],key)
