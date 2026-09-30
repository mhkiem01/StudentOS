"""Local accounts and revocable, opaque sessions. Passwords never enter study DBs.

PBKDF2-HMAC-SHA256, 600,000 iterations, independent random salts.
Session tokens are random 256-bit secrets; only SHA256 digests are stored.
"""
import base64, hashlib, hmac, io, json, re, secrets, sqlite3, time, uuid
from pathlib import Path
from contextlib import contextmanager

AVATARS=('graduate','owl','fox','cat','panda','robot','astronaut','leaf')
def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def password_hash(password,salt=None):
    if not isinstance(password,str) or not 12<=len(password)<=128:raise ValueError('Use a password of 12–128 characters.')
    salt=salt or secrets.token_hex(16)
    return salt+':'+hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
def verify(password,stored):
    try:return hmac.compare_digest(password_hash(password,stored.split(':')[0]),stored)
    except (ValueError,AttributeError,TypeError):return False
@contextmanager
def db(path):
    con=sqlite3.connect(path,timeout=20);con.row_factory=sqlite3.Row;con.execute('PRAGMA foreign_keys=ON')
    try:
        with con:yield con
    finally:con.close()
def public(user):
    return {k:user[k] for k in ('id','username','role','display_name','profile','must_change','disabled','created_at')}
def unpack(row):
    if not row:return None
    item=dict(row);item['profile']=json.loads(item['profile']);return item

def initialize(path,admin_name='Admin',password=None,must_change=True):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    with db(path) as con:
        con.executescript('''CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student')),display_name TEXT NOT NULL,profile TEXT NOT NULL DEFAULT '{}',must_change INTEGER NOT NULL DEFAULT 1,disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL,last_seen INTEGER NOT NULL,created_at INTEGER NOT NULL,agent TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
        ''')
        con.execute('BEGIN IMMEDIATE')
        if con.execute("SELECT 1 FROM users WHERE id='admin'").fetchone():return False
        temporary=password or secrets.token_urlsafe(18)
        # Provision the credential file before committing the account. This is
        # outside the static allowlist and never downloadable from the server.
        if password is None:
            credential=path.parent/'ADMIN_FIRST_LOGIN.txt'
            credential.write_text('Student Helper Portal — initial admin login\n\nUsername: admin\nTemporary password: '+temporary+'\n\nChange this password at first sign-in. Existing data belongs to this account.\nThis file is removed after that password change. Keep it private.\n',encoding='utf-8')
        con.execute('INSERT INTO users(id,username,password,role,display_name,must_change,created_at) VALUES(?,?,?,?,?,?,?)',('admin','admin',password_hash(temporary),'admin',admin_name or 'Admin',int(must_change),int(time.time())))
    return True

def login(path,username,password,ip,agent):
    now=int(time.time());name=str(username).strip().lower();keys=['ip:'+ip,'user:'+name]
    with db(path) as con:
        for key in keys:
            row=con.execute('SELECT * FROM attempts WHERE key=?',(key,)).fetchone()
            if row and row['until']>now and row['count']>=8:raise PermissionError('Too many attempts. Wait 15 minutes and try again.')
        user=unpack(con.execute('SELECT * FROM users WHERE username=?',(name,)).fetchone())
        # Perform comparable hashing even for unknown users.
        valid=verify(password,user['password'] if user else '0'*32+':'+'0'*64)
        if not user or user['disabled'] or not valid:
            for key in keys:con.execute('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=?',(key,now+900,now,now+900))
            con.commit();raise ValueError('Incorrect username or password.')
        for key in keys:con.execute('DELETE FROM attempts WHERE key=?',(key,))
        token=secrets.token_urlsafe(32)
        con.execute('DELETE FROM sessions WHERE expires<? OR last_seen<?',(now,now-43200))
        con.execute('INSERT INTO sessions VALUES(?,?,?,?,?,?)',(digest(token),user['id'],now+604800,now,now,str(agent)[:200]))
        return public(user),token

