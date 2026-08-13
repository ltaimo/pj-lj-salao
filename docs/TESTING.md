# Testing

Comandos:

```bash
npm.cmd test
npm.cmd run build
npm.cmd run foundation:verify
```

Cobertura inicial:

- Auth rejeita credenciais invalidas.
- Auth emite tokens e grava auditoria.
- Smoke de fundacao cobre health, DB, Swagger, login, refresh, dashboard RBAC e audit quando a API esta ligada a PostgreSQL.

Antes da Etapa 1, expandir para:

- Login real com banco seeded.
- Refresh token real.
- RBAC por permissao.
- Health DB.
- Smoke test web.
- E2E critico com Playwright quando POS, caixa e stock estiverem implementados.
