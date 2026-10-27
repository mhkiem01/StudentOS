"""Onboarding plan and discipline-based experience points (XP).

The plan (answers, weekly sessions, schedule history and pauses) lives in the Gym
profile JSON. XP is recomputed from completed workouts on every load, never stored,
so it always matches the workout history.

Discipline (0-100, starts at 50) rewards turning up on your own planned days:
  - planned day trained (at least half of its sets): +10
  - planned day missed: -25
  - trained the day after instead (when that day is not planned): no change
  - extra workouts and paused days: no change
Each workout's XP is multiplied by 0.5 + discipline/100 (x0.5 to x1.5), so the same
workout earns less after a missed day than it does during a disciplined run.
"""
import json, re
from datetime import date, timedelta

GOALS=('muscle','strength','loss','fitness'); LEVELS=('beginner','intermediate','advanced')
STYLES={'gym':('machines','free','bodyweight','mix'),'home':('bodyweight','dumbbells')}
ENJOY=('strength','cardio','core','mobility'); FOCUS=('Chest','Back','Shoulders','Arms','Legs','Core')
DURATIONS=(20,30,45,60,75,90); ACTIVITY=('sedentary','light','moderate','very','high'); SEX=('female','male','unspecified')
START,KEEP,MISS,HALF=50,10,25,.5
PLANNED_XP,EXTRA_XP=100,50
TITLES=('Rookie','Starter','Regular','Committed','Athlete','Strong','Elite','Champion','Legend')
NUTRITION_GOAL={'muscle':'gain','strength':'maintain','loss':'lose','fitness':'maintain'}


def multiplier(discipline): return round(.5+discipline/100,2)
def needed(level): return 250+150*(level-1)
def label(discipline): return 'Unstoppable' if discipline>=90 else 'Disciplined' if discipline>=75 else 'Steady' if discipline>=50 else 'Rebuilding' if discipline>=25 else 'Slipping'


def clean_answers(a):
    from gym_store import number, text
    if not isinstance(a,dict): raise ValueError('Answer the plan questions first.')
    def choice(key, options, message):
        if a.get(key) not in options: raise ValueError(message)
        return a[key]
    goal=choice('goal',GOALS,'Choose your main goal.'); level=choice('level',LEVELS,'Choose your experience.')
    location=choice('location',STYLES,'Choose where you will train.'); style=choice('style',STYLES[location],'Choose the kind of workouts you want.')
    enjoy=a.get('enjoy'); focus=a.get('focus',[]); days=a.get('days')
    if not isinstance(enjoy,list) or not enjoy or any(x not in ENJOY for x in enjoy) or len(set(enjoy))!=len(enjoy): raise ValueError('Choose at least one kind of workout you enjoy.')
    if not isinstance(focus,list) or any(x not in FOCUS for x in focus) or len(set(focus))!=len(focus): raise ValueError('Choose focus areas from the list.')
    if not isinstance(days,list) or not 1<=len(days)<=6 or any(isinstance(d,bool) or d not in range(7) for d in days) or len(set(days))!=len(days): raise ValueError('Choose 1–6 training days. At least one rest day helps your body recover.')
    duration=choice('duration',DURATIONS,'Choose a session length.')
    time=a.get('time','17:00')
    if not isinstance(time,str) or not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d',time): raise ValueError('Choose a training time such as 17:00.')
    age=number(a.get('age'),'Age',18,100)
    if age!=int(age): raise ValueError('Age must be a whole number. The planner is for adults (18+).')
    return dict(goal=goal,level=level,location=location,style=style,enjoy=[x for x in ENJOY if x in enjoy],focus=[x for x in FOCUS if x in focus],
                days=sorted(days),duration=duration,time=time,age=int(age),height=number(a.get('height'),'Height (cm)',100,250),
                weight=number(a.get('weight'),'Weight (kg)',35,300),sex=choice('sex',SEX,'Choose a calorie formula option.'),
                activity=choice('activity',ACTIVITY,'Choose how active your day is.'),units=choice('units',('kg','lb'),'Choose kg or lb.'),
                nutrition=a.get('nutrition') is True)


