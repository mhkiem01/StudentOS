"""Opt-in local text + synthetic timetable screenshot test. Never writes student data.
Requires Pillow only for building the test image (not a runtime dependency).
Run: python tests/assistant/live_ollama_check.py
"""
import base64
import io
import json
import sys
import threading
import time
import tempfile
from pathlib import Path
from urllib import request
from http.server import ThreadingHTTPServer
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import backend  # adds backend/<feature> folders to the import path
from server import Handler
import server,accounts

image = Image.new('RGB', (900, 280), 'white')
draw = ImageDraw.Draw(image)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 25)
for i, line in enumerate(['UNIVERSITY TIMETABLE',
                         'Monday 09:00 - 10:00 | COMP101 Lecture | Room A1',
                         'Wednesday 14:00 - 15:00 | MATH101 Tutorial | Room B2']):
    draw.text((20, 30 + i * 75), line, fill='black', font=font)
buffer = io.BytesIO()
image.save(buffer, format='PNG')
image_data = 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()

fixture=tempfile.TemporaryDirectory(prefix='portal-live-ai-')
original_root=server.ROOT;server.ROOT=Path(fixture.name);server.DB_PATH=Path(fixture.name)/'workspace.db';server.init_db();server.ROOT=original_root
httpd = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
httpd.accounts_path=Path(fixture.name)/'accounts.db'
accounts.initialize(httpd.accounts_path,password='Fixture-password-123!',must_change=False)
_,token=accounts.login(httpd.accounts_path,'admin','Fixture-password-123!','127.0.0.1','Live AI test')
threading.Thread(target=httpd.serve_forever, daemon=True).start()
try:
    for text, attachment in [('Say hello in one sentence.', None), ('Fill my timetable with the two classes in this picture.', image_data)]:
        start = time.monotonic()
        payload = {'messages': [{'role': 'user', 'content': text}], 'image': attachment}
        req = request.Request(f'http://127.0.0.1:{httpd.server_port}/api/ai/chat/stream',
                              data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json','X-Portal-Request':'1','X-Portal-Account':'admin','Cookie':'portal_session='+token})
        result, ticks = None, 0
        with request.urlopen(req, timeout=650) as response:
            for line in response:
                event = json.loads(line)
                if event['type'] == 'error':
                    raise AssertionError(event['error'])
                if event['type'] == 'progress':
                    ticks += 1
                    if ticks % 15 == 1:
                        print('Progress:', event, flush=True)
                if event['type'] == 'result':
                    result = event
        assert result and result['reply'] and ticks
        if attachment:
            events = [e for a in result['actions'] for e in a['events']]
            assert len(events) == 2, events
            assert {(e['day'], e['start_time'], e['end_time'], e['location']) for e in events} == {
                (0, '09:00', '10:00', 'Room A1'), (2, '14:00', '15:00', 'Room B2')}, events
        print('PASS', 'image' if attachment else 'text', round(time.monotonic()-start, 1), 'seconds', result, flush=True)
finally:
    httpd.shutdown()
    httpd.server_close()
    fixture.cleanup()
