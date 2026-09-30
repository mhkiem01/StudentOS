# Quiz types

## Managing an existing quiz

Use **Manage quiz** on a topic card, in the Quiz study mode, during a quiz,
or on its results screen. The topic's existing ••• menu also keeps its manager.
Management during an attempt pauses it and returns to the topic first.

Tools include search, edit question/choices/correct answers/explanation, move
up/down, duplicate, add/change/remove images, add questions, delete individual
questions, reset mastery counts and set Normal/Mastery preferences.
Reordering moves saved answer/flag indices with their questions. Editing a
question's answer content clears the unfinished checkpoint after confirmation.
Completed results remain independent snapshots.

**Delete quiz questions** clears only the question bank and unfinished checkpoint
after confirmation; it keeps the topic, notes, flashcards and completed results.
Deleting an entire topic is still available separately in its ••• menu.

## Normal and Mastery

Start Quiz, Timed Quiz and Restart Quiz now open a Normal / Mastery selector.
Normal retains existing scoring. Mastery lets you set 1–100 correct answers.

Correct answers accumulate across Mastery attempts, once per question per attempt.
Wrong answers do not reset the count. Normal attempts do not add to it. Changing
the question text, choices or correct answer resets its effective mastery count.
Settings and counts persist in your own SQLite workspace, not browser-only storage.

At the end of a Mastery quiz, qualifying questions appear in a review popup.
Nothing is selected by default: Keep questions/close leaves them intact. Selecting
questions and clicking Delete permanently removes them from the topic/database.
The completed attempt keeps its question snapshot and score. Keep a workspace
backup if you might need to restore deleted questions.

Changing quiz type with a saved checkpoint asks before starting a fresh attempt.
Targets can be adjusted each time you start. Previously completed questions are
not counted again by resuming an already-answered attempt.

Run isolated tests:

```
node tests/study/quiz_mastery.js
python -m unittest discover -s tests -t . -p test_quiz_mastery.py
python tests/support/run_browser_check.py
```

The browser test requires Node.js and Microsoft Edge and uses temporary accounts
and databases only. It never deletes questions in your real workspace.
