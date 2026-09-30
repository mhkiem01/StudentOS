# Optional Gym module

Enable it in **Settings → Modules / Features → Gym Module**. It is off by default. Disabling hides navigation and blocks Gym writes except preferences; no records are deleted. Workout suggestions need no body metrics or AI.

## Run tests

Double-click `tests/runners/RUN_GYM_TESTS.bat`, or run from the project directory:

```powershell
python -m unittest discover -s tests -t . -p "test_gym*.py"
node tests/gym/gym_rules.js
python tests/support/run_browser_check.py --gym
```

Python, Node.js 22+ and Edge/Chrome are required. The runner uses a temporary SQLite database and hidden browser, not your data. No AI or network service is required. Set `CHAT_TEST_BROWSER` if the browser is installed elsewhere.

Additional regression suites:

```powershell
python tests/support/run_tests.py --notes
python tests/support/run_tests.py --dashboard
python tests/support/run_tests.py --browser
```

Gym coverage: migration/backups, disabled defaults, retention, preferences, 540 rule combinations, equipment-compatible swaps, programs/edit/duplicate/delete, active-session recovery, idempotent sets, completion, nutrition validation, food logs, append-only measurement history, dated plans, actual-data records/streaks, plate calculator, rest timer, mobile navigation and shared dark theme.

## Architecture and limits

- `gym_store.py`: separate additive Gym tables and validation. Migration creates `backups/before-gym-*.db` before adding tables. Existing academic/settings rows are not modified.
- `frontend/gym/gym-rules.js`: curated exercise library, maintainable rule-based templates, equipment matching, records, streak and plate calculation. Future AI can propose the same workout shape for review; it is not required now.
- **Weekly Progress** (Overview and Progress pages): compares this Monday–Sunday week with the previous one (workouts, sets, reps, volume, timed seconds) and shows which of the 7 muscle groups were trained, only assisted, or missed. You beat last week with more sets *or* more volume (weight × reps). Personal-routine exercises are matched to a muscle by name keywords (`GymRules.muscleOf`); unmatched names are reported as unclassified, never guessed.
- `frontend/gym/gym.js` / `gym.css`: optional navigation, Hub, workout mode, nutrition and progress. Important data lives in SQLite. Only the dropdown preference uses localStorage; a running rest timer resets when the browser closes.
- Sessions snapshot their program, so editing/deleting a saved program cannot alter historical workouts. Every completed set persists immediately. Unsubmitted input fields are not saved. Cancelled sessions retain their sets but do not count towards charts or records.
- Weight is stored in kg and displayed in the selected kg/lb preference; body dimensions remain in cm. Plate sets support both units and report an unloadable remainder. Confirm the actual bar/plate weights; collars are excluded.
- Personal records are highest logged weight, then repetitions at that weight, from completed sessions; timed exercises are excluded from strength records. Muscle focus counts primary-muscle sets over 30 days. Streak counts consecutive completed local calendar dates, allowing today to be incomplete. Optional day notes remain separate; **Schedule a workout** creates a real timetable event.
- Nutrition inputs and current targets are stored together. Recalculating does not modify body-measurement history. Manual food logs are estimates, not a food database.
- Gym records are now scoped to the signed-in account's SQLite workspace. The original admin retains existing records. Login is required on LAN devices too; HTTP is still unencrypted, so use a trusted private network and do not expose the server publicly without HTTPS. See `tests/accounts/README.md`.

## Transparent estimate methods

## Training journey, own routines and calendar

1. Open Gym → Overview → Set up profile. This adult planner collects age, optional-disclosure gender, lifestyle, weight and height. Body metrics do not determine expertise or lifting weights. Nutrition can prefill these values, but its sex-based coefficient is selected separately.
2. Start a training block (4–24 weeks, 1–5 training days/week). Choose consistency or a gradual personal weight-gain milestone. The weight-gain pace ceiling (0.5 kg/week) is a product guardrail, not a medical recommendation. Latest logged weight, or the profile weight if none exists, is the fixed baseline.
3. Every week is a 7-day block starting on the challenge start date. A day earns credit only if a completed workout has every exercise's planned set count at the minimum reps/seconds. Multiple workouts on one day count once. Partial and cancelled sessions do not qualify. Rest is not penalised.
4. After the full period ends, every week must meet its target; a weight challenge additionally needs a qualifying measurement from its final 7 days. The latest such measurement is used. Late entry of an actual past log is allowed, but future logs are not. Level evaluation happens automatically when Gym data is loaded after a save or visit. One award per block is persisted atomically. Existing training difficulty remains user-controlled; game levels do not certify technique or increase loads. Failed/ended blocks keep their history. Start a new block explicitly; the app never keeps increasing weight targets on its own.
5. Select **My own workouts**, write a routine, or load editable Gym A / B examples from the supplied plan. Each line supports `Name | Sets | 8-12 | reps` or `Plank | 3 | 30-45 | seconds`. Saved routines support start/edit/duplicate/delete in Workouts. Timed sets store duration in the existing numeric set field; the exercise snapshot distinguishes seconds from reps.
6. **Schedule** chooses the date, start/end time, location and optional weekly repeat/end date. Events appear green in Timetable; edit dates/times there. Calendar entries snapshot the routine and survive deletion of its saved template. Removing a linked calendar event removes the whole repeat series, not logged sessions. Scheduling does not mark a workout complete or check conflicts automatically; review your calendar.

`gym_journey.py` adds `gym_calendar_links` with a foreign key to timetable events and creates a `before-training-journey-*.db` backup. Profile, blocks and awards use the existing account-local Gym profile JSON. No existing academic rows are replaced by this migration.

Tests cover one-time advancement, unmet goals, duplicate-day/partial/cancelled exclusions, final-week weigh-ins, validation, snapshots, calendar retries and protection of unrelated events. Browser tests cover profile, blocks, custom/timed routines, scheduling, persistence, mobile widths 320/390/744 and both themes.

### Nutrition methods

Nutrition uses [Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/): `10*kg + 6.25*cm - 5*age + coefficient` (+5 male formula, −161 female formula). Activity multipliers are 1.2, 1.375, 1.55, 1.725 and 1.9. The ±10% goal adjustment is a configurable product heuristic, not a personalised prescription.

Protein uses 1.4 g/kg maintenance, 1.6 gain and 1.8 loss, within the [ISSN exercising-adult range](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/). These goal-specific choices are estimates. Fat uses 30% of calories; carbohydrate uses the remainder. Calculator is for adults and explicitly excludes pregnancy, breastfeeding and medical dietary needs. It requires explicit profile choices; it never assumes personal measurements.

Estimated 1RM uses the Epley expression `weight * (1 + reps/30)` only for weighted sets of up to 10 repetitions. It is clearly marked as an estimate, never an instruction to attempt that load.

General workouts and brief technique cues are not injury diagnosis or individual coaching. Stop for pain/unusual symptoms and seek qualified help as appropriate.
