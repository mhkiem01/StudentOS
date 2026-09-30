import unittest,tempfile,sqlite3
from pathlib import Path
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import server,gym_store

class GymTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name)
        self.patches=[patch.object(server,'ROOT',root),patch.object(server,'DB_PATH',root/'test.db')]
        for p in self.patches:p.start()
        server.init_db()
    def tearDown(self):
        for p in self.patches:p.stop()
        self.tmp.cleanup()
    def write(self,action,data=None,id=None):
        with server.connect() as con:return gym_store.write(con,dict(action=action,data=data or {},id=id))
    def state(self):
        with server.connect() as con:return gym_store.state(con)
    def enable(self):self.write('profile',{'enabled':True})
    def start(self):
        return self.write('start',dict(name='Test',date='2026-09-20',exercises=[dict(id='bench',sets=2,reps=8)]))['id']
    def test_default_disabled_preserves_academic_data(self):
        self.assertFalse(self.state()['profile']['enabled'])
        with self.assertRaises(ValueError):self.start()
        with server.connect() as con:con.execute("INSERT INTO subjects(id,name) VALUES('a','Keep')")
        server.init_db()
        with server.connect() as con:self.assertEqual(con.execute('SELECT name FROM subjects').fetchone()[0],'Keep')
        self.assertEqual(len(list((server.ROOT/'backups').glob('before-gym*'))),1)
    def test_preferences_and_reenable(self):
        self.enable();sid=self.start();self.write('profile',{'enabled':False})
        self.assertEqual(self.state()['sessions'][0]['id'],sid)
        self.enable();self.assertEqual(self.start(),sid)
        with self.assertRaises(ValueError):self.write('profile',{'duration':999})
    def test_sets_idempotent_recover_finish(self):
        self.enable();sid=self.start();d=dict(session_id=sid,exercise_id='bench',position=1,weight=20,reps=8)
        self.write('set',d);self.write('set',d)
        with self.assertRaises(ValueError):self.write('set',{**d,'weight':99})
        self.assertEqual(len(self.state()['sets']),1)
        self.write('session_date',dict(session_id=sid,date='2026-09-19'))
        self.assertEqual(self.state()['sessions'][0]['date'],'2026-09-19')
        with self.assertRaises(ValueError):self.write('session_date',dict(session_id=sid,date='2099-01-01'))
        self.write('finish',{'session_id':sid});self.write('finish',{'session_id':sid})
        self.assertEqual(self.state()['sessions'][0]['status'],'completed')
        with self.assertRaises(ValueError):self.write('set',{**d,'position':2})
    def test_invalid_set_and_empty_completion(self):
        self.enable();sid=self.start()
        for d in [dict(exercise_id='bench',position=1,weight=-1,reps=8),dict(exercise_id='other',position=1,weight=10,reps=8),dict(exercise_id='bench',position=1,weight=10,reps=1.5)]:
            with self.assertRaises(ValueError):self.write('set',{**d,'session_id':sid})
        with self.assertRaises(ValueError):self.write('finish',{'session_id':sid})
        self.write('cancel',{'session_id':sid});self.assertEqual(self.state()['sessions'][0]['status'],'cancelled')
    def test_nutrition_explicit_adult_inputs(self):
        self.enable();d=dict(height=175,weight=70,age=21,sex='male',activity='moderate',goal='maintain',adult_confirmation=True)
        self.write('nutrition',d);n=self.state()['targets'];self.assertEqual(n['calories'],round((700+1093.75-105+5)*1.55));self.assertEqual(n['protein'],98)
        for key,value in [('age',17),('weight',float('nan')),('adult_confirmation',False),('sex','')]:
            with self.assertRaises(ValueError):self.write('nutrition',{**d,key:value})
        self.assertEqual(self.state()['targets'],n)
    def test_measurements_food_and_schedule_persist(self):
        self.enable()
        for weight in [70,71]:self.write('measurement',dict(date='2026-09-20',weight=weight))
        self.assertEqual(len(self.state()['measurements']),2)
        self.write('food',dict(date='2026-09-20',name='Lunch',calories=600,protein=30,carbs=60,fat=20),id='food')
        self.write('schedule',dict(date='2026-10-03',label='Legs'))
        self.assertEqual(self.state()['food_logs'][0]['data']['calories'],600)
        self.write('delete_food',id='food');self.assertEqual(self.state()['food_logs'],[])
        with self.assertRaises(ValueError):self.write('schedule',dict(date='2026-02-30',label='Bad'))
    def test_custom_workouts_and_snapshots(self):
        self.enable();w=dict(name='Custom',exercises=[dict(id='bench',sets=2,reps=8)])
        self.write('workout',w,id='w');sid=self.write('start',{**w,'date':'2026-09-20'})['id']
        self.write('delete_workout',id='w');self.assertEqual(self.state()['sessions'][0]['data']['name'],'Custom')
        with self.assertRaises(ValueError):self.write('workout',{**w,'exercises':w['exercises']*2})
