"""Explicit assistant capability catalogue: no arbitrary URLs, SQL or Python."""
OPERATIONS = {}

def add(module, action, example, required='', description='', risk='private'):
    OPERATIONS[module+'.'+action] = dict(module=module, action=action, fields=example,
        required=required.split(), description=description or (module+' '+action.replace('_',' ').replace('-',' ')), risk=risk)

add('finance','transactions',dict(kind='income',amount='100.00',date='YYYY-MM-DD',category='Groceries',description='Work pay',notes=''),'kind amount date description','Record or edit income/expense. Amounts in MAJOR currency units; expense category required. Not a real bank transfer.')
add('finance','goals',dict(name='',target='1000',starting='0',target_date='YYYY-MM-DD',monthly='0',paused=False,type='purchase',notes=''),'name target target_date')
add('finance','contributions',dict(goal_id='',amount='50',date='YYYY-MM-DD',notes=''),'goal_id amount date')
add('finance','budgets',dict(category='Groceries',weekly='50',monthly='200'),'category')
add('finance','bills',dict(name='',amount='100',category='Rent',start_date='YYYY-MM-DD',frequency='monthly',end_date='',status='upcoming'),'name amount category start_date')
add('finance','pay',dict(due_date='YYYY-MM-DD',paid_date='YYYY-MM-DD',record_expense=True),'due_date paid_date record_expense','Mark an existing bill paid in the tracker, not a real payment. Requires bill id.')
add('finance','income-schedule',dict(description='',amount='100',start_date='YYYY-MM-DD',frequency='weekly',end_date='',paused=False,record_first=False,notes=''),'description amount start_date frequency')
add('finance','receive-income',dict(due_date='YYYY-MM-DD',paid_date='YYYY-MM-DD',amount='100'),'due_date paid_date','Record received pay from an existing schedule id.')
add('finance','account',dict(opening_amount='0',opening_date='YYYY-MM-DD'),'opening_amount opening_date','Change opening balance reference; not additional income.')
add('finance','profile',dict(enabled=True,currency='AUD',period='month'),'','Enable/disable Finance or change its preferences.')
add('finance','delete',dict(table='transactions'),'table','Delete selected transaction, goal, contribution, budget or bill. Requires existing id.','destructive')
add('finance','delete-income-schedule',{},'','Delete income schedule by id; received payments remain.','destructive')
add('gym','profile',dict(enabled=True,level='beginner',goal='muscle',equipment='gym',duration=45,units='kg'))
add('gym','athlete',dict(age=21,gender='Prefer not to say',activity='light',height=175,weight=70),'age gender activity height weight','Adult profile: height cm, weight kg. Do not infer gender or health details.')
add('gym','food',dict(name='Breakfast',date='YYYY-MM-DD',calories=500,protein=60,carbs=40,fat=15),'name date calories protein carbs fat','Log food: kcal and grams. Never invent unspecified nutrients; ask or leave required fields empty for review.')
add('gym','delete_food',{},'','Delete food log by id.','destructive')
add('gym','measurement',dict(date='YYYY-MM-DD',weight=70,waist=80,chest=90,arms=30,legs=50),'date','Append only measurements explicitly reported by user. Weight kg, dimensions cm.')
add('gym','workout',dict(name='Gym A',duration=45,level='custom',exercises=[dict(id='exercise-unique-id',name='Squat',sets=3,reps=8,reps_max=12,unit='reps',weight=None)]),'name exercises','Save/edit own routine. Unit reps or seconds; weights kg. Existing id edits.')
add('gym','delete_workout',{},'','Delete saved programme; history kept.','destructive')
add('gym','workout_source',dict(source='own'),'source','Choose own or suggested workouts.')
add('gym','start',dict(name='',date='YYYY-MM-DD',duration=45,level='custom',exercises=[]),'name date exercises','Start workout snapshot; only when requested, never claim it is completed.')
add('gym','set',dict(session_id='',exercise_id='',position=1,weight=0,reps=8,rpe='',notes=''),'session_id exercise_id position weight reps','Log a performed set, or seconds for a timed exercise. Never fabricate activity.')
for action in ('finish','cancel'):add('gym',action,dict(session_id=''),'session_id')
add('gym','session_date',dict(session_id='',date='YYYY-MM-DD'),'session_id date')
add('gym','cursor',dict(session_id='',cursor=0),'session_id cursor')
add('gym','journey',dict(weeks=8,sessions_per_week=2,goal='consistency',target_weight=72),'weeks sessions_per_week goal','Start a training block; personal gain target only if explicitly requested.')
add('gym','end_journey',{},'','End block without deleting logs.')
add('gym','calendar_workout',dict(workout_id='',date='YYYY-MM-DD',start_time='17:00',end_time='18:00',recurrence='none',repeat_until='',location='Gym'),'workout_id date start_time end_time')
add('gym','delete_calendar_workout',{},'','Remove linked calendar series by id.','destructive')
add('gym','schedule',dict(date='YYYY-MM-DD',label='Rest'),'date label','Gym-only day note; use calendar_workout for real timetable events.')
add('gym','nutrition',dict(age=21,height=175,weight=70,sex='male',activity='moderate',goal='maintain',adult_confirmation=False),'age height weight sex activity goal adult_confirmation','Adult estimate. User must explicitly confirm suitability in review; not medical advice.')
add('todos','save',dict(title='',status='no_progress',due_date='',due_time='',notes=''),'title','Create/edit general to-do. Status no_progress, in_progress, done. Done records expire after 24h without edits.')
add('todos','delete',{},'','Delete general to-do by id.','destructive')
add('todos','settings',dict(enabled=True),'enabled')
add('calendar','save',dict(title='',subject_id='',event_date='YYYY-MM-DD',start_time='09:00',end_time='10:00',location='',event_type='Other',color='#6d4df4',recurrence='none',repeat_until=''),'title event_date start_time end_time','Create or edit calendar event; existing id edits whole weekly series.')
add('calendar','delete',{},'','Delete calendar event/series by id.','destructive')
add('reminders','save',dict(title='',description='',due_at='YYYY-MM-DDTHH:MM',priority='medium',status='no_progress',subject_id=''),'title','Create/edit one reminder. due_at may be blank/all-day. Done expires after 24h without edits.')
add('reminders','delete',{},'','Delete selected reminder occurrence only.','destructive')
add('notes','save',dict(title='',content='',subject_id='',topic_name='',week=1,is_pinned=False,tags=[],base_updated_at=''),'title subject_id','Create/edit/pin/tag a note. New notes need topic or week. Preserve original content when editing.')
add('notes','delete',{},'','Delete selected note.','destructive')
add('subjects','save',dict(name='',color='#7445f5',category='general'),'name')
add('subjects','delete',{},'','Delete subject; notes become unassigned, topic content retained.','destructive')
add('topics','create',dict(name='',subject_id='',color='#7445f5'),'name subject_id')
add('topics','delete',dict(topic_name=''),'topic_name','Delete entire topic including quizzes, cards and Quick Review decks.','destructive')
add('questions','save',dict(topic_name='',question='',choices={'A':'','B':''},answer='A',explain=''),'topic_name question choices answer','Add/edit question; id is database question id. Multiple answers comma-separated.')
add('questions','delete',{},'','Delete one question by database id.','destructive')
add('questions','reorder',dict(topic_name='',ids=[]),'topic_name ids','List every question database id in desired order.')
add('quizzes','settings',dict(topic_name='',mode='normal',target=3),'topic_name mode','Normal/mastery quiz with correct-answer target 1–100.')
add('quizzes','delete',dict(topic_name=''),'topic_name','Remove all quiz questions in topic, preserve flashcards and notes.','destructive')
add('flashcards','save',dict(topic_name='',front='',back='',explain=''),'topic_name front back','Add/edit normal flip card; id is database card id.')
add('flashcards','delete',{},'','Delete one flashcard by database id.','destructive')
add('flashcards','reorder',dict(topic_name='',ids=[]),'topic_name ids')
add('flashcards','delete_topic',dict(topic_name=''),'topic_name','Remove flip cards and their progress; preserve quiz and notes.','destructive')
add('quick','import',dict(topic_name='',text='Title: Heading\nPoints:\n- First fact\n- Second fact',title='',points_per_page=5),'topic_name text','Import Quick Review Cards. Text must use Title: heading, then Points: and bullet lines. Separate sections by a blank line. Not normal flip cards.')
add('quick','save',dict(title='',points_per_page=5,pages=[],updated_at=''),'title pages updated_at')
for action in ('delete','restart'):add('quick',action,{},'','Quick Review '+action+' by deck id.','destructive' if action=='delete' else 'private')
add('quick','memorise',dict(page='',memorised=True),'page memorised','Only mark memorised when explicitly reported by user.')
add('settings','preferences',dict(display_name='',theme='dark',accent='violet',density='comfortable',avatar='graduate',university='',course='',bio='',email=''),'','Own profile and appearance preferences; security settings stay manual.')

