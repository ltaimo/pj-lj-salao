# Database

Banco principal: PostgreSQL.

ORM: Prisma.

Schema: `apps/api/prisma/schema.prisma`.

Migration inicial: `apps/api/prisma/migrations/20260812000000_foundation/migration.sql`.

## Tabelas da fundacao

- `organizations`
- `branches`
- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `settings`
- `audit_logs`

As proximas etapas devem adicionar clientes, profissionais, servicos, POS, pagamentos, caixa e stock mantendo historico, snapshots e auditoria.
