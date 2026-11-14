# Iron Paradise

Project brief for building the Iron Paradise Gym web app. Read this fully before writing code. Where this brief and a later instruction conflict, ask.

## 1. What we are building

A production-quality Progressive Web App for one gym, Iron Paradise, in India. It replaces paper fee slips and manual tracking.

It has four parts:

1. A public landing page for the gym.
2. Member management: memberships, plans, status.
3. Attendance tracking.
4. Payment tracking, including a spreadsheet-style view, due reminders, and AI scanning of paper fee slips.

Constraints that shape every decision:

- **Free to run.** Every service must work on its free tier. The only accepted paid item is the AI slip scanner (see section 9).
- **Shipping quality.** Readable, tested, deployable code. Readability beats cleverness.
- **Security first.** Section 8 is non-negotiable.
- **Mobile first.** Most users are on phones. Staff may use a tablet or laptop at the desk.

## 2. People and roles

Role and membership are separate concepts. Never merge them.

- **Role** controls what a person can do in the app.
- **Membership** is a record attached to a person: plan, start date, expiry, status. A trainer can also hold a membership. An expired member is still a member.

| Role    | Can do                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Owner   | Everything. Only role that can change roles, deactivate staff, and correct or void payments.                                     |
| Manager | Add and edit members, edit membership status, record payments, view the payment sheet, mark and view attendance, send reminders. |
| Trainer | View members and attendance, mark attendance. No payment access beyond seeing paid/due status.                                   |
| Member  | See own profile, membership, attendance history, payment history. Check in.                                                      |
| Guest   | Signed-up account not linked to a member record. Sees only the landing page and a "waiting for the gym to confirm you" screen.   |

## 3. Onboarding flow

The member record is the source of truth. It is created by staff and does not need an account to exist.

1. Staff adds a member: name, phone, plan, start date. Attendance and payments work for this record immediately.
2. The app generates a claim link and QR code for that member. Staff shares it on WhatsApp or the member scans it at the desk.
3. The member opens the link and signs in with Google. Their account is linked to the member record.
4. Anyone who signs up on their own becomes a Guest and appears in a "pending" list. Staff can link them to an existing member record or convert them to a new member in one tap.

Rules:

- Claim links are single-use and expire after 48 hours. Store only a hash of the token.
- Staff can regenerate a claim link at any time, which invalidates the old one.
- Members are never hard-deleted. "Remove" means deactivate, and all history is kept.

## 4. Features

### 4.1 Landing page

Public, fast, and indexable. Gym intro, facilities, plans and prices, timings, location, contact, and a sign-in button. Content should be easy for the owner to change later; keep it in one content file, not scattered through components.

### 4.2 Members

- List with search and filters (active, expired, frozen, due, overdue).
- Add, edit, deactivate, reactivate.
- Member detail page: profile, membership, attendance history, payment history, claim-link status.
- Membership status: active, expired, frozen. Expiry is computed from plan and payments, not typed by hand.

### 4.3 Attendance

- Member check-in by scanning a QR code at the front desk with the PWA.
- The desk QR rotates (short-lived code shown on a desk phone or tablet) so a photo of it cannot be reused from home. Provide a printed static QR as a fallback mode the owner can switch on.
- Staff can mark attendance manually for anyone.
- One check-in per member per day. Views: today's list, per-member history, simple monthly counts.

### 4.4 Payments

Payments are a ledger, not a "paid" flag.

- Each payment is one row: member, month(s) covered, amount, method (cash, UPI, other), date paid, recorded by, optional slip photo, optional note.
- Payments are never edited in place or deleted. A correction is a new entry that voids the old one, and only the owner can do it.
- Supports partial payments and advance payments for several months.

### 4.5 Payment sheet

- Grid: members down the side, months across the top, each cell paid / partial / due / overdue.
- Computed from the ledger, never stored separately.
- Sort, filter, search. Tap a cell to see or record the payment.
- Export to CSV and Excel.

