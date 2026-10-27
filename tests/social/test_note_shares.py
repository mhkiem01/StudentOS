import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import server,accounts,social_store as s,social_live,note_shares as shares

IMAGE='ab'*16+'.png'

class NoteShareTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name);self.auth=root/'accounts.db'
        self.patches=[patch.object(server,'ROOT',root),patch.object(server,'DB_PATH',root/'admin.db'),patch.object(server,'READY_WORKSPACES',set())]
        for p in self.patches:p.start()
        self.hub,self.original=social_live.Hub(),s.LIVE;s.LIVE=self.hub
        accounts.initialize(self.auth,password='Test-password-123!',must_change=False)
        self.a='admin';self.b=accounts.create_user(self.auth,{'username':'friend','display_name':'Casey','password':'Test-password-123!'});self.c=accounts.create_user(self.auth,{'username':'stranger','display_name':'Sam','password':'Test-password-123!'})
        for u in (self.a,self.b,self.c):s.write(self.auth,u,{'action':'profile','data':{'enabled':True,'discoverable':True}})
        s.write(self.auth,self.a,{'action':'friend','data':{'user_id':self.b,'operation':'request'}});s.write(self.auth,self.b,{'action':'friend','data':{'user_id':self.a,'operation':'accept'}})
        self.workspace(self.a,{'subjects':{'sec':{'name':'COMP6447','topics':['Overflows']}},'topics':{'Overflows':[]}})
        self.workspace(self.b,{'subjects':{'mine':{'name':'Security','topics':['Pwn']}},'topics':{'Pwn':[]}})
        (server.DB_PATH.parent/'note_uploads').mkdir();(server.DB_PATH.parent/'note_uploads'/IMAGE).write_bytes(b'\x89PNG fake')
        self.in_workspace(self.a,lambda:server.save_portal({'table':'notes','item':{'id':'n1','subject_id':'sec','topic_name':'Overflows','title':'Stack notes','content':f'<p>Saved RBP is 8 bytes.</p><p><img src="/api/notes/images/{IMAGE}"></p>','content_format':'html'}}))
    def tearDown(self):
        s.LIVE=self.original
        for p in self.patches:p.stop()
        self.tmp.cleanup()
    def in_workspace(self,u,fn):
        token=server.REQUEST_DB.set(server.workspace_path(self.auth,u))
        try:return fn()
        finally:server.REQUEST_DB.reset(token)
    def workspace(self,u,state):
        server.workspace_path(self.auth,u).parent.mkdir(parents=True,exist_ok=True)
        self.in_workspace(u,lambda:(server.init_db(),server.import_state(state)))
    ws=property(lambda self:lambda uid:server.ready_workspace(self.auth,uid))
    def w(self,u,action,data=None,key=None):return shares.write(self.auth,self.ws,u,{'action':action,'data':data or {},'id':key})
    def state(self,u):return shares.state(self.auth,self.ws,u)
    def read(self,u,key):return shares.read(self.auth,self.ws,u,key)
    def events(self,u,cursor):return self.hub.wait(u,cursor,0)['events']
    def share(self,permission='view'):return self.w(self.a,'share',{'note_id':'n1','recipients':[self.b],'permission':permission})['ids'][0]
    def messages(self,u):
        dm=next(x for x in s.state(self.auth,u)['spaces'] if x['kind']=='dm')['id']
        return s.messages(self.auth,u,dm)['messages']

    def test_sharing_sends_a_card_and_only_reaches_friends(self):
        with self.assertRaisesRegex(s.Forbidden,'only share notes with friends'):self.w(self.a,'share',{'note_id':'n1','recipients':[self.c]})
        with self.assertRaisesRegex(ValueError,'Save this note'):self.w(self.a,'share',{'note_id':'missing','recipients':[self.b]})
        cursor=self.hub.snapshot(self.b)['cursor'];key=self.share()
        received=self.state(self.b)['received']
        self.assertEqual([(r['id'],r['title'],r['owner_name'],r['permission'],r['missing']) for r in received],[(key,'Stack notes','Admin','view',False)])
        self.assertEqual(received[0]['preview'],'Saved RBP is 8 bytes.\n\n')
        card=self.messages(self.b)[-1];self.assertEqual(json.loads(card['attachment']),{'kind':'note_share','share':key,'title':'Stack notes'})
        self.assertEqual(s.state(self.auth,self.b)['notifications'][0]['body'],'Admin shared a note with you: Stack notes')
        self.assertIn({'type':'note_shares'},self.events(self.b,cursor))
        self.assertEqual([f['name'] for f in self.state(self.a)['friends']],['Casey'])
        self.assertEqual(self.state(self.a)['owned'][0]['recipient_name'],'Casey')

    def test_friends_read_the_live_note_and_its_images(self):
        key=self.share();n=self.read(self.b,key)
        self.assertEqual((n['share']['role'],n['note']['title']),('recipient','Stack notes'))
        self.assertIn(f'/api/note-shares/{key}/images/{IMAGE}',n['note']['content']);self.assertNotIn('/api/notes/images/',n['note']['content'])
        self.assertEqual(shares.image(self.auth,self.ws,self.b,key,IMAGE),(b'\x89PNG fake',IMAGE))
        for bad in (lambda:self.read(self.c,key),lambda:shares.image(self.auth,self.ws,self.c,key,IMAGE),lambda:shares.image(self.auth,self.ws,self.b,key,'../admin.db')):
            with self.assertRaises(s.Forbidden):bad()
        # The owner's next save reaches the friend instantly.
        cursor=self.hub.snapshot(self.b)['cursor']
        self.in_workspace(self.a,lambda:server.save_portal({'table':'notes','item':{'id':'n1','title':'Stack notes v2','content':'<p>Updated</p>','content_format':'html'}}))
        shares.changed(self.auth,self.a,'n1')
        self.assertIn({'type':'note','share':key,'note':'n1','deleted':False},self.events(self.b,cursor))
        self.assertEqual(self.read(self.b,key)['note']['title'],'Stack notes v2')

    def test_asking_for_and_getting_permission_to_edit(self):
        key=self.share()
        with self.assertRaisesRegex(s.Forbidden,'Ask the owner'):self.w(self.b,'edit',{'title':'x','content':'<p>x</p>'},key)
        self.w(self.b,'request',{},key)
        with self.assertRaisesRegex(ValueError,'already asked'):self.w(self.b,'request',{},key)
        self.assertEqual(json.loads(self.messages(self.a)[-1]['attachment'])['kind'],'note_edit_request')
        self.assertEqual(s.state(self.auth,self.a)['notifications'][0]['body'],'Casey asked to edit “Stack notes”.')
        with self.assertRaisesRegex(s.Forbidden,'Only the note'):self.w(self.b,'permission',{'permission':'edit'},key)
        self.w(self.a,'permission',{'permission':'edit'},key)
        self.assertEqual((self.state(self.b)['received'][0]['permission'],self.state(self.b)['received'][0]['request']),('edit',None))
        self.assertEqual(self.messages(self.b)[-1]['body'],'✓ You can now edit “Stack notes”.')
        base=self.read(self.b,key)['note']['updated_at'];cursor=self.hub.snapshot(self.a)['cursor']
        saved=self.w(self.b,'edit',{'title':'Stack notes','content':f'<p>Casey added this.</p><p><img src="/api/note-shares/{key}/images/{IMAGE}"></p><script>bad()</script>','base_updated_at':base},key)
        self.assertIn(f'/api/note-shares/{key}/images/{IMAGE}',saved['note']['content'])
        owner_copy=self.in_workspace(self.a,lambda:next(n for n in server.portal_state()['notes'] if n['id']=='n1'))
        self.assertIn(f'/api/notes/images/{IMAGE}',owner_copy['content']);self.assertIn('Casey added this.',owner_copy['content']);self.assertNotIn('script',owner_copy['content'])
        self.assertEqual((owner_copy['subject_id'],owner_copy['topic_name']),('sec','Overflows'),'the owner keeps their organisation')
        self.assertIn({'type':'note','note':'n1','deleted':False},self.events(self.a,cursor))
        with self.assertRaisesRegex(ValueError,'Someone else changed'):self.w(self.b,'edit',{'title':'Old','content':'<p>old</p>','base_updated_at':base},key)
        url=self.w(self.b,'upload',{'image':'data:image/png;base64,iVBORw0KGgo='},key)['url']
        self.assertRegex(url,f'^/api/note-shares/{key}/images/[a-f0-9]{{32}}\\.png$')
        self.w(self.a,'permission',{'permission':'view'},key)
        with self.assertRaises(s.Forbidden):self.w(self.b,'edit',{'title':'x','content':'<p>x</p>','base_updated_at':saved['note']['updated_at']},key)

    def test_handwriting_pages_reach_friends_through_the_share(self):
        page='v1 grid cream|m 1f6feb 60 400,400 40,0';uploads=lambda:server.database_path().parent/'note_uploads'
        ink=self.in_workspace(self.a,lambda:server.note_document.save_ink(uploads(),{'ink':page}));key=self.share()
        self.assertEqual(shares.ink(self.auth,self.ws,self.b,key,ink),page)
        for bad in (lambda:shares.ink(self.auth,self.ws,self.c,key,ink),lambda:shares.ink(self.auth,self.ws,self.b,key,'../admin'),lambda:self.w(self.b,'ink',{'ink':page},key)):
            with self.assertRaises(s.Forbidden):bad()
        self.w(self.a,'permission',{'permission':'edit'},key)
        written=self.w(self.b,'ink',{'ink':page.replace('grid','dotted')},key)['id']
        self.assertEqual(self.in_workspace(self.a,lambda:server.note_document.read_ink(uploads(),written)),'v1 dotted cream|m 1f6feb 60 400,400 40,0')

    def test_saving_into_your_own_subjects(self):
        key=self.share()
        with self.assertRaisesRegex(ValueError,'your subjects'):self.w(self.b,'save',{'subject_id':'sec'},key)
        with self.assertRaisesRegex(ValueError,'topic from that subject'):self.w(self.b,'save',{'subject_id':'mine','topic_name':'Overflows'},key)
        self.w(self.b,'save',{'subject_id':'mine','topic_name':'Pwn'},key)
        self.assertEqual((self.state(self.b)['received'][0]['saved_subject'],self.state(self.b)['received'][0]['saved_topic']),('mine','Pwn'))
        self.w(self.b,'save',{'subject_id':None},key);self.assertIsNone(self.state(self.b)['received'][0]['saved_subject'])
        with self.assertRaisesRegex(s.Forbidden,'This note is yours'):self.w(self.a,'request',{},key)

    def test_stopping_sharing_and_deleting_the_note(self):
        key=self.share();self.w(self.a,'revoke',{},key)
        with self.assertRaises(s.Forbidden):self.read(self.b,key)
        key=self.share();self.w(self.b,'leave',{},key);self.assertEqual(self.state(self.b)['received'],[])
        key=self.share();cursor=self.hub.snapshot(self.b)['cursor']
        self.in_workspace(self.a,lambda:server.delete_portal({'table':'notes','id':'n1'}));shares.changed(self.auth,self.a,'n1',deleted=True)
        self.assertEqual(self.state(self.b)['received'],[]);self.assertIn({'type':'note','share':key,'note':'n1','deleted':True},self.events(self.b,cursor))
        s.write(self.auth,self.a,{'action':'profile','data':{'enabled':False}})
        with self.assertRaisesRegex(s.Forbidden,'Turn on Socialise'):self.w(self.a,'share',{'note_id':'n1','recipients':[self.b]})

if __name__=='__main__':unittest.main()
