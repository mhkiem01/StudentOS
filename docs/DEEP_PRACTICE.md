# Deep Practice

Open-response practice imported from Markdown workbooks, next to the existing multiple-choice quizzes. Students recall facts without choices, explain concepts in their own words, fill in syntax, trace code and memory, fix bugs, write code from a specification and complete cumulative challenges, attempting each question before seeing a worked solution.

Find it under **Subjects → Deep Practice** in the sidebar, from **Import → Deep Practice (open response)**, from **＋ Add quiz → Deep Practice workbook…**, and in a subject's **Quizzes** tab once a workbook is linked to that subject.

## Importing a workbook

Upload a `.md` file or paste the Markdown, then choose **Preview import**. Nothing is saved until you choose **Save**.

The importer follows `COMP1521_Part_1_Workbook.md` (copied to `tests/study/fixtures/` as the test fixture):

- Each question starts with an ID line: `P1-001 · Foundation · Recall` (ID · difficulty · learning stage). Stages such as `Transfer + integration` are kept as written and split for filtering.
- `Question:` text, then optional `Answer choices:` with `A.`–`H.`. Code may be fenced or unfenced; unfenced runs (MIPS, C, shell) are detected and fenced with their exact spacing.
- Topic headings are the plain line (or `#` heading) above a question. A topic may appear more than once; each question keeps the heading above it.
- A separate answers section (`Part 1 — Answers and explanations`) where each block starts with the question's ID and contains `Answer:`, `Explain:`, `Key rule:`, `Common mistakes:`, `Why other options are wrong:` and `Check your solution:`. Answers are matched to questions **by ID, never by position**. Answers written directly under a question are also accepted.
- Everything before the questions (coverage map, source notes, assumptions, how to study) is kept as sections; tab-separated rows become tables. `- [ ]` items in the independence checklist become an interactive checklist.

The preview shows the title and description (editable), counts of questions, matched answers, multiple choice, topics, code blocks and checklist items, and breakdowns by topic, type, difficulty and stage. Problems are listed with their question ID and source line:

- **Errors** (save is blocked): duplicate question or answer IDs, an answer letter that is not one of the choices.
- **Warnings** (the quiz is saved and labelled *incomplete*): questions without answers, answers without questions, gaps in a numbered ID sequence (usually a mistyped header), unterminated code fences, embedded HTML (always shown as text, never run), any line that could not be placed.
- **Notes**: question types that could not be inferred confidently.

Question types are not labelled in the workbook, so they are inferred from answer choices, `___` blanks, the learning stage and the wording, and every row shows the reason. Correct the type, response format (selection, text, code, or text + code) or code language in the table before saving, or later with **Edit question types**. The original Markdown is stored: **Download original Markdown**, **Reprocess original Markdown** and **Replace with updated workbook** keep attempts and corrections, and bump the content version.

## Practice

**Start practice** (or **Resume practice**), **Practise topic**, **Review questions needing work**, or **Practise by filter** (topic, difficulty, stage, type). The workspace has a question list (a drawer on phones) whose states always show an icon and a label: not started, draft saved, submitted, skipped, solution revealed, needs review, correct (auto-marked) and independent (self-assessed).

1. Answer: choices for multiple choice; a text box with Markdown preview; inputs inside the code where the workbook has `___` blanks; a monospaced output box with a **Show whitespace** view for tracing; explanation plus corrected code for debugging; a code editor (Tab/Shift+Tab indent, auto-indent, Esc then Tab to leave, language choice) plus reasoning and tests for implementation. Answers save automatically; if saving fails, a copy stays in this browser, the status says so, and leaving the page asks first.
2. Optionally record confidence (unsure, partly confident, confident).
3. **Submit answer**, **Skip for now**, or **Reveal solution**. Revealing without submitting is allowed and recorded as *revealed without an attempt*.
4. Compare your answer with the worked answer or example solution (side by side on wide screens), explanation, key rule, why the other options are wrong, common mistakes and the "Check your solution" self-review checklist.
5. Record **Solved independently**, **Partly correct / needed help** or **Needs more practice**, clearly labelled as your own assessment.

Editing an answer after submitting is saved as a revision; the original submission (with its confidence and time) is never overwritten. Multiple choice is marked automatically only when the answer key has a valid letter. Written answers and code are never auto-graded, string-matched or run.

## Assessment

**Start assessment** hides solutions and marks. Answers save as you go and can be changed; **Finish assessment** lists unanswered questions first. After submitting, every question opens in the review view with its solution, and multiple choice is marked. This is self-study practice, not a proctored exam.

## Progress

Reported separately, never combined into one score: answers submitted, multiple-choice accuracy (auto-marked), open responses awaiting self-review, self-assessed outcomes, questions revealed without an attempt, skipped questions and topics needing more work. Nothing is labelled "mastered", and finishing every question is not a guarantee of mastery. **Start fresh** keeps earlier attempts in the history. The independence checklist is saved and labelled as your own assessment.

## Storage and security

Data lives in the signed-in account's own workspace database (`deep_quizzes`, `deep_attempts`, `deep_responses`, `deep_checklist`), so one student's answers are never visible to another. The server sends solutions only after a reveal (practice) or after an assessment is submitted; they are never in the question list, labels or previews. Imported Markdown is rendered with every character escaped; only headings, paragraphs, lists, tables, code blocks, inline code, bold and `http(s)`/`mailto` links are formatted.

## Tests

- `python -m unittest tests.study.test_deep_practice` — parsing the workbook (48 questions, 48 matched answers, 11 multiple choice, IDs, order, topics, code, tables), validation messages, hidden solutions, original vs revision, assessment rules, history and versions.
- `node tests/study/deep_practice_markdown.js` — escaping and safe rendering.
- `python tests/support/run_browser_check.py --deep` — the whole workflow in a browser, including reload persistence, phone layout with long code, sanitised HTML and the unchanged multiple-choice importer.
