-- Initial schema for School Report MVP
-- PostgreSQL 15+ recommended.
-- Prisma ORM 7 baseline migration.
-- Custom CHECK constraints and partial indexes are intentionally kept here
-- because they are database-level invariants not fully represented by Prisma schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'TEACHER', 'PARENT');
CREATE TYPE "AcademicYearStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "SemesterCode" AS ENUM ('ODD', 'EVEN');
CREATE TYPE "SemesterStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'TRANSFERRED', 'INACTIVE');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "EnrollmentType" AS ENUM ('NEW', 'PROMOTED', 'REPEATED', 'TRANSFERRED');
CREATE TYPE "SubjectType" AS ENUM ('MANDATORY', 'ADDITIONAL', 'LOCAL');
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "GradingSchemeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'REVIEW', 'LOCKED', 'PUBLISHED', 'REVISION');
CREATE TYPE "AchievementStatus" AS ENUM ('ACHIEVED', 'NOT_ACHIEVED', 'NOT_ASSESSED');

CREATE TABLE "schools" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "code" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "address" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3),
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "students" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "nis" TEXT,
  "nisn" TEXT,
  "full_name" TEXT NOT NULL,
  "gender" "Gender",
  "birth_place" TEXT,
  "birth_date" DATE,
  "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "students_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "guardians" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "user_id" UUID,
  "full_name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "guardians_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "guardians_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "guardians_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "student_guardians" (
  "student_id" UUID NOT NULL,
  "guardian_id" UUID NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("student_id","guardian_id"),
  CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "student_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "academic_years" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "AcademicYearStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "academic_years_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "academic_year_dates_check" CHECK ("start_date" < "end_date")
);

CREATE TABLE "semesters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "academic_year_id" UUID NOT NULL,
  "code" "SemesterCode" NOT NULL,
  "name" TEXT NOT NULL,
  "start_date" DATE,
  "end_date" DATE,
  "status" "SemesterStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "semesters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "semesters_id_academic_year_id_key" UNIQUE ("id","academic_year_id"),
  CONSTRAINT "semesters_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "semester_dates_check" CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "start_date" < "end_date")
);

CREATE TABLE "classes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "grade_level" INTEGER NOT NULL,
  "homeroom_teacher_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "classes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "classes_id_academic_year_id_key" UNIQUE ("id","academic_year_id"),
  CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "classes_homeroom_teacher_id_fkey" FOREIGN KEY ("homeroom_teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "classes_grade_level_check" CHECK ("grade_level" BETWEEN 1 AND 6)
);

CREATE TABLE "student_enrollments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "enrollment_type" "EnrollmentType" NOT NULL DEFAULT 'NEW',
  "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "student_enrollments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "student_enrollments_class_year_fkey" FOREIGN KEY ("class_id","academic_year_id") REFERENCES "classes"("id","academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "subjects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject_type" "SubjectType" NOT NULL DEFAULT 'MANDATORY',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subjects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "curriculum_outcomes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "subject_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "curriculum_outcomes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curriculum_outcomes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "learning_objectives" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cp_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_objectives_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learning_objectives_cp_id_fkey" FOREIGN KEY ("cp_id") REFERENCES "curriculum_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "teacher_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teacher_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teacher_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "teacher_assignments_semester_year_fkey" FOREIGN KEY ("semester_id","academic_year_id") REFERENCES "semesters"("id","academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "teacher_assignments_class_year_fkey" FOREIGN KEY ("class_id","academic_year_id") REFERENCES "classes"("id","academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "teacher_assignment_school_subject_note" CHECK ("subject_id" IS NOT NULL)
);

CREATE TABLE "assessment_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assessment_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_categories_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "grading_schemes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "academic_year_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "status" "GradingSchemeStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "grading_schemes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "grading_schemes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "grading_schemes_semester_year_fkey" FOREIGN KEY ("semester_id","academic_year_id") REFERENCES "semesters"("id","academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "grading_scheme_weights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "grading_scheme_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "weight" DECIMAL(5,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "grading_scheme_weights_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "grading_scheme_weights_scheme_id_fkey" FOREIGN KEY ("grading_scheme_id") REFERENCES "grading_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "grading_scheme_weights_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "assessment_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "grading_scheme_weights_range_check" CHECK ("weight" >= 0 AND "weight" <= 100)
);

CREATE TABLE "assessments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teacher_assignment_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assessment_date" DATE,
  "max_score" DECIMAL(8,2) NOT NULL,
  "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assessments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessments_teacher_assignment_id_fkey" FOREIGN KEY ("teacher_assignment_id") REFERENCES "teacher_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessments_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "assessment_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessments_max_score_check" CHECK ("max_score" > 0)
);

