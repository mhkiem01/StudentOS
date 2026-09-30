"""Isolated portal for manual/headless calendar checks; no student database writes."""
import sys
import tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import backend  # adds backend/<feature> folders to the import path
import server
import accounts

with tempfile.TemporaryDirectory(prefix='calendar-browser-') as temp:
    original_root=server.ROOT
    server.ROOT=Path(temp)
    server.DB_PATH=Path(temp)/'test.db'
    server.init_db()
    server.ROOT=original_root
    server.import_state({'subjects':{'math':{'name':'Math','color':'#6d4df4','topics':[]}},'topics':{}})
    httpd=ThreadingHTTPServer(('127.0.0.1',8794),server.Handler)
    httpd.accounts_path=Path(temp)/'accounts.db'
    accounts.initialize(httpd.accounts_path,admin_name='Test Student',password='Fixture-password-123!',must_change=False)
    print('Calendar browser fixture http://127.0.0.1:8794',flush=True)
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
