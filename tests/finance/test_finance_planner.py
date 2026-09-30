import sqlite3,tempfile,unittest
from pathlib import Path
from datetime import date
from unittest.mock import patch
import backend  # adds backend/<feature> folders to the import path
import finance_store as f
import finance_planner as planner

class Today(date):
 @classmethod
 def today(cls):return cls(2026,9,26)

class PlannerTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'test.db';f.migrate(self.path,Path(self.tmp.name)/'backups')
  self.c=sqlite3.connect(self.path);self.c.row_factory=sqlite3.Row;self.c.execute('PRAGMA foreign_keys=ON')
  self.clock=patch.object(planner,'date',Today);self.clock.start();self.write('profile',{'enabled':True})
 def tearDown(self):self.clock.stop();self.c.close();self.tmp.cleanup()
 def write(self,action,data={},key=None):
  with self.c:return f.write(self.c,{'action':action,'data':data,'id':key})
 def state(self):return f.state(self.c,'2026-09-26')
 def tx(self,amount,kind='income',day='2026-09-26'):
  return self.write('transactions',{'description':'Record','amount':amount,'kind':kind,'category':'Bills','date':day})['id']
 def goal(self,**extra):return self.write('goals',{'name':'Goal','target':'1000','starting':'0','monthly':'100','target_date':'2026-10-26',**extra})['id']
 def schedule(self,**extra):return self.write('income-schedule',{'description':'Work','amount':'200','frequency':'weekly','start_date':'2026-09-26',**extra})['id']
 def test_recorded_balance_opening_dates_and_negative(self):
  self.write('account',{'opening_amount':'500','opening_date':'2026-09-01'})
  self.tx('1000');self.tx('125','expense');self.tx('999','income','2026-10-01');self.tx('77','income','2026-08-31')
  s=self.state();self.assertEqual(s['balance']['recorded'],137500);self.assertEqual(s['balance']['excluded_earlier'],1)
  rows=[x for x in reversed(s['ledger']) if x['included']];self.assertEqual(rows[-1]['running_balance'],137500)
  self.write('account',{'opening_amount':'-2000','opening_date':'2026-09-01'});self.assertEqual(self.state()['balance']['recorded'],-112500)
  with self.assertRaises(ValueError):self.write('account',{'opening_amount':'1.001','opening_date':'2026-09-01'})
  with self.assertRaises(ValueError):self.write('profile',{'currency':'JPY'})
 def test_recurring_pay_only_received_once(self):
  key=self.schedule();s=self.state();self.assertEqual(s['balance']['recorded'],0);self.assertEqual(len(s['income_occurrences']),5)
  self.assertEqual(s['balance']['expected_income'],80000)
  receipt={'due_date':'2026-09-26','paid_date':'2026-09-26','amount':'190'}
  self.write('receive-income',receipt,key);self.write('receive-income',receipt,key)
  self.assertEqual(self.state()['balance']['recorded'],19000);self.assertEqual(len(self.state()['transactions']),1)
  with self.assertRaises(ValueError):self.write('receive-income',{'due_date':'2026-10-03','paid_date':'2026-09-26'},key)
  tx=self.state()['transactions'][0]['id'];self.write('delete',{'table':'transactions'},tx)
  self.assertEqual(len(self.state()['income_occurrences']),5)
  self.write('receive-income',receipt,key);self.write('delete-income-schedule',{},key)
  self.assertEqual(self.state()['balance']['recorded'],19000);self.assertEqual(self.state()['income_schedules'],[])
 def test_first_pay_pause_and_monthly_anchor(self):
  key=self.schedule(record_first=True);self.assertEqual(self.state()['balance']['recorded'],20000)
  self.write('income-schedule',{'description':'Work','amount':'200','frequency':'weekly','start_date':'2026-09-26','paused':'1'},key)
  self.assertEqual(self.state()['income_occurrences'],[]);self.assertEqual(self.state()['balance']['recorded'],20000)
  with self.assertRaises(ValueError):self.write('income-schedule',{'description':'Work','amount':'200','frequency':'monthly','start_date':'2026-09-26'},key)
  second=self.schedule(frequency='monthly',start_date='2026-01-31',end_date='2026-03-31')
  dates=[x['due_date'] for x in self.state()['income_occurrences'] if x['id']==second]
  self.assertEqual(dates,['2026-01-31','2026-02-28','2026-03-31'])
 def test_goals_totals_exclude_paused_complete_flag_overdue(self):
  self.tx('2000');key=self.goal(starting='100');self.goal(paused=True);self.goal(starting='1000');self.goal(target_date='2026-09-20')
  self.write('contributions',{'goal_id':key,'amount':'50','date':'2026-09-26'})
  s=self.state();g=next(x for x in s['goals'] if x['id']==key)
  self.assertEqual(s['goal_totals']['active'],2);self.assertEqual(s['goal_totals']['overdue'],1)
  self.assertEqual(s['goal_totals']['weekly'],g['weekly_needed']);self.assertEqual(s['goal_totals']['monthly'],g['monthly_needed'])
  self.assertEqual(s['balance']['recorded'],200000);self.assertEqual(s['balance']['reserved'],115000)
 def test_bills_once_and_forecast(self):
  self.tx('1000');self.write('budgets',{'category':'Bills','weekly':'0','monthly':'100'})
  key=self.write('bills',{'name':'Phone','amount':'100','category':'Bills','start_date':'2026-09-26'})['id']
  self.assertEqual(self.state()['balance']['available'],90000)
  self.write('pay',{'due_date':'2026-09-26','paid_date':'2026-09-26','record_expense':False},key)
  self.assertEqual(self.state()['balance']['recorded'],90000);self.assertEqual(self.state()['balance']['available'],90000)
  self.assertEqual(self.state()['ledger'][0]['source'],'bill')
  other=self.write('bills',{'name':'Rent','amount':'200','category':'Rent','start_date':'2026-09-26'})['id']
  self.write('pay',{'due_date':'2026-09-26','paid_date':'2026-09-26','record_expense':True},other)
  self.assertEqual(self.state()['balance']['recorded'],70000)
  self.schedule(start_date='2026-10-03');self.assertEqual(self.state()['balance']['projected'],150000)
 def test_migration_reopen_preserves_records(self):
  self.tx('10');self.schedule(record_first=True);before={t:[tuple(r) for r in self.c.execute('SELECT * FROM finance_'+t)] for t in f.TABLES}
  self.c.close();f.migrate(self.path,Path(self.tmp.name)/'backups');self.c=sqlite3.connect(self.path);self.c.row_factory=sqlite3.Row;self.c.execute('PRAGMA foreign_keys=ON')
  self.assertEqual(before,{t:[tuple(r) for r in self.c.execute('SELECT * FROM finance_'+t)] for t in f.TABLES})
  self.assertEqual(self.state()['balance']['recorded'],21000)
 def test_remaining_goal_plan_and_future_expense_reservation(self):
  self.tx('500');key=self.goal(target='100',monthly='100')
  self.write('contributions',{'goal_id':key,'amount':'40','date':'2026-09-26'})
  s=self.state();self.assertEqual(s['balance']['remaining_goal_plan'],6000);self.assertEqual(s['summary']['goal_plans'],6000)
  self.tx('25','expense','2026-09-28')
  self.assertEqual(self.state()['balance']['recorded'],50000);self.assertEqual(self.state()['balance']['available'],37500)
  self.assertEqual(self.state()['balance']['period_spending'],0)

if __name__=='__main__':unittest.main()
