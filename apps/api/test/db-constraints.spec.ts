/**
 * Database constraint tests (SPEC-001 Part VI: DB-001..DB-007).
 * Run directly against PostgreSQL with the `pg` driver — no Prisma
 * client required. Every test runs in a rolled-back transaction against
 * committed fixture rows created in beforeAll.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://erapor:erapor@localhost:5432/erapor";

const db = new Client({ connectionString: DATABASE_URL });
const TAG = "spec-test";

const ids: Record<string, string> = {};

async function one(sql: string, params: unknown[] = []): Promise<string> {
  const r = await db.query(sql, params);
  return r.rows[0].id as string;
}

beforeAll(async () => {
  await db.connect();
  ids.school = await one(
    `INSERT INTO schools (name, code, updated_at) VALUES ('${TAG} School', '${TAG}-school', now()) RETURNING id`,
  );
  ids.user = await one(
    `INSERT INTO users (school_id, email, password_hash, full_name, role, updated_at)
     VALUES ($1, '${TAG}@sekolah.id', 'x', '${TAG} Teacher', 'TEACHER', now()) RETURNING id`,
    [ids.school],
  );
  ids.year = await one(
    `INSERT INTO academic_years (school_id, name, start_date, end_date, status, updated_at)
     VALUES ($1, '${TAG} 2026/2027', '2026-07-01', '2027-06-30', 'DRAFT', now()) RETURNING id`,
    [ids.school],
  );
  ids.semester = await one(
    `INSERT INTO semesters (academic_year_id, code, name, status, updated_at)
     VALUES ($1, 'ODD', '${TAG} Semester', 'DRAFT', now()) RETURNING id`,
    [ids.year],
  );
  ids.class = await one(
    `INSERT INTO classes (school_id, academic_year_id, name, grade_level, updated_at)
     VALUES ($1, $2, '${TAG} 4A', 4, now()) RETURNING id`,
    [ids.school, ids.year],
  );
  ids.subject = await one(
    `INSERT INTO subjects (school_id, code, name, subject_type, updated_at)
     VALUES ($1, '${TAG}-MTK', '${TAG} Matematika', 'MANDATORY', now()) RETURNING id`,
    [ids.school],
  );
  ids.category = await one(
    `INSERT INTO assessment_categories (school_id, name, updated_at) VALUES ($1, '${TAG} Formatif', now()) RETURNING id`,
    [ids.school],
  );
  ids.student = await one(
    `INSERT INTO students (school_id, nis, full_name, updated_at) VALUES ($1, '${TAG}-nis-1', '${TAG} Siswa 1', now()) RETURNING id`,
    [ids.school],
  );
  ids.enrollment = await one(
    `INSERT INTO student_enrollments (student_id, academic_year_id, class_id, enrollment_type, updated_at)
     VALUES ($1, $2, $3, 'NEW', now()) RETURNING id`,
    [ids.student, ids.year, ids.class],
  );
  ids.assignment = await one(
    `INSERT INTO teacher_assignments (teacher_id, academic_year_id, semester_id, class_id, subject_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
    [ids.user, ids.year, ids.semester, ids.class, ids.subject],
  );
  ids.assessment = await one(
    `INSERT INTO assessments (teacher_assignment_id, semester_id, class_id, subject_id, category_id, created_by_id, title, max_score, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, '${TAG} UH1', 100, 'PUBLISHED', now()) RETURNING id`,
    [ids.assignment, ids.semester, ids.class, ids.subject, ids.category, ids.user],
  );
  ids.score = await one(
    `INSERT INTO assessment_scores (assessment_id, student_id, score, normalized_score, updated_at)
     VALUES ($1, $2, 80, 80, now()) RETURNING id`,
    [ids.assessment, ids.student],
  );
  ids.scheme = await one(
    `INSERT INTO grading_schemes (academic_year_id, semester_id, status, updated_at)
     VALUES ($1, $2, 'DRAFT', now()) RETURNING id`,
    [ids.year, ids.semester],
  );
}, 30000);

afterAll(async () => {
  // Cleanup in dependency order.
  await db.query(`DELETE FROM assessment_scores WHERE assessment_id = $1`, [ids.assessment]);
  await db.query(`DELETE FROM assessments WHERE id = $1`, [ids.assessment]);
  await db.query(`DELETE FROM grading_scheme_weights WHERE grading_scheme_id = $1`, [ids.scheme]);
  await db.query(`DELETE FROM grading_schemes WHERE id = $1`, [ids.scheme]);
  await db.query(`DELETE FROM teacher_assignments WHERE id = $1`, [ids.assignment]);
  await db.query(`DELETE FROM student_enrollments WHERE id = $1`, [ids.enrollment]);
  await db.query(`DELETE FROM semesters WHERE id = $1`, [ids.semester]);
  await db.query(`DELETE FROM classes WHERE id = $1`, [ids.class]);
  await db.query(`DELETE FROM students WHERE id = $1`, [ids.student]);
  await db.query(`DELETE FROM subjects WHERE id = $1`, [ids.subject]);
  await db.query(`DELETE FROM assessment_categories WHERE id = $1`, [ids.category]);
  await db.query(`DELETE FROM academic_years WHERE id = $1`, [ids.year]);
  await db.query(`DELETE FROM users WHERE id = $1`, [ids.user]);
  await db.query(`DELETE FROM schools WHERE id = $1`, [ids.school]);
  await db.end();
});

/** Runs fn inside a transaction that is always rolled back. */
async function rolledBack(fn: (tx: Client) => Promise<void>) {
  await db.query("BEGIN");
  try {
    await fn(db);
  } finally {
    await db.query("ROLLBACK");
  }
}

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

