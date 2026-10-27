"""Deep Practice: open-response practice imported from Markdown workbooks, alongside multiple choice.

Import keeps the original Markdown, matches questions to answers by ID (never by position) and reports
every problem with its question ID and source line. Question types are inferred transparently from the
text and can be corrected before or after saving. Workbooks such as COMP1521_Part_1_Workbook.md are not
strict Markdown: headings are plain lines and code is often unfenced, so code runs are detected and
fenced, tab-separated rows become tables, and every other line is kept as written.

Attempts keep the first submitted answer separate from later revisions. Solutions are only sent to the
browser after the student reveals them (practice) or submits the assessment. Only multiple-choice answers
with an explicit key are graded automatically; open responses are self-assessed and labelled as such.
Each account has its own workspace database, so quizzes, answers and progress are never shared.
"""
import json, re, uuid
from datetime import datetime, timezone

SCHEMA_VERSION = 1
TYPES = {'mcq': 'Multiple choice', 'recall': 'Short answer', 'explain': 'Explanation', 'fill_blank': 'Fill in the blank',
         'trace': 'Code tracing / output', 'debug': 'Debugging', 'implementation': 'Implementation'}
FORMATS = ('selection', 'text', 'code', 'mixed')
LANGUAGES = ('mips', 'c', 'python', 'java', 'javascript', 'shell', 'text')
CONFIDENCE = ('unsure', 'partly', 'confident')
OUTCOMES = ('independent', 'partial', 'needs_practice')
MAX_SOURCE = 2_000_000

def uid(): return uuid.uuid4().hex
def now(): return datetime.now(timezone.utc).isoformat()

# ----------------------------------------------------------------------------------------------- parsing
ID = r'[A-Za-z]{1,6}\d{0,3}-\d{1,4}[a-z]?'
HEADER = re.compile(r'^\s*(?:#{1,6}\s*)?(?:\*\*)?(?P<id>' + ID + r')(?:\*\*)?\s*(?:(?:[·•|]|\s[–—-]\s)\s*(?P<rest>.*?))?\s*$')
FIELD = re.compile(r'^\s*(?:\*\*)?(?P<name>Question|Answer choices|Choices|Options|Answer|Example solution|Worked answer|Solution|'
                   r'Explanation|Explain|Reasoning|Key rule|Common mistakes|Why (?:the )?other options are wrong|Incorrect options|'
                   r'Check your solution|Checking criteria)\s*:(?:\*\*)?\s*(?P<text>.*)$', re.I)
FIELD_KEYS = {'question': 'question', 'answer choices': 'choices', 'choices': 'choices', 'options': 'choices', 'answer': 'answer',
              'example solution': 'answer', 'worked answer': 'answer', 'solution': 'answer', 'explanation': 'explain', 'explain': 'explain',
              'reasoning': 'explain', 'key rule': 'key_rule', 'common mistakes': 'mistakes', 'why other options are wrong': 'options',
              'why the other options are wrong': 'options', 'incorrect options': 'options', 'check your solution': 'check', 'checking criteria': 'check'}
SOLUTION_FIELDS = ('answer', 'explain', 'key_rule', 'mistakes', 'options', 'check')
CHOICE = re.compile(r'^\s*(?:[-*]\s+)?(?:\*\*)?\(?([A-H])(?:\*\*)?[.)]\s+(.*)$')
CHECKBOX = re.compile(r'^\s*[-*]\s+\[([ xX])\]\s+(.*)$')
QSEC = re.compile(r'^(?:part\s+[\w.]+\s*[—–-]\s*)?(?:practice\s+)?questions$', re.I)
ASEC = re.compile(r'^(?:part\s+[\w.]+\s*[—–-]\s*)?(?:answers?|solutions?)(?:\s*(?:and|&)\s*explanations?)?$', re.I)
CSEC = re.compile(r'^(?:part\s+[\w.]+\s*[—–-]\s*)?independence checklist$', re.I)
DIRECTIVE = re.compile(r'^\.(text|data|globl|word|half|byte|space|ascii|asciiz|align|rdata|kdata|ktext|extern)\b')
LABEL = re.compile(r'^[a-z_][\w.]*:\s*;?\s*(#.*)?$')
HTML = re.compile(r'</?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?/?>')

def plain(line): return re.sub(r'^\s*#{1,6}\s*', '', line).strip().strip('*').strip()
def is_md_heading(line): return bool(re.match(r'^\s*#{1,6}\s+\S', line))
def is_list_item(line): return bool(re.match(r'^\s*(?:[-*+]|\d+[.)])\s+\S', line))

def looks_prose(line):
    """A sentence or caption: starts with a capital or bracket and ends with sentence punctuation."""
    t = line.strip()
    return bool(re.match(r'^[A-Z(“"\'‘]', t)) and bool(re.search(r'[.!?:)"”]$', t))

def is_code(line):
    """Unfenced code in workbooks: indented lines, assembler directives/labels/instructions and C statements."""
    if not line.strip(): return False
    if re.match(r'^(\t| {2,})\S', line) and not is_list_item(line): return True
    t = line.strip()
    if DIRECTIVE.match(t) or LABEL.match(t): return True
    if t in ('syscall', 'nop', '{', '}', '};'): return True
    if re.match(r'^(b|j|jal|jr|jalr)\s+[\w$]+$', t): return True
    if re.match(r'^[a-z_][\w.]*\s', t) and '$' in t and not looks_prose(t): return True
    if re.match(r'^(//|/\*)', t): return True
    if re.match(r'^[a-z_{}#*][^\n]*[;{}]$', t) and not looks_prose(t): return True
    return False

def guess_language(lines):
    text = '\n'.join(lines)
    if '$' in text and re.search(r'\b(li|la|lw|sw|lb|sb|add|addi|move|syscall|beq|bne|blt|bgt|ble|bge|jr|jal|mul|div|rem)\b', text) or DIRECTIVE.search(text): return 'mips'
    if re.search(r'[;{}]\s*$', text, re.M) or re.search(r'\b(int|char|for|while|if|return|printf|putchar|goto)\b', text): return 'c'
    if re.search(r'^\s*(\d{4}\s|diff\s|give\s|gcc\s|make\b|cd\s|ls\b)', text, re.M): return 'shell'
    return 'text'

