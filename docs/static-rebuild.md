# Static rebuild: running the app without a server

## Why

On 2026-11-17 a real-traffic test with fewer than 10 people failed. Cloudflare's
metrics for the live Worker (version dff18243) showed:

- 180 errors in 24 hours, every one "Exceeded CPU Time Limits";
- 30.8% of requests to the live version failed;
- CPU per request: median 94 ms, P90 258 ms, P99 393 ms. One Check-in page
  open used 362 ms, a save on Home 93 ms.

The Workers Free plan allows 10 ms of CPU per request. Server-rendering Next.js
on a Worker costs 10–35 times that, so no tuning gets under it. The owner
doesn't want Workers Paid, so the app stops rendering on the server.

## Target architecture

```
Phone (React app, built once into plain files)
  ├── HTML/JS/CSS ← Cloudflare static assets (free, unlimited, no Worker run)
  ├── Sign-in      → Supabase Auth (Google, PKCE), session kept on the device
  ├── Reads        → Supabase Data API, row-level security decides what each
  │                  person sees (the same policies the server relies on today)
  └── Saves        → Postgres functions (supabase.rpc) or plain inserts/updates
                     under RLS; multi-step saves become one function so they
                     stay atomic
Supabase Edge Functions (free: 500k calls/month, 2 s CPU)
  └── Only what needs a secret: Web Push sending (VAPID key), reminder job,
      WhatsApp/email if added
```

Nothing runs on the Cloudflare Worker for normal use. That removes the 10 ms
limit from the picture entirely.

### Why this is safe

