# Subject progress and organised Notes

Open a Subject → **Progress**, or a Topic → **Progress**. Topic tabs also provide direct access to quizzes, flashcards and that topic's Notes.

## Metrics

- A non-empty topic is one quiz set, matching the existing quiz architecture. A finished result must cover all current questions to count as completed. Retrying does not erase a completed result.
- Accuracy is total correct answers / total answer attempts, weighted across topics. No attempts displays “Not started”.
- Unique coverage counts distinct question fingerprints (question text, choices and answer), not regenerated SQLite row IDs. Repeated attempts increase attempt counts, not coverage. Editing a question's text/choices/answer makes it a new question; identical copies share coverage.
- Mastery is an indicative study guide: Needs Practice below 50%, Developing below 70%, Good below 85%, Strong otherwise. Less than 50% coverage or fewer than five available questions caps the label at Developing; Strong also requires at least five unique questions and 80% coverage. Activity dates are displayed separately, not used to silently reduce a score.
- Strongest/practice insights require five unique questions and 50% coverage. Flashcard ratings and Notes counts are separate from quiz completion.

## Data preservation

`progress_service.py` adds `study_legacy`, `study_answers`, `study_runs`, `study_active`, and `study_known`. Before migration it creates `before-study-progress-*.db` in the workspace's backup directory. Existing progress, results, sessions and Notes are retained. Legacy aggregate totals are not converted into invented attempts. Coverage is recovered only where saved answers exist. Detailed, clickable quiz history starts with new completed runs.

Question identities are content fingerprints because the existing state writer regenerates question row IDs. Flashcards retain the app's existing position-based review identities. Moving/editing historical content can limit historical coverage reconstruction.

Notes reuse existing `subject_id`, `topic_name` and integer `week` fields. New notes require a valid Subject and either a Topic or Week (1–100). Topic + Week is allowed. Existing unorganised notes remain readable/editable and show an organisation badge. The library groups topic notes and subject-only notes by week, with search, topic/week filters and pinned filtering. Failed saves keep the editor draft.

## Repeatable tests

From this project folder:

```powershell
python tests/support/run_tests.py --dashboard
python tests/support/run_tests.py --notes
python tests/support/run_tests.py --browser
```

These use temporary databases and do not write test records into your workspace. Python, Node.js and Edge/Chrome are required for browser checks. The dashboard suite includes `tests/study/study_progress_browser.js`; backend calculations/migration tests are in `tests/study/test_study_progress.py`. The Notes suite covers autosave, persistence, formatting, recovery and mobile layouts; the chatbot suite covers reviewed actions.

New attempt history cannot reconstruct individual dates or selected answers that the old application never stored. No sample progress is added to your real data.
