"""CTF practice: capture-the-flag challenges attached to topics in your own workspace.

A subject opts in; its topics can then hold challenges next to their quizzes. Flags are stored only
as salted SHA-256 hashes, so the app can check an answer without ever showing it. Hints are sent to
the browser one at a time, and a solution stays hidden until the challenge is solved or you choose to
reveal it. Files are kept for download only: nothing here runs a challenge.
"""
import base64,hashlib,hmac,json,re,secrets,uuid
from datetime import datetime,timezone
from pathlib import Path

CATEGORIES=('pwn','rev','web','crypto','forensics','misc','osint')
DIFFICULTIES=('easy','medium','hard','insane')
POINTS={'easy':100,'medium':200,'hard':300,'insane':500}
MAX_HINTS=10
MAX_FILE=10*1024*1024
MAX_TOPIC_FILES=100*1024*1024
MAX_IMPORT=50
FIELDS=('challenge','category','difficulty','points','flag','flag format','connect','source','hint','description','solution','topic')

def uid():return uuid.uuid4().hex
def now():return datetime.now(timezone.utc).isoformat()
def text(v,limit,label,required=False):
    if v is None:v=''
    if not isinstance(v,str):raise ValueError(label+' must be text.')
    v=v.strip()
    if len(v)>limit:raise ValueError(f'{label} must be at most {limit:,} characters.')
    if required and not v:raise ValueError('Enter '+label.lower()+'.')
    return v
def digest(salt,flag):return hashlib.sha256((salt+flag).encode()).hexdigest()

