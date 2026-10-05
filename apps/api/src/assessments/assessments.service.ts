import { Injectable } from "@nestjs/common";
import { Request } from "express";
import Decimal from "decimal.js";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import { normalizeScore } from "../grading/grading-engine";
import { BulkScoresDto, CreateAssessmentDto, ScoreItemDto, SetAssessmentTpsDto } from "./dto/assessment.dto";

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  async list(user: SessionUser, filters: Record<string, string>) {
    const and: Record<string, unknown>[] = [
      // School scoping through the assignment's class (BR-001).
      { teacherAssignment: { class: { schoolId: user.schoolId } } },
    ];
    if (user.role === "TEACHER") {
      const assignments = await this.policy.teacherAssignments(user.id);
      and.push({ teacherAssignmentId: { in: assignments.map((a) => a.id) } });
    }
    if (filters.semesterId) {
      await this.policy.semesterInSchool(user.schoolId, filters.semesterId);
      and.push({ semesterId: filters.semesterId });
    }
    if (filters.classId) {
      await this.policy.classInSchool(user.schoolId, filters.classId);
      and.push({ classId: filters.classId });
    }
    if (filters.subjectId) {
      await this.policy.subjectInSchool(user.schoolId, filters.subjectId);
      and.push({ subjectId: filters.subjectId });
    }
    if (filters.categoryId) {
      and.push({ categoryId: filters.categoryId });
    }
    if (filters.status) {
      and.push({ status: filters.status });
    }

    const data = await this.prisma.assessment.findMany({
      where: { AND: and },
      orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
    });
    return data.map(toAssessmentJson);
  }

  async create(user: SessionUser, dto: CreateAssessmentDto, req: Request) {
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { id: dto.teacherAssignmentId },
      include: { class: true },
    });
    if (!assignment || assignment.class.schoolId !== user.schoolId) {
      throw Errors.validation(ApiErrorCode.INVALID_TEACHER_ASSIGNMENT, "Penugasan mengajar tidak valid.");
    }
    if (user.role === "TEACHER") {
      if (assignment.teacherId !== user.id || assignment.status !== "ACTIVE") {
        throw Errors.forbidden("Asesmen hanya dapat dibuat untuk penugasan Anda sendiri.");
      }
    }
    if (
      assignment.semesterId !== dto.semesterId ||
      assignment.classId !== dto.classId ||
      assignment.subjectId !== dto.subjectId
    ) {
      throw Errors.validation(
        ApiErrorCode.INVALID_TEACHER_ASSIGNMENT,
        "Semester/kelas/mapel asesmen harus sesuai penugasan mengajar.",
      );
    }

    const category = await this.prisma.assessmentCategory.findFirst({
      where: { id: dto.categoryId, schoolId: user.schoolId, isActive: true },
    });
    if (!category) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Kategori penilaian tidak valid atau tidak aktif.");
    }
    if (dto.maxScore <= 0) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Nilai maksimum harus lebih dari 0.");
    }

    const tpLinks = await this.resolveTpLinks(dto.subjectId, dto.tpIds ?? []);

    const assessment = await this.prisma.assessment.create({
      data: {
        teacherAssignmentId: assignment.id,
        semesterId: dto.semesterId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        categoryId: category.id,
        createdById: user.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        assessmentDate: dto.assessmentDate ? new Date(dto.assessmentDate) : null,
        maxScore: new Decimal(dto.maxScore),
        status: dto.status ?? "DRAFT",
        learningObjectives: {
          create: tpLinks.map((l) => ({ cpId: l.cpId, tpId: l.tpId })),
        },
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.ASSESSMENT_CREATE,
      entityType: "Assessment",
      entityId: assessment.id,
      afterJson: toAssessmentJson(assessment) as Record<string, unknown>,
    });
    return toAssessmentJson(assessment);
  }

  async get(user: SessionUser, id: string) {
    const assessment = await this.scopedAssessment(user, id);
    const scores = await this.prisma.assessmentScore.findMany({
      where: { assessmentId: assessment.id },
      include: { student: { select: { id: true, fullName: true, nis: true } } },
    });
    const tps = await this.prisma.assessmentLearningObjective.findMany({
      where: { assessmentId: assessment.id },
      include: { tp: { select: { id: true, code: true, description: true, cpId: true } } },
      orderBy: { tp: { code: "asc" } },
    });
    return {
      ...toAssessmentJson(assessment),
      tps: tps
        .filter((l) => l.tp)
        .map((l) => ({
          id: l.tp!.id,
          code: l.tp!.code,
          description: l.tp!.description,
          cpId: l.tp!.cpId,
        })),
      scores: scores.map(toScoreJson),
    };
  }

  /**
   * Mengganti daftar TP yang diukur oleh asesmen. TP harus aktif dan
   * milik mata pelajaran yang sama dengan asesmen.
   */
  async setTps(user: SessionUser, id: string, dto: SetAssessmentTpsDto, req: Request) {
    const assessment = await this.scopedAssessment(user, id);
    const tpLinks = await this.resolveTpLinks(assessment.subjectId, dto.tpIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.assessmentLearningObjective.deleteMany({
        where: { assessmentId: assessment.id },
      });
      if (tpLinks.length > 0) {
        await tx.assessmentLearningObjective.createMany({
          data: tpLinks.map((l) => ({
            assessmentId: assessment.id,
            cpId: l.cpId,
            tpId: l.tpId,
          })),
        });
      }
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.ASSESSMENT_TPS_UPDATE,
      entityType: "Assessment",
      entityId: assessment.id,
      afterJson: { assessmentId: assessment.id, tpIds: tpLinks.map((l) => l.tpId) },
    });
    return this.get(user, id);
  }

  /**
   * Validasi daftar TP: harus ada, aktif, dan milik mapel yang sama.
   * Mengembalikan pasangan cpId/tpId untuk penulisan relasi.
   */
  private async resolveTpLinks(
    subjectId: string,
    tpIds: string[],
  ): Promise<Array<{ cpId: string; tpId: string }>> {
    const unique = [...new Set(tpIds)];
    if (unique.length === 0) return [];
    const tps = await this.prisma.learningObjective.findMany({
      where: { id: { in: unique } },
      include: { cp: { select: { id: true, subjectId: true } } },
    });
    if (tps.length !== unique.length) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Sebagian TP tidak ditemukan.");
    }
    for (const tp of tps) {
      if (!tp.isActive) {
        throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, `TP ${tp.code} sudah tidak aktif.`, {
          tpId: tp.id,
        });
      }
      if (tp.cp.subjectId !== subjectId) {
        throw Errors.validation(
          ApiErrorCode.VALIDATION_ERROR,
          `TP ${tp.code} bukan milik mata pelajaran asesmen ini.`,
          { tpId: tp.id },
        );
      }
    }
    return tps.map((tp) => ({ cpId: tp.cp.id, tpId: tp.id }));
  }

  async listScores(user: SessionUser, id: string) {
    const assessment = await this.scopedAssessment(user, id);
    const scores = await this.prisma.assessmentScore.findMany({
      where: { assessmentId: assessment.id },
      include: { student: { select: { id: true, fullName: true, nis: true } } },
      orderBy: { student: { fullName: "asc" } },
    });
    return scores.map(toScoreJson);
  }

  /**
   * Bulk score entry, executed transactionally. Every score is validated:
   * student enrolled in the assessment class/year, 0 <= score <= maxScore.
   */
  async replaceScores(user: SessionUser, id: string, dto: BulkScoresDto, req: Request) {
    const assessment = await this.scopedAssessment(user, id);
    if (assessment.status === "CLOSED") {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Asesmen sudah ditutup; nilai tidak dapat diubah.");
    }
    const maxScore = new Decimal(assessment.maxScore.toString());

    const studentIds = dto.scores.map((s) => s.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Terdapat studentId duplikat dalam daftar nilai.");
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        studentId: { in: studentIds },
        classId: assessment.classId,
        academicYearId: assessment.teacherAssignment.academicYearId,
        status: "ACTIVE",
      },
      select: { studentId: true },
    });
    const enrolled = new Set<string>(
      enrollments.map((e: { studentId: string }) => e.studentId),
    );

    for (const item of dto.scores) {
      validateScoreItem(item, enrolled, maxScore);
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const rows = [];
      for (const item of dto.scores) {
        const normalized = normalizeScore(item.score, maxScore);
        const row = await tx.assessmentScore.upsert({
          where: {
            assessmentId_studentId: { assessmentId: assessment.id, studentId: item.studentId },
          },
          create: {
            assessmentId: assessment.id,
            studentId: item.studentId,
            score: new Decimal(item.score),
            normalizedScore: normalized,
            note: item.note?.trim() || null,
          },
          update: {
            score: new Decimal(item.score),
            normalizedScore: normalized,
            note: item.note?.trim() || null,
          },
          include: { student: { select: { id: true, fullName: true, nis: true } } },
        });
        rows.push(row);
      }
      return rows;
    });

    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.SCORES_BULK_UPDATE,
      entityType: "AssessmentScore",
      entityId: assessment.id,
      afterJson: { assessmentId: assessment.id, count: saved.length },
    });
    return saved.map(toScoreJson);
  }

  /** Hapus satu nilai siswa. Asesmen CLOSED tidak bisa diubah. */
  async deleteScore(user: SessionUser, id: string, studentId: string, req: Request) {
    const assessment = await this.scopedAssessment(user, id);
    if (assessment.status === "CLOSED") {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Asesmen sudah ditutup; nilai tidak dapat dihapus.");
    }
    const existing = await this.prisma.assessmentScore.findUnique({
      where: { assessmentId_studentId: { assessmentId: assessment.id, studentId } },
      select: { id: true, score: true },
    });
    if (!existing) {
      throw Errors.notFound("Nilai");
    }
    await this.prisma.assessmentScore.delete({ where: { id: existing.id } });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.SCORE_DELETE,
      entityType: "AssessmentScore",
      entityId: existing.id,
      beforeJson: { assessmentId: assessment.id, studentId, score: existing.score.toString() },
    });
  }

  /** Applies pre-validated import rows (from the import preview token). */
  async applyImportRows(
    user: SessionUser,
    assessmentId: string,
    rows: Array<{ studentId: string; score: number; note?: string }>,
    req: Request,
  ) {
    const dto: BulkScoresDto = {
      scores: rows.map((r) => ({ studentId: r.studentId, score: r.score, note: r.note })),
    };
    return this.replaceScores(user, assessmentId, dto, req);
  }

  private async scopedAssessment(user: SessionUser, id: string) {
    if (user.role === "TEACHER") {
      return this.policy.requireTeacherOwnsAssessment(user.id, user.schoolId, id);
    }
    return this.policy.assessmentInSchool(user.schoolId, id);
  }
}