### 4.6 Due reminders

- A daily scheduled job finds memberships due in 3 days, due today, and 3 days overdue.
- Version 1 channels, all free: PWA push notification, email, and staff-sent WhatsApp (a button that opens WhatsApp with the message pre-filled, plus a "remind all overdue" queue).
- Build one notification module with one file per channel, so automated WhatsApp (Meta Cloud API, direct, no reseller) can be added later without a rewrite. Do not build SMS.
- Log every message: member, channel, time, delivered or failed. Never send the same reminder twice.
- Reminders stop as soon as a payment is recorded.
- Members consent to reminders at registration. Staff can mute reminders per member.

### 4.7 AI fee-slip scanning

Staff photograph a paper fee slip, and the app proposes a payment entry. A human always confirms.

1. Staff takes or uploads a photo.
2. A vision model extracts: member name, member ID if present, amount, date, month covered, receipt number. Output must be structured and validated.
3. The app matches against members and shows the best match plus alternatives, with the extracted fields editable.
4. Staff confirms or corrects. Only then is the payment row written, with the slip photo attached.

- Batch mode: photograph several slips, then work through a review queue.
- Nothing is ever written to the ledger without confirmation.
- Flag duplicates (same receipt number, or same member, month and amount).
- Matching by member ID is preferred over matching by name. Show each member's ID clearly in the app so the gym can write it on slips.

### 4.8 Audit log

Append-only record of every membership, role, and payment change: who, what, before, after, when. Readable by the owner and managers. Nobody can edit or delete entries, including the owner.

## 5. Data model

A starting point. Refine names, but keep the separations.

- `profiles`: one per signed-in account. Holds role. Linked to an auth user.
- `members`: one per gym member, created by staff. Name, phone, member ID, active flag, optional link to a profile.
- `plans`: name, duration, price.
- `memberships`: member, plan, start, status, freeze dates.
- `payments`: the ledger described in 4.4.
- `attendance`: member, date, time, method (QR or manual), marked by.
- `claim_tokens`: member, token hash, expiry, used flag.
- `notifications`: the reminder log.
- `slip_scans`: photo reference, extracted data, status (pending, confirmed, rejected), resulting payment.
- `audit_log`: as in 4.8.

Roles live in `profiles`, in a column only the owner can write. Never read a role from user-editable metadata.

## 6. Tech stack

| Layer                        | Choice                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Framework                    | Next.js, App Router, TypeScript in strict mode                                                                                   |
| UI                           | Tailwind CSS, shadcn/ui, TanStack Table for the payment sheet                                                                    |
| Database, auth, file storage | Supabase (Postgres with row-level security, Supabase Auth with Google sign-in only, private storage bucket)                      |
| Data access and validation   | Drizzle ORM, Zod on every input                                                                                                  |
| PWA                          | Serwist                                                                                                                          |
| Rate limiting                | Upstash Redis over HTTP. Rate limiting only; do not add a cache layer.                                                           |
| Bot protection               | Cloudflare Turnstile on sign-up                                                                                                  |
| Hosting                      | Cloudflare Workers via the OpenNext adapter                                                                                      |
| Scheduled jobs               | Cloudflare Cron Triggers                                                                                                         |
| Email                        | Resend                                                                                                                           |
| Slip scanning                | Vision model API with structured output, called from the server only. Put it behind an interface so the provider can be swapped. |
| Quality                      | ESLint, Prettier, Vitest, Playwright, GitHub Actions, Sentry                                                                     |

Things to respect:

- Cloudflare's free plan caps the compressed Worker bundle at 3 MiB. Keep dependencies lean and check bundle size in CI.
- Check current docs for Next.js, Serwist, OpenNext, and Supabase before using them. Do not rely on remembered APIs.
- iOS installs a PWA only through Share, then Add to Home Screen, and push works only after install. Include a short in-app install guide.

## 7. Code conventions

