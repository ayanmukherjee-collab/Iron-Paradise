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

## Steps

Each step lands on the `rebuild/static-app` branch. The live app keeps running
from `main` until the cutover, so members never see a half-done app.

1. **Foundation + Check-in (proof).** Vite app in `web/`, Supabase browser
   client, viewer/permission gate, sign-in and callback, shims, and the
   Check-in screen working end to end against the real database.
2. **Member screens.** Member Home (ID card, visits, bulletin), Account,
   claim link (`/claim/:token` → `redeem_claim_token`).
3. **Staff reads.** Members list, member page, payments sheet, attendance,
   audit, team. Lists fetch only what is on screen; heavy totals that are slow
   on a phone move into SQL views or functions.
4. **Staff saves.** Every Server Action becomes an RPC or a single insert or
   update. Multi-step actions (new member + membership + fee, record payment,
   void and replace) become one SQL function each, so they stay all-or-nothing.
   New migrations come with PGlite RLS tests like the existing ones.
5. **Desk display and settings.** `/desk/:token` reads the rotating code through
   a function granted to `anon`; QR PDF built on the phone.
6. **Secrets-only work.** Web Push sending and the reminder job move to Supabase
   Edge Functions, scheduled by `pg_cron`.
7. **Landing page + PWA.** Prerendered landing, manifest, service worker
   (offline shell; no request buffer needed, there is no Worker to retry).
8. **Cutover.** `wrangler.jsonc` becomes an assets-only Worker pointing at
   `web/dist` (no `main`, single-page-application fallback). Remove Next.js,
   OpenNext, drizzle's runtime use, Hyperdrive and the data Worker. Watch
   Cloudflare metrics: Worker invocations should drop to zero.

## Things to check along the way

- **Column visibility.** RLS works per row. Where a screen hid a column from
  some roles (for example phone numbers from trainers), check the column grant
  does the same; otherwise add a view or narrow the grant.
- **Data API exposure.** Supabase exposes the `public` schema by default. All
  `private.*` functions stay hidden.
- **Redirect URLs.** Supabase Auth must allow `/auth/callback` on the live
  domain (it already does) and on `http://localhost:5173` for local runs.
- **Supabase free limits.** 500 MB database, 5 GB egress a month, project
  pauses after 7 days without use. A gym of 150–500 members stays well inside.
  Keep queries narrow (select named columns, page long lists).

## Running the new app locally

```bash
npm run web:dev
```

It reads the same `NEXT_PUBLIC_*` values from `.env.local` and talks to the
same Supabase project as production.
