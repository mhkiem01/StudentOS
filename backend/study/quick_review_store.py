"""Account-workspace Quick Review decks. Existing flip cards are never rewritten."""
import json,re,sqlite3,uuid
from contextlib import closing
from datetime import datetime,timezone

def uid():return uuid.uuid4().hex
def now():return datetime.now(timezone.utc).isoformat()
def text(v,limit=20000):
    if not isinstance(v,str) or not v.strip() or len(v)>limit:raise ValueError('Enter non-empty text within the size limit.')
    return v.strip()
def limit(v):
    if isinstance(v,bool) or str(v) not in ('3','4','5','6'):raise ValueError('Choose 3–6 points per page.')
    return int(v)
def migrate(path,backup_dir):
    with closing(sqlite3.connect(path)) as c:
        if c.execute("SELECT 1 FROM sqlite_master WHERE name='quick_decks'").fetchone():return
        backup_dir.mkdir(parents=True,exist_ok=True)
        with closing(sqlite3.connect(backup_dir/('before-quick-review-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))) as dest:c.backup(dest)
        c.executescript('''BEGIN IMMEDIATE;
        CREATE TABLE quick_decks(id TEXT PRIMARY KEY,topic_name TEXT NOT NULL REFERENCES topics(name) ON DELETE CASCADE,title TEXT NOT NULL,points_per_page INTEGER NOT NULL,source_note TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE quick_pages(id TEXT PRIMARY KEY,deck_id TEXT NOT NULL REFERENCES quick_decks(id) ON DELETE CASCADE,title TEXT NOT NULL,position INTEGER NOT NULL);
        CREATE TABLE quick_points(id TEXT PRIMARY KEY,page_id TEXT NOT NULL REFERENCES quick_pages(id) ON DELETE CASCADE,content TEXT NOT NULL,position INTEGER NOT NULL);
        CREATE TABLE quick_page_progress(page_id TEXT PRIMARY KEY REFERENCES quick_pages(id) ON DELETE CASCADE,viewed_at TEXT,memorised INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE quick_progress(deck_id TEXT PRIMARY KEY REFERENCES quick_decks(id) ON DELETE CASCADE,current_page TEXT,sessions INTEGER NOT NULL DEFAULT 0,last_reviewed TEXT,run_seen TEXT NOT NULL DEFAULT '[]',finished INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX quick_pages_deck ON quick_pages(deck_id,position);
        CREATE INDEX quick_points_page ON quick_points(page_id,position);
        COMMIT;''')

def parse(source,topic=None,points_per_page=5):
    maximum=limit(points_per_page)
    if not isinstance(source,str) or not source.strip() or len(source)>500000:raise ValueError('Paste between 1 and 500,000 characters.')
    sections=[];errors=[];warnings=[];section={'title':'','topic':topic or '', 'points':[],'line':1};in_points=False;fence=None;point=None
    def error(line,problem,fix):errors.append({'section':len(sections)+1,'line':line,'problem':problem,'fix':fix})
    def flush():
        nonlocal point
        if point is not None:
            if not point['text'].strip():error(point['line'],'Empty Point','Write some content after the bullet.')
            else:
                section['points'].append(point['text'].rstrip())
                if len(point['text'].strip())>20000:error(point['line'],'Point is too long','Split this point manually into smaller points (20,000 characters each). No content was truncated.')
                if len(point['text'])>600:warnings.append({'line':point['line'],'message':'Long point: kept intact on its own page. You can edit or split it in Manage Deck.'})
        point=None
    def finish():
        flush()
        if not section['title']:error(section['line'],'Missing Title','Start this section with Title: Your heading.')
        elif len(section['title'])>300:error(section['line'],'Title is too long','Shorten the title to 300 characters or fewer.')
        if not section['topic']:error(section['line'],'Missing Topic','Add Topic: an existing topic, or import from inside a topic.')
        if not section['points']:error(section['line'],'Missing Points','Add Points: followed by one or more - bullet points.')
        sections.append(section.copy())
    for line_no,line in enumerate(source.replace('\r\n','\n').split('\n'),1):
        stripped=line.strip()
        if fence:
            if point is None:point={'text':'','line':line_no}
            point['text']+='\n'+line
            if stripped.startswith(fence):fence=None
            continue
        if re.match(r'^\s*[-*+]\s+```',line) or stripped.startswith('```') or stripped.startswith('~~~'):
            if not in_points:error(line_no,'Missing Points heading','Add Points: before your code point.')
            opening=re.sub(r'^\s*[-*+]\s+','',line)
            if re.match(r'^[-*+]\s+',line):flush()
            if point is None:point={'text':opening,'line':line_no}
            else:point['text']+='\n'+opening
            fence='~~~' if opening.strip().startswith('~~~') else '```';continue
        if stripped=='---':
            finish();section={'title':'','topic':topic or '', 'points':[],'line':line_no+1};in_points=False;continue
        if re.fullmatch(r'-{2}|-{4,}|={3,}',stripped):error(line_no,'Invalid Section Separator','Use exactly --- on a line by itself.');continue
        match=re.match(r'^(Topic|Title|Points):\s*(.*)$',line,re.I)
        if match:
            key,value=match[1].lower(),match[2].strip()
            if key=='topic':
                if point is not None or section['points']:error(line_no,'Missing Section Separator','Insert --- before changing Topic: so earlier points stay in their original topic.')
                if topic and value!=topic:error(line_no,'Topic does not match selected topic','Remove Topic: or use '+topic+'.')
                else:section['topic']=value
            elif key=='title':
                if section['title']:error(line_no,'Missing Section Separator','Insert --- before the next Title: section.')
                section['title']=value
            else:
                in_points=True
                if value:error(line_no,'Points must start on the next line','Put - before each point, below Points:.')
            continue
        bullet=re.match(r'^(?:[-*+]\s*|\d+[.)]\s+)(.*)$',line)
        if bullet:
            if not in_points:error(line_no,'Missing Points heading','Add Points: before your bullet list.')
            flush();point={'text':bullet[1],'line':line_no};continue
        if point is not None:point['text']+='\n'+line
        elif stripped:error(line_no,'Unrecognised content','Use Title:, Points:, and a - bullet for each point.')
    if fence:error(line_no,'Unclosed code block','Close the code block with the matching fence.')
    if section['title'] or section['points'] or point is not None or not sections:finish()
    decks={}
    for s in sections:
        deck=decks.setdefault(s['topic'],{'topic_name':s['topic'],'title':s['title'] or 'Quick Review','pages':[]})
        batch=[]
        for p in s['points']:
            if batch and (len(batch)>=maximum or len(p)>600):deck['pages'].append({'title':s['title'],'points':batch});batch=[]
            batch.append(p)
            if len(p)>600:deck['pages'].append({'title':s['title'],'points':batch});batch=[]
        if batch:deck['pages'].append({'title':s['title'],'points':batch})
    return {'decks':list(decks.values()),'errors':errors,'warnings':warnings,'points_per_page':maximum}

def preview(c,d):
    result=parse(d.get('text'),d.get('topic_name') or None,d.get('points_per_page',5))
    for i,deck in enumerate(result['decks'],1):
        if deck['topic_name'] and not c.execute('SELECT 1 FROM topics WHERE name=?',(deck['topic_name'],)).fetchone():result['errors'].append({'section':i,'line':1,'problem':'Unknown Topic: '+deck['topic_name'],'fix':'Choose an existing topic. Create new topics in Subjects first.'})
    return result
def get(c,key):
    row=c.execute('SELECT * FROM quick_decks WHERE id=?',(key,)).fetchone()
    if not row:raise ValueError('Quick Review deck not found in your workspace.')
    deck=dict(row);pages=[]
    for row in c.execute('SELECT p.*,v.viewed_at,COALESCE(v.memorised,0) AS memorised FROM quick_pages p LEFT JOIN quick_page_progress v ON v.page_id=p.id WHERE p.deck_id=? ORDER BY position',(key,)):
        pages.append({**dict(row),'points':[dict(r) for r in c.execute('SELECT * FROM quick_points WHERE page_id=? ORDER BY position',(row['id'],))]})
    progress=dict(c.execute('SELECT * FROM quick_progress WHERE deck_id=?',(key,)).fetchone());progress['run_seen']=json.loads(progress['run_seen']);deck.update(pages=pages,progress=progress)
    return deck
def state(c):
    return {'decks':[get(c,r[0]) for r in c.execute('SELECT id FROM quick_decks ORDER BY updated_at DESC')],'topics':[{'name':r['name'],'subject_id':r['subject_id'],'subject':r['subject']} for r in c.execute('SELECT t.name,s.id AS subject_id,s.name AS subject FROM topics t LEFT JOIN subject_topics st ON st.topic_name=t.name LEFT JOIN subjects s ON s.id=st.subject_id ORDER BY s.name,t.name')]}
def validate_pages(pages,maximum):
    if not isinstance(pages,list) or not 1<=len(pages)<=1000:raise ValueError('A deck needs 1–1000 pages.')
    clean=[];ids=set()
    for page in pages:
        key=page.get('id') or uid()
        if not isinstance(key,str) or key in ids:raise ValueError('Duplicate/invalid page ID.')
        ids.add(key);points=page.get('points')
        if not isinstance(points,list) or not 1<=len(points)<=maximum:raise ValueError('Each page needs 1–'+str(maximum)+' points. Split extra points onto another page.')
        clean.append({'id':key,'title':text(page.get('title'),300),'points':[text(p.get('content') if isinstance(p,dict) else p) for p in points]})
    if sum(len(p) for page in clean for p in page['points'])>500000:raise ValueError('Split this large deck into smaller decks (500,000 characters maximum).')
    return clean
def replace_pages(c,key,pages,old=None):
    previous={p['id']:p for p in (old or {}).get('pages',[])}
    for index,page in enumerate(pages):
        existing=c.execute('SELECT deck_id FROM quick_pages WHERE id=?',(page['id'],)).fetchone()
        if existing and existing[0]!=key:raise ValueError('Page belongs to a different deck.')
        c.execute('INSERT INTO quick_pages VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,position=excluded.position',(page['id'],key,page['title'],index))
        before=previous.get(page['id']);changed=before and (before['title']!=page['title'] or [p['content'] for p in before['points']]!=page['points'])
        if changed:c.execute('DELETE FROM quick_page_progress WHERE page_id=?',(page['id'],))
        c.execute('DELETE FROM quick_points WHERE page_id=?',(page['id'],))
        c.executemany('INSERT INTO quick_points VALUES(?,?,?,?)',[(uid(),page['id'],p,i) for i,p in enumerate(page['points'])])
    keep={p['id'] for p in pages}
    for key_old in previous:
        if key_old not in keep:c.execute('DELETE FROM quick_pages WHERE id=?',(key_old,))
    if old:
        current=old['progress']['current_page'];c.execute("UPDATE quick_progress SET current_page=?,run_seen='[]',finished=0 WHERE deck_id=?",(current if current in keep else pages[0]['id'],key))
def write(c,payload):
    action=payload.get('action');d=payload.get('data') or {};key=payload.get('id')
    if not c.in_transaction:c.execute('BEGIN IMMEDIATE')
    if action=='preview':return preview(c,d)
    if action=='import':
        result=preview(c,d)
        if result['errors']:return {'ok':False,**result}
        prepared=[(deck,validate_pages(deck['pages'],result['points_per_page'])) for deck in result['decks']]
        source=d.get('source_note')
        if source and not c.execute('SELECT 1 FROM notes WHERE id=?',(source,)).fetchone():raise ValueError('Source note not found in your workspace.')
        keys=[]
        for deck,pages in prepared:
            key=uid();stamp=now();c.execute('INSERT INTO quick_decks VALUES(?,?,?,?,?,?,?)',(key,deck['topic_name'],text(d.get('title') or deck['title'],300),result['points_per_page'],source,stamp,stamp));c.execute('INSERT INTO quick_progress(deck_id,current_page) VALUES(?,?)',(key,pages[0]['id']));replace_pages(c,key,pages);keys.append(key)
        return {'ok':True,'ids':keys}
    deck=get(c,key)
    if action=='save':
        if d.get('updated_at')!=deck['updated_at']:raise ValueError('This deck changed on another device. Reload before editing; your unsaved draft is still open.')
        maximum=limit(d.get('points_per_page',deck['points_per_page']));pages=validate_pages(d.get('pages'),maximum)
        replace_pages(c,key,pages,deck);c.execute('UPDATE quick_decks SET title=?,points_per_page=?,updated_at=? WHERE id=?',(text(d.get('title'),300),maximum,now(),key))
    elif action=='delete':c.execute('DELETE FROM quick_decks WHERE id=?',(key,))
    elif action in ('view','memorise'):
        page=next((p for p in deck['pages'] if p['id']==d.get('page')),None)
        if not page:raise ValueError('Page does not belong to this deck.')
        if action=='memorise':
            if not isinstance(d.get('memorised'),bool):raise ValueError('Choose whether this page is memorised.')
            c.execute('INSERT INTO quick_page_progress(page_id,memorised) VALUES(?,?) ON CONFLICT(page_id) DO UPDATE SET memorised=excluded.memorised',(page['id'],int(d['memorised'])))
        else:
            stamp=now();c.execute('INSERT INTO quick_page_progress(page_id,viewed_at) VALUES(?,?) ON CONFLICT(page_id) DO UPDATE SET viewed_at=excluded.viewed_at',(page['id'],stamp));seen=set(deck['progress']['run_seen']);seen.add(page['id']);c.execute('UPDATE quick_progress SET current_page=?,last_reviewed=?,run_seen=? WHERE deck_id=?',(page['id'],stamp,json.dumps(sorted(seen)),key))
    elif action=='finish':
        if not set(p['id'] for p in deck['pages']).issubset(deck['progress']['run_seen']):raise ValueError('View every page in this review before finishing.')
        c.execute('UPDATE quick_progress SET sessions=sessions+1,finished=1,last_reviewed=? WHERE deck_id=? AND finished=0',(now(),key))
    elif action=='restart':c.execute("UPDATE quick_progress SET current_page=?,run_seen='[]',finished=0 WHERE deck_id=?",(deck['pages'][0]['id'],key))
    else:raise ValueError('Unknown Quick Review action.')
    return {'ok':True}
def metrics(c,subject=None,topic=None):
    if not c.execute("SELECT 1 FROM sqlite_master WHERE name='quick_decks'").fetchone():return {'decks':0,'pages':0,'viewed':0,'memorised':0,'sessions':0}
    keys=[r[0] for r in c.execute('SELECT d.id FROM quick_decks d WHERE (? IS NULL OR d.topic_name=?) AND (? IS NULL OR EXISTS(SELECT 1 FROM subject_topics st WHERE st.topic_name=d.topic_name AND st.subject_id=?))',(topic,topic,subject,subject))]
    decks=[get(c,k) for k in keys];pages=[p for d in decks for p in d['pages']]
    return {'decks':len(decks),'pages':len(pages),'viewed':sum(bool(p['viewed_at']) for p in pages),'memorised':sum(bool(p['memorised']) for p in pages),'sessions':sum(d['progress']['sessions'] for d in decks)}
