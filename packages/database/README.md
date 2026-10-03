# School Report — Prisma Database Baseline

Files:
- `prisma/schema.prisma` — Prisma ORM 7 schema.
- `prisma/prisma7.config.ts` — Prisma 7 migration configuration.
- `prisma/migrations/20261003_init/migration.sql` — initial PostgreSQL migration with database-level constraints/triggers.

Expected environment:
- PostgreSQL 15+
- `DATABASE_URL` set in the environment.

Important:
- Prisma ORM 7 uses `prisma-client` and requires an explicit generator output path.
- Run `prisma generate` after installing dependencies.
- Review/validate this migration against the target PostgreSQL version before production.
