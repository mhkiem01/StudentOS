"""Model routing and fallback. Run: python -m unittest discover -s tests -t ."""
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib import error

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import backend  # adds backend/<feature> folders to the import path
import llm_router

SCHEMA = {'type': 'object', 'properties': {'answer': {'type': 'string'}, 'ok': {'type': 'boolean'}},
          'required': ['answer', 'ok'], 'additionalProperties': False}
CONFIG = {
    'providers': {
        'local': {'type': 'ollama'},
        'cloud': {'type': 'openai_compatible', 'base_url': 'https://cloud.test/v1/', 'api_key_env': 'TEST_CLOUD_KEY'},
    },
    'roles': {'answer': [{'provider': 'cloud', 'model': 'big'}, {'provider': 'local', 'model': 'small', 'options': {'num_ctx': 4096}}]},
}
GOOD = {'answer': 'hi', 'ok': True}


def cloud_reply(content):
    return io.BytesIO(json.dumps({'choices': [{'message': {'content': content}}]}).encode())


def ollama_reply(content):
    return {'message': {'content': content}}


class RouterTests(unittest.TestCase):
    def setUp(self):
        patch.object(llm_router, 'load_config', return_value=CONFIG).start()
        patch.dict(os.environ, {}, clear=False).start()
        os.environ.pop('TEST_CLOUD_KEY', None)
        self.addCleanup(patch.stopall)

    def test_cloud_step_is_skipped_without_its_key(self):
        self.assertEqual([s['name'] for s in llm_router.chain('answer')], ['local'])
        os.environ['TEST_CLOUD_KEY'] = 'secret'
        self.assertEqual([s['name'] for s in llm_router.chain('answer')], ['cloud', 'local'])

    def test_offline_uses_local_model_with_its_options(self):
        with patch.object(llm_router.ai_provider, '_ollama_chat', return_value=ollama_reply(json.dumps(GOOD))) as model:
            result, meta = llm_router.run('answer', 'sys', [{'role': 'user', 'content': 'q'}], SCHEMA)
        self.assertEqual((result, meta), (GOOD, {'provider': 'local', 'model': 'small'}))
        sent = model.call_args.args[0]
        self.assertEqual((sent['model'], sent['options'], sent['messages'][0]), ('small', {'num_ctx': 4096}, {'role': 'system', 'content': 'sys'}))

    def test_cloud_request_shape_and_key_header(self):
        os.environ['TEST_CLOUD_KEY'] = 'secret'
        with patch.object(llm_router.request, 'urlopen', return_value=cloud_reply(json.dumps(GOOD))) as urlopen:
            result, meta = llm_router.run('answer', 'sys', [{'role': 'user', 'content': 'q'}], SCHEMA)
        req = urlopen.call_args.args[0]
        body = json.loads(req.data)
        self.assertEqual(req.full_url, 'https://cloud.test/v1/chat/completions')
        self.assertEqual(req.get_header('Authorization'), 'Bearer secret')
        self.assertNotIn('Python-urllib', req.get_header('User-agent'))
        self.assertEqual((body['model'], body['response_format']), ('big', {'type': 'json_object'}))
        self.assertEqual(meta['provider'], 'cloud')

    def test_rate_limited_cloud_falls_back_to_local(self):
        os.environ['TEST_CLOUD_KEY'] = 'secret'
        limited = error.HTTPError('https://cloud.test', 429, 'Too Many Requests', {}, io.BytesIO(b'{}'))
        with patch.object(llm_router.request, 'urlopen', side_effect=limited), \
             patch.object(llm_router.ai_provider, '_ollama_chat', return_value=ollama_reply(json.dumps(GOOD))):
            _, meta = llm_router.run('answer', 'sys', [], SCHEMA)
        self.assertEqual(meta['provider'], 'local')

    def test_malformed_reply_falls_back(self):
        os.environ['TEST_CLOUD_KEY'] = 'secret'
        with patch.object(llm_router.request, 'urlopen', return_value=cloud_reply('{"answer": 5, "ok": true}')), \
             patch.object(llm_router.ai_provider, '_ollama_chat', return_value=ollama_reply(json.dumps(GOOD))):
            _, meta = llm_router.run('answer', 'sys', [], SCHEMA)
        self.assertEqual(meta['provider'], 'local')

    def test_all_failures_are_reported_without_leaking_the_key(self):
        os.environ['TEST_CLOUD_KEY'] = 'secret'
        rejected = error.HTTPError('https://cloud.test', 401, 'Unauthorized', {}, io.BytesIO(b'{}'))
        with patch.object(llm_router.request, 'urlopen', side_effect=rejected), \
             patch.object(llm_router.ai_provider, '_ollama_chat', side_effect=RuntimeError('Cannot connect to Ollama.')):
            with self.assertRaises(llm_router.AllModelsFailed) as caught:
                llm_router.run('answer', 'sys', [], SCHEMA)
        message = str(caught.exception)
        self.assertIn('API key rejected', message)
        self.assertIn('Cannot connect to Ollama', message)
        self.assertNotIn('secret', message)

    def test_avoided_model_is_tried_last_not_dropped(self):
        os.environ['TEST_CLOUD_KEY'] = 'secret'
        with patch.object(llm_router.request, 'urlopen', return_value=cloud_reply(json.dumps(GOOD))),              patch.object(llm_router.ai_provider, '_ollama_chat', return_value=ollama_reply(json.dumps(GOOD))):
            _, meta = llm_router.run('answer', 'sys', [], SCHEMA, avoid={'provider': 'cloud', 'model': 'big'})
            self.assertEqual(meta['provider'], 'local')
        with patch.object(llm_router.request, 'urlopen', return_value=cloud_reply(json.dumps(GOOD))),              patch.object(llm_router.ai_provider, '_ollama_chat', side_effect=RuntimeError('down')):
            _, meta = llm_router.run('answer', 'sys', [], SCHEMA, avoid={'provider': 'cloud', 'model': 'big'})
            self.assertEqual(meta['provider'], 'cloud')

    def test_unknown_role_has_a_clear_error(self):
        with self.assertRaisesRegex(llm_router.AllModelsFailed, 'No AI model is set up'):
            llm_router.run('missing', 'sys', [], SCHEMA)

    def test_json_inside_code_fences_or_prose_is_accepted(self):
        self.assertEqual(llm_router.parse_json('```json\n{"a": 1}\n```'), {'a': 1})
        self.assertEqual(llm_router.parse_json('Sure! {"a": 1} Hope that helps.'), {'a': 1})
        with self.assertRaises(ValueError):
            llm_router.parse_json('no json here')

    def test_booleans_are_not_accepted_as_numbers(self):
        with self.assertRaises(ValueError):
            llm_router.validate({'n': True}, {'properties': {'n': {'type': 'integer'}}, 'required': ['n']})


class EnvFileTests(unittest.TestCase):
    def test_env_file_fills_missing_keys_but_never_overrides(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {'KEEP_ME': 'real'}):
            path = Path(tmp) / '.env'
            path.write_text('# comment\nexport NEW_KEY="abc"\nKEEP_ME=from-file\nbroken line\n', encoding='utf-8')
            llm_router.load_env(path)
            self.assertEqual((os.environ['NEW_KEY'], os.environ['KEEP_ME']), ('abc', 'real'))
            os.environ.pop('NEW_KEY')


class ShippedConfigTests(unittest.TestCase):
    def test_ai_models_json_is_valid_and_has_offline_fallbacks(self):
        config = json.loads(llm_router.CONFIG_PATH.read_text(encoding='utf-8'))
        for role in ('voice_answer', 'voice_check'):
            steps = config['roles'][role]
            self.assertTrue(all(s['provider'] in config['providers'] for s in steps), role)
            self.assertEqual(config['providers'][steps[-1]['provider']]['type'], 'ollama', role + ' must end with a local model')
        self.assertNotRegex(json.dumps(config), r'(sk-|gsk_|AIza)[A-Za-z0-9]{10,}', 'API keys belong in .env, not ai_models.json')


if __name__ == '__main__':
    unittest.main()
