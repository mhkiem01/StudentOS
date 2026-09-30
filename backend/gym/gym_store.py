"""Optional, local-only fitness records. No academic tables are modified.

JSON stores versionable profile/workout snapshots; sets have explicit foreign keys.
All weights are stored in kg, measurements in cm, independent of display units.
"""
import json, math, sqlite3, uuid
from datetime import date, datetime, timezone
from contextlib import closing

DEFAULTS = dict(enabled=False, level='beginner', goal='muscle', equipment='gym', duration=45, units='kg')
def stamp(): return datetime.now(timezone.utc).isoformat()
def encode(value): return json.dumps(value, ensure_ascii=False, allow_nan=False)
def number(value, name, low=0, high=10000):
    if isinstance(value, bool): raise ValueError(name+' must be a number.')
    try: value=float(value)
    except (ValueError,TypeError): raise ValueError(name+' must be a number.')
    if not math.isfinite(value) or not low<=value<=high: raise ValueError(f'{name} must be between {low} and {high}.')
    return value
def day(value):
    try: return date.fromisoformat(value).isoformat()
    except (ValueError,TypeError): raise ValueError('Use a valid date.')
def text(value, name, limit=300):
    if not isinstance(value,str) or not value.strip() or len(value)>limit: raise ValueError('Enter a valid '+name+'.')
    return value.strip()

