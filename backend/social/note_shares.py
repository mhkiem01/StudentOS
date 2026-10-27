"""Live note sharing between friends.

The note itself stays in its owner's private workspace. This module keeps who it is shared with
(in the shared accounts database), reads and saves the note for friends who may see or edit it,
posts the share into the friends' direct messages, and tells everyone who has the note open when
it changes (through the Socialise live channel).

`ws(user_id)` is supplied by the server: it returns that user's workspace database path, ready to use.
"""
import json,re,sqlite3,uuid
from contextlib import closing
import accounts,social_store,notes_store,note_document

Forbidden=social_store.Forbidden
OWN_IMAGE=re.compile(r'/api/notes/images/([a-f0-9]{32}\.(?:png|jpg|webp))')
PERMISSIONS=('view','edit')

def ident():return uuid.uuid4().hex
def to_share(content,share):return OWN_IMAGE.sub(lambda m:f'/api/note-shares/{share}/images/{m.group(1)}',content or '')
def from_share(content,share):return re.sub(r'/api/note-shares/'+share+r'/images/([a-f0-9]{32}\.(?:png|jpg|webp))',r'/api/notes/images/\1',content or '')
def workspace(ws,user):
    con=sqlite3.connect(ws(user),timeout=20);con.row_factory=sqlite3.Row;con.execute('PRAGMA foreign_keys=ON');return con
def note(ws,owner,note_id):
    with closing(workspace(ws,owner)) as w:
        r=w.execute('SELECT * FROM notes WHERE id=?',(note_id,)).fetchone()
        return dict(r) if r else None
def name(c,u):
    r=c.execute('SELECT display_name FROM users WHERE id=?',(u,)).fetchone()
    return r[0] if r else 'A friend'
def share(c,key,u):
    r=c.execute('SELECT * FROM social_note_shares WHERE id=?',(key,)).fetchone() if isinstance(key,str) else None
    if not r or u not in (r['owner'],r['recipient']):raise Forbidden('This note is no longer shared with you.')
    return dict(r)
def enabled(c,u):
    if not social_store.profile(c,u)['enabled']:raise Forbidden('Turn on Socialise in Settings to share notes with friends.')
def message(c,owner,recipient,author,body,attachment):
    """Post a card into the direct conversation between two friends."""
    dm='dm:'+':'.join(sorted([owner,recipient]))
    r=c.execute("SELECT id FROM social_spaces WHERE kind='dm' AND name=?",(dm,)).fetchone()
    key=r[0] if r else ident()
    if not r:
        c.execute('INSERT INTO social_spaces VALUES(?,?,?,?,?,?)',(key,'dm',owner,dm,'{}',social_store.now()))
        for who in (owner,recipient):c.execute('INSERT INTO social_members VALUES(?,?,?,?)',(key,who,'active','Member'))
    c.execute('INSERT INTO social_messages(id,space_id,author,body,created_at,room_id,attachment) VALUES(?,?,?,?,?,?,?)',(ident(),key,author,body,social_store.now(),None,json.dumps(attachment)))
    return key
def ping(after,users,event):after.append(lambda:social_store.LIVE.post(users,event))

def state(path,ws,u):
    social_store.migrate(path)
    with accounts.db(path) as c:
        if not social_store.profile(c,u)['enabled']:return {'enabled':False,'owned':[],'received':[],'friends':[]}
        friends=[]
        for r in c.execute("SELECT sender,recipient FROM social_links WHERE state='accepted' AND (sender=? OR recipient=?)",(u,u)).fetchall():
            v=r['recipient'] if r['sender']==u else r['sender']
            if not social_store.blocked(c,u,v) and social_store.profile(c,v)['enabled']:friends.append(social_store.public(c,v,u))
        owned=[{**dict(r),'recipient_name':name(c,r['recipient'])} for r in c.execute('SELECT * FROM social_note_shares WHERE owner=? ORDER BY created_at',(u,))]
        received=[{**dict(r),'owner_name':name(c,r['owner'])} for r in c.execute('SELECT * FROM social_note_shares WHERE recipient=? ORDER BY updated_at DESC',(u,))]
    for item in received:
        n=None
        try:n=note(ws,item['owner'],item['note_id'])
        except (sqlite3.Error,OSError,Forbidden):pass
        item.update(missing=not n,title=n['title'] if n else 'Deleted note',updated_at=n['updated_at'] if n else item['updated_at'],
                    preview=(note_document.plain(n['content']) if n and n['content_format']=='html' else (n or {}).get('content',''))[:200])
    return {'enabled':True,'owned':owned,'received':received,'friends':friends}

