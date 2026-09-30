"""Run the Mastery browser check on temporary data, never on the real portal."""
import os,sys,tempfile,subprocess,shutil
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from run_tests import ROOT,port,ready

browser=Path(os.getenv('PROGRAMFILES(X86)','C:/Program Files (x86)'))/'Microsoft/Edge/Application/msedge.exe'
if not browser.exists():raise SystemExit('This browser check requires Microsoft Edge.')
web,debug=port(),port();flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
with tempfile.TemporaryDirectory(prefix='mastery-browser-') as profile:
 quick='--quick' in sys.argv
 notes='--notes' in sys.argv or quick
 fixture=subprocess.Popen([sys.executable,'tests/support/fixture_server.py',str(web)]+(['--notes'] if notes else []),cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags)
 edge=None
 try:
  ready(f'http://127.0.0.1:{web}/api/health')
  edge=subprocess.Popen([str(browser),'--headless=new','--disable-gpu','--no-first-run',f'--remote-debugging-port={debug}',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=flags)
  ready(f'http://127.0.0.1:{debug}/json/version')
  script='tests/social/social_standalone_browser.js' if '--social' in sys.argv else 'tests/assistant/assistant_actions_browser.js' if '--assistant' in sys.argv else 'tests/dashboard/module_navigation_browser.js' if '--navigation' in sys.argv else 'tests/gym/gym_browser.js' if '--gym' in sys.argv else 'tests/finance/finance_planner_browser.js' if '--finance' in sys.argv else 'tests/planner/calendar_colours_browser.js' if '--colours' in sys.argv else 'tests/study/quick_review_browser.js' if quick else 'tests/study/notes/workspace.test.js' if notes else 'tests/study/quiz_mastery_browser.js'
  subprocess.run([shutil.which('node'),script,str(web),str(debug)],cwd=ROOT,check=True)
 finally:
  fixture.terminate();fixture.wait(timeout=10)
  if edge:
   subprocess.run([shutil.which('node'),'tests/support/close_browser.js',str(debug)],cwd=ROOT,check=False)
   try:edge.wait(timeout=10)
   except subprocess.TimeoutExpired:edge.terminate();edge.wait(timeout=10)
