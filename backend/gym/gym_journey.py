"""Account-local training milestones and links to the existing calendar.

Game levels measure self-reported adherence, never expertise or verified form.
"""
import json, sqlite3, uuid
from contextlib import closing
from datetime import date, datetime, timedelta
import calendar_store


def migrate(path, backups):
    with closing(sqlite3.connect(path)) as con:
        if con.execute("SELECT 1 FROM sqlite_master WHERE name='gym_calendar_links'").fetchone(): return
        backups.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(backups / ('before-training-journey-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))) as dest: con.backup(dest)
        con.execute('CREATE TABLE gym_calendar_links(event_id TEXT PRIMARY KEY REFERENCES timetable_events(id) ON DELETE CASCADE, workout TEXT NOT NULL)')
        con.commit()


def persist(con, profile):
    con.execute('INSERT INTO gym_profile VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', (json.dumps(profile, allow_nan=False),))


def progress(con, p, today=None):
    today = today or date.today()
    j = p.get('journey')
    if not j: return None
    start = date.fromisoformat(j['start'])
    end = date.fromisoformat(j['end'])
    counts = [0] * j['weeks']
    days = set()
    for s in con.execute("SELECT * FROM gym_sessions WHERE status='completed' AND date>=? AND date<=?", (j['start'], min(today,end).isoformat())):
        # A partial/abandoned routine is still valid history, but earns no milestone credit.
        exercises = json.loads(s['data'])['exercises']
        full = all(con.execute('SELECT COUNT(*) FROM gym_sets WHERE session_id=? AND exercise_id=? AND reps>=?', (s['id'], e['id'], e['reps'])).fetchone()[0] >= e['sets'] for e in exercises)
        if full: days.add(s['date'])
    for d in days: counts[(date.fromisoformat(d)-start).days//7] += 1
    weight = None
    for r in con.execute('SELECT date,data FROM gym_measurements WHERE date>=? AND date<=? ORDER BY date DESC,rowid DESC', ((end-timedelta(days=6)).isoformat(),min(today,end).isoformat())):
        weight = json.loads(r['data']).get('weight')
        if weight is not None: break
    target_met = j['goal']=='consistency' or (weight is not None and weight >= j['target_weight'])
    eligible = today > end and all(n>=j['sessions_per_week'] for n in counts) and target_met
    if eligible and j['status']=='active':
        j['status']='completed';j['awarded_on']=today.isoformat()
        p['game_level']=p.get('game_level',1)+1
        p.setdefault('awards',[]).append({**j,'level':p['game_level']})
        persist(con,p)
    return {**j,'weekly_counts':counts,'target_met':target_met,'latest_weight':weight,'elapsed':today>end,
            'credited_days':len(days),'required_days':j['weeks']*j['sessions_per_week']}


def write(con, action, data, ident, p):
    from gym_store import number, text, day, workout
    if action=='athlete':
        age=number(data.get('age'),'Age',18,100)
        if age!=int(age): raise ValueError('Age must be a whole number. This planner is for adults (18+).')
        gender=text(data.get('gender','Prefer not to say'),'gender',80)
        activity=data.get('activity')
        if activity not in ('sedentary','light','moderate','very','high'): raise ValueError('Choose your lifestyle activity level.')
        p['athlete']=dict(age=int(age),gender=gender,activity=activity,height=number(data.get('height'),'Height (cm)',100,250),weight=number(data.get('weight'),'Weight (kg)',35,300))
        persist(con,p)
    elif action=='workout_source':
        if data.get('source') not in ('suggested','own'): raise ValueError('Choose suggested or own workouts.')
        p['workout_source']=data['source'];persist(con,p)
    elif action=='journey':
        if not p.get('athlete'): raise ValueError('Set up your adult training profile first.')
        if p.get('journey',{}).get('status')=='active': raise ValueError('End your current challenge before starting a new one.')
        weeks=number(data.get('weeks'),'Weeks',4,24);sessions=number(data.get('sessions_per_week'),'Training days per week',1,5)
        if weeks!=int(weeks) or sessions!=int(sessions): raise ValueError('Weeks and days must be whole numbers.')
        goal=data.get('goal')
        if goal not in ('consistency','gain'): raise ValueError('Choose consistency or a personal weight-gain goal.')
        baseline=p['athlete']['weight']
        row=con.execute('SELECT data FROM gym_measurements WHERE date<=? ORDER BY date DESC,rowid DESC',(date.today().isoformat(),)).fetchall()
        baseline=next((json.loads(r[0])['weight'] for r in row if 'weight' in json.loads(r[0])),baseline)
        target=number(data.get('target_weight'),'Target weight (kg)',35,300) if goal=='gain' else None
        if goal=='gain' and (target<=baseline or (target-baseline)/weeks>0.5): raise ValueError('Choose a gradual gain target above your baseline (at most 0.5 kg/week), or extend the period. This limit is not a personal recommendation.')
        start=date.today()
        p['journey']=dict(id=str(uuid.uuid4()),start=start.isoformat(),end=(start+timedelta(weeks=int(weeks),days=-1)).isoformat(),weeks=int(weeks),sessions_per_week=int(sessions),goal=goal,baseline_weight=baseline,target_weight=target,status='active')
        persist(con,p)
    elif action=='end_journey':
        if p.get('journey',{}).get('status')=='active': p['journey']['status']='ended';persist(con,p)
    elif action=='calendar_workout':
        row=con.execute('SELECT data FROM gym_workouts WHERE id=?',(data.get('workout_id'),)).fetchone()
        if not row: raise ValueError('Save and choose a workout first.')
        w=workout(json.loads(row[0]))
        # Caller ids may never replace unrelated classes or reminders.
        if con.execute('SELECT 1 FROM timetable_events WHERE id=?',(ident,)).fetchone() and not con.execute('SELECT 1 FROM gym_calendar_links WHERE event_id=?',(ident,)).fetchone(): raise ValueError('That calendar event is not a Gym event.')
        event=calendar_store.validate(dict(id=ident,title='Gym · '+w['name'],event_date=day(data.get('date')),start_time=data.get('start_time'),end_time=data.get('end_time'),recurrence=data.get('recurrence','none'),repeat_until=data.get('repeat_until'),location=text(data.get('location') or 'Gym','location',200),event_type='Other',color='#10b981'))
        calendar_store.write(con,event)
        con.execute('INSERT INTO gym_calendar_links VALUES(?,?) ON CONFLICT(event_id) DO UPDATE SET workout=excluded.workout',(ident,json.dumps(w)))
    elif action=='delete_calendar_workout':
        con.execute('DELETE FROM timetable_events WHERE id IN (SELECT event_id FROM gym_calendar_links WHERE event_id=?)',(ident,))
    else: return False
    return True
