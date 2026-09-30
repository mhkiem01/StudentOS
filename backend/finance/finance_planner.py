"""Recorded cash balances and explicitly confirmed recurring income."""
import calendar,json,sqlite3,uuid
from contextlib import closing
from datetime import date,datetime,timedelta
from decimal import Decimal
from calendar_store import parse_date

def migrate(path,backups):
 with closing(sqlite3.connect(path)) as c:
  if c.execute("SELECT 1 FROM sqlite_master WHERE name='finance_account'").fetchone():return
  backups.mkdir(parents=True,exist_ok=True)
  with closing(sqlite3.connect(backups/('before-money-planner-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db'))) as b:c.backup(b)
  c.executescript('''BEGIN IMMEDIATE;
  CREATE TABLE finance_account(id INTEGER PRIMARY KEY CHECK(id=1), opening_amount INTEGER NOT NULL, opening_date TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE finance_income_schedules(id TEXT PRIMARY KEY, description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), currency TEXT NOT NULL, start_date TEXT NOT NULL, frequency TEXT NOT NULL, end_date TEXT, paused INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE finance_income_receipts(id TEXT PRIMARY KEY,schedule_id TEXT NOT NULL REFERENCES finance_income_schedules(id) ON DELETE CASCADE,due_date TEXT NOT NULL,transaction_id TEXT NOT NULL UNIQUE REFERENCES finance_transactions(id) ON DELETE CASCADE,UNIQUE(schedule_id,due_date));
  COMMIT;''')

def checked_date(value,label):
 d=parse_date(value,label)
 if not 2000<=d.year<=2100:raise ValueError(label+' must be between 2000 and 2100.')
 return d

def write(c,action,v,key,f,p):
 currency=p['currency'];now=f.stamp()
 if action=='account':
  value=v.get('opening_amount','0')
  try:
   if isinstance(value,bool):raise ValueError()
   n=Decimal(str(value));amount=f.money(abs(n),currency,True)*(-1 if n<0 else 1)
  except Exception:raise ValueError('Enter a valid opening balance, including a minus sign for an overdraft.')
  d=checked_date(v.get('opening_date'),'Opening date')
  if d>date.today():raise ValueError('Opening balance cannot start in the future.')
  c.execute('INSERT OR REPLACE INTO finance_account VALUES(1,?,?,?)',(amount,d.isoformat(),now));return {'ok':True}
 if action=='income-schedule':
  old=c.execute('SELECT * FROM finance_income_schedules WHERE id=?',(key,)).fetchone() if key else None
  if key and not old:raise ValueError('Income schedule no longer exists.')
  start=checked_date(v.get('start_date') or v.get('date'),'First pay date');end=checked_date(v['end_date'],'Last pay date') if v.get('end_date') else None
  if end and end<start:raise ValueError('Last pay date must follow the first pay date.')
  freq=f.choice(v.get('frequency'),('weekly','monthly'),'pay frequency');amount=f.money(v.get('amount'),currency)
  if old and (old['start_date']!=start.isoformat() or old['frequency']!=freq) and c.execute('SELECT 1 FROM finance_income_receipts WHERE schedule_id=?',(key,)).fetchone():raise ValueError('This schedule has received payments. Pause it and create a new schedule to change its start date or frequency.')
  paused=v.get('paused',False)
  if paused not in (False,True,'0','1'):raise ValueError('Choose active or paused.')
  record=v.get('record_first',False)
  if not isinstance(record,bool):raise ValueError('Choose whether the first payment was received.')
  new=not key;key=key or uuid.uuid4().hex
  c.execute('INSERT INTO finance_income_schedules VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description,amount=excluded.amount,start_date=excluded.start_date,frequency=excluded.frequency,end_date=excluded.end_date,paused=excluded.paused,notes=excluded.notes,updated_at=excluded.updated_at',(key,f.text(v.get('description'),'income source'),amount,currency,start.isoformat(),freq,end.isoformat() if end else None,int(paused in (True,'1')),f.text(v.get('notes',''),'notes',10000,True),old['created_at'] if old else now,now))
  if new and record and start<=date.today():write(c,'receive-income',{'due_date':start.isoformat(),'paid_date':start.isoformat()},key,f,p)
  return {'ok':True,'id':key}
 if action=='delete-income-schedule':
  c.execute('DELETE FROM finance_income_schedules WHERE id=?',(key,));return {'ok':True}
 if action=='receive-income':
  row=c.execute('SELECT * FROM finance_income_schedules WHERE id=?',(key,)).fetchone()
  if not row:raise ValueError('Income schedule no longer exists.')
  schedule=dict(row);due=checked_date(v.get('due_date'),'Pay due date');paid=checked_date(v.get('paid_date'),'Received date')
  if paid>date.today() or due>date.today():raise ValueError('Future pay stays planned until its due date; do not mark it received yet.')
  if not any(d==due for d in f.occurrences(schedule,due)):raise ValueError('Invalid pay occurrence.')
  if c.execute('SELECT 1 FROM finance_income_receipts WHERE schedule_id=? AND due_date=?',(key,due.isoformat())).fetchone():return {'ok':True}
  if schedule['paused']:raise ValueError('Resume this schedule before recording its payment.')
  amount=f.money(v['amount'],currency) if v.get('amount') else schedule['amount'];tx=uuid.uuid4().hex
  c.execute('INSERT INTO finance_transactions VALUES(?,?,?,?,?,?,?,?,?,?)',(tx,'income',amount,currency,paid.isoformat(),'Income',schedule['description'],schedule['notes'],now,now))
  c.execute('INSERT INTO finance_income_receipts VALUES(?,?,?,?)',(uuid.uuid4().hex,key,due.isoformat(),tx));return {'ok':True,'id':tx}
 raise ValueError('Unknown planning action.')

