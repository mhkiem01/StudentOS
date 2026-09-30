"""Optional real Ollama quality checks. Proposals only: never writes SQLite."""
import sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[3]))
import backend  # adds backend/<feature> folders to the import path
import ai_provider as ai

CASES=[
 ('deadline','Add a reminder to submit COMP1521 lab tomorrow at 5 PM.', 'reminders_create'),
 ('weekly reminder','Add a COMP1521 lab submission reminder every Monday until 16 November 2026, with no time.', 'reminders_create'),
 ('dated timetable','Add a one-off study session on 5 October 2026 from 09:30 to 10:30 in the Library.', 'timetable_import'),
 ('study note','Create a study note titled TCP basics explaining TCP in three short bullet points.', 'notes_create'),
 ('explanation','Explain binary search in two sentences. Do not create anything.', None),
]
def main():
    status=ai.status()
    if not status.get('online') or not status.get('model_available'):raise RuntimeError(status.get('error') or 'Start Ollama and install the configured model first.')
    failures=[]
    for name,prompt,kind in CASES:
        print('\nLIVE:',name,flush=True);started=time.monotonic();last=[0]
        def progress(event):
            elapsed=int(time.monotonic()-started)
            if elapsed-last[0]>=15:print(f'  Still working ({elapsed}s)…',flush=True);last[0]=elapsed
        try:
            result=ai.chat([{'role':'user','content':prompt}],context={'current_date':'2026-09-20'},on_progress=progress)
            actions=result['actions'];assert result['reply']
            if kind:
                action=next(a for a in actions if a['type']==kind)
                if name=='deadline':
                    draft=action['reminders'][0];assert draft['due_date']=='2026-09-21' and draft['due_time']=='17:00',draft
                if name=='weekly reminder':
                    draft=action['reminders'][0];assert draft['recurrence']=='weekly' and draft['repeat_until']=='2026-11-16' and draft['due_time']=='',draft
                if name=='dated timetable':
                    draft=action['events'][0];assert draft['event_date']=='2026-10-05' and draft['start_time']=='09:30' and draft['end_time']=='10:30' and draft['recurrence']=='none',draft
            else:assert not actions,actions
            print('PASS',name,round(time.monotonic()-started,1),'seconds',flush=True)
        except Exception as exc:failures.append(name);print('FAIL',name,repr(exc),flush=True)
    if failures:raise RuntimeError('Live model checks failed: '+', '.join(failures))
if __name__=='__main__':main()
