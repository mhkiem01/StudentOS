"""Host-only demo content for Marketplace and Socialise.

    python tools/demo_data.py add      # (re)create demo people, listings, tutors, clubs, projects...
    python tools/demo_data.py remove   # delete every demo row and anything that points at it

Demo people are accounts with a `demo.` username and {"demo": true} in their profile.
They cannot sign in (their stored password never verifies). Each real account gets
friends, requests, a club and project memberships, bookings and notifications.
`remove` also deletes what real accounts did with demo content (acquired demo notes,
comments on demo posts, bookings with demo tutors); everything else is untouched.
A verified backup of data/accounts.db is written to data/backups before any change.
"""
import argparse,json,sqlite3,sys,time,uuid
from contextlib import closing
from datetime import datetime,timedelta,timezone
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import backend  # adds backend/<feature> folders to the import path
import accounts,marketplace_store,social_store

NS=uuid.UUID('6f1d3c2e-9a4b-4c1e-8e7d-2b5a9c0d4e11')
LOCAL=ZoneInfo('Australia/Sydney')
NO_LOGIN='!demo-account:sign-in-disabled'
def key(*parts):return uuid.uuid5(NS,':'.join(parts)).hex
def enc(v):return json.dumps(v,ensure_ascii=False)

# username, display name, avatar, university, degree, year, subjects, bio, interests
PEOPLE=[
 ('aisha','Aisha Rahman','owl','UNSW Sydney','Computer Science','2nd year',['Data Structures','Algorithms','Python'],'CS student who loves clean code and explaining tricky concepts.','Hackathons, chess, bubble tea'),
 ('liam','Liam Chen','fox','University of Sydney','Commerce','3rd year',['Microeconomics','Accounting','Statistics'],'Commerce student majoring in finance. Always up for a study session.','Investing, basketball, board games'),
 ('sofia','Sofia Martinez','cat','UNSW Sydney','Biomedical Science','2nd year',['Biology','Chemistry','Anatomy'],'Future researcher. I make colourful summary notes for everything.','Photography, hiking, baking'),
 ('noah','Noah Williams','robot','UTS','Mechanical Engineering','3rd year',['Calculus','Physics','Linear Algebra'],'Engineering student and maths tutor. Integration is my favourite puzzle.','Robotics, bushwalking, guitar'),
 ('priya','Priya Patel','panda','Macquarie University','Psychology','1st year',['Psychology','Statistics'],'First-year psych student figuring out uni life one lecture at a time.','Reading, yoga, podcasts'),
 ('ethan','Ethan Nguyen','astronaut','UNSW Sydney','Data Science','Honours',['Statistics','Machine Learning','Python'],'Honours student working on forecasting models. Happy to help with stats.','Running, coffee, sci-fi'),
 ('mia','Mia Thompson','leaf','University of Sydney','Law','2nd year',['Contract Law','Legal Writing'],'Law student and debate society president.','Debating, theatre, travel'),
 ('zara','Zara Ahmed','graduate','Western Sydney University','Nursing','3rd year',['Pharmacology','Anatomy'],'Nursing student on placement. Big believer in flashcards.','Wellbeing, cooking, netball'),
]
def uid(name):return key('user',name)

