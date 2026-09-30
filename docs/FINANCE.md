# Finance / Personal Money

Enable **Settings → Modules / Features → Finance Module**. Finance starts off.
Disabling removes its navigation and leaves every saved record intact. Your data
stays in your signed-in account's existing SQLite workspace and is included in
**Download workspace backup**. Keep the `data` directory when deploying updates.
The additive migration creates a `before-finance-*.db` backup first.

## Using Finance

- Overview: selected-month income, spending, savings, estimated safe-to-spend,
  goals, budgets, conversion, weekly chart, bills and descriptive tips.
- Goals: purchase, travel, emergency or other goals; starting balance, target
  date, planned monthly contributions, pause, contribution history and deletion.
  Travel-only cost estimates are optional. They do not automatically replace
  the goal's target amount. Contributions are savings transfers, not expenses.
- Budget: independent weekly/monthly category limits; Monday–Sunday weeks.
  The period date and arrows browse history. Limits are reusable templates:
  editing them also changes past-period comparisons. Zero is no allocation.
- Bills: one-off, weekly, fortnightly, monthly, quarterly or yearly schedules.
  Each payment is tied to one dated occurrence. Month-end dates retain their
  original anchor (31 Jan → 28/29 Feb → 31 Mar). Marking paid can optionally
  add a linked expense and is idempotent. Paid schedules and linked expenses
  cannot be rewritten independently. Delete a schedule only if you intend to
  remove its payment history; its recorded expenses remain.
- Transactions: open from Quick Actions or Budget. Filter/search, edit/delete
  manual records, and export all transactions as CSV. CSV text is protected
  against formula injection. CSV import is not implemented.

All primary records use the workspace base currency. Choose it before entering
records; changing it afterward is blocked to prevent silently relabelling
historical money. Cross-currency goals and banking connections are not included.
Amounts are validated with Python Decimal and stored as integer minor units.
JPY/KRW have zero decimal places; the other supported currencies have two.

## Estimates

Monthly income and spending sum dated transactions in the selected month.
Savings = income − expenses, not an account balance.

Estimated safe-to-spend = income − expenses − actual goal contributions for the
month − remaining active monthly goal plans − protected commitments − paid
bills not recorded as expenses.

For each category, protected commitments are the greater of its unspent monthly
budget and unpaid bills due through month end (including overdue bills). Paid
bills without an expense also reduce the remaining protected budget. This
avoids counting a bill twice just because it is in a budget. Weekly-only limits
are not reserved in this monthly formula. Negative results stay negative.
No historical carryover balance or future income is inferred. Only enter
income as received, not as a forecast.

Goal balances include starting balance plus contributions through the selected
date. Required weekly/monthly savings divide the remaining amount by actual
days to target (monthly uses 365/12 days). Completion estimates use the entered
monthly contribution plan; no growth, interest or investment return is assumed.
These are planning estimates, not financial advice.

## Exchange rates

`currency_provider.py:get_latest_rates(base_currency)` is the replaceable adapter.
Current provider: [Frankfurter v2](https://frankfurter.dev/), a free public API
requiring no API key. Only currency codes are sent, never financial records.
If a future provider needs a key, load it from a server environment variable,
never frontend code or committed files.

**Update Rates** is the only network refresh trigger. Each successful snapshot
is appended to `finance_currency_rates`; old snapshots remain. Amount changes,
currency selection and reverse conversion reuse the last snapshot, including
cross-rates. Failed updates retain that snapshot and display an error.
The UI shows fetch time and source observation dates. Rates may be stale and
may differ from bank/card/payment-service rates. Accounting records are never
revalued when rates change.

## Tests

```powershell
python -m unittest discover -s tests -t . -p test_finance.py
python tests/support/run_tests.py --dashboard
```

Or double-click `tests/runners/RUN_FINANCE_TESTS.bat`. Browser tests run against a temporary
workspace, with deterministic test-only rates. Production receives no example
transactions, goals, budgets, bills or rates. Tests cover migration, integer
precision, recurrence, payment idempotency, account/backup isolation, toggles,
forms, conversion, offline cache preservation, and mobile layouts.

Optional live adapter check (no records saved):

```powershell
python -c "from currency_provider import get_latest_rates; print(get_latest_rates('AUD'))"
```
