"""Deep Practice import, matching, storage and attempt rules, using the supplied COMP1521 workbook as the fixture."""
import json, re, sqlite3, tempfile, unittest
from pathlib import Path
import backend  # adds backend/<feature> folders to the import path
import deep_practice as dp

SOURCE = (Path(__file__).parent / 'fixtures' / 'COMP1521_Part_1_Workbook.md').read_text(encoding='utf-8')
MCQS = ['P1-002', 'P1-005', 'P1-008', 'P1-014', 'P1-016', 'P1-020', 'P1-021', 'P1-024', 'P1-028', 'P1-031', 'P1-041']


class ParserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.quiz, cls.report = dp.parse(SOURCE)
        cls.q = {q['id']: q for q in cls.quiz['questions']}

    def test_all_48_questions_match_answers_and_11_mcqs(self):
        c = self.report['counts']
        self.assertEqual((c['questions'], c['matched'], c['answers'], c['mcq'], c['graded_mcq']), (48, 48, 48, 11, 11))
        self.assertEqual([q['id'] for q in self.quiz['questions']], [f'P1-{n:03d}' for n in range(1, 49)])
        self.assertEqual(sorted(k for k, q in self.q.items() if q['type'] == 'mcq'), MCQS)
        self.assertEqual(sum(1 for q in self.quiz['questions'] if q['type'] != 'mcq'), 37)
        self.assertTrue(all(q['solution'] and q['solution']['answer'].strip() for q in self.quiz['questions']))
        self.assertEqual(self.report['status'], 'complete')
        self.assertEqual([i for i in self.report['issues'] if i['level'] != 'info'], [])
        # Nothing is silently dropped: every non-blank line of the workbook was placed somewhere.
        self.assertEqual(c['unplaced_lines'], 0)

    def test_ids_order_topics_difficulty_and_stages(self):
        self.assertEqual([t['name'] for t in self.quiz['topics']], ['Registers and memory', 'I/O and arithmetic', 'Branches and state', 'Loops',
                                                                   'Testing and source reading', 'Cumulative practice', 'Part 1 mastery assessment'])
        self.assertEqual(sum(t['count'] for t in self.quiz['topics']), 48)
        # Topics repeat later in the file; each question keeps the heading above it.
        self.assertEqual({k: self.q[k]['topic'] for k in ('P1-011', 'P1-012', 'P1-036', 'P1-037', 'P1-039', 'P1-040', 'P1-044', 'P1-048')},
                         {'P1-011': 'Registers and memory', 'P1-012': 'I/O and arithmetic', 'P1-036': 'Loops', 'P1-037': 'Branches and state',
                          'P1-039': 'I/O and arithmetic', 'P1-040': 'Branches and state', 'P1-044': 'Testing and source reading', 'P1-048': 'Part 1 mastery assessment'})
        self.assertEqual((self.q['P1-001']['difficulty'], self.q['P1-001']['stage']), ('Foundation', 'Recall'))
        self.assertEqual((self.q['P1-047']['difficulty'], self.q['P1-047']['stages']), ('Challenging', ['Transfer', 'Integration']))
        self.assertEqual(self.report['counts']['difficulties'], {'Foundation': 11, 'Developing': 28, 'Challenging': 9})
        self.assertEqual([q['order'] for q in self.quiz['questions']], list(range(48)))

    def test_code_newlines_tables_symbols_and_inline_code_stay_readable(self):
        self.assertIn('```c\nint total=0, i=1;\nwhile (i<=5) {\n    if (i==4) break;\n    total += i;\n    i++;\n}\n```', self.q['P1-031']['prompt'])
        self.assertIn('```mips\nrender_impacts__y_off_step:\n    add $s1, $s1, 1\n    b   render_impacts__y_off_end\n```\nThe C reference loops', self.q['P1-044']['prompt'])
        self.assertIn('```mips\nla   $t0, score\nlw   $t1, 0($t0)', self.q['P1-003']['prompt'])
        answer = self.q['P1-047']['solution']['answer']
        self.assertTrue(answer.startswith('Simplified C:\n```c\ni=lo+1;'))
        self.assertIn('printf("%d\\n", i);', answer)
        self.assertIn("MIPS:\n```mips\n.text\nmain:\n    li   $v0, 5", answer)
        self.assertTrue(answer.endswith('```\nMap: $t0=lo, $t1=hi, $t2=i, $t3=remainder.'))
        self.assertIn('```\n(5,5) → 5; (−8,−3) → −3.', self.q['P1-038']['solution']['answer'])
        self.assertIn('```shell\n1521 fetch lab03\n1521 mipsy practice.s < cases.txt', self.q['P1-042']['solution']['answer'])
        self.assertIn('2² = 4', self.q['P1-006']['solution']['answer'])
        self.assertEqual([c['markdown'] for c in self.q['P1-014']['choices']][3], '`li $v0, 11; li $a0, 10; syscall`')
        coverage = self.quiz['sections'][0]
        self.assertEqual((coverage['title'], coverage['kind']), ('Coverage map', 'coverage'))
        table = [l for l in coverage['markdown'].split('\n') if l.startswith('|')]
        self.assertEqual(len(table), 12)
        self.assertEqual(table[0], '| Part | Topics and related work | Skills to demonstrate independently | Status |')
        self.assertIn('Notes §§1–38', coverage['markdown'])
        self.assertEqual([s['kind'] for s in self.quiz['sections']], ['coverage', 'intro', 'source', 'assumptions', 'study'])
        self.assertEqual(len(self.quiz['checklist']['items']), 12)
        self.assertIn('Covered: Part 1 foundations', self.quiz['checklist']['notes'])
        self.assertIn('Attempt the questions before reading further', self.quiz['answers_intro'])

    def test_answer_parts_and_option_explanations(self):
        s = self.q['P1-002']['solution']
        self.assertEqual(self.q['P1-002']['answer_key'], ['B'])
        self.assertEqual(s['option_explanations'], {'A': 'loads 37.', 'C': 'reads the stored 37.', 'D': 'copies an unspecified register.'})
        s = self.q['P1-001']['solution']
        self.assertTrue(s['explain'].startswith('Registers are CPU storage'))
        self.assertEqual(s['key_rule'], 'Track both the location of a value and what its bits represent.')
        self.assertTrue(s['mistakes'].startswith('Saved registers are not automatically saved'))
        self.assertEqual(s['check_items'], ['Name all eight roles and explain why a pointer in $t0 differs from the word at that address.'])

    def test_types_are_inferred_with_reasons(self):
        expect = {'P1-029': ('fill_blank', 'mixed'), 'P1-010': ('debug', 'mixed'), 'P1-036': ('implementation', 'mixed'), 'P1-034': ('trace', 'code'),
                  'P1-001': ('explain', 'text'), 'P1-004': ('recall', 'text'), 'P1-002': ('mcq', 'selection')}
        self.assertEqual({k: (self.q[k]['type'], self.q[k]['format']) for k in expect}, expect)
        self.assertEqual((self.q['P1-029']['blanks'], self.q['P1-029']['blanks_in_code']), (4, 4))
        self.assertEqual((self.q['P1-047']['language'], self.q['P1-042']['language'], self.q['P1-033']['language']), ('mips', 'shell', 'c'))
        self.assertTrue(all(q['inferred']['reason'] and q['inferred']['confidence'] in ('high', 'medium', 'low') for q in self.quiz['questions']))
        low = [i['id'] for i in self.report['issues'] if i['code'] == 'low_confidence_type']
        self.assertTrue(low and all(self.q[i]['inferred']['confidence'] == 'low' for i in low))


