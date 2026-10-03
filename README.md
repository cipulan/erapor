# eRapor SD — Sistem Nilai & Rapor Sekolah Dasar

Monorepo modular monolith untuk pengelolaan nilai dan rapor SD.

## Spesifikasi

Implementasi mengikuti [SPEC-001](SPEC-001-implementation-specification.md):

- **Arsitektur:** modular monolith
- **Frontend:** Next.js + TypeScript (`apps/web`)
- **Backend:** NestJS + TypeScript (`apps/api`)
- **Database:** PostgreSQL 15+ + Prisma ORM 7 (`packages/database`)
- **API:** REST/JSON, kontrak OpenAPI 3.1 (`docs/api/openapi.yaml`)
- **Auth:** HTTP-only secure session cookie
- **Deploy:** Docker (`docker-compose.yml`)

## Struktur

```text
erapor/
├── apps/
│   ├── web/            # Next.js frontend
│   └── api/            # NestJS backend
├── packages/
│   ├── database/       # Prisma schema, migrations, seed
│   ├── shared/         # Tipe & util bersama
│   └── api-client/     # Typed API client untuk frontend
├── docs/
│   ├── api/openapi.yaml
│   └── architecture/   # grading-engine, authorization-matrix, database-review
├── SPEC-001-*.md       # Implementation specification
└── docker-compose.yml
```

## Prasyarat

- Node.js >= 20
- PostgreSQL 15+
- `DATABASE_URL` di environment (lihat `packages/database/.env.example`)

## Mulai cepat (development)

```bash
npm install
npm run db:generate
npm run build --workspace=@erapor/database
npm run db:migrate:dev
npm run db:seed
npm run dev:api   # terminal 1 → http://localhost:3001
npm run dev:web   # terminal 2 → http://localhost:3000
```

## Docker

```bash
cp .env.example .env   # sesuaikan bila perlu
docker compose up -d --build
```

## Deploy ke server (via GitHub Actions)

Setiap push ke `main` otomatis deploy ke server setelah validasi lolos
(typecheck, unit test, validasi compose, lint Dockerfile).

**Setup sekali di GitHub repo** (Settings → Secrets and variables → Actions):

| Secret           | Isi                                    |
| ---------------- | -------------------------------------- |
| `SSH_HOST`       | Host server (mis. `hog.pingsut.com`)   |
| `SSH_USER`       | User SSH (mis. `opc`)                  |
| `SSH_PRIVATE_KEY`| Private key SSH untuk user tersebut    |

**Setup sekali di server:**

```bash
git clone git@github.com:cipulan/erapor.git ~/erapor
cd ~/erapor
cp .env.example .env
# WAJIB: isi SESSION_SECRET dengan string acak >= 32 karakter
nano .env
docker compose up -d --build
```

Setelah itu setiap `git push` ke `main` akan: `git pull` → `docker compose up -d --build`
secara otomatis. API di port `3001`, web di port `3000`, PostgreSQL di `5432`
(hanya perlu expose port 3000 ke reverse proxy / firewall sesuai kebutuhan).
