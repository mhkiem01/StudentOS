"""Shared Socialise repository. Uses account primary keys, never private workspaces.

Every read/write is authorised here; UI filtering is not a security boundary.
SQLite is appropriate for a small single-host deployment. All clients must use
the same host. Keep this repository boundary when moving to a server database.
"""
import base64,hashlib,json,math,sqlite3,uuid,threading,re
from datetime import datetime,timezone
from pathlib import Path
import accounts,social_live

LOCK=threading.RLock()
LIVE=social_live.Hub()  # in-memory calls and instant updates; see social_live.py
DEFAULT_ROOMS=(('text','general'),('voice','Lounge'))
class Forbidden(ValueError):pass
def now():return datetime.now(timezone.utc).isoformat()
def ident():return uuid.uuid4().hex
def encode(v):return json.dumps(v,ensure_ascii=False)
def text(v,n=2000):
    if not isinstance(v,str) or len(v)>n:raise ValueError('Text is missing or too long.')
    return v.strip()
def choice(v,options):
    if v not in options:raise ValueError('Invalid selection.')
    return v
def date(v):
    v=text(v or '',40)
    if v:
        try:datetime.fromisoformat(v)
        except ValueError:raise ValueError('Enter a valid date and time.')
    return v

DEFAULT={'enabled':False,'university':'','degree':'','year':'','bio':'','interests':'','subjects':[], 'discoverable':False,'show_university':False,'show_subjects':False,'subject_discovery':False,'friend_requests':True,'dm':'friends','show_online':False,'notifications':True}