# seller, slug, title, subject, topic, type, price, pages, tags, description, preview, body
LISTINGS=[
 ('aisha','ds-notes','Data Structures — Complete Lecture Notes (Weeks 1–12)','Data Structures','Lists, trees, heaps and hashing','Lecture Notes','12.00',48,['linked lists','trees','big-o','hashing'],'Every lecture rewritten into clear notes with diagrams described in words, worked examples and a revision checklist per week.','Week 1 introduces abstract data types and why we measure cost with Big-O. A dynamic array doubles its capacity when full, so appending is O(1) amortised…',
  [('Week 1 — Abstract data types','An ADT describes *what* operations do, not *how*. A list supports insert, remove, get and size.'),('Week 4 — Linked lists','Singly linked lists give O(1) insertion at the head but O(n) indexing. Keep a tail pointer for O(1) append.'),('Week 7 — Binary search trees','In-order traversal of a BST visits keys in sorted order. Height decides cost: balanced trees keep it O(log n).'),('Week 9 — AVL rotations','Four cases: LL, RR, LR and RL. Rebalance from the inserted node upwards, updating heights as you go.'),('Week 11 — Hash tables','Load factor α = n/m. Keep α below about 0.75 and resize to keep expected O(1) operations.')]),
 ('aisha','bigo','Big-O Cheat Sheet','Algorithms','Complexity analysis','Cheat Sheet','0',2,['big-o','sorting','revision'],'A two-page summary of time and space complexity for common data structures and sorting algorithms.','O(1) < O(log n) < O(n) < O(n log n) < O(n²). Merge sort is always O(n log n); quicksort averages O(n log n) but can degrade to O(n²)…',
  [('Growth rates','O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ).'),('Sorting','Merge sort: O(n log n), stable. Quicksort: O(n log n) average, O(n²) worst. Insertion sort: great for nearly sorted data.'),('Structures','Array index O(1); linked-list search O(n); balanced BST search O(log n); hash table lookup O(1) expected.')]),
 ('liam','micro','Microeconomics Exam Notes — Supply, Demand & Elasticity','Microeconomics','Markets and elasticity','Exam Notes','8.50',22,['elasticity','market equilibrium','exam'],'Condensed exam notes with every graph explained step by step, plus 15 short-answer practice questions.','Price elasticity of demand = %ΔQd / %ΔP. When |PED| > 1 demand is elastic, so lowering price raises total revenue…',
  [('Equilibrium','Equilibrium is where Qd = Qs. A shortage pushes price up; a surplus pushes it down.'),('Elasticity','PED = %ΔQd / %ΔP. Elastic if |PED| > 1, inelastic if < 1. Necessities tend to be inelastic.'),('Government intervention','A binding price ceiling sits below equilibrium and causes shortages; a price floor above it causes surpluses.')]),
 ('liam','acct','Intro Accounting Practice Questions with Worked Solutions','Accounting','Journal entries and balance sheets','Practice Questions','6.00',30,['journal entries','balance sheet','practice'],'40 practice questions from simple journal entries to a full balance sheet, each with a fully worked solution.','Q1. A business buys $2,000 of inventory on credit. Which accounts change? Solution: Inventory (asset) increases; Accounts payable (liability) increases…',
  [('The accounting equation','Assets = Liabilities + Equity. Every transaction keeps both sides balanced.'),('Q1','Buying $2,000 of inventory on credit: Dr Inventory 2,000, Cr Accounts payable 2,000.'),('Q2','Paying wages of $800 in cash: Dr Wages expense 800, Cr Cash 800.')]),
 ('sofia','cellbio','Cell Biology Summary Notes','Biology','Cell structure and transport','Summary Notes','0',14,['cells','membranes','mitosis'],'Colour-coded summaries of cell organelles, membrane transport and the cell cycle.','The plasma membrane is a phospholipid bilayer with embedded proteins. Small non-polar molecules diffuse freely; ions need channels or pumps…',
  [('Organelles','Mitochondria make ATP; ribosomes make proteins; the Golgi apparatus packages and ships them.'),('Membrane transport','Diffusion and osmosis are passive. The sodium–potassium pump uses ATP to move 3 Na⁺ out and 2 K⁺ in.'),('Cell cycle','Interphase (G1, S, G2) then mitosis: prophase, metaphase, anaphase, telophase, followed by cytokinesis.')]),
 ('sofia','orgo','Organic Chemistry Reaction Mechanisms Guide','Chemistry','SN1, SN2, E1 and E2','Study Guide','10.00',26,['mechanisms','nucleophiles','exam prep'],'How to choose between SN1, SN2, E1 and E2 every time, with curly-arrow walkthroughs and a decision flowchart.','Strong nucleophile + primary substrate → SN2 with inversion of configuration. Tertiary substrate + weak nucleophile in a polar protic solvent → SN1…',
  [('SN2','One step, backside attack, inversion. Favoured by primary substrates and polar aprotic solvents.'),('SN1','Two steps through a carbocation. Favoured by tertiary substrates and polar protic solvents.'),('Elimination','Strong, bulky bases favour E2. Heat favours elimination over substitution.')]),
 ('noah','calc2','Calculus II — Integration Techniques Tutorial Solutions','Calculus','Integration by parts and substitution','Tutorial Notes','5.00',18,['integration','substitution','by parts'],'Full solutions to the weekly integration tutorials, with the reasoning for choosing each technique.','Choose u with LIATE: Logarithmic, Inverse trig, Algebraic, Trig, Exponential. For ∫x·eˣ dx let u = x and dv = eˣ dx…',
  [('Substitution','Look for a function and its derivative. ∫2x·cos(x²) dx: let u = x², so the integral becomes ∫cos u du = sin(x²) + C.'),('By parts','∫u dv = uv − ∫v du. ∫x·eˣ dx = x·eˣ − eˣ + C.'),('Partial fractions','Factor the denominator first, then split into simpler fractions you can integrate as logarithms.')]),
 ('noah','physlab','Physics Lab Report Template & Notes','Physics','Uncertainty and lab reports','Lab Notes','0',6,['lab report','uncertainty','template'],'The structure markers look for, plus a one-page guide to propagating uncertainties.','Every measurement needs an uncertainty. For a sum, add absolute uncertainties; for a product, add percentage uncertainties…',
  [('Report structure','Aim, hypothesis, method, results (with uncertainties), analysis, discussion, conclusion.'),('Uncertainty','Sums and differences: add absolute uncertainties. Products and quotients: add percentage uncertainties.'),('Graphs','Label axes with units, add error bars, and draw lines of best and worst fit to estimate gradient uncertainty.')]),
 ('ethan','stats','Statistics for Beginners — Hypothesis Testing Study Guide','Statistics','Hypothesis testing and p-values','Study Guide','7.50',20,['p-values','t-test','confidence intervals'],'Plain-English explanations of hypothesis tests, p-values and confidence intervals, with a test-choosing flowchart.','A p-value is the probability of seeing data at least this extreme if the null hypothesis were true. It is not the probability that the null is true…',
  [('The logic of a test','State H₀ and H₁, choose α, compute a test statistic, find the p-value, then decide.'),('Which test?','Comparing two group means: t-test. Comparing proportions: z-test or chi-square. Relationships: correlation or regression.'),('Confidence intervals','A 95% CI comes from a method that captures the true value in 95% of repeated samples.')]),
 ('ethan','pandas','Python for Data Analysis — pandas Quick Reference','Python','pandas basics','Cheat Sheet','0',4,['pandas','python','data cleaning'],'The pandas commands you actually use: loading, filtering, grouping, joining and plotting.','df = pd.read_csv("data.csv"); df.head(); df.describe(); df[df["score"] > 50]; df.groupby("class")["score"].mean()…',
  [('Load and inspect','pd.read_csv(), df.head(), df.info(), df.describe().'),('Filter and sort','df[df["score"] > 50], df.sort_values("score", ascending=False).'),('Group and join','df.groupby("class")["score"].mean(); pd.merge(a, b, on="id", how="left").')]),
 ('mia','contract','Contract Law Case Summaries','Contract Law','Formation, terms and remedies','Summary Notes','9.00',35,['cases','formation','remedies'],'Short summaries of 30 leading contract cases: facts, issue, decision and why it matters.','Offer and acceptance: an advertisement is usually an invitation to treat, not an offer. Acceptance must be communicated unless the offeror waives this…',
  [('Formation','An agreement needs offer, acceptance, consideration and an intention to create legal relations.'),('Terms','Terms can be express or implied; implied terms must be necessary for business efficacy.'),('Remedies','Damages aim to put the innocent party where they would have been had the contract been performed.')]),
 ('zara','pharm','Pharmacology Drug Classes Flashcard Notes','Pharmacology','Common drug classes','Exam Notes','4.00',16,['drug classes','flashcards','nursing'],'Flashcard-style notes on the drug classes nurses meet most often: action, uses, side effects and nursing considerations.','Beta blockers (-olol): reduce heart rate and blood pressure. Check apical pulse before giving; hold if below the prescribed limit…',
  [('Beta blockers (-olol)','Lower heart rate and blood pressure. Check pulse and BP before administration.'),('ACE inhibitors (-pril)','Lower blood pressure. Watch for a dry cough and raised potassium.'),('Anticoagulants','Monitor for bleeding; check the relevant clotting tests before each dose.')]),
 ('priya','psych','Intro Psychology — Memory & Learning Lecture Notes','Psychology','Memory and learning','Lecture Notes','0',12,['memory','conditioning','first year'],'Notes from the memory and learning lectures, with examples for every key term.','Memory has three stages: encoding, storage and retrieval. The multi-store model separates sensory, short-term and long-term memory…',
  [('Memory models','The multi-store model: sensory → short-term (about 7±2 items) → long-term memory.'),('Classical conditioning','A neutral stimulus paired with an unconditioned stimulus comes to trigger a conditioned response.'),('Operant conditioning','Reinforcement increases a behaviour; punishment decreases it.')]),
]
def lid(slug):return key('listing',slug)
# Free preview pages chosen by each demo seller (empty: excerpt only). The lecture notes are a real PDF.
PREVIEWS={'ds-notes':'1, 3','bigo':'1','micro':'1-2','acct':'1, 3','cellbio':'1','orgo':'2','calc2':'1-2','physlab':'','stats':'1-3','pandas':'1','contract':'1, 4','pharm':'1-2','psych':'1'}
PDF_LISTINGS={'ds-notes'}

