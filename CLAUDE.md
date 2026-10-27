# Project notes for Claude Code

## ALWAYS: keep the build journal updated

After **any** change to this project — a new feature, a change, or a bug fix —
you MUST also update [`HOW_I_BUILT_THIS.md`](HOW_I_BUILT_THIS.md) in the same
session, before finishing. It is the owner's beginner-friendly learning journal.

- **Added/changed a feature** → add a dated bullet to the **Change Log** at the
  top of that file, and if the idea is genuinely new, add a short beginner
  **"What we learned"** note (with a tiny real code snippet when it teaches
  something).
- **Fixed a bug** → add a bullet saying **what broke**, **why**, and **what we
  learned** so it won't happen again.
- **Built something unfinished** → note it under **"Not finished yet / ideas"**
  with what still needs to be learned/done.
- Keep the beginner tone, explain new words, and never delete old history — the
  file only grows.

## Quick facts

- Back end: **Python standard library only** ([`server.py`](server.py)); no Flask.
- Front end: plain HTML/CSS/vanilla-JS modules (`(function(global){...})(window)`
  with a `create()` factory). No framework.
- Storage: **SQLite** — one `accounts.db` plus a private workspace DB per user.
- Hosting: `render.yaml` + `docs/DEPLOY_RENDER.md`. Settings: `STUDENTOS_DATA` (data folder), `PORT`,
  `PORTAL_HTTPS=1`, `PORTAL_TRUST_PROXY=1`. Never write user data under the code folder when `STUDENTOS_DATA` is set.
- AI: **Ollama** locally, plus optional free cloud models routed by role in
  [`ai_models.json`](ai_models.json); API keys live only in the git-ignored
  `.env`.
- Tests: `python tests/support/run_tests.py` (add `--browser`, `--dashboard`,
  `--notes`, `--gym`, `--accounts`); `python tests/support/run_browser_check.py`.
- Secrets & data (`data/`, `backups/`, `.env`) are git-ignored — never commit
  them. Commit only when the owner asks.
