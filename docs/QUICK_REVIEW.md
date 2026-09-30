# Quick Review Cards

Open **Flashcards → Quick Review Cards**. Existing Flip Flashcards and their importer/progress remain separate.

Inside a subject, its **Flashcards** tab stays on the subject page and shows only that subject's Flip Flashcards and Quick Review decks. Imports there select from that subject's topics. The navbar **Flashcards** link opens the full library and clears the subject filter.

Choose an existing subject/topic, then **Create Quick Review Deck**. Paste:

```text
Title: Important concepts
Points:
- **Definition**: an important fact.
- Use `command` for this operation.
- Formula: speed = distance / time.

---

Title: Another section
Points:
- Another fact to remember.
```

When no topic is selected, put `Topic: Existing topic name` in every section. Imports never create subjects/topics. Use exactly `---` between sections. Indent continuation lines/nested lists; fenced code blocks stay intact. Preview all pages before confirming. Invalid sections prevent the entire import.

Choose 3–6 points per page (default 5). Long points get their own page with a warning; edit or manually split them in Manage Deck. Text is never silently truncated. Supported formatting includes bold, inline/fenced code, lists, literal formulas/comparisons and `> [!TAKEAWAY]` callouts. No external AI or rendering service is required.

The reader saves your current page and viewed pages. Memorisation is an explicit action, not inferred from reading. Finish Review requires viewing every page in the current run. Restart starts a new run while retaining lifetime viewed/memorised counts and completed sessions. Arrow keys navigate; on phones, content scrolls while navigation stays visible.

Manage Deck supports renaming, editing points, adding/removing pages and points, reordering, moving points between pages and deleting a deck. Save applies edits together. Changed pages lose their old viewed/memorised flags; unchanged pages keep them. Concurrent edits are rejected instead of silently overwriting another device's changes.

In a saved Note, open **Study Tools → Create Quick Review**. Copy important content from the source note into the importer, edit and preview. This manual workflow does not call AI.

Quick Review metrics appear separately in Subject/Topic Progress and do not change quiz accuracy.

## Storage and migration

Restart `server.py` after updating, then refresh the browser. Each account's SQLite workspace gets five additive tables: `quick_decks`, `quick_pages`, `quick_points`, `quick_page_progress`, `quick_progress`. A `before-quick-review-*.db` backup is made before migration. Existing flip cards, questions, notes and progress are not rewritten. Removing a topic also removes that topic's Quick Review decks through foreign keys. Deleting only a Quick Review deck leaves other study material intact.

## Run tests

From the project directory (Python and Node required; browser checks use Microsoft Edge on Windows):

```powershell
python -m unittest discover -s tests -t . -p test_quick_review.py
python tests/support/run_browser_check.py --quick
python tests/support/run_browser_check.py --notes
python tests/support/run_browser_check.py
```

All checks use temporary fixture databases, not your real notes or study data. Tests cover validation/atomic imports, existing flip import/study, pagination, long/code content, persisted/resumable progress, explicit memorisation, editing/reordering, scoped metrics, Notes integration and mobile light/dark layouts.
