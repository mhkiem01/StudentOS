QUIZPREP AI — LOCAL SQLITE EDITION

This folder contains the complete local application and its database.

WINDOWS
1. Extract the ZIP to a normal folder such as:
   Documents\QuizPrep-AI-Local-DB
2. Double-click START_WINDOWS.bat
3. Keep the black terminal window open while using QuizPrep.
4. Your browser opens automatically.
   When connected to Wi-Fi, it opens the LAN address shown in the terminal so
   the laptop and phone can use the same URL.

PHONE / TABLET (SAME WI-FI)
1. Connect the phone and this PC to the same private Wi-Fi network.
2. Double-click START_WINDOWS.bat and keep its black window open.
3. The window prints one or more "Phone (same Wi-Fi)" addresses.
4. Open one of those addresses in Safari or Chrome on the phone.
   Example: http://192.168.1.25:8765/
5. If Windows Firewall asks, allow Python on Private networks only.

Sign in on both devices with the same account to access the same workspace.
The original data/quizprep.db belongs to admin. Other accounts have separate
SQLite workspaces. The PC and START_WINDOWS.bat must remain running.
Passwords are now required, but HTTP is not encrypted. Use only trusted
private Wi-Fi; configure HTTPS before any public access.

FIRST ADMIN LOGIN
- Username: admin
- Temporary password: open data/ADMIN_FIRST_LOGIN.txt on this PC.
- Choose a new password at first sign-in. The temporary credential file is
  removed after the change; all existing study and fitness data is retained.
- Profiles, photos/avatars, appearance, security and account management are
  in Settings. New accounts are created by an administrator.
- Host recovery: python tools/manage_accounts.py reset-admin
- Tests: double-click tests/runners/RUN_ACCOUNT_TESTS.bat.
- Details: tests/accounts/README.md.
- Feature guides (AI setup, calendar, finance, marketplace, ...): docs/
- Full host backups should include data/accounts.db and all workspace
  databases. A Settings download includes only the signed-in workspace.

The app does not poll in the background. After making a change on one device,
refresh the page on the other device to load the latest SQLite data.

MAC / LINUX
1. Extract the ZIP.
2. Run START_MAC_LINUX.command
3. Keep the terminal open while using the app.

DATABASE
- The database is stored at:
  data/quizprep.db
- It uses SQLite.
- Subjects, topics, topic colours, questions, subject membership,
  and progress are saved there.
- Closing the browser does NOT erase your data.
- Restarting your computer does NOT erase your data.
- Do not delete the data folder if you want to keep your quizzes.

BACKUP
- Run tools/backup_database.py to create a timestamped copy in:
  backups/

PREVIOUS V4 DATA
- The old standalone V4 file and this local-server edition use different browser origins,
  so existing V4 browser data is not automatically transferred.
- New data created in this edition is stored in SQLite from now on.

IMPORTANT
- Do not open index.html directly by double-clicking it.
- Always start with START_WINDOWS.bat or START_MAC_LINUX.command.
- Python 3 is required. No Flask, Node.js, npm, or other packages are required.

WHAT IS SAVED
- Subjects
- Topic names
- Subject → topic grouping
- Topic colours
- Subject colours
- All quiz questions
- Answer choices
- Correct answers
- Explanations
- Quiz progress / accuracy
- Flashcards stored inside existing topics
- Flashcard Again / Hard / Good / Easy ratings

FLASHCARDS
- Open Flashcards from the navigation.
- Main import format: Topic:, Front:, Back:, and optional Explain:.
- Inside an existing topic, Topic: is optional when adding cards.
- Back and Explain preserve paragraphs, bullets, commands and numbered lists.
- Click or press Space to flip; use arrow keys or swipe to navigate.

SQLite is the only source of quiz data. Browser copies are not merged back
into the database, so deleting a topic will not be undone by an older tab.

PROJECT LAYOUT
- server.py, index.html          App entry point and main page
- backend/<feature>/             Python modules (accounts, assistant, study,
                                 planner, finance, gym, social, marketplace)
- frontend/<feature>/            JavaScript/CSS, same feature folders plus
                                 dashboard/
- tests/<feature>/               Tests for each feature
- tests/support/                 Shared test harness (run_tests.py,
                                 run_browser_check.py, fixture server)
- tests/runners/                 Double-click RUN_*_TESTS.bat files
- docs/                          Feature guides
- tools/                         Host-only scripts (backups, admin reset)
- data/, backups/                Your SQLite databases and backups
- All Python tests:  python -m unittest discover -s tests -t .
