import json, unittest
from datetime import date, timedelta
from tests.gym import test_gym
import backend  # adds backend/<feature> folders to the import path
import server, gym_store, gym_journey


class JourneyTests(unittest.TestCase):
    setUp=test_gym.GymTests.setUp
    tearDown=test_gym.GymTests.tearDown
    write=test_gym.GymTests.write
    state=test_gym.GymTests.state
    enable=test_gym.GymTests.enable
    def prepare(self):
        self.enable()
        self.write('athlete',dict(age=21,gender='Prefer not to say',activity='light',height=175,weight=70))

    def challenge(self, goal='consistency'):
        self.prepare()
        self.write('journey',dict(weeks=4,sessions_per_week=2,goal=goal,target_weight=72))
        # Time travel only in this isolated test DB. Public API never permits backdated blocks.
        start=date.today()-timedelta(days=28)
        with server.connect() as con:
            p=gym_store.profile(con);p['journey'].update(start=start.isoformat(),end=(start+timedelta(days=27)).isoformat());gym_journey.persist(con,p)
        return start

    def completed_day(self, d, reps=8, count=2, status='completed'):
        sid=self.write('start',dict(name='Own workout',date=d.isoformat(),exercises=[dict(id='own-squat',name='My squat',sets=2,reps=8)]))['id']
        for i in range(count):self.write('set',dict(session_id=sid,exercise_id='own-squat',position=i+1,weight=0,reps=reps))
        self.write('finish' if status=='completed' else 'cancel',dict(session_id=sid))

    def test_advancement_exactly_once_and_difficulty_unchanged(self):
        start=self.challenge()
        for week in range(4):
            for d in (0,2):self.completed_day(start+timedelta(days=7*week+d))
        s=self.state();self.assertEqual(s['profile']['game_level'],2);self.assertEqual(s['profile']['level'],'beginner')
        self.assertEqual(s['journey']['weekly_counts'],[2,2,2,2])
        self.assertEqual(self.state()['profile']['game_level'],2)
        self.assertEqual(len(self.state()['profile']['awards']),1)
        self.write('journey',dict(weeks=4,sessions_per_week=1,goal='consistency'))
        self.assertEqual(self.state()['journey']['credited_days'],0)

    def test_incomplete_reps_duplicate_days_and_cancelled_do_not_pass(self):
        start=self.challenge()
        self.completed_day(start);self.completed_day(start)
        self.completed_day(start+timedelta(days=1),count=1)
        self.completed_day(start+timedelta(days=2),reps=7)
        self.completed_day(start+timedelta(days=3),status='cancelled')
        s=self.state();self.assertEqual(s['journey']['weekly_counts'],[1,0,0,0]);self.assertNotIn('game_level',s['profile'])

    def test_weight_goal_needs_final_week_measurement(self):
        start=self.challenge('gain')
        for week in range(4):
            for d in (0,2):self.completed_day(start+timedelta(days=7*week+d))
        self.write('measurement',dict(date=start.isoformat(),weight=72))
        self.assertFalse(self.state()['journey']['target_met'])
        self.write('measurement',dict(date=(start+timedelta(days=27)).isoformat(),weight=72))
        self.assertEqual(self.state()['profile']['game_level'],2)

    def test_cannot_advance_early_or_change_live_challenge(self):
        self.prepare();self.write('journey',dict(weeks=4,sessions_per_week=1,goal='consistency'))
        self.assertFalse(self.state()['journey']['elapsed'])
        with self.assertRaises(ValueError):self.write('journey',dict(weeks=4,sessions_per_week=1,goal='consistency'))
        self.write('end_journey');self.assertEqual(self.state()['journey']['status'],'ended')
        self.write('journey',dict(weeks=4,sessions_per_week=1,goal='consistency'))

    def test_validation_and_private_profile(self):
        self.prepare()
        for values in [dict(age=16),dict(weight=float('nan')),dict(height=0),dict(activity='unknown')]:
            with self.assertRaises(ValueError):self.write('athlete',{**self.state()['profile']['athlete'],**values})
        with self.assertRaises(ValueError):self.write('journey',dict(weeks=4,sessions_per_week=2,goal='gain',target_weight=80))
        with self.assertRaises(ValueError):self.write('measurement',dict(date='2099-01-01',weight=72))
        with self.assertRaises(ValueError):self.write('workout_source',dict(source='bad'))
        self.write('workout_source',dict(source='own'));self.assertEqual(self.state()['profile']['workout_source'],'own')

    def test_calendar_snapshot_retry_delete_and_foreign_event_protection(self):
        self.prepare()
        w=dict(name='Gym A',duration=45,exercises=[dict(id='plank',name='Plank',sets=3,reps=30,reps_max=45,unit='seconds')])
        wid=self.write('workout',w)['id']
        values=dict(workout_id=wid,date=date.today().isoformat(),start_time='17:00',end_time='18:00',recurrence='weekly',repeat_until='2099-01-01')
        self.write('calendar_workout',values,'gym-test');self.write('calendar_workout',values,'gym-test')
        self.assertEqual(len(self.state()['calendar_workouts']),1)
        with self.assertRaises(ValueError):self.write('calendar_workout',{**values,'end_time':'16:00'})
        with server.connect() as con:con.execute("INSERT INTO timetable_events(id,title,day,start_time,end_time) VALUES('class','Keep class',0,'09:00','10:00')")
        with self.assertRaises(ValueError):self.write('calendar_workout',values,'class')
        self.write('delete_calendar_workout',{},'class')
        self.write('delete_workout',{},wid)
        self.assertEqual(self.state()['calendar_workouts'][0]['workout']['exercises'][0]['unit'],'seconds')
        self.write('delete_calendar_workout',{},'gym-test')
        self.assertEqual(self.state()['calendar_workouts'],[])
        with server.connect() as con:self.assertEqual(con.execute('SELECT title FROM timetable_events').fetchone()[0],'Keep class')


if __name__=='__main__':unittest.main()
