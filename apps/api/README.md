# eRapor SD — Backend API (NestJS)

REST API untuk Sistem Nilai & Rapor SD. Kontrak: `docs/api/openapi.yaml`
(base path `/api/v1`). Spesifikasi: `SPEC-001-implementation-specification.md`.

## Prasyarat

- Node.js >= 20, npm >= 10
- PostgreSQL 15+ (migration sudah tersedia di `packages/database/prisma/migrations`)
- Chromium untuk render PDF rapor (`CHROME_EXECUTABLE_PATH`, default `/opt/meta-chromium/chrome`)

## Setup

```bash
# 1. Install (dari root monorepo)
npm install

# 2. Generate Prisma client (butuh akses binaries.prisma.sh)
npm run db:generate

# 3. Salin & isi environment
cp .env.example .env
#   DATABASE_URL, SESSION_SECRET (min 32 karakter) wajib diisi

# 4. Migration + seed (data skenario acceptance: sekolah, admin, guru Budi,
#    30 siswa kelas 4A, Matematika + CP/TP, skema Formatif 20 / Sumatif 80 published, KKTP 75)
npm run db:migrate
npm run db:seed
```

## Menjalankan

```bash
# Build database package dulu (menyediakan Prisma client), lalu API:
npm run build

# Start
npm run dev:api
```

> **Catatan:** Jangan jalankan via `tsx`/ts-node langsung — esbuild tidak
> meng-emit decorator metadata sehingga NestJS DI gagal. Selalu lewat
> `tsc` build (`dist/`) lalu `node`.

## Testing

```bash
cd apps/api
npx vitest run          # 48 tests: grading engine, auth policy, DB constraints
npx tsc --noEmit -p tsconfig.json   # typecheck
```

## Struktur modul (`src/`)

| Modul | Tanggung jawab |
|---|---|
| `auth/` | Login/logout/me, session cookie HttpOnly, guards (session, role, rate-limit login) |
| `authorization/` | `ResourcePolicyService` — scope guru/orang tua per resource, deny-by-default |
| `academic-years/` | Tahun ajaran + aktivasi (satu ACTIVE), semester |
| `students/`, `guardians/` | Siswa, enrollment, relasi wali |
| `classes/` | Kelas + `POST /classes/:id/promote` (kenaikan kelas, SUPERADMIN) |
| `subjects/`, `curriculum/` | Mapel, CP, TP |
| `assignments/` | Penugasan guru (ruang lingkup akses guru) |
| `assessment-categories/` | Kategori penilaian |
| `grading/` | Skema + bobot (draft-only) + publish (total tepat 100), KKTP, `GradingEngine` murni (decimal.js), pratinjau nilai |
| `assessments/` | Asesmen, nilai bulk transaksional, import 2-tahap (preview → commit) XLSX/CSV |
| `reports/` | Generate snapshot (1 transaksi), state machine DRAFT→REVIEW→LOCKED→PUBLISHED, revisi versi baru, PDF Chromium |
| `audit/` | Audit log append-only + `GET /audit-logs` (SUPERADMIN) |

## Aturan penting

- `schoolId` **selalu** dari session (BR-001) — tidak pernah dari client.
- Nilai dihitung dengan `decimal.js`; pembulatan hanya untuk display (nearest int).
- Nilai kosong ≠ 0 → status `INCOMPLETE`, rapor tidak bisa di-generate.
- Rapor published bersifat snapshot immutable (dijaga trigger DB + service);
  koreksi lewat revisi (versi baru).
- Pesan error user-facing dalam Bahasa Indonesia; `code` mengikuti
  `ErrorResponse` di `openapi.yaml`.

## Akun seed

| Role | Email | Password |
|---|---|---|
| Superadmin | `admin@sekolah.id` | `admin123` (atau `SEED_ADMIN_PASSWORD`) |
| Guru | `budi@sekolah.id` | `guru12345` |
| Wali | `wali@sekolah.id` | `wali12345` |

## Smoke test end-to-end

`node smoke.mjs` menjalankan 55 pemeriksaan HTTP terhadap server yang sedang
berjalan (butuh DB yang sudah di-seed; ID seed ditemukan otomatis via API):

- Auth: login 401/200, `/me` 401 tanpa cookie, logout 204
- Guards: guru/wali → 403/404 sesuai authorization matrix
- Tahun ajaran, semester, kelas (duplikat → 409)
- Penilaian + nilai bulk (skor > max → 422), preview grading
- Import nilai CSV 2-tahap (preview → commit)
- Skema: PUT bobot draft bebas, publish menolak total 99 (→ 409),
  bobot terkunci setelah publish
- Rapor: generate → 201, duplikat → 409, review → lock → publish
  (hanya SUPERADMIN), PDF valid, revisi v2
- Promosi: hanya SUPERADMIN, idempoten (duplikat → 200, skipped)
- Audit log (SUPERADMIN saja)

Reset DB ke kondisi seed bersih:

```bash
psql $DATABASE_URL -c "TRUNCATE academic_years, assessment_categories, \
assessment_learning_objectives, assessment_scores, assessments, audit_logs, \
classes, curriculum_outcomes, grading_scheme_weights, grading_schemes, \
guardians, kktp_configurations, learning_objectives, report_card_subjects, \
report_cards, schools, semesters, sessions, student_enrollments, \
student_guardians, students, subjects, teacher_assignments, users \
RESTART IDENTITY CASCADE;"
cd ../../packages/database && DATABASE_URL=$DATABASE_URL npx tsx prisma/seed.ts
```
