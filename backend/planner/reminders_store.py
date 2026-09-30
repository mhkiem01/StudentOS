"""Reminder validation and bounded weekly series with independent completion."""
import re
import uuid
from datetime import datetime, timedelta
from calendar_store import parse_date

COLUMNS = ('id','title','description','due_at','priority','subject_id','completed','created_at','series_id','status')


def validate(item):
    result = dict(item)
    if not result.get('id'):
        raise ValueError('A reminder id is required.')
    result['title'] = str(result.get('title') or '').strip()
    if not result['title']:
        raise ValueError('Give the reminder a title.')
    result['priority'] = str(result.get('priority') or 'medium').lower()
    if result['priority'] not in ('low','medium','high'):
        raise ValueError('Choose Low, Medium or High priority.')
    due = result.get('due_at') or None
    if due:
        parse_date(due[:10], 'Due date')
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d)?', due):
            raise ValueError('Use a due date and optional HH:MM time.')
    result.update(due_at=due,subject_id=result.get('subject_id') or None,
                  description=str(result.get('description') or ''),
                  created_at=result.get('created_at') or datetime.now().isoformat(timespec='seconds'),
                  series_id=result.get('series_id') or None)
    if result.get('completed',0) not in (0,1,False,True):
        raise ValueError('Invalid completed status.')
    result['completed'] = int(result.get('completed') or 0)
    result['status'] = result.get('status') or ('done' if result['completed'] else 'no_progress')
    if result['status'] not in ('no_progress','in_progress','done'):
        raise ValueError('Choose No Progress, In Progress or Done.')
    result['completed'] = int(result['status']=='done')
    return result


def expand(drafts):
    if not isinstance(drafts,list) or not 1 <= len(drafts) <= 50:
        raise ValueError('Review between 1 and 50 reminder drafts.')
    rows = []
    for draft in drafts:
        if not isinstance(draft,dict) or not draft.get('id'):
            raise ValueError('A draft id is required.')
        recurrence = draft.get('recurrence') or 'none'
        if recurrence not in ('none','weekly'):
            raise ValueError('Repeat must be none or weekly.')
        start = parse_date(draft['due_date'],'First due date') if draft.get('due_date') else None
        time = draft.get('due_time') or ''
        if time and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',time):
            raise ValueError('Choose a valid due time.')
        if time and not start:
            raise ValueError('Choose a due date for this time.')
        if recurrence=='weekly':
            if not start:
                raise ValueError('Choose the first due date for the weekly reminder.')
            end = parse_date(draft.get('repeat_until'),'Repeat until')
            if end < start:
                raise ValueError('Repeat until must be on or after the first due date.')
            if (end-start).days//7 >= 260:
                raise ValueError('Choose a weekly reminder range of fewer than 260 weeks.')
            dates = [start+timedelta(days=n) for n in range(0,(end-start).days+1,7)]
        else:
            dates=[start]
        for day in dates:
            due = day.isoformat()+(('T'+time) if time else '') if day else None
            identity = str(uuid.uuid5(uuid.NAMESPACE_URL, str(draft['id'])+':'+str(due)))
            rows.append(validate({**draft,'id':identity,'due_at':due,'completed':0,
                                  'series_id':draft['id'] if recurrence=='weekly' else None}))
    if len(rows)>500:
        raise ValueError('Import no more than 500 reminder occurrences at a time.')
    return rows


def write(con,item,create_only=False):
    conflict = 'DO NOTHING' if create_only else 'DO UPDATE SET '+','.join(f'{k}=excluded.{k}' for k in COLUMNS if k!='id')
    con.execute('INSERT INTO reminders ('+','.join(COLUMNS)+') VALUES ('+','.join('?' for _ in COLUMNS)+') ON CONFLICT(id) '+conflict,
                [item.get(c) for c in COLUMNS])
