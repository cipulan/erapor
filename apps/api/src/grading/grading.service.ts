import { Injectable } from "@nestjs/common";
import { Request } from "express";
import Decimal from "decimal.js";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import {
  calculateGrade,
  validateWeightsTotal,
  type AchievementStatus,
} from "./grading-engine";
import { CreateGradingSchemeDto, ReplaceWeightsDto, UpsertKktpDto } from "./dto/grading.dto";

@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  // ------------------------------------------------------------------
  // Grading schemes
  // ------------------------------------------------------------------

  async listSchemes(user: SessionUser, filters: Record<string, string>) {
    const where: Record<string, unknown> = {
      academicYear: { schoolId: user.schoolId },
    };
    if (filters.academicYearId) {
      await this.policy.academicYearInSchool(user.schoolId, filters.academicYearId);
      where.academicYearId = filters.academicYearId;
    }
    if (filters.semesterId) {
      await this.policy.semesterInSchool(user.schoolId, filters.semesterId);
      where.semesterId = filters.semesterId;
    }
    const data = await this.prisma.gradingScheme.findMany({
      where,
      include: { weights: { include: { category: true } } },
      orderBy: [{ createdAt: "desc" }],
    });
    return data.map(toSchemeJson);
  }

  async createScheme(user: SessionUser, dto: CreateGradingSchemeDto, req: Request) {
    const year = await this.policy.academicYearInSchool(user.schoolId, dto.academicYearId);
    const semester = await this.policy.semesterInSchool(user.schoolId, dto.semesterId);
    if (semester.academicYearId !== year.id) {
      throw Errors.validation(ApiErrorCode.INVALID_SEMESTER, "Semester tidak termasuk dalam tahun ajaran tersebut.");
    }
    const dup = await this.prisma.gradingScheme.findFirst({
      where: { academicYearId: year.id, semesterId: semester.id },
      select: { id: true },
    });
    if (dup) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Skema penilaian untuk semester ini sudah ada.");
    }
    const scheme = await this.prisma.gradingScheme.create({
      data: { academicYearId: year.id, semesterId: semester.id, status: "DRAFT" },
      include: { weights: true },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.GRADING_SCHEME_CREATE,
      entityType: "GradingScheme",
      entityId: scheme.id,
      afterJson: toSchemeJson(scheme) as Record<string, unknown>,
    });
    return toSchemeJson(scheme);
  }

  /** Replaces all weights. Draft schemes only (BR-005). */
  async replaceWeights(user: SessionUser, schemeId: string, dto: ReplaceWeightsDto, req: Request) {
    const scheme = await this.policy.gradingSchemeInSchool(user.schoolId, schemeId);
    if (scheme.status !== "DRAFT") {
      throw Errors.conflict(
        ApiErrorCode.GRADING_SCHEME_PUBLISHED,
        "Skema yang sudah dipublish tidak dapat diubah. Buat skema baru bila perlu.",
      );
    }

    const categoryIds = dto.weights.map((w) => w.categoryId);
    if (new Set(categoryIds).size !== categoryIds.length) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Kategori tidak boleh duplikat dalam satu skema.");
    }
    const categories = await this.prisma.assessmentCategory.findMany({
      where: { id: { in: categoryIds }, schoolId: user.schoolId, isActive: true },
      select: { id: true },
    });
    if (categories.length !== categoryIds.length) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Sebagian kategori tidak valid, tidak aktif, atau di luar sekolah ini.",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.gradingSchemeWeight.deleteMany({ where: { gradingSchemeId: scheme.id } });
      for (const w of dto.weights) {
        await tx.gradingSchemeWeight.create({
          data: {
            gradingSchemeId: scheme.id,
            categoryId: w.categoryId,
            weight: new Decimal(w.weight),
          },
        });
      }
      return tx.gradingScheme.findUniqueOrThrow({
        where: { id: scheme.id },
        include: { weights: { include: { category: true } } },
      });
    });

    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.GRADING_SCHEME_WEIGHTS_UPDATE,
      entityType: "GradingScheme",
      entityId: scheme.id,
      afterJson: { weights: dto.weights },
    });
    return toSchemeJson(updated);
  }

  /** Publishes a scheme. Total weight must equal exactly 100 (BR-005). */
  async publishScheme(user: SessionUser, schemeId: string, req: Request) {
    const scheme = await this.policy.gradingSchemeInSchool(user.schoolId, schemeId);
    if (scheme.status === "PUBLISHED") {
      return toSchemeJson(scheme);
    }
    if (scheme.status !== "DRAFT") {
      throw Errors.conflict(
        ApiErrorCode.GRADING_SCHEME_PUBLISHED,
        "Hanya skema berstatus draft yang dapat dipublish.",
      );
    }
    if (scheme.weights.length === 0) {
      throw Errors.conflict(ApiErrorCode.INVALID_WEIGHT_TOTAL, "Skema belum memiliki bobot kategori.");
    }
    if (!validateWeightsTotal(scheme.weights.map((w) => ({ weight: w.weight })))) {
      const total = scheme.weights
        .reduce((acc, w) => acc.plus(new Decimal(w.weight.toString())), new Decimal(0))
        .toString();
      throw Errors.conflict(
        ApiErrorCode.INVALID_WEIGHT_TOTAL,
        `Total bobot harus tepat 100. Saat ini: ${total}.`,
        { total },
      );
    }

    const published = await this.prisma.gradingScheme.update({
      where: { id: scheme.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: { weights: { include: { category: true } } },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.GRADING_SCHEME_PUBLISH,
      entityType: "GradingScheme",
      entityId: published.id,
      beforeJson: { status: "DRAFT" },
      afterJson: { status: "PUBLISHED" },
    });
    return toSchemeJson(published);
  }

  // ------------------------------------------------------------------
  // KKTP
  // ------------------------------------------------------------------

  async listKktp(user: SessionUser, filters: Record<string, string>) {
    const where: Record<string, unknown> = {
      academicYear: { schoolId: user.schoolId },
    };
    if (filters.academicYearId) {
      await this.policy.academicYearInSchool(user.schoolId, filters.academicYearId);
      where.academicYearId = filters.academicYearId;
    }
    if (filters.semesterId) {
      await this.policy.semesterInSchool(user.schoolId, filters.semesterId);
      where.semesterId = filters.semesterId;
    }
    if (filters.subjectId) {
      await this.policy.subjectInSchool(user.schoolId, filters.subjectId);
      where.subjectId = filters.subjectId;
    }
    const data = await this.prisma.kktpConfiguration.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });
    return data.map(toKktpJson);
  }

  async upsertKktp(user: SessionUser, dto: UpsertKktpDto, req: Request) {
    const year = await this.policy.academicYearInSchool(user.schoolId, dto.academicYearId);
    const semester = await this.policy.semesterInSchool(user.schoolId, dto.semesterId);
    if (semester.academicYearId !== year.id) {
      throw Errors.validation(ApiErrorCode.INVALID_SEMESTER, "Semester tidak termasuk dalam tahun ajaran tersebut.");
    }
    await this.policy.subjectInSchool(user.schoolId, dto.subjectId);

    const kktp = await this.prisma.kktpConfiguration.upsert({
      where: {
        academicYearId_semesterId_subjectId: {
          academicYearId: year.id,
          semesterId: semester.id,
          subjectId: dto.subjectId,
        },
      },
      create: {
        academicYearId: year.id,
        semesterId: semester.id,
        subjectId: dto.subjectId,
        threshold: new Decimal(dto.threshold),
        description: dto.description?.trim() || null,
      },
      update: {
        threshold: new Decimal(dto.threshold),
        description: dto.description?.trim() || null,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.KKTP_UPSERT,
      entityType: "KktpConfiguration",
      entityId: kktp.id,
      afterJson: toKktpJson(kktp) as Record<string, unknown>,
    });
    return toKktpJson(kktp);
  }

  // ------------------------------------------------------------------
  // Grade preview: GET /grading/students/:studentId
  // ------------------------------------------------------------------

  async previewStudentGrade(
    user: SessionUser,
    studentId: string,
    academicYearId: string,
    semesterId: string,
    subjectId: string,
  ) {
    const student = await this.policy.studentInSchool(user.schoolId, studentId);
    const year = await this.policy.academicYearInSchool(user.schoolId, academicYearId);
    const semester = await this.policy.semesterInSchool(user.schoolId, semesterId);
    if (semester.academicYearId !== year.id) {
      throw Errors.validation(ApiErrorCode.INVALID_SEMESTER, "Semester tidak termasuk dalam tahun ajaran tersebut.");
    }
    const subject = await this.policy.subjectInSchool(user.schoolId, subjectId);

    // Scope checks per authorization-matrix §4 (grading preview row).
    if (user.role === "TEACHER") {
      const ids = await this.policy.teacherStudentIds(user.schoolId, user.id, year.id);
      if (!ids.includes(student.id)) throw Errors.notFound("Siswa");
      await this.policy.requireTeacherAssignmentScope(user.id, {
        semesterId: semester.id,
        subjectId: subject.id,
      });
    } else if (user.role === "PARENT") {
      await this.policy.requireParentStudent(user.id, user.schoolId, student.id);
      const publishedReport = await this.prisma.reportCard.findFirst({
        where: {
          studentId: student.id,
          academicYearId: year.id,
          semesterId: semester.id,
          status: "PUBLISHED",
        },
        select: { id: true },
      });
      if (!publishedReport) {
        throw Errors.forbidden("Pratinjau nilai hanya tersedia setelah rapor dipublikasikan.");
      }
    }

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, academicYearId: year.id, status: "ACTIVE" },
    });
    if (!enrollment) {
      throw Errors.validation(
        ApiErrorCode.REPORT_NOT_READY,
        "Siswa belum terdaftar aktif di tahun ajaran ini.",
      );
    }

    const scheme = await this.prisma.gradingScheme.findFirst({
      where: { academicYearId: year.id, semesterId: semester.id, status: "PUBLISHED" },
      include: { weights: true },
    });
    if (!scheme) {
      return {
        studentId: student.id,
        academicYearId: year.id,
        semesterId: semester.id,
        subjectId: subject.id,
        status: "INCOMPLETE",
        categoryAverages: [],
        finalScore: null,
        kktpThreshold: null,
        achievement: "NOT_ASSESSED" as AchievementStatus,
        missingAssessments: [],
        incompleteReason: "NO_PUBLISHED_SCHEME",
      };
    }

    const assessments = await this.prisma.assessment.findMany({
      where: {
        semesterId: semester.id,
        classId: enrollment.classId,
        subjectId: subject.id,
        status: "PUBLISHED",
        category: { isActive: true },
        maxScore: { gt: 0 },
      },
      select: { id: true, categoryId: true, maxScore: true },
    });

    const scores = await this.prisma.assessmentScore.findMany({
      where: {
        studentId: student.id,
        assessmentId: { in: assessments.map((a) => a.id) },
      },
      select: { assessmentId: true, score: true },
    });
    const scoreMap: Record<string, Decimal.Value> = {};
    for (const s of scores) scoreMap[s.assessmentId] = s.score.toString();

    const kktp = await this.prisma.kktpConfiguration.findFirst({
      where: { academicYearId: year.id, semesterId: semester.id, subjectId: subject.id },
      select: { threshold: true },
    });

    const result = calculateGrade({
      weights: scheme.weights.map((w) => ({ categoryId: w.categoryId, weight: w.weight.toString() })),
      assessments: assessments.map((a) => ({
        id: a.id,
        categoryId: a.categoryId,
        maxScore: a.maxScore.toString(),
      })),
      scores: scoreMap,
      kktpThreshold: kktp ? kktp.threshold.toString() : null,
    });

    return {
      studentId: student.id,
      academicYearId: year.id,
      semesterId: semester.id,
      subjectId: subject.id,
      status: result.status,
      categoryAverages: result.categoryAverages.map((c) => ({
        categoryId: c.categoryId,
        average: toNumber2(c.average),
        weight: toNumber2(c.weight),
        weightedValue: toNumber2(c.weightedValue),
      })),
      finalScore: result.finalScore !== undefined ? toNumber2(result.finalScore) : null,
      kktpThreshold: kktp ? toNumber2(new Decimal(kktp.threshold.toString())) : null,
      achievement: result.achievement,
      missingAssessments: result.missingAssessments,
      ...(result.reason ? { incompleteReason: result.reason } : {}),
    };
  }
}

function toNumber2(d: Decimal): number {
  return Number(d.toDecimalPlaces(2).toString());
}

export function toSchemeJson(s: {
  id: string;
  academicYearId: string;
  semesterId: string;
  status: string;
  publishedAt: Date | null;
  weights: Array<{ id: string; categoryId: string; weight: unknown }>;
}) {
  return {
    id: s.id,
    academicYearId: s.academicYearId,
    semesterId: s.semesterId,
    status: s.status,
    publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
    weights: s.weights.map((w) => ({
      id: w.id,
      categoryId: w.categoryId,
      weight: Number(new Decimal(w.weight as Decimal.Value).toString()),
    })),
  };
}

export function toKktpJson(k: {
  id: string;
  academicYearId: string;
  semesterId: string;
  subjectId: string;
  threshold: unknown;
  description: string | null;
}) {
  return {
    id: k.id,
    academicYearId: k.academicYearId,
    semesterId: k.semesterId,
    subjectId: k.subjectId,
    threshold: Number(new Decimal(k.threshold as Decimal.Value).toString()),
    description: k.description,
  };
}
