#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import sqlite3
import json
import mimetypes
import webbrowser
import threading
import socket
import sys
import time
import backend  # adds backend/<feature> folders to the import path
import ai_provider
import calendar_store
import reminders_store
import notes_store
import note_document
import gym_store
import gym_journey
import assistant_actions
import assistant_catalog
import general_todos
import task_cleanup
import finance_store
import progress_service
import currency_provider
import accounts
import social_store
import marketplace_store
import quick_review_store
import os
from contextvars import ContextVar
from http.cookies import SimpleCookie
from contextlib import contextmanager

ROOT = Path(__file__).resolve().parent
DB_DIR = ROOT / "data"
DB_PATH = DB_DIR / "quizprep.db"
REQUEST_DB = ContextVar('portal_database', default=None)
WORKSPACE_LOCK = threading.Lock()
READY_WORKSPACES = set()
def database_path(): return REQUEST_DB.get() or DB_PATH
INDEX_PATH = ROOT / "index.html"
# Listen on the PC's network interfaces so the laptop and phones on the same
# private Wi-Fi can all use the same LAN address.
HOST = "0.0.0.0"

DB_DIR.mkdir(exist_ok=True)

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS topics (
    name TEXT PRIMARY KEY,
    color TEXT NOT NULL DEFAULT '#7445f5',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    data_json TEXT NOT NULL,
    FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7445f5',
    category TEXT NOT NULL DEFAULT 'general',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subject_topics (
    subject_id TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(subject_id, topic_name),
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS progress (
    topic_name TEXT PRIMARY KEY,
    answered INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topic_sessions (
    topic_name TEXT PRIMARY KEY,
    current_index INTEGER NOT NULL DEFAULT 0,
    answers_json TEXT NOT NULL DEFAULT '{}',
    flags_json TEXT NOT NULL DEFAULT '{}',
    timer_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS latest_results (
    topic_name TEXT PRIMARY KEY,
    result_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    data_json TEXT NOT NULL,
    FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcard_progress (
    topic_name TEXT PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timetable_events (
    id TEXT PRIMARY KEY, subject_id TEXT, title TEXT NOT NULL, day INTEGER NOT NULL,
    start_time TEXT NOT NULL, end_time TEXT NOT NULL, location TEXT, event_type TEXT,
    color TEXT, FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, due_at TEXT, priority TEXT NOT NULL DEFAULT 'medium',
    subject_id TEXT, completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
    FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', subject_id TEXT, topic_name TEXT,
    updated_at TEXT NOT NULL, FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS flashcard_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, topic_name TEXT NOT NULL, card_position INTEGER NOT NULL,
    rating TEXT NOT NULL, reviewed_at TEXT NOT NULL, FOREIGN KEY(topic_name) REFERENCES topics(name) ON DELETE CASCADE
);
"""

@contextmanager
def connect():
    con = sqlite3.connect(database_path(), timeout=20)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        with con:
            yield con
    finally:
        con.close()

def init_db():
    with connect() as con:
        con.executescript(SCHEMA)
        # CREATE TABLE IF NOT EXISTS does not add new columns, so migrate older
        # session tables in place as optional attempt features are introduced.
        session_columns = {
            row["name"] for row in con.execute("PRAGMA table_info(topic_sessions)")
        }
        if "flags_json" not in session_columns:
            con.execute(
                "ALTER TABLE topic_sessions ADD COLUMN flags_json TEXT NOT NULL DEFAULT '{}'"
            )
        if "timer_json" not in session_columns:
            con.execute(
                "ALTER TABLE topic_sessions ADD COLUMN timer_json TEXT NOT NULL DEFAULT '{}'"
            )
        subject_columns = {
            row["name"] for row in con.execute("PRAGMA table_info(subjects)")
        }
        if "category" not in subject_columns:
            con.execute(
                "ALTER TABLE subjects ADD COLUMN category TEXT NOT NULL DEFAULT 'general'"
            )

    backup_dir=ROOT/'backups' if database_path()==DB_PATH else database_path().parent/'backups'
    calendar_store.migrate(database_path(), backup_dir)
    notes_store.migrate(database_path(), backup_dir)
    gym_store.migrate(database_path(), backup_dir)
    gym_journey.migrate(database_path(), backup_dir)
    assistant_actions.migrate(database_path(), backup_dir)
    general_todos.migrate(database_path(), backup_dir)
    finance_store.migrate(database_path(), backup_dir)
    progress_service.migrate(database_path(), backup_dir)
    task_cleanup.migrate(database_path(), backup_dir)
    quick_review_store.migrate(database_path(), backup_dir)

def export_state():
    state = {"topics": {}, "progress": {}, "subjects": {}, "topicMeta": {}, "sessions": {}, "latestResults": {}, "flashcards": {}, "flashcardProgress": {}, "_savedAt": 0}
    with connect() as con:
        config=con.execute("SELECT value FROM app_meta WHERE key='quiz_settings'").fetchone()
        state['quizSettings']=json.loads(config[0]) if config else {}
        saved_at = con.execute(
            "SELECT value FROM app_meta WHERE key='saved_at'"
        ).fetchone()
        if saved_at:
            try:
                state["_savedAt"] = int(saved_at["value"])
            except (TypeError, ValueError):
                pass
        topics = con.execute(
            "SELECT name, color FROM topics ORDER BY sort_order, rowid"
        ).fetchall()
        for t in topics:
            name = t["name"]
            state["topics"][name] = []
            state["flashcards"][name] = []
            state["topicMeta"][name] = {"color": t["color"]}
            rows = con.execute(
                "SELECT data_json FROM questions WHERE topic_name=? ORDER BY position, id",
                (name,),
            ).fetchall()
            for row in rows:
                try:
                    state["topics"][name].append(json.loads(row["data_json"]))
                except Exception:
                    pass
            card_rows = con.execute(
                "SELECT data_json FROM flashcards WHERE topic_name=? ORDER BY position, id",
                (name,),
            ).fetchall()
            for row in card_rows:
                try:
                    state["flashcards"][name].append(json.loads(row["data_json"]))
                except Exception:
                    pass

        for p in con.execute("SELECT topic_name, answered, correct FROM progress"):
            state["progress"][p["topic_name"]] = {
                "answered": int(p["answered"]),
                "correct": int(p["correct"]),
            }

        for session in con.execute("SELECT topic_name, current_index, answers_json, flags_json, timer_json FROM topic_sessions"):
            try:
                answers = json.loads(session["answers_json"])
            except Exception:
                answers = {}
            try:
                flags = json.loads(session["flags_json"])
            except Exception:
                flags = {}
            try:
                timer = json.loads(session["timer_json"])
            except Exception:
                timer = {}
            state["sessions"][session["topic_name"]] = {
                "currentIndex": int(session["current_index"]),
                "answers": answers if isinstance(answers, dict) else {},
                "flags": flags if isinstance(flags, dict) else {},
                "timer": timer if isinstance(timer, dict) else {},
            }

        for result in con.execute("SELECT topic_name, result_json FROM latest_results"):
            try:
                result_data = json.loads(result["result_json"])
            except Exception:
                result_data = {}
            if isinstance(result_data, dict):
                state["latestResults"][result["topic_name"]] = result_data

        for row in con.execute("SELECT topic_name, data_json FROM flashcard_progress"):
            try:
                progress_data = json.loads(row["data_json"])
            except Exception:
                progress_data = {}
            state["flashcardProgress"][row["topic_name"]] = progress_data if isinstance(progress_data, dict) else {}

        subjects = con.execute(
            "SELECT id, name, color, category FROM subjects ORDER BY sort_order, rowid"
        ).fetchall()
        for s in subjects:
            topic_rows = con.execute(
                "SELECT topic_name FROM subject_topics WHERE subject_id=? ORDER BY position, rowid",
                (s["id"],),
            ).fetchall()
            state["subjects"][s["id"]] = {
                "id": s["id"],
                "name": s["name"],
                "color": s["color"],
                "category": s["category"],
                "topics": [r["topic_name"] for r in topic_rows],
            }
    return state

def import_state(state):
    topics = state.get("topics") or {}
    progress = state.get("progress") or {}
    subjects = state.get("subjects") or {}
    topic_meta = state.get("topicMeta") or {}
    sessions = state.get("sessions") or {}
    latest_results = state.get("latestResults") or {}
    flashcards = state.get("flashcards") or {}
    flashcard_progress = state.get("flashcardProgress") or {}
    with connect() as con:
        # The server assigns the revision. Device clocks can differ, so client
        # timestamps must never decide which phone or laptop is allowed to save.
        con.execute("BEGIN IMMEDIATE")
        study_previous=progress_service.before(con)
        if 'quizSettings' in state:
            settings=state['quizSettings']
            if not isinstance(settings,dict):raise ValueError('Invalid quiz settings.')
            clean={}
            for topic,config in settings.items():
                if topic not in topics:continue
                if not isinstance(config,dict) or config.get('mode') not in ('normal','mastery'):raise ValueError('Invalid quiz type.')
                target=config.get('target',3)
                if isinstance(target,bool) or not isinstance(target,int) or not 1<=target<=100:raise ValueError('Mastery target must be 1–100.')
                clean[topic]={'mode':config['mode'],'target':target}
            con.execute("INSERT OR REPLACE INTO app_meta(key,value) VALUES('quiz_settings',?)",(json.dumps(clean),))
        current = con.execute(
            "SELECT value FROM app_meta WHERE key='saved_at'"
        ).fetchone()
        try:
            current_saved_at = int(current["value"]) if current else 0
        except (TypeError, ValueError):
            current_saved_at = 0
        saved_at = max(current_saved_at + 1, int(time.time() * 1000))
        con.execute("DELETE FROM subject_topics")
        keep_subjects = {str(s.get('id') or sid) for sid, s in subjects.items() if isinstance(s, dict)}
        for row in con.execute('SELECT id FROM subjects').fetchall():
            if row['id'] not in keep_subjects:
                con.execute('DELETE FROM subjects WHERE id=?', (row['id'],))
        con.execute("DELETE FROM questions")
        con.execute("DELETE FROM flashcards")
        con.execute("DELETE FROM progress")
        con.execute("DELETE FROM topic_sessions")
        con.execute("DELETE FROM latest_results")
        con.execute("DELETE FROM flashcard_progress")
        for row in con.execute('SELECT name FROM topics').fetchall():
            if row['name'] not in topics:
                con.execute('DELETE FROM topics WHERE name=?', (row['name'],))

        for t_index, (name, questions) in enumerate(topics.items()):
            color = (topic_meta.get(name) or {}).get("color") or "#7445f5"
            con.execute(
                "INSERT INTO topics(name, color, sort_order) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET color=excluded.color, sort_order=excluded.sort_order",
                (str(name), str(color), t_index),
            )
            if not isinstance(questions, list):
                questions = []
            for q_index, q in enumerate(questions):
                con.execute(
                    "INSERT INTO questions(topic_name, position, data_json) VALUES(?,?,?)",
                    (str(name), q_index, json.dumps(q, ensure_ascii=False)),
                )
            cards = flashcards.get(name) or []
            if not isinstance(cards, list):
                cards = []
            for card_index, card in enumerate(cards):
                con.execute(
                    "INSERT INTO flashcards(topic_name, position, data_json) VALUES(?,?,?)",
                    (str(name), card_index, json.dumps(card, ensure_ascii=False)),
                )
            p = progress.get(name) or {}
            con.execute(
                "INSERT INTO progress(topic_name, answered, correct) VALUES(?,?,?)",
                (str(name), int(p.get("answered") or 0), int(p.get("correct") or 0)),
            )
            if name in sessions and isinstance(sessions[name], dict):
                session = sessions[name]
                answers = session.get("answers")
                if not isinstance(answers, dict):
                    answers = {}
                flags = session.get("flags")
                if not isinstance(flags, dict):
                    flags = {}
                timer = session.get("timer")
                if not isinstance(timer, dict):
                    timer = {}
                con.execute(
                    "INSERT INTO topic_sessions(topic_name, current_index, answers_json, flags_json, timer_json) VALUES(?,?,?,?,?)",
                    (str(name), max(0, int(session.get("currentIndex") or 0)), json.dumps(answers), json.dumps(flags), json.dumps(timer)),
                )
            if name in latest_results and isinstance(latest_results[name], dict):
                con.execute(
                    "INSERT INTO latest_results(topic_name, result_json) VALUES(?,?)",
                    (str(name), json.dumps(latest_results[name], ensure_ascii=False)),
                )
            card_progress = flashcard_progress.get(name)
            if isinstance(card_progress, dict) and card_progress:
                con.execute(
                    "INSERT INTO flashcard_progress(topic_name, data_json) VALUES(?,?)",
                    (str(name), json.dumps(card_progress)),
                )

        for s_index, (sid, subject) in enumerate(subjects.items()):
            if not isinstance(subject, dict):
                continue
            sid = str(subject.get("id") or sid)
            sname = str(subject.get("name") or "Subject")
            color = str(subject.get("color") or "#7445f5")
            category = str(subject.get("category") or "general")
            if category not in {"coding", "general", "language"}:
                category = "general"
            con.execute(
                "INSERT INTO subjects(id, name, color, category, sort_order) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, category=excluded.category, sort_order=excluded.sort_order",
                (sid, sname, color, category, s_index),
            )
            for pos, topic_name in enumerate(subject.get("topics") or []):
                if topic_name in topics:
                    con.execute(
                        "INSERT OR REPLACE INTO subject_topics(subject_id, topic_name, position) VALUES(?,?,?)",
                        (sid, str(topic_name), pos),
                    )
        notes_store.repair_topics(con)
        progress_service.capture(con,state,study_previous)
        con.execute(
            "INSERT OR REPLACE INTO app_meta(key, value) VALUES('saved_at', ?)",
            (str(saved_at),),
        )
        con.commit()
    return saved_at

def reset_db():
    import_state({"topics": {}, "progress": {}, "subjects": {}, "topicMeta": {}, "sessions": {}, "latestResults": {}, "flashcards": {}, "flashcardProgress": {}})

PORTAL_TABLES = {"timetable_events", "reminders", "notes"}
PORTAL_COLUMNS = {
    "timetable_events": ("id", "subject_id", "title", "day", "start_time", "end_time", "location", "event_type", "color"),
    "reminders": ("id", "title", "description", "due_at", "priority", "subject_id", "completed", "created_at"),
    "notes": ("id", "title", "content", "subject_id", "topic_name", "updated_at"),
}

def portal_state():
    with connect() as con:
        task_cleanup.purge(con)
        result = {table: [dict(row) for row in con.execute("SELECT * FROM " + table)] for table in PORTAL_TABLES}
        result['notes'] = notes_store.read_all(con)
        result["settings"] = {r["key"].removeprefix('portal_'): r["value"] for r in con.execute("SELECT key,value FROM app_meta WHERE key LIKE 'portal_%'")}
        result["reviews"] = [dict(row) for row in con.execute("SELECT topic_name,card_position,rating,reviewed_at FROM flashcard_reviews")]
    return result

def save_portal(payload):
    table = payload.get("table")
    if table == 'notes':
        with connect() as con:
            con.execute('BEGIN IMMEDIATE')
            notes_store.save(con,payload.get('item'))
            saved=next(n for n in notes_store.read_all(con) if n['id']==payload['item']['id'])
        return {'ok':True,'note':saved}
    if table == 'reminders':
        item = payload.get('item') or {}
        with connect() as con:
            existing = con.execute('SELECT * FROM reminders WHERE id=?', (item.get('id'),)).fetchone()
            # Legacy checkbox clients still send completed. New status clients
            # omit completed; keep the two representations consistent.
            if 'completed' in item and ('status' not in item or (existing and item['completed'] != existing['completed'] and item['status'] == existing['status'])):
                item['status'] = 'done' if item['completed'] else 'no_progress'
            item = reminders_store.validate({**(dict(existing) if existing else {}), **item})
            reminders_store.write(con, item)
        return {'ok': True}
    if table == 'timetable_events':
        item = calendar_store.validate(payload.get('item') or {})
        with connect() as con:
            calendar_store.write(con, item)
        return {'ok': True}
    if table in PORTAL_TABLES:
        item = payload.get("item") or {}
        columns = PORTAL_COLUMNS[table]
        if not item.get("id"):
            raise ValueError("An item id is required")
        values = [item.get(c) for c in columns]
        # HTML forms submit optional foreign keys as empty strings; SQLite
        # correctly requires these to be NULL rather than an invalid key.
        for index, column in enumerate(columns):
            if column in {"subject_id", "topic_name"} and values[index] == "":
                values[index] = None
        with connect() as con:
            con.execute("INSERT OR REPLACE INTO %s (%s) VALUES (%s)" % (table, ",".join(columns), ",".join("?" for _ in columns)), values)
        return {"ok": True}
    if table == "settings":
        with connect() as con:
            for key, value in (payload.get("item") or {}).items():
                con.execute("INSERT OR REPLACE INTO app_meta(key,value) VALUES(?,?)", ("portal_" + str(key), str(value)))
        return {"ok": True}
    if table == "reviews":
        item = payload.get("item") or {}
        with connect() as con:
            con.execute("INSERT INTO flashcard_reviews(topic_name,card_position,rating,reviewed_at) VALUES(?,?,?,?)", (item.get("topic_name"), int(item.get("card_position",0)), item.get("rating"), item.get("reviewed_at")))
        return {"ok": True}
    raise ValueError("Unknown portal data type")

def delete_portal(payload):
    table, item_id = payload.get("table"), payload.get("id")
    if table not in PORTAL_TABLES or not item_id:
        raise ValueError("Invalid delete request")
    with connect() as con:
        con.execute("DELETE FROM " + table + " WHERE id=?", (item_id,))
    return {"ok": True}

def choose_port(start=8765, end=8795):
    for port in range(start, end + 1):
        with socket.socket() as sock:
            try:
                sock.bind((HOST, port))
                return port
            except OSError:
                continue
    raise RuntimeError("No free local port found between 8765 and 8795.")

def lan_addresses():
    """Return likely private-network IPv4 addresses for phone access."""
    addresses = []

    def add(address):
        if address and not address.startswith("127.") and address != "0.0.0.0" and address not in addresses:
            addresses.append(address)

    # This finds the interface Windows would normally use for network traffic.
    # UDP connect does not send any data and also works without internet access
    # on most local networks.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            add(sock.getsockname()[0])
    except OSError:
        pass

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            add(info[4][0])
    except OSError:
        pass
    return addresses

class Handler(BaseHTTPRequestHandler):
    server_version = "QuizPrepLocal/1.0"

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Referrer-Policy','same-origin')
        self.send_header('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
        super().end_headers()

    def cookie_token(self):
        try:
            cookies=SimpleCookie(self.headers.get('Cookie',''))
            return cookies['portal_session'].value if 'portal_session' in cookies else ''
        except Exception:return ''

    def auth_json(self,payload,token=None,status=200):
        raw=json.dumps(payload).encode();self.send_response(status)
        if token is not None:
            secure='; Secure' if os.environ.get('PORTAL_HTTPS')=='1' else ''
            self.send_header('Set-Cookie','portal_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+('604800' if token else '0')+secure)
        self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)

    def redirect(self,path):
        self.send_response(302);self.send_header('Location',path);self.send_header('Cache-Control','no-store');self.send_header('Content-Length','0');self.end_headers()

    def do_GET(self): self.dispatch(False)
    def do_POST(self): self.dispatch(True)

    def dispatch(self,post):
        path=urlparse(self.path).path;auth_path=getattr(self.server,'accounts_path',None)
        if path=='/api/health' and not post:return self.send_json({'ok':True})
        if not auth_path:return self.send_json({'ok':False,'error':'Account service has not been initialized.'},503)
        try:
            if post:
                origin=self.headers.get('Origin');host=self.headers.get('Host','')
                if self.headers.get('X-Portal-Request')!='1' or (origin and urlparse(origin).netloc!=host) or self.headers.get('Sec-Fetch-Site')=='cross-site':
                    return self.send_json({'ok':False,'error':'Cross-site or unverified request rejected.'},403)
                if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.send_json({'ok':False,'error':'JSON required.'},415)
            if path in ('/login','/frontend/accounts/account.js','/frontend/accounts/account.css') and not post:
                file=ROOT/('frontend/accounts/login.html' if path=='/login' else path.lstrip('/'))
                raw=file.read_bytes();self.send_response(200);self.send_header('Content-Type',('text/html' if path=='/login' else 'text/javascript' if path.endswith('.js') else 'text/css')+'; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
            if path=='/api/auth/login' and post:
                values=self.read_json();user,token=accounts.login(auth_path,values.get('username'),values.get('password'),self.client_address[0],self.headers.get('User-Agent',''))
                return self.auth_json({'ok':True,'user':user},token)
            user=accounts.session(auth_path,self.cookie_token())
            if not user:
                if path in ('/','/index.html'):return self.redirect('/login')
                return self.auth_json({'ok':False,'error':'Sign in to continue.','code':'login_required'},'',401)
            self.user=user
            if self.headers.get('X-Portal-Account') not in (None,user['id']):return self.send_json({'ok':False,'error':'The signed-in account changed. Reload before continuing.','code':'account_changed'},409)
            if post and path not in ('/api/auth/logout',) and self.headers.get('X-Portal-Account')!=user['id']:return self.send_json({'ok':False,'error':'Reload this page to verify your account.'},403)
            if path=='/api/auth/me' and not post:return self.send_json({'ok':True,'user':accounts.public(user)})
            if path=='/api/auth/logout' and post:
                with accounts.db(auth_path) as con:con.execute('DELETE FROM sessions WHERE token_hash=?',(accounts.digest(self.cookie_token()),))
                return self.auth_json({'ok':True},'')
            if path=='/api/auth/password' and post:
                values=self.read_json();accounts.change_password(auth_path,user,values.get('current_password'),values.get('new_password'))
                return self.auth_json({'ok':True},'')
            if user['must_change']:
                if path in ('/','/index.html'):return self.redirect('/login?change=1')
                return self.send_json({'ok':False,'error':'Change your temporary password first.','code':'password_required'},403)
            if path.startswith('/api/auth/') or path.startswith('/api/admin/'):
                return self.account_route(path,post,auth_path,user)
            if path.startswith('/api/social'):
                try:
                    from urllib.parse import parse_qs,quote
                    if post and path=='/api/social':return self.send_json(social_store.write(auth_path,user['id'],self.read_json()))
                    if not post and path=='/api/social':return self.send_json(social_store.state(auth_path,user['id']))
                    if not post and path=='/api/social/messages':return self.send_json(social_store.messages(auth_path,user['id'],parse_qs(urlparse(self.path).query).get('space',[''])[0]))
                    if not post and path.startswith('/api/social/files/'):
                        raw,name=social_store.download(auth_path,user['id'],path.rsplit('/',1)[-1]);self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Disposition',"attachment; filename*=UTF-8''"+quote(name));self.send_header('Cache-Control','private, no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
                    return self.send_json({'error':'Unknown Socialise route.'},404)
                except social_store.Forbidden as exc:return self.send_json({'error':str(exc)},403)
            # The original workspace belongs only to the original admin. New
            # accounts use server-derived paths, never paths supplied by clients.
            workspace=DB_PATH if user['id']=='admin' else auth_path.parent/'users'/user['id']/'workspace.db'
            token=REQUEST_DB.set(workspace)
            try:
                with WORKSPACE_LOCK:
                    if str(workspace) not in READY_WORKSPACES:
                        workspace.parent.mkdir(parents=True,exist_ok=True);init_db();READY_WORKSPACES.add(str(workspace))
                if path.startswith('/api/marketplace'):
                    try: return self.marketplace_route(path,post,auth_path,user)
                    except marketplace_store.Forbidden as exc:return self.send_json({'error':str(exc)},403)
                    except (ValueError,KeyError,TypeError,sqlite3.IntegrityError) as exc:return self.send_json({'error':str(exc)},400)
                if path=='/api/quick-review':
                    try:
                        with connect() as con:result=quick_review_store.write(con,self.read_json()) if post else quick_review_store.state(con)
                        return self.send_json(result)
                    except (ValueError,KeyError,TypeError,sqlite3.IntegrityError) as exc:return self.send_json({'error':str(exc)},400)
                if post:return self._post()
                return self._get()
            finally:REQUEST_DB.reset(token)
        except PermissionError as exc:return self.send_json({'ok':False,'error':str(exc)},429)
        except (ValueError,KeyError,TypeError) as exc:return self.send_json({'ok':False,'error':str(exc)},400)
        except Exception as exc:
            print('Account request error:',type(exc).__name__)
            return self.send_json({'ok':False,'error':'The account request could not be completed. Please retry.'},500)

    def marketplace_route(self,path,post,auth_path,user):
        from urllib.parse import parse_qs,quote
        from html import escape
        u=user['id'];query=parse_qs(urlparse(self.path).query)
        if path=='/api/marketplace':
            if not post:return self.send_json(marketplace_store.state(auth_path,u))
            payload=self.read_json()
            if payload.get('action')=='listing' and payload.get('data',{}).get('source_note'):
                d=payload['data']
                with connect() as con:note=con.execute('SELECT * FROM notes WHERE id=?',(d['source_note'],)).fetchone()
                if not note:raise ValueError('Select a note from your own workspace.')
                d['format']=note['content_format'];d['content']=note['content']
            return self.send_json(marketplace_store.write(auth_path,u,payload))
        if path=='/api/marketplace/options' and not post:
            with connect() as con:
                return self.send_json({'subjects':[dict(r) for r in con.execute('SELECT id,name FROM subjects ORDER BY sort_order')],'topics':[dict(r) for r in con.execute('SELECT subject_id,topic_name FROM subject_topics')],'notes':[dict(r) for r in con.execute('SELECT id,title,subject_id FROM notes ORDER BY updated_at DESC')]})
        if path=='/api/marketplace/messages' and not post:return self.send_json(marketplace_store.messages(auth_path,u,query.get('conversation',[''])[0]))
        if path.startswith('/api/marketplace/preview/') and not post:
            parts=path.split('/');raw=marketplace_store.preview_image(auth_path,u,parts[-2],parts[-1])
            self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Cache-Control','private, no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
        if path=='/api/marketplace/slots' and not post:
            return self.send_json(marketplace_store.slots(auth_path,u,query.get('tutor',[''])[0],query.get('date',[''])[0],query.get('duration',['60'])[0],query.get('subject',[''])[0],query.get('method',['Online'])[0]))
        if path.startswith('/api/marketplace/download/') and not post:
            resource=marketplace_store.resource(auth_path,u,path.rsplit('/',1)[-1],True);raw=resource['content']
            self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Disposition',"attachment; filename*=UTF-8''"+quote(resource['filename']));self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','private, no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
        if path=='/api/marketplace/import' and post:
            d=self.read_json();resource=marketplace_store.resource(auth_path,u,d.get('listing'))
            if resource['format']=='pdf':raise ValueError('This resource is PDF-only. Download it; it is not editable rich text.')
            content=resource['content'].decode('utf-8');source='Imported from Marketplace · Seller: '+resource['seller_name']+' · Acquired: '+resource['acquired_at']+' · Version '+str(resource['version'])
            content+=('<hr><p>'+escape(source)+'</p>') if resource['format']=='html' else '\n\n---\n'+source
            with connect() as con:
                key='market-'+str(d.get('listing'))+'-v'+str(resource['version'])
                if con.execute('SELECT 1 FROM notes WHERE id=?',(key,)).fetchone():raise ValueError('This version is already imported. Open its copy in your Notes Library.')
                notes_store.save(con,{'id':key,'subject_id':d.get('subject_id'),'topic_name':d.get('topic_name'),'week':d.get('week'),'title':resource['title'],'content':content,'content_format':resource['format'],'tags':['Marketplace']})
            return self.send_json({'ok':True,'id':key})
        if path=='/api/marketplace/calendar' and post:
            from zoneinfo import ZoneInfo
            d=self.read_json()
            with accounts.db(auth_path) as con:b=marketplace_store.booking(con,d.get('booking'),u)
            if b['status']!='confirmed':raise ValueError('Only a confirmed session can be added to your timetable.')
            tz=ZoneInfo(d.get('timezone') or b['data']['timezone']);start=marketplace_store.utc(b['start_at']).astimezone(tz);end=marketplace_store.utc(b['end_at']).astimezone(tz)
            if start.date()!=end.date():raise ValueError('This session crosses midnight in your timezone. Add the parts manually in Timetable.')
            event=calendar_store.validate({'id':'market-booking-'+b['id'],'title':b['data']['subject']+' Tutoring','event_date':str(start.date()),'start_time':start.strftime('%H:%M'),'end_time':end.strftime('%H:%M'),'recurrence':'none','event_type':'study','location':b['data']['method'],'color':'#6d4df4'})
            with connect() as con:
                if con.execute('SELECT 1 FROM timetable_events WHERE id=?',(event['id'],)).fetchone():raise ValueError('This booking is already in your timetable.')
                calendar_store.write(con,event)
            return self.send_json({'ok':True})
        return self.send_json({'error':'Unknown Marketplace route.'},404)

    def account_route(self,path,post,auth_path,user):
        if path=='/api/auth/profile' and post:
            accounts.update_profile(auth_path,user,self.read_json());return self.send_json({'ok':True})
        if path=='/api/auth/sessions' and not post:
            with accounts.db(auth_path) as con:rows=[{**dict(r),'current':r['token_hash']==accounts.digest(self.cookie_token())} for r in con.execute('SELECT token_hash,created_at,last_seen,agent FROM sessions WHERE user_id=? AND expires>? AND last_seen>?',(user['id'],int(time.time()),int(time.time())-43200))]
            for r in rows:r.pop('token_hash')
            return self.send_json({'ok':True,'sessions':rows})
        if path=='/api/auth/revoke' and post:
            with accounts.db(auth_path) as con:con.execute('DELETE FROM sessions WHERE user_id=? AND token_hash<>?',(user['id'],accounts.digest(self.cookie_token())))
            return self.send_json({'ok':True})
        if path.startswith('/api/admin/'):
            if user['role']!='admin':return self.send_json({'ok':False,'error':'Administrator access required.'},403)
            if path=='/api/admin/users' and not post:
                with accounts.db(auth_path) as con:rows=[accounts.public(accounts.unpack(r)) for r in con.execute('SELECT * FROM users ORDER BY created_at')]
                return self.send_json({'ok':True,'users':rows})
            if path=='/api/admin/users' and post:
                return self.send_json({'ok':True,'id':accounts.create_user(auth_path,self.read_json())})
            if path=='/api/admin/manage' and post:
                values=self.read_json();target=values.get('id')
                if target in ('admin',user['id']):raise ValueError('The original admin and your own account cannot be disabled or reset here. Use Change password for your account.')
                with accounts.db(auth_path) as con:
                    if not con.execute('SELECT 1 FROM users WHERE id=?',(target,)).fetchone():raise ValueError('Account not found.')
                    if values.get('action')=='reset_password':con.execute('UPDATE users SET password=?,must_change=1 WHERE id=?',(accounts.password_hash(values.get('password')),target))
                    elif values.get('action')=='disable':con.execute('UPDATE users SET disabled=1 WHERE id=?',(target,))
                    elif values.get('action')=='enable':con.execute('UPDATE users SET disabled=0 WHERE id=?',(target,))
                    else:raise ValueError('Unknown account action.')
                    con.execute('DELETE FROM sessions WHERE user_id=?',(target,))
                return self.send_json({'ok':True})
        return self.send_json({'ok':False,'error':'Not found'},404)

    def send_json(self, obj, status=200):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length<0 or length>20*1024*1024:raise ValueError('Request is too large.')
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def stream_ai_chat(self, payload):
        payload=self.assistant_payload(payload)
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

        def emit(event):
            self.wfile.write((json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8"))
            self.wfile.flush()

        try:
            emit({"type": "started"})
            result = ai_provider.chat(payload.get("messages"), payload.get("image"), payload.get("context"), emit)
            emit({"type": "result", **result})
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # Browser left; closing the upstream request cancels generation.
        except Exception as exc:
            try:
                emit({"type": "error", "error": str(exc)})
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

    def is_loopback_request(self):
        # Localhost is a first-class supported origin.  LAN access is optional,
        # not a requirement for persistence.
        return False

    def _get(self):
        path = urlparse(self.path).path
        if path=='/api/assistant/capabilities':return self.send_json(assistant_catalog.catalogue())
        if path in ('/frontend/assistant/assistant-actions.js','/frontend/assistant/assistant-actions.css'):
            file=ROOT/path.lstrip('/');raw=file.read_bytes();self.send_response(200);self.send_header('Content-Type','text/javascript; charset=utf-8' if path.endswith('.js') else 'text/css; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
        if path in ("/", "/index.html") and self.is_loopback_request():
            self.send_response(302)
            self.send_header("Location", self.server.public_url)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/api/state":
            return self.send_json(export_state())
        if path == "/api/health":
            return self.send_json({"ok": True, "database": str(DB_PATH.name)})
        if path == "/api/portal":
            result=portal_state();result['settings']['display_name']=self.user['display_name'];return self.send_json(result)
        if path == '/api/gym':
            with connect() as con: return self.send_json(gym_store.state(con))
        if path == '/api/general-todos':
            with connect() as con: return self.send_json(general_todos.state(con))
        if path == '/api/finance':
            try:
                from urllib.parse import parse_qs
                anchor=parse_qs(urlparse(self.path).query).get('date',[None])[0]
                with connect() as con: return self.send_json(finance_store.state(con,anchor))
            except ValueError as exc: return self.send_json({'error':str(exc)},status=400)
        if path == '/api/study-progress':
            from urllib.parse import parse_qs
            query=parse_qs(urlparse(self.path).query)
            try:
                with connect() as con:
                    result=progress_service.report(con,query.get('subject',[''])[0],query.get('topic',[None])[0]);result['quick_review']=quick_review_store.metrics(con,query.get('subject',[None])[0] or None,query.get('topic',[None])[0]);
                    for item in result.get('topics',[]):item['quick_review']=quick_review_store.metrics(con,query.get('subject',[None])[0] or None,item['topic'])
                    return self.send_json(result)
            except ValueError as exc: return self.send_json({'error':str(exc)},status=400)
        if path == "/api/ai/status":
            return self.send_json(ai_provider.status())
        if path.startswith('/api/notes/images/'):
            if not note_document.IMAGE.fullmatch(path):return self.send_error(404)
            image=database_path().parent/'note_uploads'/path.rsplit('/',1)[-1]
            if not image.is_file():return self.send_error(404)
            data=image.read_bytes();self.send_response(200)
            self.send_header('Content-Type',mimetypes.guess_type(image.name)[0]);self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Cache-Control','private, no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
        if path in ('/frontend/study/quick-review.js','/frontend/study/quick-review.css','/frontend/marketplace/marketplace.js','/frontend/marketplace/marketplace.css','/frontend/social/social.js','/frontend/social/social.css','/frontend/study/note-editor.js','/frontend/study/note-editor.css','/frontend/planner/general-todos.js','/frontend/planner/general-todos.css','/frontend/finance/finance.js','/frontend/finance/finance.css','/frontend/study/study-progress.js','/frontend/study/study-progress.css'):
            data=(ROOT/path.lstrip('/')).read_bytes();self.send_response(200)
            self.send_header('Content-Type','text/javascript; charset=utf-8' if path.endswith('.js') else 'text/css; charset=utf-8')
            self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
        if path in ('/frontend/planner/calendar.js', '/frontend/planner/calendar.css', '/frontend/planner/week-popup.js', '/frontend/planner/week-popup.css', '/frontend/planner/reminders.js', '/frontend/dashboard/dashboard.js', '/frontend/dashboard/dashboard.css', '/frontend/assistant/tutor.js', '/frontend/assistant/tutor.css', '/frontend/study/notes.js', '/frontend/study/notes.css', '/frontend/gym/gym.js', '/frontend/gym/gym-journey.js', '/frontend/gym/gym.css', '/frontend/gym/gym-rules.js'):
            data = (ROOT / path.lstrip('/')).read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8' if path.endswith('.js') else 'text/css; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/api/backup":
            # SQLite online backup produces a consistent snapshot, scoped to
            # the authenticated workspace. It never includes the accounts DB.
            import tempfile
            with tempfile.TemporaryDirectory() as tmp:
                dest=Path(tmp)/'backup.db'
                with connect() as source:
                    target=sqlite3.connect(dest)
                    try:source.backup(target)
                    finally:target.close()
                data=dest.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", "attachment; filename=student-helper-backup.db")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path in ("/", "/index.html"):
            html=INDEX_PATH.read_text(encoding='utf-8')
            html=html.replace('<head>','<head>\n<meta name="portal-account" content="'+self.user['id']+'">')
            data=html.encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_error(404, "Not found")

    def _post(self):
        path = urlparse(self.path).path
        try:
            if self.is_loopback_request():
                return self.send_json({
                    "ok": False,
                    "error": "Localhost saves are disabled. Use the LAN address shown by START_WINDOWS.bat.",
                }, status=403)
            if path=='/api/assistant/prepare':
                try:
                    with connect() as con:result=assistant_actions.prepare(con,self.read_json())
                    return self.send_json(result)
                except (ValueError,sqlite3.IntegrityError) as exc:return self.send_json({'ok':False,'error':str(exc)},400)
            if path=='/api/assistant/execute':
                try:
                    result=assistant_actions.execute(connect,self.read_json(),self.server.accounts_path,self.user['id'])
                    return self.send_json(result)
                except (ValueError,sqlite3.IntegrityError) as exc:return self.send_json({'ok':False,'error':str(exc)},400)
            if path == "/api/state":
                saved = import_state(self.read_json())
                return self.send_json({"ok": True, "saved": saved})
            if path == "/api/reset":
                reset_db()
                return self.send_json({"ok": True})
            if path == "/api/portal":
                return self.send_json(save_portal(self.read_json()))
            if path == '/api/gym':
                payload=self.read_json()
                try:
                    with connect() as con: result=gym_store.write(con,payload)
                    return self.send_json(result)
                except (ValueError, sqlite3.IntegrityError) as exc:
                    return self.send_json({'ok':False,'error':str(exc)},status=400)
            if path == '/api/general-todos':
                try:
                    with connect() as con: result=general_todos.write(con,self.read_json())
                    return self.send_json(result)
                except (ValueError, sqlite3.IntegrityError) as exc:
                    return self.send_json({'ok':False,'error':str(exc)},status=400)
            if path == '/api/finance':
                try:
                    with connect() as con: result=finance_store.write(con,self.read_json())
                    return self.send_json(result)
                except (ValueError, sqlite3.IntegrityError) as exc:
                    return self.send_json({'ok':False,'error':str(exc)},status=400)
            if path == '/api/finance/rates':
                try:
                    with connect() as con:
                        profile=finance_store.profile(con)
                        if not profile['enabled']: raise ValueError('Enable Finance first.')
                    snapshot=currency_provider.get_latest_rates(profile['currency'])
                    with connect() as con: finance_store.store_rates(con,snapshot)
                    return self.send_json({'ok':True})
                except ValueError as exc: return self.send_json({'ok':False,'error':str(exc)},status=400)
            if path == "/api/portal/delete":
                return self.send_json(delete_portal(self.read_json()))
            if path == '/api/calendar/import':
                items = self.read_json().get('events')
                if not isinstance(items, list) or not items or len(items) > 200:
                    raise ValueError('Import between 1 and 200 events.')
                events = [calendar_store.validate(item) for item in items]
                with connect() as con:
                    for item in events:
                        calendar_store.write(con, item)
                return self.send_json({'ok': True, 'count': len(events)})
            if path == '/api/reminders/import':
                rows = reminders_store.expand(self.read_json().get('drafts'))
                with connect() as con:
                    for row in rows:
                        reminders_store.write(con, row, create_only=True)
                return self.send_json({'ok': True, 'count': len(rows)})
            if path == '/api/notes/import':
                notes = self.read_json().get('notes')
                if not isinstance(notes, list) or not 1 <= len(notes) <= 20:
                    raise ValueError('Review between 1 and 20 notes.')
                for note in notes:
                    if not isinstance(note, dict) or not note.get('id') or not isinstance(note.get('title'), str) or not note['title'].strip() or not isinstance(note.get('content'), str) or not note['content'].strip():
                        raise ValueError('Every note needs an id, title and content.')
                    if len(note['title']) > 300 or len(note['content']) > 100000:
                        raise ValueError('This note is too long. Split it into smaller notes.')
                with connect() as con:
                    con.execute('BEGIN IMMEDIATE')
                    for note in notes:
                        notes_store.save(con,note,create_only=True)
                return self.send_json({'ok':True,'count':len(notes)})
            if path == '/api/notes/upload':
                return self.send_json({'ok':True,'url':note_document.upload(database_path().parent/'note_uploads',self.read_json())})
            if path == '/api/notes/studied':
                payload=self.read_json()
                with connect() as con:
                    result=con.execute('UPDATE notes SET last_studied_at=? WHERE id=? AND subject_id=?',(notes_store.now(),payload.get('id'),payload.get('subject_id')))
                    if result.rowcount!=1:raise ValueError('This note does not belong to the selected subject.')
                return self.send_json({'ok':True})
            if path == '/api/ai/note-study':
                payload=self.read_json()
                with connect() as con:
                    note=con.execute('SELECT notes.*,subjects.name AS subject FROM notes LEFT JOIN subjects ON subjects.id=notes.subject_id WHERE notes.id=? AND notes.subject_id=?',(payload.get('id'),payload.get('subject_id'))).fetchone()
                    if not note:raise ValueError('Choose a note in this subject first.')
                note=dict(note)
                if note.get('content_format')=='html':note['content']=note_document.plain(note['content'])
                return self.send_json(ai_provider.note_study(note,payload.get('kind')))
            if path == "/api/ai/timetable-image":
                payload = self.read_json()
                return self.send_json(ai_provider.extract_timetable(payload.get("image", "")))
            if path == "/api/ai/chat":
                payload = self.assistant_payload(self.read_json())
                return self.send_json(ai_provider.chat(payload.get("messages"), payload.get("image"), payload.get("context")))
            if path == "/api/ai/chat/stream":
                return self.stream_ai_chat(self.read_json())
            self.send_error(404, "Not found")
        except Exception as exc:
            print("API error:", repr(exc))
            self.send_json({"ok": False, "error": str(exc)}, status=500)

    def assistant_payload(self,payload):
        if not isinstance(payload,dict):raise ValueError('Invalid chat request.')
        supplied=payload.get('context') or {}
        if not isinstance(supplied,dict):raise ValueError('Invalid chat context.')
        with connect() as con:
            app=assistant_actions.context(con,payload.get('messages'),self.server.accounts_path,self.user['id'])
        return {**payload,'context':{**supplied,'app':app}}

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Student Helper Portal local server")
    parser.add_argument("--port", type=int, help="Listen on a specific port")
    parser.add_argument("--no-browser", action="store_true", help="Do not open another browser tab")
    args = parser.parse_args()
    init_db()
    auth_path=DB_PATH.parent/'accounts.db'
    current_name=portal_state()['settings'].get('display_name') or 'Admin'
    accounts.initialize(auth_path,admin_name=current_name)
    port = args.port if args.port else choose_port()
    phone_urls = [f"http://{address}:{port}/" for address in lan_addresses()]
    # Use the same LAN origin on this PC and mobile devices. This avoids keeping
    # separate 127.0.0.1 and 192.168.x.x browser-storage namespaces.
    url = phone_urls[0] if phone_urls else f"http://127.0.0.1:{port}/"
    httpd = ThreadingHTTPServer((HOST, port), Handler)
    httpd.accounts_path=auth_path
    httpd.public_url = url
    cleanup_stop=task_cleanup.start(DB_PATH)

    print()
    print("==============================================")
    print(" Student Helper Portal - Local SQLite Edition")
    print("==============================================")
    print(f" PC:       http://127.0.0.1:{port}/")
    print(f" App:      {url}")
    print(f" Database: {DB_PATH}")
    print()
    if phone_urls:
        print(" Phone (same Wi-Fi):")
        for phone_url in phone_urls:
            print(f"   {phone_url}")
    else:
        print(" Phone: Run ipconfig and use http://YOUR-WIFI-IP:%s/" % port)
    print()
    print("Keep this window open while using QuizPrep.")
    print("If Windows Firewall asks, allow Python on Private networks.")
    print("Press Ctrl+C to stop the local server.")
    print()

    if not args.no_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping QuizPrep...")
    finally:
        cleanup_stop.set()
        httpd.server_close()

if __name__ == "__main__":
    main()