def clean_sessions(rows, days):
    from gym_store import text, workout
    if not isinstance(rows,list) or len(rows)!=len(days): raise ValueError('The plan needs one workout for each training day.')
    out=[]
    for r in rows:
        if not isinstance(r,dict) or r.get('weekday') not in days or any(s['weekday']==r['weekday'] for s in out): raise ValueError('Each training day needs exactly one workout.')
        w=workout(dict(name=r.get('name'),exercises=r.get('exercises'),duration=r.get('minutes',45),level='plan'))
        extra={k:text(r.get(k),k,300) for k in ('area','warmup','cooldown') if r.get(k)}
        out.append(dict(weekday=r['weekday'],name=w['name'],exercises=w['exercises'],minutes=w['duration'],**extra))
    return sorted(out,key=lambda s:s['weekday'])


def targets_for(a):
    from gym_store import nutrition
    n=nutrition(dict(height=a['height'],weight=a['weight'],age=a['age'],sex=a['sex'],activity=a['activity'],goal=NUTRITION_GOAL[a['goal']],adult_confirmation=True))
    # Everyday guidance shown with the macros: about 35 ml water per kg (more on training days) and 14 g fibre per 1000 kcal.
    n.update(water_ml=int(round(a['weight']*35,-2)),fibre=round(n['calories']/1000*14),meals=4,source='plan')
    return n


def write(con, action, data, ident, p):
    from gym_journey import persist
    today=date.today().isoformat()
    if action=='plan':
        a=clean_answers(data.get('answers')); sessions=clean_sessions(data.get('sessions'),a['days'])
        old=p.get('plan') or {}
        entry=dict(days=a['days'],targets={str(s['weekday']):sum(x['sets'] for x in s['exercises']) for s in sessions},**{'from':today})
        schedule=list(old.get('schedule',[]))
        if schedule and schedule[-1]['from']==today: schedule[-1]=entry
        else: schedule.append(entry)
        p['plan']=dict(answers=a,sessions=sessions,schedule=schedule,started=old.get('started',today),pauses=old.get('pauses',[]),updated=today,version=old.get('version',0)+1)
        # Older parts of the module (settings, suggestions, nutrition) read these preferences.
        p.update(level=a['level'],goal=a['goal'],duration=a['duration'] if a['duration'] in (30,45,60,75,90) else 30,units=a['units'],
                 equipment='gym' if a['location']=='gym' else a['style'] if a['style']=='dumbbells' else 'bodyweight')
        p['athlete']=dict(age=a['age'],gender=(p.get('athlete') or {}).get('gender','Prefer not to say'),activity=a['activity'],height=a['height'],weight=a['weight'])
        p.pop('onboarding_skipped',None)
        persist(con,p)
        if a['nutrition']:
            from gym_store import encode, stamp
            con.execute('INSERT INTO gym_nutrition_targets VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',(encode(targets_for(a)),stamp()))
    elif action=='plan_pause':
        plan=p.get('plan')
        if not plan: raise ValueError('Create your plan first.')
        pauses=plan.setdefault('pauses',[]); open_pause=pauses and pauses[-1].get('end') is None
        if data.get('paused') is True and not open_pause: pauses.append({'start':today,'end':None})
        elif data.get('paused') is False and open_pause:
            yesterday=(date.today()-timedelta(days=1)).isoformat()
            if pauses[-1]['start']<=yesterday: pauses[-1]['end']=yesterday
            else: pauses.pop()
        persist(con,p)
    elif action=='plan_skip':
        p['onboarding_skipped']=True; persist(con,p)
    else: return False
    return True