# Shared actions go through the SAME permission-checking store used by their screens.
social={
 'profile':dict(enabled=True,discoverable=False,university='',degree='',year='',bio='',interests='',subjects=[],dm='friends'),
 'friend':dict(user_id='',operation='request'),'block':dict(user_id='',remove=False),
 'space':dict(kind='project',name='',description='',subject='',private=True,due='',status='planning',type='general',review=True),
 'membership':dict(operation='join',user_id='',role='Member'),'dm':dict(user_id=''),
 'message':dict(body=''),'message_delete':{},'read':{},'post':dict(body='',space_id='',subject='',audience='friends'),
 'like':{},'comment':dict(body=''),'post_delete':{},
 'event':dict(space_id='',title='',start='',end='',location='',description='',kind='event'),'event_delete':{},'attend':{},
 'task':dict(space_id='',title='',description='',status='todo',priority='medium',due='',assigned=[],checklist=[],updated_at='')}
for action, fields in social.items():add('social',action,fields,'','Socialise '+action+'. Use visible IDs only; shared changes notify other people. Explicit review required.','shared')
market={
 'profile':dict(bio='',show_university=False),'listing_status':dict(status='unlisted'),
 'acquire':{},'cart':dict(remove=False),'saved':dict(kind='note',remove=False),
 'book':dict(start='',duration=60,subject='',method='Online',note=''),
 'booking_status':dict(status='cancelled'),'review':dict(kind='note',rating=5,body=''),
 'conversation':dict(kind='note'),'booking_conversation':{},'message':dict(body=''),'read':{},'report':dict(kind='note',reason='')}
