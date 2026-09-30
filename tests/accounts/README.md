# Accounts, profiles and login

## First admin sign-in

Existing data remains in `data/quizprep.db` and belongs to the original **admin** account. It is not copied, reassigned to other users or cleared.

On first startup, the app generates a random temporary password in `data/ADMIN_FIRST_LOGIN.txt`. Sign in as `admin` and choose a new password. The credential file is removed after the successful password change. The server never serves files from `data/` or `backups/`.

Administrator recovery, on the computer hosting the app:

```powershell
python tools/manage_accounts.py reset-admin
```

This securely prompts for a new password without command-line arguments. It revokes admin sessions but leaves study and fitness records untouched. Anyone with access to the host's files can modify the local application, so protect the Windows account and the `data` folder.

## Settings

- **Profile:** display name, optional email/university/course/bio, eight built-in avatars, or a profile photo. Photos are cropped, resized, decoded and re-encoded to strip metadata. Pillow is required for photo uploads; avatars work without it.
- **Appearance:** system/light/dark theme, four accent colours, and comfortable/compact spacing, persisted per account.
- **Security:** password change, current-device information, sign out other devices, and logout.
- **People & access (administrators):** create student/admin accounts, disable/re-enable accounts without deleting data, and set a temporary password requiring a change on next login. Public signup and email recovery are intentionally not enabled.
- **Modules:** each account chooses whether to enable Gym.
- **Workspace backup:** downloads only that user's study/fitness database, not password hashes or other users' data.

## Storage and security boundaries

`data/accounts.db` contains account profiles, salted password hashes and hashed session tokens. New accounts use `data/users/<server-generated-id>/workspace.db`. Administrators manage account access but do not automatically browse other users' study data through the UI. The original admin always retains the original workspace.

Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations and independent random salts. Session tokens contain 256 bits of randomness and are sent using `HttpOnly; SameSite=Strict` cookies. Sessions expire after 12 idle hours or 7 days, and password changes revoke all sessions. Login throttling limits repeated failures. Mutation endpoints require same-origin checks, a custom request header, and a matching signed-in account ID to protect against stale tabs writing into a different account.

The local server still uses HTTP. It does **not** encrypt credentials over Wi-Fi. Use a trusted private network only; do not port-forward it publicly. For deployment behind a properly configured HTTPS reverse proxy, set `PORTAL_HTTPS=1` to require Secure cookies and ensure the proxy preserves the correct Host header. Merely setting this flag does not install HTTPS. This is not MFA, SSO or a full internet-facing identity service.

Host backups should include both `data/accounts.db` and the workspace databases (with the server stopped, or SQLite online backups). Per-user downloaded workspace backups deliberately do not contain accounts. Existing pre-login backups remain sensitive host-only files.

Security references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Tests

Double-click `tests/runners/RUN_ACCOUNT_TESTS.bat`, or:

```powershell
python tests/support/run_tests.py --accounts
```

Requires Python, Node.js 22+, Edge/Chrome; Pillow for upload checks. All test accounts and records use temporary databases. No production credentials are read. Tests cover anonymous access denial, role restrictions, separated workspaces and backups, stale-tab rejection, cross-site request rejection, hashed credentials, expiry/revocation, first-login password changes, invalid image rejection, rate limiting, profile/photo/avatar UI, appearance and mobile layouts.

Regression checks: run the same command with `--notes`, `--gym`, `--dashboard`, or `--browser` instead of `--accounts`.