def to_markdown(entries, start_code=False):
    """Convert a run of (line, text) entries to Markdown. Unfenced code runs become fenced blocks with the
    exact original text, tab-separated rows become pipe tables, and prose is kept line for line."""
    out, stats, i, n = [], {'code': 0, 'tables': 0, 'unterminated': []}, 0, len(entries)
    while i < n:
        ln, t = entries[i]
        if not t.strip():
            out.append(''); i += 1; start_code = False; continue
        stripped = t.lstrip()
        if stripped.startswith(('```', '~~~')):
            fence = stripped[:3]; block = [t]; i += 1
            while i < n and not entries[i][1].lstrip().startswith(fence): block.append(entries[i][1]); i += 1
            if i < n: block.append(entries[i][1]); i += 1
            else: block.append(fence); stats['unterminated'].append(ln)
            out.extend(block); stats['code'] += 1; start_code = False; continue
        if '\t' in t and not is_code(t):
            rows = []
            while i < n and '\t' in entries[i][1]: rows.append(entries[i][1].split('\t')); i += 1
            width = max(len(r) for r in rows)
            row = lambda r: '| ' + ' | '.join(c.strip().replace('|', '\\|') for c in r + [''] * (width - len(r))) + ' |'
            out.append(row(rows[0])); out.append('|' + ' --- |' * width); out.extend(row(r) for r in rows[1:])
            stats['tables'] += 1; start_code = False; continue
        if is_code(t) or (start_code and not looks_prose(t) and not is_list_item(t)):
            block = []
            while i < n:
                tt = entries[i][1]
                if not tt.strip():
                    j = i
                    while j < n and not entries[j][1].strip(): j += 1
                    if j < n and block and is_code(entries[j][1]): block.extend([''] * (j - i)); i = j; continue
                    break
                if block and not is_code(tt) and (looks_prose(tt) or is_list_item(tt) or FIELD.match(tt) or tt.lstrip().startswith('```')): break
                block.append(tt); i += 1
            out.append('```' + guess_language(block)); out.extend(block); out.append('```')
            stats['code'] += 1; start_code = False; continue
        out.append(t); i += 1; start_code = False
    while out and not out[-1].strip(): out.pop()
    while out and not out[0].strip(): out.pop(0)
    return '\n'.join(out), stats

def heading_like(line):
    s = line.strip()
    return bool(s) and len(s) <= 70 and '\t' not in line and not is_list_item(line) and not re.search(r'[.:;,?!)\]]$', s) \
        and bool(re.match(r'^[A-Z0-9]', s)) and len(s.split()) <= 9 and not is_code(line) and not HEADER.match(line) and not FIELD.match(line)

def section_kind(title):
    t = title.lower()
    if 'coverage' in t: return 'coverage'
    if 'assumption' in t or 'correction' in t: return 'assumptions'
    if 'source' in t or 'limitation' in t or 'audit' in t: return 'source'
    if 'study' in t or 'how to' in t: return 'study'
    return 'intro'

def stage_list(label):
    return [s.strip().capitalize() for s in re.split(r'\s*(?:\+|/|&|,|\band\b)\s*', label or '') if s.strip()]

def infer(question):
    """Transparent, editable inference of question type, response format and code language.
    The workbook does not label types, so each result carries the reason and a confidence level."""
    prompt, stage = question['prompt_text'], ' '.join(question['stages']).lower()
    language = 'mips' if re.search(r'\bMIPS\b|\bmipsy\b', prompt) else question['language_hint']
    result = lambda kind, fmt, confidence, reason, lang=None: {'type': kind, 'format': fmt, 'language': lang or language, 'confidence': confidence, 'reason': reason}
    if question['choices']: return result('mcq', 'selection', 'high', 'Has lettered answer choices.')
    if question['blanks']:
        where = 'code' if question['blanks_in_code'] else 'text'
        return result('fill_blank', 'mixed' if where == 'code' else 'text', 'high', f"Prompt contains {question['blanks']} ___ blank{'s' if question['blanks'] != 1 else ''} in its {where}.")
    if 'debugging' in stage: return result('debug', 'mixed', 'high', 'Learning stage is Debugging.')
    if re.search(r'\b(implementation|integration)\b', stage): return result('implementation', 'mixed', 'high', 'Learning stage is ' + question['stage'] + '.', language if language != 'text' else 'mips')
    if 'recall' in stage:
        if re.search(r'\bexplain\b', prompt, re.I): return result('explain', 'text', 'high', 'Learning stage is Recall and the prompt asks for an explanation.')
        return result('recall', 'text', 'high', 'Learning stage is Recall.')
    if re.search(r'\b(repair|fix|debug|diagnos\w*|loops forever|why are only)\b', prompt, re.I): return result('debug', 'mixed', 'medium', 'Prompt asks to repair or diagnose code.')
    if re.match(r'\s*(write|implement)\b', prompt, re.I) or re.search(r'\btranslate\b.*\b(mips|c|code)\b', prompt, re.I):
        return result('implementation', 'mixed', 'medium', 'Prompt asks you to write or translate code.', language if language != 'text' else 'mips')
    if re.search(r'\b(exact output|what is printed|trace|visited|list body values|final \$|at the end|afterward)\b', prompt, re.I) or (question['prompt_has_code'] and re.search(r'\b(give|what|list|how many)\b', prompt, re.I)):
        return result('trace', 'code', 'medium', 'Prompt asks for values or output produced by code.', 'text')
    if question['answer_has_code']: return result('implementation', 'mixed', 'medium', 'The worked answer is code.', question['answer_language'] if question['answer_language'] != 'text' else language)
    if re.search(r'\b(explain|why|how should|what does)\b', prompt, re.I): return result('explain', 'text', 'medium', 'Prompt asks for an explanation.')
    return result('recall', 'text', 'low', 'No specific cue found; treated as a short written answer. Please check.')

def option_explanations(text):
    """'A loads 37. C reads the stored 37.' -> {'A': 'loads 37.', 'C': 'reads the stored 37.'}; None if not every part parses."""
    parts = [p for p in re.split(r'(?<=[.;])\s+(?=[A-H]\s)', text.strip()) if p.strip()]
    out = {}
    for p in parts:
        m = re.match(r'^([A-H])\s+(.+)$', p.strip(), re.S)
        if not m: return None
        out[m.group(1)] = m.group(2).strip()
    return out or None

def check_items(markdown):
    if not markdown.strip(): return []
    lines = [l for l in markdown.split('\n') if l.strip()]
    if all(is_list_item(l) for l in lines): return [re.sub(r'^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?', '', l).strip() for l in lines]
    if '```' in markdown: return [markdown.strip()]
    return [s.strip() for s in re.split(r'(?<=[.?!])\s+(?=[A-Z(−\-\d‘“"])', ' '.join(lines)) if s.strip()]

