"""Run from anywhere: python tests/support/run_tests.py [--browser] [--live]."""
import argparse,os,shutil,socket,subprocess,sys,tempfile,time
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[2]
def run(args):
    print('\nRUN: '+' '.join(map(str,args)),flush=True)
    subprocess.run(args,cwd=ROOT,check=True)
def port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def ready(url):
    for _ in range(100):
        try:
            with urlopen(url,timeout=1):return
        except OSError:time.sleep(.1)
    raise RuntimeError('Test service did not start: '+url)
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--browser',action='store_true');parser.add_argument('--accounts',action='store_true');parser.add_argument('--gym',action='store_true');parser.add_argument('--dashboard',action='store_true');parser.add_argument('--notes',action='store_true',help='Run the subject Notes browser suite.');parser.add_argument('--live',action='store_true');parser.add_argument('--vision',action='store_true',help='Also test a real timetable image with Ollama (requires Pillow).');args=parser.parse_args()
    node=shutil.which('node')
    if not node:raise RuntimeError('Node.js is required for the JavaScript tests. Install Node.js, then retry.')
    run([sys.executable,'-m','unittest','discover','-s','tests','-t','.','-p','test_*.py'])
    run([node,'tests/planner/calendar_dates.js']);run([node,'tests/planner/week_popup.js']);run([node,'tests/assistant/chatbot/client.test.js']);run([node,'tests/study/notes_markdown.js']);run([node,'tests/gym/gym_rules.js'])
    if args.browser or args.notes or args.dashboard or args.gym or args.accounts:
        browser=os.getenv('CHAT_TEST_BROWSER') or next((str(p) for p in [Path(os.getenv('PROGRAMFILES(X86)','C:/Program Files (x86)'))/'Microsoft/Edge/Application/msedge.exe',Path(os.getenv('PROGRAMFILES','C:/Program Files'))/'Google/Chrome/Application/chrome.exe'] if p.exists()),None)
        if not browser:raise RuntimeError('Set CHAT_TEST_BROWSER to the path of Edge or Chrome to run browser tests.')
        web_port,debug_port=port(),port();flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
        with tempfile.TemporaryDirectory(prefix='portal-chat-browser-') as profile:
            fixture=subprocess.Popen([sys.executable,'tests/support/fixture_server.py',str(web_port)]+(['--notes'] if args.notes else []),cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags)
            edge=None
            try:
                ready(f'http://127.0.0.1:{web_port}/api/health')
                edge=subprocess.Popen([browser,'--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',f'--remote-debugging-port={debug_port}',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags)
                ready(f'http://127.0.0.1:{debug_port}/json/version')
                run([node,'tests/study/notes/workspace.test.js' if args.notes else ('tests/dashboard/dashboard_browser.js' if args.dashboard else ('tests/gym/gym_browser.js' if args.gym else ('tests/accounts/accounts_browser.js' if args.accounts else 'tests/assistant/chatbot/browser.test.js'))),str(web_port),str(debug_port)])
            finally:
                fixture.terminate();fixture.wait(timeout=10)
                if edge:
                    subprocess.run([node,'tests/support/close_browser.js',str(debug_port)],cwd=ROOT,timeout=10,check=False)
                    try:edge.wait(timeout=10)
                    except subprocess.TimeoutExpired:edge.terminate();edge.wait(timeout=10)
    if args.live:run([sys.executable,'tests/assistant/chatbot/live_cases.py'])
    if args.vision:run([sys.executable,'tests/assistant/live_ollama_check.py'])
    print('\nPASS: all selected checks passed. Test records were isolated from your database.',flush=True)
if __name__=='__main__':
    try:main()
    except (subprocess.CalledProcessError,RuntimeError) as exc:print('\nFAIL:',exc,file=sys.stderr);sys.exit(1)
