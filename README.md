# Iron Paradise

Web app for Iron Paradise Gym: public landing page, member management, attendance and payment tracking. The full product brief is in [iron-paradise.md](iron-paradise.md).

**Built so far:**

- **Phase 1, Foundation:** landing page, Google sign-in with a bot check and rate limits, roles and the owner's team page, database schema with row-level security and an append-only audit log, installable PWA shell, Cloudflare deploy config, CI.
- **Phase 2, Members:** member records with negotiated fees, freezes, claim links and QR codes, the waiting-guest list, deactivate and reactivate, "gone quiet" suggestions.
- **Phase 3, Payments:** the payment ledger with partial and advance payments, owner-only void and correction, the month-by-month payment sheet, CSV and Excel export, due and overdue filters.
- **Phase 4, Attendance:** desk QR check-in (rotating and printed), desk display links, manual marking, today's list, history and monthly counts.
- **Phase 5, Reminders:** a morning job that sends push and email reminders 3 days before, on, and 3 days after each due date; the staff WhatsApp queue with "remind all overdue"; the notification log.
- **Static rebuild (2026-11-17):** the app no longer renders on a server. It is a React app built into plain files that Cloudflare serves for free, talking to Supabase directly, because server rendering used 10–35 times the Workers Free plan's CPU allowance and failed under real traffic. Why and how: [docs/static-rebuild.md](docs/static-rebuild.md).

## How the app is put together

- `web/` is the app: Vite + React Router. `web/src/pages` are the screens, `web/src/data` reads from Supabase, `web/src/actions` saves to it.
- `src/` is shared code: components, styles, and the pure rules for billing, ledgers, dates, permissions and reminders, all unit tested.
- Saves that need several steps at once are Postgres functions (`supabase/migrations`), so they happen completely or not at all.
- The reminder job and test notifications are Supabase Edge Functions (`supabase/functions-src`, bundled into `supabase/functions` by `npm run fn:build`), because they need secret keys.

## Setup

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env.local   # then fill it in, see below
npm run dev
```

Open http://localhost:5173. The public pages work with placeholder values; signing in needs a real Supabase project.

### Supabase project (one time)

1. Create a free project at [supabase.com](https://supabase.com). Region: Mumbai (`ap-south-1`).
2. **Keys.** Project Settings → API Keys: copy the _publishable_ key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the project URL into `NEXT_PUBLIC_SUPABASE_URL`. Never copy the secret / `service_role` key into this app.
3. **Database URL.** Connect → _Session pooler_ string (port 5432) into `DATABASE_URL`. Only `npm run db:push` uses it.
4. **Schema.** Apply the migrations in `supabase/migrations`:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push
   ```
5. **Google sign-in.** In Google Cloud Console create an OAuth client (Web application). Add Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as an authorised redirect URI. Paste the client ID and secret into Supabase → Authentication → Sign In / Providers → Google, and turn **Email** off there.
6. **Redirect URLs.** Supabase → Authentication → URL Configuration: Site URL = your site, and add `http://localhost:5173/auth/callback` plus `https://<your-domain>/auth/callback` to Redirect URLs.
7. **First owner.** Sign in once with the owner's Google account, then in Supabase → SQL Editor run:
   ```sql
   select public.bootstrap_owner('owner@example.com');
   ```
   It only works while there is no owner. After that, roles are changed on the in-app Team page.

## Environment variables

Every variable is listed and explained in [.env.example](.env.example). All of them are public (built into the app) except `DATABASE_URL`, which only migrations use.

| Variable                               | Where it is used                       | Secret? |
| -------------------------------------- | -------------------------------------- | ------- |
| `NEXT_PUBLIC_SITE_URL`                 | Claim and desk links                   | No      |
| `NEXT_PUBLIC_SUPABASE_URL`             | The app's database and sign-in         | No      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same; RLS protects the data            | No      |
| `VAPID_PUBLIC_KEY`                     | Push notifications (browsers need it)  | No      |
| `NEXT_PUBLIC_EMAIL_REMINDERS`          | Shows "Email on" on the Reminders page | No      |
| `DATABASE_URL`                         | `npm run db:push` only                 | **Yes** |

The reminder job's secrets (`CRON_SECRET`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY`, and so on) are Supabase Edge Function secrets, never in this app: see [How reminders work](#how-reminders-work).

## Scripts

| Command               | What it does                                                   |
| --------------------- | -------------------------------------------------------------- |
| `npm run dev`         | Dev server at http://localhost:5173                            |
| `npm run build`       | Builds the site into `web/dist` (same as `npm run cf:build`)   |
| `npm run web:preview` | Serves the built site at http://localhost:4173                 |
| `npm run cf:preview`  | Builds, then serves it locally the way Cloudflare will         |
| `npm run fn:build`    | Bundles the Edge Functions into `supabase/functions`           |
| `npm run lint`        | ESLint                                                         |
| `npm run typecheck`   | TypeScript                                                     |
| `npm test`            | Unit tests and the database security tests (Vitest)            |
| `npm run db:push`     | Apply new migrations to the linked Supabase project            |
| `npm run art`         | Rebuild landing page art from `assets/art`                     |
| `npm run map`         | Redraw the landing page map from OpenStreetMap (needs network) |
| `npm run icons`       | Rebuild app icons from `public/brand/logo.svg`                 |
| `npm run vapid`       | Print a new key pair for push notifications                    |

