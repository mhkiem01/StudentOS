# How I Built This App — A Beginner's Build Journal

> This is the story of how this project grew from a tiny quiz page into a full
> **Student Helper Portal**: quizzes, notes, a timetable that reads photos with
> AI, a talking tutor, finance planning, a gym coach, a social space and a
> marketplace.
>
> It is written for **someone who is just starting to code**. Every step says:
> **what I built**, **what I used**, **what I learned**, and — where it matters —
> **the actual code and what each line does**. Read it top to bottom like a
> diary, or jump to any phase.

---

## 📌 How to read this file

- **Phases** are in the order things actually happened. Each phase builds on the
  one before it.
- Look for these tags inside each phase:
  - **🎯 What I built** — the feature, in one line.
  - **🧰 What I used** — the tools/words involved.
  - **🧠 What I learned** — the coding ideas, explained simply.
  - **💻 The real code** — a snippet from *this* project, with a plain-English
    explanation of every important line.
- **New words** are explained the first time they appear, and collected again in
  the [Glossary](#-glossary-plain-english-dictionary) at the bottom.
- You do **not** need to understand everything at once. Beginners re-read. That
  is normal.

---

## 🤖 IMPORTANT — Keep this file alive (instruction for Claude Code / Codex / any AI helper)

**Every time you (an AI assistant) add a feature, change something, or fix a bug
in this project, you must also update THIS file (`HOW_I_BUILT_THIS.md`) in the
same session, before you finish.** This is a standing instruction from the owner.

Follow these rules:

1. **If you added or changed a feature** → add a short dated bullet under
   [🗓️ Change Log](#️-change-log-newest-at-the-top) at the top of the log, and,
   if it is something genuinely new, add a **"What we learned"** note explaining
   the new idea in beginner language (and a tiny code snippet if it teaches
   something).
2. **If you fixed a bug/error** → add a bullet under the Change Log that says:
   **what broke**, **why it broke**, and **what we learned so it does not happen
   again**. Errors are lessons — always capture the lesson.
3. **If you built something that is not fully finished** → note it under
   [🚧 Not finished yet / ideas](#-not-finished-yet--ideas-for-later) and write
   what still needs to be learned or done.
4. Keep the beginner tone. Short bullets. Explain new words. Show real code when
   it helps.
5. Do not delete old history. This file is a learning record; it only grows.

*(This same instruction is mirrored in `CLAUDE.md` and `AGENTS.md` so whichever
assistant is used will see it.)*

---

## 🧭 The big picture (what the whole app is made of)

Before the story, here is the "map". Do not worry if words are new — they are
all explained later.

- **The front end** = what you see in the browser. Built with plain
  **HTML** (structure), **CSS** (looks) and **JavaScript** (behaviour). No big
  framework like React — just the basics, so it is easy to learn from.
- **The back end** = the program running on the computer that stores data and
  answers the browser. Built in **Python**, using only Python's built-in tools
  (no Flask, no Django). The file is [`server.py`](server.py).
- **The database** = where data is saved so it survives closing the browser.
  We use **SQLite**, a tiny database that lives in a single file
  (`data/quizprep.db`).
- **The AI** = reads timetable photos, acts as a voice tutor, reviews answers.
  It uses **Ollama** (AI running on your own laptop, free & private) and can
  also use free cloud AI (Groq, OpenRouter, Gemini) when you add a key.
- **Tests** = small programs that check the app still works after every change,
  so we do not break things by accident.

```
Your browser  <--HTTP-->  server.py (Python)  <-->  SQLite file (your data)
  (HTML/CSS/JS)                   |
                                  +-->  Ollama / cloud AI (optional)
```

---

# PART 1 — THE FOUNDATIONS

---

## Phase 0 — The very first thing: a quiz

**🎯 What I built:** A simple page where you pick a **subject** (e.g. "Computing"),
open a **topic** inside it, and answer **multiple-choice questions**. Each question
has choices, one correct answer, and an explanation. The app tracks how many you
got right (your accuracy).

**🧰 What I used:** HTML + CSS + JavaScript in the browser.

**🧠 What I learned (the absolute basics):**

- **HTML** is the *skeleton* of a page. It is made of **tags** like
  `<button>Click me</button>`. Tags describe *what* things are (a button, a
  heading, a list).
- **CSS** is the *paint and layout*. It says "make buttons purple, round the
  corners, add space". Example: `button { background: #7953f5; border-radius: 8px; }`.
- **JavaScript (JS)** is the *behaviour*. It reacts when you click, shows the next
  question, checks your answer. It is the only one of the three that can "think".
- A **variable** stores a value: `let score = 0;`.
- A **function** is a named block of steps you can run again and again:
  `function checkAnswer() { ... }`.
- An **array** is a list: `["A", "B", "C", "D"]`.
- An **object** is a labelled bundle of values:
  `{ question: "What is 2+2?", correct: "B" }`.

**💻 The idea in code (simplified from the quiz logic):**

```javascript
// A single quiz question is just an object with labelled fields.
const question = {
  prompt: "What does MIPS 'lb' do?",
  choices: ["Store a byte", "Load a byte", "Loop back", "Logical AND"],
  correct: 1,                 // the index (0,1,2,3) of the right choice
  explain: "lb = Load Byte, reads one byte from memory into a register."
};

// When the user clicks a choice, compare it to the correct index.
function answer(chosenIndex) {
  if (chosenIndex === question.correct) {
    score = score + 1;        // right! add to the score
  }
  show(question.explain);     // always show why
}
```

- `const question = {...}` makes a bundle holding everything about one question.
- `===` means "exactly equal". We compare the clicked choice to the correct one.
- `score = score + 1` adds one point.

**Why this matters:** every later feature — notes, finance, gym — is the same
idea repeated: *store data in objects, show it with HTML, change it with JS*.

---

## Phase 1 — Making it a real app with a server and a database

A plain web page forgets everything when you close it. To **remember** data
(your subjects, questions, scores) I needed two new things: a **server** and a
**database**.

**🎯 What I built:** A Python program ([`server.py`](server.py)) that runs on the
computer, hands the web page to the browser, and saves/loads data from a database
file.

**🧰 What I used:** **Python** (the back-end language) and **SQLite** (the
database). Importantly: *only Python's built-in libraries* — nothing extra to
install. Starting the app is just `python server.py`.

**🧠 What I learned:**

- **Client vs server.** The *client* is the browser (what you see). The *server*
  is the always-running program that stores the real data. They talk over
  **HTTP**.
- **HTTP requests.** The browser asks the server for things. Two main kinds:
  - **GET** = "give me something" (e.g. "give me my subjects").
  - **POST** = "here is some data, save it" (e.g. "save this new question").
- **API** = the list of "web addresses" the server understands, like
  `/api/deep-practice`. The browser calls these; the server answers with
  **JSON**.
- **JSON** = a text format for sending objects/lists between browser and server.
  It looks just like a JS object: `{"score": 5, "subject": "Computing"}`.
- **Database** = organised storage. **SQLite** keeps the whole database in one
  file, so there is no separate database program to install.
- **SQL** = the language you use to talk to a database:
  `SELECT`, `INSERT`, `UPDATE`, `DELETE` (read, add, change, remove).

**💻 The real code — opening the database safely:**

From [`server.py`](server.py):

```python
from contextlib import contextmanager
import sqlite3

@contextmanager
def connect():
    con = sqlite3.connect(database_path(), timeout=20)
    con.row_factory = sqlite3.Row          # rows act like dictionaries: row["name"]
    con.execute("PRAGMA foreign_keys = ON") # enforce links between tables
    try:
        with con:                           # auto-commit if ok, auto-rollback on error
            yield con
        con.close()
```

What each part does:

- `sqlite3.connect(...)` opens the database file.
- `row_factory = sqlite3.Row` lets us read a column by name, like
  `row["title"]`, instead of by number. Much easier to read.
- `PRAGMA foreign_keys = ON` turns on **foreign keys** — rules that keep data
  tidy (e.g. a question must belong to a real topic; delete the topic and its
  questions go too).
- `with con:` is a safety net: if everything works, the changes are **committed**
  (saved); if the code crashes, they are **rolled back** (undone) so the database
  is never left half-updated. This idea is called a **transaction**.
- `@contextmanager` + `yield` let other code write `with connect() as con:` and
  know the database will always be closed properly afterwards, even on error.

**💻 The real code — answering the browser in JSON:**

```python
def send_json(self, obj, status=200):
    payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    self.send_response(status)                 # 200 = OK, 400 = you sent bad data, 404 = not found
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(payload)))
    self.send_header("Cache-Control", "no-store")
    self.end_headers()
    self.wfile.write(payload)                   # actually send the bytes
```

- `json.dumps(obj)` turns a Python object into JSON text.
- `.encode("utf-8")` turns text into **bytes** (what the network actually sends).
- **Status codes** are the server's way of saying how it went: `200` = success,
  `400` = "your request was wrong", `404` = "not found", `500` = "I crashed".

**💻 The real code — reading what the browser sent:**

```python
def read_json(self):
    length = int(self.headers.get("Content-Length", "0"))
    if length < 0 or length > 20*1024*1024:      # refuse anything over 20 MB
        raise ValueError('Request is too large.')
    raw = self.rfile.read(length) if length else b"{}"
    return json.loads(raw.decode("utf-8"))        # JSON text -> Python object
```

- We **check the size first**. Never trust incoming data blindly — a huge request
  could crash the server. This is a first taste of **security thinking**.
- `json.loads(...)` is the reverse of `json.dumps(...)`: text → object.

**The pattern repeated everywhere:** a feature sends JSON to a web address, the
server reads it, talks to the database, and sends JSON back. For example the
Deep Practice route is just:

```python
if path == '/api/deep-practice':
    with connect() as con:
        result = deep_practice.write(con, self.read_json()) if post else deep_practice.state(con)
    return self.send_json(result)
```

Read it in English: *"If the browser asked for `/api/deep-practice`: open the
database; if it was a POST, save what they sent; if it was a GET, fetch the
current state; send the answer back as JSON."*

---

## Phase 2 — A homepage with accounts (login, passwords, privacy)

Once data was saved, the next problem: **whose data is it?** If a friend opens
the app on the same laptop, they should not see my notes. So I added **accounts**.

**🎯 What I built:** A login page. Each person signs in and gets their **own
private workspace** (their own database file). A home **dashboard** greets you
and shows your week.

**🧰 What I used:** Python's `hashlib`, `hmac`, `secrets` (all built in) for
safe passwords and login sessions.

**🧠 What I learned (this part is where security starts to matter):**

- **Never store passwords as plain text.** If the file leaked, everyone's
  password would be exposed. Instead store a **hash**.
- **Hashing** = turning a password into a scrambled string that **cannot be
  reversed**. To check a login, you hash what they typed and compare the
  scrambled versions.
- **Salt** = a random string mixed into each password before hashing, so two
  people with the same password get different hashes, and pre-made "cracking"
  tables do not work.
- **PBKDF2 with many iterations** = deliberately doing the hashing hundreds of
  thousands of times so it is slow to guess passwords by brute force.
- **Session token** = after you log in, the server gives your browser a long
  random secret "ticket". Your browser shows the ticket on each request so you
  do not retype your password every time. The server stores only a *hash* of the
  ticket, never the ticket itself.
- **Authentication** (who are you?) vs **authorization** (what are you allowed to
  do?).

**💻 The real code — password hashing** (from
[`backend/accounts/accounts.py`](backend/accounts/accounts.py)):

```python
import hashlib, hmac, secrets

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)          # random salt if none given
    return salt + ':' + hashlib.pbkdf2_hmac(
        'sha256', password.encode(), bytes.fromhex(salt), 600000
    ).hex()                                        # 600,000 rounds = slow on purpose

def verify(password, stored):
    salt, _ = stored.split(':', 1)
    return hmac.compare_digest(password_hash(password, salt), stored)
```

- `secrets.token_hex(16)` makes a random salt. `secrets` is designed for
  security (unlike the ordinary `random`, which is predictable).
- `pbkdf2_hmac('sha256', ..., 600000)` hashes the password 600,000 times. Slow
  for an attacker, unnoticeable for one honest login.
- We store `salt:hash` together so we can re-hash the typed password the same way
  later.
- `hmac.compare_digest(...)` compares the two hashes in a way that does not leak
  timing hints to an attacker — a subtle but real security detail.

**💻 The real code — issuing a login session:**

```python
token = secrets.token_urlsafe(32)                 # the secret ticket for the browser
con.execute('INSERT INTO sessions VALUES(?,?,?,?,?,?)',
            (digest(token), user['id'], now+604800, now, now, str(agent)[:200]))
return public(user), token                         # 604800 seconds = 7 days
```

- We save `digest(token)` (a **SHA-256 hash** of the ticket), *not* the ticket.
  So even if someone read the database, they could not log in as you.
- `?` placeholders (**parameterised query**) are how you safely put values into
  SQL. **Never** glue user text straight into a query — that causes
  **SQL injection**, a classic hack. The `?` lets SQLite handle it safely.

**💻 Private workspaces** — each account gets its own database file, so data is
isolated. The server picks the right file per request using a variable that only
lives for that request:

```python
workspace = workspace_path(auth_path, user['id'])  # this user's own database file
token = REQUEST_DB.set(workspace)                   # use it for just this request
try:
    ...                                             # all database work here is private
finally:
    REQUEST_DB.reset(token)                         # tidy up afterwards
```

**🧠 The lesson:** *One user must never see another user's data.* We get that for
free by giving everyone a separate database file and always checking the login
first.

**The dashboard homepage** ([`frontend/dashboard/dashboard.js`](frontend/dashboard/dashboard.js))
then shows a weekly grid of your classes and reminders — the first "nice
interface" instead of a bare list.

---

# PART 2 — ADDING AI

---

## Phase 3 — The timetable: from typing it in, to scanning a photo

**🎯 What I built (step 1 — manual):** A **calendar/timetable** where you type
your classes: title, day, start/end time, location. Saved to the database, shown
as a weekly grid.

**🎯 What I built (step 2 — AI photo import):** Instead of typing every class,
you upload a **photo of your timetable** and the AI reads it and fills the
calendar for you.

**🧰 What I used:**

- For manual entry: the same front-end + Python + SQLite pattern as everything
  else.
- For the photo: a **vision AI model** — `qwen3-vl:8b` running locally in
  **Ollama**. "VL" means **Vision-Language**: it can look at an image *and*
  understand text instructions.

**🧠 What I learned:**

- **A Large Language Model (LLM)** is an AI that predicts text. A **vision LLM**
  can also take images as input.
- **Ollama** is a free program that runs these AI models **on your own laptop**.
  Nothing leaves your computer — private and no cost.
- Images are sent to AI as **base64** — a way to write a picture's bytes as plain
  text so it fits inside a JSON message.
- **Structured output / JSON mode.** By default AI replies in chatty sentences.
  That is hard for a program to use. You can *force* the AI to reply as strict
  JSON that matches a shape you define (a **schema**). Then your code can read it
  reliably.
- **Prompt design** = writing clear instructions so the AI returns exactly what
  you need.

**💻 The real code — asking the AI to read the timetable image** (from
[`backend/assistant/ai_provider.py`](backend/assistant/ai_provider.py)):

```python
def extract_timetable(image_data_url):
    if not image_data_url.startswith("data:image/") or "," not in image_data_url:
        raise ValueError("Please upload a PNG, JPG, or WebP timetable image.")
    header, encoded = image_data_url.split(",", 1)   # split off the base64 part
    base64.b64decode(encoded, validate=True)         # check it is real base64 first

    response = _ollama_chat({
        "model": cfg["model"],
        "stream": False,
        "format": "json",                            # <-- force a JSON answer
        "messages": [{
            "role": "user",
            "content": TIMETABLE_PROMPT,             # the instructions
            "images": [encoded],                     # the photo, as base64
        }],
    })
    return _json_from_text(response.get("message", {}).get("content", ""))
```

- The browser sends the picture as a **data URL** that looks like
  `data:image/png;base64,iVBORw0KGgo...`. We split off the `iVBOR...` part (the
  base64) and **validate** it before trusting it.
- `"format": "json"` is the magic switch that makes the model reply in strict
  JSON instead of a paragraph.
- `"images": [encoded]` is how the vision model receives the picture.

**💻 The prompt that shapes the answer** (what we ask for):

```python
TIMETABLE_PROMPT = """Read this university timetable image. Extract every class or study event.
..."""
# And we tell it the exact JSON shape we want back, e.g.:
# {"type":"timetable_import","events":[
#    {"title":"...","day":0,"start_time":"09:00","end_time":"10:00",
#     "location":"...","event_type":"Lecture","confidence":"high"} ]}
# day is 0=Monday .. 6=Sunday, times are HH:MM (24-hour).
```

- We spell out the field names, that `day` is a number 0–6, and the time format.
  Being this specific is what makes the result usable by code.
- We also ask the AI for a **confidence** value, so if it is unsure about a class
  we can flag it to the user instead of pretending it is correct.

**🧠 The big lessons from this phase:**

- AI output is only useful to a program if it is **structured** (JSON) and
  **validated** (checked before use).
- **Validate untrusted input** (the uploaded file) *before* doing anything with
  it — same security habit as Phase 1.
- Running AI **locally** (Ollama) keeps private data private and costs nothing.

---

## Phase 4 — A study assistant and a talking "Jarvis" tutor

**🎯 What I built:**

1. A **chat assistant** that answers questions *about your own notes and
   quizzes* — not the whole internet. Ask "what does `lb` do in MIPS?" and it
   answers from your MIPS notes.
2. A **Voice Tutor**: you *talk*, it *talks back*. Pick a subject/topic and it
   quizzes you out loud; you answer "A", "B", "C", "D" by voice; it says correct
   or explains why not.

**🧰 What I used:**

- The browser's built-in **Speech Recognition** (voice → text) and
  **Speech Synthesis** (text → voice). No paid service needed.
- Ollama locally, **plus** optional free cloud models.
- A **model router** ([`backend/assistant/llm_router.py`](backend/assistant/llm_router.py))
  with its settings in [`ai_models.json`](ai_models.json).

**🧠 What I learned:**

- **"Agentic" / multi-model thinking.** Different jobs suit different AIs. Rather
  than one model for everything, each *job* ("role") has an ordered list of
  models to try. This is the idea behind the router.
- **Fallback chains.** If the first model fails (offline, rate-limited, or gives
  bad JSON), automatically try the next one. The app keeps working even when one
  provider is down.
- **API keys and `.env`.** Cloud AI needs a secret **API key**. Secrets must
  **never** be committed to Git. We keep them in a `.env` file that is listed in
  `.gitignore` (so Git ignores it).
- **Free providers exist** (Groq, OpenRouter, some Gemini tiers). The app runs
  fully free on Ollama, and *upgrades itself* the moment you add a key — no code
  change needed.
- **OpenAI-compatible APIs.** Many providers copy the same request format, so one
  piece of code can talk to several of them just by changing the web address.

**💻 The real code — choosing which models to try** (from
[`llm_router.py`](backend/assistant/llm_router.py)):

```python
def chain(role, config=None):
    """The steps for `role` that are usable right now (their key, if any, is set)."""
    config = config or load_config()
    providers = config.get('providers', {})
    steps = []
    for step in config.get('roles', {}).get(role, []):
        provider = providers.get(step.get('provider'))
        if not provider or not step.get('model'):
            continue
        # Skip a cloud model whose API key is not set -> graceful, no crash.
        if provider.get('api_key_env') and not os.getenv(provider['api_key_env']):
            continue
        steps.append({**provider, 'name': step['provider'],
                      'model': step['model'], 'options': step.get('options', {})})
    return steps
```

- A **"role"** is a job like `voice_answer` or `ctf_review`.
- We read an ordered list of models for that role from `ai_models.json`.
- If a cloud model needs a key and the key is missing, we **skip it** instead of
  crashing. So the same config works offline and online.

**💻 The settings file it reads** ([`ai_models.json`](ai_models.json), safe to
commit — it holds **no secrets**):

```json
{
  "providers": {
    "local":  { "type": "ollama" },
    "groq":   { "type": "openai_compatible",
                "base_url": "https://api.groq.com/openai/v1",
                "api_key_env": "GROQ_API_KEY" }
  },
  "roles": {
    "voice_answer": [
      { "provider": "groq",  "model": "openai/gpt-oss-120b" },
      { "provider": "local", "model": "qwen2.5:7b" }
    ]
  }
}
```

- `api_key_env` only names *where* to find the key (an environment variable). The
  key itself lives in the git-ignored `.env`. **The secret and the settings are
  kept apart on purpose.**
- The list under `voice_answer` is the fallback order: try Groq's big model
  first; if it is unavailable, fall back to the local model.

**🧠 The lessons:**

- **Design for failure.** Networks and free tiers fail; a fallback chain keeps
  the app usable.
- **Keep secrets out of code and out of Git.** `.env` + `.gitignore`.
- **Separate configuration from secrets.** One file you can share, one you never
  share.

---

# PART 3 — THE STUDY TOOLS GET SERIOUS

---

## Phase 5 — Notes (and making them pleasant to read)

**🎯 What I built, in waves:**

- A **notes editor** per topic, with headings, lists, and **code blocks** (for
  pasting code with a monospace font).
- Fixes for readability: when code text and background were the same colour you
  could not read it — so I added controls to **change text size and colour**.
- A **Book View**: read a long note like a book, full-screen, instead of
  scrolling forever.
- **Pages**: the note is split into fixed pages (page 1 fits this much, page 2
  the next), tied to Book View.
- **Live note sharing**: share a note to a friend through Messages; they can view
  it, save a copy, and see your edits live; they can ask for permission to edit.

**🧰 What I used:** HTML/CSS/JS for the editor and the book/page view; the server
+ SQLite to store notes; a careful **"escape everything"** approach when showing
text.

**🧠 What I learned:**

- **XSS (Cross-Site Scripting).** If you take text a user wrote and drop it
  straight into the page, they could sneak in `<script>` code that runs in
  someone else's browser. The fix is to **escape** special characters so they
  show as text, never run as code.
- **Rendering vs storing.** We **store** the original text safely, and when we
  **show** it we convert it to safe HTML (bold, lists, code) with everything
  escaped first.
- **Access control for sharing.** A shared note stays in the *owner's* workspace;
  friends reach it only through a **share** that says "view" or "edit". That is
  **authorization** again.

**💻 The real code — the escape helper used all over the front end** (e.g.
[`frontend/dashboard/dashboard.js`](frontend/dashboard/dashboard.js)):

```javascript
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
```

- It replaces dangerous characters (`<`, `>`, `&`, quotes) with their safe
  "entity" versions. So `<script>` becomes the harmless text `&lt;script&gt;`.
- `s ?? ''` means "if `s` is missing (null/undefined), use an empty string
  instead" — avoids crashes on empty values.
- This tiny function is one of the most important security tools in the whole
  app, and it is used *everywhere* text is shown.

**💻 The pattern every front-end module follows** (so new features look the same):

```javascript
(function (global) {           // wrap everything so our names don't leak out
  'use strict';                // stricter, safer JavaScript rules
  function create(options) {   // build this feature; options = links to the rest of the app
    // ... set up the HTML, buttons, and event handlers here ...
    return { onShow, canLeave };   // the app calls onShow when you open the page
  }
  global.StudentNotes = { create };   // publish it so index.html can use it
})(window);
```

- This is called the **module pattern** (or IIFE — *Immediately Invoked Function
  Expression*). It keeps each feature's code in its own "bubble" so features do
  not accidentally clash.
- `canLeave` lets a page say "wait, you have unsaved work" before you navigate
  away — a small touch that prevents lost work.

---

## Phase 6 — The quizzes grow up (many quizzes, timer, reshuffle, Deep Practice, CTF)

The original quiz was one quiz per topic, multiple-choice, counting up. Over time
it became a proper practice system.

**🎯 What I built (each is its own small lesson):**

- **Many quizzes per topic**, and a **Quizzes tab** that lists quizzes only (no
  notes/flashcards mixed in).
- **Countdown timer**: set, say, 30 minutes and watch it count *down* to 0
  (instead of counting up).
- **Reshuffle button**: randomise the order of questions when you start, so you
  are not just memorising positions.
- **Deep Practice** (big one): open-response practice — recall, explain, fill in
  the blank, trace code output, find & fix bugs, write code from a spec. You
  **attempt first, then reveal** the worked solution. See
  [`docs/DEEP_PRACTICE.md`](docs/DEEP_PRACTICE.md).
- **CTF practice** for the cybersecurity subject (COMP6447): paste an AI-generated
  challenge, solve it, submit the real flag; an AI can review your exploit code.
  See [`docs/CTF_PRACTICE.md`](docs/CTF_PRACTICE.md).

**🧠 What I learned:**

- **Shuffling an array** fairly (the Fisher–Yates idea): walk from the end,
  swapping each item with a random earlier one. This avoids a subtly biased
  shuffle that beginners often write by accident.
- **Timers in the browser** with `setInterval` (do something every second) and
  always `clearInterval` when done, or it keeps ticking in the background.
- **Parsing a document into data.** Deep Practice reads a Markdown workbook and
  turns it into questions and answers automatically. Reading messy text and
  pulling out structure is a hugely useful skill (and surprisingly hard — a lot
  of the work was handling edge cases without losing any content).
- **Match by ID, not by position.** When pairing each question with its answer,
  match on a stable ID (`P1-001`) — never on "the 3rd answer goes with the 3rd
  question", which breaks the moment something is reordered.
- **Never pretend.** Open answers and code are **never auto-graded or run** — the
  app shows you the worked solution and *you* judge yourself. We do not fake
  feedback or claim code was executed. Being honest about what software can and
  cannot do is part of good engineering.

**💻 The idea — a fair shuffle (what "reshuffle" does under the hood):**

```javascript
function shuffle(items) {
  const a = items.slice();              // copy, so we don't wreck the original
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // pick a random earlier slot
    [a[i], a[j]] = [a[j], a[i]];        // swap the two items
  }
  return a;
}
```

- `items.slice()` copies the list first (don't mutate data you were given).
- The loop swaps each item with a random earlier one. This is the
  **Fisher–Yates shuffle** — provably fair, every order equally likely.
- `[a[i], a[j]] = [a[j], a[i]]` is a neat JS trick to swap two values in one line.

---

# PART 4 — THE "WHOLE STUDENT LIFE" FEATURES

These phases turned a study app into a full student portal. Each reuses the same
foundation (Python route → SQLite → JSON → front-end module), so the *pattern*
below is the real lesson; the features are variations on it.

**The repeating recipe for any new feature:**
1. A **store** file in `backend/<feature>/` with a `migrate()` that creates its
   database tables, plus functions to read/write data (with validation).
2. A **route** in `server.py` that connects a web address to that store.
3. A **front-end module** in `frontend/<feature>/` (the `create()` pattern) for
   the screen.
4. **Tests** in `tests/<feature>/`.

---

## Phase 7 — Planner: calendar, reminders, to-dos

**🎯 What I built:** The weekly calendar (from Phase 3), plus **reminders** (due
dates) and **general to-dos**, all shown on the dashboard.

**🧠 What I learned:**

- **Working with dates and times** is fiddly: time zones, "which day is Monday",
  turning `09:30` into a pixel position on a grid. Helper functions
  (`minutes(t)`, `monday(date)`) keep this sane.
- **Deriving views from data**: the week grid is *calculated* from your events
  every time it is drawn, not stored as a picture. Store the facts; compute the
  display.

---

## Phase 8 — Finance: a money planner, not just a list

**🎯 What I built, over several requests:**

- Record money **in and out**, see your **balance** and **transaction history**
  (like a bank app).
- **Planning**: how much do I need to earn each week to hit a goal? If I pay all
  my bills next week, how much is left?
- An **Expenses section**: what I need to pay and **when**, amounts shown in
  **red with a minus**, a **total**, and a period picker (**this week / this
  month / next month**).
- A **Reset button** to clear the finance data and start over.

**🧠 What I learned:**

- **Money must never be a floating-point guess.** Store amounts carefully and
  format them consistently; small rounding errors are unacceptable with money.
- **Filtering by time period** (this week vs this month) = comparing each item's
  date against a start/end range you compute from "today".
- **Colour and sign communicate meaning**: red + minus instantly says "money
  going out". Good UI speaks without words — but never by colour *alone* (for
  accessibility we also use the minus sign and labels).
- **Destructive actions need a confirm.** "Reset" wipes data, so it asks first —
  you should never be one accidental click from losing everything.

---

## Phase 9 — Gym coach: tracking, muscle coverage, a real plan with XP

**🎯 What I built, over several requests:**

- **Weekly workout tracking**, checking you do **more than last week**, and which
  **muscle groups** you have/haven't hit this week.
- An **exercise library** split into **machine** vs **own-weight (bodyweight)**
  exercises, searchable, covering common gym equipment.
- A beginner-friendly **onboarding questionnaire** (goals, gym vs home,
  equipment, days/time, experience) that then builds a **plan**: the exact
  workouts to do, suggested nutrients, and an **XP / levelling system** where
  **discipline** (doing it consistently) levels you up faster than skipping days.
- Small **icons/pictures** so you can see what each exercise is.

**🧠 What I learned:**

- **A multi-step form (a "wizard")**: ask one thing at a time, remember the
  answers, then act on all of them. Far friendlier than one giant form. (This
  came straight from the feedback that the first version had *low learnability* —
  a term from **HCI**, Human-Computer Interaction: how easy something is to learn
  on first use.)
- **Turning rules into numbers**: "discipline → faster levelling" means designing
  a small formula and storing streaks/dates to drive it.
- **Storing flexible data as JSON in SQLite**: a workout snapshot can be saved as
  a JSON blob in one column, while the things we query a lot (like individual
  sets) get their own columns and foreign keys. Choosing which is which is a real
  design decision.

**💻 The real code — safe number checking** (from
[`backend/gym/gym_store.py`](backend/gym/gym_store.py)), a good habit for any
input:

```python
def number(value, name, low=0, high=10000):
    if isinstance(value, bool):                      # True/False are sneaky "numbers" in Python
        raise ValueError(name + ' must be a number.')
    try:
        value = float(value)
    except (ValueError, TypeError):
        raise ValueError(name + ' must be a number.')
    if not math.isfinite(value) or not low <= value <= high:  # block NaN, infinity, silly values
        raise ValueError(f'{name} must be between {low} and {high}.')
    return value
```

- **Validate every input.** Reject text, `True/False`, `NaN`, infinity, and
  out-of-range values *before* saving. Bad data in a database causes mysterious
  bugs later; stop it at the door.

---

## Phase 10 — Socialise: clubs, chat, calls, and a project board

**🎯 What I built, over several requests:**

- Clubs/communities and messaging.
- A **Discord-style** idea: group **rooms**, **room calls**, **video + screen
  share**, and a shared spot to drop **YouTube links** that play in the chat.
- **Projects & Assignments**, redesigned: first **choose or create a project**,
  then click it to see everything; a **drag-and-drop task board** (drag a task to
  change its status); a **task log** (who created a task, who changed its status,
  who finished it); reorder things; a friendly "student vibe" look.

**🧠 What I learned:**

- **Drag and drop** in the browser (drag events, and the detail that a plain
  click must still work while dragging is enabled).
- **An activity log / audit trail**: record *who did what and when* as a list of
  events. Great for accountability and for "undo-style" history.
- **Ordering items** the user can rearrange: store an explicit position number
  per item, and renumber on reorder (so the order survives a reload).
- **Real-time calls (WebRTC)** are genuinely advanced; the safe approach was to
  build the structure (rooms, links) and keep private sharing **behind
  permission checks**.

---

## Phase 11 — Marketplace: selling notes, with previews

**🎯 What I built:** A marketplace where students list items (including **notes**),
with a **cart**, **messages**, **updates**, and a cleaner header/toolbar. Notes
can show a **limited preview** (a few pages the seller chooses) before buying;
demo data was added so it is not empty.

**🧠 What I learned:**

- **Optional dependencies**: previewing PDF pages needs extra libraries
  (`pypdfium2`, `Pillow`). The app is built so the base portal needs **nothing
  extra**, and the marketplace just does more *if* those are installed. Don't
  force every user to install things they may not use.
- **Server-side limits**: the preview must be enforced **on the server** — you
  can't trust the browser to "only show 3 pages", because a determined user could
  ask for more. **Trust boundaries** live on the server.
- **Demo/seed data** makes a new feature testable and reviewable instead of a sad
  empty screen.

---

# PART 5 — MAKING IT LOOK GOOD, STAY WORKING, AND GO ONLINE

---

## Phase 12 — From "basic interface" to "nice interface"

**🎯 What I built:** Repeated UI upgrades — a solid, professional **navbar** with
a dropdown, a redesigned **settings** page, a consistent icon set, a calm
student-friendly colour scheme, and **dark/light mode** support.

**🧠 What I learned:**

- **CSS variables (design tokens).** Define colours once
  (`--accent: #7953f5;`) and reuse them everywhere. Change the token → the whole
  app restyles. This is how dark mode works too.
- **Reusable SVG icons.** Icons are drawn with `<svg>` paths kept in one place and
  reused, so every module's sidebar looks the same. (See the `paths` object and
  `PortalIcon` in [`dashboard.js`](frontend/dashboard/dashboard.js).)
- **Design is iterative.** The navbar was redone several times based on feedback
  ("make it solid, not scrollable", "bring the dropdown arrow back"). Getting
  feedback and trying again *is* the process — first drafts are rarely final.
- **Accessibility**: don't rely on colour alone; label things; make sure it works
  on a phone screen (a **responsive** layout that reflows at small widths).

**💻 The idea — one icon function, used everywhere:**

```javascript
const icon = n =>
  `<svg class="ui-icon icon-${n}" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.8" aria-hidden="true">
     <path d="${paths[n] || paths.spark}"/>
   </svg>`;
global.PortalIcon = icon;   // shared with marketplace, gym, finance, socialise sidebars
```

- `stroke="currentColor"` means the icon takes the colour of the surrounding
  text, so it automatically matches dark/light mode. A small trick, big payoff.
- `aria-hidden="true"` hides the decorative icon from screen readers — an
  **accessibility** habit.

---

## Phase 13 — Testing: how I stop new changes from breaking old features

**🎯 What I built:** A growing set of **tests** that run after changes.

**🧰 What I used:** Python's built-in `unittest`, small **Node.js** checks for the
JavaScript, and **browser automation** that drives a real Chrome/Edge to click
through the app.

**🧠 What I learned:**

- **Automated tests** = little programs that use the app and shout if the result
  is wrong. They let you change code confidently.
- **Unit test** = checks one small piece (e.g. "does `number()` reject the word
  'cat'?"). **Browser test** = checks a whole screen end-to-end.
- **Test with a throwaway database** so tests never touch your real data.
- **Regression testing** = re-running all tests after every change to catch
  things you *accidentally* broke (a "regression").
- Run them with `python tests/support/run_tests.py` (add `--browser`,
  `--dashboard`, `--notes`, etc.).

**🧠 The habit this builds:** *change something small → run the tests → see green
→ move on.* This single habit is what separates hobby code from reliable code.

---

## Phase 14 — Getting it onto other devices (safely)

**🎯 What I built / figured out:** Using the app on your **phone and other
devices**, not just the laptop it runs on.

**🧰 What I used:** The server listens on the network; **Tailscale** creates a
private link between your devices so you can reach the app from anywhere — without
exposing it to the whole internet.

**🧠 What I learned:**

- **localhost vs LAN vs internet.** `localhost` = this machine only; the **LAN**
  address (like `192.168.1.25:8765`) = other devices on the same Wi-Fi;
  **Tailscale** = your own private network across the world.
- **HTTP is not encrypted.** Fine on trusted private Wi-Fi / Tailscale; you must
  add **HTTPS** before any public exposure. Knowing this limit is part of being
  responsible.
- **Microphone needs a secure context**, so the Voice Tutor works on `localhost`
  (and would need HTTPS to work over a plain network address).
- **Deploying is a real topic of its own** (we looked at Vercel/Render and
  Postgres). The key insight: a laptop-only SQLite app and a cloud-hosted app
  have different needs; we deliberately stayed local-first for privacy and zero
  cost.

---

## Phase 15 — Using Git & GitHub without leaking secrets

**🎯 What I built / learned:** Putting the project on **GitHub** safely.

**🧠 What I learned:**

- **Git** = a time machine for code: it records **commits** (snapshots) so you can
  go back, and branches so you can try things.
- **GitHub** = a website that hosts your Git history online, for backup and
  sharing.
- **`.gitignore`** lists files Git must **never** track. Ours ignores `data/`
  (your database!), `backups/`, `.env` (secrets), and generated junk like
  `__pycache__/`. **This is what keeps passwords and private data off GitHub.**
- **Golden rule:** before pushing, be sure no secret (API key, password, database)
  is going with it. Once something is pushed publicly, treat it as leaked forever.

---

# 🧩 The mental model (what ties every phase together)

If you remember only one thing, remember this loop — every feature in this app is
built from it:

1. **Browser** shows a screen (HTML + CSS) and reacts to clicks (JS).
2. On an action, JS **sends JSON** to a web address (`fetch('/api/...')`).
3. **`server.py`** receives it, checks **who you are** (login), and routes it to
   the right **store**.
4. The **store** **validates** the data and reads/writes **SQLite**.
5. The server **sends JSON back**; the JS updates the screen.
6. **Tests** prove the whole loop still works.

Everything else — AI, finance, gym, chat — is this same loop with different data.

---

# 🗓️ Change Log (newest at the top)

- **2026-10-26 - COMP1521 workbook prepared for Deep Practice:** Added `artifacts/deep-practice/COMP1521_Deep_Practice_Import.md`, preserving all 98 exercises and their worked solutions. Converted IDs to CP-001 through CP-098, separated topic headings from question metadata, and used the importer's recognised answer and checklist labels. Added a paste/import guide and kept the limitations about unavailable starter files. The actual importer reports complete: 98 matched answers, 11 valid multiple-choice keys, 8 checklist items, and no issues; original fenced code blocks are unchanged. **What we learned:** a readable Markdown heading still needs to follow the importer's expected pattern so the app can tell a topic, a question and a solution apart. Validation details are in `artifacts/deep-practice/import-validation.json`.

> **AI helpers: add a dated entry here for every change. See the instruction near
> the top of this file.** Format:
> `- YYYY-MM-DD — [Added/Changed/Fixed] <what>. **What we learned:** <lesson>.`

- **2026-10-27 — Added** hosting on **Render** with a persistent disk
  (`render.yaml`, guide in `docs/DEPLOY_RENDER.md`).
  - **Why not Vercel:** Vercel runs short-lived *functions* on a disk that's wiped
    between requests. This app is one long-running server that keeps its data in
    SQLite *files*, so on Vercel only the page design appeared (`/api/health` →
    404) and nothing could be saved. Render runs the server as-is, and a
    **persistent disk** keeps the files.
  - **What changed in the code:** the same code now runs on a laptop *and*
    online, decided by **environment variables** (settings the host passes to the
    program):

    ```python
    HOSTED_DATA = os.environ.get("STUDENTOS_DATA")      # e.g. /var/data, the disk
    DB_DIR = Path(HOSTED_DATA) if HOSTED_DATA else ROOT / "data"
    port = args.port or (int(os.environ["PORT"]) if os.environ.get("PORT") else choose_port())
    ```

    - `PORTAL_HTTPS=1` makes sign-in cookies HTTPS-only.
    - `PORTAL_TRUST_PROXY=1` counts failed sign-ins per *visitor*. Behind
      Render's proxy, every request looks like it comes from the proxy, so one
      person's wrong guesses could otherwise lock everybody out.
  - **Moving the data:** `tools/restore_data.py` copies the laptop's `data/` onto
    the disk with SQLite's own **backup API**. That's safe even while the server
    runs; copying database files directly can corrupt them.
  - **Caught by the tests:**
    - The server's startup messages were missing when it wasn't printing to a
      terminal: Python **buffers** output, so Render's logs would have stayed
      empty. Fixed with `PYTHONUNBUFFERED=1`.
    - Render runs **Linux**, where `Study.js` and `study.js` are different
      files. A check confirmed that all 51 files the app links to match their
      names exactly.
  - **What we learned:**
    - Pick a host that fits the app's shape: *serverless* (Vercel) suits
      stateless code, while a long-running server with files needs a server host
      with a disk.
    - Configure with environment variables, so one codebase runs anywhere and
      secrets stay out of the code.

- **2026-10-27 — Fixed** "this page isn't working (HTTP 502)" when moving the app to
  another laptop. *(This corrects the entry below: `100.82.101.10` is the iPad, not
  the new host.)*
  - **What broke:** two things.
    - The browser opened `msi.tail16ed60.ts.net`. That's the old laptop's
      `tailscale serve` link, which forwards to the app *on the old laptop*, and
      it was no longer running. **502 Bad Gateway** means "the link works, but
      nothing answers behind it".
    - The new laptop wasn't on the Tailscale network at all, and the address
      typed into `START_ANYWHERE.bat` was the iPad's.
  - **Fix:** `START_ANYWHERE.bat` now asks Tailscale for the laptop's own address
    (`tailscale ip -4`) every time it starts. If Tailscale isn't running, it says
    so instead of showing a wrong link.
  - **What we learned:**
    - `tailscale status` lists every device and its 100.x address; check it
      before guessing.
    - Don't hard-code something the computer can look up itself: a hard-coded
      address goes stale as soon as the app moves.

- **2026-10-27 — Fixed** the unit tests failing on GitHub (they passed on the laptop).
  - **What broke:** 4 marketplace tests crashed with "No time zone found with key
    Australia/Sydney".
  - **Why:** tutor booking times use named time zones (`ZoneInfo('Australia/Sydney')`).
    Linux and macOS have a time-zone database built in; **Windows doesn't**, so
    Python needs the `tzdata` package. The laptop had it installed long ago, so the
    tests passed there; GitHub's fresh Python didn't, so they crashed. A fresh
    Windows laptop (like the new host at `100.82.101.10`) would have hit the same
    error, with a misleading message ("Use a valid IANA timezone").
  - **Fix:** `tzdata` added to `requirements-marketplace.txt` (CI installs it), and
    the app now says exactly what's missing and how to install it. A test checks
    that message.
  - **How it was found:** GitHub logs need a login, so CI was reproduced locally
    instead:
    - a fresh clone (only committed files: no `.env`, no `data/`);
    - a brand-new Python virtual environment;
    - the time zone set to UTC, like GitHub's machines;
    - no Ollama.

    The same 4 errors appeared at once.
  - **What we learned:** "works on my machine" often means "my machine has
    something installed that I forgot about". CI's clean computer is the most
    honest test of what the app *really* needs. A **virtual environment**
    (`python -m venv`) is a clean, separate Python for exactly this kind of
    check.

- **2026-10-27 — Changed** the Tailscale address printed by `START_ANYWHERE.bat` to
  `100.82.101.10` (the laptop that now runs the app).
  **What we learned:** the server listens on `0.0.0.0`, which means "every network
  this computer is on", so it already answers on any address the computer has
  (Wi-Fi, Tailscale…). The address in the `.bat` file is only a reminder printed
  on screen; moving to another laptop needs no code change.

- **2026-10-27 — Added** **CI/CD with GitHub Actions** (`.github/workflows/`).
  - **CI (continuous integration)** = every time code is pushed to GitHub, a fresh
    computer in the cloud downloads it and runs all the tests. A green ✓ on GitHub
    means everything still works; a red ✗ shows exactly which test broke.
  - **CD (continuous delivery)** = when you tag a version (`git tag v1.0.0`, then
    `git push origin v1.0.0`), the tests run again and, if they pass, GitHub
    publishes a **Release** with a ready-to-run zip of the app.
  - **What a workflow file looks like** (a recipe GitHub follows):

    ```yaml
    on:
      push:                         # when to run: every push...
        branches: [main, master]
      pull_request:                 # ...and every pull request
    jobs:
      checks:
        runs-on: windows-latest     # a fresh Windows computer
        steps:
          - uses: actions/checkout@v5          # download the code
          - uses: actions/setup-python@v6      # install Python
            with: {python-version: '3.13'}
          - run: python tests/support/run_tests.py   # run the tests
    ```

  - **Safety first:** the first CI step fails if any private files (`data/`,
    `backups/`, databases, `.env`) or API keys are committed. The release zip is
    made with `git archive`, which only includes committed files, so your data
    can't end up in a download.
  - **Speed:** the browser tests run as 9 jobs **in parallel** (a "matrix")
    instead of one long queue, and each keeps its screenshots for a week so a
    failure can be seen, not just read about.
  - **What we learned:**
    - **YAML gotcha:** in `{ name: Finance, planner and navigation }` the commas
      split the value, and the name became just "Finance". Put quotes around
      values that contain commas. I caught it by loading the file with a YAML
      parser before pushing.
    - **Only committed files are tested.** CI sees what's on GitHub, not what's
      on your laptop, so new files must be committed or CI fails.
    - **Don't add tests to CI that already fail.** Every browser suite was run
      locally first, so CI starts green. Doing that found an old test that hung
      forever: it clicked "New chat", which asks "Start a new chat?" in a pop-up,
      and nothing answered it. **Fixed** by making the test accept pop-ups, like
      the other browser tests do.
    - **Fixed:** the first push to GitHub failed instantly with **0 jobs**.
      - *Why:* the workflow set `TEMP: ${{ runner.temp }}` for the whole job, but
        the `runner` value only exists *inside steps*, so GitHub rejected the
        file before running anything.
      - *Fix:* set it on the step that runs the tests.
      - *Lesson:* each `${{ … }}` value is only available in certain places in a
        workflow. A failed run with 0 jobs almost always means the workflow file
        itself is invalid, not that a test failed.

- **2026-10-27 — Added** **handwriting pages** in notes, CollaNote-style
  (✎ Handwriting button, or ＋ Handwriting page in Quick Insert).
  - **What it does:**
    - You choose **which page** it becomes. The note is split exactly where that
      page starts, even mid-paragraph. In an empty note it simply becomes page 1.
    - You pick the paper: blank, lined, narrow lined, grid, dotted, Cornell or
      music, in white, cream, yellow or dark.
    - Tools:
      - **pen** (thicker when you press harder with a stylus), **pencil**
        (grainy), **marker** and **highlighter** (see-through, stays under your
        writing);
      - an **eraser** that removes whole strokes or just the part you rub;
      - a **lasso** to move, copy, recolour or delete strokes;
      - **shapes** (line, arrow, box, circle);
      - a **ruler** you can move and turn, which straightens any line drawn
        along its edge.
    - Every tool has its own colour and size, and there's undo/redo, zoom
      (pinch or Ctrl + scroll), and a stylus mode where fingers scroll instead
      of drawing (palm rejection).
    - The page shows up in page view, Book View and PDF exports; click it to
      keep writing.
  - **How it's built (beginner view):**
    - **Pointer events** (`pointerdown` / `pointermove` / `pointerup`) give one
      kind of event for a mouse, a finger or a stylus; `event.pressure` tells
      how hard a stylus presses, and `event.pointerType` says which one it is.
    - A stroke is just a list of points `[x, y, pressure]`. The pen's outline is
      worked out from those points, wider where the pressure was higher, and
      drawn on a `<canvas>` while you write.
    - Saving turns the strokes into compact text and the page into an **SVG**
      picture (vector graphics, so it stays sharp when zoomed or printed):

      ```text
      v1 grid white|p 1d1d1f 24 400,480,50 4,-2,3 6,1,-2
      ```

      → "paper: grid, white; a pen stroke, colour #1d1d1f, size 2.4, starting at
      (100, 120) with pressure 0.5, then each next point as a small change".
      Storing *changes* instead of full positions keeps a full page small.
    - The handwriting is saved in **its own file** (like a picture); the note
      only holds `<figure data-ink="id">`. That keeps notes under the 100,000
      character limit, and undo, autosave and live sharing all keep working.
  - **What went wrong on the way (and the fixes):**
    1. *My first plan was to put the strokes inside the note* — but one full
       page is about 50–100 KB, and notes are capped at 100,000 characters. →
       Separate files, like images. **Lesson:** check the limits *before*
       designing.
    2. *After adding a page, a 4-page note became 43 pages* and the handwriting
       landed on page 40. The picture was a block-level image, and those refuse
       to sit beside a float — the invisible page-break float from earlier. So
       it was pushed below every page. → The picture is now positioned over its
       frame (`position: absolute`), outside the text flow. **Lesson:** a fix
       for one feature (the float) can surprise another; test them together.
    3. *The stroke count read wrong after a lasso delete* (the screen-reader
       label was updated before the strokes changed). **Lesson:** update what
       you show *after* the data changes, not before.
    4. *The `\b` and `\u` problem again:* backslashes in my edit scripts were
       read as special characters. → I built them with `chr(92)`. **Lesson:**
       when code writes code, escape characters are a classic trap.
  - **What we learned:**
    - **Test with real input.** The browser tests send real stylus strokes with
      pressure (through the browser's developer protocol), not fake events.
    - **Security for user files:** the server checks every saved page against
      the exact stored form, ids are random 32-letter names (no `../` tricks),
      and friends can only read a shared note's pages through the share, and
      only save them with edit permission.

- **2026-10-26 — Added** **Export PDF** for notes (••• More → 📄 Export PDF, or
  the **⬇ PDF** button in Book View). It exports exactly what you see:
  - **Pages** — one page after another, like Word and page view;
  - **Book** — two pages side by side on each sheet, like Book View;
  - in dark mode you can also pick **Dark (as on screen)** or **Light paper**.
  - **How it works:** a web page can't write PDF files by itself, but every
    browser can *print*, and "Save as PDF" is a printer. So we build a hidden
    print-only copy of the note and call `window.print()`. Special CSS tells the
    printer the page size and margins:

    ```css
    @page {
      size: 720px 880px;                 /* the same size as the pages on screen */
      margin: 64px 64px 72px;            /* top, sides, bottom — the same margins */
      @bottom-center { content: counter(page); }   /* page number in the margin */
    }
    @media print { body > :not(.notebook-print) { display: none; } }  /* print only the note */
    ```

  - **What went wrong on the way (and the fixes):**
    1. *Letting the printer choose the page breaks* gave 84 pages for an 82-page
       note: its rules are slightly different from ours. → We **cut the note
       ourselves** exactly where page view breaks it, and put a forced page break
       (`break-after: page`) after each piece.
    2. *The page-break float doesn't survive printing* (the printer splits the
       note into pages its own way and the float's shape is lost). → Cutting the
       note into page-sized pieces means the float isn't needed when printing.
    3. *Cutting with the browser's `Range.cloneContents()`* left **empty copies**
       of a code block at the bottom of a page (its padding made the page too
       tall), and dropped the `<ol>` around list items when a page fell inside a
       long list (the numbers vanished). → Cut *before* a block that starts a
       page, and wrap each piece back in the blocks it sits inside, with
       `<ol start="24">` so numbering continues.
    4. *A paragraph's space-after at the bottom of a page* pushed the last block
       onto an extra page. → The last block on each page loses its space-after.
    5. *Two-column printing* ignored the page breaks for Book layout. → Each book
       sheet is now an explicit row of two pages.
  - **What we learned:**
    - **Reuse what the platform already does:** the browser's print engine is a
      free, high-quality PDF maker with real, selectable text.
    - **Make it match, then prove it matches:** a test script compares the first
      words of every PDF page with the same page in the editor (82 of 82 match).
      "Looks about right" is not a test.
    - **Edge cases are where the bugs live:** lists, code blocks, and blocks that
      start exactly at a page break all needed their own fix.
    - **Keep invisible characters visible in code.** The editor uses a
      zero-width space (an invisible character) as a placeholder. Typing the
      real character into source code makes the code look empty; writing the
      escape `\u200B` keeps it readable.

- **2026-10-26 — Fixed** note text sitting *between* pages in page view, and
  **added** Microsoft Word–style formatting to the note editor.
  - **What broke:** in page view, some lines of a long Mandarin note were drawn in
    the grey gap between two pages, or across a page number.
  - **Why it broke (two reasons):**
    - The old page layout only moved *whole blocks* (a whole paragraph) to the next
      page. It never split a paragraph, and it only looked at top-level blocks, so
      paragraphs tucked inside a `<span>` or inside a big heading were never moved.
    - Those `<span>`s came from a second bug: the old **Size** button wrapped the
      whole selection in one `<span>`. Select three paragraphs, pick "Small", and
      you got `<span><h3>…</h3><p>…</p></span>` — a span (an *inline* tag, meant
      for a few words) holding whole paragraphs.
  - **The fix — let the browser do the hard part:** instead of measuring and moving
    every line ourselves, we put one invisible **float** at the top of the note and
    give it a **`shape-outside`**: a shape made of bands that cover each page's
    bottom margin, the gap, and the next page's top margin. Text always flows
    *around* a float, so any line that would land in a band is pushed down to the
    next page automatically — even while you type. The note's HTML is never changed.

    ```css
    .notebook-document::before {
      content: '';
      float: right; width: 100%;               /* an invisible box as wide as the page */
      height: var(--page-float);               /* as tall as all the pages */
      shape-outside: var(--page-shape);        /* polygon(...) bands over every page break */
    }
    ```

    The JavaScript only builds the polygon (one band per page break) and sets it as
    a CSS variable. Then a few "keep" rules polish it like Word: a heading moves
    with the text under it, short code blocks and callouts are not split, and a
    paragraph never leaves just **one** line alone at the bottom (an *orphan*) or
    the top (a *widow*) of a page.
  - **The other fix:** font size, colour and letter spacing now style **each run of
    text separately**, so a span never wraps a paragraph again.
  - **Added (Word-style controls):**
    - a font-size box in **points** (type `10.5` and press Enter, or pick from 8–72),
      plus **A⁺ / A⁻** grow/shrink buttons (Ctrl+Shift+> / <, Ctrl+] / [);
    - **Line spacing** 1.0 / 1.15 / 1.5 / 2.0 / 2.5 / 3.0, and **Line spacing
      options…** for exact spacing plus space before/after a paragraph;
    - **Letter spacing**: condensed or expanded by 0.5–3 pt, or a custom amount;
    - the editor's own **undo history**, so all of these undo with Ctrl+Z.
  - **What we learned:**
    - **Test with real, messy data.** The tidy test note always passed; the user's
      real 82-page note (pasted text, headings wrapping paragraphs) showed the bug.
    - **Look for what the platform already does.** "Push lines past an area" is
      exactly what CSS floats do, so a few lines of CSS replaced a lot of fragile
      measuring code — and it keeps working while you type.
    - **Points vs pixels:** Word sizes are in *points* (1 pt = 1/72 inch). On screen
      1 pt = 1.333 px, so 12 pt = 16 px. Word's "single" line spacing is about 1.2 ×
      the font size, so picking **1.0** sets `line-height: 1.2`.
    - **Check styles on both sides.** The browser and the server each have an
      **allow-list** of safe styles (`safeStyle` in `note-editor.js`,
      `safe_style` in `backend/study/note_document.py`). A new style must be added
      to *both*, or the server silently drops it on save. Never trust the browser
      alone.
    - **Inline vs block:** `<span>` is for a few words *inside* a line; `<p>`,
      `<h1>` and `<div>` are blocks. Putting blocks inside a span is invalid HTML
      that causes strange layout later.
    - **Undo is just snapshots:** save a copy of the note (and where the cursor
      was) after each change; Ctrl+Z puts the previous copy back. Typing is
      grouped into one step by waiting for a short pause (a **debounce**).

- **2026-10-25 — Added** this build journal (`HOW_I_BUILT_THIS.md`), plus
  `CLAUDE.md` and `AGENTS.md` so any AI helper keeps it updated.
  **What we learned:** a project is easier to understand (and to learn from) when
  its *history and reasoning* are written down, not just its code. Documentation
  is a feature.

### Earlier milestones (reconstructed from the project history)

*(These happened before the change log existed, listed oldest → newest.)*

- **Added** the core quiz (subjects → topics → multiple-choice questions, scoring).
- **Added** the Python server + SQLite database so data is saved between sessions.
- **Added** accounts, password hashing, login sessions and private per-user
  workspaces; a dashboard homepage with a weekly timetable.
- **Added** a manual calendar/timetable, reminders and to-dos.
- **Added** AI **photo import** of timetables (Ollama vision model → JSON events).
- **Added** the study chat assistant and the **Voice Tutor**, with a multi-model
  **router** and fallback chain (`ai_models.json` + `.env`).
- **Added** notes with code blocks; **fixed** unreadable same-colour code text by
  adding text size/colour controls. **What we learned:** always check real
  contrast; a feature that technically works but can't be read is still broken.
- **Added** note **Book View** and fixed **pages**; **added** live note sharing.
- **Added** multiple quizzes per topic, a quizzes-only tab, a **countdown timer**,
  and a **reshuffle** button (Fisher–Yates shuffle).
- **Added** **Deep Practice** open-response quizzes (import from Markdown, attempt
  → reveal, honest self-assessment, never auto-run code).
- **Added** **CTF practice** for the cybersecurity subject (paste challenge,
  submit real flag, optional AI code review).
- **Added** Finance: transactions, balance, history, planning, an **expenses**
  section (red/minus/total/period picker) and a **reset** button with confirm.
- **Added** Gym: weekly tracking, muscle coverage, machine/own-weight exercise
  library, onboarding wizard, plan, and an XP/discipline levelling system.
- **Added** Socialise: clubs, chat, room calls/screen-share structure, and a
  redesigned **Projects & Assignments** board (drag-and-drop status, task log,
  reordering).
- **Added** Marketplace: selling notes with seller-chosen page previews, cart,
  messages, a cleaner header, and demo data.
- **Changed** the UI repeatedly: solid navbar + dropdown, redesigned settings,
  shared icons, dark/light mode, responsive/phone layout.
- **Added** tests (Python `unittest`, Node checks, browser automation) and made
  remote access work via **Tailscale**; set up Git/GitHub with a strict
  `.gitignore` to keep secrets and data private.

---

# 🚧 Not finished yet / ideas for later

> **AI helpers: when you build something partial, record here what's left and
> what still needs to be learned.**

- **Real-time calls (WebRTC)**: the room/chat structure exists, but full
  peer-to-peer video/screen-share needs a signalling server and more networking
  knowledge. *To learn:* WebRTC, STUN/TURN servers.
- **HTTPS for public access**: required before exposing the app beyond trusted
  private networks. *To learn:* TLS certificates, reverse proxies.
- **Auto-grading open answers / running code**: deliberately **not** done — we
  never fake feedback or run student code. A real version would need a secure
  **sandbox**. *To learn:* safe code execution, sandboxing.
- **Cloud deployment** (Vercel/Render + Postgres): explored, not adopted; the app
  is local-first on purpose. *To learn:* managed databases, environment config,
  migrations.

---

# 📖 Glossary (plain-English dictionary)

- **API** — the set of web addresses the server understands (e.g.
  `/api/deep-practice`). The browser calls them to get or save data.
- **Array** — an ordered list of values: `["A","B","C"]`.
- **Authentication** — proving *who you are* (logging in).
- **Authorization** — deciding *what you're allowed to do* (view vs edit).
- **Back end** — the program on the computer (here, Python) that stores data and
  answers the browser.
- **Base64** — a way to write binary data (like an image) as plain text so it fits
  in JSON.
- **Commit** — a saved snapshot of your code in Git.
- **CSS** — the language that styles the page (colours, spacing, layout).
- **CSS variable / design token** — a named colour or size defined once and reused.
- **Database** — organised, saved storage. We use **SQLite** (a single file).
- **Debounce** — waiting until something stops happening (e.g. typing pauses)
  before reacting, instead of reacting to every single keystroke.
- **`.env`** — a file holding secret keys; never committed to Git.
- **Escape (HTML)** — converting `<`, `>`, `&`, quotes into safe text so user
  input can't run as code (prevents **XSS**).
- **Fallback chain** — a list of options to try in order until one works.
- **Fisher–Yates shuffle** — the correct, fair way to randomise a list.
- **Float / `shape-outside`** — a CSS float is a box that text flows *around*;
  `shape-outside` gives it a custom shape. We use an invisible one shaped like the
  page breaks, so text skips over them.
- **Foreign key** — a database rule linking one table to another (keeps data
  consistent).
- **Framework** — a big pre-made toolkit (React, Flask…). We mostly avoided these
  to keep the code beginner-readable.
- **Front end** — what you see and interact with in the browser.
- **Function** — a named, reusable block of steps.
- **Git / GitHub** — version control (code time machine) / the site that hosts it.
- **`.gitignore`** — the list of files Git must never track (data, secrets).
- **HCI** — Human-Computer Interaction; how usable/learnable a design is.
- **HTML** — the language that structures the page (headings, buttons, lists).
- **HTTP** — the rules browsers and servers use to talk. **GET** = fetch,
  **POST** = send/save.
- **Hashing** — one-way scrambling (used for passwords); can't be reversed.
- **IIFE / module pattern** — wrapping code in `(function(){...})()` so its names
  stay private.
- **Inline vs block element** — inline tags (`<span>`, `<b>`) sit inside a line of
  text; block tags (`<p>`, `<h1>`, `<div>`) start their own line. Blocks should
  never go inside inline tags.
- **JavaScript (JS)** — the browser language that adds behaviour.
- **JSON** — a text format for sending objects/lists between browser and server.
- **LLM** — Large Language Model (an AI that works with text); **vision LLM** also
  sees images.
- **localhost / LAN / Tailscale** — this machine only / same Wi-Fi / your private
  cross-device network.
- **Ollama** — software to run AI models locally, free and private.
- **Object** — a labelled bundle of values: `{ name: "A", score: 5 }`.
- **Orphan / widow (pages)** — a paragraph's first line left alone at the bottom
  of a page (orphan) or its last line alone at the top of the next (widow). Word,
  and now our notes, avoid both.
- **`@page` / paged media** — CSS rules for printing: the page size, the margins,
  and things drawn in the margins like page numbers.
- **Parameterised query** — using `?` placeholders in SQL so user data can't
  become a hack (**SQL injection**).
- **Point (pt)** — the unit Word uses for font sizes; 1 pt = 1/72 inch, about
  1.333 screen pixels (12 pt = 16 px).
- **Prompt** — the instructions you give an AI.
- **Range (DOM)** — a "selection" made in code: a start point and an end point in
  the page. `cloneContents()` copies everything between them.
- **Regression** — a feature that used to work but a change accidentally broke.
- **Responsive** — a layout that adapts to phone and desktop screen sizes.
- **Route** — the code that maps a web address to the function that handles it.
- **Salt** — random data mixed into a password before hashing.
- **Schema** — the agreed shape of data (for a database table, or for AI JSON
  output).
- **Session token** — the secret "ticket" that keeps you logged in.
- **SQL** — the language for talking to a database.
- **SQLite** — a tiny database stored in one file.
- **Status code** — the server's result signal: 200 OK, 400 bad request, 404 not
  found, 500 server error.
- **Store** — our name for a back-end module that reads/writes one feature's data.
- **Transaction** — a group of database changes that all succeed or all undo
  together.
- **Unit test / browser test** — a check of one small piece / a check of a whole
  screen.
- **Validation** — checking incoming data is sensible before using it.
- **Variable** — a named place to store a value.
- **XSS** — Cross-Site Scripting, the attack that escaping prevents.

---

*This file is a living document. It grows every time the app does. If you are
reading it as a beginner: you don't need to understand it all today — you built
all of the above one small step at a time, and that's exactly how to learn it.*
