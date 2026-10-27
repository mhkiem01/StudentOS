# Socialise — shared, opt-in student workspace

Enable **Settings → Modules / Features → Socialise**. It is off by default. Disabling the module hides its navigation and blocks social writes/reads (apart from your profile/settings); it does not delete records.

Use **Social profile & privacy** to opt into discovery and explicitly publish university/subject labels. University is self-declared, never inferred from email. Both “Show my chosen subjects” and “Allow discovery by my chosen subjects” are needed for subject discovery. Account names and avatars are reused; private study results, notes, Finance, Gym and account email are never copied into social profiles.

## What is available

- Social Home: community shortcuts, connections, consent-based recommendations, feed, events and real counts.
- Requests: request/cancel/accept/decline/remove, blocking, separate social notifications and category preferences.
- Messaging: friend DMs or shared-member DMs according to recipient settings; member-only club, study-group, project and group conversations. New messages arrive instantly; the six-second refresh stays as a fallback. Enter sends, Shift+Enter starts a new line. Use refresh for changes to boards and directories.
- Clubs and study groups: public joins, private join approval, invitations, member roles, ownership transfer and shared chat. Owners manage membership; members can leave. No sports-team module is added.
- Posts: text/study updates, explicit subject tags, friends/public audiences or member-only group posts, likes/comments, own-post deletion. “Public” means signed-in users on this server, not the internet.
- Events, meetings and milestones: date/time, location/link, agenda, attendance, organiser editing/cancellation. They stay in Socialise; no personal timetable is changed automatically.
- Projects: private invitations, directory, Overview/Tasks/Files/Chat/Members/Settings, equal-weight task progress, checklists, assignment, priority, due dates, optional Review stage, task history, activity contribution and insights. Status dropdowns work on touch devices; drag-and-drop is not required.
- Project files: authenticated, membership-checked downloads as attachments; 2 MB each and 50 MB total per project. Files are not executed or served inline. Downloads are not malware-scanned: use normal caution with uploaded files.

Project progress = Done tasks / all tasks. Completing checklist items does not automatically mark a task Done. Task edits use a saved-version check to prevent silent concurrent overwrites. Recorded contribution = a member’s task-change/file-upload records divided by all recorded project actions. It is not a measure of effort or an academic grade, and excludes chat counts and work done elsewhere.

## Rooms, calls and Watch together

- **Rooms.** Every club, study group, project and group chat has text rooms and call rooms, starting with **# general** and **🔊 Lounge**. The owner adds rooms with **＋** and renames or deletes them with **⚙**. Deleting a text room deletes its messages; deleting a call room disconnects anyone in it. Messages saved before rooms existed show in the group's first text room. The upgrade only adds a table and a column, so existing data is untouched.
- **Group calls.** Click a call room to join with your microphone. In the call you can mute, turn your camera on, share your screen (computer browsers) and open Watch together. **Minimise** keeps the call running in a small dock while you use the rest of the portal; **Leave call** frees your seat. The rooms list shows who is in each call and whether they are muted, on camera or sharing. Joining from a second tab or device moves your seat there. Calls hold up to 12 people, but every browser connects directly to every other one, so 2–6 people works best.
- **Direct calls.** In a direct conversation, **📞 Call** or **🎥 Video call** rings the other person anywhere in the portal: **Accept**, **With video** or **Decline**. Ringing stops after 45 seconds, and each call also leaves a social notification (“… called you”) under the new **call** notification category.
- **Watch together.** In a call, open **▶ Watch together** and paste YouTube links (watch, youtu.be, Shorts, embed and live links; a `t=` start time is kept). Each call has one shared queue, and play, pause, seeking, skipping and the end of a video are shared. YouTube links in chat show a preview card: **▶** plays it in the chat just for you, and **Watch together in a call** adds it to the call you are in.
- **YouTube accounts.** The player is YouTube's own embed, so it uses the YouTube account the browser is signed into where the browser allows it (for example YouTube Premium without ads). Linking a YouTube account to the portal itself (playlists, history) would need a Google Cloud OAuth app and is not included.

