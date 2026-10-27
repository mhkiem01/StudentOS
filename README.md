# StudentOS

[![CI](https://github.com/mhkiem01/StudentOS/actions/workflows/ci.yml/badge.svg)](https://github.com/mhkiem01/StudentOS/actions/workflows/ci.yml)

A local student portal for quizzes, notes, planning, finance, fitness, social
features and a study assistant. Python serves the application and stores user
data in SQLite.

## Start the application

- Windows: run `START_WINDOWS.bat`.
- macOS/Linux: run `START_MAC_LINUX.command`.
- From a terminal: run `python server.py`.

Keep the server running and open the URL it prints. Use the same private Wi-Fi
network to connect from another device. See [README.txt](README.txt) for initial
admin login, account recovery and detailed startup instructions.

## Put it online (Render)

To use it from anywhere without a laptop running, deploy it on Render with a persistent disk for the data:
see [Putting StudentOS online with Render](docs/DEPLOY_RENDER.md). Everything is set up by `render.yaml`.

## AI configuration

The study assistant uses local Ollama with `qwen3-vl:8b` by default. Voice Tutor
tries the provider/model chains in [ai_models.json](ai_models.json), falling back
to local `qwen2.5:7b`. Cloud providers require API keys in the environment or
the ignored `.env` file. See [AI setup](docs/AI_SETUP.md).

## Project layout

- `index.html`, `frontend/`: browser interface and shared JavaScript modules.
- `server.py`, `backend/`: HTTP server and feature services.
- `tests/`: regression tests, browser checks and their isolated fixtures.
- `tools/`: account management, backups, demo data and AI diagnostics.
- `docs/`: feature guides.

Quiz mastery rules live in `frontend/study/quiz-mastery.js`, shared by the app
and its JavaScript tests.

## Verification

Run `python tests/support/run_tests.py` for the Python suite and selected
JavaScript checks. Add `--browser`, `--dashboard`, `--notes`, `--gym` or
`--accounts` for browser checks. These require Node.js and Edge or Chrome.
Run `python tests/support/run_browser_check.py` for the quiz mastery browser
check. Tests use temporary databases; live AI checks are separate and optional.

## CI and releases (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`) runs on every push to `main`/`master` and on every pull request, on a Windows
  runner. It first checks that no user data (`data/`, `backups/`, databases) or API keys are committed, then checks
  JavaScript syntax and runs the Python and Node tests. After that, the browser suites run in parallel in headless
  Edge, and screenshots are kept for a week under the run's *Artifacts*. You can also start it by hand from the
  Actions tab.
- **Releases** (`.github/workflows/release.yml`): push a version tag to publish a download.

  ```
  git tag v1.0.0
  git push origin v1.0.0
  ```

  All CI checks run again; if they pass, a GitHub Release is created with `StudentOS-v1.0.0.zip` (only committed
  files, so never your data or `.env`) and its SHA-256 checksum.

## Data and cleanup

Keep `data/`, `backups/` and `.env`: they contain user data, backups and secrets.
Keep `.marketplace-deps/` if installed: marketplace PDF processing uses it.
`requirements-marketplace.txt` lists the optional marketplace dependencies (PDF previews and,
on Windows, the time-zone data for tutor bookings): `python -m pip install -r requirements-marketplace.txt`.

Python generates `__pycache__/` folders and `.pyc` files. They can be removed
when cleaning the project and are recreated as needed. Do not remove source
files just because they are used only by tests or maintenance tools.
