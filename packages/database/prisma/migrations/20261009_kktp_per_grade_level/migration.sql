-- KKTP per grade level: threshold now varies per (academic year, semester, subject, grade level).
-- Existing configurations are duplicated for grade levels 1-6 so behavior is unchanged until edited.
--
-- Written defensively (IF EXISTS / IF NOT EXISTS + guarded backfill) because a
-- previous revision of this migration failed partway on some databases, leaving
-- the grade_level column behind. Re-running must be safe.

-- Drop the old unique constraint first: the backfill intentionally creates
-- multiple rows per (academic_year_id, semester_id, subject_id).
DROP INDEX IF EXISTS "kktp_configurations_academic_year_id_semester_id_subject_id_key";

ALTER TABLE "kktp_configurations" ADD COLUMN IF NOT EXISTS "grade_level" INTEGER;

-- Backfill: one row per grade level for every configuration that predates
-- grade_level (grade_level IS NULL). Groups that already have graded rows
-- (from a partial earlier run) are skipped to avoid double duplication.
INSERT INTO "kktp_configurations" ("id", "academic_year_id", "semester_id", "subject_id", "grade_level", "threshold", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), o."academic_year_id", o."semester_id", o."subject_id", g, o."threshold", o."description", o."created_at", o."updated_at"
FROM (
  SELECT DISTINCT "academic_year_id", "semester_id", "subject_id", "threshold", "description", "created_at", "updated_at"
  FROM "kktp_configurations"
  WHERE "grade_level" IS NULL
) AS o
CROSS JOIN generate_series(1, 6) AS g
WHERE NOT EXISTS (
  SELECT 1 FROM "kktp_configurations" AS e
  WHERE e."academic_year_id" = o."academic_year_id"
    AND e."semester_id" = o."semester_id"
    AND e."subject_id" = o."subject_id"
    AND e."grade_level" IS NOT NULL
);

-- Drop the original pre-grade_level rows
DELETE FROM "kktp_configurations" WHERE "grade_level" IS NULL;

ALTER TABLE "kktp_configurations" ALTER COLUMN "grade_level" SET NOT NULL;

DROP INDEX IF EXISTS "kktp_configurations_academic_year_id_semester_id_subject_id_grade_level_key";
CREATE UNIQUE INDEX "kktp_configurations_academic_year_id_semester_id_subject_id_grade_level_key" ON "kktp_configurations"("academic_year_id", "semester_id", "subject_id", "grade_level");