def migrate(path, backups):
    with closing(sqlite3.connect(path)) as con:
        if con.execute("SELECT 1 FROM sqlite_master WHERE name='gym_profile'").fetchone(): return
        backups.mkdir(parents=True,exist_ok=True)
        with closing(sqlite3.connect(backups/('before-gym-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))) as dest: con.backup(dest)
        con.executescript('''BEGIN IMMEDIATE;
        CREATE TABLE gym_profile(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
        CREATE TABLE gym_workouts(id TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE gym_sessions(id TEXT PRIMARY KEY,date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','completed','cancelled')),data TEXT NOT NULL,created_at TEXT NOT NULL,completed_at TEXT);
        CREATE UNIQUE INDEX gym_one_active ON gym_sessions(status) WHERE status='active';
        CREATE TABLE gym_sets(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES gym_sessions(id) ON DELETE CASCADE,exercise_id TEXT NOT NULL,position INTEGER NOT NULL,weight REAL NOT NULL CHECK(weight>=0),reps INTEGER NOT NULL CHECK(reps>0),rpe TEXT,notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,UNIQUE(session_id,exercise_id,position));
        CREATE TABLE gym_measurements(id TEXT PRIMARY KEY,date TEXT NOT NULL,data TEXT NOT NULL);
        CREATE TABLE gym_food_logs(id TEXT PRIMARY KEY,date TEXT NOT NULL,data TEXT NOT NULL);
        CREATE TABLE gym_nutrition_targets(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE gym_schedule(date TEXT PRIMARY KEY,label TEXT NOT NULL);
        COMMIT;''')

def profile(con):
    row=con.execute('SELECT data FROM gym_profile WHERE id=1').fetchone()
    return {**DEFAULTS,**(json.loads(row[0]) if row else {})}
def state(con):
    import gym_journey
    if not con.in_transaction: con.execute('BEGIN IMMEDIATE')
    p=profile(con)
    journey=gym_journey.progress(con,p)
    result={'profile':p,'journey':journey}
    result['calendar_workouts']=[{**dict(r),'workout':json.loads(r['workout'])} for r in con.execute('SELECT e.*,g.workout FROM gym_calendar_links g JOIN timetable_events e ON e.id=g.event_id ORDER BY e.event_date,e.start_time')]
    for key in ['workouts','sessions','measurements','food_logs']:
        result[key]=[{**dict(r),'data':json.loads(r['data'])} for r in con.execute('SELECT * FROM gym_'+key+' ORDER BY rowid DESC')]
    result['sets']=[dict(r) for r in con.execute('SELECT * FROM gym_sets ORDER BY created_at')]
    result['schedule']=[dict(r) for r in con.execute('SELECT * FROM gym_schedule ORDER BY date')]
    row=con.execute('SELECT data FROM gym_nutrition_targets WHERE id=1').fetchone()
    result['targets']=json.loads(row[0]) if row else None
    return result

def nutrition(data):
    # Mifflin–St Jeor (1990): https://pubmed.ncbi.nlm.nih.gov/2305711/
    # Conventional activity multipliers and modest +/-10% goal adjustment are
    # configurable product heuristics, not validated personal prescriptions.
    height=number(data.get('height'),'Height (cm)',100,250)
    weight=number(data.get('weight'),'Weight (kg)',35,300)
    age=number(data.get('age'),'Age',18,100)
    sex=data.get('sex'); activity=data.get('activity'); goal=data.get('goal')
    factors={'sedentary':1.2,'light':1.375,'moderate':1.55,'very':1.725,'high':1.9}
    if sex not in ('male','female') or activity not in factors or goal not in ('lose','maintain','gain'): raise ValueError('Choose a calculation profile, activity level and nutrition goal.')
    if data.get('adult_confirmation') is not True: raise ValueError('Confirm this adult estimate is appropriate for you. It is not for pregnancy, breastfeeding or medical dietary needs.')
    bmr=10*weight+6.25*height-5*age+(5 if sex=='male' else -161)
    calories=round(bmr*factors[activity]*{'lose':.9,'maintain':1,'gain':1.1}[goal])
    # 1.4–2.0 g/kg/day range for exercising adults: ISSN 2017,
    # https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/ . Use 1.4 maintenance,
    # 1.6 gain and 1.8 loss as transparent, adjustable general estimates.
    protein=round(weight*{'maintain':1.4,'gain':1.6,'lose':1.8}[goal])
    fat=round(calories*.3/9); carbs=round((calories-protein*4-fat*9)/4)
    if carbs<0: raise ValueError('These inputs do not produce a useful general estimate. Please seek individual nutrition advice.')
    return dict(inputs=dict(height=height,weight=weight,age=age,sex=sex,activity=activity,goal=goal,adult_confirmation=True),calories=calories,protein=protein,fat=fat,carbs=carbs,method='Mifflin–St Jeor + activity; 10% goal adjustment; 30% fat; remaining carbohydrate')

def workout(data):
    name=text(data.get('name'),'workout name',120); rows=data.get('exercises')
    if not isinstance(rows,list) or not 1<=len(rows)<=20: raise ValueError('Choose 1–20 exercises.')
    clean=[]; seen=set()
    for r in rows:
        eid=text(r.get('id'),'exercise id',80)
        if eid in seen: raise ValueError('Choose each exercise only once.')
        seen.add(eid)
        sets=number(r.get('sets'),'Sets',1,10);reps=number(r.get('reps'),'Reps',1,100)
        if sets!=int(sets) or reps!=int(reps): raise ValueError('Sets and reps must be whole numbers.')
        unit=r.get('unit','reps')
        if unit not in ('reps','seconds'): raise ValueError('Exercise unit must be reps or seconds.')
        maximum=number(r.get('reps_max',reps),'Upper rep/duration target',reps,100)
        if maximum!=int(maximum): raise ValueError('Upper target must be a whole number.')
        clean.append(dict(id=eid,name=text(r.get('name',eid),'exercise name',120),unit=unit,reps_max=int(maximum),sets=int(sets),reps=int(reps),weight=None if r.get('weight') in (None,'') else number(r['weight'],'Target weight',0,600)))
    return dict(name=name,exercises=clean,level=text(data.get('level','custom'),'level',30),duration=int(number(data.get('duration',45),'Duration',5,240)))

def write(con, payload):
    action=payload.get('action'); data=payload.get('data',{}); ident=payload.get('id') or str(uuid.uuid4())
    if not isinstance(ident,str) or len(ident)>100 or not isinstance(data,dict): raise ValueError('Invalid request.')
    if not con.in_transaction:con.execute('BEGIN IMMEDIATE')
    p=profile(con)
    if action=='profile':
        allowed={'enabled':(True,False),'level':('beginner','intermediate','advanced'),'goal':('muscle','strength','fitness','loss'),'equipment':('gym','dumbbells','bodyweight'),'duration':(30,45,60,75,90),'units':('kg','lb')}
        for key,value in data.items():
            if key not in allowed or value not in allowed[key]: raise ValueError('Invalid gym preference: '+key)
        p.update(data);con.execute('INSERT INTO gym_profile VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',(encode(p),))
        return {'ok':True}
    if not p['enabled']: raise ValueError('Enable Gym in Settings first. Your saved data is kept.')
    import gym_journey
    if gym_journey.write(con,action,data,ident,p): return {'ok':True,'id':ident}
    if action=='workout':
        w=workout(data);con.execute('INSERT INTO gym_workouts VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',(ident,encode(w),stamp()))
    elif action=='delete_workout': con.execute('DELETE FROM gym_workouts WHERE id=?',(ident,))
    elif action=='start':
        active=con.execute("SELECT id FROM gym_sessions WHERE status='active'").fetchone()
        if active:return {'ok':True,'id':active[0]}
        w=workout(data);w['cursor']=0;chosen=day(data.get('date'))
        if chosen>date.today().isoformat():raise ValueError('Use the weekly plan for future workouts, not a workout log.')
        con.execute("INSERT INTO gym_sessions VALUES(?,?,'active',?,?,NULL)",(ident,chosen,encode(w),stamp()))
    elif action in ('cursor','session_date','set','finish','cancel'):
        row=con.execute("SELECT * FROM gym_sessions WHERE id=?",(data.get('session_id'),)).fetchone()
        if not row: raise ValueError('Workout session not found.')
        if row['status']!='active':
            if action=='finish' and row['status']=='completed': return {'ok':True}
            raise ValueError('This workout is no longer active.')
        w=json.loads(row['data'])
        if action=='session_date':
            chosen=day(data.get('date'))
            if chosen>date.today().isoformat():raise ValueError('A workout log cannot be dated in the future. Use the weekly plan instead.')
            con.execute('UPDATE gym_sessions SET date=? WHERE id=?',(chosen,row['id']))
        elif action=='cursor':
            pos=int(number(data.get('cursor'),'Exercise',0,len(w['exercises'])-1));w['cursor']=pos
            con.execute('UPDATE gym_sessions SET data=? WHERE id=?',(encode(w),row['id']))
        elif action=='set':
            eid=data.get('exercise_id')
            if eid not in [r['id'] for r in w['exercises']]: raise ValueError('Exercise is not in this session.')
            weight=number(data.get('weight'),'Weight',0,600); reps=number(data.get('reps'),'Reps',1,100)
            pos=number(data.get('position'),'Set number',1,100)
            if reps!=int(reps) or pos!=int(pos): raise ValueError('Reps and set number must be whole numbers.')
            rpe=data.get('rpe') or None
            if rpe not in (None,'Easy','Moderate','Hard','Very Hard'):raise ValueError('Invalid difficulty.')
            notes=data.get('notes','')
            if not isinstance(notes,str) or len(notes)>2000:raise ValueError('Notes must be under 2,000 characters.')
            previous=con.execute('SELECT weight,reps,rpe,notes FROM gym_sets WHERE session_id=? AND exercise_id=? AND position=?',(row['id'],eid,int(pos))).fetchone()
            if previous and tuple(previous)!=(weight,int(reps),rpe,notes):raise ValueError('This set was already logged with different values. Reload the workout to see the saved set before continuing.')
            # The session/exercise/set key makes retries idempotent.
            con.execute('INSERT INTO gym_sets VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id,exercise_id,position) DO NOTHING',(ident,row['id'],eid,int(pos),weight,int(reps),rpe,notes,stamp()))
        else:
            if action=='finish' and not con.execute('SELECT 1 FROM gym_sets WHERE session_id=?',(row['id'],)).fetchone():raise ValueError('Log at least one set before finishing, or cancel the workout.')
            con.execute('UPDATE gym_sessions SET status=?,completed_at=? WHERE id=?',('completed' if action=='finish' else 'cancelled',stamp(),row['id']))
    elif action=='nutrition':
        n=nutrition(data);con.execute('INSERT INTO gym_nutrition_targets VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',(encode(n),stamp()))
    elif action=='food':
        clean={'name':text(data.get('name'),'meal name',150),**{k:number(data.get(k),k,0,15000 if k=='calories' else 2000) for k in ['calories','protein','carbs','fat']}}
        con.execute('INSERT INTO gym_food_logs VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',(ident,day(data.get('date')),encode(clean)))
    elif action=='delete_food':con.execute('DELETE FROM gym_food_logs WHERE id=?',(ident,))
    elif action=='measurement':
        if day(data.get('date'))>date.today().isoformat(): raise ValueError('Measurements cannot be dated in the future.')
        clean={k:number(data[k],k,1,400) for k in ['weight','waist','chest','arms','legs'] if data.get(k) not in (None,'')}
        if not clean:raise ValueError('Enter at least one measurement.')
        con.execute('INSERT INTO gym_measurements VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',(ident,day(data.get('date')),encode(clean)))
    elif action=='schedule':
        label=data.get('label','')
        if not isinstance(label,str) or len(label)>120:raise ValueError('Plan labels must be under 120 characters.')
        con.execute('INSERT INTO gym_schedule VALUES(?,?) ON CONFLICT(date) DO UPDATE SET label=excluded.label',(day(data.get('date')),label.strip()))
    else:raise ValueError('Unknown Gym action.')
    return {'ok':True,'id':ident}
