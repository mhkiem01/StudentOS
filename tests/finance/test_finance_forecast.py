"""Plan-ahead forecast. Run: python -m unittest discover -s tests -t . -p test_finance_forecast.py"""
import sqlite3
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

import backend  # adds backend/<feature> folders to the import path
import finance_store as f
import finance_planner as planner


class Today(date):
    @classmethod
    def today(cls):
        return cls(2026, 9, 26)  # a Saturday; this week is Mon 21 - Sun 27 Sep


class ForecastTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / 'test.db'
        f.migrate(path, Path(self.tmp.name) / 'backups')
        self.c = sqlite3.connect(path)
        self.c.row_factory = sqlite3.Row
        self.c.execute('PRAGMA foreign_keys=ON')
        clock = patch.object(planner, 'date', Today)
        clock.start()
        self.addCleanup(clock.stop)
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(self.c.close)
        self.write('profile', {'enabled': True})
        self.write('account', {'opening_amount': '500', 'opening_date': '2026-09-01'})

    def write(self, action, data=None, key=None):
        with self.c:
            return f.write(self.c, {'action': action, 'data': data or {}, 'id': key})

    def forecast(self):
        return f.state(self.c, '2026-09-26')['forecast']

    def plan(self):
        """Weekly pay from Fri 2 Oct, rent on 1 Oct, a groceries budget and one goal."""
        self.write('income-schedule', {'description': 'Cafe job', 'amount': '200', 'frequency': 'weekly', 'start_date': '2026-10-02'})
        self.write('bills', {'name': 'Rent', 'amount': '400', 'category': 'Rent', 'start_date': '2026-10-01', 'frequency': 'monthly'})
        self.write('budgets', {'category': 'Groceries', 'weekly': '80', 'monthly': '0'})
        self.write('goals', {'name': 'Laptop', 'target': '1000', 'starting': '0', 'monthly': '0', 'target_date': '2026-11-21'})
        self.write('profile', {'buffer': '100'})

    def test_week_by_week_balance_free_cash_and_money_needed(self):
        self.plan()
        fc = self.forecast()
        self.assertEqual((fc['start_balance'], fc['buffer'], fc['goal_weekly']), (50000, 10000, 12500))
        this_week, next_week = fc['weeks'][0], fc['weeks'][1]
        self.assertEqual((this_week['start'], this_week['end']), ('2026-09-21', '2026-09-27'))
        # This week: groceries estimate 80; 125 set aside for the laptop.
        self.assertEqual((this_week['everyday'], this_week['goals'], this_week['closing'], this_week['closing_free']), (8000, 12500, 42000, 29500))
        self.assertEqual((this_week['needed'], this_week['extra_this_week']), (0, 0))
        # Next week: rent 400 on Thu, pay 200 on Fri, groceries 80, another 125 for the goal.
        self.assertEqual((next_week['money_in'], next_week['bills'], next_week['everyday'], next_week['goals']), (20000, 40000, 8000, 12500))
        self.assertEqual((next_week['closing'], next_week['closing_free']), (14000, -11000))
        self.assertEqual((next_week['lowest'], next_week['lowest_date']), (2000, '2026-10-01'))  # rent lands before payday
        self.assertEqual(next_week['needed_for_bills'], 8000)  # to keep 100 after paying rent
        self.assertEqual((next_week['needed'], next_week['extra_this_week']), (21000, 21000))  # also staying on track for the goal

    def test_events_are_chronological_with_running_balances(self):
        self.plan()
        events = [e for e in self.forecast()['events'] if e['date'] <= '2026-10-04']
        self.assertEqual([(e['date'], e['kind'], e['label']) for e in events], [
            ('2026-09-27', 'everyday', 'Everyday spending'), ('2026-09-27', 'goal', 'Laptop'),
            ('2026-10-01', 'bill', 'Rent'), ('2026-10-02', 'income', 'Cafe job'),
            ('2026-10-04', 'everyday', 'Everyday spending'), ('2026-10-04', 'goal', 'Laptop')])
        self.assertEqual([e['balance'] for e in events], [42000, 42000, 2000, 22000, 14000, 14000])
        self.assertEqual(events[1]['free'], 29500)  # goal savings stay in the balance but are not free

    def test_same_day_money_out_comes_before_money_in(self):
        self.write('income-schedule', {'description': 'Pay', 'amount': '50', 'frequency': 'weekly', 'start_date': '2026-10-01'})
        self.write('bills', {'name': 'Phone', 'amount': '600', 'category': 'Bills', 'start_date': '2026-10-01', 'frequency': 'none'})
        week = self.forecast()['weeks'][1]
        self.assertEqual((week['lowest'], week['closing']), (-10000, -5000))

    def test_everyday_estimate_skips_spending_bills_and_planned_expenses_already_counted(self):
        self.write('budgets', {'category': 'Groceries', 'weekly': '80', 'monthly': '0'})
        self.write('transactions', {'kind': 'expense', 'amount': '30', 'category': 'Groceries', 'description': 'Shop', 'date': '2026-09-25'})
        self.write('transactions', {'kind': 'expense', 'amount': '50', 'category': 'Groceries', 'description': 'Big shop', 'date': '2026-09-30'})
        weeks = self.forecast()['weeks']
        self.assertEqual(weeks[0]['everyday'], 5000)  # 80 - 30 already spent this week
        self.assertEqual((weeks[1]['planned_out'], weeks[1]['everyday']), (5000, 3000))  # 80 - 50 planned
        self.assertEqual(weeks[2]['everyday'], 8000)

    def test_monthly_only_budget_becomes_a_weekly_estimate(self):
        self.write('budgets', {'category': 'Transport', 'weekly': '0', 'monthly': '52'})
        self.assertEqual(self.forecast()['weeks'][1]['everyday'], 1200)  # 52 * 12 / 52 weeks

    def test_everyday_spending_can_be_left_out(self):
        self.plan()
        self.write('profile', {'forecast_everyday': False})
        fc = self.forecast()
        self.assertFalse(fc['include_everyday'])
        self.assertFalse([e for e in fc['events'] if e['kind'] == 'everyday'])

    def test_overdue_bill_is_due_now_paid_bill_and_overdue_pay_are_not_counted(self):
        self.write('bills', {'name': 'Gas', 'amount': '90', 'category': 'Bills', 'start_date': '2026-09-20', 'frequency': 'none'})
        paid = self.write('bills', {'name': 'Water', 'amount': '40', 'category': 'Bills', 'start_date': '2026-09-28', 'frequency': 'none'})['id']
        self.write('pay', {'due_date': '2026-09-28', 'paid_date': '2026-09-26', 'record_expense': True}, paid)
        self.write('income-schedule', {'description': 'Late pay', 'amount': '300', 'frequency': 'monthly', 'start_date': '2026-09-24'})
        fc = self.forecast()
        bills = [(e['date'], e['label'], e['note']) for e in fc['events'] if e['kind'] == 'bill']
        self.assertIn(('2026-09-26', 'Gas', 'Overdue since 2026-09-20'), bills)
        self.assertNotIn('Water', [label for _, label, _ in bills])
        self.assertEqual(fc['unconfirmed_income'], 30000)
        self.assertNotIn(('2026-09-24', 'Late pay'), [(e['date'], e['label']) for e in fc['events']])

    def test_goal_savings_stop_at_target_date_and_remaining_amount(self):
        self.write('goals', {'name': 'Trip', 'target': '300', 'starting': '0', 'monthly': '0', 'target_date': '2026-10-10'})
        saved = [(e['date'], e['set_aside']) for e in self.forecast()['events'] if e['kind'] == 'goal']
        # 300 over the 14 days left is 150 a week; nothing more is set aside once it is covered.
        self.assertEqual(saved, [('2026-09-27', 15000), ('2026-10-04', 15000)])

    def test_minimum_balance_preference_is_validated(self):
        self.write('profile', {'buffer': '250.50'})
        self.assertEqual(f.profile(self.c)['buffer'], 25050)
        for bad in ('-5', 'lots', '1.001'):
            with self.assertRaises(ValueError):
                self.write('profile', {'buffer': bad})
        with self.assertRaises(ValueError):
            self.write('profile', {'forecast_everyday': 'yes'})

    def test_horizon_covers_26_weeks(self):
        fc = self.forecast()
        self.assertEqual((len(fc['weeks']), fc['horizon']), (26, '2027-03-21'))


if __name__ == '__main__':
    unittest.main()
