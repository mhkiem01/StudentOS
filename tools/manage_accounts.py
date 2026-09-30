"""Host-only recovery: python tools/manage_accounts.py reset-admin.
No password is accepted as a command-line argument or printed to the terminal.
"""
import argparse,getpass,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import backend  # adds backend/<feature> folders to the import path
import accounts
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('action',choices=['reset-admin']);parser.parse_args()
    path=ROOT/'data'/'accounts.db'
    if not path.exists():raise SystemExit('Start the portal once to initialize accounts first.')
    password=getpass.getpass('New admin password (at least 12 characters): ')
    if password!=getpass.getpass('Confirm new password: '):raise SystemExit('Passwords do not match. Nothing changed.')
    hashed=accounts.password_hash(password)
    with accounts.db(path) as con:
        con.execute("UPDATE users SET password=?,must_change=0,disabled=0 WHERE id='admin'",(hashed,))
        con.execute("DELETE FROM sessions WHERE user_id='admin'")
        con.execute("DELETE FROM attempts WHERE key='user:admin'")
    (path.parent/'ADMIN_FIRST_LOGIN.txt').unlink(missing_ok=True)
    print('Admin password updated. All admin sessions have been signed out. Study and fitness data were not changed.')
if __name__=='__main__':main()
