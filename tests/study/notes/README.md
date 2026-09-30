# Notebook workspace tests

Double-click `tests/runners/RUN_NOTES_TESTS.bat`, or run:

```powershell
python tests/support/run_tests.py --notes
```

Requires Python, Node.js 22+ and Edge/Chrome. The test runner starts its own hidden browser and temporary SQLite database. Your student data is never changed. No real AI call is needed for the repeatable browser suite; its study-tool replies are deterministic fixtures, and the real app continues using Ollama.

Coverage: backup-first migration, legacy Markdown preservation, subject/topic validation, metadata and pin persistence, conflict checks, HTML sanitization, scoped library, large document editor, native formatting and undo/redo, autosave and explicit save, templates and callouts, checklists, image uploads, unsaved close choices, server-failure recovery, AI summary integration, fullscreen and mobile layout. The current browser suite is `workspace.test.js`; `browser.test.js` records the previous three-column UI and is no longer run.

Fast checks: `python -m unittest discover -s tests -t .` and `node tests/study/notes_markdown.js`.

Existing Markdown notes are rendered safely and remain unchanged until saved through the new editor. New/edited rich documents use allowlisted HTML, sanitized in both browser and server. `content_format` is added by the backup-first migration; subject/topic relationships are unchanged. Formatting uses the browser's native editing surface without external CDN scripts. Handwriting intentionally remains a Coming Soon placeholder.

Changes autosave after 1.5 seconds. SQLite is authoritative; localStorage keeps an account-scoped recovery copy while changes are unsaved. Reopen the note (or New Note for an unsaved new draft) to restore it. Keep the same browser origin when recovering. Refresh warns about unsaved changes; a stale cross-device save is rejected rather than overwriting newer content.

Images are stored under the account workspace's `note_uploads` directory and served only after authentication. Back up that directory alongside the SQLite database to retain images: a database-only backup does not contain image files. HTML export currently references portal-hosted images, so it is not a portable offline image bundle. PDF export is not implemented.

Notes with no subject after migration or subject deletion are preserved under **Notes → Choose subject → Unassigned Notes**. Edit them to choose a subject. New notes always require a real subject. Topic choices are limited to that subject.

AI-generated study materials are drafts: they appear in the existing validated importer, not directly in your question/card database. A note with a topic reuses it automatically; a note without one prompts for an existing topic or an explicitly created topic in the same subject.
