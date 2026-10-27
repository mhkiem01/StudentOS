# Optional Gym module

Enable it in **Settings → Modules / Features → Gym Module**. It is off by default. Disabling hides navigation and blocks Gym writes except preferences; no records are deleted. Workout suggestions need no body metrics or AI.

## Run tests

Double-click `tests/runners/RUN_GYM_TESTS.bat`, or run from the project directory:

```powershell
python -m unittest discover -s tests -t . -p "test_gym*.py"
node tests/gym/gym_rules.js
node tests/gym/gym_planner.js
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

Plan coverage: the plan builder over 15,120 answer combinations (one workout per chosen day, no gym equipment at home, nothing too hard for beginners, sessions within the chosen length, cardio/core/stretching only when chosen, splits and A/B rotation), a picture for every library exercise, plan storage and validation, nutrition from the answers, and discipline XP (on plan, missed, made up the next day, partly done, extra, paused, plan changes, levels). The browser test walks through the questions, the plan hub, full-list logging, XP, swapping, timetable links, nutrition, pause/resume and mobile/dark layouts.

## Architecture and limits

- `gym_store.py`: separate additive Gym tables and validation. Migration creates `backups/before-gym-*.db` before adding tables. Existing academic/settings rows are not modified.
- `frontend/gym/gym-rules.js`: curated exercise library, maintainable rule-based templates, equipment matching, records, streak and plate calculation. Future AI can propose the same workout shape for review; it is not required now.
- **Exercise Library** (Workouts page): about 135 common gym exercises and machines, each tagged **Machine** (the load comes from a machine, cable station or Smith bar on a guided path) or **Own weight** (your body or free weights such as dumbbells, barbells and kettlebells). Search matches name, muscle, target (e.g. "glutes"), equipment and common aliases ("pec deck", "stairmaster", "squads"). Filter with the Machine / Own weight tabs and the muscle dropdown. The same search is in **Create Workout**. Opening an exercise from the library offers **Log this exercise now** (starts a workout with it) or **Add to current workout** (`add_exercise`, max 20 per workout). Cardio machines are logged in minutes and holds such as Plank in seconds; neither counts toward strength records or volume. Original exercise ids are kept, so earlier logs still resolve.
- **Weekly Progress** (Overview and Progress pages): compares this Monday–Sunday week with the previous one (workouts, sets, reps, volume, timed seconds) and shows which of the 7 muscle groups were trained, only assisted, or missed. You beat last week with more sets *or* more volume (weight × reps). Personal-routine exercises are matched to a muscle by name keywords (`GymRules.muscleOf`); unmatched names are reported as unclassified, never guessed.
- `frontend/gym/gym.js` / `gym.css`: optional navigation, plan hub, workouts, nutrition and progress pages, settings. Important data lives in SQLite. Only the dropdown preference uses localStorage; a running rest timer resets when the browser closes.
- `frontend/gym/gym-onboarding.js`: the first-visit questions (about you, daily activity, goal, experience, gym or home, workout type, what you enjoy and focus areas, days/length/time, review). One question per screen; single-choice answers move on by themselves. "Skip for now" is remembered (`plan_skip`).
- `frontend/gym/gym-planner.js`: turns answers into a weekly plan. Ranked exercise lists per slot (compound lifts first), filtered by equipment and level, rotated between A/B days, filled to the chosen session length. Deterministic; see `docs/GYM.md`.
- `frontend/gym/gym-plan-ui.js`: level/XP/discipline card, today's workout, the week strip, the weekly plan page (swap, add to timetable), the live workout list, nutrition needs and the how-to dialog.
- `frontend/gym/gym-art.js`: SVG stick-figure pictures for every exercise, posed with two-bone inverse kinematics. Static icons in lists; an animated start → finish demonstration in the how-to dialog (start/finish frames when the system asks for reduced motion). Own exercises get a picture by name keywords, then by muscle.
- `backend/gym/gym_plan.py`: stores the plan in the Gym profile JSON (answers, sessions, schedule history, pauses) and recomputes XP from completed workouts on every load. Saving a plan also keeps the older preferences (level, goal, equipment, duration, units, athlete) in sync and, with consent, writes nutrition targets.
- Sessions snapshot their program, so editing/deleting a saved program cannot alter historical workouts. Every completed set persists immediately. Unsubmitted input fields are not saved. Cancelled sessions retain their sets but do not count towards charts or records.
- Weight is stored in kg and displayed in the selected kg/lb preference; body dimensions remain in cm. Plate sets support both units and report an unloadable remainder. Confirm the actual bar/plate weights; collars are excluded.
- Personal records are highest logged weight, then repetitions at that weight, from completed sessions; timed exercises are excluded from strength records. Muscle focus counts primary-muscle sets over 30 days. Streak counts consecutive completed local calendar dates, allowing today to be incomplete. Optional day notes remain separate; **Schedule a workout** creates a real timetable event.
- Nutrition inputs and current targets are stored together. Recalculating does not modify body-measurement history. Manual food logs are estimates, not a food database.
- Gym records are now scoped to the signed-in account's SQLite workspace. The original admin retains existing records. Login is required on LAN devices too; HTTP is still unencrypted, so use a trusted private network and do not expose the server publicly without HTTPS. See `tests/accounts/README.md`.

## Transparent estimate methods

## Own routines and calendar

Earlier versions had a profile card and 4–24 week "training blocks" on the overview. The plan questions and discipline XP replace them in the interface. The block API (`journey`, `end_journey`) and its tests remain, so older data keeps working.

1. In Workouts → Saved workouts, write a routine or load editable Gym A / B examples from the supplied plan. Each line supports `Name | Sets | 8-12 | reps`, `Plank | 3 | 30-45 | seconds` or `Treadmill | 1 | 20 | minutes`. Saved routines support start/edit/duplicate/delete in Workouts. Timed sets store duration in the existing numeric set field; the exercise snapshot distinguishes seconds from reps.
2. **Schedule** (or **📅 Timetable** on a plan day, which pre-fills a weekly repeat at your chosen time) chooses the date, start/end time, location and optional weekly repeat/end date. Events appear green in Timetable; edit dates/times there. Calendar entries snapshot the routine and survive deletion of its saved template. Removing a linked calendar event removes the whole repeat series, not logged sessions. Scheduling does not mark a workout complete or check conflicts automatically; review your calendar.

`gym_journey.py` adds `gym_calendar_links` with a foreign key to timetable events and creates a `before-training-journey-*.db` backup. Profile, blocks and awards use the existing account-local Gym profile JSON. No existing academic rows are replaced by this migration.

Tests cover one-time advancement, unmet goals, duplicate-day/partial/cancelled exclusions, final-week weigh-ins, validation, snapshots, calendar retries and protection of unrelated events. Unit tests cover one-time block advancement (API only). The Gym browser test covers custom/timed routines, scheduling, the plan, persistence, mobile widths 320/390/744 and both themes.

### Nutrition methods

Nutrition uses [Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/): `10*kg + 6.25*cm - 5*age + coefficient` (+5 male formula, −161 female formula). Activity multipliers are 1.2, 1.375, 1.55, 1.725 and 1.9. The ±10% goal adjustment is a configurable product heuristic, not a personalised prescription.

Protein uses 1.4 g/kg maintenance, 1.6 gain and 1.8 loss, within the [ISSN exercising-adult range](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/). These goal-specific choices are estimates. Fat uses 30% of calories; carbohydrate uses the remainder. Calculator is for adults and explicitly excludes pregnancy, breastfeeding and medical dietary needs. It requires explicit profile choices; it never assumes personal measurements.

Estimated 1RM uses the Epley expression `weight * (1 + reps/30)` only for weighted sets of up to 10 repetitions. It is clearly marked as an estimate, never an instruction to attempt that load.

General workouts and brief technique cues are not injury diagnosis or individual coaching. Stop for pain/unusual symptoms and seek qualified help as appropriate.
