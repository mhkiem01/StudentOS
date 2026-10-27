import unittest,tempfile
from pathlib import Path
import backend  # adds backend/<feature> folders to the import path
import accounts,social_store as s,social_live

class SocialRoomsAndCallsTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'accounts.db';accounts.initialize(self.path,password='Test-password-123!',must_change=False)
  self.a='admin';self.b=accounts.create_user(self.path,{'username':'student','display_name':'Student','password':'Test-password-123!'});self.c=accounts.create_user(self.path,{'username':'outsider','display_name':'Outsider','password':'Test-password-123!'})
  self.t=1000.0;self.hub,self.original=social_live.Hub(clock=lambda:self.t),s.LIVE;s.LIVE=self.hub
  for u in (self.a,self.b,self.c):self.w(u,'profile',{'enabled':True,'discoverable':True})
  self.w(self.a,'friend',{'user_id':self.b,'operation':'request'});self.w(self.b,'friend',{'user_id':self.a,'operation':'accept'})
  self.group=self.w(self.a,'space',{'kind':'study','name':'Algorithms crew'})['id']
  self.w(self.a,'membership',{'operation':'invite','user_id':self.b},self.group);self.w(self.b,'membership',{'operation':'accept_invite'},self.group)
 def tearDown(self):s.LIVE=self.original;self.tmp.cleanup()
 def w(self,u,action,data=None,key=None):return s.write(self.path,u,{'action':action,'data':data or {},'id':key})
 def rooms(self,u=None):return next(x for x in s.state(self.path,u or self.a)['spaces'] if x['id']==self.group)['rooms']
 def room(self,kind):return next(r for r in self.rooms() if r['kind']==kind)['id']
 def call(self,u,**payload):return s.call(self.path,u,payload)
 def events(self,u,cursor,peer=None):return self.hub.wait(u,cursor,0,peer)['events']
 def cursor(self,u):return s.live(self.path,u)['cursor']

 def test_groups_have_text_and_call_rooms_and_old_messages_stay_in_general(self):
  self.assertEqual([(r['kind'],r['name']) for r in self.rooms()],[('text','general'),('voice','Lounge')])
  with accounts.db(self.path) as c:c.execute("INSERT INTO social_messages(id,space_id,author,body,created_at) VALUES('legacy',?,?,'Saved before rooms','2026-01-01')",(self.group,self.a))
  general=self.room('text');self.assertEqual([m['body'] for m in s.messages(self.path,self.b,self.group)['messages']],['Saved before rooms'])
  homework=self.w(self.a,'room',{'kind':'text','name':'homework'},self.group)
  homework=next(r['id'] for r in self.rooms() if r['name']=='homework')
  self.w(self.b,'message',{'body':'Question 3?','room_id':homework},self.group);self.w(self.b,'message',{'body':'Hi all'},self.group)
  self.assertEqual([m['body'] for m in s.messages(self.path,self.a,self.group,homework)['messages']],['Question 3?'])
  self.assertEqual([m['body'] for m in s.messages(self.path,self.a,self.group,general)['messages']],['Saved before rooms','Hi all'])
  with self.assertRaises(s.Forbidden):self.w(self.b,'room',{'kind':'voice','name':'Mine'},self.group)
  with self.assertRaises(s.Forbidden):s.messages(self.path,self.c,self.group)
  self.w(self.a,'room',{'room_id':homework,'name':'homework-help'},self.group);self.assertIn('homework-help',[r['name'] for r in self.rooms()])
  # Deleting the first text room removes its messages, including ones saved before rooms existed.
  self.w(self.a,'room_delete',{'room_id':general},self.group)
  self.assertEqual([m['body'] for m in s.messages(self.path,self.a,self.group)['messages']],['Question 3?'])
  with self.assertRaisesRegex(ValueError,'at least one text room'):self.w(self.a,'room_delete',{'room_id':homework},self.group)
  other=self.w(self.c,'space',{'kind':'study','name':'Elsewhere'})['id']
  elsewhere=next(x for x in s.state(self.path,self.c)['spaces'] if x['id']==other)['rooms'][0]['id']
  with self.assertRaisesRegex(ValueError,'no longer exists'):self.w(self.b,'message',{'body':'Wrong room','room_id':elsewhere},self.group)

 def test_existing_database_upgrades_in_place(self):
  self.w(self.b,'message',{'body':'Before the upgrade'},self.group)
  with accounts.db(self.path) as c:
   c.execute('DROP INDEX social_message_room');c.execute('ALTER TABLE social_messages DROP COLUMN room_id');c.execute('DROP TABLE social_rooms')
  s.migrate(self.path);s.migrate(self.path)
  self.assertEqual([m['body'] for m in s.messages(self.path,self.a,self.group)['messages']],['Before the upgrade'])
  self.assertEqual([r['name'] for r in self.rooms()],['general','Lounge'])
  with accounts.db(self.path) as c:self.assertEqual(c.execute('PRAGMA foreign_key_check').fetchall(),[])

 def test_new_messages_and_room_changes_arrive_instantly_for_members_only(self):
  ca,cc=self.cursor(self.a),self.cursor(self.c)
  self.w(self.b,'message',{'body':'Live hello'},self.group)
  self.assertEqual(self.events(self.a,ca),[{'type':'message','space':self.group,'room':self.room('text')}])
  self.assertEqual(self.events(self.c,cc),[])
  ca=self.cursor(self.a);self.w(self.a,'room',{'kind':'voice','name':'Exam cram'},self.group)
  self.assertEqual(self.events(self.a,ca),[{'type':'rooms','space':self.group}])
  self.assertEqual(s.live(self.path,self.a,ca,epoch='not-this-server')['events'],[],'a restarted server hands out a fresh starting point')
  self.assertTrue(self.hub.wait(self.a,10**6,0)['reset'])

 def test_call_rooms_relay_setup_messages_between_members_only(self):
  lounge=self.room('voice')
  a=self.call(self.a,op='join',space=self.group,room=lounge)
  self.assertEqual([p['user'] for p in next(x for x in s.state(self.path,self.b)['spaces'] if x['id']==self.group)['calls'][lounge]],[self.a])
  with self.assertRaises(s.Forbidden):self.call(self.c,op='join',space=self.group,room=lounge)
  cb=self.cursor(self.b);b=self.call(self.b,op='join',space=self.group,room=lounge)
  self.assertEqual({p['user'] for p in b['peers']},{self.a,self.b})
  self.call(self.a,op='signal',peer=a['peer'],messages=[{'to':b['peer'],'data':{'description':{'type':'offer','sdp':'v=0'}}}])
  signals=[e for e in self.events(self.b,cb) if e['type']=='signal']
  self.assertEqual(signals,[{'type':'signal','call':lounge,'from':a['peer'],'to':b['peer'],'data':{'description':{'type':'offer','sdp':'v=0'}}}])
  with self.assertRaises(s.Forbidden):self.call(self.b,op='signal',peer=a['peer'],messages=[{'to':b['peer'],'data':{}}])
  cb=self.cursor(self.b);self.call(self.a,op='signal',peer=a['peer'],messages=[{'to':'e'*32,'data':{}},{'to':b['peer'],'data':{'candidate':{'candidate':'c'}}}])
  self.assertEqual([e['data'] for e in self.events(self.b,cb) if e['type']=='signal'],[{'candidate':{'candidate':'c'}}],'messages to someone who left are skipped, the rest still arrive')
  with self.assertRaisesRegex(ValueError,'Invalid call message'):self.call(self.a,op='signal',peer=a['peer'],messages=[{'to':b['peer'],'data':'text'}])
  self.call(self.a,op='media',peer=a['peer'],media={'muted':True,'video':True,'screen':False,'streams':{'main':'stream-1'}})
  self.assertEqual(next(p for p in self.hub.presence([lounge])[lounge] if p['user']==self.a)['media'],{'muted':True,'video':True,'screen':False,'streams':{'main':'stream-1'}})
  # Leaving and going quiet both free the seat; the server tells the dropped browser why.
  self.call(self.b,op='leave',peer=b['peer']);self.assertEqual([p['user'] for p in self.hub.presence([lounge])[lounge]],[self.a])
  ca=self.cursor(self.a);self.t+=social_live.STALE+1
  self.assertIn({'type':'call_end','call':lounge,'peer':a['peer'],'reason':'timeout'},self.events(self.a,ca))
  self.assertEqual(self.hub.presence([lounge]),{})
  self.assertFalse(self.hub.wait(self.a,ca,0,a['peer'])['peer_ok'])

 def test_joining_again_moves_your_seat_and_removed_members_are_dropped(self):
  lounge=self.room('voice');first=self.call(self.b,op='join',space=self.group,room=lounge)
  cb=self.cursor(self.b);second=self.call(self.b,op='join',space=self.group,room=lounge)
  self.assertIn({'type':'call_end','call':lounge,'peer':first['peer'],'reason':'moved'},self.events(self.b,cb))
  self.assertEqual([p['peer'] for p in self.hub.presence([lounge])[lounge]],[second['peer']])
  cb=self.cursor(self.b);self.w(self.a,'membership',{'operation':'remove','user_id':self.b},self.group)
  self.assertIn({'type':'call_end','call':lounge,'peer':second['peer'],'reason':'removed'},self.events(self.b,cb))
  self.call(self.a,op='join',space=self.group,room=lounge);ca=self.cursor(self.a)
  self.w(self.a,'room_delete',{'room_id':lounge},self.group)
  self.assertIn('deleted',[e.get('reason') for e in self.events(self.a,ca)])

 def test_direct_calls_ring_can_be_declined_answered_or_missed(self):
  dm=self.w(self.a,'dm',{'user_id':self.b})['id'];cb=self.cursor(self.b)
  a=self.call(self.a,op='join',space=dm,ring=True,video=True)
  self.assertIn({'type':'ring','call':dm,'space':dm,'from':self.a,'video':True},self.events(self.b,cb))
  self.assertEqual(s.live(self.path,self.b)['rings'],[{'call':dm,'space':dm,'from':self.a,'video':True}])
  self.assertEqual(s.state(self.path,self.b)['notifications'][0]['body'],'Admin video called you.')
  ca=self.cursor(self.a);self.call(self.b,op='decline',call=dm)
  self.assertIn({'type':'ring_end','call':dm,'reason':'declined'},self.events(self.a,ca))
  self.call(self.a,op='leave',peer=a['peer'])
  a=self.call(self.a,op='join',space=dm,ring=True);ca=self.cursor(self.a)
  self.call(self.b,op='join',space=dm)
  self.assertIn({'type':'ring_end','call':dm,'reason':'answered'},self.events(self.a,ca))
  self.call(self.a,op='leave',peer=a['peer'])
  self.assertEqual(len(self.hub.presence([dm])[dm]),1)
  # Missed: nobody answers within the ring time while the caller is still connected.
  self.call(self.b,op='leave',peer=self.hub.presence([dm])[dm][0]['peer'])
  a=self.call(self.a,op='join',space=dm,ring=True);ca=self.cursor(self.a)
  self.t+=30;self.hub.wait(self.a,ca,0,a['peer']);self.t+=social_live.RING-29
  self.assertIn({'type':'ring_end','call':dm,'reason':'missed'},self.hub.wait(self.a,ca,0,a['peer'])['events'])
  with self.assertRaises(s.Forbidden):self.call(self.c,op='join',space=dm)
  self.w(self.b,'block',{'user_id':self.a});self.assertEqual(self.hub.presence([dm]),{})

 def test_watch_together_keeps_one_shared_queue(self):
  self.assertEqual(social_live.youtube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'),('dQw4w9WgXcQ',90))
  for link in ('youtu.be/dQw4w9WgXcQ','https://m.youtube.com/shorts/dQw4w9WgXcQ','https://www.youtube.com/embed/dQw4w9WgXcQ?start=5','https://music.youtube.com/watch?v=dQw4w9WgXcQ'):
   self.assertEqual(social_live.youtube(link)[0],'dQw4w9WgXcQ',link)
  for bad in ('https://example.com/watch?v=dQw4w9WgXcQ','https://youtube.com/watch?v=short','not a link'):
   with self.assertRaises(ValueError):social_live.youtube(bad)
  lounge=self.room('voice');a=self.call(self.a,op='join',space=self.group,room=lounge);b=self.call(self.b,op='join',space=self.group,room=lounge)
  cb=self.cursor(self.b)
  w=self.call(self.a,op='watch',peer=a['peer'],action='add',url='https://youtu.be/dQw4w9WgXcQ?t=10')['watch']
  first=w['items'][0]['id'];self.assertEqual((w['current'],w['playing'],w['position']),(first,True,10.0))
  self.assertEqual([e['state']['current'] for e in self.events(self.b,cb) if e['type']=='watch'],[first])
  w=self.call(self.b,op='watch',peer=b['peer'],action='add',url='youtube.com/watch?v=9bZkp7q19f0')['watch'];second=w['items'][1]['id']
  self.assertEqual(w['current'],first,'adding queues behind the current video')
  self.t+=5;w=self.call(self.b,op='watch',peer=b['peer'],action='pause',position=15.5)['watch']
  self.assertEqual((w['playing'],w['position'],w['at']),(False,15.5,self.t))
  w=self.call(self.a,op='watch',peer=a['peer'],action='ended',item=first)['watch']
  self.assertEqual((w['current'],[i['id'] for i in w['items']]),(second,[second]))
  self.assertEqual(self.call(self.b,op='watch',peer=b['peer'],action='ended',item=first)['watch']['current'],second,'a late “ended” report does not skip again')
  with self.assertRaisesRegex(ValueError,'YouTube'):self.call(self.a,op='watch',peer=a['peer'],action='add',url='https://vimeo.com/1')
  with self.assertRaisesRegex(ValueError,'position'):self.call(self.a,op='watch',peer=a['peer'],action='seek',position='later')
  with self.assertRaises(s.Forbidden):self.call(self.c,op='watch',peer=a['peer'],action='stop')
  self.assertIsNone(self.call(self.a,op='watch',peer=a['peer'],action='next')['watch']['current'])

if __name__=='__main__':unittest.main()
