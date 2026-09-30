# Run Marketplace checks

From the project folder:

```powershell
python -m unittest discover -s tests -t . -p test_marketplace.py
python tests/support/run_tests.py --dashboard
python tests/support/run_tests.py --notes
python tests/support/run_tests.py --browser
```

Or double-click `tests/runners/RUN_MARKETPLACE_TESTS.bat` for the full backend and dashboard
browser suite. Requires Python, Node.js and Edge/Chrome. No Ollama or payment
credentials are needed. Test users/files exist only in temporary databases.

Coverage: migration, no fabricated records, paid-file denial, no fake settlement,
free acquisition idempotency, fixed acquired versions, review eligibility,
snapshot sanitization, integer money, private chats and unread status, booking
overlap/ownership/status/availability, cancellation, legitimate tutor reviews,
moderation. Account HTTP tests cover real session/CSRF boundaries, protected
downloads and importing into only the buyer's existing Notes workspace.

Dashboard browser tests add own-note listing publication/search/edit, tutor
signup and availability, dashboards, mobile filter/detail dialogs and 320/390/744px
light/dark overflow checks, alongside the existing portal regressions.

Manual two-account check:

1. Seller publishes original notes. Buyer sees only the public excerpt.
2. Paid download is denied; free claim unlocks download/import. Import, edit the
   buyer copy, then verify the seller's note remains unchanged.
3. Seller uploads a new version; buyer's previously acquired content is unchanged.
4. Tutor sets availability. Student selects a returned slot; another overlapping
   reservation is rejected. Tutor accepts, student explicitly adds to timetable.
5. Send messages from either side. Socialise and academic reminders stay separate.
6. Complete a past confirmed session. Only its student can review it once.

Real financial settlement and page-rendered PDF previews are not implemented;
these tests do not claim to verify those features. See MARKETPLACE.md.