def enrich(c,result,day,f):
 row=c.execute('SELECT * FROM finance_account WHERE id=1').fetchone()
 account=dict(row) if row else {'opening_amount':0,'opening_date':'2000-01-01','updated_at':None}
 cutoff=min(day,date.today());end=min(cutoff+timedelta(days=30),date(2100,12,31));start=account['opening_date'];asof=cutoff.isoformat()
 tx=result['transactions'];receipts=f.rows(c,'income_receipts');schedules=f.rows(c,'income_schedules');received={(r['schedule_id'],r['due_date']) for r in receipts}
 pay=[]
 for s in schedules:
  if s['paused']:continue
  for d in f.occurrences(s,end):
   if (s['id'],d.isoformat()) not in received:
    pay.append({**s,'due_date':d.isoformat(),'overdue':d<cutoff,'can_receive':d<=date.today()})
 pay.sort(key=lambda r:(r['due_date'],r['description']))
 ledger=[{**t,'delta':t['amount']*(1 if t['kind']=='income' else -1),'source':'transaction'} for t in tx]
 for payment in result['payments']:
  if not payment['transaction_id']:
   bill=next((b for b in result['bills'] if b['id']==payment['bill_id']),None)
   ledger.append({'id':payment['id'],'date':payment['paid_date'],'description':bill['name'] if bill else 'Bill payment','amount':payment['amount'],'currency':result['profile']['currency'],'kind':'expense','category':payment['category'],'notes':'Paid bill (not duplicated as a transaction)','created_at':payment['created_at'],'delta':-payment['amount'],'source':'bill'})
 ledger.sort(key=lambda t:(t['date'],t['created_at'],t['id']))
 balance=account['opening_amount'] if start<=asof else 0
 for entry in ledger:
  entry['included']=start<=entry['date']<=asof
  if entry['included']:balance+=entry['delta'];entry['running_balance']=balance
  else:entry['running_balance']=None
 # Goals reserve cash inside the recorded balance, not additional expenses.
 reserved=sum(g['starting']+sum(x['amount'] for x in result['contributions'] if x['goal_id']==g['id'] and x['date']<=asof) for g in result['goals'])
 active=[g for g in result['goals'] if not g['paused'] and g['remaining']>0]
 goals={'active':len(active),'weekly':sum(g['weekly_needed'] or 0 for g in active),'monthly':sum(g['monthly_needed'] or 0 for g in active),'planned_monthly':sum(min(g['monthly'],g['remaining']) for g in active),'overdue':sum(1 for g in active if g['target_date']<=day.isoformat()),'overdue_remaining':sum(g['remaining'] for g in active if g['target_date']<=day.isoformat())}
 pending_tx=[t for t in ledger if max(asof,start)<=t['date']<=end.isoformat() and t['date']>asof]
 expected=sum(r['amount'] for r in pay if max(asof,start)<r['due_date']<=end.isoformat())
 payments={(r['bill_id'],r['due_date']) for r in result['payments']};bills=0
 for b in result['bills']:
  bills+=sum(b['amount'] for d in f.occurrences(b,end) if (b['id'],d.isoformat()) not in payments and d.isoformat()>=start)
 future=sum(t['delta'] for t in pending_tx)
 month_end=cutoff.replace(day=calendar.monthrange(cutoff.year,cutoff.month)[1]).isoformat();month_start=cutoff.replace(day=1).isoformat()
 commitments=0
 for category in f.CATEGORIES:
  budget=next((b['monthly'] for b in result['budgets'] if b['category']==category),0)
  spent=sum(-t['delta'] for t in ledger if t['kind']=='expense' and t['category']==category and max(start,month_start)<=t['date']<=asof)
  planned_expenses=sum(-t['delta'] for t in ledger if t['kind']=='expense' and t['category']==category and asof<t['date']<=month_end and t['date']>=start)
  unpaid=sum(b['amount'] for b in result['bills'] if b['category']==category for d in f.occurrences(b,date.fromisoformat(month_end)) if d.isoformat()>=start and (b['id'],d.isoformat()) not in payments)
  commitments+=max(max(0,budget-spent),unpaid+planned_expenses)
 balance_plan=0
 for g in result['goals']:
  if g['paused']:continue
  history=[x for x in result['contributions'] if x['goal_id']==g['id']]
  remaining=max(0,g['target']-g['starting']-sum(x['amount'] for x in history if x['date']<=asof))
  balance_plan+=min(remaining,max(0,g['monthly']-sum(x['amount'] for x in history if month_start<=x['date']<=asof)))
 result.update(account={**account,'configured':row is not None},income_schedules=schedules,income_receipts=receipts,income_occurrences=pay,ledger=list(reversed(ledger)),goal_totals=goals)
 result['balance']={'as_of':asof,'recorded':balance,'reserved':reserved,'unallocated':balance-reserved,'commitments':commitments,'remaining_goal_plan':balance_plan,'available':balance-reserved-commitments-balance_plan,'forecast_end':end.isoformat(),'expected_income':expected,'overdue_income':sum(r['amount'] for r in pay if r['due_date']<=asof),'upcoming_bills':bills,'planned_net':future,'projected':balance+expected+future-bills,'excluded_earlier':sum(t['date']<start for t in ledger)}
 period_entries=[t for t in ledger if result['summary']['month_start']<=t['date']<=result['summary']['month_end'] and t['date']<=asof]
 result['balance']['period_income']=sum(t['amount'] for t in period_entries if t['kind']=='income')
 result['balance']['period_spending']=sum(t['amount'] for t in period_entries if t['kind']=='expense')
