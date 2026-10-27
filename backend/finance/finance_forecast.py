"""Plan ahead: where the recorded balance is heading, week by week.

Built only from what the student has entered, never from guessed income:
- scheduled pay not yet received, on its due date (overdue pay is NOT assumed);
- unpaid bills, with overdue ones due now;
- future-dated income and expenses already recorded;
- optionally, everyday spending estimated from budget limits, minus bills and
  planned expenses in that category that week (so nothing is counted twice);
- goal savings, which set money aside but do not leave the balance.

For each week it reports the closing balance, the free cash after goal
savings, the lowest point, and how much extra must be earned by then to stay
at or above the student's minimum balance. Same-day money out is applied
before money in, so the lowest point is never understated.
"""
from datetime import date, timedelta

WEEKS = 26
ORDER = {'bill': 0, 'planned': 0, 'everyday': 0, 'income': 1, 'goal': 2}


def build(result, f):
    profile, balance, account = result['profile'], result['balance'], result['account']
    today = date.fromisoformat(balance['as_of'])
    opening = account['opening_date']
    week0 = today - timedelta(days=today.weekday())
    horizon = week0 + timedelta(days=7 * WEEKS - 1)
    buffer = int(profile.get('buffer') or 0)
    everyday = profile.get('forecast_everyday', True) is not False
    events = []

    def add(day, kind, label, delta, category='', note='', set_aside=0):
        events.append({'date': day.isoformat(), 'kind': kind, 'label': label, 'category': category,
                       'delta': delta, 'set_aside': set_aside, 'note': note})

    received = {(r['schedule_id'], r['due_date']) for r in result['income_receipts']}
    for s in result['income_schedules']:
        if s['paused']:
            continue
        for d in f.occurrences(s, horizon):
            if d > today and d.isoformat() >= opening and (s['id'], d.isoformat()) not in received:
                add(d, 'income', s['description'], s['amount'], 'Income', 'Expected %s pay' % s['frequency'])

    paid = {(p['bill_id'], p['due_date']) for p in result['payments']}
    for b in result['bills']:
        for d in f.occurrences(b, horizon):
            if d.isoformat() >= opening and (b['id'], d.isoformat()) not in paid:
                add(max(d, today), 'bill', b['name'], -b['amount'], b['category'],
                    'Overdue since ' + d.isoformat() if d < today else 'Bill due')

    for t in result['ledger']:
        if t['date'] > balance['as_of'] and t['date'] >= opening and t['date'] <= horizon.isoformat():
            add(date.fromisoformat(t['date']), 'planned', t['description'], t['delta'], t['category'], 'Future-dated entry')

    if everyday:
        spent_now = {}
        for t in result['ledger']:
            if t.get('included') and t['kind'] == 'expense' and week0.isoformat() <= t['date'] <= balance['as_of']:
                spent_now[t['category']] = spent_now.get(t['category'], 0) - t['delta']
        scheduled = [e for e in events if e['delta'] < 0]
        for w in range(WEEKS):
            start, end = week0 + timedelta(days=7 * w), week0 + timedelta(days=7 * w + 6)
            for b in result['budgets']:
                allowance = b['weekly'] or ((b['monthly'] * 12 + 51) // 52 if b['monthly'] else 0)
                if not allowance:
                    continue
                covered = sum(-e['delta'] for e in scheduled if e['category'] == b['category'] and start.isoformat() <= e['date'] <= end.isoformat())
                left = allowance - covered - (spent_now.get(b['category'], 0) if w == 0 else 0)
                if left > 0:
                    add(end, 'everyday', 'Everyday spending', -left, b['category'], b['category'] + ' budget estimate')

    for g in result['goals']:
        if g['paused'] or g['remaining'] <= 0 or not g['weekly_needed']:
            continue
        target, left = date.fromisoformat(g['target_date']), g['remaining']
        for w in range(WEEKS):
            start = week0 + timedelta(days=7 * w)
            if start > target or left <= 0:
                break
            amount = min(g['weekly_needed'], left)
            left -= amount
            add(min(start + timedelta(days=6), target), 'goal', g['name'], 0, 'Goal', 'Set aside for this goal', amount)

    events.sort(key=lambda e: (e['date'], ORDER[e['kind']], e['label']))
    cash, aside = balance['recorded'], balance['reserved']
    weeks = []
    for w in range(WEEKS):
        start = week0 + timedelta(days=7 * w)
        week = {'start': start.isoformat(), 'end': (start + timedelta(days=6)).isoformat(), 'opening': None,
                'money_in': 0, 'bills': 0, 'planned_out': 0, 'everyday': 0, 'goals': 0}
        weeks.append(week)
    index = 0
    for w, week in enumerate(weeks):
        week['opening'] = cash
        lowest, lowest_free, lowest_date = cash, cash - aside, week['start'] if w else today.isoformat()
        while index < len(events) and events[index]['date'] <= week['end']:
            e = events[index]
            index += 1
            cash += e['delta']
            aside += e['set_aside']
            e['balance'], e['free'] = cash, cash - aside
            if e['delta'] > 0:
                week['money_in'] += e['delta']
            elif e['kind'] == 'bill':
                week['bills'] -= e['delta']
            elif e['kind'] == 'everyday':
                week['everyday'] -= e['delta']
            elif e['delta'] < 0:
                week['planned_out'] -= e['delta']
            week['goals'] += e['set_aside']
            if cash < lowest:
                lowest, lowest_date = cash, e['date']
            lowest_free = min(lowest_free, cash - aside)
        week.update(closing=cash, closing_free=cash - aside, lowest=lowest, lowest_date=lowest_date, lowest_free=lowest_free)

    # Extra income needed BY the end of each week, so the balance (and the free
    # cash after goal savings) never drops below the chosen minimum before then.
    floor_cash = floor_free = None
    previous = 0
    for week in weeks:
        floor_cash = week['lowest'] if floor_cash is None else min(floor_cash, week['lowest'])
        floor_free = week['lowest_free'] if floor_free is None else min(floor_free, week['lowest_free'])
        week['needed_for_bills'] = max(0, buffer - floor_cash)
        week['needed'] = max(0, buffer - floor_free)
        week['extra_this_week'] = week['needed'] - previous
        previous = week['needed']

    result['forecast'] = {
        'as_of': balance['as_of'], 'horizon': horizon.isoformat(), 'buffer': buffer, 'include_everyday': everyday,
        'start_balance': balance['recorded'], 'start_set_aside': balance['reserved'],
        'goal_weekly': result['goal_totals']['weekly'], 'goal_monthly': result['goal_totals']['monthly'],
        'unconfirmed_income': balance['overdue_income'], 'events': events, 'weeks': weeks,
    }
