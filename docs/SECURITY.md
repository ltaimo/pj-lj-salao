# Security

Fundacao implementada:

- Password hashing com Argon2.
- JWT access token e refresh token.
- Refresh token guardado apenas como hash.
- RBAC por permissoes, nao por nomes hard-coded de cargos.
- Helmet, CORS configuravel por `WEB_ORIGIN` e validacao DTO server-side.
- Audit log para login, logout e futuras acoes sensiveis.

Obrigatorio antes de producao:

- Substituir todos os secrets da `.env`.
- Usar HTTPS.
- Configurar rate limiting.
- Rever politicas de cookies HttpOnly quando a web passar a usar cookies.
- Ativar backups e monitoria.