describe("database constraints", () => {
  it("DB-001 duplicate student enrollment is rejected", async () => {
    await rolledBack(async (tx) => {
      const err = await tx
        .query(
          `INSERT INTO student_enrollments (student_id, academic_year_id, class_id, enrollment_type, updated_at)
           VALUES ($1, $2, $3, 'NEW', now())`,
          [ids.student, ids.year, ids.class],
        )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(err)).toBe("23505"); // unique_violation
    });
  });

  it("DB-002 duplicate assessment score is rejected", async () => {
    await rolledBack(async (tx) => {
      const err = await tx
        .query(`INSERT INTO assessment_scores (assessment_id, student_id, score, normalized_score, updated_at) VALUES ($1, $2, 70, 70, now())`, [
          ids.assessment,
          ids.student,
        ])
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(err)).toBe("23505");
    });
  });

  it("DB-003 duplicate teacher assignment is rejected", async () => {
    await rolledBack(async (tx) => {
      const err = await tx
        .query(
          `INSERT INTO teacher_assignments (teacher_id, academic_year_id, semester_id, class_id, subject_id, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())`,
          [ids.user, ids.year, ids.semester, ids.class, ids.subject],
        )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(err)).toBe("23505");
    });
  });

  it("DB-004 duplicate subject code per school is rejected", async () => {
    await rolledBack(async (tx) => {
      const err = await tx
        .query(`INSERT INTO subjects (school_id, code, name, updated_at) VALUES ($1, '${TAG}-MTK', 'Duplikat', now())`, [ids.school])
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(err)).toBe("23505");
    });
  });

  it("DB-005 academic year with start_date >= end_date is rejected", async () => {
    await rolledBack(async (tx) => {
      const err = await tx
        .query(
          `INSERT INTO academic_years (school_id, name, start_date, end_date, updated_at) VALUES ($1, '${TAG} invalid', '2027-06-30', '2026-07-01', now())`,
          [ids.school],
        )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(err)).toBe("23514"); // check_violation
    });
  });

  it("DB-006 weight outside 0-100 is rejected", async () => {
    await rolledBack(async (tx) => {
      // Savepoints: each violating insert aborts only its own sub-transaction.
      await tx.query("SAVEPOINT sp1");
      const tooHigh = await tx
        .query(`INSERT INTO grading_scheme_weights (grading_scheme_id, category_id, weight, updated_at) VALUES ($1, $2, 150, now())`, [
          ids.scheme,
          ids.category,
        ])
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(tooHigh)).toBe("23514");
      await tx.query("ROLLBACK TO SAVEPOINT sp1");

      await tx.query("SAVEPOINT sp2");
      const negative = await tx
        .query(`INSERT INTO grading_scheme_weights (grading_scheme_id, category_id, weight, updated_at) VALUES ($1, $2, -5, now())`, [
          ids.scheme,
          ids.category,
        ])
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(negative)).toBe("23514");
      await tx.query("ROLLBACK TO SAVEPOINT sp2");
    });
  });

  it("DB-007 score below 0 is rejected", async () => {
    await rolledBack(async (tx) => {
      // Need a second student to avoid the duplicate-score unique violation.
      const s2 = (
        await tx.query(
          `INSERT INTO students (school_id, nis, full_name, updated_at) VALUES ($1, '${TAG}-nis-2', '${TAG} Siswa 2', now()) RETURNING id`,
          [ids.school],
        )
      ).rows[0].id as string;
      const err = await tx
        .query(`INSERT INTO assessment_scores (assessment_id, student_id, score, normalized_score, updated_at) VALUES ($1, $2, -10, 0, now())`, [
          ids.assessment,
          s2,
        ])
        .then(() => null)
        .catch((e: unknown) => e);
      // Rejected either by the CHECK constraint or by the range trigger — both enforce the invariant.
      expect(["23514", "P0001"]).toContain(pgCode(err));
    });
  });

  it("score above max_score is rejected by the validation trigger", async () => {
    await rolledBack(async (tx) => {
      const s3 = (
        await tx.query(
          `INSERT INTO students (school_id, nis, full_name, updated_at) VALUES ($1, '${TAG}-nis-3', '${TAG} Siswa 3', now()) RETURNING id`,
          [ids.school],
        )
      ).rows[0].id as string;
      const err = await tx
        .query(`INSERT INTO assessment_scores (assessment_id, student_id, score, normalized_score, updated_at) VALUES ($1, $2, 150, 100, now())`, [
          ids.assessment,
          s3,
        ])
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(err)).toBe("P0001"); // raise_exception from trigger
      expect(String((err as Error).message)).toContain("outside allowed range");
    });
  });

  it("only one ACTIVE academic year per school", async () => {
    await rolledBack(async (tx) => {
      await tx.query(`UPDATE academic_years SET status = 'ACTIVE' WHERE id = $1`, [ids.year]);
      const err = await tx
        .query(
          `INSERT INTO academic_years (school_id, name, start_date, end_date, status, updated_at)
           VALUES ($1, '${TAG} second', '2027-07-01', '2028-06-30', 'ACTIVE', now())`,
          [ids.school],
        )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(err)).toBe("23505"); // partial unique index violation
    });
  });

  it("grade level outside 1-6 is rejected", async () => {
    await rolledBack(async (tx) => {
      const err = await tx
        .query(
          `INSERT INTO classes (school_id, academic_year_id, name, grade_level, updated_at) VALUES ($1, $2, '${TAG} invalid', 7, now())`,
          [ids.school, ids.year],
        )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(pgCode(err)).toBe("23514");
    });
  });
});