def body_for(title,desc,sections):
    """Several printed pages of study notes built around each listing's own sections."""
    parts=['# '+title,desc,'This resource is organised so you can revise one idea at a time: read the key idea, follow the worked example, check the common mistakes, then test yourself.']
    for heading,text in sections:
        topic=heading.split('—')[-1].strip().lower()
        parts+=['## '+heading,'**Key idea.** '+text,
                f'**Worked example.** Take a typical exam question on {topic}. Write down what you are given, choose the rule from this section that matches it, and show every step. Markers reward the reasoning as much as the final answer, so state the rule before you use it and finish by checking the answer against the question.',
                f'**In more depth.** {text} Connect this to the earlier sections: most exam questions on {topic} combine it with one other idea from this resource, so practise explaining how they fit together, and note any exceptions your lecturer emphasised.',
                f'**Common mistakes.** Students often mix up {topic} with the ideas around it, skip the definitions, or stop before checking units and edge cases. Before moving on, explain {topic} in one sentence without looking at your notes.',
                f'**Check yourself.**\n\n1. Define {topic} in your own words.\n2. Make up a small example and work through it.\n3. Name one situation where it does not apply, and say why.']
    parts+=['## Practice set','Answer these without notes, then compare with the sections above.','\n'.join(f'{2*i-1}. Explain how {h.split("—")[-1].strip().lower()} would appear in an exam question, and outline a full-mark answer.\n{2*i}. Write a short worked example on {h.split("—")[-1].strip().lower()} and mark it against the rules above.' for i,(h,_) in enumerate(sections,1))]
    parts+=['## Exam checklist','- I can state every definition in this resource from memory.\n- I can work each example without looking.\n- I have attempted the practice set under timed conditions.\n- I know which topics I still need to revisit.']
    return '\n\n'.join(parts)+'\n'

