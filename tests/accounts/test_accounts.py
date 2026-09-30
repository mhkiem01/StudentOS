import json,sqlite3,tempfile,threading,unittest,time
from pathlib import Path
from contextlib import closing
from unittest.mock import patch
from urllib import request,error
from http.server import ThreadingHTTPServer
import backend  # adds backend/<feature> folders to the import path
import server,accounts

class AccountTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name);self.auth=self.path/'accounts.db'
        self.patches=[patch.object(server,'DB_PATH',self.path/'original.db')]
        for p in self.patches:p.start()
        # Initialize migrations in a temporary backup directory too.
        with patch.object(server,'ROOT',self.path):server.init_db()
        server.READY_WORKSPACES.add(str(server.DB_PATH))
        server.import_state({'subjects':{'private':{'name':'Admin private','topics':[]}}})
        accounts.initialize(self.auth,password='Original-admin-password',must_change=False)
        self.http=ThreadingHTTPServer(('127.0.0.1',0),server.Handler);self.http.accounts_path=self.auth
        threading.Thread(target=self.http.serve_forever,daemon=True).start();self.base='http://127.0.0.1:'+str(self.http.server_port)
    def tearDown(self):
        self.http.shutdown();self.http.server_close()
        for p in self.patches:p.stop()
        self.tmp.cleanup()
    def req(self,path,data=None,token='',user='admin',headers=None):
        h={'Content-Type':'application/json','X-Portal-Request':'1','X-Portal-Account':user}
        if token:h['Cookie']='portal_session='+token
        h.update(headers or {})
        r=request.Request(self.base+path,data=None if data is None else json.dumps(data).encode(),headers=h)
        try:response=request.urlopen(r)
        except error.HTTPError as e:response=e
        raw=response.read();body=json.loads(raw) if response.headers.get('Content-Type','').startswith('application/json') else raw
        return response.status,body,response.headers
    def login(self,name='admin',password='Original-admin-password'):
        status,data,headers=self.req('/api/auth/login',dict(username=name,password=password));self.assertEqual(status,200,data)
        return headers['Set-Cookie'].split(';')[0].split('=',1)[1],data['user']
    def new_user(self):
        ident=accounts.create_user(self.auth,dict(username='student',display_name='Student',password='Student-initial-password'))
        with accounts.db(self.auth) as con:con.execute('UPDATE users SET must_change=0 WHERE id=?',(ident,))
        return ident,self.login('student','Student-initial-password')[0]
    def test_no_anonymous_data_and_no_credential_file(self):
        self.assertEqual(self.req('/api/social')[0],401)
        for path in ['/api/state','/api/portal','/api/gym','/api/finance','/api/general-todos','/api/backup','/api/ai/status','/data/accounts.db','/data/ADMIN_FIRST_LOGIN.txt']:
            self.assertEqual(self.req(path)[0],401,path)
    def test_social_http_identity_and_private_membership(self):
        token,_=self.login();student,student_token=self.new_user()
        for uid,t in [('admin',token),(student,student_token)]:
            self.assertEqual(self.req('/api/social',{'action':'profile','data':{'enabled':True,'discoverable':True}},t,uid)[0],200)
        code,body,_=self.req('/api/social',{'action':'space','data':{'kind':'project','name':'Private project'}},token)
        self.assertEqual(code,200,body);space=body['id']
        self.assertEqual(self.req('/api/social/messages?space='+space,token=student_token,user=student)[0],403)
        self.assertEqual(self.req('/api/social',{'action':'message','id':space,'data':{'body':'intrusion'}},student_token,student)[0],403)
        self.assertEqual(self.req('/api/social',token=student_token,user=student)[1]['spaces'],[])
        self.assertEqual(self.req('/api/social',{'action':'read'},student_token,'admin')[0],409)
    def test_passwords_hashed_cookies_and_logout(self):
        token,user=self.login()
        with accounts.db(self.auth) as con:
            row=con.execute('SELECT password FROM users').fetchone();self.assertNotIn('Original-admin-password',row[0])
            stored=con.execute('SELECT token_hash FROM sessions').fetchone()[0];self.assertNotEqual(stored,token)
        self.assertEqual(self.req('/api/auth/me',token=token)[1]['user']['id'],'admin')
        self.assertEqual(self.req('/api/auth/logout',{},token)[0],200)
        self.assertEqual(self.req('/api/state',token=token)[0],401)
    def test_marketplace_http_protected_download_and_private_import(self):
        token,_=self.login();student,student_token=self.new_user()
        self.assertEqual(self.req('/api/marketplace')[0],401)
        draft={'title':'Shared text','subject':'COMP1521','rights':True,'status':'published','format':'markdown','content':'Private full note','preview':'Safe excerpt','price':'8'}
        code,body,_=self.req('/api/marketplace',{'action':'listing','data':draft},token)
        self.assertEqual(code,200,body);key=body['id']
        code,body,_=self.req('/api/marketplace',token=student_token,user=student)
        self.assertEqual(code,200,body);self.assertNotIn('Private full note',str(body))
        self.assertEqual(self.req('/api/marketplace/download/'+key,token=student_token,user=student)[0],403)
        self.assertEqual(self.req('/api/marketplace/import',{'listing':key,'subject_id':'private','week':1},student_token,student)[0],403)
        draft['price']='0';self.assertEqual(self.req('/api/marketplace',{'action':'listing','id':key,'data':draft},token)[0],200)
        self.assertEqual(self.req('/api/marketplace',{'action':'acquire','id':key},student_token,student)[0],200)
        code,raw,headers=self.req('/api/marketplace/download/'+key,token=student_token,user=student)
        self.assertEqual(code,200);self.assertEqual(raw,b'Private full note');self.assertIn('attachment',headers['Content-Disposition'])
        self.req('/api/state',{'subjects':{'mine':{'name':'Mine','topics':[]}}},student_token,student)
        code,body,_=self.req('/api/marketplace/import',{'listing':key,'subject_id':'mine','week':3},student_token,student)
        self.assertEqual(code,200,body)
        notes=self.req('/api/portal',token=student_token,user=student)[1]['notes'];self.assertEqual(len(notes),1);self.assertIn('Imported from Marketplace',notes[0]['content'])
        self.assertEqual(self.req('/api/portal',token=token)[1]['notes'],[])
        self.assertEqual(self.req('/api/marketplace/import',{'listing':key,'subject_id':'mine','week':3},student_token,student)[0],400)
        self.assertEqual(self.req('/api/marketplace',{'action':'read'},student_token,'admin')[0],409)
    def test_csrf_and_cross_account_stale_tab(self):
        token,_=self.login()
        self.assertEqual(self.req('/api/reset',{},token,headers={'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.req('/api/reset',{},token,headers={'X-Portal-Request':''})[0],403)
        self.assertEqual(self.req('/api/state',{},token,user='other')[0],409)
        self.assertIn('private',self.req('/api/state',token=token)[1]['subjects'])
    def test_workspaces_and_backups_are_isolated(self):
        token,_=self.login();ident,student=self.new_user()
        self.assertEqual(self.req('/api/state',token=student,user=ident)[1]['subjects'],{})
        self.assertEqual(self.req('/api/state',{'subjects':{'mine':{'name':'Student only','topics':[]}}},student,ident)[0],200)
        admin=self.req('/api/state',token=token)[1];self.assertIn('private',admin['subjects']);self.assertNotIn('mine',admin['subjects'])
        self.assertEqual(self.req('/api/admin/users',token=student,user=ident)[0],403)
        self.assertEqual(self.req('/api/gym',token=student,user=ident)[1]['sessions'],[])
        self.assertEqual(self.req('/api/general-todos',{'action':'save','item':{'title':'Private student task'}},student,ident)[0],200)
        self.assertEqual(self.req('/api/general-todos',token=token)[1]['todos'],[])
        self.assertEqual(self.req('/api/general-todos',token=student,user=ident)[1]['todos'][0]['title'],'Private student task')
        self.assertEqual(self.req('/api/finance',{'action':'profile','data':{'enabled':True}},student,ident)[0],200)
        self.assertEqual(self.req('/api/finance',{'action':'transactions','data':{'kind':'income','amount':'10.50','date':'2026-09-21','description':'Private finance'}},student,ident)[0],200)
        self.assertEqual(self.req('/api/finance',token=token)[1]['transactions'],[])
        status,backup,_=self.req('/api/backup',token=student,user=ident);self.assertEqual(status,200)
        dest=self.path/'verify.db';dest.write_bytes(backup)
        with closing(sqlite3.connect(dest)) as con:
            self.assertEqual(con.execute('SELECT name FROM subjects').fetchone()[0],'Student only')
            self.assertFalse(con.execute("SELECT 1 FROM sqlite_master WHERE name='users'").fetchone())
            self.assertEqual(con.execute('SELECT amount FROM finance_transactions').fetchone()[0],1050)
    def test_forced_password_change_revokes_sessions(self):
        with accounts.db(self.auth) as con:con.execute("UPDATE users SET must_change=1 WHERE id='admin'")
        token,_=self.login();self.assertEqual(self.req('/api/state',token=token)[0],403)
        self.assertEqual(self.req('/api/auth/password',dict(current_password='Original-admin-password',new_password='My-new-admin-password'),token)[0],200)
        self.assertEqual(self.req('/api/state',token=token)[0],401)
        new,_=self.login(password='My-new-admin-password');self.assertEqual(self.req('/api/state',token=new)[0],200)
    def test_expired_session_and_disable(self):
        token,_=self.login();ident,student=self.new_user()
        self.assertEqual(self.req('/api/admin/manage',dict(id=ident,action='disable'),token)[0],200)
        self.assertEqual(self.req('/api/state',token=student,user=ident)[0],401)
        self.assertEqual(self.req('/api/admin/manage',dict(id='admin',action='disable'),token)[0],400)
        with accounts.db(self.auth) as con:con.execute('UPDATE sessions SET last_seen=?',(int(time.time())-43201,))
        self.assertEqual(self.req('/api/state',token=token)[0],401)
    def test_profile_sanitization_and_image_validation(self):
        token,_=self.login()
        self.assertEqual(self.req('/api/auth/profile',dict(display_name='A',avatar='fox',theme='dark'),token)[0],200)
        self.assertEqual(self.req('/api/auth/me',token=token)[1]['user']['profile']['avatar'],'fox')
        self.assertEqual(self.req('/api/auth/profile',dict(display_name='A',photo='data:image/svg+xml;base64,PHN2Zz4='),token)[0],400)
        self.assertEqual(self.req('/api/auth/profile',dict(display_name='A',photo='data:image/png;base64,bm90IGltYWdl'),token)[0],400)
    def test_login_throttling_and_revocation(self):
        for _ in range(8):self.assertEqual(self.req('/api/auth/login',dict(username='admin',password='Wrong-password-for-test'))[0],400)
        self.assertEqual(self.req('/api/auth/login',dict(username='admin',password='Original-admin-password'))[0],429)

if __name__=='__main__':unittest.main()
