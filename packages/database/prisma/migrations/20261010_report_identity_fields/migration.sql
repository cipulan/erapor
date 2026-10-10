-- NBM guru untuk tanda tangan rapor + kota sekolah untuk baris tempat/tanggal.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nbm" TEXT;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "city" TEXT;
