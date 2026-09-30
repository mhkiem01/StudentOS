import sqlite3, tempfile, unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from datetime import date
import backend  # adds backend/<feature> folders to the import path
import finance_store as f
import currency_provider as fx

class FinanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'workspace.db';self.backups=Path(self.tmp.name)/'backups'
        with closing(sqlite3.connect(self.path)) as c:c.execute('CREATE TABLE keep_me(value TEXT)')
        f.migrate(self.path,self.backups);self.c=sqlite3.connect(self.path);self.c.row_factory=sqlite3.Row;self.c.execute('PRAGMA foreign_keys=ON');self.write('profile',{'enabled':True})
    def tearDown(self):self.c.close();self.tmp.cleanup()
    def write(self,action,data,id=None):
        with self.c:return f.write(self.c,dict(action=action,data=data,id=id))
    def state(self,day='2026-09-21'):return f.state(self.c,day)
    def transaction(self,amount,kind='expense',category='Groceries',day='2026-09-21'):
        return self.write('transactions',dict(amount=amount,kind=kind,category=category,date=day,description='Test'))['id']
    def test_minor_units(self):
        self.assertEqual(f.money('0.29','AUD'),29);self.assertEqual(f.money('1250','JPY'),1250)
        for value,c in [('1.001','AUD'),('1.5','JPY'),('NaN','AUD'),('-1','AUD'),(True,'AUD')]:
            with self.subTest(value=value),self.assertRaises(ValueError):f.money(value,c)
    def test_toggle_backup_and_currency_lock(self):
        self.transaction('10');self.write('profile',{'enabled':False});self.assertEqual(len(self.state()['transactions']),1)
        with self.assertRaises(ValueError):self.transaction('20')
        self.write('profile',{'enabled':True})
        with self.assertRaises(ValueError):self.write('profile',{'currency':'JPY'})
        f.migrate(self.path,self.backups);self.assertEqual(len(list(self.backups.glob('before-finance-*'))),1)
        self.assertIsNotNone(self.c.execute('SELECT name FROM sqlite_master WHERE name="keep_me"').fetchone())
    def test_summary_budget_and_week(self):
        self.transaction('1000','income');key=self.transaction('31');self.transaction('20',day='2026-09-20')
        self.write('budgets',dict(category='Groceries',weekly='50',monthly='200'))
        s=self.state();self.assertEqual(s['summary']['income'],100000);self.assertEqual(s['summary']['spending'],5100)
        self.assertEqual(s['budgets'][0]['weekly_remaining'],1900);self.assertEqual(s['summary']['safe'],80000)
        self.write('delete',{'table':'transactions'},key);self.assertEqual(self.state()['summary']['spending'],2000)
    def test_goals_contributions_and_travel(self):
        key=self.write('goals',dict(name='Trip',target='5000',starting='2800',monthly='300',target_date='2027-04-01',type='travel',destination='Japan',flights='700'))['id']
        self.write('contributions',dict(goal_id=key,amount='150',date='2026-09-21'))
        g=self.state()['goals'][0];self.assertEqual(g['saved'],295000);self.assertEqual(g['remaining'],205000);self.assertGreater(g['weekly_needed'],0);self.assertTrue(g['estimated_completion']);self.assertEqual(g['data']['travel']['flights'],70000)
    def test_recurrence_and_idempotent_payment(self):
        key=self.write('bills',dict(name='Rent',amount='600',category='Rent',start_date='2026-01-31',frequency='monthly'))['id']
        b=self.state()['bills'][0];self.assertEqual(f.occurrence(b,1),date(2026,2,28));self.assertEqual(f.occurrence(b,2),date(2026,3,31))
        pay=dict(due_date='2026-01-31',paid_date='2026-09-21',record_expense=True)
        self.write('pay',pay,key);self.write('pay',pay,key);self.assertEqual(len(self.state()['payments']),1);self.assertEqual(len(self.state()['transactions']),1)
        with self.assertRaises(ValueError):self.write('pay',{**pay,'due_date':'2026-02-27'},key)
    def test_overbudget_and_payment_without_expense(self):
        self.transaction('85');self.write('budgets',dict(category='Groceries',weekly='70',monthly='100'))
        self.assertEqual(self.state()['budgets'][0]['weekly_remaining'],-1500)
        key=self.write('bills',dict(name='Bill',amount='45',category='Bills',start_date='2026-09-21'))['id']
        self.write('pay',dict(due_date='2026-09-21',paid_date='2026-09-21',record_expense=False),key)
        self.assertEqual(self.state()['summary']['paid_unrecorded'],4500)
    def test_cached_rates_survive_provider_failure(self):
        snapshot={'base':'AUD','rates':{'JPY':{'rate':'97.42','rate_date':'2026-09-20'}},'provider':'Fixture','fetched_at':'2026-09-21T00:00:00Z'}
        f.store_rates(self.c,snapshot);self.c.commit()
        with patch.object(fx,'urlopen',side_effect=OSError('Offline')):
            with self.assertRaises(ValueError):fx.get_latest_rates('AUD')
        self.assertEqual(self.state()['rates']['data'],snapshot['rates'])
    def test_recurrence_frequencies_and_leap_year(self):
        bill={'start_date':'2024-02-29','frequency':'yearly','end_date':None}
        self.assertEqual(f.occurrence(bill,1),date(2025,2,28));self.assertEqual(f.occurrence(bill,4),date(2028,2,29))
        bill.update(start_date='2026-01-31',frequency='quarterly')
        self.assertEqual(f.occurrence(bill,1),date(2026,4,30));self.assertEqual(f.occurrence(bill,2),date(2026,7,31))
        bill.update(frequency='fortnightly');self.assertEqual(f.occurrence(bill,2),date(2026,2,28))
        bill.update(frequency='weekly',end_date='2026-02-07');self.assertEqual(len(list(f.occurrences(bill,date(2026,12,31)))),2)
    def test_bills_and_budgets_are_not_double_reserved(self):
        self.transaction('1000','income')
        self.write('budgets',dict(category='Rent',weekly='0',monthly='600'))
        key=self.write('bills',dict(name='Rent',amount='600',category='Rent',start_date='2026-09-21'))['id']
        self.assertEqual(self.state()['summary']['safe'],40000)
        self.write('pay',dict(due_date='2026-09-21',paid_date='2026-09-21',record_expense=False),key)
        self.assertEqual(self.state()['summary']['safe'],40000)