def parse(source):
    """Parse a workbook. Returns (quiz, report); report['status'] is complete, incomplete or blocked."""
    if not isinstance(source, str) or not source.strip(): raise ValueError('Paste or upload a Markdown workbook first.')
    if len(source) > MAX_SOURCE: raise ValueError('The workbook is too large (2 MB maximum).')
    lines = source.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    L = [(i + 1, l) for i, l in enumerate(lines)]
    issues, used = [], set()
    def issue(level, code, message, qid=None, line=None): issues.append({'level': level, 'code': code, 'message': message, 'id': qid, 'line': line})
    def use(ln): used.add(ln)

    q_start = a_start = c_start = None
    for ln, l in L:
        p = plain(l)
        if q_start is None and QSEC.match(p): q_start = ln
        elif q_start is not None and a_start is None and ASEC.match(p): a_start = ln
        elif q_start is not None and c_start is None and CSEC.match(p): c_start = ln
    first_header = next((ln for ln, l in L if (m := HEADER.match(l)) and m.group('rest')), None)
    if q_start is None and first_header is None: raise ValueError('No questions were found. Each question needs an ID line such as "P1-001 · Foundation · Recall".')
    if q_start is not None: use(q_start)
    if a_start: use(a_start)
    if c_start: use(c_start)
    pre_end = (q_start or first_header) - 1
    q_from = q_start + 1 if q_start else first_header
    q_to = (a_start or c_start or len(L) + 1) - 1
    a_from, a_to = (a_start + 1, (c_start or len(L) + 1) - 1) if a_start else (None, None)
    c_from = c_start + 1 if c_start else None
    rng = lambda a, b: [e for e in L if a <= e[0] <= b]
    def next_nonblank(entries, k):
        for j in range(k + 1, len(entries)):
            if entries[j][1].strip(): return entries[j]
        return None

    # Preamble: title, then sections split at heading-like lines.
    pre = rng(1, pre_end)
    title_entry = next(((ln, l) for ln, l in pre if l.strip()), None)
    title = plain(title_entry[1]) if title_entry else 'Deep Practice workbook'
    if title_entry: use(title_entry[0])
    sections, cur = [], {'title': '', 'line': None, 'entries': []}
    for k, (ln, t) in enumerate(pre):
        if title_entry and ln <= title_entry[0]: continue
        if t.strip() and (is_md_heading(t) or heading_like(t)) and next_nonblank(pre, k):
            if cur['title'] or any(x[1].strip() for x in cur['entries']): sections.append(cur)
            cur = {'title': plain(t), 'line': ln, 'entries': []}; use(ln)
        else:
            cur['entries'].append((ln, t))
            if t.strip(): use(ln)
    if cur['title'] or any(x[1].strip() for x in cur['entries']): sections.append(cur)
    stats = {'code': 0, 'tables': 0}
    def md(entries, start_code=False):
        text, s = to_markdown(entries, start_code)
        stats['code'] += s['code']; stats['tables'] += s['tables']
        for ln in s['unterminated']: issue('warning', 'unterminated_fence', f'Line {ln}: a ``` code fence is never closed; it was closed at the end of its block.', line=ln)
        return text
    out_sections = [{'title': s['title'] or 'Introduction', 'kind': section_kind(s['title']), 'line': s['line'], 'markdown': md(s['entries'])} for s in sections]

    # Questions, grouped by the topic line that precedes them (topics may repeat later in the file).
    qentries = rng(q_from, q_to)
    questions, topics, intro, topic, cur, field = [], [], [], None, None, None
    for k, (ln, t) in enumerate(qentries):
        m = HEADER.match(t)
        if m and (m.group('rest') is not None or is_md_heading(t)):
            rest = [p for p in re.split(r'\s*(?:[·•|]|\s[–—-]\s)\s*', m.group('rest') or '') if p.strip()]
            cur = {'id': m.group('id'), 'line': ln, 'topic': topic, 'difficulty': rest[0] if rest else '', 'stage': ' · '.join(rest[1:]) if len(rest) > 1 else '',
                   'prompt': [], 'choices': [], 'fields': {}, 'inline_marker': {}, 'choices_line': None}
            questions.append(cur); field = 'prompt'; use(ln); continue
        if not t.strip():
            if cur is None: intro.append((ln, t))
            elif field == 'choices':
                if cur['choices'] and cur['choices'][-1]['lines'][-1][1].lstrip().startswith('```') and sum(x[1].lstrip().startswith('```') for x in cur['choices'][-1]['lines']) % 2: cur['choices'][-1]['lines'].append((ln, t))
            elif field in SOLUTION_FIELDS: cur['fields'][field].append((ln, t))
            else: cur['prompt'].append((ln, t))
            continue
        if cur is not None and field == 'choices' and (cm := CHOICE.match(t)):
            cur['choices'].append({'label': cm.group(1), 'line': ln, 'lines': [(ln, cm.group(2))]}); use(ln); continue
        nxt = next_nonblank(qentries, k)
        if is_md_heading(t) or (heading_like(t) and nxt and (nm := HEADER.match(nxt[1])) and nm.group('rest') is not None):
            topic = plain(t); use(ln); cur = None; field = None
            if topic not in [x['name'] for x in topics]: topics.append({'name': topic, 'line': ln})
            continue
        if cur is None: intro.append((ln, t)); use(ln); continue
        f = FIELD.match(t)
        if f:
            key = FIELD_KEYS[re.sub(r'\s+', ' ', f.group('name').lower())]; use(ln)
            if key == 'question':
                field = 'prompt'
                if f.group('text').strip(): cur['prompt'].append((ln, f.group('text')))
            elif key == 'choices':
                field = 'choices'; cur['choices_line'] = ln
            else:
                field = key; cur['fields'].setdefault(key, []); cur['inline_marker'][key] = bool(f.group('text').strip())
                if f.group('text').strip(): cur['fields'][key].append((ln, f.group('text')))
            continue
        use(ln)
        if field == 'choices' and cur['choices']: cur['choices'][-1]['lines'].append((ln, t))
        elif field in SOLUTION_FIELDS: cur['fields'][field].append((ln, t))
        else: cur['prompt'].append((ln, t))

    # Answers section: blocks introduced by a bare ID line, matched to questions by ID.
    answers, answers_intro = {}, []
    if a_from:
        cur, field = None, None
        for ln, t in rng(a_from, a_to):
            m = HEADER.match(t)
            if m:
                qid = m.group('id'); use(ln)
                if qid in answers:
                    issue('error', 'duplicate_answer', f'Answer {qid} appears twice (lines {answers[qid]["line"]} and {ln}). Keep one answer per ID; answers are matched by ID.', qid, ln)
                    cur = {'id': qid, 'line': ln, 'fields': {}, 'inline_marker': {}, 'duplicate': True}
                else:
                    cur = answers[qid] = {'id': qid, 'line': ln, 'fields': {}, 'inline_marker': {}}
                field = None; continue
            if cur is None:
                answers_intro.append((ln, t))
                if t.strip(): use(ln)
                continue
            f = FIELD.match(t) if t.strip() else None
            if f and FIELD_KEYS[re.sub(r'\s+', ' ', f.group('name').lower())] in SOLUTION_FIELDS:
                field = FIELD_KEYS[re.sub(r'\s+', ' ', f.group('name').lower())]; use(ln)
                if field in cur['fields']: issue('warning', 'repeated_field', f'{cur["id"]}: "{f.group("name")}" appears more than once (line {ln}); the parts are joined.', cur['id'], ln)
                cur['fields'].setdefault(field, []); cur['inline_marker'][field] = bool(f.group('text').strip())
                if f.group('text').strip(): cur['fields'][field].append((ln, f.group('text')))
                continue
            if t.strip():
                use(ln)
                if field is None:
                    field = 'answer'; cur['fields'].setdefault('answer', []); cur['inline_marker']['answer'] = True
                    issue('info', 'answer_without_label', f'{cur["id"]}: text before any "Answer:" label (line {ln}) was kept as the answer.', cur['id'], ln)
            if field: cur['fields'][field].append((ln, t))

    # Independence checklist.
    checklist_items, checklist_notes = [], []
    if c_from:
        for ln, t in rng(c_from, len(L)):
            cm = CHECKBOX.match(t)
            if cm: checklist_items.append({'text': cm.group(2).strip(), 'line': ln}); use(ln)
            else:
                checklist_notes.append((ln, t))
                if t.strip(): use(ln)

    # Assemble questions and validate.
    seen, out_q = {}, []
    for order, q in enumerate(questions):
        if q['id'] in seen:
            issue('error', 'duplicate_question', f'Question ID {q["id"]} is used twice (lines {seen[q["id"]]} and {q["line"]}). Give each question a unique ID so its answer can be matched.', q['id'], q['line'])
        seen.setdefault(q['id'], q['line'])
        if not q['topic']: issue('info', 'no_topic', f'{q["id"]} (line {q["line"]}) has no topic heading above it; it is listed under "General".', q['id'], q['line'])
        prompt_md = md(q['prompt'])
        if not prompt_md.strip(): issue('warning', 'empty_prompt', f'{q["id"]} (line {q["line"]}) has no question text.', q['id'], q['line'])
        # A one-line code choice reads better as inline code; multi-line choice code stays a block.
        inline = lambda m: f"`{m.group(1)}`" if '`' not in m.group(1) else m.group(0)
        choices = [{'label': c['label'], 'markdown': re.sub(r'^```\w*\n([^\n]*)\n```$', inline, md(c['lines']))} for c in q['choices']]
        if q['choices_line'] and len(choices) < 2: issue('warning', 'few_choices', f'{q["id"]}: "Answer choices:" (line {q["choices_line"]}) is followed by {len(choices)} lettered choice(s).', q['id'], q['choices_line'])
        labels = [c['label'] for c in choices]
        if len(set(labels)) != len(labels): issue('error', 'duplicate_choice', f'{q["id"]}: a choice letter is repeated ({", ".join(labels)}).', q['id'], q['line'])
        source_fields = answers.get(q['id'], {}).get('fields') or q['fields']
        markers = answers.get(q['id'], {}).get('inline_marker') or q['inline_marker']
        answer_line = answers.get(q['id'], {}).get('line') or (q['line'] if q['fields'] else None)
        if q['id'] in answers and q['fields']: issue('warning', 'two_answers', f'{q["id"]} has answer text under the question (line {q["line"]}) and in the answers section (line {answers[q["id"]]["line"]}); the answers section is used.', q['id'], q['line'])
        solution = None
        if source_fields:
            solution = {k: md(source_fields[k], start_code=not markers.get(k, True) and bool(source_fields[k]) and bool(source_fields[k][0][1].strip())) if k in source_fields else '' for k in SOLUTION_FIELDS}
            solution['option_explanations'] = option_explanations(solution['options']) if solution['options'] and '```' not in solution['options'] else None
            solution['check_items'] = check_items(solution['check'])
            if not solution['answer'].strip(): issue('warning', 'no_worked_answer', f'{q["id"]}: the answer section (line {answer_line}) has no "Answer:" text.', q['id'], answer_line)
        else:
            issue('warning', 'missing_answer', f'{q["id"]} (question at line {q["line"]}) has no matching answer. It will be saved without a worked solution.', q['id'], q['line'])
        key = []
        if choices and solution:
            letters = re.fullmatch(r'\s*([A-H](?:\s*(?:,|and|&)\s*[A-H])*)\.?\s*', re.sub(r'[*`]', '', solution['answer'].split('\n')[0]))
            if letters and solution['answer'].strip().count('\n') == 0:
                key = re.findall(r'[A-H]', letters.group(1))
                bad = [x for x in key if x not in labels]
                if bad: issue('error', 'answer_not_a_choice', f'{q["id"]}: answer {", ".join(bad)} is not one of the choices {", ".join(labels)} (answer at line {answer_line}).', q['id'], answer_line); key = []
            else:
                issue('warning', 'mcq_without_key', f'{q["id"]}: the answer is not a choice letter, so this multiple-choice question will be self-assessed rather than graded.', q['id'], answer_line)
        raw_prompt = '\n'.join(t for _, t in q['prompt'])
        code_blocks = re.findall(r'```[^\n]*\n(.*?)\n```', prompt_md, re.S)
        blanks_in_code = sum(len(re.findall(r'_{3,}', b)) for b in code_blocks)
        blanks = len(re.findall(r'_{3,}', prompt_md))
        answer_blocks = re.findall(r'```([^\n]*)\n(.*?)\n```', solution['answer'], re.S) if solution else []
        hints = [h for h in [guess_language(b.split('\n')) for b in code_blocks] + [lang or guess_language(b.split('\n')) for lang, b in answer_blocks] if h != 'text']
        item = {'id': q['id'], 'order': order, 'line': q['line'], 'answer_line': answer_line, 'topic': q['topic'] or 'General',
                'difficulty': q['difficulty'], 'stage': q['stage'], 'stages': stage_list(q['stage']), 'prompt': prompt_md, 'choices': choices,
                'answer_key': key, 'blanks': blanks, 'blanks_in_code': blanks_in_code, 'solution': solution}
        answer_langs = [lang or guess_language(b.split('\n')) for lang, b in answer_blocks]
        inferred = infer({**item, 'prompt_text': raw_prompt, 'prompt_has_code': bool(code_blocks), 'language_hint': max(hints, key=hints.count) if hints else 'text',
                          'answer_has_code': bool(answer_blocks), 'answer_language': answer_langs[-1] if answer_langs else 'text'})
        item.update(type=inferred['type'], format=inferred['format'], language=inferred['language'], inferred=inferred)
        if inferred['confidence'] == 'low': issue('info', 'low_confidence_type', f'{q["id"]}: question type could not be inferred confidently; it is set to Short answer. Check it in the table below.', q['id'], q['line'])
        out_q.append(item)
    if not out_q: raise ValueError('No questions were found. Each question needs an ID line such as "P1-001 · Foundation · Recall".')
    for qid, a in answers.items():
        if qid not in seen: issue('warning', 'orphan_answer', f'Answer {qid} (line {a["line"]}) has no matching question. It is kept in the original Markdown only.', qid, a['line'])
    # Gaps in a numbered ID sequence usually mean a question header was mistyped.
    groups = {}
    for qid in seen:
        m = re.match(r'^(.*-)(\d+)$', qid)
        if m: groups.setdefault(m.group(1), []).append((int(m.group(2)), len(m.group(2))))
    for prefix, nums in groups.items():
        values = sorted(n for n, _ in nums); width = nums[0][1]; present = set(values)
        for v in range(values[0], values[-1] + 1):
            if v not in present:
                missing = f'{prefix}{v:0{width}d}'
                before = max((x for x in values if x < v), default=None); after = min((x for x in values if x > v), default=None)
                issue('warning', 'missing_id', f'No question uses ID {missing} (between {prefix}{before:0{width}d} and {prefix}{after:0{width}d}). If a question was dropped, check its header line.', missing, None)
    for ln, t in L:
        if HTML.search(t): issue('warning', 'html', f'Line {ln} contains HTML ({HTML.search(t).group(0)[:40]}). It is shown as text and never run.', None, ln)
    unplaced = [ln for ln, t in L if t.strip() and ln not in used]
    for ln in unplaced[:20]: issue('warning', 'unplaced', f'Line {ln} was not recognised and is kept only in the original Markdown: "{lines[ln - 1].strip()[:80]}"', None, ln)
    if len(unplaced) > 20: issue('warning', 'unplaced', f'{len(unplaced) - 20} more unrecognised lines are kept only in the original Markdown.', None, None)

    topic_names = [t['name'] for t in topics] + (['General'] if any(q['topic'] == 'General' for q in out_q) else [])
    shown = ', '.join(topic_names[:4]) + (' and more' if len(topic_names) > 4 else '')
    description = f"{len(out_q)} practice questions across {len(topic_names)} topic{'s' if len(topic_names) != 1 else ''}: {shown}."
    quiz = {'schema_version': SCHEMA_VERSION, 'title': title[:200], 'description': description[:600], 'sections': out_sections,
            'questions_intro': md(intro), 'answers_intro': md(answers_intro),
            'topics': [{'name': n, 'count': sum(q['topic'] == n for q in out_q)} for n in topic_names],
            'questions': out_q, 'checklist': {'items': checklist_items, 'notes': md(checklist_notes)}}
    count = lambda key: {k: sum(1 for q in out_q if q[key] == k) for k in dict.fromkeys(q[key] for q in out_q)}
    stage_counts = {}
    for q in out_q:
        for s in q['stages']: stage_counts[s] = stage_counts.get(s, 0) + 1
    counts = {'questions': len(out_q), 'topics': len(quiz['topics']), 'matched': sum(1 for q in out_q if q['solution']), 'answers': len(answers),
              'mcq': sum(1 for q in out_q if q['choices']), 'graded_mcq': sum(1 for q in out_q if q['answer_key']), 'types': count('type'),
              'difficulties': count('difficulty'), 'stages': stage_counts, 'code_blocks': stats['code'], 'tables': stats['tables'],
              'checklist_items': len(checklist_items), 'sections': len(out_sections), 'lines': len(L), 'unplaced_lines': len(unplaced)}
    blocked = any(i['level'] == 'error' for i in issues)
    status = 'blocked' if blocked else 'incomplete' if any(i['level'] == 'warning' for i in issues) else 'complete'
    return quiz, {'status': status, 'counts': counts, 'issues': issues}