def migrate(path):
    import sqlite3
    from contextlib import closing
    with closing(sqlite3.connect(path)) as c,c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS ctf_subjects(subject_id TEXT PRIMARY KEY REFERENCES subjects(id) ON DELETE CASCADE,enabled_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ctf_challenges(id TEXT PRIMARY KEY,topic_name TEXT NOT NULL REFERENCES topics(name) ON DELETE CASCADE,title TEXT NOT NULL,category TEXT NOT NULL,difficulty TEXT NOT NULL,points INTEGER NOT NULL,description TEXT NOT NULL,connection TEXT NOT NULL DEFAULT '',flag_salt TEXT,flag_hash TEXT,flag_format TEXT NOT NULL DEFAULT '',hints_json TEXT NOT NULL DEFAULT '[]',solution TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT '',position INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ctf_files(id TEXT PRIMARY KEY,challenge_id TEXT NOT NULL REFERENCES ctf_challenges(id) ON DELETE CASCADE,name TEXT NOT NULL,content BLOB NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ctf_progress(challenge_id TEXT PRIMARY KEY REFERENCES ctf_challenges(id) ON DELETE CASCADE,solved_at TEXT,attempts INTEGER NOT NULL DEFAULT 0,hints_used INTEGER NOT NULL DEFAULT 0,revealed INTEGER NOT NULL DEFAULT 0,found_flag TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',updated_at TEXT);
        CREATE TABLE IF NOT EXISTS ctf_attempts(id TEXT PRIMARY KEY,challenge_id TEXT NOT NULL REFERENCES ctf_challenges(id) ON DELETE CASCADE,submitted TEXT NOT NULL,correct INTEGER NOT NULL,at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS ctf_challenge_topic ON ctf_challenges(topic_name,position);
        CREATE INDEX IF NOT EXISTS ctf_attempt_challenge ON ctf_attempts(challenge_id,at);
        ''')
        cols={r[1] for r in c.execute("PRAGMA table_info(ctf_progress)")}
        if 'solution_code' not in cols:c.execute("ALTER TABLE ctf_progress ADD COLUMN solution_code TEXT NOT NULL DEFAULT ''")
        if 'review_json' not in cols:c.execute("ALTER TABLE ctf_progress ADD COLUMN review_json TEXT NOT NULL DEFAULT ''")

def row(c,key):
    r=c.execute('SELECT * FROM ctf_challenges WHERE id=?',(key,)).fetchone() if isinstance(key,str) else None
    if not r:raise ValueError('That challenge no longer exists.')
    return r
def progress(c,key):
    c.execute('INSERT OR IGNORE INTO ctf_progress(challenge_id) VALUES(?)',(key,))
    return c.execute('SELECT * FROM ctf_progress WHERE challenge_id=?',(key,)).fetchone()

def view(c,r):
    """What the browser may see: never the flag; hints only as far as revealed; the solution once earned or revealed."""
    p=c.execute('SELECT * FROM ctf_progress WHERE challenge_id=?',(r['id'],)).fetchone()
    p=dict(p) if p else {'solved_at':None,'attempts':0,'hints_used':0,'revealed':0,'found_flag':'','notes':'','solution_code':'','review_json':''}
    hints=json.loads(r['hints_json']);used=min(p['hints_used'],len(hints));open_solution=bool(p['solved_at'] or p['revealed'])
    return {'id':r['id'],'topic':r['topic_name'],'title':r['title'],'category':r['category'],'difficulty':r['difficulty'],'points':r['points'],
            'description':r['description'],'connection':r['connection'],'flag_format':r['flag_format'],'has_flag':bool(r['flag_hash']),'source':r['source'],
            'hints_total':len(hints),'hints':hints[:used],'has_solution':bool(r['solution']),'solution':r['solution'] if open_solution else None,
            'files':[{'id':f['id'],'name':f['name'],'size':f['size']} for f in c.execute('SELECT id,name,length(content) AS size FROM ctf_files WHERE challenge_id=? ORDER BY created_at',(r['id'],))],
            'position':r['position'],'updated_at':r['updated_at'],
            'progress':{'solved':bool(p['solved_at']),'solved_at':p['solved_at'],'attempts':p['attempts'],'hints_used':used,'revealed':bool(p['revealed']),'found_flag':p['found_flag'],'notes':p['notes'],
                        'solution_code':p.get('solution_code',''),'review':json.loads(p['review_json']) if p.get('review_json') else None,
                        'history':[dict(a) for a in c.execute('SELECT submitted,correct,at FROM ctf_attempts WHERE challenge_id=? ORDER BY at DESC LIMIT 20',(r['id'],))]}}

def state(c):
    return {'subjects':[r[0] for r in c.execute('SELECT subject_id FROM ctf_subjects')],
            'challenges':[view(c,r) for r in c.execute('SELECT * FROM ctf_challenges ORDER BY topic_name,position,created_at').fetchall()]}

def topic(c,name):
    r=c.execute('SELECT name FROM topics WHERE name=? AND parent_topic IS NULL',(name,)).fetchone() if isinstance(name,str) else None
    if not r:raise ValueError('Choose a topic for this challenge.')
    return r[0]

def clean(d):
    """Validate one challenge's fields (shared by the form and by imports)."""
    difficulty=d.get('difficulty') or 'easy'
    if difficulty not in DIFFICULTIES:raise ValueError('Difficulty must be '+', '.join(DIFFICULTIES)+'.')
    category=d.get('category') or 'misc'
    if category not in CATEGORIES:raise ValueError('Category must be '+', '.join(CATEGORIES)+'.')
    points=d.get('points')
    if points in (None,''):points=POINTS[difficulty]
    try:points=int(points)
    except (TypeError,ValueError):raise ValueError('Points must be a whole number.')
    if not 0<=points<=1000:raise ValueError('Points must be between 0 and 1,000.')
    hints=d.get('hints') or []
    if not isinstance(hints,list) or len(hints)>MAX_HINTS:raise ValueError(f'Add at most {MAX_HINTS} hints.')
    hints=[h for h in (text(h,2000,'Each hint') for h in hints) if h]
    return {'title':text(d.get('title'),160,'A challenge title',True),'category':category,'difficulty':difficulty,'points':points,
            'description':text(d.get('description'),20000,'The description',True),'connection':text(d.get('connection'),300,'The connection details'),
            'flag_format':text(d.get('flag_format'),120,'The flag format'),'hints':hints,'solution':text(d.get('solution'),20000,'The solution'),'source':text(d.get('source'),500,'The source')}

def insert(c,topic_name,fields,flag):
    key=uid();stamp=now();position=c.execute('SELECT COALESCE(MAX(position),-1)+1 FROM ctf_challenges WHERE topic_name=?',(topic_name,)).fetchone()[0]
    salt,hashed=(secrets.token_hex(16),None) if flag else (None,None)
    if flag:hashed=digest(salt,flag)
    c.execute('INSERT INTO ctf_challenges VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(key,topic_name,fields['title'],fields['category'],fields['difficulty'],fields['points'],fields['description'],fields['connection'],salt,hashed,fields['flag_format'],json.dumps(fields['hints']),fields['solution'],fields['source'],position,stamp,stamp))
    return key

# Words AI tools often use instead of the exact category and difficulty names.
SYNONYMS={'category':{'binary exploitation':'pwn','exploitation':'pwn','pwnable':'pwn','binary':'pwn','reverse engineering':'rev','reversing':'rev','reverse':'rev','re':'rev','web exploitation':'web','cryptography':'crypto','forensic':'forensics','miscellaneous':'misc','other':'misc'},
          'difficulty':{'beginner':'easy','intro':'easy','introductory':'easy','intermediate':'medium','moderate':'medium','advanced':'hard','difficult':'hard','expert':'insane'}}
def plain(v):
    """Drop markdown an AI tool may wrap around a one-line value: **bold**, __bold__ or `code`."""
    v=v.strip()
    for mark in ('**','__','`'):
        if len(v)>2*len(mark) and v.startswith(mark) and v.endswith(mark):v=v[len(mark):-len(mark)].strip()
    return v

def parse(source):
    """Read pasted challenges. Returns (challenges, errors). Each error names the challenge and line."""
    if not isinstance(source,str) or not source.strip():return [],[{'challenge':0,'line':0,'problem':'Paste at least one challenge.','fix':'Start each challenge with a “Challenge:” line.'}]
    if len(source)>400000:return [],[{'challenge':0,'line':0,'problem':'This paste is too long.','fix':'Import up to 50 challenges at a time.'}]
    challenges,errors,current,block,fenced=[],[],None,None,False
    def problem(line,what,fix):errors.append({'challenge':len(challenges),'line':line,'problem':what,'fix':fix})
    lines=source.replace('\r\n','\n').split('\n');filled=[i for i,l in enumerate(lines) if l.strip()]
    # AI tools often put the whole answer inside one code block: unwrap it.
    if filled and lines[filled[0]].strip().startswith('```'):
        lines[filled[0]]=''
        if len(filled)>1 and lines[filled[-1]].strip()=='```':lines[filled[-1]]=''
    for number,line in enumerate(lines,1):
        if block and line.strip().startswith('```'):fenced=not fenced
        # Inside a Description or Solution, code fences and indented lines are content, never new fields.
        # "**Category:** pwn" and "**Category**: pwn" read as "Category: pwn".
        probe=None if fenced or (block and line[:1].isspace()) else re.sub(r'^(\s*)(?:\*\*|__)([A-Za-z][A-Za-z0-9 ]{0,14}:?)(?:\*\*|__)',r'\1\2',line)
        match=re.match(r'^\s*([A-Za-z][A-Za-z0-9 ]{0,14}):\s?(.*)$',probe) if probe is not None else None
        field=match.group(1).strip().lower() if match else None
        if field and re.fullmatch(r'challenge\s*\d+',field):field='challenge'  # "Challenge 1: …"
        if field not in FIELDS:field=None
        if field=='challenge':
            current={'title':plain(match.group(2)),'hints':[],'line':number,'flag':''};challenges.append(current);block=None;fenced=False;continue
        if current is None:
            if line.strip():problem(number,'Text before the first challenge.','Start the paste with a “Challenge:” line.')
            continue
        if field=='topic':problem(number,'Topic lines are not used here.','Remove the Topic line; choose the topic above instead.');continue
        if field in ('description','solution'):
            block=field;current[field]=match.group(2)+'\n' if match.group(2).strip() else '';continue
        if field:
            block=None;value=plain(match.group(2))
            if field in SYNONYMS:value=SYNONYMS[field].get(value.lower(),value.lower())
            if field=='points':value=(re.match(r'\d+',value) or [value])[0]  # "150 pts" → 150
            if field=='hint':current['hints'].append(value)
            else:current[{'flag format':'flag_format','connect':'connection'}.get(field,field)]=value
            continue
        if block:current[block]=current.get(block,'')+line+'\n'
        elif line.strip():problem(number,'This line is not part of any field.','Put it under “Description:” or “Solution:”, or start it with a field name.')
    if len(challenges)>MAX_IMPORT:problem(0,f'There are {len(challenges)} challenges.',f'Import at most {MAX_IMPORT} at a time.')
    ready=[]
    for index,ch in enumerate(challenges,1):
        try:
            fields=clean({k:(v.strip() if isinstance(v,str) else v) for k,v in ch.items()})
            fields['flag']=text(ch.get('flag'),300,'The flag');ready.append(fields)
        except ValueError as exc:errors.append({'challenge':index,'line':ch['line'],'problem':str(exc),'fix':'Fix this field in challenge '+str(index)+'.'})
    return ready,errors

def write(c,payload):
    action=payload.get('action');d=payload.get('data') or {};key=payload.get('id')
    if not c.in_transaction:c.execute('BEGIN IMMEDIATE')
    if action=='subject':
        subject=d.get('subject_id')
        if not isinstance(subject,str) or not c.execute('SELECT 1 FROM subjects WHERE id=?',(subject,)).fetchone():raise ValueError('Choose an existing subject.')
        if d.get('enabled'):c.execute('INSERT OR IGNORE INTO ctf_subjects VALUES(?,?)',(subject,now()))
        else:c.execute('DELETE FROM ctf_subjects WHERE subject_id=?',(subject,))
        return {'ok':True}
    if action in ('preview','import'):
        name=topic(c,d.get('topic_name'));ready,errors=parse(d.get('text'))
        summary=[{'title':x['title'],'category':x['category'],'difficulty':x['difficulty'],'points':x['points'],'has_flag':bool(x['flag']),'hints':len(x['hints']),'has_solution':bool(x['solution'])} for x in ready]
        if action=='preview' or errors:return {'ok':not errors,'challenges':summary,'errors':errors}
        return {'ok':True,'ids':[insert(c,name,x,x['flag']) for x in ready]}
    if action=='save':
        r=row(c,key) if key else None
        if r:
            if d.get('updated_at')!=r['updated_at']:raise ValueError('This challenge changed on another device. Reopen it before saving.')
            # Hints you have not revealed and a hidden solution never reach the browser: leaving them out keeps them.
            d={**d,'hints':json.loads(r['hints_json']) if d.get('hints') is None else d['hints'],'solution':r['solution'] if d.get('solution') is None else d['solution']}
        fields=clean(d);name=topic(c,d.get('topic_name'));flag=text(d.get('flag'),300,'The flag')
        if not r:return {'ok':True,'id':insert(c,name,fields,flag)}
        salt,hashed=r['flag_salt'],r['flag_hash']
        if flag:salt=secrets.token_hex(16);hashed=digest(salt,flag)
        elif d.get('remove_flag'):salt=hashed=None
        c.execute('UPDATE ctf_challenges SET topic_name=?,title=?,category=?,difficulty=?,points=?,description=?,connection=?,flag_salt=?,flag_hash=?,flag_format=?,hints_json=?,solution=?,source=?,updated_at=? WHERE id=?',
                  (name,fields['title'],fields['category'],fields['difficulty'],fields['points'],fields['description'],fields['connection'],salt,hashed,fields['flag_format'],json.dumps(fields['hints']),fields['solution'],fields['source'],now(),key))
        return {'ok':True,'id':key}
    if action=='file_delete':
        c.execute('DELETE FROM ctf_files WHERE id=?',(d.get('file_id'),));return {'ok':True}
    r=row(c,key)
    if action=='delete':c.execute('DELETE FROM ctf_challenges WHERE id=?',(key,));return {'ok':True}
    p=progress(c,key);stamp=now()
    if action=='submit':
        if not r['flag_hash']:raise ValueError('This challenge has no stored flag. Use “Mark as solved” when you have it.')
        flag=text(d.get('flag'),300,'The flag',True)
        correct=hmac.compare_digest(digest(r['flag_salt'],flag),r['flag_hash'])
        c.execute('INSERT INTO ctf_attempts VALUES(?,?,?,?,?)',(uid(),key,flag,int(correct),stamp))
        c.execute('UPDATE ctf_progress SET attempts=attempts+1,updated_at=? WHERE challenge_id=?',(stamp,key))
        if correct and not p['solved_at']:c.execute('UPDATE ctf_progress SET solved_at=?,found_flag=? WHERE challenge_id=?',(stamp,flag,key))
        message=None
        if not correct:
            prefix=r['flag_format'].split('{')[0] if '{' in r['flag_format'] else ''
            message=f'Flags for this challenge look like {r["flag_format"]}.' if prefix and not flag.startswith(prefix) else 'Not quite. Keep going.'
        return {'ok':True,'correct':correct,'message':message,'challenge':view(c,row(c,key))}
    elif action=='solve':
        if r['flag_hash'] and d.get('solved',True):raise ValueError('Submit the flag to solve this challenge.')
        if d.get('solved',True):c.execute('UPDATE ctf_progress SET solved_at=COALESCE(solved_at,?),found_flag=?,updated_at=? WHERE challenge_id=?',(stamp,text(d.get('found_flag'),300,'The flag you found'),stamp,key))
        else:c.execute('UPDATE ctf_progress SET solved_at=NULL,updated_at=? WHERE challenge_id=?',(stamp,key))
    elif action=='hint':
        total=len(json.loads(r['hints_json']))
        if p['hints_used']>=total:raise ValueError('There are no more hints for this challenge.')
        c.execute('UPDATE ctf_progress SET hints_used=hints_used+1,updated_at=? WHERE challenge_id=?',(stamp,key))
    elif action=='reveal':
        if not r['solution']:raise ValueError('This challenge has no solution written yet.')
        c.execute('UPDATE ctf_progress SET revealed=1,updated_at=? WHERE challenge_id=?',(stamp,key))
    elif action=='notes':c.execute('UPDATE ctf_progress SET notes=?,updated_at=? WHERE challenge_id=?',(text(d.get('notes'),50000,'Your notes'),stamp,key))
    elif action=='code':c.execute('UPDATE ctf_progress SET solution_code=?,updated_at=? WHERE challenge_id=?',(text(d.get('code'),100000,'Your code'),stamp,key))
    elif action=='reset':
        c.execute("UPDATE ctf_progress SET solved_at=NULL,attempts=0,hints_used=0,revealed=0,found_flag='',updated_at=? WHERE challenge_id=?",(stamp,key))
        c.execute('DELETE FROM ctf_attempts WHERE challenge_id=?',(key,))
    elif action=='file':
        name=Path(text(d.get('name'),160,'A file name',True)).name
        if not name or name.startswith('.'):raise ValueError('Choose a file with a normal name.')
        raw=d.get('base64')
        if not isinstance(raw,str) or len(raw)>MAX_FILE*4//3+8:raise ValueError('Files must be at most 10 MB.')
        try:blob=base64.b64decode(raw,validate=True)
        except Exception:raise ValueError('That file could not be read.')
        if not blob or len(blob)>MAX_FILE:raise ValueError('Files must be between 1 byte and 10 MB.')
        used=c.execute('SELECT COALESCE(SUM(length(f.content)),0) FROM ctf_files f JOIN ctf_challenges ch ON ch.id=f.challenge_id WHERE ch.topic_name=?',(r['topic_name'],)).fetchone()[0]
        if used+len(blob)>MAX_TOPIC_FILES:raise ValueError('This topic has reached its 100 MB limit for challenge files.')
        c.execute('INSERT INTO ctf_files VALUES(?,?,?,?,?)',(uid(),key,name,blob,stamp))
    else:raise ValueError('Unknown CTF action.')
    return {'ok':True,'challenge':view(c,row(c,key))}

MAX_REVIEW_CHARS=16000
REVIEW_SCHEMA={'type':'object','properties':{
    'verdict':{'type':'string','enum':['correct','close','wrong']},
    'summary':{'type':'string'},
    'issues':{'type':'array','items':{'type':'object','properties':{'problem':{'type':'string'},'fix':{'type':'string'}}}},
    'next_step':{'type':'string'}},'required':['verdict','summary']}
REVIEW_SYSTEM=(
    "You are a CTF binary-exploitation mentor reviewing a student's own solve script for a pwn challenge in their university course. "
    "The challenge's C source, disassembly, protections and program I/O are inside \"description\"; you also get its hints, its flag format, and the student's code. "
    "Decide whether the student's exploit would correctly solve THIS specific challenge, and help them fix it. "
    "Be concrete: name the exact byte offset, gadget, address, struct field or recv/send call that is wrong or missing, and how to correct it, using the challenge's own numbers. "
    "Never reveal, guess, print or encode the flag, and do not write the full working exploit for them \u2014 only point out what to change. "
    "verdict: \"correct\" = this code would get the flag as written; \"close\" = right approach with one or two concrete bugs; \"wrong\" = wrong technique or missing the core step. "
    "If it is correct, say so briefly and tell them to run it locally and submit the real flag. Keep feedback tight and practical.")

def review_context(c,key,code):
    """Save the student's code and return the context the reviewer needs. The flag and the written solution are never included."""
    r=row(c,key);progress(c,key);code=text(code,100000,'Your code')
    c.execute('UPDATE ctf_progress SET solution_code=?,updated_at=? WHERE challenge_id=?',(code,now(),key))
    return {'title':r['title'],'category':r['category'],'difficulty':r['difficulty'],'description':r['description'][:MAX_REVIEW_CHARS],
            'connection':r['connection'],'hints':json.loads(r['hints_json']),'flag_format':r['flag_format'],'code':code[:MAX_REVIEW_CHARS]}

def review_prompt(ctx):
    """(system, messages, schema) for llm_router.run('ctf_review', ...). Pure function, so it is unit-testable."""
    if not ctx.get('code','').strip():raise ValueError('Write your solution first, then ask for a review.')
    challenge={k:ctx[k] for k in ('title','category','difficulty','description','connection','hints','flag_format')}
    messages=[{'role':'user','content':json.dumps({'challenge':challenge,'student_code':ctx['code']})}]
    return REVIEW_SYSTEM,messages,REVIEW_SCHEMA

def normalize_review(result,meta=None):
    issues=[]
    for it in (result.get('issues') or [])[:12]:
        if isinstance(it,dict):issues.append({'problem':text(it.get('problem'),2000,'Problem'),'fix':text(it.get('fix'),2000,'Fix')})
        elif isinstance(it,str):issues.append({'problem':text(it,2000,'Problem'),'fix':''})
    verdict=result.get('verdict') if result.get('verdict') in ('correct','close','wrong') else 'close'
    return {'verdict':verdict,'summary':text(result.get('summary'),4000,'Summary'),'issues':issues,
            'next_step':text(result.get('next_step'),2000,'Next step'),'model':(meta or {}).get('model',''),'at':now()}

def save_review(c,key,review):
    row(c,key);progress(c,key)
    c.execute('UPDATE ctf_progress SET review_json=?,updated_at=? WHERE challenge_id=?',(json.dumps(review),now(),key))
    return view(c,row(c,key))

def download(c,file_id):
    r=c.execute('SELECT name,content FROM ctf_files WHERE id=?',(file_id,)).fetchone()
    if not r:raise ValueError('That file no longer exists.')
    return bytes(r['content']),r['name']
