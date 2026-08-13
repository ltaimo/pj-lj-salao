# Architecture

O projeto e um monorepo API-first.

```text
Web App / PWA -> REST API -> Business Logic -> PostgreSQL
```

Regras:

- Regras de negocio vivem na API.
- Web, PWA, Android e futuros portais consomem a mesma API.
- Entidades transacionais devem nascer com `organization_id` e `branch_id` quando aplicavel.
- Operacoes financeiras futuras devem usar transacoes e `Idempotency-Key`.
- Auditoria e RBAC sao parte da fundacao, nao complemento posterior.

## Modulos iniciais

- Auth: login, refresh, logout, `me`.
- RBAC: `roles`, `permissions`, `role_permissions`, `user_roles`.
- Organizations/Branches: preparados para multi-filial.
- Settings: configuracao inicial por organizacao/filial.
- Audit: registro de login/logout e base para acoes criticas.
- Health: `/api/v1/health` e `/api/v1/health/db`.