- Feature-based folders: `members/`, `payments/`, `attendance/`, `notifications/`, `slips/`, `auth/`. Each owns its components, server actions, queries, validation schemas, and tests.
- All permission checks live in one module. Features call it; they do not re-implement role logic.
- No database calls from UI components. Components call server actions or query functions.
- Every server action: check session, check permission, validate input with Zod, then act.
- Money is stored as integer paise, never floats. Dates are stored in UTC and displayed in Asia/Kolkata.
- Small functions, descriptive names, no dead code, no commented-out code. Comments explain why, not what.
- Database changes only through migration files committed to the repo.
- No secrets in code or in git. Provide `.env.example` with every variable named and explained.
- Keep a short `README.md` covering setup, environment variables, running tests, and deploying.

## 8. Security requirements

All of these are required before anything is deployed.

1. Row-level security on every table, deny by default, enabled before any data is inserted. Members read only their own rows. Staff access is enforced in the database, not by hiding UI.
2. The Supabase service key and the AI API key never reach the browser.
3. Google sign-in only. No password storage.
4. Roles are writable only by the owner (section 5).
5. Every server action re-checks session and permission and validates input (section 7).
6. Claim tokens are hashed, single-use, and expire in 48 hours.
7. Slip photos live in a private bucket and are served through short-lived signed URLs.
8. Rate limits on sign-in, sign-up, claim-link use, and the slip-scan endpoint. Turnstile on sign-up.
9. The audit log is append-only at the database level.
10. Security headers: a strict Content Security Policy, HSTS, no framing.
11. Nightly encrypted database backup through a scheduled GitHub Action, stored in Cloudflare R2. Document and test the restore procedure.
12. Collect the minimum: name, phone, plan, payments, attendance. No ID numbers, home addresses, or health information.
13. Each staff member has their own account. The owner can deactivate staff in one action, which ends their sessions.

Tests that must exist and must run in CI:

- A member cannot read another member's profile, payments, or attendance.
- A trainer cannot create, void, or edit a payment.
- A manager cannot change roles or void a payment.
- A member or guest cannot change their own role.
- A used or expired claim link is rejected.
- An unauthenticated request to any non-public route is rejected.

Also in CI: lint, type check, unit tests, dependency audit, bundle size check. Enable Dependabot and GitHub secret scanning with push protection.

## 9. Cost notes

- Everything in section 6 runs on a free tier for a single gym.
- Supabase's free plan has no automatic backups and pauses projects with no activity for a week. Daily gym use prevents the pause; requirement 8.11 covers backups.
- The slip scanner should use a paid API tier before going live with real slips, because free AI tiers may use submitted data for training and slips carry member names. Expected cost is small. Use the free tier for development with fake slips only.
- Automated WhatsApp reminders are a later, paid add-on at a few paise per message.

## 10. Build order

Finish and test each phase before starting the next.

1. **Foundation.** Project setup, CI, database schema and RLS, Google sign-in, roles, permission module, security tests, landing page, PWA shell, deploy to Cloudflare.
2. **Members.** Member CRUD, plans, memberships, claim links, pending-guest list, audit log.
3. **Payments.** Ledger, payment sheet, export, manual payment entry.
4. **Attendance.** Rotating desk QR, member check-in, manual marking, history views.
5. **Reminders.** Daily job, push, email, staff-sent WhatsApp queue, notification log.
6. **Slip scanning.** Capture, extraction, matching, review queue, duplicate detection.

## 11. Open questions for the owner

Ask before the phase that depends on each.

- How many members, and how many staff? (Phase 1)
- Which plans and prices exist, and are there joining fees or discounts? (Phase 2)
- Is the fee due on a fixed day each month or on each member's joining date? (Phase 3)
- Is there a phone or tablet that can stay at the front desk for the rotating QR? (Phase 4)
- What do the current paper slips contain, and can a member ID be added to them? Get sample photos. (Phase 6)
- Gym logo, colours, photos, and text for the landing page. (Phase 1)