class ValidationTests(unittest.TestCase):
    def codes(self, source):
        quiz, report = dp.parse(source)
        return report, {(i['code'], i['id']) for i in report['issues']}

    def test_duplicate_question_ids_block_saving_with_lines(self):
        report, codes = self.codes(SOURCE.replace('P1-013 · Developing · Debugging', 'P1-012 · Developing · Debugging'))
        self.assertEqual(report['status'], 'blocked')
        self.assertIn(('duplicate_question', 'P1-012'), codes)
        self.assertIn(('orphan_answer', 'P1-013'), codes)
        self.assertIn(('missing_id', 'P1-013'), codes)
        message = next(i['message'] for i in report['issues'] if i['code'] == 'duplicate_question')
        self.assertIn('lines 122 and 124', message)

    def test_missing_answer_orphan_answer_and_bad_key(self):
        report, codes = self.codes(SOURCE.replace('\nP1-020\nAnswer:\n\nA\n', '\n'))
        self.assertEqual((report['status'], report['counts']['matched']), ('incomplete', 47))
        self.assertIn(('missing_answer', 'P1-020'), codes)
        extra = SOURCE.replace('Part 1 — Independence checklist', 'P1-099\nAnswer:\n\nExtra\nPart 1 — Independence checklist')
        report, codes = self.codes(extra)
        self.assertIn(('orphan_answer', 'P1-099'), codes)
        report, codes = self.codes(SOURCE.replace('P1-005\nAnswer:\n\nC\n', 'P1-005\nAnswer:\n\nE\n'))
        self.assertEqual(report['status'], 'blocked')
        self.assertIn(('answer_not_a_choice', 'P1-005'), codes)
        report, codes = self.codes(SOURCE.replace('Part 1 — Independence checklist', 'P1-001\nAnswer:\n\nAgain\nPart 1 — Independence checklist'))
        self.assertIn(('duplicate_answer', 'P1-001'), codes)

    def test_dropped_question_header_is_reported(self):
        report, codes = self.codes(SOURCE.replace('P1-021 · Developing · Application\n', 'P1-021 Developing Application\n'))
        self.assertIn(('missing_id', 'P1-021'), codes)
        self.assertIn(('orphan_answer', 'P1-021'), codes)

    def test_embedded_html_is_reported_and_kept_as_text(self):
        report, codes = self.codes(SOURCE.replace('Question: How many bytes does .asciiz', 'Question: <img src=x onerror=alert(1)> How many bytes does .asciiz'))
        self.assertIn(('html', None), codes)
        quiz, _ = dp.parse(SOURCE.replace('Question: How many bytes', 'Question: <script>alert(1)</script> How many bytes'))
        self.assertIn('<script>alert(1)</script>', quiz['questions'][4]['prompt'])  # kept as text; the browser renderer escapes it

    def test_standard_markdown_workbook(self):
        source = '# Mini workbook\n## Topic A\n### Q-1 · Foundation · Recall\nQuestion: Name it.\n\n## Questions\n'
        source = '# Mini workbook\n\nIntro text here.\n\n## Questions\n### Topic A\nQ-1 · Easy · Recall\nQuestion: What is `x`?\n```python\nx = 1\n```\n## Answers\nQ-1\nAnswer: 1\nExplain: Assigned.\n'
        quiz, report = dp.parse(source)
        self.assertEqual((quiz['title'], report['counts']['questions'], report['counts']['matched']), ('Mini workbook', 1, 1))
        self.assertIn('```python\nx = 1\n```', quiz['questions'][0]['prompt'])
        self.assertEqual(quiz['questions'][0]['topic'], 'Topic A')

    def test_no_questions_is_an_error(self):
        with self.assertRaises(ValueError): dp.parse('Just some notes without questions.')
        with self.assertRaises(ValueError): dp.parse('')


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); path = Path(self.tmp.name) / 'workspace.db'
        dp.migrate(path); self.con = sqlite3.connect(path); self.con.row_factory = sqlite3.Row; self.con.execute('PRAGMA foreign_keys=ON')
        self.quiz_id = self.w({'action': 'import', 'source': SOURCE, 'source_name': 'COMP1521_Part_1_Workbook.md', 'overrides': {'P1-007': {'type': 'explain'}, 'P1-008': {'type': 'bogus'}}})['id']

    def tearDown(self): self.con.close(); self.tmp.cleanup()

    def w(self, payload):
        with self.con: return dp.write(self.con, payload)

    def start(self, mode='practice', scope=None): return self.w({'action': 'start', 'quiz_id': self.quiz_id, 'mode': mode, 'scope': scope or {'kind': 'all'}})['attempt']['id']
    def r(self, attempt, qid, op, **extra): return self.w({'action': 'response', 'attempt_id': attempt, 'question_id': qid, 'op': op, **extra})

    def test_import_keeps_source_overrides_and_hides_solutions(self):
        view = self.w({'action': 'open', 'quiz_id': self.quiz_id})
        payload = json.dumps(view, ensure_ascii=False)
        self.assertNotIn('Zero constant; temporary', payload)
        self.assertNotIn('answer_key', payload)
        self.assertNotIn('Why other options', payload)
        q = {x['id']: x for x in view['quiz']['questions']}
        self.assertEqual((q['P1-007']['type'], q['P1-008']['type']), ('explain', 'mcq'))
        self.assertEqual(view['overrides'], {'P1-007': {'type': 'explain'}})
        self.assertEqual(self.w({'action': 'source', 'quiz_id': self.quiz_id})['source'], SOURCE)
        library = dp.state(self.con)['quizzes'][0]
        self.assertEqual((library['questions'], library['status'], library['summary']['not_started']), (48, 'complete', 48))
        self.assertNotIn('Zero constant', json.dumps(library))

    def test_practice_drafts_submit_reveal_and_revision_keep_the_original(self):
        a = self.start()
        self.assertEqual(self.w({'action': 'attempt', 'attempt_id': a})['solutions'], {})
        self.r(a, 'P1-001', 'draft', response={'text': 'first draft'})
        self.assertEqual(self.w({'action': 'attempt', 'attempt_id': a})['responses']['P1-001']['draft']['text'], 'first draft')
        self.r(a, 'P1-001', 'confidence', confidence='partly')
        done = self.r(a, 'P1-001', 'submit', response={'text': 'my original answer'})
        self.assertNotIn('mcq', done['response'])  # open responses are never auto-graded
        with self.assertRaises(ValueError): self.r(a, 'P1-001', 'submit', response={'text': 'again'})
        with self.assertRaises(ValueError): self.r(a, 'P1-001', 'review', outcome='independent')  # reveal first
        revealed = self.r(a, 'P1-001', 'reveal')
        self.assertIn('Zero constant', revealed['solution']['answer'])
        self.assertFalse(revealed['response']['revealed_without_attempt'])
        self.r(a, 'P1-001', 'draft', response={'text': 'edited after seeing the solution'})
        r = self.w({'action': 'attempt', 'attempt_id': a})['responses']['P1-001']
        self.assertEqual(r['original']['response']['text'], 'my original answer')
        self.assertEqual(r['original']['confidence'], 'partly')
        self.assertEqual((r['revision']['response']['text'], r['revision']['after_reveal']), ('edited after seeing the solution', True))
        self.r(a, 'P1-001', 'review', outcome='independent')
        self.assertEqual(self.w({'action': 'attempt', 'attempt_id': a})['responses']['P1-001']['state'], 'independent')
        # Revealing without answering is allowed but recorded as such.
        self.assertTrue(self.r(a, 'P1-003', 'reveal')['response']['revealed_without_attempt'])
        with self.assertRaises(ValueError): self.r(a, 'P1-004', 'submit', response={'text': '   '})
        self.r(a, 'P1-004', 'skip')
        self.r(a, 'P1-006', 'submit', response={'text': 'aligns to 4'})
        # Multiple choice with a key is graded; a wrong choice needs review.
        self.assertTrue(self.r(a, 'P1-002', 'submit', response={'selected': ['B']})['response']['mcq']['correct'])
        self.assertFalse(self.r(a, 'P1-005', 'submit', response={'selected': ['A']})['response']['mcq']['correct'])
        with self.assertRaises(ValueError): self.r(a, 'P1-008', 'submit', response={'selected': ['Z']})
        with self.assertRaises(ValueError): self.r(a, 'P1-009', 'draft', response={'html': 'x'})
        s = self.w({'action': 'open', 'quiz_id': self.quiz_id})['summary']
        self.assertEqual((s['mcq_answered'], s['mcq_correct'], s['awaiting_review'], s['revealed_without_attempt'], s['skipped']), (2, 1, 1, 1, 1))
        self.assertEqual(s['outcomes'], {'independent': 1, 'partial': 0, 'needs_practice': 0})
        self.assertEqual(sorted(s['review_ids']), ['P1-003', 'P1-005'])
        self.assertEqual(s['topics_needing_work'], [{'topic': 'Registers and memory', 'questions': 2}])
        self.assertEqual({s['states'][k] for k in ('P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005', 'P1-006')}, {'independent', 'correct', 'revealed', 'skipped', 'needs_review', 'submitted'})
        self.assertEqual((s['states']['P1-003'], s['states']['P1-005']), ('revealed', 'needs_review'))
        self.assertNotIn('master', json.dumps(s).lower())

    def test_assessment_hides_feedback_until_submitted(self):
        a = self.start('assessment', {'kind': 'topic', 'topic': 'Registers and memory'})
        self.assertEqual(len(self.w({'action': 'attempt', 'attempt_id': a})['attempt']['question_ids']), 11)
        saved = self.r(a, 'P1-002', 'draft', response={'selected': ['B']})
        self.assertNotIn('mcq', saved['response'])
        self.r(a, 'P1-001', 'draft', response={'text': 'roles'})
        for op in ('reveal', 'submit', 'skip'):
            with self.assertRaises(ValueError): self.r(a, 'P1-002', op, response={'selected': ['B']})
        view = self.w({'action': 'attempt', 'attempt_id': a})
        self.assertEqual((view['solutions'], view['summary']), ({}, None))
        self.assertNotIn('correct', json.dumps(view['responses']))
        done = self.w({'action': 'finish', 'attempt_id': a})
        self.assertEqual(done['attempt']['status'], 'submitted')
        self.assertEqual(len(done['solutions']), 11)
        self.assertTrue(done['responses']['P1-002']['mcq']['correct'])
        self.assertEqual(done['responses']['P1-001']['original']['response']['text'], 'roles')
        self.assertEqual(done['summary']['not_started'], 9)
        with self.assertRaises(ValueError): self.r(a, 'P1-003', 'draft', response={'text': 'late'})
        self.r(a, 'P1-001', 'review', outcome='partial')

    def test_fresh_attempt_keeps_history_and_review_scope(self):
        first = self.start()
        self.r(first, 'P1-005', 'submit', response={'selected': ['A']})
        self.r(first, 'P1-010', 'flag', flagged=True)
        second = self.start()
        view = self.w({'action': 'open', 'quiz_id': self.quiz_id})
        self.assertEqual([(x['id'], x['status']) for x in view['attempts']], [(second, 'active'), (first, 'closed')])
        with self.assertRaises(ValueError): self.r(first, 'P1-006', 'draft', response={'text': 'old'})
        review = self.w({'action': 'start', 'quiz_id': self.quiz_id, 'mode': 'practice', 'scope': {'kind': 'review'}})['attempt']
        self.assertEqual(review['question_ids'], ['P1-005', 'P1-010'])
        filtered = self.w({'action': 'start', 'quiz_id': self.quiz_id, 'mode': 'practice', 'scope': {'kind': 'filter', 'difficulty': 'Challenging', 'type': 'implementation'}})['attempt']
        self.assertEqual(filtered['question_ids'], ['P1-036', 'P1-037', 'P1-040', 'P1-045', 'P1-046', 'P1-047', 'P1-048'])
        with self.assertRaises(ValueError): self.w({'action': 'start', 'quiz_id': self.quiz_id, 'mode': 'practice', 'scope': {'kind': 'topic', 'topic': 'Nope'}})

    def test_checklist_reprocess_versions_and_delete(self):
        self.w({'action': 'checklist', 'quiz_id': self.quiz_id, 'item': 0, 'checked': True})
        with self.assertRaises(ValueError): self.w({'action': 'checklist', 'quiz_id': self.quiz_id, 'item': 12, 'checked': True})
        self.assertEqual(self.w({'action': 'open', 'quiz_id': self.quiz_id})['checklist'][:2], [True, False])
        a = self.start()
        changed = SOURCE.replace('Question: Match $zero', 'Question: Carefully match $zero')
        view = self.w({'action': 'reprocess', 'quiz_id': self.quiz_id, 'source': changed})
        self.assertEqual((view['content_version'], view['overrides']), (2, {'P1-007': {'type': 'explain'}}))
        self.assertTrue(self.w({'action': 'attempt', 'attempt_id': a})['attempt']['stale'])
        self.assertEqual(self.w({'action': 'source', 'quiz_id': self.quiz_id})['source'], changed)
        self.w({'action': 'update', 'quiz_id': self.quiz_id, 'title': 'COMP1521 Part 1', 'subject_id': 'computing', 'overrides': {'P1-001': {'format': 'code', 'language': 'c'}}})
        view = self.w({'action': 'open', 'quiz_id': self.quiz_id})
        self.assertEqual((view['quiz']['title'], view['subject_id'], view['content_version']), (dp.parse(changed)[0]['title'], 'computing', 2))
        self.assertEqual(dp.state(self.con)['quizzes'][0]['title'], 'COMP1521 Part 1')
        self.w({'action': 'delete', 'quiz_id': self.quiz_id})
        for table in ('deep_quizzes', 'deep_attempts', 'deep_responses', 'deep_checklist'):
            self.assertEqual(self.con.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0], 0, table)

    def test_blocked_import_is_refused(self):
        with self.assertRaises(ValueError): self.w({'action': 'import', 'source': SOURCE.replace('P1-013 · Developing', 'P1-012 · Developing')})
        preview = self.w({'action': 'preview', 'source': SOURCE})
        self.assertEqual((preview['report']['status'], len(preview['quiz']['questions'])), ('complete', 48))
        self.assertNotIn('Zero constant', json.dumps(preview, ensure_ascii=False))


if __name__ == '__main__':
    unittest.main()
