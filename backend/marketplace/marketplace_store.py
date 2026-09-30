"""Shared Marketplace repository. Private workspaces are accessed only by the server.

Public metadata and protected version snapshots are deliberately separate. All
money is integer minor units. Acquisition pins a version; imports are own copies.
Keep this service boundary when replacing the small-host SQLite implementation.
"""
import base64
import json
import re
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
import accounts
import note_document
import payment_provider
import marketplace_pdf

LOCK = threading.RLock()
KINDS = ('Lecture Notes','Tutorial Notes','Lab Notes','Summary Notes','Exam Notes','Practice Questions','Study Guide','Cheat Sheet','Other')
METHODS = ('Online','In-person','Group','1-to-1')
class Forbidden(ValueError): pass
def now(): return datetime.now(timezone.utc).isoformat()
def ident(): return uuid.uuid4().hex
def enc(v): return json.dumps(v, ensure_ascii=False)
def text(v, limit=2000):
    if not isinstance(v,str) or len(v)>limit: raise ValueError('Text is missing or too long.')
    return v.strip()
def select(v, choices):
    if v not in choices: raise ValueError('Invalid selection.')
    return v
def money(v):
    try:
        n=Decimal(str(v))
        if not n.is_finite() or n<0 or n>100000 or n*100!=(n*100).to_integral_value(): raise ValueError('Use a price with at most two decimal places.')
        return int(n*100)
    except (InvalidOperation,TypeError): raise ValueError('Invalid price.')
def strings(v,limit=30):
    if not isinstance(v,list) or len(v)>limit: raise ValueError('Too many values.')
    return list(dict.fromkeys(text(x,100) for x in v if x))

