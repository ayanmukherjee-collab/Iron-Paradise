# The yearly close

The busy tables (visits, payments, the reminder log, the audit log) would
grow forever. Once a year the oldest year is summed up and deleted, so they
never hold more than two years and every screen stays quick.

## What happens

At 06:00 India time on 1 April (with spare runs on 2–7 April), pg_cron calls
the `year-close` Edge Function. It works out the cut-off, the start of the
previous financial year (run on 1 April 2028, the cut-off is 1 April 2027),
so **12 to 24 months of full detail always remain**. Then it:

1. Plans each membership's **carried-forward** entry: one payment that stands
   in for all its payments before the cut-off. It builds the ledger with the
   app's own code both ways and only merges when every month's paid amount,
   the balance and the standing come out identical. Otherwise it keeps one
   entry per first period, which is always exact
   (`src/payments/year-close.ts`).
2. Saves the old payments and check-ins as CSV in the private Storage bucket
   `archives`, folder `before-<cut-off>`. If that fails, nothing is deleted.
3. Calls `private.close_year`, which in one transaction checks the carried
   money equals the counted money it replaces, adds everything before the
   cut-off to the totals tables, writes the carried-forward entries (dated on
   the first payment, so due days don't move), deletes the old rows and
   records the close in `year_closes`.

What stays for good:

| Table                    | What                                              | Who can read      |
| ------------------------ | ------------------------------------------------- | ----------------- |
| `monthly_visit_totals`   | check-ins, members visiting, members joining      | staff             |
| `monthly_payment_totals` | money collected and number of payments, by method | owner and manager |
| `member_visit_totals`    | each member's earlier visits and last visit       | staff             |
| `member_payment_totals`  | each member's earlier payments and amount         | owner and manager |
| `year_closes`            | each close: cut-off, when, how many rows went     | owner and manager |

Settings → History shows the yearly totals; a member's page shows their
earlier visits and payments in one line each.

Carried-forward entries have `payments.carried_forward = true`. They count
towards the ledger but not towards money collected (`collected`,
`latest_payments` skip them).

## Records you may be required to keep

Indian rules generally expect business accounts to be kept for several
years. The CSV files in `archives` are the full payment records for each
closed year: download them from Supabase → Storage → archives and keep them
somewhere safe if you need them.

## Running it by hand

It runs itself. To run it now (it only removes data older than the cut-off,
and does nothing if that cut-off is already closed), in the SQL Editor:

```sql
select net.http_post(
  url := 'https://lttffxniaxxbstiaxvvz.supabase.co/functions/v1/year-close',
  headers := jsonb_build_object('Authorization', 'Bearer ' || (
    select decrypted_secret from vault.decrypted_secrets
    where name = 'reminders_cron_secret'))
);
```

Deploy after changing the code: `npm run fn:build`, then
`npx supabase functions deploy year-close --no-verify-jwt`.
