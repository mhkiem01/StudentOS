"""AI code-review plumbing for CTF challenges (everything except the network call)."""
import json, sqlite3, unittest
import backend  # adds backend/<feature> folders to the import path
import server, ctf_store
from tests.study import test_ctf as base  # reuse the harness without re-collecting its tests
IMPORT = base.IMPORT


class CtfReviewTests(unittest.TestCase):
    setUp = base.CtfTests.setUp
    tearDown = base.CtfTests.tearDown
    w = base.CtfTests.w
    state = base.CtfTests.state

    def make(self):
        return self.w('import', {'topic_name': 'Overflows', 'text': IMPORT})['ids'][0]

    def challenge(self, cid):
        return next(c for c in self.state()['challenges'] if c['id'] == cid)

    def test_code_autosaves_and_shows_in_view(self):
        cid = self.make()
        self.w('code', {'code': 'from pwn import *\nio=remote("x",1)'}, cid)
        p = self.challenge(cid)['progress']
        self.assertIn('from pwn import *', p['solution_code'])
        self.assertIsNone(p['review'])

    def test_review_context_saves_code_but_withholds_flag_and_solution(self):
        cid = self.make()
        with server.connect() as c:
            ctx = ctf_store.review_context(c, cid, 'payload=b"A"*72')
        self.assertEqual(ctx['title'], 'Return address offset')
        self.assertIn('saved return address', ctx['description'])
        blob = json.dumps(ctx).lower()
        self.assertNotIn('flag{72}', blob)             # the real flag never reaches the reviewer
        self.assertNotIn('64 bytes of buffer', blob)   # nor the written solution
        self.assertIn('payload=b"A"*72', ctx['code'])
        self.assertIn('payload', self.challenge(cid)['progress']['solution_code'])  # the code is persisted

    def test_review_prompt_builds_and_rejects_empty_code(self):
        cid = self.make()
        with server.connect() as c:
            with self.assertRaisesRegex(ValueError, 'Write your solution'):
                ctf_store.review_prompt(ctf_store.review_context(c, cid, '   '))
            system, messages, schema = ctf_store.review_prompt(ctf_store.review_context(c, cid, 'solve'))
        self.assertIn('never reveal', system.lower())   # must forbid leaking the flag
        self.assertEqual(schema['required'], ['verdict', 'summary'])
        self.assertIn('student_code', messages[0]['content'])

    def test_normalize_review_coerces_verdict_and_issue_shapes(self):
        out = ctf_store.normalize_review(
            {'verdict': 'bogus', 'summary': 'ok', 'next_step': 'rerun',
             'issues': ['too short', {'problem': 'wrong offset', 'fix': 'use 72'}]},
            {'model': 'qwen2.5-coder:7b'})
        self.assertEqual(out['verdict'], 'close')        # unknown verdict -> close
        self.assertEqual(out['issues'][0], {'problem': 'too short', 'fix': ''})
        self.assertEqual(out['issues'][1], {'problem': 'wrong offset', 'fix': 'use 72'})
        self.assertEqual(out['model'], 'qwen2.5-coder:7b')

    def test_save_review_round_trips_the_way_the_server_calls_it(self):
        cid = self.make()
        def fake_run(role, system, messages, schema):   # stands in for llm_router.run
            return ({'verdict': 'close', 'summary': 'Right idea, wrong padding.',
                     'issues': [{'problem': 'offset is 64', 'fix': 'it is 72'}], 'next_step': 'fix and rerun'},
                    {'provider': 'local', 'model': 'qwen2.5-coder:7b'})
        with server.connect() as c:
            ctx = ctf_store.review_context(c, cid, 'payload=b"A"*64')
        result, meta = fake_run('ctf_review', *ctf_store.review_prompt(ctx))
        review = ctf_store.normalize_review(result, meta)
        with server.connect() as c:
            ch = ctf_store.save_review(c, cid, review)
        self.assertEqual(ch['progress']['review']['verdict'], 'close')
        self.assertEqual(ch['progress']['review']['model'], 'qwen2.5-coder:7b')
        self.assertEqual(self.challenge(cid)['progress']['review']['issues'][0]['fix'], 'it is 72')  # persists

    def test_migration_adds_columns_to_pre_existing_tables(self):
        try:
            with server.connect() as c:
                c.execute('ALTER TABLE ctf_progress DROP COLUMN solution_code')
                c.execute('ALTER TABLE ctf_progress DROP COLUMN review_json')
        except sqlite3.OperationalError:
            self.skipTest('this SQLite build cannot DROP COLUMN')
        ctf_store.migrate(server.database_path())
        cid = self.make()
        self.w('code', {'code': 'x=1'}, cid)
        self.assertEqual(self.challenge(cid)['progress']['solution_code'], 'x=1')


if __name__ == '__main__':
    unittest.main()
