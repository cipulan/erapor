-- KKTP per grade level: threshold now varies per (academic year, semester, subject, grade level).
-- Existing configurations are duplicated for grade levels 1-6 so behavior is unchanged until edited.

ALTER TABLE "kktp_configurations" ADD COLUMN "grade_level" INTEGER;

-- Backfill: one row per grade level for every existing configuration
INSERT INTO "kktp_configurations" ("id", "academic_year_id", "semester_id", "subject_id", "grade_level", "threshold", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), "academic_year_id", "semester_id", "subject_id", g, "threshold", "description", "created_at", "updated_at"
FROM "kktp_configurations" CROSS JOIN generate_series(1, 6) AS g;

-- Drop the original rows (grade_level IS NULL)
DELETE FROM "kktp_configurations" WHERE "grade_level" IS NULL;

ALTER TABLE "kktp_configurations" ALTER COLUMN "grade_level" SET NOT NULL;

-- Replace the unique constraint with the grade-level-aware one
DROP INDEX "kktp_configurations_academic_year_id_semester_id_subject_id_key";
CREATE UNIQUE INDEX "kktp_configurations_academic_year_id_semester_id_subject_id_grade_level_key" ON "kktp_configurations"("academic_year_id", "semester_id", "subject_id", "grade_level");
