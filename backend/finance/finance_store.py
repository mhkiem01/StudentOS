"""Optional personal finance ledger. Money uses integer minor units, not floats.

Safe-to-spend is a period estimate, NOT a bank balance:
month income - recorded expenses - monthly goal contributions - remaining
active goal monthly plans - protected commitments. For each category protect
max(unspent monthly budget, unpaid bills due through month end), so a bill
already covered by a budget is not counted twice. Paid bills not recorded as
expenses are separately subtracted, and count against category budgets.
Negative estimates remain negative. Historical balances/income are not assumed.
"""
import calendar
import finance_planner
import json
import sqlite3
import uuid
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_CEILING
from calendar_store import parse_date
from currency_provider import CURRENCIES

CATEGORIES = ('Food / Eating Out','Groceries','Transport','Bills','Rent','Fun / Shopping','Health','Education','Travel','Subscriptions','Other')
DEFAULTS = {'enabled':False,'currency':'AUD','week_start':'monday','period':'month'}
TABLES = ('transactions','goals','contributions','budgets','bills','payments')


def stamp(): return datetime.now(timezone.utc).isoformat()
def encode(v): return json.dumps(v, ensure_ascii=False, allow_nan=False)
def scale(currency): return 1 if currency in ('JPY','KRW') else 100


def money(value, currency, zero=False):
    try:
        if isinstance(value, bool): raise ValueError()
        number = Decimal(str(value)) * scale(currency)
        if not number.is_finite() or number != number.to_integral_value() or not (0 if zero else 1) <= number <= 10**12:
            raise ValueError()
        return int(number)
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError('Enter a valid amount with the correct currency precision (up to 10 billion in two-decimal currencies).')


def text(value, label, limit=500, optional=False):
    if not isinstance(value,str) or len(value)>limit or (not optional and not value.strip()):
        raise ValueError('Enter a valid '+label+'.')
    return value.strip()


def choice(value, values, label):
    if value not in values: raise ValueError('Choose a valid '+label+'.')
    return value


