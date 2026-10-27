"""Copy a StudentOS data folder into this server's data folder, e.g. your laptop's data/ onto a Render disk.

Usage (in the Render Shell, after uploading your folder to /var/data/incoming; see docs/DEPLOY_RENDER.md):
    python tools/restore_data.py /var/data/incoming

Databases are copied with SQLite's backup API, so this is safe even while the server is running, and a
database's unfinished changes (its -wal file) are included. Files with the same name are replaced; nothing
else is deleted. Restart the service afterwards so every account starts from the copied data.
"""
import argparse
import os
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def restore(source, target):
    source, target = Path(source).resolve(), Path(target).resolve()
    if not (source / 'quizprep.db').is_file():
        raise SystemExit(f'{source} does not look like a StudentOS data folder (it has no quizprep.db).')
    if source == target:
        raise SystemExit('The source and the data folder are the same folder.')
    databases = files = 0
    for file in sorted(source.rglob('*')):
        if file.is_dir() or file.name.endswith(('-wal', '-shm', '-journal')):
            continue   # write-ahead files are folded into the database copy below
        destination = target / file.relative_to(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if file.suffix == '.db':
            with closing(sqlite3.connect(file)) as src, closing(sqlite3.connect(destination)) as dst:
                src.backup(dst)
            databases += 1
        else:
            shutil.copy2(file, destination)
            files += 1
    # A first start on an empty disk writes a temporary admin password; it no longer applies to copied accounts.
    if not (source / 'ADMIN_FIRST_LOGIN.txt').exists():
        (target / 'ADMIN_FIRST_LOGIN.txt').unlink(missing_ok=True)
    return databases, files


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', help='the uploaded copy of your data folder')
    args = parser.parse_args()
    target = Path(os.environ.get('STUDENTOS_DATA') or ROOT / 'data')
    databases, files = restore(args.source, target)
    print(f'Copied {databases} databases and {files} other files into {target}.')
    print('Now restart the service (Render: Manual Deploy > Restart service), then sign in with your usual account.')


if __name__ == '__main__':
    main()
