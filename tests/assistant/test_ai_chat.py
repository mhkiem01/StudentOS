"""AI transport regressions. Run: python -m unittest discover -s tests -t ."""
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import backend  # adds backend/<feature> folders to the import path
import ai_provider as ai


def stream(*events):
    return io.BytesIO(b''.join((json.dumps(e) + '\n').encode() for e in events))


class AITransportTests(unittest.TestCase):
    def test_empty_promise_repaired_once(self):
        def response(reply, actions):
            return {'message': {'content': json.dumps({'reply': reply, 'actions': actions})}}
        progress = []
        draft = {'type': 'timetable_import', 'events': [{'title': 'Work shift'}]}
        with patch.object(ai, '_ollama_chat', side_effect=[response("Let me prepare the actions.", []), response('Ready', [draft])]) as model:
            result = ai.chat([{'role': 'user', 'content': 'Organize my work schedule and deadlines'}], on_progress=progress.append)
        self.assertEqual(model.call_count, 2)
        self.assertEqual(result['action_status'], 'review_ready')
        self.assertEqual(result['actions'], [draft])
        self.assertEqual(progress[0]['stage'], 'repairing_actions')

    def test_empty_promise_failure_is_explicit_and_bounded(self):
        response = {'message': {'content': json.dumps({'reply': "I'll create these. Let me prepare the actions.", 'actions': []})}}
        with patch.object(ai, '_ollama_chat', return_value=response) as model:
            result = ai.chat([{'role': 'user', 'content': 'Organize my coursework deadlines, work schedule and study schedule'}])
        self.assertEqual(model.call_count, 2)
        self.assertEqual(result['action_status'], 'missing_actions')
        self.assertIn('Nothing was saved', result['reply'])
        self.assertIn('no work is continuing', result['reply'])

    def test_clarification_and_information_do_not_force_drafts(self):
        for prompt, reply, status in [('Add a study session', 'Which subject and date?', 'needs_input'),
                                      ('How do I add a reminder?', 'Use the reminders page.', 'answer_only')]:
            with self.subTest(prompt=prompt), patch.object(ai, '_ollama_chat', return_value={'message': {'content': json.dumps({'reply': reply, 'actions': []})}}) as model:
                result = ai.chat([{'role': 'user', 'content': prompt}])
                self.assertEqual(model.call_count, 1)
                self.assertEqual(result['action_status'], status)

    def test_repair_transport_failure_does_not_leave_a_promise(self):
        with patch.object(ai, '_ollama_chat', side_effect=[{'message': {'content': '{"reply":"Let me prepare the actions.","actions":[]}'}}, RuntimeError('timeout')]):
            result = ai.chat([{'role': 'user', 'content': 'Fill my timetable'}])
        self.assertEqual(result['action_status'], 'missing_actions')

    def test_generation_continues_past_old_two_minute_limit(self):
        progress = []
        source = stream({'message': {'content': '{"reply":"Hello",'}},
                        {'message': {'content': '"actions":[]}'}, 'done': True})
        with patch.object(ai.request, 'urlopen', return_value=source) as opener, patch.object(ai.time, 'monotonic', side_effect=[0, 121, 121, 122, 122]):
            result = ai.chat([{'role': 'user', 'content': 'Hello'}], on_progress=progress.append)
        self.assertEqual(result['reply'], 'Hello')
        self.assertEqual(opener.call_args.kwargs['timeout'], 600)
        self.assertTrue(progress)

    def test_qwen_structured_json_compatibility(self):
        with patch.object(ai.request, 'urlopen', return_value=stream(
                {'message': {'thinking': '{"reply":"Hello","actions":[]}'}, 'done': True})):
            self.assertEqual(ai.chat([{'role': 'user', 'content': 'Hi'}])['reply'], 'Hello')

    def test_raw_thinking_is_never_returned_as_an_answer(self):
        with patch.object(ai.request, 'urlopen', return_value=stream(
                {'message': {'thinking': 'Unstructured internal reasoning'}, 'done': True})):
            with self.assertRaisesRegex(RuntimeError, 'incomplete'):
                ai.chat([{'role': 'user', 'content': 'Hi'}])

    def test_partial_events_are_not_offered_for_import(self):
        with patch.object(ai.request, 'urlopen', return_value=stream(
                {'message': {'content': '{"actions":['}, 'done': True, 'done_reason': 'length'})):
            with self.assertRaisesRegex(RuntimeError, 'too long'):
                ai.chat([{'role': 'user', 'content': 'Hi'}])

    def test_missing_done_is_a_failure(self):
        with patch.object(ai.request, 'urlopen', return_value=stream({'message': {'content': 'partial'}})):
            with self.assertRaisesRegex(RuntimeError, 'stopped'):
                ai.chat([{'role': 'user', 'content': 'Hi'}])

    def test_timeout_is_not_reported_as_offline_and_releases_lock(self):
        with patch.object(ai.request, 'urlopen', side_effect=TimeoutError()):
            with self.assertRaisesRegex(RuntimeError, '10 minutes'):
                ai.chat([{'role': 'user', 'content': 'Hi'}])
        self.assertFalse(ai._generation_lock.locked())

    def test_status_requires_exact_model_tag(self):
        with patch.object(ai, 'config', return_value={'provider': 'ollama', 'model': 'qwen3-vl:8b', 'ollama_url': 'http://127.0.0.1:11434'}), patch.object(ai.request, 'urlopen', return_value=io.BytesIO(b'{"models":[{"name":"qwen3-vl:4b"}]}')):
            status = ai.status()
        self.assertTrue(status['online'])
        self.assertFalse(status['ready'])


if __name__ == '__main__':
    unittest.main()