The database was already built for it. Every table has row-level security,
and grants to `authenticated` are column by column. The server today runs
each query as the signed-in user (`withUserContext` switches to the
`authenticated` role with the same JWT claims Supabase's Data API sets), so a
query the server could make, the phone can make, and gets the same answer. The
server's own checks (`guardedAction`, `requirePermission`) become screen-level
convenience. The database stays the real gate, as it is now.

### What carries over unchanged

Everything pure: billing and ledger rules (`src/members/billing.ts`,
`src/payments/ledger.ts`, `src/payments/sheet.ts`), dates, money, permissions,
check-in codes, hours, visit stats, the QR scanner, exports (CSV/PDF), the UI
components and `globals.css`. The new app imports them from `src/` as they are.

### What changes

| Today (server)                                         | After (phone + database)                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Next.js pages rendered per request                     | React Router screens in `web/`, built by Vite into `web/dist`                            |
| `next/link`, `next/navigation`                         | Small shims in `web/src/shims/` so shared components work as they are                    |
| `router.refresh()` after a save                        | A refresh signal that makes the open screen fetch again                                  |
| drizzle queries in `*/queries.ts`                      | supabase-js queries in `web/src/data/`, same tables, same pure code after                |
| Server Actions in `*/actions.ts`                       | `supabase.rpc(...)` or inserts/updates; multi-step ones become SQL functions             |
| Session cookie + proxy redirect                        | Session on the device; screens wait for the viewer and send signed-out people to sign in |
| CSP with a per-request nonce                           | Fixed strict CSP in `_headers`: Vite emits no inline scripts, so `script-src 'self'`     |
| Turnstile + Upstash on sign-in                         | Dropped: Google sign-in can't be scripted, and Supabase Auth rate-limits it              |
| Upstash rate limit on check-in                         | `check_in` already ignores repeats the same day; add a SQL throttle if abused            |
| Bulletin JSON in KV via a second Worker                | Read straight from Supabase (one small query per Home open)                              |
| Cron Trigger on the Worker for reminders               | Supabase Edge Function on a `pg_cron` schedule                                           |
| Landing page rendered per request                      | Rendered to HTML at build time (no data in it), so search engines still see it           |
| `/app/members/[id]`, `/claim/[token]`, `/desk/[token]` | Same paths, served by the single-page fallback                                           |

## Status

All eight steps are built on the `rebuild/static-app` branch (draft PR #35):

1. **Foundation + Check in.** Vite app in `web/`, Supabase browser client,
   sign-in and callback, the signed-in gate, shims for the shared components.
2. **Member screens.** Member Home (card, visits, bulletin, payments), claim
   link.
3. **Staff reads.** Home, members list, member page, payments sheet,
   attendance, audit, team, guests, reminders, settings, all in
   `web/src/data`. Sums and groups the Data API can't do are SQL functions.
4. **Staff saves.** Every Server Action has a browser version in
   `web/src/actions` with the same name and inputs. Multi-step saves are one
   SQL function each (`20261126000100_static_app.sql`, tested in
   `src/db/static-app-rls.test.ts`).
5. **Desk display, downloads.** `/desk/:token` reads `desk_code`; the payment
   exports and the printed QR PDF are made on the phone.
6. **Edge Functions.** `reminders` and `send-test-push`.
7. **Public site and PWA.** Landing, privacy and terms are written into the
   HTML at build time; new service worker (offline shell, push).
8. **Cutover.** `wrangler.jsonc` is assets-only. Next.js, OpenNext,
   Hyperdrive, Upstash, Turnstile and the data Worker are gone.

Checked: type check, lint, the full test suite (571 tests, including the
database security tests), the production build, a Cloudflare deploy dry run,
and every table query in `web/src`, run signed out against the real project:
each one gets "permission denied", none a missing column or relationship.
Not checked yet: a signed-in run against real data. That needs the
migration below applied and a real Google sign-in.

## Going live

In this order. Steps 1–3 need your accounts; nothing here has been run yet.

1. **Apply the migration** (adds the new database functions; changes no
   existing table or rule):
   ```bash
   npx supabase db push --dry-run
   npx supabase db push
   ```
2. **Edge Functions.** Set their secrets, then deploy:
   ```bash
   npx supabase secrets set CRON_SECRET=<32+ random characters> \
     VAPID_PUBLIC_KEY=<…> VAPID_PRIVATE_KEY=<…> \
     SITE_URL=https://iron-paradise.ayanmukherjee-official01.workers.dev
   # optional: RESEND_API_KEY=<…> EMAIL_FROM="Iron Paradise <fees@…>"
   npm run fn:build
   npx supabase functions deploy reminders send-test-push
   ```
   Use the same VAPID pair the Worker had, or phones that already allowed
   notifications stop getting them.
3. **Schedule the reminders.** Supabase → Database → Extensions: switch on
   `pg_cron` and `pg_net`. Then in the SQL Editor (with your real secret):
   ```sql
   select vault.create_secret('<the CRON_SECRET>', 'reminders_cron_secret');
   select cron.schedule(
     'fee-reminders',
     '*/15 3-5 * * *',  -- 08:30–11:15 India time, as before
     $$
     select net.http_post(
       url := 'https://lttffxniaxxbstiaxvvz.supabase.co/functions/v1/reminders',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || (
           select decrypted_secret from vault.decrypted_secrets
           where name = 'reminders_cron_secret'
         )
       )
     );
     $$
   );
   ```
4. **Cloudflare build variables.** Workers & Pages → iron-paradise →
   Settings → Build → Variables: keep `NEXT_PUBLIC_SITE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and add
   `VAPID_PUBLIC_KEY`. Build and deploy commands stay `npm run cf:build` and
   `npx wrangler deploy`.
5. **Merge PR #35.** Workers Builds deploys it. The old Worker's secrets,
   the Hyperdrive config and the `iron-paradise-data` Worker and KV
   namespace are then unused and can be deleted.
6. **Watch.** Cloudflare metrics for iron-paradise should show static asset
   requests and no Worker CPU errors; Supabase → Reports shows the API load.

To test before merging, run the app locally against the real project (the
migration must be applied first, and `http://localhost:5173/auth/callback`
must be on Supabase Auth's redirect list):

```bash
npm run dev
```

## Security notes

- **Nothing new is exposed.** Every table already had RLS and column grants,
  and the server ran each query as the signed-in user, so the phone can read
  and change exactly what the server's queries could. What changes is that a
  determined person could query the Data API directly, within those same
  rules (for example a trainer can read members' phone numbers, which the
  members list already showed them).
- **Not exposed:** `private.*` functions, `claim_tokens.token_hash`, push
  keys (`push_subscriptions` is read only by the Edge Functions), payments
  and fees for trainers and members other than their own.
- **Signed-out access:** one function, `desk_code`, which needs a desk
  link's 32-byte random token.
- **Dropped:** Turnstile and the Upstash rate limits. Google sign-in can't be
  scripted and Supabase Auth limits sign-in attempts; a repeated check-in the
  same day changes nothing; the test push is limited to one a minute.
- **Supabase free limits.** 500 MB database, 5 GB egress a month, and the
  project pauses after 7 days without use. A gym of 150–500 members in daily
  use stays well inside.