def apply_overrides(quiz, overrides):
    """Apply the student's corrections to inferred type, response format and language."""
    for q in quiz['questions']:
        o = overrides.get(q['id']) or {}
        if o.get('type') in TYPES: q['type'] = o['type']
        if o.get('format') in FORMATS: q['format'] = o['format']
        if o.get('language') in LANGUAGES: q['language'] = o['language']
        if q['type'] == 'mcq' and not q['choices']: q['type'], q['format'] = q['inferred']['type'], q['inferred']['format']
    return quiz

def clean_overrides(value, quiz):
    if not isinstance(value, dict): return {}
    ids, out = {q['id'] for q in quiz['questions']}, {}
    for qid, o in value.items():
        if qid in ids and isinstance(o, dict):
            entry = {k: o[k] for k, allowed in (('type', TYPES), ('format', FORMATS), ('language', LANGUAGES)) if o.get(k) in allowed}
            if entry: out[qid] = entry
    return out

def public_question(q):
    """A question as sent during an attempt: never the worked answer, explanations or the answer key."""
    return {k: q[k] for k in ('id', 'order', 'topic', 'difficulty', 'stage', 'stages', 'prompt', 'choices', 'blanks', 'blanks_in_code', 'type', 'format', 'language', 'inferred', 'line')} | {
        'has_solution': bool(q['solution']), 'graded': bool(q['answer_key']), 'multiple': len(q['answer_key']) > 1}

