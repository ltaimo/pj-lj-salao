# Supabase Setup

PJ&LJ uses Supabase as PostgreSQL, not as the business-logic layer. The backend remains the source of truth for auth, RBAC, audit, POS, stock and payments.

## Required Values

In Supabase, open:

```text
Project Settings -> Database -> Connection string
```

Use the pooled connection for runtime:

```text
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&schema=public
```

Use the direct connection for Prisma migrations:

```text
DIRECT_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?schema=public
```

Both values are needed because Supabase poolers are good for app runtime, while migrations need a direct database connection.

## First Database Setup

After `.env` has `DATABASE_URL` and `DIRECT_URL`:

```bash
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:seed
npm.cmd run foundation:verify
```

For local development where you intentionally want Prisma to create the schema without migration history:

```bash
npm.cmd run db:push
npm.cmd run db:seed
```

Prefer `db:deploy` for staging/production.

## Helper

If you have the Supabase project ref and database password:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-supabase-env.ps1 -ProjectRef PROJECT_REF -DatabasePassword "PASSWORD"
```

If your Supabase database is not in `aws-0-us-east-1`, pass the pooler host shown by Supabase:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\configure-supabase-env.ps1 -ProjectRef PROJECT_REF -DatabasePassword "PASSWORD" -RegionHost "aws-0-eu-west-1.pooler.supabase.com"
```

## Vercel Environment Variables

Set these in Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `WEB_ORIGIN`

After deploy, verify:

```bash
npm.cmd run foundation:verify
```
