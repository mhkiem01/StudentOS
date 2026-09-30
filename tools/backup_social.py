"""Host-only online snapshot of shared accounts and Socialise. Never web-served."""
import sqlite3
from pathlib import Path
from datetime import datetime
from contextlib import closing

root=Path(__file__).resolve().parents[1]
source=root/'data'/'accounts.db'
if not source.is_file():raise SystemExit('No shared account database exists yet.')
folder=root/'data'/'backups';folder.mkdir(exist_ok=True)
destination=folder/('social-accounts-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db')
with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as src,closing(sqlite3.connect(destination)) as dest:
    src.backup(dest)
    if dest.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise SystemExit('Backup verification failed.')
print('Verified backup:',destination)
print('Keep this file private: it includes account and shared social data.')