def public_quiz(quiz):
    return {**{k: quiz[k] for k in ('schema_version', 'title', 'description', 'sections', 'questions_intro', 'topics', 'checklist')},
            'questions': [public_question(q) for q in quiz['questions']]}

# ----------------------------------------------------------------------------------------------- storage
def migrate(path):
    import sqlite3
    from contextlib import closing
    with closing(sqlite3.connect(path)) as c, c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS deep_quizzes(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,subject_id TEXT,topic_name TEXT,
          schema_version INTEGER NOT NULL,content_version INTEGER NOT NULL,data TEXT NOT NULL,overrides TEXT NOT NULL,report TEXT NOT NULL,
          source TEXT NOT NULL,source_name TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS deep_attempts(id TEXT PRIMARY KEY,quiz_id TEXT NOT NULL REFERENCES deep_quizzes(id) ON DELETE CASCADE,mode TEXT NOT NULL,
          content_version INTEGER NOT NULL,scope TEXT NOT NULL,question_ids TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,submitted_at TEXT);
        CREATE INDEX IF NOT EXISTS deep_attempts_quiz ON deep_attempts(quiz_id,updated_at);
        CREATE TABLE IF NOT EXISTS deep_responses(attempt_id TEXT NOT NULL REFERENCES deep_attempts(id) ON DELETE CASCADE,question_id TEXT NOT NULL,
          data TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(attempt_id,question_id));
        CREATE TABLE IF NOT EXISTS deep_checklist(quiz_id TEXT NOT NULL REFERENCES deep_quizzes(id) ON DELETE CASCADE,item INTEGER NOT NULL,checked INTEGER NOT NULL,
          updated_at TEXT NOT NULL,PRIMARY KEY(quiz_id,item));''')

def text(v, limit, label):
    if v is None: v = ''
    if not isinstance(v, str): raise ValueError(label + ' must be text.')
    if len(v) > limit: raise ValueError(f'{label} must be at most {limit:,} characters.')
    return v

def load_quiz(con, quiz_id):
    row = con.execute('SELECT * FROM deep_quizzes WHERE id=?', (quiz_id,)).fetchone() if isinstance(quiz_id, str) else None
    if not row: raise ValueError('This Deep Practice quiz no longer exists.')
    quiz = apply_overrides(json.loads(row['data']), json.loads(row['overrides']))
    return row, quiz

def load_attempt(con, attempt_id):
    row = con.execute('SELECT * FROM deep_attempts WHERE id=?', (attempt_id,)).fetchone() if isinstance(attempt_id, str) else None
    if not row: raise ValueError('This attempt no longer exists.')
    return row

def has_content(resp):
    if not isinstance(resp, dict): return False
    return any(str(resp.get(k) or '').strip() for k in ('text', 'code')) or any(str(b).strip() for b in resp.get('blanks') or []) or bool(resp.get('selected'))

def clean_response(value, q):
    if not isinstance(value, dict): raise ValueError('Invalid response.')
    unknown = set(value) - {'text', 'code', 'language', 'blanks', 'selected'}
    if unknown: raise ValueError('Invalid response field: ' + ', '.join(sorted(unknown)))
    out = {'text': text(value.get('text'), 100_000, 'Your answer'), 'code': text(value.get('code'), 200_000, 'Your code')}
    lang = value.get('language') or q['language']
    if lang not in LANGUAGES: raise ValueError('Choose a supported language.')
    out['language'] = lang
    blanks = value.get('blanks') or []
    if not isinstance(blanks, list) or len(blanks) > 100: raise ValueError('Invalid blanks.')
    out['blanks'] = [text(b, 2000, 'A blank') for b in blanks]
    selected = value.get('selected') or []
    labels = [c['label'] for c in q['choices']]
    if not isinstance(selected, list) or any(s not in labels for s in selected): raise ValueError('Choose one of the listed answers.')
    out['selected'] = sorted(set(selected))
    return out

def grade(q, response):
    """Automatic grading only for multiple choice with an explicit answer key."""
    if q['type'] != 'mcq' or not q['answer_key']: return None
    return {'selected': response.get('selected', []), 'correct': sorted(response.get('selected', [])) == sorted(q['answer_key'])}

def q_state(r, assessment_open=False):
    """One clear state per question. 'Independent' is only ever the student's own assessment."""
    if not r: return 'not_started'
    if assessment_open: return 'draft' if has_content(r.get('draft')) else 'not_started'
    mcq = r.get('mcq')
    if r.get('review') == 'independent': return 'independent'
    if r.get('flagged') or r.get('review') in ('partial', 'needs_practice') or (mcq and mcq.get('correct') is False): return 'needs_review'
    if mcq and mcq.get('correct'): return 'correct'
    if r.get('revealed'): return 'revealed'
    if r.get('original'): return 'submitted'
    if r.get('skipped'): return 'skipped'
    if has_content(r.get('draft')): return 'draft'
    return 'not_started'

def responses(con, attempt_id):
    return {r['question_id']: json.loads(r['data']) for r in con.execute('SELECT question_id,data FROM deep_responses WHERE attempt_id=?', (attempt_id,))}

def summarise(quiz, latest):
    """Honest progress: objective MCQ results, self-assessments and reveals are reported separately."""
    qs = {q['id']: q for q in quiz['questions']}
    s = {'questions': len(qs), 'mcq_total': sum(1 for q in qs.values() if q['type'] == 'mcq' and q['answer_key']), 'mcq_answered': 0, 'mcq_correct': 0,
         'awaiting_review': 0, 'outcomes': {k: 0 for k in OUTCOMES}, 'revealed_without_attempt': 0, 'skipped': 0, 'flagged': 0,
         'submitted': 0, 'drafts': 0, 'not_started': 0, 'states': {}, 'topics_needing_work': [], 'review_ids': []}
    needing = {}
    for qid, q in qs.items():
        r = latest.get(qid)
        state = q_state(r)
        s['states'][qid] = state
        if not r: s['not_started'] += 1; continue
        if r.get('original'): s['submitted'] += 1
        elif has_content(r.get('draft')): s['drafts'] += 1
        elif not r.get('revealed') and not r.get('skipped'): s['not_started'] += 1
        if r.get('mcq'):
            s['mcq_answered'] += 1; s['mcq_correct'] += 1 if r['mcq']['correct'] else 0
        elif r.get('original') and not r.get('review'): s['awaiting_review'] += 1
        if r.get('review') in OUTCOMES: s['outcomes'][r['review']] += 1
        if r.get('revealed_without_attempt'): s['revealed_without_attempt'] += 1
        if r.get('skipped') and not r.get('original'): s['skipped'] += 1
        if r.get('flagged'): s['flagged'] += 1
        weak = r.get('flagged') or r.get('review') in ('partial', 'needs_practice') or (r.get('mcq') and not r['mcq']['correct']) or r.get('revealed_without_attempt')
        if weak:
            s['review_ids'].append(qid); needing[q['topic']] = needing.get(q['topic'], 0) + 1
    s['topics_needing_work'] = [{'topic': t, 'questions': n} for t, n in sorted(needing.items(), key=lambda x: -x[1])]
    return s

def latest_responses(con, quiz_id, include_open_assessment=False):
    """Most recent response per question across this quiz's attempts (an unsubmitted assessment is excluded)."""
    latest = {}
    for row in con.execute('''SELECT r.question_id,r.data,r.updated_at,a.mode,a.status FROM deep_responses r JOIN deep_attempts a ON a.id=r.attempt_id
                              WHERE a.quiz_id=? ORDER BY r.updated_at''', (quiz_id,)):
        if row['mode'] == 'assessment' and row['status'] != 'submitted' and not include_open_assessment: continue
        data = json.loads(row['data'])
        if data.get('original') or data.get('revealed') or data.get('skipped') or has_content(data.get('draft')) or data.get('flagged'): latest[row['question_id']] = data
    return latest

def attempt_summary(con, row):
    return {'id': row['id'], 'mode': row['mode'], 'status': row['status'], 'scope': json.loads(row['scope']), 'questions': len(json.loads(row['question_ids'])),
            'content_version': row['content_version'], 'created_at': row['created_at'], 'updated_at': row['updated_at'], 'submitted_at': row['submitted_at'],
            'answered': con.execute("SELECT COUNT(*) FROM deep_responses WHERE attempt_id=? AND (json_extract(data,'$.original') IS NOT NULL)", (row['id'],)).fetchone()[0]}

def state(con):
    out = []
    for row in con.execute('SELECT id,title,description,subject_id,topic_name,content_version,report,created_at,updated_at FROM deep_quizzes ORDER BY updated_at DESC'):
        report = json.loads(row['report'])
        _, quiz = load_quiz(con, row['id'])
        summary = summarise(quiz, latest_responses(con, row['id']))
        active = con.execute("SELECT id,mode FROM deep_attempts WHERE quiz_id=? AND status='active' ORDER BY updated_at DESC", (row['id'],)).fetchall()
        out.append({'id': row['id'], 'title': row['title'], 'description': row['description'], 'subject_id': row['subject_id'], 'topic_name': row['topic_name'],
                    'questions': report['counts']['questions'], 'topics': [t['name'] for t in quiz['topics']], 'status': report['status'],
                    'created_at': row['created_at'], 'updated_at': row['updated_at'], 'summary': {k: summary[k] for k in summary if k not in ('states',)},
                    'active_practice': next((a['id'] for a in active if a['mode'] == 'practice'), None), 'active_assessment': next((a['id'] for a in active if a['mode'] == 'assessment'), None)})
    return {'quizzes': out, 'types': TYPES, 'formats': FORMATS, 'languages': LANGUAGES}

def quiz_view(con, quiz_id):
    row, quiz = load_quiz(con, quiz_id)
    attempts = [attempt_summary(con, a) for a in con.execute('SELECT * FROM deep_attempts WHERE quiz_id=? ORDER BY created_at DESC', (quiz_id,))]
    checks = {r['item']: bool(r['checked']) for r in con.execute('SELECT item,checked FROM deep_checklist WHERE quiz_id=?', (quiz_id,))}
    return {'id': row['id'], 'quiz': public_quiz(quiz), 'report': json.loads(row['report']), 'subject_id': row['subject_id'], 'topic_name': row['topic_name'],
            'content_version': row['content_version'], 'source_name': row['source_name'], 'created_at': row['created_at'], 'updated_at': row['updated_at'],
            'overrides': json.loads(row['overrides']), 'summary': summarise(quiz, latest_responses(con, quiz_id)), 'attempts': attempts,
            'checklist': [checks.get(i, False) for i in range(len(quiz['checklist']['items']))]}

def attempt_view(con, attempt_id):
    a = load_attempt(con, attempt_id)
    _, quiz = load_quiz(con, a['quiz_id'])
    qs = {q['id']: q for q in quiz['questions']}
    resp = responses(con, attempt_id)
    open_assessment = a['mode'] == 'assessment' and a['status'] != 'submitted'
    shown = {}
    for qid, r in resp.items():
        if qid not in qs: continue
        public = {k: v for k, v in r.items() if not (open_assessment and k == 'mcq')}
        public['state'] = q_state(r, open_assessment)
        shown[qid] = public
    # Solutions: in practice only those revealed; in an assessment only after it is submitted.
    solutions = {}
    for qid in json.loads(a['question_ids']):
        q, r = qs.get(qid), resp.get(qid, {})
        if q and q['solution'] and ((a['mode'] == 'practice' and r.get('revealed')) or (a['mode'] == 'assessment' and a['status'] == 'submitted')):
            solutions[qid] = solution_payload(q)
    ids = [qid for qid in json.loads(a['question_ids']) if qid in qs]
    return {'attempt': {**attempt_summary(con, a), 'question_ids': ids, 'quiz_id': a['quiz_id'], 'stale': a['content_version'] != con.execute('SELECT content_version FROM deep_quizzes WHERE id=?', (a['quiz_id'],)).fetchone()[0]},
            'responses': shown, 'solutions': solutions, 'summary': summarise({'questions': [qs[i] for i in ids]}, {k: v for k, v in resp.items() if k in ids}) if not open_assessment else None}

def solution_payload(q):
    return {**q['solution'], 'answer_key': q['answer_key']}

def store_quiz(con, quiz_id, quiz, report, source, name, overrides, meta):
    stamp = now()
    data = json.dumps(quiz, ensure_ascii=False)
    if quiz_id:
        row = con.execute('SELECT content_version,data FROM deep_quizzes WHERE id=?', (quiz_id,)).fetchone()
        version = row['content_version'] + (1 if row['data'] != data else 0)
        con.execute('UPDATE deep_quizzes SET title=?,description=?,subject_id=?,topic_name=?,schema_version=?,content_version=?,data=?,overrides=?,report=?,source=?,source_name=?,updated_at=? WHERE id=?',
                    (meta['title'], meta['description'], meta['subject_id'], meta['topic_name'], SCHEMA_VERSION, version, data, json.dumps(overrides), json.dumps(report, ensure_ascii=False), source, name, stamp, quiz_id))
        return quiz_id
    quiz_id = uid()
    con.execute('INSERT INTO deep_quizzes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (quiz_id, meta['title'], meta['description'], meta['subject_id'], meta['topic_name'], SCHEMA_VERSION, 1,
                data, json.dumps(overrides), json.dumps(report, ensure_ascii=False), source, name, stamp, stamp))
    return quiz_id

def meta_from(payload, quiz, row=None):
    title = text(payload.get('title', row['title'] if row else quiz['title']), 200, 'Title').strip() or quiz['title']
    description = text(payload.get('description', row['description'] if row else quiz['description']), 1000, 'Description').strip()
    subject = payload.get('subject_id', row['subject_id'] if row else None) or None
    topic = payload.get('topic_name', row['topic_name'] if row else None) or None
    if subject is not None: text(subject, 200, 'Subject')
    if topic is not None: text(topic, 200, 'Topic')
    return {'title': title, 'description': description, 'subject_id': subject, 'topic_name': topic}

def write(con, payload):
    if not isinstance(payload, dict): raise ValueError('Invalid Deep Practice request.')
    action = payload.get('action')
    if action == 'preview':
        quiz, report = parse(payload.get('source'))
        quiz = apply_overrides(quiz, clean_overrides(payload.get('overrides'), quiz))
        return {'ok': True, 'quiz': public_quiz(quiz), 'report': report}
    if action == 'import':
        source = payload.get('source')
        quiz, report = parse(source)
        if report['status'] == 'blocked': raise ValueError('This workbook cannot be saved yet: ' + '; '.join(i['message'] for i in report['issues'] if i['level'] == 'error')[:900])
        overrides = clean_overrides(payload.get('overrides'), quiz)
        name = text(payload.get('source_name') or 'workbook.md', 200, 'File name')
        quiz_id = store_quiz(con, None, quiz, report, source, name, overrides, meta_from(payload, quiz))
        return {'ok': True, 'id': quiz_id, 'status': report['status']}
    if action == 'open': return {'ok': True, **quiz_view(con, payload.get('quiz_id'))}
    if action == 'source':
        row, _ = load_quiz(con, payload.get('quiz_id'))
        return {'ok': True, 'source': row['source'], 'name': row['source_name']}
    if action == 'update':
        row, _ = load_quiz(con, payload.get('quiz_id'))
        quiz = json.loads(row['data'])
        overrides = clean_overrides(payload['overrides'], quiz) if 'overrides' in payload else json.loads(row['overrides'])
        store_quiz(con, row['id'], quiz, json.loads(row['report']), row['source'], row['source_name'], overrides, meta_from(payload, quiz, row))
        return {'ok': True, **quiz_view(con, row['id'])}
    if action == 'reprocess':
        row, _ = load_quiz(con, payload.get('quiz_id'))
        source = payload['source'] if isinstance(payload.get('source'), str) else row['source']
        quiz, report = parse(source)
        if report['status'] == 'blocked': raise ValueError('The workbook cannot be reprocessed: ' + '; '.join(i['message'] for i in report['issues'] if i['level'] == 'error')[:900])
        overrides = clean_overrides(json.loads(row['overrides']), quiz)
        store_quiz(con, row['id'], quiz, report, source, text(payload.get('source_name') or row['source_name'], 200, 'File name'), overrides, meta_from({}, quiz, row))
        return {'ok': True, **quiz_view(con, row['id'])}
    if action == 'delete':
        row, _ = load_quiz(con, payload.get('quiz_id'))
        con.execute('DELETE FROM deep_quizzes WHERE id=?', (row['id'],))
        return {'ok': True}
    if action == 'checklist':
        row, quiz = load_quiz(con, payload.get('quiz_id'))
        item = payload.get('item')
        if not isinstance(item, int) or isinstance(item, bool) or not 0 <= item < len(quiz['checklist']['items']): raise ValueError('Unknown checklist item.')
        con.execute('INSERT OR REPLACE INTO deep_checklist VALUES(?,?,?,?)', (row['id'], item, 1 if payload.get('checked') is True else 0, now()))
        return {'ok': True}
    if action == 'start': return start(con, payload)
    if action == 'attempt': return {'ok': True, **attempt_view(con, payload.get('attempt_id'))}
    if action == 'response': return respond(con, payload)
    if action == 'finish': return finish(con, payload)
    raise ValueError('Unknown Deep Practice action.')

def start(con, payload):
    row, quiz = load_quiz(con, payload.get('quiz_id'))
    mode = payload.get('mode')
    if mode not in ('practice', 'assessment'): raise ValueError('Choose practice or assessment.')
    scope = payload.get('scope') or {'kind': 'all'}
    if not isinstance(scope, dict): raise ValueError('Invalid practice scope.')
    kind, qs = scope.get('kind', 'all'), quiz['questions']
    if kind == 'topic': qs = [q for q in qs if q['topic'] == scope.get('topic')]
    elif kind == 'review':
        weak = set(summarise(quiz, latest_responses(con, row['id']))['review_ids']); qs = [q for q in qs if q['id'] in weak]
    elif kind == 'filter':
        f = {k: scope.get(k) for k in ('topic', 'difficulty', 'stage', 'type') if scope.get(k)}
        qs = [q for q in qs if (not f.get('topic') or q['topic'] == f['topic']) and (not f.get('difficulty') or q['difficulty'] == f['difficulty'])
              and (not f.get('stage') or f['stage'] in q['stages']) and (not f.get('type') or q['type'] == f['type'])]
    elif kind != 'all': raise ValueError('Unknown practice scope.')
    if not qs: raise ValueError('No questions match that choice.')
    stamp = now()
    # Starting fresh keeps every earlier attempt as history; only the newest active attempt is resumed.
    con.execute("UPDATE deep_attempts SET status='closed',updated_at=? WHERE quiz_id=? AND mode=? AND status='active'", (stamp, row['id'], mode))
    attempt_id = uid()
    con.execute('INSERT INTO deep_attempts VALUES(?,?,?,?,?,?,?,?,?,?)', (attempt_id, row['id'], mode, row['content_version'], json.dumps({k: v for k, v in scope.items() if k in ('kind', 'topic', 'difficulty', 'stage', 'type')}),
                json.dumps([q['id'] for q in qs]), 'active', stamp, stamp, None))
    return {'ok': True, **attempt_view(con, attempt_id)}

def respond(con, payload):
    a = load_attempt(con, payload.get('attempt_id'))
    _, quiz = load_quiz(con, a['quiz_id'])
    qid = payload.get('question_id')
    if qid not in json.loads(a['question_ids']): raise ValueError('That question is not part of this attempt.')
    q = next((x for x in quiz['questions'] if x['id'] == qid), None)
    if not q: raise ValueError('That question is no longer in this quiz.')
    op, stamp = payload.get('op'), now()
    assessment, submitted = a['mode'] == 'assessment', a['status'] == 'submitted'
    if a['status'] == 'closed' and op not in ('review', 'checks'): raise ValueError('This attempt was replaced by a newer one. Open the latest attempt to keep working.')
    row = con.execute('SELECT data FROM deep_responses WHERE attempt_id=? AND question_id=?', (a['id'], qid)).fetchone()
    r = json.loads(row['data']) if row else {'opened_at': stamp}
    result = {}
    if 'confidence' in payload:
        if payload['confidence'] not in (None,) + CONFIDENCE: raise ValueError('Choose unsure, partly confident or confident.')
        if not r.get('original') or op == 'submit': r['confidence'] = payload['confidence']
    if op == 'draft':
        if assessment and submitted: raise ValueError('This assessment has been submitted; answers can no longer change.')
        response = clean_response(payload.get('response'), q)
        if r.get('original'):
            # After submitting, edits are kept as a revision; the original stays exactly as submitted.
            r['revision'] = {'response': response, 'saved_at': stamp, 'after_reveal': bool(r.get('revealed'))}
        else:
            r['draft'] = response; r['draft_saved_at'] = stamp
    elif op == 'submit':
        if assessment: raise ValueError('In an assessment, answers are saved and submitted together at the end.')
        response = clean_response(payload.get('response'), q)
        if not has_content(response): raise ValueError('Write or choose an answer before submitting, or use Skip for now.')
        if r.get('original'): raise ValueError('This answer was already submitted. Later changes are saved as a revision.')
        r['draft'] = response; r['original'] = {'response': response, 'confidence': r.get('confidence'), 'submitted_at': stamp}; r['skipped'] = False
        graded = grade(q, response)
        if graded: r['mcq'] = graded
    elif op == 'skip':
        if assessment: raise ValueError('In an assessment, simply move on; unanswered questions are listed before you submit.')
        if not r.get('original'): r['skipped'] = True; r['skipped_at'] = stamp
    elif op == 'reveal':
        if assessment and not submitted: raise ValueError('Solutions stay hidden until you submit the assessment.')
        if not q['solution']: raise ValueError('This question has no worked solution in the workbook.')
        if not r.get('revealed'):
            r['revealed'] = True; r['revealed_at'] = stamp; r['revealed_without_attempt'] = not r.get('original')
        result['solution'] = solution_payload(q)
    elif op == 'flag':
        r['flagged'] = payload.get('flagged') is True
    elif op == 'review':
        outcome = payload.get('outcome')
        if outcome not in OUTCOMES + (None,): raise ValueError('Choose a self-assessment.')
        if assessment and not submitted: raise ValueError('Self-assess after submitting the assessment.')
        if not assessment and not r.get('revealed'): raise ValueError('Reveal the worked solution before self-assessing.')
        r['review'] = outcome; r['reviewed_at'] = stamp
    elif op == 'checks':
        checks = payload.get('checks') or []
        if not isinstance(checks, list) or any(not isinstance(i, int) or isinstance(i, bool) or i < 0 or i > 200 for i in checks): raise ValueError('Invalid checklist.')
        r['checks'] = sorted(set(checks))
    elif op != 'confidence':
        raise ValueError('Unknown response action.')
    con.execute('INSERT OR REPLACE INTO deep_responses VALUES(?,?,?,?)', (a['id'], qid, json.dumps(r, ensure_ascii=False), stamp))
    con.execute('UPDATE deep_attempts SET updated_at=? WHERE id=?', (stamp, a['id']))
    public = {k: v for k, v in r.items() if not (assessment and not submitted and k == 'mcq')}
    public['state'] = q_state(r, assessment and not submitted)
    return {'ok': True, 'response': public, 'saved_at': stamp, **result}

def finish(con, payload):
    a = load_attempt(con, payload.get('attempt_id'))
    if a['mode'] != 'assessment': raise ValueError('Only assessments are submitted as a whole.')
    if a['status'] == 'submitted': return {'ok': True, **attempt_view(con, a['id'])}
    _, quiz = load_quiz(con, a['quiz_id'])
    qs, stamp = {q['id']: q for q in quiz['questions']}, now()
    for qid in json.loads(a['question_ids']):
        row = con.execute('SELECT data FROM deep_responses WHERE attempt_id=? AND question_id=?', (a['id'], qid)).fetchone()
        r = json.loads(row['data']) if row else None
        if not r or not has_content(r.get('draft')) or qid not in qs: continue
        r['original'] = {'response': r['draft'], 'confidence': r.get('confidence'), 'submitted_at': stamp}
        graded = grade(qs[qid], r['draft'])
        if graded: r['mcq'] = graded
        con.execute('UPDATE deep_responses SET data=?,updated_at=? WHERE attempt_id=? AND question_id=?', (json.dumps(r, ensure_ascii=False), stamp, a['id'], qid))
    con.execute("UPDATE deep_attempts SET status='submitted',submitted_at=?,updated_at=? WHERE id=?", (stamp, stamp, a['id']))
    return {'ok': True, **attempt_view(con, a['id'])}
