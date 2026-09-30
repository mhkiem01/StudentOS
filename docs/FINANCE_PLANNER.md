# Finance tracker and payday planner

Finance is still optional in Settings. Existing income, expenses, bills, budgets, goals and contributions are preserved.

## Getting started

1. Open Finance → Overview → **Set opening balance**. Enter the money you had **before transactions on that starting date**, including money already set aside for goals. Earlier entries remain in history but are excluded from the balance. Negative opening balances are supported.
2. Add income as **Single pay**, **Weekly**, or **Monthly**. For recurring income, choose whether the first due payment was received. Future payments stay planned. Use **Mark received** when the money actually arrives; you can enter the actual received amount/date. Do not also enter that payment as separate single income.
3. Enter expenses and bills. Paying a bill with a linked expense subtracts it once. A bill marked paid without creating an expense is also included once in the balance/statement.
4. Create goals and budgets. The goals panel totals the weekly/monthly saving required for all active, incomplete goals. Overdue goals are flagged separately because they need new target dates. Paused/completed goals are excluded from the requirement.

## What the numbers mean

- **Recorded balance:** opening balance + received/dated income − expenses − paid bills without a linked expense. Only entries on/after the opening date and through the selected date (never beyond today) count. This is a manually entered tracker, not a live bank connection.
- **Allocated to goals:** starting goal savings plus contributions through the balance date. Allocations remain within total cash; contributions are not extra income or spending. Pausing a goal does not magically release saved money.
- **Unallocated cash:** recorded balance minus saved goal allocations.
- **After month commitments:** unallocated cash minus remaining planned goal contributions and the larger of unspent monthly budget or unpaid bills plus future-dated expenses in each category through month end. Overdue bills are included. Negative results are shown as shortfalls.
- **Next 30 days projection:** recorded balance + upcoming scheduled income + future-dated transactions − unpaid bills through the forecast date. Due/unconfirmed income is flagged but not assumed received. Unrecorded day-to-day spending is not predicted. This is not spendable money.
- Dashboard monthly income/spending show recorded entries in the selected month through the displayed as-of date, including paid bills without a linked expense. Future-dated entries stay in the projection and statement, not these recorded totals.

## Managing records

View the account statement for per-entry running balances, search, type/category/date filters, and CSV export. Filtering does not recalculate the underlying balances. Entries before the opening date or after the balance date have no running balance and are labelled accordingly.

Manage income schedules in the Payday planner. Edit unpaid amounts, pause/resume, set an end date, or delete a schedule while retaining received income. Once payments exist, changing the recurrence start/frequency requires a new schedule; pause the old one. Monthly dates stay anchored to the original day (31 Jan → 28/29 Feb → 31 Mar).

A confirmed payment is protected from independent editing. **Undo receipt** removes its income transaction and makes that scheduled occurrence pending again. Confirm it again with the corrected amount. Duplicate confirmations cannot create duplicate income.

## Data safety

Three additive SQLite tables: `finance_account`, `finance_income_schedules`, `finance_income_receipts`. Migration makes a `before-money-planner-*.db` backup in the workspace's backups folder. Existing finance tables are not rewritten. Each signed-in account continues to use its own private database. Currency changes are locked once an opening balance or income schedule exists, as with the existing ledger.

## Tests

```powershell
python -m unittest discover -s tests -t . -p 'test_finance*.py'
python tests/support/run_browser_check.py --finance
```

The browser runner requires Node and Microsoft Edge on Windows. Both commands use temporary fixture databases, not your real financial records. Coverage includes opening/negative balances, date cutoffs, savings totals, bill double-counting, recurrence, duplicate receipts, undo/pause/delete, migrations/reopen persistence, existing Finance workflows and 320/390/744px layouts.
