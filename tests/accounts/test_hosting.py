"""Running online (Render, docs/DEPLOY_RENDER.md): settings come from environment variables, data lives in the
STUDENTOS_DATA folder, sign-in cookies are HTTPS-only, failed sign-ins are counted per visitor behind the proxy, and
tools/restore_data.py copies a laptop's data folder over safely. Without those settings nothing changes."""
import json,os,socket,sqlite3,subprocess,sys,tempfile,time,unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from urllib import request
import backend  # adds backend/<feature> folders to the import path
import server
sys.path.insert(0,str(Path(server.ROOT)/'tools'))
import restore_data

ROOT=Path(server.ROOT)

class HostingTests(unittest.TestCase):
    def test_visitor_address_comes_from_the_proxy_only_when_trusted(self):
        headers={'X-Forwarded-For':'203.0.113.7, 10.0.0.2','CF-Connecting-IP':'198.51.100.4'}
        self.assertEqual(server.client_ip(headers,'10.0.0.2'),'10.0.0.2','not behind a trusted proxy: the connection address')
        with patch.dict(os.environ,{'PORTAL_TRUST_PROXY':'1'}):
            self.assertEqual(server.client_ip(headers,'10.0.0.2'),'198.51.100.4')
            self.assertEqual(server.client_ip({'X-Forwarded-For':'203.0.113.7, 10.0.0.2'},'10.0.0.2'),'203.0.113.7')
            self.assertEqual(server.client_ip({},'10.0.0.2'),'10.0.0.2')

    def test_data_folder_follows_studentos_data(self):
        code='import backend,server;print(server.DB_PATH);print(server.backups_path())'
        with tempfile.TemporaryDirectory() as tmp:
            out=subprocess.run([sys.executable,'-c',code],cwd=ROOT,env={**os.environ,'STUDENTOS_DATA':tmp},capture_output=True,text=True,check=True).stdout.split()
            self.assertEqual([Path(p) for p in out],[Path(tmp)/'quizprep.db',Path(tmp)/'backups'])
        env={k:v for k,v in os.environ.items() if k!='STUDENTOS_DATA'}
        out=subprocess.run([sys.executable,'-c',code],cwd=ROOT,env=env,capture_output=True,text=True,check=True).stdout.split()
        self.assertEqual([Path(p) for p in out],[ROOT/'data'/'quizprep.db',ROOT/'backups'])

    def test_server_runs_like_on_render(self):
        with tempfile.TemporaryDirectory() as tmp,socket.socket() as s:
            s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close()
            env={**os.environ,'PORT':str(port),'STUDENTOS_DATA':tmp,'PORTAL_HTTPS':'1','PORTAL_TRUST_PROXY':'1','PORTAL_PUBLIC_URL':'https://studentos.example.com','PYTHONUNBUFFERED':'1'}
            proc=subprocess.Popen([sys.executable,'server.py','--no-browser'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            try:
                base=f'http://127.0.0.1:{port}'
                for _ in range(100):
                    try:
                        with request.urlopen(base+'/api/health',timeout=1) as r:self.assertEqual(json.load(r),{'ok':True});break
                    except OSError:time.sleep(.1)
                else:self.fail('the server did not start')
                # Everything is created in the data folder, including the first admin password.
                for name in ('quizprep.db','accounts.db','ADMIN_FIRST_LOGIN.txt'):self.assertTrue((Path(tmp)/name).is_file(),name)
                password=next(line.split(': ',1)[1] for line in (Path(tmp)/'ADMIN_FIRST_LOGIN.txt').read_text(encoding='utf-8').splitlines() if line.startswith('Temporary password'))
                login=request.Request(base+'/api/auth/login',data=json.dumps({'username':'admin','password':password}).encode(),method='POST',
                    headers={'Content-Type':'application/json','X-Portal-Request':'1','Origin':base})
                with request.urlopen(login) as r:cookie=r.headers['Set-Cookie']
                self.assertIn('Secure',cookie);self.assertIn('HttpOnly',cookie)
            finally:
                proc.terminate();output=proc.communicate(timeout=10)[0]
            self.assertIn('Online at https://studentos.example.com/',output);self.assertNotIn('Phone (same Wi-Fi)',output)

    def test_restoring_a_laptop_data_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            src,dst=Path(tmp)/'incoming',Path(tmp)/'disk'
            (src/'users'/'abc').mkdir(parents=True);(src/'note_uploads').mkdir();dst.mkdir()
            for db in (src/'quizprep.db',src/'users'/'abc'/'workspace.db'):
                with closing(sqlite3.connect(db)) as con,con:con.execute('CREATE TABLE notes(title)');con.execute("INSERT INTO notes VALUES('from the laptop')")
            (src/'note_uploads'/('a'*32+'.ink')).write_text('v1 lined white',encoding='ascii');(src/'quizprep.db-wal').write_bytes(b'')
            with closing(sqlite3.connect(dst/'quizprep.db')) as con,con:con.execute('CREATE TABLE notes(title)')   # what a first start created
            (dst/'ADMIN_FIRST_LOGIN.txt').write_text('stale',encoding='utf-8')
            self.assertEqual(restore_data.restore(src,dst),(2,1))
            for db in (dst/'quizprep.db',dst/'users'/'abc'/'workspace.db'):
                with closing(sqlite3.connect(db)) as con:self.assertEqual(con.execute('SELECT title FROM notes').fetchall(),[('from the laptop',)])
            self.assertEqual((dst/'note_uploads'/('a'*32+'.ink')).read_text(encoding='ascii'),'v1 lined white')
            self.assertFalse((dst/'ADMIN_FIRST_LOGIN.txt').exists(),'the temporary admin password no longer applies')
            self.assertFalse((dst/'quizprep.db-wal').exists())
            with self.assertRaises(SystemExit):restore_data.restore(dst/'users',dst)
