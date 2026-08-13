# PJ&LJ Salon Manager

Sistema integrado para PJ&LJ Salao Unissex. A fundacao segue arquitetura API-first com Web/PWA e API separadas, preparada para PostgreSQL, RBAC, auditoria, multiplas filiais e futura app Android com Capacitor.

## Stack

- `apps/api`: NestJS, Prisma, PostgreSQL, Swagger, JWT, RBAC.
- `apps/web`: React, Vite, TanStack Query, React Hook Form, Zod, PWA.
- `packages/shared`: constantes e tipos partilhados.
- `docker-compose.yml`: PostgreSQL, API e Web.

## Primeira execucao local

Recommended on this Windows workspace:

```bash
Start PJLJ Salon Manager.bat
```

This keeps the PowerShell window open, starts the web app, and starts the API when `.env` has a working PostgreSQL `DATABASE_URL`.
For Supabase, fill both `DATABASE_URL` and `DIRECT_URL`; see `docs/SUPABASE.md`.

Manual flow:

```bash
copy .env.example .env
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/api/docs`

Credenciais seed:

- Email: `admin@pjlj.local`
- Password: valor de `SEED_ADMIN_PASSWORD`

Depois de API e banco estarem ativos:

```bash
npm.cmd run foundation:verify
```

Este smoke test verifica health, database, Swagger, login, refresh token, dashboard RBAC, claims RBAC e audit log.

## Docker

Docker files are kept as optional infrastructure, but Docker is not the main local workflow for this workspace.

```bash
copy .env.example .env
docker compose up --build
```

Nesta maquina, Docker nao estava disponivel no PATH durante a criacao do projeto, por isso a validacao Docker deve ser executada quando Docker Desktop estiver instalado/ativo.
