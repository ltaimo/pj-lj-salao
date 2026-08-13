# Local Runbook

This project follows the same local pattern as the other apps in this workspace:

- Start from `Start PJLJ Salon Manager.bat`.
- Keep PowerShell open so errors remain visible.
- Install dependencies automatically when `node_modules` is missing.
- Open the browser automatically.
- Stop services when Enter is pressed.

## Database

The API needs PostgreSQL. No Docker is required by the launcher, but `.env` must contain a working `DATABASE_URL`.
For Supabase, also set `DIRECT_URL`.

For local or hosted PostgreSQL:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
```

Then run the launcher again. It will execute:

```bash
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run build
```

When the API is running, verify the foundation:

```bash
npm.cmd run foundation:verify
```