for action, fields in market.items():add('market',action,fields,'','Marketplace '+action+'. Existing permissions apply; no payment is collected.','shared')

VIEWS=['dashboard','home','library','flashcards','notes','timetable','reminders','settings','gym-overview','gym-workouts','gym-nutrition','gym-progress','finance-overview','finance-goals','finance-budget','finance-currency','finance-insights','finance-transactions','social-home','social-messages','social-people','social-clubs','social-groups','social-projects','social-events','marketplace-notes','marketplace-tutors']
add('navigate','open',dict(view='dashboard'),'view','Open an app screen without editing data.')
MANUAL = 'Passwords, account administration, database reset/restore, real payments/checkout, uploads, publishing resources/accepting tutor terms and assessed quiz answers stay in their dedicated screens. The assistant can open Settings, Marketplace or study tools, but cannot perform these steps or certify exercise technique.'

def catalogue():
    return {'operations':OPERATIONS,'views':VIEWS,'manual':MANUAL}

def action_schema(operations):
    def field(value,key=''):
        if isinstance(value,bool):return {'type':'boolean'}
        if isinstance(value,(int,float)):return {'type':['number','null']}
        if isinstance(value,list):return {'type':'array','items':field(value[0]) if value else {}}
        if isinstance(value,dict):return {'type':'object','properties':{k:field(v,k) for k,v in value.items()},'additionalProperties':True}
        if value is None:return {'type':['number','string','null']}
        return {'type':['string','number']} if key in ('amount','target','starting','weekly','monthly','opening_amount') else {'type':'string'}
    return [{'type':'object','properties':{'type':{'const':'app_action'},'operation':{'const':name},'id':{'type':'string'},'data':{'type':'object','properties':{k:field(v,k) for k,v in meta['fields'].items()},'additionalProperties':False}},'required':['type','operation','data'],'additionalProperties':False} for name,meta in operations.items()]
