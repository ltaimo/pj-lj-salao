# Backup and Restore

Politica minima:

- Backup diario.
- Backup semanal.
- Backup mensal.

Um backup so conta como confiavel depois de uma restauracao testada.

Procedimento inicial:

```bash
pg_dump "$DATABASE_URL" > pjlj-backup.sql
psql "$DATABASE_URL" < pjlj-backup.sql
```

Em producao, automatizar retencao, encriptacao e teste periodico de restauracao.