def migrate(path, backups):
    with closing(sqlite3.connect(path)) as con:
        if con.execute("SELECT 1 FROM sqlite_master WHERE name='finance_profile'").fetchone():
            finance_planner.migrate(path,backups)
            return
        backups.mkdir(parents=True,exist_ok=True)
        with closing(sqlite3.connect(backups/('before-finance-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))) as dest: con.backup(dest)
        con.executescript('''BEGIN IMMEDIATE;
        CREATE TABLE finance_profile(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
        CREATE TABLE finance_transactions(id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('income','expense')), amount INTEGER NOT NULL CHECK(amount>0), currency TEXT NOT NULL, date TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE INDEX finance_transaction_date ON finance_transactions(date);
        CREATE TABLE finance_goals(id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL, target INTEGER NOT NULL CHECK(target>0), starting INTEGER NOT NULL CHECK(starting>=0), target_date TEXT NOT NULL, monthly INTEGER NOT NULL CHECK(monthly>=0), paused INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE finance_contributions(id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES finance_goals(id) ON DELETE CASCADE, amount INTEGER NOT NULL CHECK(amount>0), date TEXT NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE finance_budgets(id TEXT PRIMARY KEY, category TEXT NOT NULL UNIQUE, currency TEXT NOT NULL, weekly INTEGER NOT NULL CHECK(weekly>=0), monthly INTEGER NOT NULL CHECK(monthly>=0), updated_at TEXT NOT NULL);
        CREATE TABLE finance_bills(id TEXT PRIMARY KEY, name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), currency TEXT NOT NULL, category TEXT NOT NULL, start_date TEXT NOT NULL, frequency TEXT NOT NULL, end_date TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE finance_payments(id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES finance_bills(id) ON DELETE CASCADE, due_date TEXT NOT NULL, paid_date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), category TEXT NOT NULL, transaction_id TEXT REFERENCES finance_transactions(id) ON DELETE SET NULL, created_at TEXT NOT NULL, UNIQUE(bill_id,due_date));
        CREATE TABLE finance_currency_rates(id TEXT PRIMARY KEY, base TEXT NOT NULL, data TEXT NOT NULL, provider TEXT NOT NULL, fetched_at TEXT NOT NULL);
        COMMIT;''')
    finance_planner.migrate(path,backups)


def profile(con):
    row=con.execute('SELECT data FROM finance_profile WHERE id=1').fetchone()
    return {**DEFAULTS,**(json.loads(row[0]) if row else {})}


def rows(con, table): return [dict(r) for r in con.execute('SELECT * FROM finance_'+table)]


def occurrence(bill, n):
    start=parse_date(bill['start_date'],'Bill date')
    freq=bill['frequency']
    if freq=='none': return start if n==0 else None
    if freq in ('weekly','fortnightly'): return start+timedelta(days=n*(7 if freq=='weekly' else 14))
    months=n*{'monthly':1,'quarterly':3,'yearly':12}[freq]
    year, month=divmod(start.year*12+start.month-1+months,12);month+=1
    if year>9999: return None
    return date(year,month,min(start.day,calendar.monthrange(year,month)[1]))


def occurrences(bill, end):
    # Anchor each month to the ORIGINAL day: Jan 31 -> Feb 28 -> Mar 31.
    until=min(end,parse_date(bill['end_date'],'End date')) if bill['end_date'] else end
    for n in range(12000):
        d=occurrence(bill,n)
        if d is None or d>until: break
        yield d


def state(con, anchor=None):
    day=parse_date(anchor,'Period date') if anchor else date.today()
    if not 2000 <= day.year <= 2100:
        raise ValueError('Browse Finance periods between 2000 and 2100.')
    first=day.replace(day=1);last=day.replace(day=calendar.monthrange(day.year,day.month)[1])
    week=day-timedelta(days=day.weekday());week_end=week+timedelta(days=6)
    result={'profile':profile(con),'categories':CATEGORIES,'currencies':CURRENCIES,**{t:rows(con,t) for t in TABLES}}
    tx=result['transactions'];contrib=result['contributions']
    within=lambda r,a,b:a.isoformat()<=r['date']<=b.isoformat()
    month_tx=[r for r in tx if within(r,first,last)]
    income=sum(r['amount'] for r in month_tx if r['kind']=='income')
    expenses=sum(r['amount'] for r in month_tx if r['kind']=='expense')
    month_contrib=sum(r['amount'] for r in contrib if within(r,first,last))
    goals=[];remaining_plans=0
    for g in result['goals']:
        g['data']=json.loads(g['data'])
        history=[c for c in contrib if c['goal_id']==g['id']]
        saved=g['starting']+sum(c['amount'] for c in history if c['date']<=day.isoformat())
        remaining=max(0,g['target']-saved);days=(parse_date(g['target_date'],'Target date')-day).days
        planned=min(remaining,max(0,g['monthly']-sum(c['amount'] for c in history if within(c,first,last)))) if not g['paused'] else 0
        remaining_plans+=planned
        projected_days=(remaining*365+g['monthly']*12-1)//(g['monthly']*12) if g['monthly'] and remaining else 0
        completion=(day+timedelta(days=projected_days)).isoformat() if g['monthly'] and projected_days<(date.max-day).days else (day.isoformat() if not remaining else None)
        goals.append({**g,'saved':saved,'remaining':remaining,'weekly_needed':(remaining*7+days-1)//days if days>0 else None,'monthly_needed':int((Decimal(remaining)*365/(12*days)).to_integral_value(rounding=ROUND_CEILING)) if days>0 else None,'estimated_completion':completion})
    result['goals']=goals
    payments={(r['bill_id'],r['due_date']):r for r in result['payments']}
    upcoming=[];unpaid={c:0 for c in CATEGORIES}
    for b in result['bills']:
        for due in occurrences(b,max(last,week_end)):
            key=(b['id'],due.isoformat());paid=payments.get(key)
            if due<=last and not paid:unpaid[b['category']]+=b['amount']
            if due>=first or not paid:
                upcoming.append({**b,'due_date':due.isoformat(),'payment':paid,'occurrence_status':'paid' if paid else ('overdue' if due<day else b['status'])})
    result['occurrences']=sorted(upcoming,key=lambda b:(b['due_date'],b['name']))
    unrecorded=[p for p in result['payments'] if not p['transaction_id'] and first.isoformat()<=p['paid_date']<=last.isoformat()]
    budgets=[];protected=0
    for category in CATEGORIES:
        b=next((r for r in result['budgets'] if r['category']==category),{})
        monthly_spent=sum(r['amount'] for r in month_tx if r['kind']=='expense' and r['category']==category)
        weekly_spent=sum(r['amount'] for r in tx if r['kind']=='expense' and r['category']==category and within(r,week,week_end))
        paid_extra=sum(p['amount'] for p in unrecorded if p['category']==category)
        protected+=max(max(0,b.get('monthly',0)-monthly_spent-paid_extra),unpaid[category])
        if b:budgets.append({**b,'monthly_spent':monthly_spent,'weekly_spent':weekly_spent,'monthly_remaining':b['monthly']-monthly_spent,'weekly_remaining':b['weekly']-weekly_spent})
    result['budgets']=budgets
    breakdown=[]
    for category in CATEGORIES:
        amount=sum(r['amount'] for r in tx if r['kind']=='expense' and r['category']==category and within(r,week,week_end))
        previous=sum(r['amount'] for r in tx if r['kind']=='expense' and r['category']==category and within(r,week-timedelta(days=7),week-timedelta(days=1)))
        if amount or previous:breakdown.append({'category':category,'amount':amount,'previous':previous})
    result['summary']={'income':income,'spending':expenses,'savings':income-expenses,'safe':income-expenses-month_contrib-remaining_plans-protected-sum(p['amount'] for p in unrecorded),'contributions':month_contrib,'goal_plans':remaining_plans,'protected':protected,'paid_unrecorded':sum(p['amount'] for p in unrecorded),'breakdown':breakdown,'week_start':week.isoformat(),'week_end':week_end.isoformat(),'month_start':first.isoformat(),'month_end':last.isoformat(),'anchor':day.isoformat()}
    rates=con.execute('SELECT * FROM finance_currency_rates ORDER BY fetched_at DESC,rowid DESC LIMIT 1').fetchone()
    result['rates']={**dict(rates),'data':json.loads(rates['data'])} if rates else None
    finance_planner.enrich(con,result,day,__import__(__name__))
    return result


def store_rates(con, snapshot):
    con.execute('INSERT INTO finance_currency_rates VALUES(?,?,?,?,?)',(str(uuid.uuid4()),snapshot['base'],encode(snapshot['rates']),snapshot['provider'],snapshot['fetched_at']))


def write(con, payload):
    if not isinstance(payload,dict):raise ValueError('Invalid Finance request.')
    # Serialize preference/ledger changes and repeated payment requests so
    # concurrent tabs cannot relabel money or produce duplicate bill expenses.
    if not con.in_transaction: con.execute('BEGIN IMMEDIATE')
    action=payload.get('action');v=payload.get('data',{});key=payload.get('id');p=profile(con);currency=p['currency'];now=stamp()
    if not isinstance(v,dict):raise ValueError('Invalid Finance data.')
    if action=='profile':
        for k in v:
            if k not in DEFAULTS:raise ValueError('Unknown preference.')
        if 'enabled' in v and not isinstance(v['enabled'],bool):raise ValueError('Enabled must be true or false.')
        if 'currency' in v:
            choice(v['currency'],CURRENCIES,'currency')
            if v['currency']!=currency and any(con.execute('SELECT 1 FROM finance_'+t+' LIMIT 1').fetchone() for t in ('transactions','goals','budgets','bills','account','income_schedules')):
                raise ValueError('Base currency is locked once financial records exist, to protect historical amounts. No automatic conversion is performed.')
        if 'week_start' in v:choice(v['week_start'],('monday',),'week start')
        if 'period' in v:choice(v['period'],('week','month'),'budget period')
        con.execute('INSERT OR REPLACE INTO finance_profile VALUES(1,?)',(encode({**p,**v}),));return {'ok':True}
    if not p['enabled']:raise ValueError('Enable Finance in Settings first.')
    if action in ('account','income-schedule','receive-income','delete-income-schedule'):
        return finance_planner.write(con,action,v,key,__import__(__name__),p)
    if action=='delete':
        table=choice(v.get('table'),('transactions','goals','budgets','bills','contributions'),'record type')
        if table=='transactions' and con.execute('SELECT 1 FROM finance_payments WHERE transaction_id=?',(key,)).fetchone():raise ValueError('This expense is linked to a bill payment. Keep it to preserve payment history.')
        con.execute('DELETE FROM finance_'+table+' WHERE id=?',(key,));return {'ok':True}
    if action=='pay':
        bill=con.execute('SELECT * FROM finance_bills WHERE id=?',(key,)).fetchone()
        if not bill:raise ValueError('Bill no longer exists.')
        due=parse_date(v.get('due_date'),'Due date');paid=parse_date(v.get('paid_date'),'Payment date')
        if not any(d==due for d in occurrences(dict(bill),due)):raise ValueError('Invalid bill occurrence.')
        if con.execute('SELECT 1 FROM finance_payments WHERE bill_id=? AND due_date=?',(key,due.isoformat())).fetchone():return {'ok':True}
        if not isinstance(v.get('record_expense'),bool):raise ValueError('Choose whether to record an expense.')
        txid=str(uuid.uuid4()) if v['record_expense'] else None
        if txid:con.execute('INSERT INTO finance_transactions VALUES(?,?,?,?,?,?,?,?,?,?)',(txid,'expense',bill['amount'],currency,paid.isoformat(),bill['category'],bill['name'],'Bill payment',now,now))
        con.execute('INSERT INTO finance_payments VALUES(?,?,?,?,?,?,?,?)',(str(uuid.uuid4()),key,due.isoformat(),paid.isoformat(),bill['amount'],bill['category'],txid,now))
        return {'ok':True}
    table=choice(action,('transactions','goals','contributions','budgets','bills'),'action')
    old=con.execute('SELECT * FROM finance_'+table+' WHERE id=?',(key,)).fetchone() if key else None
    if key and not old:raise ValueError('Record no longer exists. Refresh and try again.')
    key=key or str(uuid.uuid4());values={};created=old['created_at'] if old and 'created_at' in old.keys() else now
    if table=='transactions':
        if old and con.execute('SELECT 1 FROM finance_income_receipts WHERE transaction_id=?',(key,)).fetchone():raise ValueError('This income is linked to a received payment. Delete it to undo receipt, then mark the payment received with the corrected amount.')
        if old and con.execute('SELECT 1 FROM finance_payments WHERE transaction_id=?',(key,)).fetchone():raise ValueError('Bill-linked transactions cannot be edited independently.')
        kind=choice(v.get('kind'),('income','expense'),'transaction type')
        values=dict(kind=kind,amount=money(v.get('amount'),currency),currency=currency,date=parse_date(v.get('date'),'Transaction date').isoformat(),category=choice(v.get('category'),CATEGORIES,'category') if kind=='expense' else 'Income',description=text(v.get('description'),'source or description'),notes=text(v.get('notes',''),'notes',10000,True),created_at=created,updated_at=now)
    elif table=='goals':
        kind=choice(v.get('type','purchase'),('purchase','travel','emergency','other'),'goal type')
        travel={}
        if kind=='travel':
            travel={'destination':text(v.get('destination',''),'destination',200,True),'travel_date':parse_date(v.get('travel_date') or v.get('target_date'),'Travel date').isoformat(),**{k:money(v.get(k,'0') or '0',currency,True) for k in ('flights','accommodation','food','transport','activities','shopping','other')}}
        values=dict(name=text(v.get('name'),'goal name'),currency=currency,target=money(v.get('target'),currency),starting=money(v.get('starting','0'),currency,True),target_date=parse_date(v.get('target_date'),'Target date').isoformat(),monthly=money(v.get('monthly','0'),currency,True),paused=int(v.get('paused') in (True,'1','true')),data=encode({'type':kind,'icon':text(v.get('icon','🎯'),'icon',8,True),'notes':text(v.get('notes',''),'notes',10000,True),'travel':travel}),created_at=created,updated_at=now)
    elif table=='contributions':
        if not con.execute('SELECT 1 FROM finance_goals WHERE id=?',(v.get('goal_id'),)).fetchone():raise ValueError('Choose an existing goal.')
        values=dict(goal_id=v['goal_id'],amount=money(v.get('amount'),currency),date=parse_date(v.get('date'),'Contribution date').isoformat(),notes=text(v.get('notes',''),'notes',10000,True),created_at=created)
    elif table=='budgets':
        category=choice(v.get('category'),CATEGORIES,'category')
        existing=con.execute('SELECT id FROM finance_budgets WHERE category=?',(category,)).fetchone()
        if existing and existing['id']!=key:raise ValueError('This category already has a budget. Edit that budget instead.')
        values=dict(category=category,currency=currency,weekly=money(v.get('weekly','0'),currency,True),monthly=money(v.get('monthly','0'),currency,True),updated_at=now)
    elif table=='bills':
        if old and con.execute('SELECT 1 FROM finance_payments WHERE bill_id=?',(key,)).fetchone():raise ValueError('A bill with payments cannot be rewritten. Create a new bill for changed terms, or delete the old schedule (expenses remain).')
        start=parse_date(v.get('start_date'),'First due date');end=parse_date(v['end_date'],'End date') if v.get('end_date') else None
        if end and end<start:raise ValueError('End date must follow the first due date.')
        if start.year<2000:raise ValueError('Choose a bill start date from 2000 onwards.')
        values=dict(name=text(v.get('name'),'bill name'),amount=money(v.get('amount'),currency),currency=currency,category=choice(v.get('category'),CATEGORIES,'category'),start_date=start.isoformat(),frequency=choice(v.get('frequency','none'),('none','weekly','fortnightly','monthly','quarterly','yearly'),'frequency'),end_date=end.isoformat() if end else None,status=choice(v.get('status','upcoming'),('upcoming','scheduled'),'status'),created_at=created,updated_at=now)
    cols=['id',*values];con.execute('INSERT INTO finance_'+table+' ('+','.join(cols)+') VALUES('+','.join('?' for _ in cols)+') ON CONFLICT(id) DO UPDATE SET '+','.join(k+'=excluded.'+k for k in values),[key,*values.values()])
    return {'ok':True,'id':key}
