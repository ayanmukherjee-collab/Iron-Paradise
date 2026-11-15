# Iron Paradise

Web app for Iron Paradise Gym: public landing page, member management, attendance and payment tracking. The full product brief is in [iron-paradise.md](iron-paradise.md).

**Built so far:**

- **Phase 1, Foundation:** landing page, Google sign-in with a bot check and rate limits, roles and the owner's team page, database schema with row-level security and an append-only audit log, installable PWA shell, Cloudflare deploy config, CI.
- **Phase 2, Members:** member records with negotiated fees, freezes, claim links and QR codes, the waiting-guest list, deactivate and reactivate, "gone quiet" suggestions.
- **Phase 3, Payments:** the payment ledger with partial and advance payments, owner-only void and correction, the month-by-month payment sheet, CSV and Excel export, due and overdue filters.

## Setup

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env.local   # then fill it in, see below
npm run dev
```

Open http://localhost:3000. The landing page works with placeholder values; signing in needs a real Supabase project.

### Supabase project (one time)

1. Create a free project at [supabase.com](https://supabase.com). Region: Mumbai (`ap-south-1`).
2. **Keys.** Project Settings → API Keys: copy the _publishable_ key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the project URL into `NEXT_PUBLIC_SUPABASE_URL`. Never copy the secret / `service_role` key into this app.
3. **Database URL.** Connect → _Transaction pooler_ string (port 6543) into `DATABASE_URL`.
4. **Schema.** Apply the migrations in `supabase/migrations`:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push
   ```
5. **Google sign-in.** In Google Cloud Console create an OAuth client (Web application). Add Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as an authorised redirect URI. Paste the client ID and secret into Supabase → Authentication → Sign In / Providers → Google, and turn **Email** off there.
6. **Redirect URLs.** Supabase → Authentication → URL Configuration: Site URL = your site, and add `http://localhost:3000/auth/callback` plus `https://<your-domain>/auth/callback` to Redirect URLs.
7. **First owner.** Sign in once with the owner's Google account, then in Supabase → SQL Editor run:
   ```sql
   select public.bootstrap_owner('owner@example.com');
   ```
   It only works while there is no owner. After that, roles are changed on the in-app Team page.

## Environment variables

Every variable is listed and explained in [.env.example](.env.example).

| Variable                                              | Where it is used                            | Secret? |
| ----------------------------------------------------- | ------------------------------------------- | ------- |
| `NEXT_PUBLIC_SITE_URL`                                | Google sign-in return URL                   | No      |
| `NEXT_PUBLIC_SUPABASE_URL`                            | Supabase Auth                               | No      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                | Supabase Auth (RLS protects data)           | No      |
| `DATABASE_URL`                                        | Server-side queries, always run as the user | **Yes** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                      | Bot check widget on sign-in                 | No      |
| `TURNSTILE_SECRET_KEY`                                | Verifying the bot check                     | **Yes** |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limits (required in production)        | **Yes** |

## Scripts

| Command              | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `npm run dev`        | Dev server                                                           |
| `npm run build`      | Builds the service worker, then the production app                   |
| `npm run lint`       | ESLint                                                               |
| `npm run typecheck`  | TypeScript                                                           |
| `npm test`           | Unit tests and the database security tests (Vitest)                  |
| `npm run test:e2e`   | Browser tests against a production build (run `npm run build` first) |
| `npm run cf:preview` | Build for Cloudflare and run it locally in the Workers runtime       |
| `npm run cf:size`    | Check the Worker stays under the free plan's 3 MiB limit             |
| `npm run db:push`    | Apply new migrations to the linked Supabase project                  |
| `npm run art`        | Rebuild landing page art from `assets/art`                           |
| `npm run icons`      | Rebuild app icons from `public/brand/logo.svg`                       |

## Tests

```bash
npm test
```

The security tests in `src/db/rls.test.ts` load every migration into an in-memory Postgres ([PGlite](https://pglite.dev)) with a stand-in for Supabase's `auth` schema, then check each rule from section 8 of the brief through the same code path the app uses. No Docker or Supabase account is needed, and they run in CI on every push.

## How access control works

- `src/auth/permissions.ts` is the only place that says what each role may do.
- Every Server Action is built with `guardedAction` (`src/auth/guarded-action.ts`): session, permission, Zod validation, then the work. A test fails if a `"use server"` file exports anything else.
- The database enforces the same rules with RLS. The server connects as a privileged role but runs every user query through `withUserContext` (`src/db/user-context.ts`), which switches to the signed-in user so their policies apply.
- `src/proxy.ts` sends signed-out visitors away from every route not listed in `src/auth/routes.ts`, and sets a per-request nonce Content Security Policy.

## How money is worked out

Nothing about what a member owes is stored; it is computed from the ledger each time (`src/payments/ledger.ts`, pure and unit tested).

- A membership has numbered periods. Period 0 falls due on the joining day, period _n_ on the joining date _n_ months later (the last day of shorter months), pushed back by any freezes.
- Each period owes the agreed fee in force on its due date (`membership_fees`), so a fee change never rewrites months already due.
- A payment names the period it starts from. It fills that period up to its fee, then flows on to the next, so a short payment is partial and a large one is an advance.
- Payments are never edited or deleted. The owner voids a wrong entry (`payment_voids`) and, for a correction, records the right one in the same transaction.

## Landing page content

All landing page text, plans, timings and contact details live in `src/content/landing.ts`. Edit that one file to change what the public page says.

## Deploying (Cloudflare Workers)

1. `npx wrangler login`
2. Set the server secrets once:
   ```bash
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put UPSTASH_REDIS_REST_URL
   npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
   ```
3. Put the `NEXT_PUBLIC_` values (production URLs, real Turnstile site key) in `.env.production.local`. They are baked in at build time.
4. `npm run cf:deploy`

### Deploying from GitHub (Workers Builds)

If Cloudflare builds the repo for you (Workers & Pages → the Worker → Settings → Build), set:

| Setting        | Value                 |
| -------------- | --------------------- |
| Build command  | `npm run cf:build`    |
| Deploy command | `npx wrangler deploy` |

Do not use `npm run build` as the build command. It only runs `next build`, so the deploy step fails with "Could not find compiled Open Next config". Add the `NEXT_PUBLIC_` values under **Build variables and secrets** (they are read at build time), and the server secrets under the Worker's **Variables and Secrets**.

Before the first real deploy, also set up nightly backups: [docs/backup-and-restore.md](docs/backup-and-restore.md).

## GitHub settings to switch on

These are repository settings, not files: Settings → Code security → enable **Dependabot alerts**, **Secret scanning** and **Push protection**. Dependabot version updates are configured in `.github/dependabot.yml`.