def migrate(path):
    with LOCK,accounts.db(path) as c:
        if c.execute("SELECT 1 FROM sqlite_master WHERE name='social_profiles'").fetchone():return upgrade(c)
        folder=Path(path).parent/'backups';folder.mkdir(exist_ok=True)
        dest=sqlite3.connect(folder/('before-socialise-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))
        try:c.backup(dest)
        finally:dest.close()
        c.executescript('''BEGIN IMMEDIATE;
        CREATE TABLE social_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),data TEXT NOT NULL);
        CREATE TABLE social_links(sender TEXT REFERENCES users(id),recipient TEXT REFERENCES users(id),state TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(sender,recipient));
        CREATE TABLE social_blocks(user_id TEXT REFERENCES users(id),target TEXT REFERENCES users(id),PRIMARY KEY(user_id,target));
        CREATE TABLE social_spaces(id TEXT PRIMARY KEY,kind TEXT NOT NULL,owner TEXT REFERENCES users(id),name TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE social_members(space_id TEXT REFERENCES social_spaces(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id),state TEXT NOT NULL,role TEXT NOT NULL,PRIMARY KEY(space_id,user_id));
        CREATE TABLE social_messages(id TEXT PRIMARY KEY,space_id TEXT REFERENCES social_spaces(id) ON DELETE CASCADE,author TEXT REFERENCES users(id),body TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE social_notifications(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),kind TEXT NOT NULL,body TEXT NOT NULL,target TEXT,read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
        CREATE TABLE social_posts(id TEXT PRIMARY KEY,author TEXT REFERENCES users(id),space_id TEXT REFERENCES social_spaces(id) ON DELETE CASCADE,body TEXT NOT NULL,subject TEXT NOT NULL,audience TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE social_comments(id TEXT PRIMARY KEY,post_id TEXT REFERENCES social_posts(id) ON DELETE CASCADE,author TEXT REFERENCES users(id),body TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE social_likes(post_id TEXT REFERENCES social_posts(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id),PRIMARY KEY(post_id,user_id));
        CREATE TABLE social_events(id TEXT PRIMARY KEY,space_id TEXT REFERENCES social_spaces(id) ON DELETE CASCADE,author TEXT REFERENCES users(id),title TEXT NOT NULL,data TEXT NOT NULL);
        CREATE TABLE social_attendance(event_id TEXT REFERENCES social_events(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id),PRIMARY KEY(event_id,user_id));
        CREATE TABLE social_tasks(id TEXT PRIMARY KEY,space_id TEXT REFERENCES social_spaces(id) ON DELETE CASCADE,title TEXT NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE social_activity(id TEXT PRIMARY KEY,space_id TEXT REFERENCES social_spaces(id) ON DELETE CASCADE,actor TEXT REFERENCES users(id),kind TEXT NOT NULL,body TEXT NOT NULL,task_id TEXT,created_at TEXT NOT NULL);
        CREATE TABLE social_files(id TEXT PRIMARY KEY,space_id TEXT REFERENCES social_spaces(id) ON DELETE CASCADE,author TEXT REFERENCES users(id),name TEXT NOT NULL,description TEXT NOT NULL,content BLOB NOT NULL,created_at TEXT NOT NULL);
        CREATE INDEX social_message_space ON social_messages(space_id,created_at);
        CREATE INDEX social_activity_space ON social_activity(space_id,created_at);
        CREATE INDEX social_notice_user ON social_notifications(user_id,read);
        COMMIT;'''.replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ').replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS '))
        upgrade(c)

def upgrade(c):
    """Additive upgrades: text/call rooms in groups (old messages show in each group's first text room),
    message attachments (cards such as a shared note), live note shares and task log details."""
    columns=lambda:{r[1] for r in c.execute('PRAGMA table_info(social_messages)')}
    logged=lambda:{r[1] for r in c.execute('PRAGMA table_info(social_activity)')}
    have=lambda name:bool(c.execute("SELECT 1 FROM sqlite_master WHERE name=?",(name,)).fetchone())
    if have('social_rooms') and have('social_note_shares') and {'room_id','attachment'}<=columns() and 'data' in logged():return
    c.execute('BEGIN IMMEDIATE')
    c.execute('CREATE TABLE IF NOT EXISTS social_rooms(id TEXT PRIMARY KEY,space_id TEXT NOT NULL REFERENCES social_spaces(id) ON DELETE CASCADE,kind TEXT NOT NULL,name TEXT NOT NULL,position INTEGER NOT NULL,created_at TEXT NOT NULL)')
    c.execute('CREATE INDEX IF NOT EXISTS social_room_space ON social_rooms(space_id,position)')
    if 'room_id' not in {r[1] for r in c.execute('PRAGMA table_info(social_messages)')}:
        c.execute('ALTER TABLE social_messages ADD COLUMN room_id TEXT REFERENCES social_rooms(id) ON DELETE CASCADE')
    c.execute('CREATE INDEX IF NOT EXISTS social_message_room ON social_messages(room_id,created_at)')
    if 'attachment' not in columns():c.execute('ALTER TABLE social_messages ADD COLUMN attachment TEXT')
    # A note stays in its owner's workspace; this records who it is shared with and how.
    c.execute('CREATE TABLE IF NOT EXISTS social_note_shares(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),note_id TEXT NOT NULL,recipient TEXT NOT NULL REFERENCES users(id),permission TEXT NOT NULL,request TEXT,saved_subject TEXT,saved_topic TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(owner,note_id,recipient))')
    c.execute('CREATE INDEX IF NOT EXISTS social_note_share_recipient ON social_note_shares(recipient)')
    if 'data' not in logged():c.execute('ALTER TABLE social_activity ADD COLUMN data TEXT')
    c.execute('COMMIT')

def profile(c,u):
    r=c.execute('SELECT data FROM social_profiles WHERE user_id=?',(u,)).fetchone()
    return {**DEFAULT,**(json.loads(r[0]) if r else {})}
def blocked(c,a,b):return bool(c.execute('SELECT 1 FROM social_blocks WHERE (user_id=? AND target=?) OR (user_id=? AND target=?)',(a,b,b,a)).fetchone())
def friends(c,a,b):return bool(c.execute("SELECT 1 FROM social_links WHERE state='accepted' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))",(a,b,b,a)).fetchone())
def member(c,s,u):return c.execute("SELECT * FROM social_members WHERE space_id=? AND user_id=? AND state='active'",(s,u)).fetchone()
def space(c,s,u,manage=False):
    r=c.execute('SELECT * FROM social_spaces WHERE id=?',(s,)).fetchone()
    if not r or not member(c,s,u) or (manage and r['owner']!=u):raise Forbidden('Only an authorised member can access this workspace.')
    return {**dict(r),'data':json.loads(r['data'])}
def notify(c,u,kind,body,target=''):
    p=profile(c,u)
    if p['notifications'] and p.get('notify_'+kind,True):c.execute('INSERT INTO social_notifications(id,user_id,kind,body,target,created_at) VALUES(?,?,?,?,?,?)',(ident(),u,kind,body,target,now()))
def activity(c,s,u,kind,body,task=None,details=None):c.execute('INSERT INTO social_activity(id,space_id,actor,kind,body,task_id,created_at,data) VALUES(?,?,?,?,?,?,?,?)',(ident(),s,u,kind,body,task,now(),encode(details) if details else None))
def task_positions(c,s):
    """Board order: a task's saved position, or its creation order for tasks made before ordering existed."""
    out={}
    for i,r in enumerate(c.execute('SELECT id,data FROM social_tasks WHERE space_id=? ORDER BY rowid',(s,)).fetchall()):
        p=json.loads(r['data']).get('position');out[r['id']]=p if isinstance(p,(int,float)) and not isinstance(p,bool) else float(i)
    return out
def log_status(c,s,u,key,title,before,after):
    """Record a status change as its own log entry: moved, or completed when it reaches Done."""
    done=after=='done'
    activity(c,s,u,'task_done' if done else 'task_status',('Completed task: ' if done else 'Moved task: ')+title+' · '+before+' → '+after,key,{'title':title,'from':before,'to':after})
def audience(c,s):return [r[0] for r in c.execute("SELECT user_id FROM social_members WHERE space_id=? AND state='active'",(s,))]
def announce(c,s,u,kind,body):
    for recipient in audience(c,s):
        if recipient!=u and not blocked(c,u,recipient):notify(c,recipient,kind,body,s)
def hexid(v,label='ID'):
    if not isinstance(v,str) or not re.fullmatch(r'[a-f0-9]{32}',v):raise ValueError('Invalid '+label+'.')
    return v
def rooms(c,s):
    """A group's rooms in order. Every group starts with # general and the Lounge call room."""
    rows=[dict(r) for r in c.execute('SELECT id,kind,name,position FROM social_rooms WHERE space_id=? ORDER BY position,created_at',(s,))]
    if rows:return rows
    for i,(kind,name) in enumerate(DEFAULT_ROOMS):
        c.execute('INSERT OR IGNORE INTO social_rooms VALUES(?,?,?,?,?,?)',(hashlib.sha256(('room:'+s+':'+kind).encode()).hexdigest()[:32],s,kind,name,i,now()))
    return [dict(r) for r in c.execute('SELECT id,kind,name,position FROM social_rooms WHERE space_id=? ORDER BY position,created_at',(s,))]
def text_room(c,s,room=None):
    texts=[r for r in rooms(c,s) if r['kind']=='text']
    chosen=next((r for r in texts if r['id']==room),None) if room else texts[0]
    if not chosen:raise ValueError('That text room no longer exists.')
    return chosen,chosen['id']==texts[0]['id']
def dm_allowed(c,u,v):
    target(c,u,v);policy=profile(c,v)['dm']
    shared=c.execute("SELECT 1 FROM social_members a JOIN social_members b ON a.space_id=b.space_id JOIN social_spaces s ON a.space_id=s.id WHERE a.user_id=? AND b.user_id=? AND a.state='active' AND b.state='active' AND s.kind!='dm'",(u,v)).fetchone()
    if policy=='nobody' or not (friends(c,u,v) or policy=='members' and shared):raise Forbidden('Direct messaging is not allowed by this person’s privacy settings.')
def target(c,u,v):
    r=c.execute('SELECT id FROM users WHERE id=? AND disabled=0',(v,)).fetchone()
    if not r or u==v or blocked(c,u,v) or not profile(c,v)['enabled']:raise Forbidden('This person is not available.')
def public(c,u,viewer):
    r=c.execute('SELECT id,display_name,profile FROM users WHERE id=? AND disabled=0',(u,)).fetchone()
    if not r:return {'id':u,'name':'Unavailable account','avatar':'graduate'}
    p=profile(c,u);a=json.loads(r['profile'])
    # Explicit allowlist: never serialize users.*, account email or workspace data.
    return {'id':u,'name':r['display_name'],'avatar':a.get('avatar','graduate'),'photo':a.get('photo'),'university':p['university'] if p['show_university'] or u==viewer else '', 'subjects':p['subjects'] if p['show_subjects'] or u==viewer else [],'degree':p['degree'],'year':p['year'],'bio':p['bio'],'interests':p['interests'],'subject_discovery':p['subject_discovery']}
def visible_space(c,r,u):
    if member(c,r['id'],u):return True
    return r['kind'] in ('club','study') and not blocked(c,u,r['owner'])
def visible_post(c,r,u):
    if blocked(c,u,r['author']):return False
    if r['space_id']:return bool(member(c,r['space_id'],u))
    return r['audience']=='public' or r['author']==u or friends(c,u,r['author'])

def state(path,u,query=None):
    migrate(path)
    with accounts.db(path) as c:
        p=profile(c,u);result={'profile':p,'me':public(c,u,u)}
        if not p['enabled']:return result
        people=[]
        for r in c.execute('SELECT p.user_id FROM social_profiles p JOIN users u ON u.id=p.user_id WHERE u.disabled=0'):
            v=r[0];other=profile(c,v)
            if v!=u and other['enabled'] and (other['discoverable'] or friends(c,u,v)) and not blocked(c,u,v):people.append(public(c,v,u))
        links=[dict(r) for r in c.execute('SELECT * FROM social_links WHERE sender=? OR recipient=?',(u,u)) if not blocked(c,r['sender'],r['recipient'])]
        ids={u}|{r['sender'] for r in links}|{r['recipient'] for r in links}
        spaces=[]
        for raw in c.execute('SELECT * FROM social_spaces ORDER BY created_at DESC').fetchall():
            if not visible_space(c,raw,u) and not c.execute("SELECT 1 FROM social_members WHERE space_id=? AND user_id=? AND state='invited'",(raw['id'],u)).fetchone():continue
            r=dict(raw);r['data']=json.loads(r['data']);m=member(c,r['id'],u);r['joined']=bool(m)
            r['membership']=dict(c.execute('SELECT * FROM social_members WHERE space_id=? AND user_id=?',(r['id'],u)).fetchone() or {})
            r['count']=len(audience(c,r['id']));r['members']=[];r['tasks']=[];r['activity']=[];r['files']=[];r['rooms']=[];r['calls']={}
            if m:
                r['rooms']=rooms(c,r['id']) if r['kind']!='dm' else []
                r['calls']=LIVE.presence([x['id'] for x in r['rooms'] if x['kind']=='voice'] if r['kind']!='dm' else [r['id']])
                r['members']=[dict(x) for x in c.execute('SELECT * FROM social_members WHERE space_id=?',(r['id'],)) if x['state']=='active' or r['owner']==u or x['user_id']==u]
                ids|={x['user_id'] for x in r['members']}
                if r['kind']=='project':
                    order=task_positions(c,r['id'])
                    r['tasks']=[{**dict(x),'data':{**json.loads(x['data']),'position':order[x['id']]}} for x in c.execute('SELECT * FROM social_tasks WHERE space_id=? ORDER BY rowid',(r['id'],))]
                    r['activity']=[{**dict(x),'data':json.loads(x['data']) if x['data'] else {}} for x in c.execute('SELECT * FROM social_activity WHERE space_id=? ORDER BY created_at DESC,rowid DESC LIMIT 400',(r['id'],))]
                    r['files']=[dict(x) for x in c.execute('SELECT id,space_id,author,name,description,created_at FROM social_files WHERE space_id=?',(r['id'],))]
                    r['contributions']=[dict(x) for x in c.execute('SELECT actor,COUNT(*) AS actions FROM social_activity WHERE space_id=? GROUP BY actor',(r['id'],))]
                    ids|={x['actor'] for x in r['activity']}
            elif r['kind']=='project':r['data']={'description':'Invitation to a private project.'}
            spaces.append(r)
        posts=[]
        for raw in c.execute('SELECT * FROM social_posts ORDER BY created_at DESC LIMIT 500'):
            if not visible_post(c,raw,u):continue
            r=dict(raw);r['likes']=c.execute('SELECT COUNT(*) FROM social_likes WHERE post_id=?',(r['id'],)).fetchone()[0];r['liked']=bool(c.execute('SELECT 1 FROM social_likes WHERE post_id=? AND user_id=?',(r['id'],u)).fetchone())
            r['comments']=[dict(x) for x in c.execute('SELECT * FROM social_comments WHERE post_id=? ORDER BY created_at',(r['id'],)) if not blocked(c,u,x['author'])]
            ids.add(r['author']);ids|={x['author'] for x in r['comments']};posts.append(r)
        events=[]
        for r in c.execute('SELECT * FROM social_events'):
            if blocked(c,u,r['author']) or (r['space_id'] and not member(c,r['space_id'],u)):continue
            events.append({**dict(r),'data':json.loads(r['data']),'attending':bool(c.execute('SELECT 1 FROM social_attendance WHERE event_id=? AND user_id=?',(r['id'],u)).fetchone()),'count':c.execute('SELECT COUNT(*) FROM social_attendance WHERE event_id=?',(r['id'],)).fetchone()[0]})
        result.update(people=people,links=links,spaces=spaces,posts=posts[:100],events=events,users=[public(c,v,u) for v in ids if not blocked(c,u,v)],notifications=[dict(r) for r in c.execute('SELECT * FROM social_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 200',(u,))],blocks=[r[0] for r in c.execute('SELECT target FROM social_blocks WHERE user_id=?',(u,))])
        return result

def messages(path,u,s,room=None):
    with accounts.db(path) as c:
        if not profile(c,u)['enabled']:raise Forbidden('Enable Socialise in Settings.')
        if space(c,s,u)['kind']=='dm':query,args='space_id=?',(s,)
        else:
            chosen,first=text_room(c,s,room and hexid(room,'room'))
            # Messages saved before rooms existed belong to the group's first text room.
            query,args=('space_id=? AND (room_id=? OR room_id IS NULL)' if first else 'space_id=? AND room_id=?'),(s,chosen['id']);room=chosen['id']
        rows=[dict(r) for r in c.execute('SELECT * FROM social_messages WHERE '+query+' ORDER BY created_at DESC LIMIT 200',args) if not blocked(c,u,r['author'])]
        return {'messages':list(reversed(rows)),'room':room}

def write(path,u,payload):
    after=[];result=_write(path,u,payload,after)
    for task in after:task()
    return result

def _write(path,u,payload,after):
    migrate(path);action=payload.get('action');d=payload.get('data') or {};key=payload.get('id') or None;stamp=now()
    if key is not None and (not isinstance(key,str) or not re.fullmatch(r'[a-f0-9]{32}',key)):
        raise ValueError('Invalid Socialise record ID.')
    with accounts.db(path) as c:
        c.execute('BEGIN IMMEDIATE');p=profile(c,u)
        if action=='profile':
            for k in ('enabled','discoverable','show_university','show_subjects','subject_discovery','friend_requests','show_online','notifications'):
                if k in d:
                    if not isinstance(d[k],bool):raise ValueError('Invalid privacy setting.')
                    p[k]=d[k]
            for k in ('university','degree','year','bio','interests'):
                if k in d:p[k]=text(d[k],500)
            for k in ('friend_request','friend_accepted','message','call','note','club','study','project','task','event'):
                if 'notify_'+k in d:p['notify_'+k]=bool(d['notify_'+k])
            if 'subjects' in d:
                if not isinstance(d['subjects'],list) or len(d['subjects'])>30:raise ValueError('Choose at most 30 public subject labels.')
                p['subjects']=list(dict.fromkeys(text(v,100) for v in d['subjects'] if v))
            if 'dm' in d:p['dm']=choice(d['dm'],('friends','members','nobody'))
            c.execute('INSERT OR REPLACE INTO social_profiles VALUES(?,?)',(u,encode(p)));return {'ok':True}
        if not p['enabled']:raise Forbidden('Enable Socialise in Settings first.')
        if action=='friend':
            v=text(d.get('user_id'),80);target(c,u,v);op=d.get('operation')
            if op=='request':
                if not profile(c,v)['friend_requests']:raise Forbidden('This person is not accepting requests.')
                if not profile(c,v)['discoverable'] and not friends(c,u,v):raise Forbidden('This person is not discoverable.')
                if c.execute('SELECT 1 FROM social_links WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',(u,v,v,u)).fetchone():raise ValueError('A connection or request already exists.')
                c.execute('INSERT INTO social_links VALUES(?,?,?,?)',(u,v,'pending',stamp));notify(c,v,'friend_request','You have a new friend request.',u)
            elif op in ('accept','decline'):
                r=c.execute("SELECT 1 FROM social_links WHERE sender=? AND recipient=? AND state='pending'",(v,u)).fetchone()
                if not r:raise Forbidden('No incoming request.')
                if op=='accept':c.execute("UPDATE social_links SET state='accepted' WHERE sender=? AND recipient=?",(v,u));notify(c,v,'friend_accepted','Your friend request was accepted.',u)
                else:c.execute('DELETE FROM social_links WHERE sender=? AND recipient=?',(v,u))
            elif op=='cancel':c.execute("DELETE FROM social_links WHERE sender=? AND recipient=? AND state='pending'",(u,v))
            elif op=='remove':c.execute("DELETE FROM social_links WHERE state='accepted' AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))",(u,v,v,u))
            else:raise ValueError('Unknown connection action.')
        elif action=='block':
            v=text(d.get('user_id'),80)
            if d.get('remove'):c.execute('DELETE FROM social_blocks WHERE user_id=? AND target=?',(u,v))
            else:
                target(c,u,v);c.execute('INSERT OR IGNORE INTO social_blocks VALUES(?,?)',(u,v));c.execute('DELETE FROM social_links WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',(u,v,v,u))
                dm=c.execute("SELECT id FROM social_spaces WHERE kind='dm' AND name=?",('dm:'+':'.join(sorted([u,v])),)).fetchone()
                if dm:after.append(lambda:LIVE.end(dm[0],'blocked'))
        elif action=='space':
            previous=space(c,key,u,True) if key else None
            kind=previous['kind'] if previous else choice(d.get('kind'),('club','study','project','chat'))
            name=text(d.get('name'),120)
            if not name:raise ValueError('Enter a name.')
            data={k:text(d.get(k,''),3000 if k in ('description','rules') else 120) for k in ('description','subject','topic','university','category','rules','icon')}
            data.update(private=bool(d.get('private',False)) or kind in ('project','chat'),due=date(d.get('due')),status=choice(d.get('status','planning'),('planning','in_progress','review','completed')),type=choice(d.get('type','general'),('assignment','group','club','general')),review=bool(d.get('review',True)))
            key=key or ident()
            if previous:c.execute('UPDATE social_spaces SET name=?,data=? WHERE id=?',(name,encode(data),key))
            else:c.execute('INSERT INTO social_spaces VALUES(?,?,?,?,?,?)',(key,kind,u,name,encode(data),stamp));c.execute('INSERT INTO social_members VALUES(?,?,?,?)',(key,u,'active','Team Lead' if kind=='project' else 'Owner'))
        elif action=='membership':
            r=c.execute('SELECT * FROM social_spaces WHERE id=?',(key,)).fetchone()
            if not r or blocked(c,u,r['owner']) or r['kind']=='dm':raise Forbidden('Workspace not available.')
            op=d.get('operation');v=d.get('user_id',u);mine=c.execute('SELECT * FROM social_members WHERE space_id=? AND user_id=?',(key,u)).fetchone()
            if op=='join':
                if r['kind'] not in ('club','study'):raise Forbidden('An invitation is required.')
                if mine:raise ValueError('You already have a membership or request.')
                status='requested' if json.loads(r['data']).get('private') else 'active';c.execute('INSERT INTO social_members VALUES(?,?,?,?)',(key,u,status,'Member'));notify(c,r['owner'],r['kind'],'A student '+('requested to join ' if status=='requested' else 'joined ')+r['name'],key)
            elif op=='accept_invite':
                if not mine or mine['state']!='invited':raise Forbidden('No invitation.')
                c.execute("UPDATE social_members SET state='active' WHERE space_id=? AND user_id=?",(key,u))
            elif op=='leave':
                if r['owner']==u:raise ValueError('Transfer ownership before leaving.')
                c.execute('DELETE FROM social_members WHERE space_id=? AND user_id=?',(key,u));after.append(lambda:LIVE.kick(key,u))
            else:
                space(c,key,u,True)
                if op=='invite':
                    target(c,u,v)
                    if not friends(c,u,v):raise Forbidden('Invite an accepted friend.')
                    c.execute('INSERT OR IGNORE INTO social_members VALUES(?,?,?,?)',(key,v,'invited','Member'));notify(c,v,r['kind'],'Invitation: '+r['name'],key)
                elif op in ('approve','decline'):
                    if not c.execute("SELECT 1 FROM social_members WHERE space_id=? AND user_id=? AND state='requested'",(key,v)).fetchone():raise ValueError('No pending join request.')
                    if op=='approve':c.execute("UPDATE social_members SET state='active' WHERE space_id=? AND user_id=?",(key,v));notify(c,v,r['kind'],'Your membership was approved: '+r['name'],key)
                    else:c.execute('DELETE FROM social_members WHERE space_id=? AND user_id=?',(key,v))
                elif op=='remove':
                    if v==r['owner']:raise ValueError('Cannot remove the owner.')
                    c.execute('DELETE FROM social_members WHERE space_id=? AND user_id=?',(key,v));after.append(lambda:LIVE.kick(key,v))
                elif op in ('role','transfer'):
                    if not member(c,key,v):raise ValueError('Choose an active member.')
                    if op=='transfer':c.execute('UPDATE social_spaces SET owner=? WHERE id=?',(v,key))
                    else:c.execute('UPDATE social_members SET role=? WHERE space_id=? AND user_id=?',(text(d.get('role'),60),key,v))
                else:raise ValueError('Invalid membership operation.')
        elif action=='dm':
            v=d.get('user_id');dm_allowed(c,u,v)
            name='dm:'+':'.join(sorted([u,v]));r=c.execute("SELECT id FROM social_spaces WHERE kind='dm' AND name=?",(name,)).fetchone();key=r[0] if r else ident()
            if not r:
                c.execute('INSERT INTO social_spaces VALUES(?,?,?,?,?,?)',(key,'dm',u,name,'{}',stamp))
                for who in (u,v):c.execute('INSERT INTO social_members VALUES(?,?,?,?)',(key,who,'active','Member'))
        elif action=='message':
            s=space(c,key,u);body=text(d.get('body'),5000)
            if not body:raise ValueError('Enter a message.')
            room=None
            if s['kind']=='dm':
                for v in audience(c,key):
                    if v!=u:
                        try:dm_allowed(c,u,v)
                        except Forbidden:raise Forbidden('Direct messaging is no longer allowed.')
            else:room=text_room(c,key,d.get('room_id') and hexid(d.get('room_id'),'room'))[0]['id']
            c.execute('INSERT INTO social_messages(id,space_id,author,body,created_at,room_id) VALUES(?,?,?,?,?,?)',(ident(),key,u,body,stamp,room));announce(c,key,u,'message','New message in '+('your conversation' if s['kind']=='dm' else s['name']))
            members=audience(c,key);after.append(lambda:LIVE.post(members,{'type':'message','space':key,'room':room}))
        elif action=='message_delete':
            r=c.execute('SELECT space_id,room_id FROM social_messages WHERE id=? AND author=?',(key,u)).fetchone()
            c.execute('DELETE FROM social_messages WHERE id=? AND author=?',(key,u))
            if r:members=audience(c,r['space_id']);after.append(lambda:LIVE.post(members,{'type':'message','space':r['space_id'],'room':r['room_id']}))
        elif action in ('room','room_delete'):
            s=space(c,key,u,True)
            if s['kind']=='dm':raise ValueError('Direct conversations do not have rooms.')
            existing=rooms(c,key);room=next((r for r in existing if r['id']==d.get('room_id')),None)
            if d.get('room_id') and not room:raise ValueError('That room no longer exists.')
            if action=='room':
                name=text(d.get('name'),60)
                if not name:raise ValueError('Enter a room name.')
                if room:c.execute('UPDATE social_rooms SET name=? WHERE id=?',(name,room['id']))
                else:
                    if len(existing)>=30:raise ValueError('A group can have up to 30 rooms.')
                    c.execute('INSERT INTO social_rooms VALUES(?,?,?,?,?,?)',(ident(),key,choice(d.get('kind'),('text','voice')),name,max(r['position'] for r in existing)+1,stamp))
            else:
                if not room:raise ValueError('Choose a room to delete.')
                texts=[r for r in existing if r['kind']=='text']
                if room['kind']=='text':
                    if len(texts)==1:raise ValueError('A group needs at least one text room.')
                    if room['id']==texts[0]['id']:c.execute('DELETE FROM social_messages WHERE space_id=? AND room_id IS NULL',(key,))
                c.execute('DELETE FROM social_rooms WHERE id=?',(room['id'],))
                if room['kind']=='voice':after.append(lambda:LIVE.end(room['id'],'deleted'))
            members=audience(c,key);after.append(lambda:LIVE.post(members,{'type':'rooms','space':key}))
        elif action=='read':
            if key:c.execute('UPDATE social_notifications SET read=1 WHERE user_id=? AND (id=? OR target=?)',(u,key,key))
            else:c.execute('UPDATE social_notifications SET read=1 WHERE user_id=?',(u,))
        elif action=='post':
            s=d.get('space_id') or None
            if s:space(c,s,u)
            body=text(d.get('body'),5000)
            if not body:raise ValueError('Write something to share.')
            c.execute('INSERT INTO social_posts VALUES(?,?,?,?,?,?,?)',(ident(),u,s,body,text(d.get('subject',''),100),choice(d.get('audience','friends'),('public','friends')),stamp))
        elif action in ('like','comment','post_delete'):
            r=c.execute('SELECT * FROM social_posts WHERE id=?',(key,)).fetchone()
            if not r or not visible_post(c,r,u):raise Forbidden('Post unavailable.')
            if action=='post_delete':
                if r['author']!=u:raise Forbidden('Only the author can delete this post.')
                c.execute('DELETE FROM social_posts WHERE id=?',(key,))
            elif action=='like':
                if c.execute('SELECT 1 FROM social_likes WHERE post_id=? AND user_id=?',(key,u)).fetchone():c.execute('DELETE FROM social_likes WHERE post_id=? AND user_id=?',(key,u))
                else:c.execute('INSERT INTO social_likes VALUES(?,?)',(key,u))
            else:
                body=text(d.get('body'),2000)
                if not body:raise ValueError('Enter a comment.')
                c.execute('INSERT INTO social_comments VALUES(?,?,?,?,?)',(ident(),key,u,body,stamp))
        elif action in ('event','event_delete','attend'):
            r=c.execute('SELECT * FROM social_events WHERE id=?',(key,)).fetchone() if key else None
            s=r['space_id'] if r else d.get('space_id') or None
            if s:space(c,s,u)
            if action=='attend':
                if not r or blocked(c,u,r['author']):raise Forbidden('Event unavailable.')
                if c.execute('SELECT 1 FROM social_attendance WHERE event_id=? AND user_id=?',(key,u)).fetchone():c.execute('DELETE FROM social_attendance WHERE event_id=? AND user_id=?',(key,u))
                else:c.execute('INSERT INTO social_attendance VALUES(?,?)',(key,u))
            else:
                if r and r['author']!=u and (not s or space(c,s,u)['owner']!=u):raise Forbidden('Only the organiser or owner can change this event.')
                if action=='event_delete':c.execute('DELETE FROM social_events WHERE id=?',(key,))
                else:
                    title=text(d.get('title'),160);start=date(d.get('start'));end=date(d.get('end'))
                    if not title or not start:raise ValueError('Enter an event title and start date/time.')
                    if end and end<=start:raise ValueError('End must follow start.')
                    data={'start':start,'end':end,'location':text(d.get('location',''),500),'description':text(d.get('description',''),3000),'kind':choice(d.get('kind','event'),('event','meeting','milestone'))}
                    key=key or ident()
                    if r:c.execute('UPDATE social_events SET title=?,data=? WHERE id=?',(title,encode(data),key))
                    else:c.execute('INSERT INTO social_events VALUES(?,?,?,?,?)',(key,s,u,title,encode(data)))
                    if s:announce(c,s,u,'event','Event updated: '+title)
        elif action=='task':
            previous=c.execute('SELECT * FROM social_tasks WHERE id=?',(key,)).fetchone() if key else None
            s=previous['space_id'] if previous else d.get('space_id');room=space(c,s,u)
            if room['kind']!='project':raise ValueError('Tasks belong to a project.')
            if previous and d.get('updated_at')!=previous['updated_at']:raise ValueError('This task changed. Reopen it before saving.')
            title=text(d.get('title'),160)
            if not title:raise ValueError('Enter a task title.')
            status=choice(d.get('status','todo'),('todo','in_progress','review','done'))
            if status=='review' and not room['data'].get('review',True):raise ValueError('Review is disabled for this project.')
            assigned=d.get('assigned',[])
            if not isinstance(assigned,list) or any(not member(c,s,v) for v in assigned):raise ValueError('Assign only active project members.')
            checklist=d.get('checklist',[])
            if not isinstance(checklist,list) or len(checklist)>50:raise ValueError('Use at most 50 checklist items.')
            checklist=[{'text':text(v.get('text'),200),'done':bool(v.get('done'))} for v in checklist]
            data={'description':text(d.get('description',''),3000),'status':status,'priority':choice(d.get('priority','medium'),('low','medium','high','urgent')),'due':date(d.get('due')),'assigned':assigned,'checklist':checklist}
            old=json.loads(previous['data']) if previous else {};key=key or ident()
            data.update({k:old[k] for k in ('created_by','position') if k in old} if previous else {'created_by':u,'position':max(task_positions(c,s).values(),default=-1.0)+1})
            if previous:
                if old==data and title==previous['title']:return {'ok':True,'id':key}
                c.execute('UPDATE social_tasks SET title=?,data=?,updated_at=? WHERE id=?',(title,encode(data),stamp,key))
            else:c.execute('INSERT INTO social_tasks VALUES(?,?,?,?,?)',(key,s,title,encode(data),stamp))
            fields=[label for name,label in (('description','description'),('priority','priority'),('due','due date'),('assigned','assignees'),('checklist','checklist')) if previous and old.get(name)!=data[name]]+(['title'] if previous and title!=previous['title'] else [])
            if not previous:activity(c,s,u,'task_created','Created task: '+title,key,{'title':title,'to':status})
            elif old.get('status')!=status:log_status(c,s,u,key,title,old.get('status','todo'),status)
            if previous and fields:activity(c,s,u,'task_updated','Updated task: '+title+' · '+', '.join(fields),key,{'title':title,'fields':fields})
            for v in assigned:
                if v!=u and (v not in old.get('assigned',[]) or status!=old.get('status')):notify(c,v,'task','Task '+status+': '+title,s)
        elif action=='task_move':
            # Dragging a card: only its column (status) and place in the column change.
            previous=c.execute('SELECT * FROM social_tasks WHERE id=?',(key,)).fetchone()
            if not previous:raise ValueError('This task no longer exists. Refresh the board.')
            s=previous['space_id'];room=space(c,s,u);status=choice(d.get('status'),('todo','in_progress','review','done'))
            if status=='review' and not room['data'].get('review',True):raise ValueError('Review is disabled for this project.')
            position=d.get('position')
            if isinstance(position,bool) or not isinstance(position,(int,float)) or not math.isfinite(position) or abs(position)>1e12:raise ValueError('Invalid board position.')
            data=json.loads(previous['data']);before=data.get('status','todo');data.update(status=status,position=float(position))
            c.execute('UPDATE social_tasks SET data=?,updated_at=? WHERE id=?',(encode(data),stamp,key))
            if before!=status:
                log_status(c,s,u,key,previous['title'],before,status)
                for v in data.get('assigned',[]):
                    if v!=u:notify(c,v,'task','Task '+status+': '+previous['title'],s)
        elif action=='task_delete':
            previous=c.execute('SELECT * FROM social_tasks WHERE id=?',(key,)).fetchone()
            if not previous:raise ValueError('This task no longer exists. Refresh the board.')
            s=previous['space_id'];room=space(c,s,u);data=json.loads(previous['data'])
            creator=data.get('created_by') or (c.execute("SELECT actor FROM social_activity WHERE task_id=? AND kind IN ('task','task_created') ORDER BY created_at LIMIT 1",(key,)).fetchone() or [None])[0]
            if u not in (room['owner'],creator):raise Forbidden('Only the project owner or the person who created this task can delete it.')
            c.execute('DELETE FROM social_tasks WHERE id=?',(key,))
            activity(c,s,u,'task_deleted','Deleted task: '+previous['title'],key,{'title':previous['title'],'from':data.get('status','todo')})
        elif action=='file':
            room=space(c,key,u)
            if room['kind']!='project':raise ValueError('Files belong to projects.')
            name=Path(text(d.get('name'),160)).name
            if Path(name).suffix.lower() not in ('.pdf','.txt','.md','.csv','.json','.py','.js','.java','.c','.h','.sql','.png','.jpg','.jpeg','.webp','.pptx','.docx','.xlsx','.zip'):raise ValueError('Unsupported file type.')
            raw=d.get('base64','')
            if not isinstance(raw,str) or len(raw)>2800000:raise ValueError('Files must be at most 2 MB.')
            try:blob=base64.b64decode(raw,validate=True)
            except Exception:raise ValueError('Invalid file data.')
            if not blob or len(blob)>2097152:raise ValueError('Files must be 1 byte–2 MB.')
            if c.execute('SELECT COALESCE(SUM(length(content)),0) FROM social_files WHERE space_id=?',(key,)).fetchone()[0]+len(blob)>52428800:raise ValueError('This project has reached its 50 MB file limit.')
            c.execute('INSERT INTO social_files VALUES(?,?,?,?,?,?,?)',(ident(),key,u,name,text(d.get('description',''),500),blob,stamp));activity(c,key,u,'file','Uploaded '+name)
        else:raise ValueError('Unknown Socialise action.')
        return {'ok':True,'id':key}

def call(path,u,payload):
    """Join, leave and run calls. Group calls happen in call rooms; direct calls ring the other person."""
    op=payload.get('op')
    with accounts.db(path) as c:
        if not profile(c,u)['enabled']:raise Forbidden('Enable Socialise in Settings first.')
        if op=='join':
            s=space(c,hexid(payload.get('space'),'conversation'),u)
            if s['kind']=='dm':
                others=[v for v in audience(c,s['id']) if v!=u]
                for v in others:dm_allowed(c,u,v)
                joined=LIVE.join(s['id'],u,s['id'],None,'dm',audience(c,s['id']))
                if payload.get('ring') and others and LIVE.ring(u,joined['peer'],others[0],bool(payload.get('video'))):
                    name=c.execute('SELECT display_name FROM users WHERE id=?',(u,)).fetchone()[0]
                    notify(c,others[0],'call',name+(' video called you.' if payload.get('video') else ' called you.'),s['id'])
                return joined
            room=next((r for r in rooms(c,s['id']) if r['id']==payload.get('room') and r['kind']=='voice'),None)
            if not room:raise ValueError('That call room no longer exists.')
            return LIVE.join(room['id'],u,s['id'],room['id'],'room',audience(c,s['id']))
        if op=='decline':LIVE.decline(u,hexid(payload.get('call'),'call'));return {'ok':True}
        peer=hexid(payload.get('peer'),'call connection')
        if op=='leave':LIVE.leave(u,peer);return {'ok':True}
        try:info=LIVE.info(u,peer)
        except social_live.Ended as exc:raise Forbidden(str(exc))
        space(c,info['space'],u)  # still a member of the group or conversation
    if op=='signal':LIVE.signal(u,peer,payload.get('messages'))
    elif op=='media':LIVE.media(u,peer,payload.get('media'))
    elif op=='watch':return {'watch':LIVE.watch(u,peer,payload.get('action'),payload)}
    else:raise ValueError('Unknown call action.')
    return {'ok':True}

def live(path,u,cursor=None,peer=None,epoch=None,timeout=social_live.WAIT):
    """Long-poll for instant updates. Without a cursor (or after a server restart) returns a fresh starting point."""
    with accounts.db(path) as c:
        if not profile(c,u)['enabled']:raise Forbidden('Enable Socialise in Settings first.')
    if peer is not None:hexid(peer,'call connection')
    if cursor is None or epoch!=LIVE.epoch:return LIVE.snapshot(u)
    return LIVE.wait(u,cursor,timeout,peer)

def download(path,u,key):
    with accounts.db(path) as c:
        if not profile(c,u)['enabled']:raise Forbidden('Enable Socialise first.')
        r=c.execute('SELECT * FROM social_files WHERE id=?',(key,)).fetchone()
        if not r:raise Forbidden('File unavailable.')
        space(c,r['space_id'],u);return r['content'],r['name']
