-- Add headmaster (kepala sekolah) data to schools.
-- Nullable columns: existing rows are unaffected.

ALTER TABLE "public"."schools" ADD COLUMN "headmaster_name" TEXT;
ALTER TABLE "public"."schools" ADD COLUMN "headmaster_nip" TEXT;
