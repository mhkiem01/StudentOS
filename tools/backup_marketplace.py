"""Host-only consistent backup of accounts, Socialise and Marketplace including files."""
from pathlib import Path
from datetime import datetime
from contextlib import closing
import sqlite3

root=Path(__file__).resolve().parents[1]
source=root/'data'/'accounts.db'
if not source.is_file():raise SystemExit('No shared account database exists yet.')
folder=root/'data'/'backups';folder.mkdir(exist_ok=True)
destination=folder/('marketplace-accounts-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.db')
with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as src,closing(sqlite3.connect(destination)) as dest:
    src.backup(dest)
    if dest.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise SystemExit('Backup verification failed.')
print('Verified shared backup:',destination)
print('Keep this private. Includes account hashes, Socialise and Marketplace records/files.')