CREATE TABLE "assessment_learning_objectives" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assessment_id" UUID NOT NULL,
  "cp_id" UUID NOT NULL,
  "tp_id" UUID,
  CONSTRAINT "assessment_learning_objectives_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_learning_objectives_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assessment_learning_objectives_cp_id_fkey" FOREIGN KEY ("cp_id") REFERENCES "curriculum_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessment_learning_objectives_tp_id_fkey" FOREIGN KEY ("tp_id") REFERENCES "learning_objectives"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "assessment_scores" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assessment_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "score" DECIMAL(8,2) NOT NULL,
  "normalized_score" DECIMAL(8,2) NOT NULL,
  "note" TEXT,
  "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assessment_scores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assessment_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "assessment_scores_score_check" CHECK ("score" >= 0),
  CONSTRAINT "assessment_scores_normalized_check" CHECK ("normalized_score" >= 0 AND "normalized_score" <= 100)
);

CREATE TABLE "kktp_configurations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "academic_year_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "threshold" DECIMAL(5,2) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kktp_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kktp_configurations_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kktp_configurations_semester_year_fkey" FOREIGN KEY ("semester_id","academic_year_id") REFERENCES "semesters"("id","academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kktp_configurations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kktp_configurations_threshold_check" CHECK ("threshold" >= 0 AND "threshold" <= 100)
);

