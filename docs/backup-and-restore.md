# Backups and restore

Supabase's free plan keeps no backups. The `Nightly database backup` GitHub
Action (`.github/workflows/backup.yml`) dumps the whole database at 03:00 IST,
encrypts it with a passphrase, and uploads it to a private Cloudflare R2
bucket. Until the secrets below are set, the job runs but skips itself with a
warning.

## One-time setup

1. **R2 bucket.** Cloudflare dashboard → R2 → Create bucket, e.g.
   `iron-paradise-backups`. Under the bucket's Settings → Object lifecycle
   rules, add a rule deleting objects under `nightly/` after 30 days.
2. **R2 API token.** R2 → Manage API tokens → Create token with
   _Object Read & Write_ on that bucket only. Note the Access Key ID, Secret
   Access Key and your Account ID.
3. **Passphrase.** Generate a long random passphrase and store it in the
   owner's password manager. **Without it the backups cannot be opened.**
4. **Database URL.** Supabase → Connect → _Session pooler_ connection string
   (port 5432), with the database password filled in.
5. **GitHub secrets.** Repository → Settings → Secrets and variables →
   Actions → New repository secret, one each:

   | Secret                 | Value                      |
   | ---------------------- | -------------------------- |
   | `SUPABASE_DB_URL`      | Session pooler string      |
   | `BACKUP_PASSPHRASE`    | The passphrase from step 3 |
   | `R2_ACCOUNT_ID`        | Cloudflare account ID      |
   | `R2_BUCKET`            | Bucket name                |
   | `R2_ACCESS_KEY_ID`     | From step 2                |
   | `R2_SECRET_ACCESS_KEY` | From step 2                |

6. Run the workflow once by hand (Actions → Nightly database backup → Run
   workflow) and check a file appears in the bucket.

## Restoring

Restore into a **new, empty** Supabase project first, never over the live one.
The free plan allows two projects, so the second slot doubles as the restore
test target.

Needs: the Supabase CLI (`npx supabase`), `psql` 17, `gpg`, and the
passphrase.

```bash
# 1. Download the backup you want from the R2 bucket (dashboard → Objects).

# 2. Decrypt and unpack.
gpg --decrypt iron-paradise-2026-11-16T2130Z.tar.gz.gpg | tar -xzf - -C restore/

# 3. Load it into the new project (Session pooler string of the NEW project).
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file restore/roles.sql \
  --file restore/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file restore/data.sql \
  --dbname "postgresql://postgres.NEWREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
```

`session_replication_role = replica` pauses triggers while rows are copied in,
so the audit log is not filled with fake "insert" entries for restored data.

4. In the new project, set up Google sign-in and redirect URLs as in the
   README, point a preview deploy (or `.env.local`) at it, and check below.
5. To switch production over, update `DATABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
   the Worker and redeploy.

## Restore test checklist

Run this after first setup and then every three months. Write the date and
result at the bottom of this file.

- [ ] The newest backup decrypts with the stored passphrase.
- [ ] `psql` restore finishes with no errors.
- [ ] Owner can sign in and sees the team page.
- [ ] Member count, payment count and last attendance date match production.
- [ ] `select count(*) from public.audit_log` matches production.

| Date | Backup file | Result | Checked by |
| ---- | ----------- | ------ | ---------- |
|      |             |        |            |
