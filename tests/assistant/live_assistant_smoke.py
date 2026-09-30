"""Optional real Ollama check; synthetic context only, no writes to app databases."""
import sys,json
from pathlib import Path
from datetime import date
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import backend  # adds backend/<feature> folders to the import path
import ai_provider,assistant_catalog

today=date.today().isoformat()
context={'current_date':today,'app':{'current_date':today,'finance':{'profile':{'enabled':True,'currency':'AUD'}},'gym':{'profile':{'enabled':True}},'expense_categories':['Rent','Groceries'],
 'capabilities':{k:v for k,v in assistant_catalog.OPERATIONS.items() if v['module'] in ('finance','gym')},'manual_steps':assistant_catalog.MANUAL}}
prompt='Record these for today: I received $500 from work, paid $200 rent, spent $35.50 on groceries, and ate breakfast with 600 kcal, 60g protein, 50g carbs and 18g fat. Use my AUD finance tracker and Gym food log. These are new entries, not existing bills. Prepare all four actions for review.'
result=ai_provider.chat([{'role':'user','content':prompt}],context=context)
print(json.dumps(result,ensure_ascii=True,indent=2),flush=True)
actions=result['actions'];money=[a for a in actions if a.get('operation')=='finance.transactions'];food=[a for a in actions if a.get('operation')=='gym.food']
assert len(money)==3 and len(food)==1,'Expected three finance actions and one food log.'
assert sorted(float(a['data']['amount']) for a in money)==[35.5,200,500]
assert food[0]['data']['protein']==60
assert all(a['data']['date']==today for a in actions)
print('PASS real Ollama: four correct proposals, no database writes.')