def read(path,ws,u,key):
    with accounts.db(path) as c:
        enabled(c,u);s=share(c,key,u);owner_name=name(c,s['owner'])
    n=note(ws,s['owner'],s['note_id'])
    if not n:raise Forbidden('The owner deleted this note.')
    keep=('id','title','content','content_format','updated_at','created_at','week')
    return {'share':{**s,'owner_name':owner_name,'role':'owner' if u==s['owner'] else 'recipient'},'note':{**{k:n.get(k) for k in keep},'content':to_share(n['content'],key) if n['content_format']=='html' else n['content'],'tags':[]}}

def image(path,ws,u,key,filename):
    with accounts.db(path) as c:share_row=share(c,key,u)
    if not re.fullmatch(r'[a-f0-9]{32}\.(?:png|jpg|webp)',filename):raise Forbidden('Image not found.')
    file=ws(share_row['owner']).parent/'note_uploads'/filename
    if not file.is_file():raise Forbidden('Image not found.')
    return file.read_bytes(),filename

def ink(path,ws,u,key,ink_id):
    """A handwriting page of a shared note, read from the owner's notebook."""
    with accounts.db(path) as c:share_row=share(c,key,u)
    try:return note_document.read_ink(ws(share_row['owner']).parent/'note_uploads',ink_id)
    except ValueError:raise Forbidden('Handwriting page not found.')

def changed(path,owner,note_id,deleted=False):
    """Tell everyone who has this note shared with them (and the owner's other tabs) that it changed."""
    with accounts.db(path) as c:
        if not c.execute("SELECT 1 FROM sqlite_master WHERE name='social_note_shares'").fetchone():return
        rows=[dict(r) for r in c.execute('SELECT id,recipient FROM social_note_shares WHERE owner=? AND note_id=?',(owner,note_id))]
        if deleted:c.execute('DELETE FROM social_note_shares WHERE owner=? AND note_id=?',(owner,note_id))
    for r in rows:social_store.LIVE.post([r['recipient']],{'type':'note','share':r['id'],'note':note_id,'deleted':deleted})
    if rows:social_store.LIVE.post([owner],{'type':'note','note':note_id,'deleted':deleted})

def write(path,ws,u,payload):
    after=[];result=_write(path,ws,u,payload,after)
    for task in after:task()
    return result