## Tests

```bash
npm test
```

The security tests in `src/db/rls.test.ts` load every migration into an in-memory Postgres ([PGlite](https://pglite.dev)) with a stand-in for Supabase's `auth` schema, then check each rule from section 8 of the brief through the same code path the app uses. No Docker or Supabase account is needed, and they run in CI on every push.

## How access control works

- **The database is the gate.** Phones talk to Supabase directly, so every table has row-level security and column-level grants, and multi-step saves are `SECURITY INVOKER` functions that run as the caller under the same rules. The security tests (`src/db/*-rls.test.ts`) check them against the real migrations.
- `src/auth/permissions.ts` is the only place that says what each role may do. Screens use it to decide what to show (`RequirePermission` in `web/src/routes.tsx`), and every save checks it before calling the database (`guardedAction` in `web/src/data/guarded.ts`), with the same Zod schemas as before. These checks are a courtesy to the person; the database refuses anything they aren't allowed regardless.
- Signed-out people can call exactly one database function: `desk_code`, which shows the rotating desk QR to a device holding a secret desk link.
- The site sends a strict Content Security Policy (`web/vite.config.mts` writes it to `_headers`): scripts only from the site itself, data only from Supabase.

## How money is worked out

Nothing about what a member owes is stored; it is computed from the ledger each time (`src/payments/ledger.ts`, pure and unit tested).

- A membership has numbered periods. Period 0 falls due on the day of the first payment (the joining day until the member first pays), period _n_ on that date _n_ months later (the last day of shorter months), pushed back by any freezes. The database keeps that day in `memberships.billing_starts_on`, set by triggers on payments and voids.
- Each period owes the agreed fee in force on its due date (`membership_fees`), so a fee change never rewrites months already due.
- A payment names the period it starts from. It fills that period up to its fee, then flows on to the next, so a short payment is partial and a large one is an advance.
- Payments are never edited or deleted. The owner voids a wrong entry (`payment_voids`) and, for a correction, records the right one in the same transaction.

## How reminders work

`src/notifications/` holds the rules (`schedule.ts`), the wording (`message.ts`) and one file per channel in `channels/`.

- The job (`src/notifications/job.ts`) runs in the **reminders** Supabase Edge Function (`supabase/functions-src/reminders.ts`), called every 15 minutes from 08:30 to 11:15 India time by `pg_cron`. It checks `CRON_SECRET`.
- It reminds members 3 days before a fee is due, on the day, and 3 days after (with a few days' grace if a run was missed). It skips free, frozen, inactive and muted members, and anyone who did not agree to reminders.
- Before sending, it claims a row in `notifications`, whose unique key (fee, stage, channel) means nothing is ever sent twice, so overlapping runs are harmless.
- Push is encrypted and signed with the Web Crypto API (`web-push.ts`, tested against RFC 8291's worked example). Email goes through Resend. Staff send WhatsApp from the Reminders page; the app opens WhatsApp with the message typed in and logs it.
- **Send a test** on the push toggle calls the **send-test-push** Edge Function, which checks the caller with Supabase Auth.

Setting it up (once): see "Going live" in [docs/static-rebuild.md](docs/static-rebuild.md#going-live).

## Landing page content

All landing page text, plans, timings and contact details live in `src/content/landing.ts`. Edit that one file to change what the public page says.

The page is built to be read in pictures first (icons, big numbers, one orange Sign in button), so keep labels to a word or two. The map preview is drawn from OpenStreetMap road data around `contact.location`; after moving the pin, run `npm run map` and commit `src/landing/map-roads.ts`.

## Deploying (Cloudflare)

Cloudflare serves `web/dist` as static files (`wrangler.jsonc` has no Worker script). Static file requests are free and unlimited on Workers Free and run no code, so there is no CPU limit to hit.

Workers Builds deploys every push to `main` (Workers & Pages → the Worker → Settings → Build):

| Setting        | Value                 |
| -------------- | --------------------- |
| Build command  | `npm run cf:build`    |
| Deploy command | `npx wrangler deploy` |

Put the `NEXT_PUBLIC_` values and `VAPID_PUBLIC_KEY` under **Build variables and secrets**; they are baked into the files at build time. The Worker needs no runtime secrets any more.

To deploy by hand: `npm run cf:build && npx wrangler deploy`.

Before the first real deploy, also set up nightly backups: [docs/backup-and-restore.md](docs/backup-and-restore.md).

## GitHub settings to switch on

These are repository settings, not files: Settings → Code security → enable **Dependabot alerts**, **Secret scanning** and **Push protection**. Dependabot version updates are configured in `.github/dependabot.yml`.
