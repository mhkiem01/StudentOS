"""Reviewed app actions with allowlisted adapters and account-local retry receipts."""
import json, re, sqlite3, uuid, hashlib
from contextlib import closing
from datetime import datetime, timezone, timedelta, date
import assistant_catalog as catalog
import gym_store, finance_store, general_todos, calendar_store, reminders_store, notes_store, quick_review_store

def encode(v):return json.dumps(v,ensure_ascii=False,allow_nan=False,sort_keys=True)
def now():return datetime.now(timezone.utc).isoformat()

def migrate(path, backups):
    with closing(sqlite3.connect(path)) as con:
        if con.execute("SELECT 1 FROM sqlite_master WHERE name='assistant_requests'").fetchone():return
        backups.mkdir(parents=True,exist_ok=True)
        with closing(sqlite3.connect(backups/('before-assistant-actions-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))) as dest:con.backup(dest)
        con.execute('CREATE TABLE assistant_requests(id TEXT PRIMARY KEY,payload TEXT NOT NULL,status TEXT NOT NULL,result TEXT,created_at TEXT NOT NULL)');con.commit()

def normalise(proposal):
    if not isinstance(proposal,dict):raise ValueError('Invalid action proposal.')
    op=proposal.get('operation');meta=catalog.OPERATIONS.get(op)
    if not meta:raise ValueError('Unsupported action. Use the capability list or the dedicated screen.')
    d=proposal.get('data',{});key=proposal.get('id') or None
    if not isinstance(d,dict) or len(encode(d))>100000:raise ValueError('Action details must be an object under 100,000 characters.')
    if key is not None and (not isinstance(key,(str,int)) or isinstance(key,bool) or len(str(key))>200):raise ValueError('Invalid record identifier.')
    unknown=set(d)-set(meta['fields'])
    if unknown:raise ValueError('Unsupported fields for '+op+': '+', '.join(sorted(unknown)))
    # IDs and roles never come from a model-controlled path or user identity.
    if op=='navigate.open' and d.get('view') not in catalog.VIEWS:raise ValueError('Unknown destination.')
    return dict(operation=op,id=key,data=d)

def references(app):
    """Human-readable targets from the already visibility-filtered context only."""
    found={}
    def visit(v):
        if isinstance(v,list):
            for x in v:visit(x)
        elif isinstance(v,dict):
            key=v.get('id') or v.get('user_id')
            detail=v.get('data') if isinstance(v.get('data'),dict) else v.get('metadata') if isinstance(v.get('metadata'),dict) else {}
            title=v.get('name') or v.get('title') or v.get('description') or detail.get('name') or detail.get('title') or v.get('display_name')
            if key and title:found[str(key)]=str(title)[:200]
            for k,x in v.items():
                if k!='capabilities':visit(x)
    visit(app);return found

def prepare(con,payload):
    proposal=normalise(payload.get('proposal'));key=payload.get('request_id')
    if not isinstance(key,str) or not re.fullmatch(r'[a-zA-Z0-9_-]{12,100}',key):raise ValueError('Invalid review identifier.')
    serialized=encode(proposal)
    if not con.in_transaction:con.execute('BEGIN IMMEDIATE')
    old=con.execute('SELECT * FROM assistant_requests WHERE id=?',(key,)).fetchone()
    if old and old['payload']!=serialized:raise ValueError('This review changed. Open a fresh review before saving.')
    if not old:con.execute("INSERT INTO assistant_requests VALUES(?,?,'draft',NULL,?)",(key,serialized,now()))
    return dict(ok=True,request_id=key,proposal=proposal,risk=catalog.OPERATIONS[proposal['operation']]['risk'],status=old['status'] if old else 'draft')

def execute(connect,request,auth_path,user_id):
    if request.get('confirmed') is not True:raise ValueError('Review and confirm this action first.')
    key=request.get('request_id')
    with connect() as con:
        con.execute('BEGIN IMMEDIATE')
        row=con.execute('SELECT * FROM assistant_requests WHERE id=?',(key,)).fetchone()
        if not row:raise ValueError('Review not found in this account. Prepare it again.')
        if row['status']=='applied':return json.loads(row['result'])
        if row['status']=='pending':raise ValueError('This shared action may already have been sent. Check its destination; it will not be retried automatically.')
        if row['status']=='failed':raise ValueError('This action failed. Review the error and prepare a new corrected proposal.')
        if datetime.now(timezone.utc)-datetime.fromisoformat(row['created_at'])>timedelta(minutes=30):raise ValueError('Review expired after 30 minutes. Prepare a fresh review.')
        p=json.loads(row['payload']);meta=catalog.OPERATIONS[p['operation']]
        if meta['risk'] in ('shared','destructive') and request.get('acknowledged') is not True:raise ValueError('Explicitly acknowledge the shared/destructive action.')
        shared=meta['module'] in ('social','market','settings')
        if shared:
            # Reserve first. An interruption after an external commit is deliberately
            # NOT retried: prefer an explicit uncertain state over duplicate messages.
            con.execute("UPDATE assistant_requests SET status='pending' WHERE id=?",(key,))
        else:
            result=apply_private(con,p)
            if result.get('ok') is False:raise ValueError(result.get('error') or '; '.join(map(str,result.get('errors',[]))) or 'Action was not applied.')
            result={**result,'ok':True,'operation':p['operation']}
            con.execute("UPDATE assistant_requests SET status='applied',result=? WHERE id=?",(encode(result),key))
            return result
    try:
        import social_store,marketplace_store,accounts
        if meta['module']=='settings':
            with accounts.db(auth_path) as c:user=accounts.unpack(c.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone())
            accounts.update_profile(auth_path,user,{'display_name':user['display_name'],**p['data']});result={'ok':True}
        else:
            writer=social_store.write if meta['module']=='social' else marketplace_store.write
            result=writer(auth_path,user_id,dict(action=meta['action'],id=p['id'],data=p['data']))
    except (ValueError,PermissionError,sqlite3.IntegrityError) as exc:
        with connect() as con:con.execute("UPDATE assistant_requests SET status='failed',result=? WHERE id=?",(encode({'error':str(exc)}),key))
        raise
    result={**result,'ok':True,'operation':p['operation']}
    with connect() as con:con.execute("UPDATE assistant_requests SET status='applied',result=? WHERE id=?",(encode(result),key))
    return result

def required_row(con,table,key,column='id'):
    row=con.execute('SELECT * FROM '+table+' WHERE '+column+'=?',(key,)).fetchone()
    if not row:raise ValueError('Selected record no longer exists. Refresh and choose it again.')
    return dict(row)

def apply_private(con,p):
    module,action=p['operation'].split('.',1);d=dict(p['data']);key=p['id']
    deleting=action.startswith('delete') or action=='cancel'
    if action.startswith('delete') and action not in ('delete_topic',) and module not in ('quizzes','topics') and not key:raise ValueError('Choose the existing record to delete.')
    if module=='navigate':return {'ok':True,'view':d['view']}
    if module in ('finance','gym','quick'):
        writer={'finance':finance_store.write,'gym':gym_store.write,'quick':quick_review_store.write}[module]
        # Profile actions are intentional opt-ins, never silently enable a module.
        if module=='finance' and key and action in finance_store.TABLES:
            old=required_row(con,'finance_'+action,key)
            scale=finance_store.scale(finance_store.profile(con)['currency'])
            for money in ('amount','target','starting','monthly','weekly'):
                if money in old:old[money]=str(old[money]/scale)
            if action=='goals':old={**old,**json.loads(old['data'])}
            d={**old,**d}
        if module=='gym' and key and action=='workout':d={**json.loads(required_row(con,'gym_workouts',key)['data']),**d}
        return writer(con,dict(action=action,id=key,data=d))
    if module=='todos':return general_todos.write(con,dict(action=action,id=key,item={**d,**({'id':key} if key else {})},**d))
    tables={'calendar':'timetable_events','reminders':'reminders','notes':'notes','subjects':'subjects'}
    if module in tables:
        table=tables[module];old=required_row(con,table,key) if key else {}
        if action=='delete':con.execute('DELETE FROM '+table+' WHERE id=?',(key,));return {'ok':True}
        key=key or uuid.uuid4().hex;item={**old,**d,'id':key}
        if module=='calendar':calendar_store.write(con,calendar_store.validate(item))
        elif module=='reminders':reminders_store.write(con,reminders_store.validate(item))
        elif module=='notes':notes_store.save(con,item)
        else:
            name=gym_store.text(item.get('name'),'subject name',120);color=item.get('color','#7445f5');category=item.get('category','general')
            if not re.fullmatch(r'#[0-9a-fA-F]{6}',color) or category not in ('general','coding','language'):raise ValueError('Choose a hex colour and general/coding/language category.')
            con.execute('INSERT INTO subjects(id,name,color,category) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,category=excluded.category',(key,name,color,category))
        return {'ok':True,'id':key}
    if module=='topics':
        if action=='delete':required_row(con,'topics',d.get('topic_name'),'name');con.execute('DELETE FROM topics WHERE name=?',(d['topic_name'],));return {'ok':True}
        name=gym_store.text(d.get('name'),'topic name',200);required_row(con,'subjects',d.get('subject_id'));color=d.get('color','#7445f5')
        if not re.fullmatch(r'#[0-9a-fA-F]{6}',color):raise ValueError('Choose a valid hex colour.')
        if con.execute('SELECT 1 FROM topics WHERE name=?',(name,)).fetchone():raise ValueError('A topic with this name already exists.')
        con.execute('INSERT INTO topics(name,color) VALUES(?,?)',(name,color));con.execute('INSERT INTO subject_topics(subject_id,topic_name) VALUES(?,?)',(d['subject_id'],name));return {'ok':True,'id':name}
    if module in ('questions','quizzes','flashcards'):
        table='flashcards' if module=='flashcards' else 'questions'
        old=required_row(con,table,key) if key else None
        topic=old['topic_name'] if old else d.get('topic_name');required_row(con,'topics',topic,'name')
        if module=='quizzes' and action=='settings':
            if d.get('mode') not in ('normal','mastery') or type(d.get('target',3)) is not int or not 1<=d.get('target',3)<=100:raise ValueError('Choose normal/mastery and a target from 1 to 100.')
            row=con.execute("SELECT value FROM app_meta WHERE key='quiz_settings'").fetchone();settings=json.loads(row[0]) if row else {};settings[topic]={'mode':d['mode'],'target':d.get('target',3)}
            con.execute("INSERT OR REPLACE INTO app_meta VALUES('quiz_settings',?)",(encode(settings),))
        elif action in ('delete','delete_topic'):
            if module=='quizzes' or action=='delete_topic':con.execute('DELETE FROM '+table+' WHERE topic_name=?',(topic,))
            else:con.execute('DELETE FROM '+table+' WHERE id=?',(key,))
        elif action=='reorder':
            ids=d.get('ids');existing=[r[0] for r in con.execute('SELECT id FROM '+table+' WHERE topic_name=?',(topic,))]
            if not isinstance(ids,list) or len(ids)!=len(existing) or set(ids)!=set(existing):raise ValueError('Include every current record id exactly once.')
            for pos,record in enumerate(ids):con.execute('UPDATE '+table+' SET position=? WHERE id=?',(pos,record))
        else:
            item={**(json.loads(old['data_json']) if old else {}),**d};item.pop('topic_name',None)
            for name in ('front','back') if table=='flashcards' else ('question','answer'):gym_store.text(item.get(name),name,20000)
            if table=='questions':
                choices=item.get('choices');answers=[a.strip().upper() for a in item['answer'].split(',')]
                if not isinstance(choices,dict) or not 2<=len(choices)<=8 or any(not re.fullmatch('[A-H]',str(k)) or not isinstance(v,str) or not v.strip() for k,v in choices.items()) or any(a not in choices for a in answers):raise ValueError('Use 2–8 labelled choices (A–H) and valid answer letters.')
                item['answer']=','.join(sorted(set(answers)));item.pop('mastery',None);item.pop('masteryCorrect',None)
            if old:con.execute('UPDATE '+table+' SET data_json=? WHERE id=?',(encode(item),key))
            else:
                pos=con.execute('SELECT COALESCE(MAX(position),-1)+1 FROM '+table+' WHERE topic_name=?',(topic,)).fetchone()[0]
                key=con.execute('INSERT INTO '+table+'(topic_name,position,data_json) VALUES(?,?,?)',(topic,pos,encode(item))).lastrowid
        # Index-based checkpoints become invalid after content changes.
        con.execute('DELETE FROM '+('flashcard_progress' if table=='flashcards' else 'topic_sessions')+' WHERE topic_name=?',(topic,))
        return {'ok':True,'id':key}
    raise ValueError('This action needs its dedicated screen.')

def scopes(messages):
    text=' '.join(str(m.get('content','')) for m in (messages or [])[-4:] if m.get('role')=='user').lower()
    groups={
      'finance':r'money|income|earn|paid|pay|rent|grocer|expense|budget|financ|bill|balance|saving|salary|dollar|\$',
      'gym':r'gym|workout|exercise|protein|calorie|nutrient|breakfast|lunch|dinner|meal|nutrition|weight|fitness|training',
      'todos':r'todo|to.do|task|chore','calendar':r'timetable|calendar|schedule|class|appointment',
      'reminders':r'remind|deadline|due','notes':r'note|summari',
      'subjects':r'subject|course','topics':r'topic','questions':r'quiz|question','flashcards':r'flashcard|flip card',
      'quick':r'quick review|memor','social':r'social|friend|message|post|club|project|team|study group|meeting',
      'market':r'marketplace|tutor|booking|listing|seller|cart|review|purchase','settings':r'setting|theme|dark|light|name'}
    selected={k for k,pattern in groups.items() if re.search(pattern,text)}
    if 'questions' in selected:selected.add('quizzes')
    return selected or {'todos','calendar','reminders','notes','subjects','finance','gym'}

def context(con,messages,auth_path,user_id):
    selected=scopes(messages);result={'current_date':date.today().isoformat(),'scope':sorted(selected),'manual_steps':catalog.MANUAL}
    result['capabilities']={k:v for k,v in catalog.OPERATIONS.items() if v['module'] in selected or v['module']=='navigate'}
    result['all_modules']=sorted({m['module'] for m in catalog.OPERATIONS.values()})
    result['views']=catalog.VIEWS
    result['subjects']=[dict(r) for r in con.execute('SELECT id,name FROM subjects LIMIT 100')]
    result['topics']=[dict(r) for r in con.execute('SELECT topic_name,subject_id FROM subject_topics LIMIT 100')]
    for module,table in [('calendar','timetable_events'),('reminders','reminders'),('todos','general_todos'),('notes','notes'),('questions','questions'),('flashcards','flashcards')]:
        if module in selected:
            rows=[dict(r) for r in con.execute('SELECT * FROM '+table+' ORDER BY rowid DESC LIMIT 40')]
            for r in rows:
                if 'data_json' in r:r['data']=json.loads(r.pop('data_json'))
                if 'content' in r:r['content']=r['content'][:3000]
            result[module]=rows
    if 'finance' in selected:
        p=finance_store.profile(con);s=finance_store.state(con);result['finance']={k:s[k] for k in ('profile','transactions','goals','budgets','bills','income_schedules','balance') if k in s}
        result['finance_money_units']='Stored amounts in this context are minor units. Divide by '+str(finance_store.scale(p['currency']))+' for action amounts in '+p['currency']+'. Do not convert user-entered amounts a second time.'
        result['expense_categories']=finance_store.CATEGORIES
    if 'gym' in selected:result['gym']=gym_store.state(con)
    if 'quick' in selected:result['quick']=quick_review_store.state(con)
    if 'social' in selected:
        import social_store
        result['social']=social_store.state(auth_path,user_id)
    if 'market' in selected:
        import marketplace_store
        s=marketplace_store.state(auth_path,user_id);result['market']={k:v for k,v in s.items() if k not in ('reports','ledger','sales')}
    if 'settings' in selected:
        import accounts
        with accounts.db(auth_path) as c:
            user=accounts.unpack(c.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone())
            result['settings']={'display_name':user['display_name'],**{k:v for k,v in user['profile'].items() if k!='photo'}}
    def bounded(v):
        if isinstance(v,list):return [bounded(x) for x in v[:40]]
        if isinstance(v,dict):return {k:bounded(x) for k,x in v.items() if k not in ('avatar','avatar_data','image','photo','base64')}
        return v[:3000] if isinstance(v,str) and len(v)>3000 else v
    result=bounded(result)
    # Bound actual model input, not merely the number of records. Rich notes and
    # public feeds must not push the action instructions out of the context window.
    def shorten(v,count,length):
        if isinstance(v,list):return [shorten(x,count,length) for x in v[:count]]
        if isinstance(v,dict):return {k:shorten(x,count,length) for k,x in v.items()}
        return v[:length] if isinstance(v,str) else v
    for count,length in [(15,1200),(5,600),(1,300)]:
        if len(encode(result))<=38000:break
        for k in list(result):
            if k not in ('capabilities','manual_steps','current_date','views','all_modules','scope'):result[k]=shorten(result[k],count,length)
    result['coverage']='Lists contain at most 40 recent/visible records and may be further shortened to fit the model. Note content may be excerpted. Do not claim this is every record. Ask for clarification if a referenced item is missing or ambiguous. Existing record ids must come from this context.'
    return result
