"""Try every model in ai_models.json with a tiny JSON request and report which work.

Run from the project folder:  python tools/check_ai_models.py
Cloud steps without an API key are listed as skipped, never called.
"""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import backend  # adds backend/<feature> folders to the import path
import llm_router

SCHEMA = {'type': 'object', 'properties': {'ok': {'type': 'boolean'}}, 'required': ['ok'], 'additionalProperties': False}


def main():
    config = llm_router.load_config()
    providers = config.get('providers', {})
    working = 0
    for role, steps in config.get('roles', {}).items():
        print('\n' + role)
        for step in steps:
            provider = providers.get(step.get('provider'), {})
            label = '  %-11s %-42s' % (step.get('provider'), step.get('model'))
            key = provider.get('api_key_env')
            if key and not os.getenv(key):
                print(label, 'skipped (add %s to .env)' % key)
                continue
            started = time.monotonic()
            try:
                caller = llm_router.CALLERS[provider['type']]
                result = caller({**provider, 'name': step['provider'], 'model': step['model'], 'options': step.get('options', {})},
                                'Reply with JSON {"ok": true}.', [{'role': 'user', 'content': 'Health check.'}], SCHEMA)
                llm_router.validate(result, SCHEMA)
                print(label, 'OK  %.1fs' % (time.monotonic() - started))
                working += 1
            except Exception as exc:  # report every failure, keep checking the rest
                print(label, 'FAILED: %s' % exc)
    print('\n%d model step(s) working.' % working)
    return 0 if working else 1


if __name__ == '__main__':
    sys.exit(main())
