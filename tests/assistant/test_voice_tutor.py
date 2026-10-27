"""Voice tutor grounding and answer checking. Run: python -m unittest discover -s tests -t ."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import backend  # adds backend/<feature> folders to the import path
import voice_tutor

NOTES = [
    {'title': 'MIPS memory', 'content_format': 'html',
     'content': '<h2>Memory instructions</h2><p>lb loads one byte into a register.</p><p>sb stores one byte to memory.</p>'
                '<p>print("Hello World") example</p>'},
    {'title': 'MIPS loops', 'content_format': 'markdown',
     'content': 'A for loop uses a condition label, bge to exit, and j to jump back to the loop condition.'},
]
ANSWER = {'answer': 'lb loads a byte and sb stores a byte.', 'code': '', 'in_notes': True}
ANSWERER = {'provider': 'local', 'model': 'answer-model'}
CHECKER = {'provider': 'local', 'model': 'check-model'}


class FakeModels:
    """Stands in for llm_router.run: queued replies per role, every call recorded."""
    def __init__(self, answers, checks=(), checker=True):
        self.replies = {'voice_answer': list(answers), 'voice_check': list(checks)}
        self.calls, self.checker = [], checker

    def run(self, role, system, messages, schema, avoid=None):
        self.calls.append((role, messages))
        self.avoided = avoid
        reply = self.replies[role].pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply, ANSWERER if role == 'voice_answer' else CHECKER

    def payload(self, index=0):
        return json.loads(self.calls[index][1][-1]['content'])

    def __enter__(self):
        self.patches = [patch.object(voice_tutor.llm_router, 'run', self.run),
                        patch.object(voice_tutor.llm_router, 'available', lambda role: role != 'voice_check' or self.checker)]
        for p in self.patches:
            p.start()
        return self

    def __exit__(self, *exc):
        for p in self.patches:
            p.stop()


class GroundingTests(unittest.TestCase):
    def test_spoken_letters_join_into_instruction_names(self):
        self.assertEqual(voice_tutor.terms('what does l b and s b do'), ['lb', 'sb'])
        self.assertEqual(voice_tutor.terms('how do loops work'), ['loop'])

    def test_off_topic_question_never_reaches_a_model(self):
        with FakeModels([]) as models:
            result = voice_tutor.ask(NOTES, 'who won the 2022 world cup?', 'COMP1521')
        self.assertEqual(models.calls, [])
        self.assertFalse(result['in_notes'])
        self.assertIn('COMP1521', result['answer'])

    def test_model_sees_only_matching_note_excerpts(self):
        with FakeModels([ANSWER], [{'supported': True, 'issues': ''}]) as models:
            result = voice_tutor.ask(NOTES, 'What do LB and SB do?')
        self.assertEqual([e['note'] for e in models.payload()['excerpts']], ['MIPS memory'])
        self.assertEqual(result['sources'], ['MIPS memory'])

    def test_follow_up_reuses_previous_question_topic(self):
        history = [{'role': 'user', 'content': 'how do loops work in mips'}, {'role': 'assistant', 'content': 'They use labels.'}]
        with FakeModels([ANSWER], [{'supported': True, 'issues': ''}]) as models:
            voice_tutor.ask(NOTES, 'can you give me an example?', history=history)
        self.assertEqual(models.payload()['excerpts'][0]['note'], 'MIPS loops')

    def test_not_in_notes_reply_is_replaced_and_not_checked(self):
        leaky = {'answer': "That isn't in the notes, but a cache line is 64 bytes.", 'code': 'li $t0, 1', 'in_notes': False}
        with FakeModels([leaky]) as models:
            result = voice_tutor.ask(NOTES, 'what does lb do to the cache?')
        self.assertEqual([role for role, _ in models.calls], ['voice_answer'])
        self.assertEqual((result['code'], result['sources']), ('', []))
        self.assertNotIn('64 bytes', result['answer'])

    def test_quiz_explanation_is_sent_with_the_question(self):
        quiz = {'question': 'Which instruction stores one byte?', 'choices': {'A': 'lb', 'B': 'sb'}, 'answer': 'B', 'chosen': 'A', 'explain': ''}
        with FakeModels([ANSWER], [{'supported': True, 'issues': ''}]) as models:
            voice_tutor.ask(NOTES, 'Why is B correct?', quiz=quiz)
        self.assertEqual(models.payload()['quiz_question']['chosen'], 'A')

    def test_empty_question_is_rejected(self):
        with self.assertRaises(ValueError):
            voice_tutor.ask(NOTES, '  ')


class CheckerTests(unittest.TestCase):
    def test_supported_answer_is_verified_and_labelled(self):
        with FakeModels([ANSWER], [{'supported': True, 'issues': ''}]) as models:
            result = voice_tutor.ask(NOTES, 'what does lb do')
        self.assertEqual([role for role, _ in models.calls], ['voice_answer', 'voice_check'])
        self.assertEqual(models.payload(1)['answer'], ANSWER['answer'])
        self.assertEqual(models.payload(1)['excerpts'], models.payload(0)['excerpts'])
        self.assertIs(result['verified'], True)
        self.assertEqual(models.avoided, ANSWERER)  # the checker steers away from the author
        self.assertEqual((result['answered_by'], result['checked_by']), ('local · answer-model', 'local · check-model'))

    def test_rejected_answer_is_rewritten_once_with_the_issues(self):
        wrong = {'answer': 'lb loads a word.', 'code': '', 'in_notes': True}
        with FakeModels([wrong, ANSWER], [{'supported': False, 'issues': 'lb loads a byte, not a word'},
                                          {'supported': True, 'issues': ''}]) as models:
            result = voice_tutor.ask(NOTES, 'what does lb do')
        self.assertEqual([role for role, _ in models.calls], ['voice_answer', 'voice_check', 'voice_answer', 'voice_check'])
        self.assertIn('not a word', models.calls[2][1][-1]['content'])
        self.assertEqual((result['answer'], result['verified']), (ANSWER['answer'], True))

    def test_answer_still_rejected_after_rewrite_is_flagged(self):
        wrong = {'answer': 'lb loads a word.', 'code': '', 'in_notes': True}
        rejected = {'supported': False, 'issues': 'wrong size'}
        with FakeModels([wrong, wrong], [rejected, rejected]) as models:
            result = voice_tutor.ask(NOTES, 'what does lb do')
        self.assertEqual(len(models.calls), 4)
        self.assertIs(result['verified'], False)

    def test_rewrite_can_turn_into_an_honest_refusal(self):
        wrong = {'answer': 'lb loads a word.', 'code': '', 'in_notes': True}
        refusal = {'answer': 'Not covered.', 'code': '', 'in_notes': False}
        with FakeModels([wrong, refusal], [{'supported': False, 'issues': 'unsupported'}]) as models:
            result = voice_tutor.ask(NOTES, 'what does lb do')
        self.assertEqual(len(models.calls), 3)  # the refusal itself is not re-checked
        self.assertFalse(result['in_notes'])
        self.assertIn("isn't covered", result['answer'])

    def test_no_checker_configured_means_unchecked_not_blocked(self):
        with FakeModels([ANSWER], checker=False) as models:
            result = voice_tutor.ask(NOTES, 'what does lb do')
        self.assertEqual(len(models.calls), 1)
        self.assertEqual((result['verified'], result['checked_by']), (None, None))

    def test_failing_checker_does_not_block_the_answer(self):
        down = voice_tutor.llm_router.AllModelsFailed('Every AI model for "voice_check" failed.')
        with FakeModels([ANSWER], [down]):
            result = voice_tutor.ask(NOTES, 'what does lb do')
        self.assertEqual((result['answer'], result['verified']), (ANSWER['answer'], None))

    def test_failing_answer_models_raise_a_readable_error(self):
        down = voice_tutor.llm_router.AllModelsFailed('Every AI model for "voice_answer" failed. local qwen: Cannot connect to Ollama.')
        with FakeModels([down]):
            with self.assertRaisesRegex(RuntimeError, 'Cannot connect to Ollama'):
                voice_tutor.ask(NOTES, 'what does lb do')


LONG_NOTES = [
    {'id': 'n1', 'title': 'MIPS memory', 'content_format': 'markdown', 'topic_name': 'MIPS',
     'content': 'lb loads one byte from memory into a register and sign-extends it. ' * 6},
    {'id': 'n2', 'title': 'MIPS loops', 'content_format': 'markdown', 'topic_name': 'MIPS',
     'content': 'A loop checks its condition, branches to the end when it fails, then jumps back. ' * 6},
]
QUESTION = {'question': 'What does lb do?', 'answer': 'It loads one byte into a register.', 'key_points': ['loads one byte', ' ']}


class PracticeTests(unittest.TestCase):
    def test_question_comes_from_one_unused_passage(self):
        used = [p['id'] for p in voice_tutor.chunks(LONG_NOTES) if p['title'] == 'MIPS memory']
        with FakeModels([]) as models:
            models.replies['voice_question'] = [QUESTION]
            result = voice_tutor.practice_question(LONG_NOTES, 'COMP1521', 'MIPS', used=used, asked=['Earlier question?'])
        payload = models.payload()
        self.assertEqual(payload['excerpt']['note'], 'MIPS loops')  # the used passage is skipped
        self.assertEqual(payload['previous_questions'], ['Earlier question?'])
        self.assertEqual((result['source'], result['key_points']), ('MIPS loops', ['loads one byte']))
        self.assertTrue(result['chunk'].startswith('n2#'))

    def test_all_passages_used_starts_a_new_round(self):
        used = [p['id'] for p in voice_tutor.chunks(LONG_NOTES)]
        with FakeModels([]) as models:
            models.replies['voice_question'] = [QUESTION]
            result = voice_tutor.practice_question(LONG_NOTES, used=used)
        self.assertIn(result['source'], ('MIPS memory', 'MIPS loops'))

    def test_no_notes_is_a_clear_error_without_a_model_call(self):
        with FakeModels([]) as models, self.assertRaisesRegex(ValueError, 'no notes in MIPS'):
            voice_tutor.practice_question([], 'COMP1521', 'MIPS')
        self.assertEqual(models.calls, [])

    def test_grading_sends_the_passage_and_student_answer(self):
        question = {**QUESTION, 'excerpt': 'lb loads one byte.'}
        with FakeModels([]) as models:
            models.replies['voice_grade'] = [{'verdict': 'partial', 'feedback': 'You missed that it is one byte.'}]
            result = voice_tutor.grade_answer(question, 'it loads something')
        payload = models.payload()
        self.assertEqual((payload['excerpt'], payload['student_answer']), ('lb loads one byte.', 'it loads something'))
        self.assertEqual((result['verdict'], result['answer']), ('partial', QUESTION['answer']))

    def test_correct_answer_has_no_feedback_to_read_out(self):
        with FakeModels([]) as models:
            models.replies['voice_grade'] = [{'verdict': 'correct', 'feedback': 'Well done, that is right.'}]
            result = voice_tutor.grade_answer(QUESTION, 'it loads a byte')
        self.assertEqual((result['verdict'], result['feedback']), ('correct', ''))

    def test_skipped_answer_reveals_the_model_answer_without_a_model_call(self):
        with FakeModels([]) as models:
            result = voice_tutor.grade_answer(QUESTION, '   ')
        self.assertEqual(models.calls, [])
        self.assertEqual(result['verdict'], 'incorrect')
        self.assertIn(QUESTION['answer'], result['feedback'])

    def test_grade_schema_rejects_made_up_verdicts(self):
        with self.assertRaises(ValueError):
            voice_tutor.llm_router.validate({'verdict': 'excellent', 'feedback': ''}, voice_tutor.GRADE_SCHEMA)


if __name__ == '__main__':
    unittest.main()