def _write(path,ws,u,payload,after):
    social_store.migrate(path);action=payload.get('action');d=payload.get('data') or {};key=payload.get('id')
    with accounts.db(path) as c:
        c.execute('BEGIN IMMEDIATE');enabled(c,u);me=name(c,u)
        if action=='share':
            n=note(ws,u,d.get('note_id')) if isinstance(d.get('note_id'),str) else None
            if not n:raise ValueError('Save this note before sharing it.')
            permission=social_store.choice(d.get('permission','view'),PERMISSIONS);people=d.get('recipients')
            if not isinstance(people,list) or not 1<=len(people)<=20:raise ValueError('Choose up to 20 friends to share with.')
            ids=[]
            for v in dict.fromkeys(people):
                if not isinstance(v,str):raise ValueError('Choose friends from the list.')
                social_store.target(c,u,v)
                if not social_store.friends(c,u,v):raise Forbidden('You can only share notes with friends.')
                r=c.execute('SELECT * FROM social_note_shares WHERE owner=? AND note_id=? AND recipient=?',(u,n['id'],v)).fetchone();stamp=social_store.now()
                if r:sid=r['id'];c.execute('UPDATE social_note_shares SET permission=?,request=NULL,updated_at=? WHERE id=?',(permission,stamp,sid))
                else:sid=ident();c.execute('INSERT INTO social_note_shares VALUES(?,?,?,?,?,?,?,?,?,?)',(sid,u,n['id'],v,permission,None,None,None,stamp,stamp))
                dm=message(c,u,v,u,f'📄 Shared a note: {n["title"]}',{'kind':'note_share','share':sid,'title':n['title']})
                social_store.notify(c,v,'note',f'{me} shared a note with you: {n["title"]}',dm)
                ids.append(sid);ping(after,[u,v],{'type':'message','space':dm,'room':None});ping(after,[v],{'type':'note_shares'})
            return {'ok':True,'ids':ids}
        s=share(c,key,u);owner=u==s['owner'];stamp=social_store.now()
        title=(note(ws,s['owner'],s['note_id']) or {}).get('title','a note')
        if action in ('permission','decline','revoke'):
            if not owner:raise Forbidden('Only the note’s owner can change who may edit it.')
            if action=='revoke':
                c.execute('DELETE FROM social_note_shares WHERE id=?',(key,))
                ping(after,[s['recipient']],{'type':'note_shares'});ping(after,[s['recipient']],{'type':'note','share':key,'note':s['note_id'],'deleted':True})
                return {'ok':True}
            permission=s['permission'] if action=='decline' else social_store.choice(d.get('permission'),PERMISSIONS)
            c.execute('UPDATE social_note_shares SET permission=?,request=NULL,updated_at=? WHERE id=?',(permission,stamp,key))
            if s['request'] or permission!=s['permission']:
                text={'edit':f'You can now edit “{title}”.','view':f'“{title}” is view only for you now.'}[permission] if action=='permission' else f'{me} kept “{title}” view only for now.'
                dm=message(c,s['owner'],s['recipient'],u,('✓ ' if permission=='edit' and action=='permission' else '')+text,{'kind':'note_access','share':key,'title':title,'permission':permission})
                social_store.notify(c,s['recipient'],'note',text,dm);ping(after,[s['owner'],s['recipient']],{'type':'message','space':dm,'room':None})
            ping(after,[s['recipient'],s['owner']],{'type':'note_shares'})
            return {'ok':True}
        if owner:raise Forbidden('This note is yours: open it from your notes.')
        if action=='leave':
            c.execute('DELETE FROM social_note_shares WHERE id=?',(key,));ping(after,[s['owner']],{'type':'note_shares'});return {'ok':True}
        if action=='request':
            if s['permission']=='edit':raise ValueError('You can already edit this note.')
            if s['request']:raise ValueError('You already asked. The owner will see your request in your messages.')
            c.execute("UPDATE social_note_shares SET request='edit',updated_at=? WHERE id=?",(stamp,key))
            dm=message(c,s['owner'],s['recipient'],u,f'✋ Asked to edit “{title}”',{'kind':'note_edit_request','share':key,'title':title})
            social_store.notify(c,s['owner'],'note',f'{me} asked to edit “{title}”.',dm)
            ping(after,[s['owner'],s['recipient']],{'type':'message','space':dm,'room':None});ping(after,[s['owner'],s['recipient']],{'type':'note_shares'})
            return {'ok':True}
        if action=='save':
            subject=d.get('subject_id') or None;topic=d.get('topic_name') or None
            if subject:
                with closing(workspace(ws,u)) as w:
                    if not w.execute('SELECT 1 FROM subjects WHERE id=?',(subject,)).fetchone():raise ValueError('Choose one of your subjects.')
                    if topic and not w.execute('SELECT 1 FROM subject_topics WHERE subject_id=? AND topic_name=?',(subject,topic)).fetchone():raise ValueError('Choose a topic from that subject, or leave Topic empty.')
            c.execute('UPDATE social_note_shares SET saved_subject=?,saved_topic=?,updated_at=? WHERE id=?',(subject,topic if subject else None,stamp,key))
            return {'ok':True}
        if action in ('edit','upload','ink'):
            if s['permission']!='edit':raise Forbidden('Ask the owner for permission to edit this note.')
            if action=='ink':return {'ok':True,'id':note_document.save_ink(ws(s['owner']).parent/'note_uploads',d)}
            if action=='upload':
                url=note_document.upload(ws(s['owner']).parent/'note_uploads',d)
                return {'ok':True,'url':to_share(url,key)}
            with closing(workspace(ws,s['owner'])) as w,w:
                w.execute('BEGIN IMMEDIATE')
                existing=w.execute('SELECT * FROM notes WHERE id=?',(s['note_id'],)).fetchone()
                if not existing:raise Forbidden('The owner deleted this note.')
                if d.get('base_updated_at')!=existing['updated_at']:raise ValueError('Someone else changed this note while you were editing. Your draft is kept; reload the note to see their changes.')
                notes_store.save(w,{'id':s['note_id'],'title':d.get('title'),'content':from_share(d.get('content'),key),'content_format':'html','base_updated_at':d.get('base_updated_at')})
                fresh=dict(w.execute('SELECT id,title,content,content_format,updated_at FROM notes WHERE id=?',(s['note_id'],)).fetchone())
            after.append(lambda:changed(path,s['owner'],s['note_id']))
            return {'ok':True,'note':{**fresh,'content':to_share(fresh['content'],key)}}
        raise ValueError('Unknown note sharing action.')