## Sharing notes live

- **Share.** In a note's **••• More** menu, choose **👥 Share with friends**, tick friends and choose **View only** or **Edit**. Each friend gets a note card in your direct messages and a social notification under the new **note** category. The same window lists who has the note, lets you change what each friend can do, and **Stop sharing**.
- **Open or save.** Friends **Open** the note from the card, or **Save to my subjects** to pick one of their own subjects (and optionally a topic). It then appears in that subject's Notes under "Shared with you". It is a live view, not a copy: they always see your latest saved version.
- **Ask to edit.** A friend with view-only access can **Ask to edit**, from the card or the note's ••• menu. You get a card in your messages with **Allow editing** or **Keep view only**.
- **Live.** Every save, by you or by a friend allowed to edit, appears straight away in everyone's open copy. If someone has unsaved changes when a newer version arrives, they choose between loading the new version and keeping their own; saving after keeping their own reports the conflict instead of overwriting.
- **Ownership.** The note stays in its owner's notebook with their subject, topic and week; friends cannot move or delete it. Images in shared notes load through the share, and images a friend adds while editing are stored with the owner's note. Deleting the note or stopping sharing removes it from friends' notes and turns their cards into "no longer shared". A friend can **Stop receiving** a note at any time.

### What calls need

Browsers only allow the microphone, camera and screen sharing on secure pages: **https**, or **http://localhost** on the host computer. A device on plain http (`http://192.168.x.x:…` or a Tailscale `http://100.x.x.x:…` address) can still join a call to listen, watch screens and use Watch together, but cannot send its own sound or video; the call screen explains this.

To call from phones and other computers, give the portal an https address. With Tailscale, which `START_ANYWHERE.bat` already uses:

1. In the Tailscale admin console, open **DNS** and turn on **MagicDNS** and **HTTPS Certificates**. Machine names then appear in public certificate-transparency logs.
2. Start the portal with `START_ANYWHERE.bat` (port 8765), then run `tailscale serve --bg 8765` on the host.
3. On each device signed in to your tailnet, open `https://<machine-name>.<tailnet>.ts.net/`. Run `tailscale serve reset` to turn it off.

Calls go peer-to-peer between the browsers. No sound or video passes through the portal server and nothing is recorded. The server only relays the short connection set-up messages and remembers who is in which call, in memory. No STUN or TURN servers are used, so everyone in a call must be able to reach each other directly: the same Wi-Fi or the same tailnet. Restarting the portal server ends all calls and clears Watch together queues; chat and rooms are saved.

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
python -m unittest tests.social.test_social_calls -v
python tests/support/run_browser_check.py --calls
python -m unittest tests.social.test_note_shares -v
python tests/support/run_browser_check.py --share
```

```powershell
python tests/support/run_tests.py --dashboard
python tests/support/run_tests.py --notes
python tests/support/run_tests.py --browser
```

The dashboard browser suite includes Socialise. `tests/social/test_social.py` uses three temporary accounts for authorisation, membership, blocking, privacy, task history and file access; `tests/accounts/test_accounts.py` checks HTTP authentication and private project isolation. Test records never enter production databases.

The `--calls` check signs in two accounts in separate browser contexts and uses the browser's fake camera, microphone and screen so a real call connects. It covers rooms, instant chat, YouTube cards, a group call (sound both ways, camera, mute, speaking light, screen sharing), Watch together with a stand-in YouTube player, the dock, a direct call that is declined and then answered with video, and the phone layout. Screenshots go to `%TEMP%\portal-social-calls`.

Version-one boundaries: text posts only (no polls/photo feed), no online/offline presence (call rooms do show who is in them), no grading/effort claims, no automatic calendar synchronisation, and no screenshot sample records. Feeds show the latest 100 visible posts; conversations show the latest 200 messages; project activity details show the latest 200 records while contribution totals use all saved activity. These are display limits, not deletion rules.
