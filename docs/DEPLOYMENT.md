# Deployment

Ambientes previstos:

- Development
- Staging
- Production

Cada ambiente deve ter base de dados separada e secrets proprios.

## Vercel

This repository includes `vercel.json` for the same deployment style used by the other apps in this workspace.

Required environment variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `WEB_ORIGIN`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Deploy command:

```bash
npm.cmd run deploy:vercel
```

## Checklist

- `npm.cmd run build`
- `npm.cmd test`
- `npm.cmd run db:deploy`
- `npm.cmd run db:seed` apenas quando apropriado
- Verificar `/api/v1/health`
- Verificar `/api/v1/health/db`
- Verificar `/api/docs`
- Verificar login do administrador
- `npm.cmd run foundation:verify`