def demo_pdf(title,body):
    """A small text-only PDF (Helvetica, A4) made from the notes, so the demo can show real PDF page previews."""
    swaps={'—':'-','–':'-','’':"'",'‘':"'",'“':'"','”':'"','→':'->','²':'^2','ⁿ':'^n','≤':'<=','≥':'>=','×':'x','·':'.','₀':'0','₁':'1','α':'alpha','∫':'integral ','√':'sqrt','Δ':'delta '}
    clean=lambda t:''.join(swaps.get(ch,ch) for ch in t).encode('ascii','replace').decode('ascii')
    lines=[]
    for raw in body.split('\n'):
        raw=clean(raw.replace('**','').replace('*',''));heading=raw.startswith('#')
        raw=raw.lstrip('# ').rstrip()
        if heading:lines.append(('',11));lines.append((raw,14 if raw==clean(title) else 13))
        elif not raw:lines.append(('',11))
        else:
            while raw:
                cut=raw[:88]
                if len(raw)>88 and ' ' in cut:cut=cut[:cut.rindex(' ')]
                lines.append((cut,11));raw=raw[len(cut):].lstrip()
    pages=[lines[i:i+44] for i in range(0,len(lines),44)]
    esc=lambda t:t.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
    objects=['<< /Type /Catalog /Pages 2 0 R >>',None,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    kids=[]
    for number,page in enumerate(pages,1):
        y=790;ops=[]
        for text,size in page:
            if text:ops.append(f'BT /F1 {size} Tf 56 {y} Td ({esc(text)}) Tj ET')
            y-=size+5
        ops.append(f'BT /F1 9 Tf 270 30 Td (Page {number} of {len(pages)}) Tj ET')
        stream='\n'.join(ops).encode('latin-1')
        objects.append(b'<< /Length %d >>\nstream\n'%len(stream)+stream+b'\nendstream')
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {len(objects)} 0 R >>')
        kids.append(len(objects))
    objects[1]=f'<< /Type /Pages /Kids [{" ".join(f"{k} 0 R" for k in kids)}] /Count {len(kids)} >>'
    out=bytearray(b'%PDF-1.4\n');offsets=[]
    for i,obj in enumerate(objects,1):
        offsets.append(len(out));out+=f'{i} 0 obj\n'.encode()+(obj if isinstance(obj,bytes) else obj.encode())+b'\nendobj\n'
    xref=len(out);out+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()+''.join(f'{o:010d} 00000 n \n' for o in offsets).encode()
    out+=f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return bytes(out)

def listing_content(slug,title,desc,sections):
    """(format, file bytes, page count, preview pages) for a demo listing, using the seller's chosen preview pages."""
    body=body_for(title,desc,sections);fmt,content='markdown',body.encode('utf-8')
    if slug in PDF_LISTINGS:
        try:
            pdf=demo_pdf(title,body);total,previews=marketplace_store.build_previews('pdf',pdf,PREVIEWS.get(slug,''))
            return 'pdf',pdf,total,previews
        except ValueError:pass  # PDF renderer unavailable: fall back to a Markdown listing
    try:total,previews=marketplace_store.build_previews(fmt,content,PREVIEWS.get(slug,''))
    except ValueError:total,previews=marketplace_store.build_previews(fmt,content,None)
    return fmt,content,total,previews
# buyer, listing slug, days ago, rating, review
NOTE_REVIEWS=[('liam','ds-notes',20,5,'Saved me before the mid-semester exam. The AVL section is gold.'),('noah','ds-notes',14,4,'Really thorough. A few more diagrams would make it perfect.'),('priya','bigo',9,5,'Perfect quick revision sheet.'),('ethan','micro',25,4,'Clear explanations of every graph.'),('sofia','acct',11,5,'The worked solutions are so easy to follow.'),('zara','cellbio',6,5,'Lovely colour coding, helped me revise for my anatomy quiz too.'),('aisha','orgo',17,4,'Finally understand when to pick SN1 vs SN2.'),('mia','orgo',8,3,'Good content but quite dense.'),('aisha','calc2',13,5,'Every solution explains why the technique was chosen. Brilliant.'),('priya','stats',4,5,'Best explanation of p-values I have read.'),('liam','stats',16,4,'Very practical, the flowchart is great.'),('zara','pandas',3,5,'Pinned this next to my laptop.'),('priya','contract',10,4,'Helpful summaries for a non-law elective.'),('sofia','pharm',5,5,'Exactly what I needed for placement.')]

# user, tagline, bio, experience, languages, subjects, methods, price, availability (day, start, end), approval, year
TUTORS=[
 ('aisha','Data structures without the panic','I tutor first and second-year CS students. We work through your own lab and assignment questions together.','Peer tutor for COMP2521 for two terms. 40+ sessions.',['English','Bengali'],['Data Structures','Algorithms','Python'],['Online','1-to-1'],'35',[(0,'18:00','21:00'),(2,'18:00','21:00'),(5,'10:00','14:00')],True,'1st–2nd year'),
 ('noah','Maths and physics, one step at a time','Engineering student who loves helping with calculus and first-year physics. Group sessions available for study groups.','Maths help-centre volunteer for 2 years.',['English'],['Calculus','Physics','Linear Algebra'],['Online','In-person','Group'],'40',[(1,'17:00','20:00'),(3,'17:00','20:00'),(6,'13:00','17:00')],False,'1st–2nd year'),
 ('ethan','Stats and machine learning, explained plainly','Honours student in data science. I help with statistics units, R and Python assignments, and exam preparation.','Casual teaching assistant for intro statistics.',['English','Vietnamese'],['Statistics','Machine Learning','Python'],['Online','1-to-1','Group'],'45',[(d,'19:00','21:00') for d in range(5)],True,'All years'),
 ('sofia','Biology and chemistry made visual','I use diagrams and memory tricks to make biology and chemistry stick. In-person sessions on campus.','Mentor in the first-year science mentoring program.',['English','Spanish'],['Biology','Chemistry'],['In-person','1-to-1'],'30',[(2,'15:00','18:00'),(4,'10:00','13:00')],True,'1st year'),
 ('mia','Free legal writing help','Peer mentoring for essays and problem questions in first-year law subjects. Free for students.','Law society academic mentor.',['English'],['Legal Writing','Contract Law'],['Online'],'0',[(1,'12:00','14:00'),(3,'12:00','14:00')],True,'1st year'),
]
# student, tutor, subject, days ago, local hour, minutes, rating, review
TUTOR_REVIEWS=[('priya','aisha','Python',18,18,60,5,'Aisha explained recursion in a way that finally clicked.'),('liam','aisha','Algorithms',9,10,60,5,'Patient and well prepared.'),('mia','noah','Calculus',12,17,60,4,'Great session on integration by parts.'),('priya','ethan','Statistics',15,19,60,5,'Made hypothesis testing feel easy.'),('sofia','ethan','Python',6,19,90,4,'Helped me debug my assignment and explained why.'),('zara','sofia','Biology',20,15,60,5,'Loved the diagrams!')]

# slug, kind, owner, name, data, members [(user, role, state)]
SPACES=[
 ('coding','club','aisha','Coding Club',{'description':'Weekly coding challenges, hackathons and project nights for every skill level.','category':'Technology','icon':'💻','rules':'Be kind, share what you learn, and no question is too basic.','university':'UNSW Sydney'},[('ethan','Member','active'),('noah','Member','active'),('liam','Member','active'),('ME','Member','active')]),
 ('hiking','club','noah','Uni Hiking & Outdoors',{'description':'Day hikes, camping trips and beach walks around Sydney. Beginners welcome!','category':'Sport & Outdoors','icon':'🥾','rules':'Check the trip difficulty and bring enough water.'},[('sofia','Member','active'),('zara','Member','active'),('mia','Member','active')]),
 ('boardgames','club','liam','Board Games Night',{'description':'Relaxed board and card games every second Friday. Snacks provided.','category':'Social','icon':'🎲','rules':'Teach new players, and tidy up the pieces afterwards.'},[('priya','Member','active'),('aisha','Member','active'),('ethan','Member','active')]),
 ('debate','club','mia','Debate Society',{'description':'Competitive and social debating. Practice rounds every Wednesday evening.','category':'Academic','icon':'🎤','rules':'Respect every speaker. Attack arguments, never people.','private':True},[('zara','Member','active'),('priya','Member','requested')]),
 ('photo','club','sofia','Photography Collective',{'description':'Photo walks, editing workshops and a monthly theme challenge.','category':'Arts','icon':'📷','rules':'Only share photos you took yourself.','private':True},[('zara','Member','active'),('ME','Member','invited')]),
 ('calc','study','noah','Calculus II Study Group',{'description':'We work through tutorial sheets together before each tutorial.','subject':'Calculus','topic':'Integration techniques'},[('aisha','Member','active'),('priya','Member','active'),('ME','Member','active')]),
 ('statsprep','study','ethan','Stats Exam Prep',{'description':'Past papers and practice questions for the final statistics exam.','subject':'Statistics','topic':'Hypothesis testing'},[('priya','Member','active'),('liam','Member','active'),('zara','Member','active')]),
 ('orgochem','study','sofia','Organic Chem Crew',{'description':'Mechanism practice and flashcard swaps.','subject':'Chemistry','topic':'Reaction mechanisms','private':True},[('zara','Member','active')]),
 ('seproject','project','aisha','Software Engineering Group Assignment',{'description':'Build a study-planner web app for the SE unit: requirements, design, implementation and a final demo.','type':'assignment','status':'in_progress','review':True,'subject':'Software Engineering','due':12},[('ME','Developer','active'),('noah','Designer','active'),('ethan','Tester','active')]),
 ('marketing','project','liam','Marketing Case Study',{'description':'Group case study on a local café brand: market research, strategy and a 10-minute presentation.','type':'group','status':'planning','review':True,'subject':'Marketing','due':20},[('ME','Researcher','active'),('priya','Designer','active')]),
]
def sid(slug):return key('space',slug)
# space, title, description, status, priority, due in days, assigned, checklist
TASKS=[
 ('seproject','Write requirements document','User stories and acceptance criteria for every feature.','done','high',-6,['aisha','ME'],[('Interview two classmates',True),('Write user stories',True),('Get tutor feedback',True)]),
 ('seproject','Design database schema','Tables for users, subjects, tasks and reminders.','review','high',1,['ME'],[('Draft ER diagram',True),('Normalise to 3NF',True),('Review with team',False)]),
 ('seproject','Build login and sign-up pages','Forms, validation and error messages.','in_progress','medium',4,['ME','noah'],[('Login form',True),('Sign-up form',False),('Password rules',False)]),
 ('seproject','Create UI mock-ups','Low-fidelity wireframes for the main screens.','done','medium',-3,['noah'],[('Dashboard',True),('Planner',True),('Settings',True)]),
 ('seproject','Write test plan','Unit and acceptance tests for the core features.','todo','medium',8,['ethan'],[('List test cases',False),('Set up test runner',False)]),
 ('seproject','Prepare final demo slides','Ten slides and a live demo script.','todo','low',11,['aisha','ME'],[]),
 ('marketing','Competitor research','Compare three nearby cafés: pricing, branding and social media.','in_progress','high',5,['ME'],[('Visit cafés',True),('Summarise findings',False)]),
 ('marketing','Customer survey','Short online survey for students about café habits.','todo','medium',8,['priya','ME'],[('Draft questions',False),('Share survey link',False)]),
 ('marketing','Presentation outline','Story and slide order for the final presentation.','todo','low',15,['liam'],[]),
]
# space (or None for public), author, title, days ahead, local time, hours long, location, description, kind, attendees
EVENTS=[
 ('coding','aisha','Hackathon Kickoff',5,'18:00',3,'Engineering Building, Room 2.14','Form teams, pick a theme and get coding. Pizza provided!','event',['ethan','noah']),
 ('hiking','noah','Blue Mountains Day Hike',9,'07:30',8,'Meet at Central Station, platform 4','Moderate 12 km walk. Bring lunch, water and good shoes.','event',['sofia','zara','mia']),
 ('boardgames','liam','Board Games Night',2,'18:30',3,'Student Hub, Level 1','Catan, Codenames and plenty of snacks.','event',['priya','aisha']),
 ('calc','noah','Exam revision session',4,'14:00',2,'Library, Group Room 5','Past exam questions on integration and series.','meeting',['aisha','priya']),
 ('seproject','aisha','Sprint planning',1,'16:00',1,'Online (Teams)','Plan the next sprint and split the remaining tasks.','meeting',['noah','ethan']),
 ('seproject','aisha','Prototype demo to tutor',7,'11:00',1,'Tutorial room','Show the working login and planner screens.','milestone',[]),
 ('seproject','aisha','Final submission',12,'23:59',0,'Online submission','Code, report and demo video due.','milestone',[]),
 (None,'zara','Campus Wellness Fair',6,'10:00',5,'Main Quad','Free health checks, stress-relief activities and food stalls.','event',['priya','sofia']),
]
# space, [(author, minutes ago, body)]
CHATS=[
 ('coding',[('aisha',2900,'Welcome everyone! This week’s challenge is on the board: reverse a linked list in place.'),('ethan',2800,'Done in Python 🐍 Iterative is much easier than recursive for this one.'),('noah',1500,'Is anyone forming a team for the hackathon yet?'),('liam',1450,'I’m keen! I can do the pitch and slides.'),('aisha',60,'Reminder: kickoff is on Friday at 6pm, room 2.14.')]),
 ('calc',[('noah',3000,'Tutorial 6 is all integration by parts. Let’s meet before Thursday’s tutorial.'),('priya',2950,'Can we go over question 4? I keep getting the sign wrong.'),('aisha',2900,'Try LIATE to choose u. It saved me on that one.')]),
 ('boardgames',[('liam',600,'Bringing Codenames and Catan this week!'),('priya',540,'Yay! I’ll bring snacks 🍪')]),
 ('seproject',[('aisha',4000,'Requirements doc is done, thanks everyone!'),('noah',2000,'Mock-ups are uploaded. Feedback welcome.'),('ethan',300,'I’ll start the test plan once the schema is reviewed.'),('aisha',90,'Sprint planning tomorrow at 4pm on Teams.')]),
 ('marketing',[('liam',1400,'I’ve created tasks for the first two weeks. Grab whatever suits you.'),('priya',1300,'I’ll design the survey with you!')]),
]
# author, audience, subject, hours ago, body, likers, comments [(author, body)], space
POSTS=[
 ('ethan','public','Data Science',5,'Just submitted my honours thesis draft 🎉 Two years of forecasting models in 80 pages. Time for a very long sleep.',['aisha','liam','sofia'],[('aisha','Congrats Ethan!! 🎉'),('noah','Huge effort, well done.')],None),
 ('sofia','public','Biology',20,'Anyone want to swap biology summary notes for organic chemistry ones? My cell bio notes are free on the Marketplace too.',['zara','priya'],[('zara','Yes please! I have pharmacology flashcards to share.')],None),
 ('priya','public','Psychology',30,'Any tips for first-year psych stats? The t-test week is melting my brain 😅',['ethan'],[('ethan','Start with what question each test answers. The Stats Exam Prep group is great for this!'),('liam','Past papers helped me most.')],None),
 ('aisha','friends','Computer Science',8,'Coding Club hackathon kickoff is this Friday! Teams of 2–4, all skill levels welcome.',['noah','ethan'],[],None),
 ('noah','friends','Calculus',50,'Study tip: when an integral looks impossible, check if it’s the derivative of something inside it first. Substitution solves half of them.',['aisha','priya','ME'],[],None),
 ('mia','public','Law',70,'Moot court practice went better than expected. Debate Society practice rounds really help with confidence!',['zara'],[('zara','So proud of you!')],None),
 ('zara','public','Health',12,'The Campus Wellness Fair is next week — free health checks and lots of food stalls. Look after yourselves during exam season 💙',['priya','sofia','mia'],[],None),
 ('aisha','public','',72,'Welcome to Coding Club! Introduce yourself below and tell us what you’re learning.',['ethan','noah','liam'],[('liam','Hi all! Learning React this semester.'),('noah','Hey! Robotics and C++ for me.')],'coding'),
]
# (person, other person) accepted friendships between demo people
DEMO_FRIENDS=[('aisha','ethan'),('aisha','noah'),('aisha','liam'),('noah','sofia'),('ethan','priya'),('liam','priya'),('sofia','zara'),('mia','zara'),('ethan','liam')]

def backup(path):
    folder=Path(path).parent/'backups';folder.mkdir(exist_ok=True)
    dest=folder/('before-demo-data-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db')
    with closing(sqlite3.connect(path)) as src,closing(sqlite3.connect(dest)) as out:
        src.backup(out)
        if out.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise SystemExit('Backup verification failed. Nothing changed.')
    return dest

def demo_ids(c):
    return [r['id'] for r in c.execute("SELECT id,profile FROM users WHERE username LIKE 'demo.%'") if json.loads(r['profile'] or '{}').get('demo') is True]

def remove(path):
    """Delete demo people and every row that references them or their content."""
    marketplace_store.migrate(path);social_store.migrate(path)
    with accounts.db(path) as c:
        c.execute('BEGIN IMMEDIATE');people=demo_ids(c)
        if not people:return 0
        q=lambda sql,args=():[r[0] for r in c.execute(sql,args)]
        def marks(n):return ','.join('?'*n) or "''"
        D=people;d=marks(len(D))
        spaces=q(f"SELECT id FROM social_spaces WHERE owner IN ({d}) OR (kind='dm' AND id IN (SELECT space_id FROM social_members WHERE user_id IN ({d})))",D+D);s=marks(len(spaces))
        posts=q(f'SELECT id FROM social_posts WHERE author IN ({d}) OR space_id IN ({s})',D+spaces);p=marks(len(posts))
        events=q(f'SELECT id FROM social_events WHERE author IN ({d}) OR space_id IN ({s})',D+spaces);e=marks(len(events))
        targets=D+spaces;t=marks(len(targets))
        for sql,args in [(f'DELETE FROM social_notifications WHERE user_id IN ({d}) OR target IN ({t})',D+targets),(f'DELETE FROM social_attendance WHERE user_id IN ({d}) OR event_id IN ({e})',D+events),(f'DELETE FROM social_events WHERE id IN ({e})',events),
                         (f'DELETE FROM social_likes WHERE user_id IN ({d}) OR post_id IN ({p})',D+posts),(f'DELETE FROM social_comments WHERE author IN ({d}) OR post_id IN ({p})',D+posts),(f'DELETE FROM social_posts WHERE id IN ({p})',posts),
                         (f'DELETE FROM social_messages WHERE author IN ({d}) OR space_id IN ({s})',D+spaces),*([(f'DELETE FROM social_note_shares WHERE owner IN ({d}) OR recipient IN ({d})',D+D)] if q("SELECT name FROM sqlite_master WHERE name='social_note_shares'") else []),(f'DELETE FROM social_tasks WHERE space_id IN ({s})',spaces),(f'DELETE FROM social_activity WHERE actor IN ({d}) OR space_id IN ({s})',D+spaces),
                         (f'DELETE FROM social_files WHERE author IN ({d}) OR space_id IN ({s})',D+spaces),(f'DELETE FROM social_members WHERE user_id IN ({d}) OR space_id IN ({s})',D+spaces),(f'DELETE FROM social_spaces WHERE id IN ({s})',spaces),
                         (f'DELETE FROM social_links WHERE sender IN ({d}) OR recipient IN ({d})',D+D),(f'DELETE FROM social_blocks WHERE user_id IN ({d}) OR target IN ({d})',D+D),(f'DELETE FROM social_profiles WHERE user_id IN ({d})',D)]:
            c.execute(sql,args)
        listings=q(f'SELECT id FROM market_listings WHERE seller IN ({d})',D);l=marks(len(listings))
        bookings=q(f'SELECT id FROM market_bookings WHERE tutor IN ({d}) OR student IN ({d})',D+D);b=marks(len(bookings))
        chats=q(f'SELECT id FROM market_conversations WHERE buyer IN ({d}) OR seller IN ({d})',D+D);ch=marks(len(chats))
        notes=q(f'SELECT id FROM market_messages WHERE conversation IN ({ch}) OR author IN ({d})',chats+D)
        orders=q(f'SELECT id FROM market_orders WHERE buyer IN ({d}) OR id IN (SELECT order_id FROM market_order_items WHERE listing IN ({l}) OR seller IN ({d}))',D+listings+D);o=marks(len(orders))
        targets=D+listings+bookings+notes+orders;t=marks(len(targets))
        for sql,args in [(f'DELETE FROM market_notifications WHERE user_id IN ({d}) OR target IN ({t})',D+targets),(f'DELETE FROM market_messages WHERE id IN ({marks(len(notes))})',notes),(f'DELETE FROM market_conversations WHERE id IN ({ch})',chats),
                         (f"DELETE FROM market_reviews WHERE author IN ({d}) OR (kind='note' AND target IN ({l})) OR (kind='tutor' AND target IN ({b}))",D+listings+bookings),
                         (f"DELETE FROM market_saved WHERE user_id IN ({d}) OR (kind='note' AND target IN ({l})) OR (kind='tutor' AND target IN ({d}))",D+listings+D),
                         (f'DELETE FROM market_cart WHERE user_id IN ({d}) OR listing IN ({l})',D+listings),(f'DELETE FROM market_ownership WHERE user_id IN ({d}) OR listing IN ({l})',D+listings),
                         (f'DELETE FROM market_ledger WHERE seller IN ({d}) OR order_id IN ({o})',D+orders),(f'DELETE FROM market_order_items WHERE order_id IN ({o}) AND (listing IN ({l}) OR seller IN ({d}))',orders+listings+D),
                         (f'DELETE FROM market_orders WHERE id IN ({o}) AND NOT EXISTS(SELECT 1 FROM market_order_items i WHERE i.order_id=market_orders.id)',orders),
                         (f'DELETE FROM market_reports WHERE author IN ({d}) OR target IN ({marks(len(D+listings))})',D+D+listings),(f'DELETE FROM market_previews WHERE listing IN ({l})',listings),(f'DELETE FROM market_versions WHERE listing IN ({l})',listings),
                         (f'DELETE FROM market_bookings WHERE id IN ({b})',bookings),(f'DELETE FROM market_tutors WHERE user_id IN ({d})',D),(f'DELETE FROM market_listings WHERE id IN ({l})',listings),(f'DELETE FROM market_profiles WHERE user_id IN ({d})',D),
                         (f'DELETE FROM sessions WHERE user_id IN ({d})',D),(f'DELETE FROM users WHERE id IN ({d})',D)]:
            c.execute(sql,args)
        c.execute('DELETE FROM attempts WHERE key LIKE ?',('user:demo.%',))
        broken=c.execute('PRAGMA foreign_key_check').fetchall()
        if broken:raise RuntimeError('Demo removal would leave broken references; nothing was changed: '+str([tuple(r) for r in broken[:5]]))
        return len(D)

def add(path):
    """Recreate demo content dated around today. Returns the real accounts it was linked to."""
    remove(path)
    now=datetime.now(timezone.utc);today=now.astimezone(LOCAL).date()
    ago=lambda days=0,hours=0,minutes=0:(now-timedelta(days=days,hours=hours,minutes=minutes)).isoformat()
    local=lambda days,at:(today+timedelta(days=days)).isoformat()+'T'+at
    with accounts.db(path) as c:
        c.execute('BEGIN IMMEDIATE')
        real=[r['id'] for r in c.execute("SELECT id FROM users WHERE disabled=0 AND username NOT LIKE 'demo.%'")]
        if not real:raise SystemExit('Create an account first, then add demo data.')
        for i,(name,display,avatar,uni,degree,year,subjects,bio,interests) in enumerate(PEOPLE):
            u=uid(name)
            c.execute('INSERT INTO users(id,username,password,role,display_name,profile,must_change,disabled,created_at) VALUES(?,?,?,?,?,?,0,0,?)',(u,'demo.'+name,NO_LOGIN,'student',display,enc({'avatar':avatar,'university':uni,'course':degree,'bio':bio,'demo':True}),int(time.time())-86400*(60+i*7)))
            c.execute('INSERT INTO market_profiles VALUES(?,?,1)',(u,bio))
            c.execute('INSERT INTO social_profiles VALUES(?,?)',(u,enc({**social_store.DEFAULT,'enabled':True,'university':uni,'degree':degree,'year':year,'bio':bio,'interests':interests,'subjects':subjects,'discoverable':True,'show_university':True,'show_subjects':True,'subject_discovery':True,'dm':'members' if i%2 else 'friends'})))
        currency=c.execute("SELECT value FROM market_settings WHERE key='currency'").fetchone()[0]
        price=lambda v:marketplace_store.money(v)
        # Marketplace notes: one published version each, with the seller's chosen free preview pages.
        for n,(seller,slug,title,subject,topic,kind,cost,pages,tags,desc,preview,sections) in enumerate(LISTINGS):
            fmt,content,pages,previews=listing_content(slug,title,desc,sections)
            meta={'title':title,'subject':subject,'topic':topic,'description':desc,'tags':tags,'resource_type':kind,'price_minor':price(cost),'pages':pages,'term':'Semester 2, 2026'}
            stamp=ago(days=30-n*2)
            c.execute('INSERT INTO market_listings VALUES(?,?,?,?,?,?,?)',(lid(slug),uid(seller),'published',1,enc(meta),stamp,ago(days=max(1,28-n*2))))
            c.execute('INSERT INTO market_versions VALUES(?,?,?,?,?,?,?)',(lid(slug),1,'resource.'+('md' if fmt=='markdown' else fmt),fmt,content,preview,stamp))
            c.executemany('INSERT INTO market_previews VALUES(?,?,?,?)',[(lid(slug),1,page,raw) for page,raw in previews])
        cost={slug:price(row[6]) for row in LISTINGS for slug in [row[1]]};seller_of={row[1]:uid(row[0]) for row in LISTINGS}
        def acquire(buyer,slug,days):
            order=key('order',buyer,slug);stamp=ago(days=days)
            c.execute('INSERT INTO market_orders VALUES(?,?,?,?,?,?)',(order,buyer,'free_acquired' if not cost[slug] else 'demo_paid',currency,cost[slug],stamp))
            c.execute('INSERT INTO market_order_items VALUES(?,?,?,?,?)',(order,lid(slug),1,seller_of[slug],cost[slug]))
            c.execute('INSERT INTO market_ownership VALUES(?,?,?,?,?,?)',(buyer,lid(slug),1,order,stamp,1))
        for buyer,slug,days,stars,body in NOTE_REVIEWS:
            acquire(uid(buyer),slug,days+1)
            c.execute('INSERT INTO market_reviews VALUES(?,?,?,?,?,?,?)',(key('review',buyer,slug),uid(buyer),'note',lid(slug),stars,body,ago(days=days)))
        tutors={}
        for name,tagline,bio,experience,languages,subjects,methods,rate,slots,approval,year in TUTORS:
            data={'bio':bio,'tagline':tagline,'experience':experience,'languages':languages,'subjects':subjects,'methods':methods,'price_minor':price(rate),'timezone':'Australia/Sydney','availability':[{'day':a,'start':b,'end':e} for a,b,e in slots],'exceptions':[],'status':'accepting','approval':approval,'year':year}
            tutors[name]=data;c.execute('INSERT INTO market_tutors VALUES(?,?,?,?)',(uid(name),enc(data),ago(days=40),ago(days=3)))
        def session(student,tutor,subject,start,minutes,status,note=''):
            data=tutors[tutor];amount=round(data['price_minor']*minutes/60);end=start+timedelta(minutes=minutes)
            info={'subject':subject,'method':data['methods'][0],'duration':minutes,'amount_minor':amount,'currency':currency,'payment_status':'not_configured' if amount else 'free','note':note,'timezone':data['timezone']}
            if status in ('confirmed','completed'):info['confirmed_at']=(start-timedelta(days=2)).isoformat()
            if status=='completed':info['completed_at']=end.isoformat()
            b=key('booking',student,tutor,start.isoformat());c.execute('INSERT INTO market_bookings VALUES(?,?,?,?,?,?,?,?,?)',(b,student,uid(tutor),start.isoformat(),end.isoformat(),status,enc(info),(start-timedelta(days=3)).isoformat(),(end if status=='completed' else start-timedelta(days=2)).isoformat()));return b
        def at(days,hour,minute=0):return datetime.combine(today+timedelta(days=days),datetime.min.time(),LOCAL).replace(hour=hour,minute=minute).astimezone(timezone.utc)
        def next_slot(tutor,after,hour):
            days=after
            while not any(a['day']==(today+timedelta(days=days)).weekday() and int(a['start'][:2])<=hour<int(a['end'][:2]) for a in tutors[tutor]['availability']):days+=1
            return at(days,hour)
        for student,tutor,subject,days,hour,minutes,stars,body in TUTOR_REVIEWS:
            b=session(uid(student),tutor,subject,at(-days,hour),minutes,'completed')
            c.execute('INSERT INTO market_reviews VALUES(?,?,?,?,?,?,?)',(key('review',student,b),uid(student),'tutor',b,stars,body,ago(days=days-1)))
        c.execute('INSERT INTO market_reports VALUES(?,?,?,?,?,?,?)',(key('report','contract'),uid('zara'),'note',lid('contract'),'This preview looks like it copies the lecturer’s slides word for word. Could a moderator check?','open',ago(days=2)))
        # Socialise: spaces, members, chats, tasks, events and posts.
        for a,b in DEMO_FRIENDS:c.execute('INSERT INTO social_links VALUES(?,?,?,?)',(uid(a),uid(b),'accepted',ago(days=30)))
        for n,(slug,kind,owner,name,data,members) in enumerate(SPACES):
            info={'description':'','subject':'','topic':'','university':'','category':'','rules':'','icon':'','private':kind=='project','due':'','status':'planning','type':'club' if kind=='club' else 'general','review':True,**data}
            if kind=='project':info['due']=local(data['due'],'23:59')
            c.execute('INSERT INTO social_spaces VALUES(?,?,?,?,?,?)',(sid(slug),kind,uid(owner),name,enc(info),ago(days=45-n*3)))
            c.execute('INSERT INTO social_members VALUES(?,?,?,?)',(sid(slug),uid(owner),'active','Team Lead' if kind=='project' else 'Owner'))
            for who,role,state in members:
                for v in (real if who=='ME' else [uid(who)]):c.execute('INSERT INTO social_members VALUES(?,?,?,?)',(sid(slug),v,state,role))
        for slug,lines in CHATS:
            for i,(author,minutes,body) in enumerate(lines):c.execute('INSERT INTO social_messages(id,space_id,author,body,created_at) VALUES(?,?,?,?,?)',(key('msg',slug,str(i)),sid(slug),uid(author),body,ago(minutes=minutes)))
        for n,(slug,title,desc,status,priority,due,assigned,checklist) in enumerate(TASKS):
            people=[v for who in assigned for v in (real if who=='ME' else [uid(who)])]
            data={'description':desc,'status':status,'priority':priority,'due':local(due,'17:00'),'assigned':people,'checklist':[{'text':t,'done':done} for t,done in checklist]}
            task=key('task',slug,title);c.execute('INSERT INTO social_tasks VALUES(?,?,?,?,?)',(task,sid(slug),title,enc(data),ago(days=10-n)))
            owner=next(s[2] for s in SPACES if s[0]==slug)
            c.execute('INSERT INTO social_activity(id,space_id,actor,kind,body,task_id,created_at) VALUES(?,?,?,?,?,?,?)',(key('act',task,'new'),sid(slug),uid(owner),'task','Created task: '+title,task,ago(days=12-n)))
            if status!='todo':c.execute('INSERT INTO social_activity(id,space_id,actor,kind,body,task_id,created_at) VALUES(?,?,?,?,?,?,?)',(key('act',task,status),sid(slug),uid(assigned[0]) if assigned[0]!='ME' else real[0],'task','Updated task: '+title+' · todo → '+status,task,ago(days=8-n)))
        c.execute('INSERT INTO social_files VALUES(?,?,?,?,?,?,?)',(key('file','requirements'),sid('seproject'),uid('aisha'),'requirements.md','Signed-off requirements and user stories','# Study Planner — Requirements\n\n1. Students can add subjects and tasks.\n2. Reminders appear on the dashboard.\n3. Tasks can be marked done.\n'.encode(),ago(days=6)))
        c.execute('INSERT INTO social_activity(id,space_id,actor,kind,body,task_id,created_at) VALUES(?,?,?,?,?,?,?)',(key('act','file','requirements'),sid('seproject'),uid('aisha'),'file','Uploaded requirements.md',None,ago(days=6)))
        for slug,author,title,ahead,start,hours,location,desc,kind,going in EVENTS:
            begin=local(ahead,start);end=(datetime.fromisoformat(begin)+timedelta(hours=hours)).isoformat(timespec='minutes') if hours else ''
            event=key('event',title);c.execute('INSERT INTO social_events VALUES(?,?,?,?,?)',(event,sid(slug) if slug else None,uid(author),title,enc({'start':begin,'end':end,'location':location,'description':desc,'kind':kind})))
            for who in [author]+going:c.execute('INSERT INTO social_attendance VALUES(?,?)',(event,uid(who)))
        for author,audience,subject,hours,body,likers,comments,slug in POSTS:
            post=key('post',author,str(hours));c.execute('INSERT INTO social_posts VALUES(?,?,?,?,?,?,?)',(post,uid(author),sid(slug) if slug else None,body,subject,audience,ago(hours=hours)))
            for who in likers:
                for v in (real if who=='ME' else [uid(who)]):c.execute('INSERT INTO social_likes VALUES(?,?)',(post,v))
            for i,(who,text) in enumerate(comments):c.execute('INSERT INTO social_comments VALUES(?,?,?,?,?)',(key('comment',post,str(i)),post,uid(who),text,ago(hours=hours-1-i)))
        # Personal links for each real account.
        for me in real:
            for friend in ('aisha','noah','ethan'):c.execute('INSERT INTO social_links VALUES(?,?,?,?)',(uid(friend),me,'accepted',ago(days=20)))
            for asker,hours in (('liam',6),('sofia',26)):
                c.execute('INSERT INTO social_links VALUES(?,?,?,?)',(uid(asker),me,'pending',ago(hours=hours)))
                c.execute('INSERT INTO social_notifications VALUES(?,?,?,?,?,0,?)',(key('note',me,'friend',asker),me,'friend_request','You have a new friend request.',uid(asker),ago(hours=hours)))
            c.execute('INSERT INTO social_links VALUES(?,?,?,?)',(me,uid('priya'),'pending',ago(days=1)))
            for friend,lines in (('aisha',[('aisha',1500,'Hey! Are you coming to the hackathon kickoff on Friday?'),('ME',1440,'Yes! Can I join your team?'),('aisha',120,'Of course 😄 I’ll add you to the team list.')]),('noah',[('noah',3000,'I put the integration practice questions in the study group chat.'),('ME',2900,'Thanks Noah, super helpful!')])):
                room=key('dm',me,friend);c.execute('INSERT INTO social_spaces VALUES(?,?,?,?,?,?)',(room,'dm',uid(friend),'dm:'+':'.join(sorted([me,uid(friend)])),'{}',ago(days=3)))
                for v in (me,uid(friend)):c.execute('INSERT INTO social_members VALUES(?,?,?,?)',(room,v,'active','Member'))
                for i,(who,minutes,body) in enumerate(lines):c.execute('INSERT INTO social_messages(id,space_id,author,body,created_at) VALUES(?,?,?,?,?)',(key('dmmsg',room,str(i)),room,me if who=='ME' else uid(who),body,ago(minutes=minutes)))
            c.execute('INSERT INTO social_notifications VALUES(?,?,?,?,?,0,?)',(key('note',me,'dm'),me,'message','New message in your conversation',key('dm',me,'aisha'),ago(minutes=120)))
            c.execute('INSERT INTO social_notifications VALUES(?,?,?,?,?,0,?)',(key('note',me,'invite'),me,'club','Invitation: Photography Collective',sid('photo'),ago(hours=10)))
            c.execute('INSERT INTO social_notifications VALUES(?,?,?,?,?,0,?)',(key('note',me,'task'),me,'task','Task review: Design database schema',sid('seproject'),ago(hours=4)))
            c.execute('INSERT INTO social_notifications VALUES(?,?,?,?,?,0,?)',(key('note',me,'event'),me,'event','Event updated: Sprint planning',sid('seproject'),ago(hours=3)))
            # Marketplace: one free note in the library, a cart item, a saved note, bookings and a conversation.
            acquire(me,'bigo',3)
            c.execute('INSERT INTO market_cart VALUES(?,?)',(me,lid('micro')))
            c.execute("INSERT INTO market_saved VALUES(?,'note',?)",(me,lid('orgo')));c.execute("INSERT INTO market_saved VALUES(?,'tutor',?)",(me,uid('ethan')))
            done=session(me,'noah','Calculus',at(-10,17),60,'completed','Integration by parts practice.')
            upcoming=session(me,'ethan','Statistics',next_slot('ethan',2,19),60,'confirmed','Help with the hypothesis testing assignment.')
            pending=session(me,'aisha','Data Structures',next_slot('aisha',3,18),60,'pending','AVL tree rotations before the exam.')
            chat=key('chat',me,'ds-notes');c.execute('INSERT INTO market_conversations VALUES(?,?,?,?,?)',(chat,me,uid('aisha'),'note',lid('ds-notes')))
            for i,(who,hours,body,read) in enumerate([('ME',30,'Hi! Do these notes cover the AVL rotations from week 9?',1),('aisha',2,'Yes! Week 9 has worked examples of all four rotations, plus practice questions at the end.',0)]):
                mid=key('mmsg',chat,str(i));c.execute('INSERT INTO market_messages VALUES(?,?,?,?,?,?)',(mid,chat,me if who=='ME' else uid(who),body,read,ago(hours=hours)))
            c.execute('INSERT INTO market_notifications VALUES(?,?,?,?,?,0,?)',(key('mnote',me,'msg'),me,'marketplace_message','You have a new Marketplace message.',mid,ago(hours=2)))
            tchat=key('chat',me,'ethan');c.execute('INSERT INTO market_conversations VALUES(?,?,?,?,?)',(tchat,me,uid('ethan'),'tutor',uid('ethan')))
            c.execute('INSERT INTO market_messages VALUES(?,?,?,?,?,?)',(key('mmsg',tchat,'0'),tchat,uid('ethan'),'Looking forward to our session! Send me the questions you’re stuck on beforehand.',0,ago(hours=20)))
            for kind,body,target,hours in [('booking_confirmed','Tutoring session confirmed.',upcoming,22),('booking_completed','Tutoring session completed. Please leave a review.',done,240),('booking_pending','Your tutoring booking is pending. No payment was collected.',pending,5),('note_acquired','Notes acquired. Download or add an editable copy to your subjects.',lid('bigo'),72)]:
                c.execute('INSERT INTO market_notifications VALUES(?,?,?,?,?,0,?)',(key('mnote',me,kind),me,kind,body,target,ago(hours=hours)))
        broken=c.execute('PRAGMA foreign_key_check').fetchall()
        if broken:raise RuntimeError('Demo data would leave broken references; nothing was changed: '+str([tuple(r) for r in broken[:5]]))
        return real

def refresh_listings(path):
    """Update demo listings in place (content, page count and free preview pages), keeping everything else."""
    marketplace_store.migrate(path);count=0
    with accounts.db(path) as c:
        c.execute('BEGIN IMMEDIATE')
        for seller,slug,title,subject,topic,kind,cost,pages,tags,desc,preview,sections in LISTINGS:
            r=c.execute('SELECT metadata,version FROM market_listings WHERE id=?',(lid(slug),)).fetchone()
            if not r:continue
            fmt,content,pages,previews=listing_content(slug,title,desc,sections);meta={**json.loads(r['metadata']),'pages':pages}
            c.execute('UPDATE market_listings SET metadata=? WHERE id=?',(enc(meta),lid(slug)))
            c.execute('UPDATE market_versions SET filename=?,format=?,content=? WHERE listing=? AND version=?',('resource.'+('md' if fmt=='markdown' else fmt),fmt,content,lid(slug),r['version']))
            c.execute('DELETE FROM market_previews WHERE listing=? AND version=?',(lid(slug),r['version']))
            c.executemany('INSERT INTO market_previews VALUES(?,?,?,?)',[(lid(slug),r['version'],page,raw) for page,raw in previews]);count+=1
    return count

def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter);parser.add_argument('action',choices=['add','remove','previews']);args=parser.parse_args()
    path=ROOT/'data'/'accounts.db'
    if not path.exists():raise SystemExit('Start the portal and sign in once first.')
    print('Backup:',backup(path))
    if args.action=='add':
        real=add(path)
        print(f'Added {len(PEOPLE)} demo people, {len(LISTINGS)} note listings, {len(TUTORS)} tutors, {len(SPACES)} clubs/study groups/projects, {len(EVENTS)} events and {len(POSTS)} posts, linked to {len(real)} account(s).')
        print('Refresh the portal to see them. Remove with: python tools/demo_data.py remove')
    elif args.action=='previews':
        n=refresh_listings(path);print(f'Updated {n} demo listings with longer notes and each seller’s free preview pages.' if n else 'No demo listings found. Run: python tools/demo_data.py add')
    else:
        n=remove(path);print(f'Removed {n} demo people and everything linked to them.' if n else 'No demo data found. Nothing changed.')
if __name__=='__main__':main()