def migrate(path):
    with LOCK, accounts.db(path) as c:
        if c.execute("SELECT 1 FROM sqlite_master WHERE name='market_listings'").fetchone(): return
        folder=Path(path).parent/'backups'; folder.mkdir(exist_ok=True)
        dest=sqlite3.connect(folder/('before-marketplace-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))
        try: c.backup(dest)
        finally: dest.close()
        c.executescript('''BEGIN IMMEDIATE;
        CREATE TABLE market_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),bio TEXT NOT NULL,show_university INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE market_listings(id TEXT PRIMARY KEY,seller TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL,version INTEGER NOT NULL,metadata TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE market_versions(listing TEXT REFERENCES market_listings(id),version INTEGER,filename TEXT NOT NULL,format TEXT NOT NULL,content BLOB NOT NULL,preview TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(listing,version));
        CREATE TABLE market_previews(listing TEXT,version INTEGER,page INTEGER,content BLOB NOT NULL,PRIMARY KEY(listing,version,page),FOREIGN KEY(listing,version) REFERENCES market_versions(listing,version));
        CREATE TABLE market_orders(id TEXT PRIMARY KEY,buyer TEXT REFERENCES users(id),status TEXT NOT NULL,currency TEXT NOT NULL,total_minor INTEGER NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE market_order_items(order_id TEXT REFERENCES market_orders(id),listing TEXT REFERENCES market_listings(id),version INTEGER NOT NULL,seller TEXT REFERENCES users(id),amount_minor INTEGER NOT NULL,PRIMARY KEY(order_id,listing));
        CREATE TABLE market_ownership(user_id TEXT REFERENCES users(id),listing TEXT REFERENCES market_listings(id),version INTEGER NOT NULL,order_id TEXT REFERENCES market_orders(id),acquired_at TEXT NOT NULL,downloads INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,listing));
        CREATE TABLE market_cart(user_id TEXT REFERENCES users(id),listing TEXT REFERENCES market_listings(id),PRIMARY KEY(user_id,listing));
        CREATE TABLE market_ledger(id TEXT PRIMARY KEY,provider_event TEXT UNIQUE,order_id TEXT REFERENCES market_orders(id),booking_id TEXT,seller TEXT REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('buyer_payment','platform_fee','seller_earning','refund','payout')),amount_minor INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE market_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        INSERT INTO market_settings VALUES('fee_basis_points','0');
        INSERT INTO market_settings VALUES('currency','AUD');
        CREATE TABLE market_tutors(user_id TEXT PRIMARY KEY REFERENCES users(id),data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE market_bookings(id TEXT PRIMARY KEY,student TEXT REFERENCES users(id),tutor TEXT REFERENCES users(id),start_at TEXT NOT NULL,end_at TEXT NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE market_reviews(id TEXT PRIMARY KEY,author TEXT REFERENCES users(id),kind TEXT NOT NULL,target TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),body TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(author,kind,target));
        CREATE TABLE market_saved(user_id TEXT REFERENCES users(id),kind TEXT NOT NULL,target TEXT NOT NULL,PRIMARY KEY(user_id,kind,target));
        CREATE TABLE market_conversations(id TEXT PRIMARY KEY,buyer TEXT REFERENCES users(id),seller TEXT REFERENCES users(id),kind TEXT NOT NULL,target TEXT NOT NULL,UNIQUE(buyer,seller,kind,target));
        CREATE TABLE market_messages(id TEXT PRIMARY KEY,conversation TEXT REFERENCES market_conversations(id),author TEXT REFERENCES users(id),body TEXT NOT NULL,read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
        CREATE TABLE market_notifications(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),kind TEXT NOT NULL,body TEXT NOT NULL,target TEXT NOT NULL,read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,UNIQUE(user_id,kind,target));
        CREATE TABLE market_reports(id TEXT PRIMARY KEY,author TEXT REFERENCES users(id),kind TEXT NOT NULL,target TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE INDEX market_booking_time ON market_bookings(tutor,start_at,end_at,status);
        CREATE INDEX market_message_context ON market_messages(conversation,created_at);
        CREATE INDEX market_notice_user ON market_notifications(user_id,read);
        COMMIT;''')

def user(c,u):
    r=c.execute('SELECT id,display_name,profile,role FROM users WHERE id=? AND disabled=0',(u,)).fetchone()
    if not r: raise Forbidden('This account is unavailable.')
    return r
def public(c,u):
    r=user(c,u); p=json.loads(r['profile']);m=c.execute('SELECT * FROM market_profiles WHERE user_id=?',(u,)).fetchone()
    return {'id':u,'name':r['display_name'],'avatar':p.get('avatar','graduate'),'photo':p.get('photo'), 'university':p.get('university','') if m and m['show_university'] else '', 'bio':m['bio'] if m else ''}
def notify(c,u,kind,body,target):
    c.execute('INSERT OR IGNORE INTO market_notifications VALUES(?,?,?,?,?,0,?)',(ident(),u,kind,body,target,now()))
def listing(c,key,u=None,owner=False):
    r=c.execute('SELECT * FROM market_listings WHERE id=?',(key,)).fetchone()
    if not r or (owner and r['seller']!=u): raise Forbidden('Listing is unavailable or not yours.')
    user(c,r['seller'])
    return {**dict(r),'metadata':json.loads(r['metadata'])}
def owned(c,u,key): return c.execute('SELECT * FROM market_ownership WHERE user_id=? AND listing=?',(u,key)).fetchone()
def tutor(c,key):
    r=c.execute('SELECT * FROM market_tutors WHERE user_id=?',(key,)).fetchone()
    if not r: raise Forbidden('Tutor profile not found.')
    user(c,key)
    return {**dict(r),'data':json.loads(r['data'])}
def booking(c,key,u):
    r=c.execute('SELECT * FROM market_bookings WHERE id=?',(key,)).fetchone()
    if not r or u not in (r['student'],r['tutor']): raise Forbidden('This booking is private.')
    return {**dict(r),'data':json.loads(r['data'])}
def reviews(c,kind,target):
    if kind=='note': rows=c.execute("SELECT * FROM market_reviews WHERE kind='note' AND target=?",(target,))
    else: rows=c.execute("SELECT r.* FROM market_reviews r JOIN market_bookings b ON b.id=r.target WHERE r.kind='tutor' AND b.tutor=?",(target,))
    result=[]
    for r in rows:
        try: result.append({**dict(r),'reviewer':public(c,r['author'])})
        except Forbidden: pass
    return result
def rating(rows): return round(sum(r['rating'] for r in rows)/len(rows),2) if rows else 0
def serialize_listing(c,r,u):
    rs=reviews(c,'note',r['id']);v=c.execute('SELECT format,preview FROM market_versions WHERE listing=? AND version=?',(r['id'],r['version'])).fetchone()
    return {**r,'seller_profile':public(c,r['seller']),'reviews':rs,'rating':rating(rs),'format':v['format'],'preview':v['preview'],'preview_pages':c.execute('SELECT COUNT(*) FROM market_previews WHERE listing=? AND version=?',(r['id'],r['version'])).fetchone()[0],'owned':bool(owned(c,u,r['id']))}
def state(path,u):
    migrate(path)
    with accounts.db(path) as c:
        result={'me':public(c,u),'is_admin':user(c,u)['role']=='admin','settings':dict(c.execute('SELECT key,value FROM market_settings')),'payments':payment_provider.provider().name}
        result['me']['show_university']=bool(result['me']['university'])
        result['me']['university']=json.loads(user(c,u)['profile']).get('university','')
        listings=[]
        for row in c.execute("SELECT l.* FROM market_listings l JOIN users u ON u.id=l.seller WHERE u.disabled=0 AND (l.status='published' OR l.seller=? OR EXISTS(SELECT 1 FROM market_ownership o WHERE o.listing=l.id AND o.user_id=?)) ORDER BY l.updated_at DESC",(u,u)):
            listings.append(serialize_listing(c,{**dict(row),'metadata':json.loads(row['metadata'])},u))
        result['listings']=listings
        result['tutors']=[{**dict(r),'data':json.loads(r['data']),'profile':public(c,r['user_id']),'reviews':reviews(c,'tutor',r['user_id'])} for r in c.execute('SELECT t.* FROM market_tutors t JOIN users u ON u.id=t.user_id WHERE u.disabled=0')]
        # Only coarse public availability is exposed; students never receive others' bookings.
        result['bookings']=[{**dict(r),'data':json.loads(r['data']),'student_profile':public(c,r['student']),'tutor_profile':public(c,r['tutor'])} for r in c.execute('SELECT b.* FROM market_bookings b JOIN users s ON s.id=b.student JOIN users t ON t.id=b.tutor WHERE s.disabled=0 AND t.disabled=0 AND (student=? OR tutor=?) ORDER BY start_at DESC',(u,u))]
        for b in result['bookings']:
            remaining=datetime.fromisoformat(b['start_at'])-datetime.now(timezone.utc)
            if b['status']=='confirmed' and timedelta(0)<remaining<=timedelta(days=1): notify(c,u,'session_reminder','Your tutoring session starts within 24 hours.',b['id'])
        result['library']=[dict(r) for r in c.execute('SELECT * FROM market_ownership WHERE user_id=?',(u,))]
        result['cart']=[r[0] for r in c.execute('SELECT listing FROM market_cart WHERE user_id=?',(u,))]
        result['saved']=[dict(r) for r in c.execute('SELECT kind,target FROM market_saved WHERE user_id=?',(u,))]
        result['notifications']=[dict(r) for r in c.execute('SELECT * FROM market_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 200',(u,))]
        result['conversations']=[]
        for r in c.execute('SELECT * FROM market_conversations WHERE buyer=? OR seller=?',(u,u)):
            other=r['seller'] if r['buyer']==u else r['buyer']
            try: p=public(c,other)
            except Forbidden: continue
            result['conversations'].append({**dict(r),'other':p,'unread':c.execute('SELECT COUNT(*) FROM market_messages WHERE conversation=? AND author<>? AND read=0',(r['id'],u)).fetchone()[0]})
        result['sales']=[dict(r) for r in c.execute('SELECT o.listing,o.version,o.acquired_at,o.downloads FROM market_ownership o JOIN market_listings l ON l.id=o.listing WHERE l.seller=?',(u,))]
        result['ledger']=[dict(r) for r in c.execute('SELECT * FROM market_ledger WHERE seller=? ORDER BY created_at DESC',(u,))]
        result['reports']=[dict(r) for r in c.execute('SELECT * FROM market_reports ORDER BY created_at DESC')] if result['is_admin'] else []
        return result

def snapshot(d):
    fmt=select(d.get('format'),('markdown','html','pdf'))
    images=[];pages=None
    if fmt=='pdf':
        try: content=base64.b64decode(d.get('base64',''),validate=True)
        except Exception: raise ValueError('Invalid PDF upload.')
        if not content.startswith(b'%PDF-') or not 8<=len(content)<=8*1024*1024: raise ValueError('Upload a PDF up to 8 MB.')
        rendered=marketplace_pdf.preview(content,d.get('preview_count',3));pages=rendered['pages'];images=[base64.b64decode(i) for i in rendered['images']]
    else:
        raw=text(d.get('content',''),100000)
        if not raw: raise ValueError('Note content is empty.')
        if fmt=='html':
            # Private image paths must never point at the buyer's account images.
            raw=re.sub(r'<img\b[^>]*>','',note_document.sanitize(raw),flags=re.I)
        content=raw.encode('utf-8')
    preview=text(d.get('preview',''),6000)
    if not preview: raise ValueError('Write a public preview excerpt. Only this excerpt is shared before acquisition.')
    name='resource.'+('md' if fmt=='markdown' else fmt)
    return fmt,content,preview,name,images,pages

def availability(d):
    slots=d.get('availability',[])
    if not isinstance(slots,list) or len(slots)>50: raise ValueError('Use up to 50 weekly time windows.')
    result=[]
    for s in slots:
        day=int(s['day']);start=text(s['start'],5);end=text(s['end'],5)
        if day not in range(7) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',start) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',end) or start>=end: raise ValueError('Invalid availability window.')
        result.append({'day':day,'start':start,'end':end})
    exceptions=strings(d.get('exceptions',[]),100)
    for v in exceptions: date.fromisoformat(v)
    return result,exceptions
def utc(v):
    t=datetime.fromisoformat(text(v,40))
    if t.tzinfo is None: raise ValueError('Booking time needs a timezone offset.')
    return t.astimezone(timezone.utc)
def slot_check(c,t,start,duration,subject,method):
    from zoneinfo import ZoneInfo
    d=t['data'];end=start+timedelta(minutes=duration)
    local=start.astimezone(ZoneInfo(d['timezone']));local_end=end.astimezone(ZoneInfo(d['timezone']))
    if d['status']!='accepting' or subject not in d['subjects'] or method not in d['methods']: raise ValueError('This tutor is not available for that subject or session type.')
    if start<=datetime.now(timezone.utc) or duration not in (30,60,90,120): raise ValueError('Choose a future session lasting 30, 60, 90 or 120 minutes.')
    if local.date()!=local_end.date() or str(local.date()) in d['exceptions'] or not any(s['day']==local.weekday() and s['start']<=local.strftime('%H:%M') and s['end']>=local_end.strftime('%H:%M') for s in d['availability']): raise ValueError('That time is outside the tutor’s availability.')
    if c.execute("SELECT 1 FROM market_bookings WHERE tutor=? AND status IN ('pending','confirmed') AND start_at<? AND end_at>?",(t['user_id'],end.isoformat(),start.isoformat())).fetchone(): raise ValueError('That slot is already reserved. Choose another time.')
    return end

def write(path,u,payload):
    migrate(path);action=payload.get('action');d=payload.get('data') or {};key=payload.get('id');stamp=now()
    with accounts.db(path) as c:
        c.execute('BEGIN IMMEDIATE');user(c,u)
        if action=='profile':
            c.execute('INSERT INTO market_profiles VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,show_university=excluded.show_university',(u,text(d.get('bio',''),1000),int(d.get('show_university') is True)))
        elif action=='listing':
            old=listing(c,key,u,True) if key else None
            if old and old['status']=='removed': raise Forbidden('A moderator removed this listing.')
            if d.get('rights') is not True: raise ValueError('Confirm you have the right to share this material.')
            title=text(d.get('title',''),200)
            if not title: raise ValueError('Enter a listing title.')
            status=select(d.get('status','draft'),('draft','published','unlisted'))
            meta={'title':title,'subject':text(d.get('subject',''),120),'topic':text(d.get('topic',''),120),'description':text(d.get('description',''),4000),'tags':strings(d.get('tags',[])),'resource_type':select(d.get('resource_type','Other'),KINDS),'price_minor':money(d.get('price','0')),'pages':int(d.get('pages') or 1),'term':text(d.get('term',''),80)}
            if not meta['subject'] or not 1<=meta['pages']<=10000: raise ValueError('Enter a subject and page count (1–10000).')
            version=old['version'] if old else 0
            if d.get('format'):
                fmt,content,preview,filename,images,pages=snapshot(d);version+=1
                if pages:meta['pages']=pages
            elif not old: raise ValueError('Choose a resource to publish.')
            key=key or ident()
            c.execute('INSERT INTO market_listings VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,version=excluded.version,metadata=excluded.metadata,updated_at=excluded.updated_at',(key,u,status,version,enc(meta),old['created_at'] if old else stamp,stamp))
            if d.get('format'):
                c.execute('INSERT INTO market_versions VALUES(?,?,?,?,?,?,?)',(key,version,filename,fmt,content,preview,stamp))
                c.executemany('INSERT INTO market_previews VALUES(?,?,?,?)',[(key,version,i,raw) for i,raw in enumerate(images)])
            return {'ok':True,'id':key}
        elif action=='listing_status':
            r=listing(c,key,u,True)
            if r['status']=='removed': raise Forbidden('A moderator removed this listing.')
            c.execute('UPDATE market_listings SET status=?,updated_at=? WHERE id=?',(select(d.get('status'),('draft','published','unlisted')),stamp,key))
        elif action=='acquire':
            r=listing(c,key);o=owned(c,u,key)
            if o:return {'ok':True,'id':key}
            if r['status']!='published' or r['seller']==u: raise Forbidden('Acquire a published resource from another seller.')
            if r['metadata']['price_minor']: raise ValueError('Paid resources require a verified payment. Payments are not configured yet.')
            order=ident();currency=c.execute("SELECT value FROM market_settings WHERE key='currency'").fetchone()[0]
            c.execute('INSERT INTO market_orders VALUES(?,?,?,?,?,?)',(order,u,'free_acquired',currency,0,stamp))
            c.execute('INSERT INTO market_order_items VALUES(?,?,?,?,?)',(order,key,r['version'],r['seller'],0))
            c.execute('INSERT INTO market_ownership VALUES(?,?,?,?,?,0)',(u,key,r['version'],order,stamp))
            c.execute('DELETE FROM market_cart WHERE user_id=? AND listing=?',(u,key))
            notify(c,u,'note_acquired','Notes acquired. Download or add an editable copy to your subjects.',key)
            notify(c,r['seller'],'note_acquired','Someone acquired your free notes.',order)
        elif action=='cart':
            if d.get('remove'): c.execute('DELETE FROM market_cart WHERE user_id=? AND listing=?',(u,key))
            else:
                r=listing(c,key)
                if r['seller']==u or owned(c,u,key) or r['status']!='published' or not r['metadata']['price_minor']: raise ValueError('Only unowned, paid, published notes can be added to cart.')
                c.execute('INSERT OR IGNORE INTO market_cart VALUES(?,?)',(u,key))
        elif action=='checkout': payment_provider.provider().checkout({'buyer':u})
        elif action=='saved':
            kind=select(d.get('kind'),('note','tutor'))
            if kind=='note': listing(c,key)
            else:tutor(c,key)
            if d.get('remove'):c.execute('DELETE FROM market_saved WHERE user_id=? AND kind=? AND target=?',(u,kind,key))
            else:c.execute('INSERT OR IGNORE INTO market_saved VALUES(?,?,?)',(u,kind,key))
        elif action=='tutor':
            from zoneinfo import ZoneInfo,ZoneInfoNotFoundError
            if d.get('terms') is not True: raise ValueError('Accept the Marketplace agreement.')
            tz=text(d.get('timezone','Australia/Sydney'),80)
            try: ZoneInfo(tz)
            except ZoneInfoNotFoundError: raise ValueError('Use a valid IANA timezone, such as Australia/Sydney.')
            slots,exceptions=availability(d)
            data={'bio':text(d.get('bio',''),4000),'tagline':text(d.get('tagline',''),180),'experience':text(d.get('experience',''),1200),'languages':strings(d.get('languages',[])),'subjects':strings(d.get('subjects',[])),'methods':strings(d.get('methods',[])),'price_minor':money(d.get('price',0)),'timezone':tz,'availability':slots,'exceptions':exceptions,'status':select(d.get('status','accepting'),('accepting','unavailable','paused')),'approval':d.get('approval') is not False,'year':text(d.get('year',''),80)}
            if not data['subjects'] or not data['methods'] or any(v not in METHODS for v in data['methods']): raise ValueError('Choose subjects and valid session types.')
            c.execute('INSERT INTO market_tutors VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',(u,enc(data),stamp,stamp))
        elif action=='book':
            t=tutor(c,key)
            if key==u:raise ValueError('You cannot book yourself.')
            start=utc(d['start']);duration=int(d['duration']);subject=text(d.get('subject',''),100);method=select(d.get('method'),METHODS)
            end=slot_check(c,t,start,duration,subject,method)
            if c.execute("SELECT 1 FROM market_bookings WHERE student=? AND status IN ('pending','confirmed') AND start_at<? AND end_at>?",(u,end.isoformat(),start.isoformat())).fetchone(): raise ValueError('You already have a tutoring reservation at that time.')
            amount=int((Decimal(t['data']['price_minor'])*duration/60).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
            # Unconfigured provider does not prevent arranging a session, but never marks it paid.
            data={'subject':subject,'method':method,'duration':duration,'amount_minor':amount,'currency':c.execute("SELECT value FROM market_settings WHERE key='currency'").fetchone()[0],'payment_status':'not_configured' if amount else 'free','note':text(d.get('note',''),2000),'timezone':t['data']['timezone']}
            status='pending' if t['data']['approval'] else 'confirmed';bid=ident()
            c.execute('INSERT INTO market_bookings VALUES(?,?,?,?,?,?,?,?,?)',(bid,u,key,start.isoformat(),end.isoformat(),status,enc(data),stamp,stamp))
            notify(c,key,'booking_request','A student requested a tutoring session.',bid);notify(c,u,'booking_'+status,'Your tutoring booking is '+status+'. No payment was collected.',bid)
            return {'ok':True,'id':bid}
        elif action=='booking_status':
            b=booking(c,key,u);status=select(d.get('status'),('confirmed','declined','cancelled','completed'))
            if status in ('confirmed','declined') and (u!=b['tutor'] or b['status']!='pending'): raise Forbidden('Only the tutor can accept or decline a pending request.')
            if status=='cancelled' and b['status'] not in ('pending','confirmed'): raise ValueError('This booking cannot be cancelled.')
            if status=='completed' and (u!=b['tutor'] or b['status']!='confirmed' or datetime.fromisoformat(b['end_at'])>datetime.now(timezone.utc)): raise Forbidden('Only the tutor can complete a confirmed session after it ends.')
            data=b['data'];data[status+'_at']=stamp
            c.execute('UPDATE market_bookings SET status=?,data=?,updated_at=? WHERE id=?',(status,enc(data),stamp,key))
            for recipient in (b['student'],b['tutor']):notify(c,recipient,'booking_'+status,'Tutoring session '+status+'.'+(' Please leave a review.' if status=='completed' else ''),key)
        elif action=='review':
            kind=select(d.get('kind'),('note','tutor'));stars=int(d.get('rating',0))
            if stars not in range(1,6):raise ValueError('Choose a rating from 1 to 5.')
            if kind=='note':
                r=listing(c,key);recipient=r['seller']
                if recipient==u or not owned(c,u,key):raise Forbidden('Only verified acquirers can review this resource.')
            else:
                b=booking(c,key,u);recipient=b['tutor']
                if b['student']!=u or b['status']!='completed':raise Forbidden('Only the student from a completed booking can review the tutor.')
            if c.execute('SELECT 1 FROM market_reviews WHERE author=? AND kind=? AND target=?',(u,kind,key)).fetchone():raise ValueError('You have already reviewed this acquisition/session.')
            c.execute('INSERT INTO market_reviews VALUES(?,?,?,?,?,?,?)',(ident(),u,kind,key,stars,text(d.get('body',''),2000),stamp));notify(c,recipient,'new_review','A verified Marketplace review was received.',key)
        elif action=='conversation':
            kind=select(d.get('kind'),('note','tutor'));seller=listing(c,key)['seller'] if kind=='note' else tutor(c,key)['user_id']
            if kind=='note' and listing(c,key)['status']!='published' and not owned(c,u,key):raise Forbidden('Listing is unavailable.')
            if seller==u:raise ValueError('Choose someone else to message.')
            # Respect existing explicit account blocks without requiring Socialise friendship.
            if c.execute("SELECT 1 FROM sqlite_master WHERE name='social_blocks'").fetchone() and c.execute('SELECT 1 FROM social_blocks WHERE (user_id=? AND target=?) OR (user_id=? AND target=?)',(u,seller,seller,u)).fetchone():raise Forbidden('Messaging is unavailable for this account.')
            row=c.execute('SELECT id FROM market_conversations WHERE buyer=? AND seller=? AND kind=? AND target=?',(u,seller,kind,key)).fetchone();cid=row[0] if row else ident()
            if not row:c.execute('INSERT INTO market_conversations VALUES(?,?,?,?,?)',(cid,u,seller,kind,key))
            return {'ok':True,'id':cid}
        elif action=='booking_conversation':
            b=booking(c,key,u)
            row=c.execute("SELECT id FROM market_conversations WHERE buyer=? AND seller=? AND kind='tutor' AND target=?",(b['student'],b['tutor'],b['tutor'])).fetchone()
            cid=row[0] if row else ident()
            if not row:c.execute('INSERT INTO market_conversations VALUES(?,?,?,?,?)',(cid,b['student'],b['tutor'],'tutor',b['tutor']))
            conversation(c,cid,u)
            return {'ok':True,'id':cid}
        elif action=='message':
            r=conversation(c,key,u);body=text(d.get('body',''),5000)
            if not body:raise ValueError('Write a message.')
            recipient=r['buyer'] if u==r['seller'] else r['seller'];mid=ident()
            c.execute('INSERT INTO market_messages VALUES(?,?,?,?,0,?)',(mid,key,u,body,stamp));notify(c,recipient,'marketplace_message','You have a new Marketplace message.',mid)
        elif action=='read':c.execute('UPDATE market_notifications SET read=1 WHERE user_id=?',(u,))
        elif action=='report':
            kind=select(d.get('kind'),('note','tutor','review'));reason=text(d.get('reason',''),2000)
            if not reason:raise ValueError('Describe the issue.')
            c.execute('INSERT INTO market_reports VALUES(?,?,?,?,?,?,?)',(ident(),u,kind,text(key,80),reason,'open',stamp))
        elif action=='moderate':
            if user(c,u)['role']!='admin':raise Forbidden('Only an administrator can moderate listings.')
            if d.get('listing'):c.execute("UPDATE market_listings SET status='removed',updated_at=? WHERE id=?",(stamp,d['listing']))
            if key:c.execute("UPDATE market_reports SET status='resolved' WHERE id=?",(key,))
        elif action=='settings':
            if user(c,u)['role']!='admin':raise Forbidden('Administrator permission required.')
            fee=int(d.get('fee_basis_points',0))
            if not 0<=fee<=10000:raise ValueError('Fee must be 0–100%.')
            c.execute("UPDATE market_settings SET value=? WHERE key='fee_basis_points'",(str(fee),))
        else:raise ValueError('Unknown Marketplace action.')
    return {'ok':True}

def conversation(c,key,u):
    r=c.execute('SELECT * FROM market_conversations WHERE id=?',(key,)).fetchone()
    if not r or u not in (r['buyer'],r['seller']):raise Forbidden('This Marketplace conversation is private.')
    user(c,r['buyer']);user(c,r['seller'])
    if c.execute("SELECT 1 FROM sqlite_master WHERE name='social_blocks'").fetchone() and c.execute('SELECT 1 FROM social_blocks WHERE (user_id=? AND target=?) OR (user_id=? AND target=?)',(r['buyer'],r['seller'],r['seller'],r['buyer'])).fetchone():raise Forbidden('This conversation is blocked.')
    return r
def messages(path,u,key):
    migrate(path)
    with accounts.db(path) as c:
        conversation(c,key,u)
        c.execute('UPDATE market_messages SET read=1 WHERE conversation=? AND author<>?',(key,u))
        return {'messages':[dict(r) for r in c.execute('SELECT * FROM market_messages WHERE conversation=? ORDER BY created_at',(key,))]}
def slots(path,u,key,day,duration,subject,method):
    from zoneinfo import ZoneInfo
    migrate(path);day=date.fromisoformat(day);duration=int(duration)
    with accounts.db(path) as c:
        t=tutor(c,key);zone=ZoneInfo(t['data']['timezone']);result=[]
        for minute in range(0,1440,30):
            local=datetime(day.year,day.month,day.day,minute//60,minute%60,tzinfo=zone)
            start=local.astimezone(timezone.utc)
            if start.astimezone(zone).replace(tzinfo=None)!=local.replace(tzinfo=None):continue
            try:slot_check(c,t,start,duration,subject,method)
            except ValueError:continue
            if c.execute("SELECT 1 FROM market_bookings WHERE student=? AND status IN ('pending','confirmed') AND start_at<? AND end_at>?",(u,(start+timedelta(minutes=duration)).isoformat(),start.isoformat())).fetchone():continue
            result.append({'start':start.isoformat(),'label':local.strftime('%H:%M %Z')})
        return {'slots':result,'timezone':t['data']['timezone']}
def resource(path,u,key,count=False):
    migrate(path)
    with accounts.db(path) as c:
        r=listing(c,key);o=owned(c,u,key)
        if r['seller']!=u and not o:raise Forbidden('Acquire these notes before accessing the full resource.')
        version=o['version'] if o else r['version'];v=c.execute('SELECT * FROM market_versions WHERE listing=? AND version=?',(key,version)).fetchone()
        if count and o:c.execute('UPDATE market_ownership SET downloads=downloads+1 WHERE user_id=? AND listing=?',(u,key))
        return {**dict(v),'title':r['metadata']['title'],'seller_name':public(c,r['seller'])['name'],'acquired_at':o['acquired_at'] if o else now()}

def preview_image(path,u,key,page):
    migrate(path)
    with accounts.db(path) as c:
        r=listing(c,key)
        if r['status']!='published' and r['seller']!=u and not owned(c,u,key):raise Forbidden('This preview is unavailable.')
        image=c.execute('SELECT content FROM market_previews WHERE listing=? AND version=? AND page=?',(key,r['version'],int(page))).fetchone()
        if not image:raise Forbidden('That page is not a public preview.')
        return image[0]
