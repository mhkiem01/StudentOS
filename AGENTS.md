# Agent instructions (Codex / any AI helper)

## ALWAYS: keep the build journal updated

After **any** change to this project — a new feature, a change, or a bug fix —
you MUST also update `HOW_I_BUILT_THIS.md` in the same session, before finishing.
It is the owner's beginner-friendly learning journal of how the app was built.

- **Added/changed a feature** → add a dated bullet to the **Change Log** at the
  top of that file; if the idea is genuinely new, add a short beginner
  **"What we learned"** note (with a tiny real code snippet when it helps).
- **Fixed a bug** → add a bullet: **what broke**, **why**, and **what we learned**
  so it won't recur.
- **Built something unfinished** → record it under **"Not finished yet / ideas"**
  with what still needs to be learned or done.
- Keep the beginner tone, explain any new word, and never delete old history —
  the file only grows.

## Project facts

- Back end: Python standard library only (`server.py`); no Flask/Django.
- Front end: plain HTML/CSS/vanilla-JS modules (`create()` factory pattern).
- Storage: SQLite — `accounts.db` + a private workspace DB per user.
- Hosting: `render.yaml` + `docs/DEPLOY_RENDER.md`. Settings: `STUDENTOS_DATA` (data folder), `PORT`,
  `PORTAL_HTTPS=1`, `PORTAL_TRUST_PROXY=1`. Never write user data under the code folder when `STUDENTOS_DATA` is set.
- AI: Ollama locally + optional cloud models routed per role in `ai_models.json`;
  keys only in the git-ignored `.env`.
- Tests: `python tests/support/run_tests.py` (+ `--browser`, `--dashboard`,
  `--notes`, `--gym`, `--accounts`); `python tests/support/run_browser_check.py`.
- Never commit `data/`, `backups/`, or `.env`. Commit only when asked.