export function validateScoreItem(
  item: ScoreItemDto,
  enrolledStudentIds: Set<string>,
  maxScore: Decimal,
): void {
  if (!enrolledStudentIds.has(item.studentId)) {
    throw Errors.validation(
      ApiErrorCode.VALIDATION_ERROR,
      "Sebagian siswa tidak terdaftar aktif di kelas/tahun ajaran asesmen ini.",
      { studentId: item.studentId },
    );
  }
  const score = new Decimal(item.score);
  if (score.isNegative() || score.gt(maxScore)) {
    throw Errors.validation(
      ApiErrorCode.ASSESSMENT_SCORE_EXCEEDED_MAX,
      `Nilai harus antara 0 dan ${maxScore.toString()}.`,
      { studentId: item.studentId, score: item.score, maxScore: maxScore.toString() },
    );
  }
}

export function toAssessmentJson(a: {
  id: string;
  teacherAssignmentId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  categoryId: string;
  title: string;
  description: string | null;
  assessmentDate: Date | null;
  maxScore: unknown;
  status: string;
}) {
  return {
    id: a.id,
    teacherAssignmentId: a.teacherAssignmentId,
    semesterId: a.semesterId,
    classId: a.classId,
    subjectId: a.subjectId,
    categoryId: a.categoryId,
    title: a.title,
    description: a.description,
    assessmentDate: a.assessmentDate ? a.assessmentDate.toISOString().slice(0, 10) : null,
    maxScore: Number(new Decimal(a.maxScore as Decimal.Value).toString()),
    status: a.status,
  };
}

export function toScoreJson(s: {
  id: string;
  assessmentId: string;
  studentId: string;
  score: unknown;
  normalizedScore: unknown;
  note: string | null;
  student?: { id: string; fullName: string; nis: string | null };
}) {
  const base = {
    id: s.id,
    assessmentId: s.assessmentId,
    studentId: s.studentId,
    score: Number(new Decimal(s.score as Decimal.Value).toString()),
    normalizedScore: Number(new Decimal(s.normalizedScore as Decimal.Value).toString()),
    note: s.note,
  };
  // Extra nested student info (not in the contract) helps the score grid UI.
  return s.student ? { ...base, student: s.student } : base;
}
