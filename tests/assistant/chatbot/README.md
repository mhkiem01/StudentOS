# Chatbot test cases

These checks never create test records in your real student database. Database/browser tests use temporary SQLite databases. The live checks ask Ollama for proposals but never save them.

## Run the reliable checks

Missing-action regressions are included: promise-only replies trigger one bounded repair attempt; repeated failure shows a visible “Nothing saved” status and retry button, preserves the draft, and does not create records. Tests also cover successful repair, clarification questions, and ordinary informational answers. These deterministic cases simulate model responses; they do not guarantee that Ollama will interpret every request correctly.

Double-click **tests/runners/RUN_CHATBOT_TESTS.bat** in the project folder (Windows), or run:

```powershell
python tests/support/run_tests.py --browser
```

Requires Python, Node.js 22+ and Microsoft Edge or Chrome. No pip/npm installation or AI subscription is needed. The runner starts and closes its own hidden browser and private test server. It does not restart your app or modify your Ollama setup.

For another Chromium browser, set `CHAT_TEST_BROWSER` to its executable path.

For fast backend/JavaScript checks without a browser:

```powershell
python tests/support/run_tests.py
```

## Check your actual local AI

Start Ollama with your configured model installed, then run:

```powershell
python tests/support/run_tests.py --live
```

This checks actual model output for a deadline, recurring reminder, dated study session, note creation, and explanation. It can take several minutes, uses local compute, and reports failures instead of pretending every answer is reliable. Dates are pinned to 20 September 2026 in the test context for repeatability. Run `--browser --live` for both layers. Do not send app chat requests at the same time as these checks.

The existing optional vision check is:

```powershell
python tests/assistant/live_ollama_check.py
```

It reads a generated timetable image and checks both classes. That separate script needs Pillow (`python -m pip install Pillow`) and the Windows Arial font. It does not save any events.

Run every layer together with `python tests/support/run_tests.py --browser --live --vision`. Some database rejection tests intentionally print a foreign-key error; the final PASS/FAIL summary is the result to check.

## Coverage

| Area | Cases |
| --- | --- |
| Composer | Wide desktop input, mobile layout, send disabled when empty, starter prompts |
| Images | PNG/JPG/WebP validation, 12 MB limit, thumbnail/remove, image in sent message |
| Transport | Split UTF-8 stream chunks, progress, incomplete output, model/server errors |
| Actions | Reminder/deadline intent, weekly dates, dated timetable proposals, study-note proposals, action allowlist |
| Confirmation | Cancel makes no changes; confirmed events/reminders/notes persist; edited note content is used |
| Database safety | Atomic note batches, idempotent retries, existing calendar/reminder migration tests |
| Recovery | Failed requests retain draft/image, stop waiting, new chat preserves saved data |
| Existing features | Original backend and calendar-date tests also run |

Browser screenshots are written to your system temporary directory as `portal-chat-desktop.png` and `portal-chat-mobile.png`.

## Try these in the app

- “Remind me to submit COMP1521 tomorrow at 5 PM.”
- “Add a lab submission reminder every Monday until 16 November 2026.”
- “Add a study session on 5 October 2026, 9:30–10:30, in the library.”
- Attach/paste/drop a timetable screenshot: “Fill my timetable from this picture.”
- “Create a study note about TCP and UDP.”
- “What deadlines are coming up, and how can I plan study around my classes?”

The assistant receives your next 14 days of classes and up to 40 incomplete reminders as context. It can propose new reminders, events and notes; it cannot autonomously delete/edit saved items, send emails, browse the web or guarantee that screenshot text is read correctly. Check every proposal. Stopping a request stops the browser waiting; the local model may take a moment to notice the disconnection.

Passing tests checks the covered behavior, not every possible AI answer. The deterministic browser tests use a fake model to make UI/database failures reproducible; the optional live checks measure your actual Ollama model separately.
