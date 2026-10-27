"""Onboarding plan storage and discipline-based XP."""
import unittest
from datetime import date, timedelta
from tests.gym import test_gym
import backend  # adds backend/<feature> folders to the import path
import server, gym_store, gym_journey, gym_plan

ANSWERS=dict(goal='muscle',level='beginner',location='gym',style='machines',enjoy=['strength','core'],focus=['Arms'],days=[0,2,4],duration=45,time='17:00',
             age=21,height=175,weight=70,sex='unspecified',activity='light',units='kg',nutrition=True)
def sessions(days, sets=2):
    return [dict(weekday=d,name=f'Day {d}',area='Whole body',warmup='5 min easy cardio',minutes=45,exercises=[dict(id='legpress',sets=sets,reps=10,reps_max=12,unit='reps',rest=90)]) for d in days]


class PlanTests(unittest.TestCase):
    setUp=test_gym.GymTests.setUp
    tearDown=test_gym.GymTests.tearDown
    write=test_gym.GymTests.write
    state=test_gym.GymTests.state
    enable=test_gym.GymTests.enable

    def plan(self, days=(0,2,4), start=None, sets=2, **answers):
        self.write('plan',dict(answers={**ANSWERS,'days':list(days),**answers},sessions=sessions(days,sets)))
        if start:self.backdate(start)
    def backdate(self, start):
        # Time travel only in this isolated test database; the API always starts plans today.
        with server.connect() as con:
            p=gym_store.profile(con);p['plan']['started']=start.isoformat();p['plan']['schedule'][0]['from']=start.isoformat();gym_journey.persist(con,p)
    def train(self, d, sets=2):
        sid=self.write('start',dict(name='Plan day',date=d.isoformat(),exercises=[dict(id='legpress',sets=2,reps=10)]))['id']
        for i in range(sets):self.write('set',dict(session_id=sid,exercise_id='legpress',position=i+1,weight=40,reps=10))
        self.write('finish',dict(session_id=sid))
    def progress(self, today):
        with server.connect() as con:return gym_plan.progress(con,gym_store.profile(con),today=today)
    def monday(self, weeks_ago=3):
        t=date.today();return t-timedelta(days=t.weekday())-timedelta(weeks=weeks_ago)
    kinds=staticmethod(lambda p:[x['kind'] for x in p['log'][::-1]])

    def test_plan_saves_answers_sessions_preferences_and_nutrition(self):
        self.enable();self.plan()
        s=self.state();p=s['profile']
        self.assertEqual([x['weekday'] for x in p['plan']['sessions']],[0,2,4]);self.assertEqual(p['plan']['sessions'][0]['exercises'][0]['rest'],90)
        self.assertEqual((p['level'],p['goal'],p['equipment'],p['duration']),('beginner','muscle','gym',45));self.assertEqual(p['athlete']['activity'],'light')
        self.assertEqual(p['plan']['schedule'][0]['targets'],{'0':2,'2':2,'4':2})
        # 'unspecified' uses the midpoint coefficient; building muscle adds 10% and 1.6 g/kg protein.
        bmr=10*70+6.25*175-5*21-78;self.assertEqual(s['targets']['calories'],round(bmr*1.375*1.1));self.assertEqual(s['targets']['protein'],112)
        self.assertEqual((s['targets']['water_ml'],s['targets']['fibre']),(2400,round(s['targets']['calories']/1000*14)))
        self.assertEqual((s['plan_progress']['level'],s['plan_progress']['discipline'],s['plan_progress']['multiplier']),(1,50,1.0))
        for bad,why in [({'days':[0,1,2,3,4,5,6]},'1–6 training days'),({'location':'home','style':'machines'},'kind of workouts'),({'age':17},'between 18'),({'enjoy':[]},'at least one'),({'time':'25:00'},'training time')]:
            with self.assertRaisesRegex(ValueError,why):self.write('plan',dict(answers={**ANSWERS,**bad},sessions=sessions(bad.get('days',[0,2,4]))))
        with self.assertRaisesRegex(ValueError,'one workout for each'):self.write('plan',dict(answers=ANSWERS,sessions=sessions([0,2])))
        # Skipping onboarding is remembered until a plan is saved; without nutrition consent targets are left alone.
        self.write('plan_skip');self.assertTrue(self.state()['profile']['onboarding_skipped'])
        self.write('plan',dict(answers={**ANSWERS,'nutrition':False,'weight':90},sessions=sessions([0,2,4])))
        s=self.state();self.assertEqual(s['targets']['inputs']['weight'],70);self.assertNotIn('onboarding_skipped',s['profile']);self.assertEqual(s['profile']['plan']['version'],2)

    def test_disciplined_training_earns_more_xp_than_missing_planned_days(self):
        mon=self.monday();self.enable();self.plan(start=mon)
        for d in (0,2,4):self.train(mon+timedelta(days=d))
        good=self.progress(mon+timedelta(days=4))
        self.assertEqual([x['xp'] for x in good['log'][::-1]],[100,110,120]);self.assertEqual((good['discipline'],good['streak']),(80,3))
        # Same plan, but Wednesday is skipped: Friday's identical workout earns less (x0.85 instead of x1.2).
        self.tearDown();self.setUp();self.enable();self.plan(start=mon)
        for d in (0,4):self.train(mon+timedelta(days=d))
        lazy=self.progress(mon+timedelta(days=4))
        self.assertEqual([(x['kind'],x['xp']) for x in lazy['log'][::-1]],[('on_plan',100),('missed',0),('on_plan',85)])
        self.assertEqual((lazy['discipline'],lazy['streak']),(45,1));self.assertLess(lazy['xp'],good['xp'])
        self.assertEqual([d['status'] for d in lazy['week'][:5]],['done','rest','missed','rest','done'])

    def test_make_up_the_next_day_partial_sets_and_extra_days(self):
        mon=self.monday();self.enable();self.plan(start=mon)
        self.train(mon)                          # Mon planned: +100 at x1.0, discipline 60
        self.train(mon+timedelta(days=3))        # Wed missed but made up on Thu (not planned): +110, discipline unchanged
        self.train(mon+timedelta(days=4),sets=1) # Fri: 1 of 2 sets (half) still keeps the day: 100 x 0.5 x 1.1
        self.train(mon+timedelta(days=5))        # Sat: extra workout, 50 base at x1.2, discipline unchanged
        p=self.progress(mon+timedelta(days=6))
        self.assertEqual([(x['kind'],x['xp'],x['discipline']) for x in p['log'][::-1]],[('on_plan',100,60),('late',110,60),('on_plan',55,70),('extra',60,70)])
        self.assertEqual([d['status'] for d in p['week']],['done','rest','late','rest','done','extra','rest'])

    def test_missed_yesterday_can_still_be_made_up_today(self):
        mon=self.monday();self.enable();self.plan(start=mon);self.train(mon)
        p=self.progress(mon+timedelta(days=3))   # Wed missed, today is Thu (not planned): no penalty yet
        self.assertEqual((p['due'],p['discipline']),((mon+timedelta(days=2)).isoformat(),60));self.assertEqual(p['week'][2]['status'],'due')
        p=self.progress(mon+timedelta(days=4))   # Thu passed without training: Wed now counts as missed; Fri is today
        self.assertEqual((p['due'],p['discipline'],p['today']['status'],p['today']['planned']),(None,35,'today',True))
        self.assertEqual((p['multiplier'],p['multiplier_if_kept'],p['multiplier_if_missed']),(.85,.95,.6))

    def test_partial_workouts_earn_xp_but_not_discipline(self):
        mon=self.monday();self.enable();self.plan(days=(0,),start=mon,sets=6)
        self.train(mon,sets=2)                   # 2 of 6 planned sets: under half
        p=self.progress(mon)
        self.assertEqual((p['log'][0]['kind'],p['log'][0]['xp'],p['discipline'],p['week'][0]['status'],p['streak']),('partial',33,50,'partial',0))

    def test_pause_freezes_discipline_and_plan_changes_keep_history(self):
        mon=self.monday(2);self.enable();self.plan(start=mon)
        with server.connect() as con:  # paused for the whole first week (e.g. exams)
            p=gym_store.profile(con);p['plan']['pauses']=[{'start':mon.isoformat(),'end':(mon+timedelta(days=6)).isoformat()}];gym_journey.persist(con,p)
        self.train(mon+timedelta(days=7))
        p=self.progress(mon+timedelta(days=7))
        self.assertEqual((p['discipline'],self.kinds(p)),(60,['on_plan']))
        # From Tuesday of week 2 the plan moves to Tue/Thu; that Monday is still judged by the old Mon/Wed/Fri plan.
        with server.connect() as con:
            p=gym_store.profile(con);p['plan']['schedule'].append({'from':(mon+timedelta(days=8)).isoformat(),'days':[1,3],'targets':{'1':2,'3':2}});gym_journey.persist(con,p)
        p=self.progress(mon+timedelta(days=12))
        self.assertEqual(self.kinds(p),['on_plan','missed','missed']);self.assertEqual(p['discipline'],10)
        # The pause action opens and closes pauses; resuming the same day leaves no pause behind.
        self.write('plan_pause',{'paused':True});self.assertTrue(self.state()['plan_progress']['paused'])
        self.write('plan_pause',{'paused':False});s=self.state()
        self.assertFalse(s['plan_progress']['paused']);self.assertEqual(len(s['profile']['plan']['pauses']),1)
        with self.assertRaisesRegex(ValueError,'Create your plan'):
            self.tearDown();self.setUp();self.enable();self.write('plan_pause',{'paused':True})

    def test_levels_and_titles(self):
        self.assertEqual([gym_plan.needed(n) for n in (1,2,3)],[250,400,550])
        self.assertEqual([gym_plan.label(d) for d in (95,80,50,30,5)],['Unstoppable','Disciplined','Steady','Rebuilding','Slipping'])
        mon=self.monday(3);self.enable();self.plan(days=(0,1,2,3,4,5),start=mon)
        for n in range(6):self.train(mon+timedelta(days=n))
        p=self.progress(mon+timedelta(days=5))
        self.assertEqual(p['xp'],100+110+120+130+140+150);self.assertEqual((p['level'],p['title'],p['xp_in_level'],p['xp_needed']),(3,'Regular',100,550))
        self.assertEqual((p['discipline'],p['multiplier']),(100,1.5))

if __name__=='__main__':unittest.main()
