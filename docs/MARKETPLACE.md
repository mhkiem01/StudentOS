# Marketplace

The existing portal now has a shared Marketplace → Notes / Tutoring Program.
All students must use accounts on the **same portal server**. Separate local
installations do not discover each other. No demo accounts or listings are seeded.

## Available workflows

- Notes search, subject/topic/resource/price/format/rating/university filters,
  saved items, seller profiles, listing drafts/publication/unlisting and updates.
- Seller upload: PDF (8 MB), Markdown (100 KB), or a snapshot of an existing own
  Portal Note. Explicit rights confirmation is required.
- Public text excerpt preview with an expanded reading dialog. Full files are
  never embedded in public listing JSON. Full downloads require seller ownership
  or an acquired resource, checked on the server.
- Free acquisitions, protected downloads, library, verified reviews and reports.
- Editable acquired Markdown/Portal Notes import into **existing** Subjects,
  Topics/Weeks and the normal Notes Editor. The buyer owns an independent copy.
- Paid prices and carts; checkout explicitly refuses to pretend a payment happened.
- Tutor registration/profile editing, subjects, default hourly price, session
  types, languages, timezone, weekly availability and blocked dates.
- Available-slot selection; transaction-serialized overlap checks; requests or
  instant confirmation; accept, decline, cancel and complete after the session.
- Tutor dashboard, legitimate student history, verified session reviews and
  optional explicit addition of a confirmed session to the personal timetable.
- Separate Marketplace conversations, unread counts and notifications. No
  Socialise friendship is required; existing explicit Socialise blocks are respected.
- Mobile filters/detail dialogs and inherited light/dark appearances.

## Payments and accounting

`payment_provider.py` deliberately uses an unconfigured provider. No paid-file
ownership, charges, refunds, payouts or earnings can be manufactured by a client.
The shared schema separates orders/items/ownership from ledger entries for buyer
payments, platform fees, seller earnings, refunds and payouts. Amounts are integer
minor units. The platform currency is AUD. Admin-configurable fee defaults to 0%.
There is no live provider adapter, payout onboarding or webhook endpoint yet.

Tutoring can be arranged without a payment provider: the quote is stored but
clearly labelled **payment not collected**. It is not recorded as earnings.
No personal Finance transactions are created automatically.

Before commercial deployment, add a real provider with signed webhook verification,
idempotent settlements/refunds, connected seller accounts, reconciliation and
appropriate operational/legal review. Do not expose this local HTTP app directly
to the public Internet; it needs a hardened HTTPS deployment first.

## Version and privacy policy

Each upload/snapshot creates an immutable version. Acquisition pins that version;
later seller updates do not silently replace acquired files or imported edits.
Re-importing the same version refuses to overwrite the buyer's note.
Private note image paths are omitted from rich-note snapshots instead of pointing
at another user's private workspace. Profile photos reuse the existing safe image
handling. University is account-provided, only public with explicit opt-in, and
is **not** advertised as institution-verified. Private profile fields stay private.

Only booking participants can read private booking data. Public tutor profiles
show availability, not other students' reservation details. Pending requests
reserve their slot until accepted, declined or cancelled. Sessions use IANA
timezones; slots are revalidated at submission. Group is a session label, not a
multi-seat group-event system. Availability editor supports one window per day.
Session reminders appear on Marketplace refresh/poll when within 24 hours; there
is no email/push delivery or background notification service.

Calendar import requires a click and creates an ordinary independent event.
Subsequent booking cancellation does not silently delete/edit this personal copy;
the UI tells participants to update it manually. No public personal timetable data
is used to construct tutor availability.

## Deliberate limitations / remaining work

This is a functioning initial implementation, **not every enhancement in the
89-section brief**:

- PDF preview is a seller-written public excerpt, not generated selected-page
  PDF rendering. No page/zoom controls, cover upload, or automatic PDF conversion.
- Downloads retain their source format. Markdown/Portal Notes are not converted
  to PDF; PDF-only purchases are not presented as editable rich text.
- Create missing subjects/topics in the existing Subjects area before importing.
  No-topic imports require a numbered Week, matching existing Notes validation.
- Default tutor rate only; per-subject rate overrides and detailed calendar-style
  tutor schedule are not yet implemented. No multi-seat sessions or online status.
- Marketplace-wide currency changes, paid checkout/refunds/payouts, page-level
  PDF previews and richer seller sales/earnings reporting remain future work.
- Reporting is stored for administrators; listing takedown and report resolution
  are implemented. Automated copyright/malware scanning and formal review appeals
  are not. File signatures/size checks do not guarantee a file is safe to open.
- Small-host repository queries are not intended as an Internet-scale search
  engine. PostgreSQL migration/pagination/rate limiting need deployment work.

## Data and backups

Additive `market_*` tables live in shared `data/accounts.db`, alongside accounts
and Socialise. Private study workspaces are untouched except explicit note or
calendar imports. The first Marketplace request creates a verified-source SQLite
snapshot in `data/backups/before-marketplace-*.db` before the migration.

Run `python tools/backup_marketplace.py` for a consistent host-only shared backup.
It includes files, versions, messages, bookings **and account credentials/session
hashes**; keep it private. The normal workspace download intentionally excludes
shared Marketplace data. Back up private workspace databases separately.

## Verification

See `tests/marketplace/README.md` and `tests/runners/RUN_MARKETPLACE_TESTS.bat`. All automated
records use isolated temporary databases, not your actual users or listings.
