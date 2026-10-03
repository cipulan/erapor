import { Global, Injectable, Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Errors } from "../common/errors/api-exception";
import type { SessionUser } from "../auth/types/session-user";

export interface AssignmentScope {
  semesterId?: string;
  classId?: string;
  subjectId?: string;
}

/**
 * Server-side resource authorization (authorization-matrix §5–§7).
 *
 * Layer order: AuthGuard (session) -> RoleGuard (role) -> ResourcePolicy
 * (this service, called from domain services) -> Service -> Repository.
 *
 * Convention: cross-scope reads resolve to 404 (hide existence), while
 * authenticated-but-not-permitted writes resolve to 403.
 */
@Injectable()
export class ResourcePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // School-scoped loaders: 404 when the record is missing or belongs
  // to another school. Never trust a client-supplied schoolId (BR-001).
  // ------------------------------------------------------------------

  async studentInSchool(schoolId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
    });
    if (!student) throw Errors.notFound("Siswa");
    return student;
  }

  async classInSchool(schoolId: string, classId: string) {
    const klass = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
    });
    if (!klass) throw Errors.notFound("Kelas");
    return klass;
  }

  async subjectInSchool(schoolId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, schoolId },
    });
    if (!subject) throw Errors.notFound("Mata pelajaran");
    return subject;
  }

  async academicYearInSchool(schoolId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
    });
    if (!year) throw Errors.notFound("Tahun ajaran");
    return year;
  }

  async semesterInSchool(schoolId: string, semesterId: string) {
    const semester = await this.prisma.semester.findFirst({
      where: { id: semesterId, academicYear: { schoolId } },
      include: { academicYear: true },
    });
    if (!semester) throw Errors.notFound("Semester");
    return semester;
  }

  async gradingSchemeInSchool(schoolId: string, schemeId: string) {
    const scheme = await this.prisma.gradingScheme.findFirst({
      where: { id: schemeId, academicYear: { schoolId } },
      include: { weights: true },
    });
    if (!scheme) throw Errors.notFound("Skema penilaian");
    return scheme;
  }

  async assessmentInSchool(schoolId: string, assessmentId: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        teacherAssignment: { class: { schoolId } },
      },
      include: {
        teacherAssignment: true,
        category: true,
        subject: true,
        class: true,
        semester: true,
      },
    });
    if (!assessment) throw Errors.notFound("Asesmen");
    return assessment;
  }

  async reportCardInSchool(schoolId: string, reportCardId: string) {
    const report = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        student: { schoolId },
      },
      include: { subjects: true, student: true },
    });
    if (!report) throw Errors.notFound("Rapor");
    return report;
  }

  async cpInSchool(schoolId: string, cpId: string) {
    const cp = await this.prisma.curriculumOutcome.findFirst({
      where: { id: cpId, subject: { schoolId } },
      include: { subject: true },
    });
    if (!cp) throw Errors.notFound("CP");
    return cp;
  }

  // ------------------------------------------------------------------
  // Teacher scope (authorization-matrix §2): only through active
  // teacher assignments.
  // ------------------------------------------------------------------

  async teacherAssignments(
    userId: string,
    scope: AssignmentScope = {},
  ): Promise<Array<{ id: string; classId: string; teacherId: string; status: string }>> {
    const rows: Array<{ id: string; classId: string; teacherId: string; status: string }> =
      await this.prisma.teacherAssignment.findMany({
        where: {
          teacherId: userId,
          status: "ACTIVE",
          ...(scope.semesterId ? { semesterId: scope.semesterId } : {}),
          ...(scope.classId ? { classId: scope.classId } : {}),
          ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
        },
      });
    return rows;
  }

  /** 403 unless the teacher holds an active assignment covering the scope. */
  async requireTeacherAssignmentScope(userId: string, scope: AssignmentScope) {
    const found = await this.prisma.teacherAssignment.findFirst({
      where: {
        teacherId: userId,
        status: "ACTIVE",
        ...(scope.semesterId ? { semesterId: scope.semesterId } : {}),
        ...(scope.classId ? { classId: scope.classId } : {}),
        ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
      },
      select: { id: true },
    });
    if (!found) {
      throw Errors.forbidden(
        "Anda tidak memiliki penugasan mengajar untuk data ini.",
      );
    }
    return found;
  }

  /** 404 unless the assessment belongs to one of the teacher's assignments. */
  async requireTeacherOwnsAssessment(userId: string, schoolId: string, assessmentId: string) {
    const assessment = await this.assessmentInSchool(schoolId, assessmentId);
    if (assessment.teacherAssignment.teacherId !== userId) {
      // Hide existence across teacher scopes.
      throw Errors.notFound("Asesmen");
    }
    return assessment;
  }

  /** Class ids where the teacher has an active assignment (optionally per semester). */
  async teacherClassIds(userId: string, semesterId?: string): Promise<string[]> {
    const rows: Array<{ classId: string }> = await this.prisma.teacherAssignment.findMany({
      where: {
        teacherId: userId,
        status: "ACTIVE",
        ...(semesterId ? { semesterId } : {}),
      },
      select: { classId: true },
      distinct: ["classId"],
    });
    return rows.map((r) => r.classId);
  }

  /** Student ids enrolled in the teacher's classes for an academic year. */
  async teacherStudentIds(
    schoolId: string,
    userId: string,
    academicYearId?: string,
  ): Promise<string[]> {
    const classIds = await this.teacherClassIds(userId);
    if (classIds.length === 0) return [];
    const enrollments: Array<{ studentId: string }> = await this.prisma.studentEnrollment.findMany({
      where: {
        classId: { in: classIds },
        status: "ACTIVE",
        ...(academicYearId ? { academicYearId } : {}),
        student: { schoolId },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    return enrollments.map((e) => e.studentId);
  }

  /** Is the teacher the homeroom teacher of the class, or assigned to it? */
  async teacherCoversClass(userId: string, classId: string, semesterId: string): Promise<boolean> {
    const klass = await this.prisma.class.findFirst({
      where: { id: classId },
      select: { homeroomTeacherId: true },
    });
    if (klass?.homeroomTeacherId === userId) return true;
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { teacherId: userId, classId, semesterId, status: "ACTIVE" },
      select: { id: true },
    });
    return !!assignment;
  }

  // ------------------------------------------------------------------
  // Parent scope (authorization-matrix §2): only linked students and
  // their published reports.
  // ------------------------------------------------------------------

  /** Student ids linked to the parent's user account via guardians. */
  async parentStudentIds(userId: string, schoolId: string): Promise<string[]> {
    const links: Array<{ studentId: string }> = await this.prisma.studentGuardian.findMany({
      where: {
        guardian: { userId, schoolId },
        student: { schoolId },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    return links.map((l) => l.studentId);
  }

  /** 404 unless the student is linked to the parent. */
  async requireParentStudent(userId: string, schoolId: string, studentId: string) {
    await this.studentInSchool(schoolId, studentId);
    const link = await this.prisma.studentGuardian.findFirst({
      where: {
        studentId,
        guardian: { userId, schoolId },
      },
      select: { studentId: true },
    });
    if (!link) throw Errors.notFound("Siswa");
    return link;
  }

  // ------------------------------------------------------------------
  // Report access helpers.
  // ------------------------------------------------------------------

  /**
   * Read access to a report card:
   * - SUPERADMIN: any report in the school;
   * - TEACHER: homeroom teacher of the class or assigned to class+semester;
   * - PARENT: linked student AND report is PUBLISHED.
   */
  async requireReportReadAccess(user: SessionUser, reportCardId: string) {
    const report = await this.reportCardInSchool(user.schoolId, reportCardId);

    if (user.role === "SUPERADMIN") return report;

    if (user.role === "TEACHER") {
      const covers = await this.teacherCoversClass(user.id, report.classId, report.semesterId);
      if (!covers) throw Errors.notFound("Rapor");
      return report;
    }

    // PARENT
    await this.requireParentStudent(user.id, user.schoolId, report.studentId);
    if (report.status !== "PUBLISHED") {
      throw Errors.forbidden("Rapor belum dipublikasikan.");
    }
    return report;
  }

  /**
   * Review/lock access: SUPERADMIN, or a teacher covering the class
   * (homeroom or assigned). Parents never.
   */
  async requireReportReviewAccess(user: SessionUser, reportCardId: string) {
    const report = await this.reportCardInSchool(user.schoolId, reportCardId);
    if (user.role === "SUPERADMIN") return report;
    if (user.role === "TEACHER") {
      const covers = await this.teacherCoversClass(user.id, report.classId, report.semesterId);
      if (!covers) throw Errors.forbidden("Anda bukan wali kelas/pengajar kelas ini.");
      return report;
    }
    throw Errors.forbidden();
  }
}

@Global()
@Module({
  providers: [ResourcePolicyService],
  exports: [ResourcePolicyService],
})
export class AuthorizationModule {}
