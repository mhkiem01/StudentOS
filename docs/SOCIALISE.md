# Socialise — shared, opt-in student workspace

Enable **Settings → Modules / Features → Socialise**. It is off by default. Disabling the module hides its navigation and blocks social writes/reads (apart from your profile/settings); it does not delete records.

Use **Social profile & privacy** to opt into discovery and explicitly publish university/subject labels. University is self-declared, never inferred from email. Both “Show my chosen subjects” and “Allow discovery by my chosen subjects” are needed for subject discovery. Account names and avatars are reused; private study results, notes, Finance, Gym and account email are never copied into social profiles.

## What is available

- Social Home: community shortcuts, connections, consent-based recommendations, feed, events and real counts.
- Requests: request/cancel/accept/decline/remove, blocking, separate social notifications and category preferences.
- Messaging: friend DMs or shared-member DMs according to recipient settings; member-only club, study-group, project and group conversations. Messages poll every six seconds while Socialise is visible. Use refresh for changes to boards and directories.
- Clubs and study groups: public joins, private join approval, invitations, member roles, ownership transfer and shared chat. Owners manage membership; members can leave. No sports-team module is added.
- Posts: text/study updates, explicit subject tags, friends/public audiences or member-only group posts, likes/comments, own-post deletion. “Public” means signed-in users on this server, not the internet.
- Events, meetings and milestones: date/time, location/link, agenda, attendance, organiser editing/cancellation. They stay in Socialise; no personal timetable is changed automatically.
- Projects: private invitations, directory, Overview/Tasks/Files/Chat/Members/Settings, equal-weight task progress, checklists, assignment, priority, due dates, optional Review stage, task history, activity contribution and insights. Status dropdowns work on touch devices; drag-and-drop is not required.
- Project files: authenticated, membership-checked downloads as attachments; 2 MB each and 50 MB total per project. Files are not executed or served inline. Downloads are not malware-scanned: use normal caution with uploaded files.

Project progress = Done tasks / all tasks. Completing checklist items does not automatically mark a task Done. Task edits use a saved-version check to prevent silent concurrent overwrites. Recorded contribution = a member’s task-change/file-upload records divided by all recorded project actions. It is not a measure of effort or an academic grade, and excludes chat counts and work done elsewhere.

## Deployment and storage

Real account IDs and authenticated sessions are reused. Social tables live in the **shared `data/accounts.db`**, not private per-user study databases. All clients must connect to the same server address. Separate installations/local SQLite copies do not communicate. Administrators create student accounts using the existing account-management screen.

`social_store.py` is the repository/permission boundary. Every request checks server-side identity; project/chat/file access requires active membership. Removed members lose access. Social notifications never enter reminder/deadline tables. Existing workspace tables are not migrated or reset.

This is a small, trusted single-server deployment, not a public social-network hosting platform. Before public deployment, add production HTTPS hosting, operational rate limits/monitoring, moderation/reporting and attachment scanning. Polling can later be replaced with real-time transport; the repository boundary can be adapted to PostgreSQL without changing the screens.

## Backups

First migration creates `data/backups/before-socialise-*.db`. This contains account credentials/session hashes and must stay host-private. The normal **workspace backup** intentionally does not include other users’ social data or account credentials.

For ongoing shared social/account backups, run on the host:

```powershell
python tools/backup_social.py
```

Keep `data/accounts.db` backups together with the separate personal workspace backups. Restore is a host-only operation with all portal servers stopped. Do not distribute the shared database to students.

## Tests

Focused Socialise checks, using temporary accounts and databases:

```powershell
python -m unittest discover -s tests -t . -p test_social.py -v
python tests/support/run_browser_check.py --social
```

```powershell
python tests/support/run_tests.py --dashboard
python tests/support/run_tests.py --notes
python tests/support/run_tests.py --browser
```

The dashboard browser suite includes Socialise. `tests/social/test_social.py` uses three temporary accounts for authorisation, membership, blocking, privacy, task history and file access; `tests/accounts/test_accounts.py` checks HTTP authentication and private project isolation. Test records never enter production databases.

Version-one boundaries: text posts only (no polls/photo feed), no live presence, no grading/effort claims, no automatic calendar synchronisation, and no screenshot sample records. Feeds show the latest 100 visible posts; conversations show the latest 200 messages; project activity details show the latest 200 records while contribution totals use all saved activity. These are display limits, not deletion rules.
