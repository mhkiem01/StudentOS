"""Subject-scoped notes, additive migrations and server-side relationship checks."""
import sqlite3
import note_document
from contextlib import closing
from datetime import datetime, timezone

def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')

def migrate(db_path, backup_dir):
    with closing(sqlite3.connect(db_path)) as con, con:
        cols={r[1] for r in con.execute('PRAGMA table_info(notes)')}
        additions={'week':'INTEGER','is_pinned':'INTEGER NOT NULL DEFAULT 0','created_at':'TEXT','last_studied_at':'TEXT','legacy_topic_name':'TEXT','content_format':"TEXT NOT NULL DEFAULT 'markdown'"}
        if all(k in cols for k in additions):return
        backup_dir.mkdir(parents=True,exist_ok=True)
        backup=backup_dir/('before-notes-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db')
        with closing(sqlite3.connect(backup)) as dest:con.backup(dest)
        con.execute('BEGIN IMMEDIATE')
        for key,decl in additions.items():
            if key not in cols:con.execute(f'ALTER TABLE notes ADD COLUMN {key} {decl}')
        con.execute('UPDATE notes SET created_at=updated_at WHERE created_at IS NULL')
        con.execute('CREATE TABLE IF NOT EXISTS note_tags(note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,tag TEXT NOT NULL,PRIMARY KEY(note_id,tag))')
        con.execute('CREATE INDEX IF NOT EXISTS notes_subject_index ON notes(subject_id,updated_at)')
        con.execute('UPDATE notes SET subject_id=NULL WHERE subject_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM subjects WHERE subjects.id=notes.subject_id)')
        repair_topics(con)
        con.execute("INSERT OR REPLACE INTO app_meta(key,value) VALUES('notes_schema','1')")

def repair_topics(con):
    # Deleting a subject retains notes (ON DELETE SET NULL). A moved/deleted
    # topic must not leave a note referencing another subject's topic.
    con.execute('UPDATE notes SET legacy_topic_name=topic_name,topic_name=NULL WHERE topic_name IS NOT NULL AND NOT EXISTS(SELECT 1 FROM subject_topics st WHERE st.subject_id=notes.subject_id AND st.topic_name=notes.topic_name)')

def read_all(con):
    notes=[dict(r) for r in con.execute('SELECT * FROM notes ORDER BY updated_at DESC')]
    tags={}
    for row in con.execute('SELECT note_id,tag FROM note_tags ORDER BY rowid'):tags.setdefault(row['note_id'],[]).append(row['tag'])
    for note in notes:note['tags']=tags.get(note['id'],[])
    return notes

def save(con, draft, create_only=False):
    if not isinstance(draft,dict) or not isinstance(draft.get('id'),str) or not draft['id']:raise ValueError('A note id is required.')
    existing=con.execute('SELECT * FROM notes WHERE id=?',(draft['id'],)).fetchone()
    if existing and create_only:return
    if existing and draft.get('base_updated_at') and draft['base_updated_at']!=existing['updated_at']:
        raise ValueError('This note changed on another device. Your draft is kept; reload the note before saving again.')
    item={**(dict(existing) if existing else {}),**draft}
    subject=item.get('subject_id')
    if not subject or not con.execute('SELECT 1 FROM subjects WHERE id=?',(subject,)).fetchone():raise ValueError('Choose a valid subject for this note.')
    topic=item.get('topic_name') or None
    if topic and not con.execute('SELECT 1 FROM subject_topics WHERE subject_id=? AND topic_name=?',(subject,topic)).fetchone():raise ValueError('Choose a topic belonging to this subject, or leave Topic empty.')
    title=item.get('title');content=item.get('content','')
    if not isinstance(title,str) or not title.strip() or len(title)>300:raise ValueError('Enter a title of 1–300 characters.')
    if not isinstance(content,str) or len(content)>100000:raise ValueError('Note content must be text under 100,000 characters.')
    content_format=item.get('content_format','markdown')
    if content_format not in ('markdown','html'):raise ValueError('Unsupported note format.')
    if content_format=='html':content=note_document.sanitize(content)
    if len(content)>100000:raise ValueError('Formatted note is too large. Split it into smaller notes.')
    week=item.get('week')
    if week in ('',None):week=None
    elif isinstance(week,bool) or not str(week).isdigit() or not 1<=int(week)<=100:raise ValueError('Week must be between 1 and 100, or left empty.')
    else:week=int(week)
    if not existing and not topic and week is None:
        raise ValueError('Choose a Topic or Week to keep your notes organised.')
    pin=item.get('is_pinned',0)
    if pin not in (0,1,False,True):raise ValueError('Invalid pin value.')
    tags=draft.get('tags')
    if tags is not None:
        if not isinstance(tags,list) or len(tags)>20 or any(not isinstance(t,str) or not t.strip() or len(t.strip())>40 for t in tags):raise ValueError('Use up to 20 tags, each 1–40 characters.')
        seen=set();clean=[]
        for t in tags:
            t=t.strip()
            if t.casefold() not in seen:seen.add(t.casefold());clean.append(t)
    stamp=now()
    con.execute('INSERT INTO notes(id,title,content,subject_id,topic_name,week,is_pinned,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,content=excluded.content,subject_id=excluded.subject_id,topic_name=excluded.topic_name,week=excluded.week,is_pinned=excluded.is_pinned,updated_at=excluded.updated_at',
                (item['id'],title.strip(),content,subject,topic,week,int(pin),existing['created_at'] if existing else stamp,stamp))
    con.execute('UPDATE notes SET content_format=? WHERE id=?',(content_format,item['id']))
    if tags is not None:
        con.execute('DELETE FROM note_tags WHERE note_id=?',(item['id'],))
        con.executemany('INSERT INTO note_tags(note_id,tag) VALUES(?,?)',[(item['id'],tag) for tag in clean])
    return item['id']