CREATE TABLE "report_cards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT',
  "generated_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "locked_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "reviewed_by_id" UUID,
  "locked_by_id" UUID,
  "published_by_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "report_cards_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "report_cards_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "report_cards_semester_year_fkey" FOREIGN KEY ("semester_id","academic_year_id") REFERENCES "semesters"("id","academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "report_cards_class_year_fkey" FOREIGN KEY ("class_id","academic_year_id") REFERENCES "classes"("id","academic_year_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "report_cards_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "report_card_subjects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_card_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "subject_name" TEXT NOT NULL,
  "final_score" DECIMAL(8,2) NOT NULL,
  "kktp_threshold" DECIMAL(5,2),
  "achievement" "AchievementStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
  "description" TEXT,
  "snapshot_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_card_subjects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "report_card_subjects_report_card_id_fkey" FOREIGN KEY ("report_card_id") REFERENCES "report_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "report_card_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "report_card_subjects_final_score_check" CHECK ("final_score" >= 0 AND "final_score" <= 100),
  CONSTRAINT "report_card_subjects_kktp_check" CHECK ("kktp_threshold" IS NULL OR ("kktp_threshold" >= 0 AND "kktp_threshold" <= 100))
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID,
  "before_json" JSONB,
  "after_json" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");
CREATE UNIQUE INDEX "users_school_id_email_key" ON "users"("school_id","email");
CREATE INDEX "users_school_id_role_idx" ON "users"("school_id","role");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id","expires_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE UNIQUE INDEX "students_school_id_nis_key" ON "students"("school_id","nis");
CREATE INDEX "students_school_id_full_name_idx" ON "students"("school_id","full_name");
CREATE INDEX "students_school_id_nisn_idx" ON "students"("school_id","nisn");
CREATE UNIQUE INDEX "guardians_user_id_key" ON "guardians"("user_id");
CREATE INDEX "guardians_school_id_full_name_idx" ON "guardians"("school_id","full_name");
CREATE INDEX "student_guardians_guardian_id_idx" ON "student_guardians"("guardian_id");
CREATE UNIQUE INDEX "academic_years_school_id_name_key" ON "academic_years"("school_id","name");
CREATE INDEX "academic_years_school_id_status_idx" ON "academic_years"("school_id","status");
CREATE UNIQUE INDEX "semesters_academic_year_id_code_key" ON "semesters"("academic_year_id","code");
CREATE INDEX "semesters_academic_year_id_status_idx" ON "semesters"("academic_year_id","status");
CREATE UNIQUE INDEX "classes_academic_year_id_name_key" ON "classes"("academic_year_id","name");
CREATE INDEX "classes_school_id_academic_year_id_idx" ON "classes"("school_id","academic_year_id");
CREATE UNIQUE INDEX "student_enrollments_student_id_academic_year_id_key" ON "student_enrollments"("student_id","academic_year_id");
CREATE INDEX "student_enrollments_class_id_academic_year_id_status_idx" ON "student_enrollments"("class_id","academic_year_id","status");
CREATE INDEX "student_enrollments_academic_year_id_student_id_idx" ON "student_enrollments"("academic_year_id","student_id");
CREATE UNIQUE INDEX "subjects_school_id_code_key" ON "subjects"("school_id","code");
CREATE INDEX "subjects_school_id_is_active_idx" ON "subjects"("school_id","is_active");
CREATE UNIQUE INDEX "curriculum_outcomes_subject_id_code_key" ON "curriculum_outcomes"("subject_id","code");
CREATE INDEX "curriculum_outcomes_subject_id_is_active_idx" ON "curriculum_outcomes"("subject_id","is_active");
CREATE UNIQUE INDEX "learning_objectives_cp_id_code_key" ON "learning_objectives"("cp_id","code");
CREATE INDEX "learning_objectives_cp_id_is_active_idx" ON "learning_objectives"("cp_id","is_active");
CREATE UNIQUE INDEX "teacher_assignments_teacher_id_semester_id_class_id_subject_id_key" ON "teacher_assignments"("teacher_id","semester_id","class_id","subject_id");
CREATE INDEX "teacher_assignments_academic_year_id_semester_id_class_id_subject_id_idx" ON "teacher_assignments"("academic_year_id","semester_id","class_id","subject_id");
CREATE INDEX "teacher_assignments_teacher_id_semester_id_status_idx" ON "teacher_assignments"("teacher_id","semester_id","status");
CREATE UNIQUE INDEX "assessment_categories_school_id_name_key" ON "assessment_categories"("school_id","name");
CREATE INDEX "assessment_categories_school_id_is_active_idx" ON "assessment_categories"("school_id","is_active");
CREATE UNIQUE INDEX "grading_schemes_academic_year_id_semester_id_key" ON "grading_schemes"("academic_year_id","semester_id");
CREATE INDEX "grading_schemes_academic_year_id_status_idx" ON "grading_schemes"("academic_year_id","status");
CREATE UNIQUE INDEX "grading_scheme_weights_grading_scheme_id_category_id_key" ON "grading_scheme_weights"("grading_scheme_id","category_id");
CREATE INDEX "grading_scheme_weights_category_id_idx" ON "grading_scheme_weights"("category_id");
CREATE INDEX "assessments_semester_id_class_id_subject_id_category_id_idx" ON "assessments"("semester_id","class_id","subject_id","category_id");
CREATE INDEX "assessments_teacher_assignment_id_status_idx" ON "assessments"("teacher_assignment_id","status");
CREATE UNIQUE INDEX "assessment_learning_objectives_assessment_id_cp_id_tp_id_key"
  ON "assessment_learning_objectives"("assessment_id","cp_id","tp_id");
CREATE INDEX "assessment_learning_objectives_cp_id_idx" ON "assessment_learning_objectives"("cp_id");
CREATE INDEX "assessment_learning_objectives_tp_id_idx" ON "assessment_learning_objectives"("tp_id");
CREATE UNIQUE INDEX "assessment_scores_assessment_id_student_id_key" ON "assessment_scores"("assessment_id","student_id");
CREATE INDEX "assessment_scores_student_id_assessment_id_idx" ON "assessment_scores"("student_id","assessment_id");
CREATE UNIQUE INDEX "kktp_configurations_academic_year_id_semester_id_subject_id_key" ON "kktp_configurations"("academic_year_id","semester_id","subject_id");
CREATE INDEX "kktp_configurations_subject_id_semester_id_idx" ON "kktp_configurations"("subject_id","semester_id");
CREATE UNIQUE INDEX "report_cards_student_id_academic_year_id_semester_id_version_key" ON "report_cards"("student_id","academic_year_id","semester_id","version");
CREATE INDEX "report_cards_academic_year_id_semester_id_class_id_status_idx" ON "report_cards"("academic_year_id","semester_id","class_id","status");
CREATE INDEX "report_cards_student_id_academic_year_id_semester_id_idx" ON "report_cards"("student_id","academic_year_id","semester_id");
CREATE UNIQUE INDEX "report_card_subjects_report_card_id_subject_id_key" ON "report_card_subjects"("report_card_id","subject_id");
CREATE INDEX "report_card_subjects_subject_id_idx" ON "report_card_subjects"("subject_id");
CREATE INDEX "audit_logs_school_id_created_at_idx" ON "audit_logs"("school_id","created_at");
CREATE INDEX "audit_logs_school_id_entity_type_entity_id_idx" ON "audit_logs"("school_id","entity_type","entity_id");
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id","created_at");

-- Only one ACTIVE academic year per school.
CREATE UNIQUE INDEX "academic_years_one_active_per_school_idx"
  ON "academic_years"("school_id")
  WHERE "status" = 'ACTIVE';

-- Additional database-level invariants.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_nonempty_check"
  CHECK (length(trim("email")) > 0);

ALTER TABLE "students"
  ADD CONSTRAINT "students_name_nonempty_check"
  CHECK (length(trim("full_name")) > 0);

ALTER TABLE "assessment_categories"
  ADD CONSTRAINT "assessment_categories_name_nonempty_check"
  CHECK (length(trim("name")) > 0);

-- Guard against invalid score > max_score at database level.
-- This uses a trigger because the max_score lives on the parent assessment row.
CREATE OR REPLACE FUNCTION validate_assessment_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assessment_max DECIMAL(8,2);
BEGIN
  SELECT max_score INTO assessment_max
  FROM assessments
  WHERE id = NEW.assessment_id;

  IF assessment_max IS NULL THEN
    RAISE EXCEPTION 'Assessment % does not exist', NEW.assessment_id;
  END IF;

  IF NEW.score < 0 OR NEW.score > assessment_max THEN
    RAISE EXCEPTION 'Score % is outside allowed range 0..%', NEW.score, assessment_max;
  END IF;

  IF NEW.normalized_score < 0 OR NEW.normalized_score > 100 THEN
    RAISE EXCEPTION 'Normalized score must be between 0 and 100';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "assessment_scores_validate_score"
BEFORE INSERT OR UPDATE OF assessment_id, score, normalized_score
ON "assessment_scores"
FOR EACH ROW
EXECUTE FUNCTION validate_assessment_score();

-- Keep published grading schemes immutable at DB level.
CREATE OR REPLACE FUNCTION prevent_published_grading_scheme_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published grading scheme is immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "grading_schemes_immutable_after_publish"
BEFORE UPDATE OR DELETE ON "grading_schemes"
FOR EACH ROW
EXECUTE FUNCTION prevent_published_grading_scheme_change();

CREATE OR REPLACE FUNCTION prevent_published_grading_weight_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  scheme_status "GradingSchemeStatus";
BEGIN
  SELECT status INTO scheme_status
  FROM grading_schemes
  WHERE id = COALESCE(NEW.grading_scheme_id, OLD.grading_scheme_id);

  IF scheme_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Weights of a published grading scheme cannot be changed';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "grading_scheme_weights_immutable_after_publish"
BEFORE INSERT OR UPDATE OR DELETE ON "grading_scheme_weights"
FOR EACH ROW
EXECUTE FUNCTION prevent_published_grading_weight_change();

-- Report cards are snapshots. Published versions cannot be modified/deleted.
CREATE OR REPLACE FUNCTION prevent_published_report_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'Published report card cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published report card cannot be modified; create a revision';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "report_cards_immutable_after_publish"
BEFORE UPDATE OR DELETE ON "report_cards"
FOR EACH ROW
EXECUTE FUNCTION prevent_published_report_change();

CREATE OR REPLACE FUNCTION prevent_published_report_subject_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  report_status "ReportCardStatus";
BEGIN
  SELECT status INTO report_status
  FROM report_cards
  WHERE id = COALESCE(NEW.report_card_id, OLD.report_card_id);

  IF report_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Subjects of a published report card cannot be changed';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "report_card_subjects_immutable_after_publish"
BEFORE INSERT OR UPDATE OR DELETE ON "report_card_subjects"
FOR EACH ROW
EXECUTE FUNCTION prevent_published_report_subject_change();

-- Critical multi-tenant consistency checks that require application-level
-- transaction validation are intentionally NOT encoded with triggers.
-- The API must always derive schoolId from the authenticated session.
