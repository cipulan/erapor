-- Kelengkapan rapor oleh wali kelas (Fase 4): kokurikuler, ekstrakurikuler,
-- ketidakhadiran, dan catatan wali kelas — pengganti sheet KOKURIKULER,
-- CATATAN, dan kolom S/I/A + Ekskul di Data LHPP pada file generator Excel.
ALTER TABLE "report_cards"
  ADD COLUMN "cocurricular_description" TEXT,
  ADD COLUMN "homeroom_notes" TEXT,
  ADD COLUMN "sick_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "permission_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "unexcused_days" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "extracurricular_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_card_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "predicate" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "extracurricular_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "extracurricular_entries"
  ADD CONSTRAINT "extracurricular_entries_report_card_id_fkey"
  FOREIGN KEY ("report_card_id") REFERENCES "report_cards"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "extracurricular_entries_report_card_id_idx"
  ON "extracurricular_entries"("report_card_id");