def session(path,token):
    if not token or len(token)>200:return None
    now=int(time.time())
    with db(path) as con:
        row=con.execute('SELECT u.*,s.token_hash FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>? AND s.last_seen>? AND u.disabled=0',(digest(token),now,now-43200)).fetchone()
        if not row:return None
        con.execute('UPDATE sessions SET last_seen=? WHERE token_hash=?',(now,digest(token)))
        return unpack(row)

def photo(value):
    if value is None:return None
    if not isinstance(value,str) or len(value)>1500000 or not re.match(r'^data:image/(png|jpeg|webp);base64,',value):raise ValueError('Choose a PNG, JPEG or WebP photo under 1 MB.')
    try:
        from PIL import Image,ImageOps
        raw=base64.b64decode(value.split(',',1)[1],validate=True)
        if len(raw)>1000000:raise ValueError()
        with Image.open(io.BytesIO(raw)) as image:
            if image.width*image.height>16000000:raise ValueError()
            image=ImageOps.fit(ImageOps.exif_transpose(image).convert('RGB'),(256,256))
            out=io.BytesIO();image.save(out,'JPEG',quality=85)
        return 'data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
    except ImportError:raise ValueError('Photo uploads need Pillow installed. Built-in avatars are available now.')
    except Exception:raise ValueError('This photo could not be decoded. Choose a valid PNG, JPEG or WebP.')

def update_profile(path,user,values):
    name=values.get('display_name','').strip()
    if not 1<=len(name)<=60:raise ValueError('Display name must contain 1–60 characters.')
    current=user['profile'];updated=dict(current)
    for key,limit in [('bio',300),('university',100),('course',100),('email',150)]:
        if key in values:
            value=values[key]
            if not isinstance(value,str) or len(value)>limit:raise ValueError('Invalid '+key+'.')
            updated[key]=value.strip()
    for key,allowed in [('avatar',AVATARS),('theme',('system','light','dark')),('accent',('violet','blue','teal','rose')),('density',('comfortable','compact'))]:
        if key in values:
            if values[key] not in allowed:raise ValueError('Invalid '+key+'.')
            updated[key]=values[key]
    if 'photo' in values:updated['photo']=photo(values['photo'])
    with db(path) as con:con.execute('UPDATE users SET display_name=?,profile=? WHERE id=?',(name,json.dumps(updated),user['id']))

def change_password(path,user,old,new):
    if not verify(old,user['password']):raise ValueError('Current password is incorrect.')
    if old==new:raise ValueError('Choose a different new password.')
    hashed=password_hash(new)
    with db(path) as con:
        con.execute('UPDATE users SET password=?,must_change=0 WHERE id=?',(hashed,user['id']))
        con.execute('DELETE FROM sessions WHERE user_id=?',(user['id'],))
    if user['id']=='admin':(Path(path).parent/'ADMIN_FIRST_LOGIN.txt').unlink(missing_ok=True)

def create_user(path,values):
    name=str(values.get('username','')).strip().lower()
    if not re.fullmatch(r'[a-z0-9][a-z0-9_.-]{2,31}',name):raise ValueError('Username must be 3–32 letters, numbers, dots, underscores or hyphens.')
    display=str(values.get('display_name','')).strip()
    if not 1<=len(display)<=60:raise ValueError('Enter a display name of 1–60 characters.')
    role=values.get('role','student')
    if role not in ('student','admin'):raise ValueError('Invalid role.')
    ident=uuid.uuid4().hex;hashed=password_hash(values.get('password'))
    with db(path) as con:
        if con.execute('SELECT 1 FROM users WHERE username=?',(name,)).fetchone():raise ValueError('That username is already taken.')
        con.execute('INSERT INTO users(id,username,password,role,display_name,created_at) VALUES(?,?,?,?,?,?)',(ident,name,hashed,role,display,int(time.time())))
    return ident
