"""Private test process: temporary SQLite + deterministic AI. Never user data."""
import sys,json,tempfile,time
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import backend  # adds backend/<feature> folders to the import path
import server,ai_provider,accounts

# Deterministic rates only inside this temporary test process.
def finance_rates(base):
    return {'base':base,'rates':{c:{'rate':str(i+1),'rate_date':'2026-09-21'} for i,c in enumerate(server.currency_provider.CURRENCIES) if c!=base},'provider':'Test fixture','fetched_at':'2026-09-21T00:00:00Z'}
server.currency_provider.get_latest_rates=finance_rates

def model(payload,on_progress=None):
    if any('test missing drafts' in m.get('content','').lower() for m in payload['messages'] if m.get('role')=='user'):
        return {'message': {'content': json.dumps({'reply': "I'll prepare the actions.", 'actions': []})}}
    text=payload['messages'][-1]['content'].lower()
    if 'test study action' in text:
        actions=[{'type':'app_action','operation':'notes.save','data':{'title':'Assistant revision','content':'TCP provides reliable ordered delivery.','subject_id':'computing','topic_name':'Networks'}},
                 {'type':'app_action','operation':'questions.save','data':{'topic_name':'Networks','question':'Which is reliable?','choices':{'A':'TCP','B':'UDP'},'answer':'A','explain':'TCP provides reliable delivery.'}},
                 {'type':'app_action','operation':'flashcards.save','data':{'topic_name':'Networks','front':'Reliable transport','back':'TCP'}}]
        return {'message':{'content':json.dumps({'reply':'Review study resources','actions':actions})}}
    if 'test shared action' in text:
        return {'message':{'content':json.dumps({'reply':'Review audience','actions':[{'type':'app_action','operation':'social.post','data':{'body':'Study group update','audience':'friends'}}]})}}
    if 'test app actions' in text:
        from datetime import date
        day=date.today().isoformat()
        actions=[{'type':'app_action','operation':'finance.transactions','data':{'kind':kind,'amount':amount,'date':day,'category':category,'description':description}} for kind,amount,category,description in [('income','500','Income','Work pay'),('expense','200','Rent','Rent'),('expense','35.50','Groceries','Groceries')]]
        actions.append({'type':'app_action','operation':'gym.food','data':{'name':'Breakfast','date':day,'calories':600,'protein':60,'carbs':50,'fat':18}})
        return {'message':{'content':json.dumps({'reply':'Ready to review','actions':actions})}}
    if 'test failure' in text:raise RuntimeError('Test model unavailable')
    if 'test slow' in text:
        for i in range(10):
            time.sleep(.2)
            if on_progress:on_progress({'type':'progress','characters':i})
    if 'note' in text:
        actions=[{'type':'notes_create','notes':[{'title':'TCP revision','content':'TCP provides ordered delivery.','subject':'Computing'}]}]
    elif 'class' in text or 'timetable' in text or 'study session' in text:
        actions=[{'type':'timetable_import','events':[{'title':'COMP1521 tutorial','day':0,'event_date':'2026-10-05','start_time':'09:30','end_time':'10:30','location':'Lab 1','recurrence':'none'}]}]
        if 'mixed' in text:
            actions[0]['events'][0]['title']='Mixed one-off'
            actions[0]['events'].append({'title':'Mixed weekly','day':1,'event_date':'2026-10-06','start_time':'11:00','end_time':'12:00','location':'','recurrence':'weekly','repeat_until':'2026-11-17'})
    elif 'remind' in text or 'deadline' in text:
        actions=[{'type':'reminders_create','reminders':[{'title':'COMP1521 submission','due_date':'2026-09-21','due_time':'17:00','recurrence':'weekly','repeat_until':'2026-11-16','day':0}]}]
    else:actions=[]
    return {'message':{'content':json.dumps({'reply':'Let us break this into manageable steps.','actions':actions})}}

with tempfile.TemporaryDirectory(prefix='portal-chat-tests-') as tmp:
    original=server.ROOT;server.ROOT=Path(tmp);server.DB_PATH=Path(tmp)/'test.db';server.init_db();server.ROOT=original
    server.import_state({'subjects':{'computing':{'name':'Computing','topics':['Networks']},'math':{'name':'Mathematics','topics':['Algebra']}},'topics':{'Networks':[],'Algebra':[]}})
    if '--notes' in sys.argv:
        for i in range(5):
            server.save_portal({'table':'notes','item':{'id':'n'+str(i),'title':['Network fundamentals','TCP and reliability','Revision checklist','Practical commands','Exam preparation'][i],'subject_id':'computing','topic_name':'Networks' if i<3 else None,'content':'# Core ideas\n\nA network connects **devices** so they can exchange information.\n\n## Key concepts\n\n1. Addressing identifies a destination.\n2. TCP provides ordered delivery.\n3. Routing chooses a path.\n\n> [!TAKEAWAY]\n> Learn the purpose of each layer before memorising the protocol names.\n\n```\nping example.com\n```\n\n- [ ] Review your lecture notes\n- [x] Try a practice question','week':i+1,'is_pinned':int(i<2),'tags':['Revision','Networks'] if i<3 else ['Practice']}})
        server.save_portal({'table':'notes','item':{'id':'math-note','title':'Algebra only','subject_id':'math','topic_name':'Algebra','content':'Unique mathematics material.'}})
        with server.connect() as con:con.execute("INSERT INTO notes(id,title,content,updated_at,created_at) VALUES('legacy-unassigned','Preserved unassigned note','Keep this content','2024-01-01','2024-01-01')")
        ai_provider.note_study=lambda note,kind:{'ok':True,'text':'Front: What does TCP provide?\nBack: Ordered delivery.\nExplain: It is reliable transport.' if kind=='flashcards' else 'Question: What does TCP provide?\nAnswer choices:\nA. Ordered delivery\nB. Screen brightness\nC. Power supply\nD. File names\nAnswer: A\nExplain: TCP is reliable transport.'}
    ai_provider._ollama_chat=model
    ai_provider.status=lambda:{'online':True,'model_available':True,'model':'test-model','provider':'ollama'}
    httpd=ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])),server.Handler)
    httpd.accounts_path=Path(tmp)/'accounts.db'
    accounts.initialize(httpd.accounts_path,admin_name='Test Student',password='Fixture-password-123!',must_change=False)
    print('READY',flush=True)
    try:httpd.serve_forever()
    finally:httpd.server_close()
