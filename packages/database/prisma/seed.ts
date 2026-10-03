/**
 * Seed script: acceptance-scenario baseline data (SPEC-001 Part X).
 *
 *   npm run db:seed   (workspace @erapor/database)
 *
 * Requires `prisma generate` to have run first. Credentials come from env
 * (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME) with safe
 * defaults documented in .env.example — never hardcoded secrets.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcryptjs from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@sekolah.id";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Administrator";

const TEACHER_EMAIL = "budi@sekolah.id";
const TEACHER_PASSWORD = "guru12345";
const PARENT_EMAIL = "wali@sekolah.id";
const PARENT_PASSWORD = "wali12345";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

/** Deterministic pseudo-random generator so seeds are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  console.log("Seeding eRapor acceptance-scenario data...");

  const school = await prisma.school.upsert({
    where: { code: "SDC-001" },
    create: {
      name: "SDN 01 Contoh",
      code: "SDC-001",
      timezone: "Asia/Jakarta",
      address: "Jl. Pendidikan No. 1",
    },
    update: {},
  });

  const admin = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: ADMIN_EMAIL } },
    create: {
      schoolId: school.id,
      email: ADMIN_EMAIL,
      passwordHash: await bcryptjs.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS),
      fullName: ADMIN_NAME,
      role: "SUPERADMIN",
    },
    update: {},
  });

  const budi = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: TEACHER_EMAIL } },
    create: {
      schoolId: school.id,
      email: TEACHER_EMAIL,
      passwordHash: await bcryptjs.hash(TEACHER_PASSWORD, BCRYPT_ROUNDS),
      fullName: "Budi Santoso",
      role: "TEACHER",
    },
    update: {},
  });

  const parentUser = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: PARENT_EMAIL } },
    create: {
      schoolId: school.id,
      email: PARENT_EMAIL,
      passwordHash: await bcryptjs.hash(PARENT_PASSWORD, BCRYPT_ROUNDS),
      fullName: "Wali Siswa 01",
      role: "PARENT",
    },
    update: {},
  });

  const year = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "2026/2027" } },
    create: {
      schoolId: school.id,
      name: "2026/2027",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2027-06-30"),
      status: "ACTIVE",
    },
    update: { status: "ACTIVE" },
  });

  const semester = await prisma.semester.upsert({
    where: { academicYearId_code: { academicYearId: year.id, code: "ODD" } },
    create: {
      academicYearId: year.id,
      code: "ODD",
      name: "Semester 1 (Ganjil)",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
      status: "ACTIVE",
    },
    update: { status: "ACTIVE" },
  });

  const kelas = await prisma.class.upsert({
    where: { academicYearId_name: { academicYearId: year.id, name: "4A" } },
    create: {
      schoolId: school.id,
      academicYearId: year.id,
      name: "4A",
      gradeLevel: 4,
      homeroomTeacherId: budi.id,
    },
    update: { homeroomTeacherId: budi.id },
  });

  // 30 students enrolled in 4A.
  const students = [];
  for (let i = 1; i <= 30; i++) {
    const n = String(i).padStart(2, "0");
    const student = await prisma.student.upsert({
      where: { schoolId_nis: { schoolId: school.id, nis: `2026${n}01`.slice(0, 10) } },
      create: {
        schoolId: school.id,
        nis: `202600${n}`,
        nisn: `006${n}0001`,
        fullName: `Siswa ${n}`,
        gender: i % 2 === 0 ? "FEMALE" : "MALE",
        status: "ACTIVE",
      },
      update: {},
    });
    await prisma.studentEnrollment.upsert({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: year.id } },
      create: {
        studentId: student.id,
        academicYearId: year.id,
        classId: kelas.id,
        status: "ACTIVE",
        enrollmentType: "NEW",
      },
      update: {},
    });
    students.push(student);
  }

  // Guardian linked to the first student + parent login.
  const guardian = await prisma.guardian.create({
    data: {
      schoolId: school.id,
      userId: parentUser.id,
      fullName: "Wali Siswa 01",
      phone: "081234567890",
    },
  });
  await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId: students[0].id, guardianId: guardian.id } },
    create: { studentId: students[0].id, guardianId: guardian.id, isPrimary: true },
    update: {},
  });

  const subject = await prisma.subject.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "MTK" } },
    create: {
      schoolId: school.id,
      code: "MTK",
      name: "Matematika",
      subjectType: "MANDATORY",
      isActive: true,
    },
    update: {},
  });

  const cp = await prisma.curriculumOutcome.upsert({
    where: { subjectId_code: { subjectId: subject.id, code: "CP-MTK-1" } },
    create: {
      subjectId: subject.id,
      code: "CP-MTK-1",
      description: "Peserta didik dapat melakukan operasi hitung bilangan cacah.",
      isActive: true,
    },
    update: {},
  });
  await prisma.learningObjective.upsert({
    where: { cpId_code: { cpId: cp.id, code: "TP-MTK-1.1" } },
    create: {
      cpId: cp.id,
      code: "TP-MTK-1.1",
      description: "Peserta didik dapat menjumlahkan bilangan cacah sampai 100.",
      isActive: true,
    },
    update: {},
  });

  const assignment = await prisma.teacherAssignment.upsert({
    where: {
      teacherId_semesterId_classId_subjectId: {
        teacherId: budi.id,
        semesterId: semester.id,
        classId: kelas.id,
        subjectId: subject.id,
      },
    },
    create: {
      teacherId: budi.id,
      academicYearId: year.id,
      semesterId: semester.id,
      classId: kelas.id,
      subjectId: subject.id,
      status: "ACTIVE",
    },
    update: { status: "ACTIVE" },
  });

  const formatif = await prisma.assessmentCategory.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "Formatif" } },
    create: { schoolId: school.id, name: "Formatif", isActive: true },
    update: {},
  });
  const sumatif = await prisma.assessmentCategory.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "Sumatif" } },
    create: { schoolId: school.id, name: "Sumatif", isActive: true },
    update: {},
  });

  let scheme = await prisma.gradingScheme.findFirst({
    where: { academicYearId: year.id, semesterId: semester.id },
    include: { weights: true },
  });
  if (!scheme) {
    scheme = await prisma.gradingScheme.create({
      data: { academicYearId: year.id, semesterId: semester.id, status: "DRAFT" },
      include: { weights: true },
    });
  }
  if (scheme.status === "DRAFT") {
    await prisma.gradingSchemeWeight.deleteMany({ where: { gradingSchemeId: scheme.id } });
    await prisma.gradingSchemeWeight.createMany({
      data: [
        { gradingSchemeId: scheme.id, categoryId: formatif.id, weight: 20 },
        { gradingSchemeId: scheme.id, categoryId: sumatif.id, weight: 80 },
      ],
    });
    await prisma.gradingScheme.update({
      where: { id: scheme.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  }

  await prisma.kktpConfiguration.upsert({
    where: {
      academicYearId_semesterId_subjectId: {
        academicYearId: year.id,
        semesterId: semester.id,
        subjectId: subject.id,
      },
    },
    create: {
      academicYearId: year.id,
      semesterId: semester.id,
      subjectId: subject.id,
      threshold: 75,
    },
    update: { threshold: 75 },
  });

  // Two published assessments with deterministic scores.
  const rand = mulberry32(42);
  const assessmentsData = [
    { title: "UH 1 - Formatif", categoryId: formatif.id },
    { title: "STS - Sumatif", categoryId: sumatif.id },
  ];
  for (const a of assessmentsData) {
    const existing = await prisma.assessment.findFirst({
      where: {
        teacherAssignmentId: assignment.id,
        title: a.title,
      },
    });
    const assessment =
      existing ??
      (await prisma.assessment.create({
        data: {
          teacherAssignmentId: assignment.id,
          semesterId: semester.id,
          classId: kelas.id,
          subjectId: subject.id,
          categoryId: a.categoryId,
          createdById: budi.id,
          title: a.title,
          assessmentDate: new Date("2026-09-15"),
          maxScore: 100,
          status: "PUBLISHED",
        },
      }));

    for (const student of students) {
      const score = 65 + Math.floor(rand() * 34); // 65..98
      await prisma.assessmentScore.upsert({
        where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
        create: {
          assessmentId: assessment.id,
          studentId: student.id,
          score,
          normalizedScore: score,
        },
        update: { score, normalizedScore: score },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`  school:      ${school.name}`);
  console.log(`  superadmin:  ${admin.email}`);
  console.log(`  teacher:     ${budi.email} (Budi Santoso)`);
  console.log(`  parent:      ${parentUser.email}`);
  console.log(`  year:        ${year.name} (${year.status}), semester: ${semester.name}`);
  console.log(`  class:       ${kelas.name} — 30 students, subject Matematika`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