def progress(con, p, today=None):
    plan=p.get('plan')
    if not plan: return None
    today=today or date.today(); start=date.fromisoformat(plan['started'])
    done={r[0]:r[1] for r in con.execute("SELECT s.date,COUNT(t.id) FROM gym_sessions s LEFT JOIN gym_sets t ON t.session_id=s.id WHERE s.status='completed' AND s.date>=? AND s.date<=? GROUP BY s.date",(start.isoformat(),today.isoformat()))}
    pauses=[(date.fromisoformat(x['start']),date.fromisoformat(x['end']) if x.get('end') else None) for x in plan.get('pauses',[])]
    schedule=sorted(plan['schedule'],key=lambda e:e['from'])
    def paused(d): return any(s<=d and (e is None or d<=e) for s,e in pauses)
    def entry(d): return next((e for e in reversed(schedule) if e['from']<=d.isoformat()),schedule[0])
    def planned(d): return d.weekday() in entry(d)['days']
    def target(d):
        t=entry(d)['targets']; return t.get(str(d.weekday())) or (sum(t.values())/len(t) if t else 12)
    def average(d):
        t=entry(d)['targets']; return sum(t.values())/len(t) if t else 12
    discipline,xp,streak,log,status,used=START,0,0,[],{},set()
    d=start
    while d<=today:
        key=d.isoformat(); mult=multiplier(discipline); sets=done.get(key,0)
        def add(kind,base,completion,change=0):
            nonlocal xp,discipline
            gain=round(base*min(1,completion)*mult); xp+=gain; discipline=max(0,min(100,discipline+change))
            log.append(dict(date=key,kind=kind,xp=gain,multiplier=mult,discipline=discipline))
        if paused(d):
            status[key]='paused'
            if sets: add('extra',EXTRA_XP,sets/average(d))
        elif planned(d):
            if sets:
                full=sets/target(d)>=HALF;add('on_plan' if full else 'partial',PLANNED_XP,sets/target(d),KEEP if full else 0)
                streak=streak+1 if full else streak;status[key]='done' if full else 'partial'
            elif d<today:
                nxt=d+timedelta(days=1);nkey=nxt.isoformat()
                if nxt<=today and not planned(nxt) and not paused(nxt) and done.get(nkey):
                    add('late',PLANNED_XP,done[nkey]/target(d));used.add(nkey);status[key]='late'
                elif nxt==today and not planned(nxt) and not paused(nxt):
                    status[key]='due'  # can still be made up today
                else:
                    add('missed',0,0,-MISS);streak=0;status[key]='missed'
            else: status[key]='today'
        elif sets and key not in used:
            add('extra',EXTRA_XP,sets/average(d));status[key]='extra'
        d+=timedelta(days=1)
    level,left=1,xp
    while left>=needed(level): left-=needed(level);level+=1
    monday=today-timedelta(days=today.weekday())
    week=[]
    for i in range(7):
        day=monday+timedelta(days=i);key=day.isoformat()
        state=status.get(key) or ('paused' if paused(day) else 'before' if day<start else 'planned' if day>today and planned(day) else 'rest')
        week.append(dict(date=key,weekday=i,planned=planned(day),status=state))
    upcoming=next(((today+timedelta(days=n)) for n in range(1,15) if planned(today+timedelta(days=n)) and not paused(today+timedelta(days=n))),None)
    due=next((k for k,v in status.items() if v=='due'),None)
    return dict(xp=xp,level=level,title=TITLES[min(level,len(TITLES))-1],xp_in_level=left,xp_needed=needed(level),
                discipline=discipline,discipline_label=label(discipline),multiplier=multiplier(discipline),
                multiplier_if_kept=multiplier(min(100,discipline+KEEP)),multiplier_if_missed=multiplier(max(0,discipline-MISS)),
                streak=streak,log=log[-40:][::-1],week=week,today=dict(date=today.isoformat(),weekday=today.weekday(),planned=planned(today) and not paused(today),status=status.get(today.isoformat(),'rest'),sets=done.get(today.isoformat(),0),target=target(today) if planned(today) else average(today)),
                next=upcoming.isoformat() if upcoming else None,due=due,paused=bool(pauses and pauses[-1][1] is None),
                rules=dict(start=START,keep=KEEP,miss=MISS,half=HALF,planned_xp=PLANNED_XP,extra_xp=EXTRA_XP))
