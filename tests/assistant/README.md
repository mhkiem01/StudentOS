# App-wide assistant actions

Run from the project directory (Python, Node.js and Microsoft Edge required):

```powershell
python -m unittest discover -s tests -t . -p "test_assistant*.py"
python -m unittest discover -s tests -t . -p test_ai_chat.py
python tests/support/run_browser_check.py --assistant
```

Or double-click `tests/runners/RUN_ASSISTANT_TESTS.bat`. These checks use disposable databases and a deterministic model fixture, not your personal data.

Optional real-model check (Ollama must be running; synthetic context, no data writes):

```powershell
python tests/assistant/live_assistant_smoke.py
```

## Using it

Open AI Tutor. Try:

- “I earned $500 today, paid $200 rent and spent $35.50 on groceries.”
- “Log breakfast: 600 calories, 60 g protein, 50 g carbs and 18 g fat.”
- “Create a reminder for my lab submission next Monday at 5 PM.”
- “Create three flashcards about TCP in my Networks topic.”
- “Pin my TCP note.”
- “Change my theme to dark.”
- “Draft a message to my project group about tomorrow’s meeting.”

Each change appears as a separate proposal. Click **Review**, edit the fields, then confirm. Cancel/Dismiss performs no write. Missing nutrients or amounts must be supplied; the assistant must not turn unknown values into zero. Shared/destructive changes need a separate acknowledgement. Saved results include their record IDs for follow-up requests. To create related records, confirm the parent first and then request its children.

The **Capabilities** button is generated from the server registry, so it shows the actual supported operations rather than a hardcoded promise.

## Coverage and explicit boundaries

| Area | Assistant integration |
| --- | --- |
| Finance | Income/expenses, edits/deletes, opening balance, budgets, goals/contributions, bills and recorded payments, recurring pay and receipts, preferences |
| Gym | Meals/macros, measurements, profile/preferences, routines, session/set logging, training blocks, nutrition estimates, dated/repeating workout scheduling |
| Planning | Timetable create/edit/delete, recurring imports, reminders/status/deletion, general tasks/status/preferences |
| Study | Subjects, topic creation/deletion, question/card CRUD and ordering, quiz type/target, notes/content/pins/tags, Quick Review imports/edits/memorisation |
| Socialise | Permission-checked profiles, friend requests, groups/clubs/projects, memberships, messages/posts/comments, events/attendance, project tasks |
| Marketplace | Visible listings/tutors/bookings context, saving/cart, free acquisitions, listing visibility, booking/status, messaging, reviews and reports |
| Settings/navigation | Own display profile, avatar, appearance and opening app pages |

This is **not unrestricted control of every UI button**. Passwords/admin controls, database reset/restore, file/image uploads, actual money transfers/checkout, publishing resources/accepting tutor agreements and assessed quiz answers remain manual. These boundaries are visible in the capability browser and model instructions. Timers, exports, charts, currency-rate refresh and rich-editor formatting remain in their dedicated screens. There is no browser/filesystem/shell tool available to the model. Personal-record suggestions are not medical advice, nor can AI verify exercise technique.

## Architecture and safety

- `assistant_catalog.py`: exact operation/field allowlist, schemas and coverage metadata. New features must register an operation explicitly; this does not auto-expose arbitrary endpoints.
- `assistant_actions.py`: authenticated account-local context and adapters to the existing validating stores. Context uses only the current workspace and the Socialise/Marketplace visibility-filtered APIs. It never includes account passwords, session credentials or arbitrary filesystem paths. Context is bounded and may omit older records; the model is instructed to clarify missing/ambiguous IDs. It is not a comprehensive search of every historical record.
- `ai_provider.py`: capability-aware structured proposals, one bounded missing-action repair, explicit errors. The current chat provider is local Ollama. The default context window is 16,384 tokens; `OLLAMA_CONTEXT` can adjust it from 4,096 to 32,768, trading memory use against context capacity. Large requests may still need splitting, especially on slower hardware.
- `/api/assistant/prepare` stores only a review receipt, not the domain change. `/api/assistant/execute` requires confirmation and checks the receipt in the current account. Reviews expire after 30 minutes. Private changes and their receipt commit atomically, so replay cannot duplicate an income/meal.
- Shared/account actions reserve their receipt before calling the existing permission-checking store. If a process stops between the shared commit and receipt completion, retry is blocked with an explicit “check destination” message instead of risking duplicate messages. A failed/shared uncertain action must be checked before resubmitting as a new proposal.
- Each proposal is independent, not an all-or-nothing batch. Already saved proposals remain saved when another is cancelled or fails. Backend validation errors stay visible in the review; no claim of success is made for a failed action.
- Changes reload the current page’s shared study/portal state. Other browser tabs should be refreshed before editing the same records; this app’s legacy whole-state study save is not a multi-editor conflict-resolution system.
- Additive migration backs up existing records as `before-assistant-actions-*.db` and creates `assistant_requests`. This is an action receipt store, not full chat-history storage.

Tests cover no-write proposals, cancel, confirmation, editable amounts, real destinations, retry safety, mixed money/meal actions, partial edit preservation, missing nutrients, disabled modules, shared permissions, receipt expiry, account isolation, allowlist rejection, capability UI and mobile layout. Model tests cannot guarantee that a local LLM interprets every possible wording correctly; review remains essential.
