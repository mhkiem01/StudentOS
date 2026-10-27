"""Role-based model routing: every AI job ("role") tries a list of models in order.

ai_models.json (no secrets, safe to commit) names the providers and, for each
role, an ordered chain of provider/model steps.  Cloud providers read their API
key from an environment variable or the git-ignored .env file.  A step whose key
is not set is skipped, so the same config runs fully offline on Ollama and picks
up free cloud models as soon as a key is added.  A step that errors, hits a rate
limit or returns malformed JSON falls through to the next one.
"""
import json
import os
import re
from pathlib import Path
from urllib import error, request

import ai_provider

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / 'ai_models.json'
ENV_PATH = ROOT / '.env'
CLOUD_TIMEOUT = 60
TYPES = {'string': str, 'boolean': bool, 'integer': int, 'number': (int, float), 'array': list, 'object': dict}


class AllModelsFailed(RuntimeError):
    pass


def load_env(path=ENV_PATH):
    """Read KEY=value lines. Variables already set in the environment win."""
    if not path.is_file():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip().removeprefix('export ').strip()
        if key:
            os.environ.setdefault(key, value.strip().strip('"\''))


def load_config():
    return json.loads(CONFIG_PATH.read_text(encoding='utf-8'))


def chain(role, config=None):
    """The steps for `role` that are usable right now (their key, if any, is set)."""
    config = config or load_config()
    providers = config.get('providers', {})
    steps = []
    for step in config.get('roles', {}).get(role, []):
        provider = providers.get(step.get('provider'))
        if not provider or not step.get('model'):
            continue
        if provider.get('api_key_env') and not os.getenv(provider['api_key_env']):
            continue
        steps.append({**provider, 'name': step['provider'], 'model': step['model'], 'options': step.get('options', {})})
    return steps


def available(role):
    return bool(chain(role))


def parse_json(text):
    text = str(text or '').strip()
    fenced = re.match(r'^```(?:json)?\s*(.*?)\s*```$', text, re.S)
    if fenced:
        text = fenced.group(1)
    try:
        return json.loads(text)
    except ValueError:
        start, end = text.find('{'), text.rfind('}')
        if start < 0 or end <= start:
            raise ValueError('reply was not JSON')
        return json.loads(text[start:end + 1])


def validate(result, schema):
    if not isinstance(result, dict):
        raise ValueError('reply was not a JSON object')
    properties = schema.get('properties', {})
    for key in schema.get('required', []):
        expected = TYPES.get(properties.get(key, {}).get('type'))
        if key not in result:
            raise ValueError('reply is missing "%s"' % key)
        value = result[key]
        if expected and (not isinstance(value, expected) or (expected is not bool and isinstance(value, bool))):
            raise ValueError('"%s" has the wrong type' % key)
        if 'enum' in properties.get(key, {}) and value not in properties[key]['enum']:
            raise ValueError('"%s" must be one of %s' % (key, ', '.join(map(str, properties[key]['enum']))))


def _call_ollama(step, system, messages, schema):
    response = ai_provider._ollama_chat({'model': step['model'], 'format': schema, 'options': step['options'],
                                         'messages': [{'role': 'system', 'content': system}, *messages]})
    return parse_json(response.get('message', {}).get('content', ''))


def _call_openai_compatible(step, system, messages, schema):
    """Groq, Gemini, OpenRouter and many others share this request shape."""
    body = {'model': step['model'], 'temperature': 0, 'response_format': {'type': 'json_object'},
            'messages': [{'role': 'system', 'content': system + '\nReply with ONE JSON object only, matching this JSON schema: ' + json.dumps(schema)},
                         *messages],
            **step['options']}
    req = request.Request(step['base_url'].rstrip('/') + '/chat/completions', data=json.dumps(body).encode('utf-8'),
                          # Some providers' firewalls reject Python's default User-Agent (Cloudflare error 1010).
                          headers={'Content-Type': 'application/json', 'User-Agent': 'StudentHelperPortal/1.0',
                                   'Authorization': 'Bearer ' + os.environ[step['api_key_env']]})
    try:
        with request.urlopen(req, timeout=step.get('timeout', CLOUD_TIMEOUT)) as response:
            data = json.loads(response.read().decode('utf-8'))
    except error.HTTPError as exc:
        hint = {401: ' (API key rejected)', 403: ' (API key not allowed)', 404: ' (model name not found)',
                429: ' (rate limit or free quota used up)'}.get(exc.code, '')
        raise RuntimeError('HTTP %s%s' % (exc.code, hint)) from exc
    except error.URLError as exc:
        raise RuntimeError('unreachable (%s)' % exc.reason) from exc
    except TimeoutError as exc:
        raise RuntimeError('timed out') from exc
    return parse_json(data['choices'][0]['message']['content'])


CALLERS = {'ollama': _call_ollama, 'openai_compatible': _call_openai_compatible}


def run(role, system, messages, schema, avoid=None):
    """Return (result, {"provider", "model"}) from the first step that succeeds.

    `avoid` ({"provider", "model"}) moves that model to the end of the chain, so a
    reviewer is a different model from the author whenever another one works.
    """
    steps = chain(role)
    if avoid:
        steps.sort(key=lambda s: (s['name'], s['model']) == (avoid.get('provider'), avoid.get('model')))
    if not steps:
        raise AllModelsFailed('No AI model is set up for "%s". Check ai_models.json.' % role)
    failures = []
    for step in steps:
        try:
            caller = CALLERS.get(step.get('type'))
            if not caller:
                raise ValueError('unknown provider type %r' % step.get('type'))
            result = caller(step, system, messages, schema)
            validate(result, schema)
            return result, {'provider': step['name'], 'model': step['model']}
        except (RuntimeError, ValueError, OSError, KeyError, IndexError, TypeError) as exc:
            failures.append('%s %s: %s' % (step['name'], step['model'], exc))
    raise AllModelsFailed('Every AI model for "%s" failed. %s' % (role, '; '.join(failures)))


load_env()
