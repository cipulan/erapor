import { Injectable } from "@nestjs/common";
import { Request } from "express";
import Decimal from "decimal.js";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import { Paginated, PaginationParams, buildPaginated } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { calculateGrade } from "../grading/grading-engine";
import { generateSubjectDescription, generateTpDescription } from "../grading/description-generator";
import { CreateRevisionDto, GenerateReportCardDto, UpdateSubjectDescriptionDto } from "./dto/report.dto";

const MUTABLE_STATUSES = ["DRAFT", "REVIEW", "LOCKED", "REVISION"];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  async list(
    user: SessionUser,
    params: PaginationParams,
    filters: Record<string, string>,
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = {
      student: { schoolId: user.schoolId },
    };
    if (filters.academicYearId) {
      await this.policy.academicYearInSchool(user.schoolId, filters.academicYearId);
      where.academicYearId = filters.academicYearId;
    }
    if (filters.semesterId) {
      await this.policy.semesterInSchool(user.schoolId, filters.semesterId);
      where.semesterId = filters.semesterId;
    }
    if (filters.classId) {
      await this.policy.classInSchool(user.schoolId, filters.classId);
      where.classId = filters.classId;
    }
    if (user.role === "TEACHER") {
      const classIds = await this.policy.teacherClassIds(user.id);
      if (filters.classId && !classIds.includes(filters.classId)) {
        return buildPaginated([], 0, params); // hide other teachers' classes
      }
      where.classId = filters.classId ?? { in: classIds };
      if (filters.studentId) {
        const ids = await this.policy.teacherStudentIds(user.schoolId, user.id);
        if (!ids.includes(filters.studentId)) throw Errors.notFound("Rapor");
        where.studentId = filters.studentId;
      }
    } else if (user.role === "PARENT") {
      const studentIds = await this.policy.parentStudentIds(user.id, user.schoolId);
      where.studentId = filters.studentId ?? { in: studentIds };
      if (filters.studentId && !studentIds.includes(filters.studentId)) {
        throw Errors.notFound("Rapor");
      }
      // Parents only ever see published reports.
      where.status = "PUBLISHED";
    } else {
      if (filters.studentId) where.studentId = filters.studentId;
      if (filters.status) where.status = filters.status;
    }
    if (user.role === "TEACHER" && filters.status) where.status = filters.status;

    const [total, data] = await Promise.all([
      this.prisma.reportCard.count({ where }),
      this.prisma.reportCard.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip: params.skip,
        take: params.limit,
      }),
    ]);
    return buildPaginated(data.map(toReportJson), total, params);
  }

  async get(user: SessionUser, id: string) {
    const report = await this.policy.requireReportReadAccess(user, id);
    return toReportDetailJson(report);
  }

  /**
   * Assembles the immutable snapshot data needed for PDF rendering.
   * All names come from the snapshot or current master data; scores
   * always come from the snapshot (BR-006).
   */
  async getPdfData(user: SessionUser, id: string) {
    const report = await this.policy.requireReportReadAccess(user, id);

    const [school, student, klass, semester, year] = await Promise.all([
      this.prisma.school.findUniqueOrThrow({ where: { id: user.schoolId } }),
      this.prisma.student.findUniqueOrThrow({ where: { id: report.studentId } }),
      this.prisma.class.findUniqueOrThrow({
        where: { id: report.classId },
        include: { homeroomTeacher: { select: { fullName: true } } },
      }),
      this.prisma.semester.findUniqueOrThrow({ where: { id: report.semesterId } }),
      this.prisma.academicYear.findUniqueOrThrow({ where: { id: report.academicYearId } }),
    ]);

    return {
      schoolName: school.name,
      schoolAddress: school.address,
      studentName: student.fullName,
      nis: student.nis,
      nisn: student.nisn,
      className: klass.name,
      gradeLevel: klass.gradeLevel,
      semesterName: semester.name,
      academicYearName: year.name,
      version: report.version,
      status: report.status,
      publishedAt: report.publishedAt ? report.publishedAt.toISOString() : null,
      homeroomTeacherName: klass.homeroomTeacher?.fullName ?? null,
      headmasterName: school.headmasterName ?? null,
      cocurricularDescription: report.cocurricularDescription,
      homeroomNotes: report.homeroomNotes,
      sickDays: report.sickDays,
      permissionDays: report.permissionDays,
      unexcusedDays: report.unexcusedDays,
      extracurriculars: report.extracurriculars.map((e) => ({
        name: e.name,
        predicate: e.predicate,
        description: e.description,
      })),
      subjects: report.subjects.map((s) => ({
        subjectName: s.subjectName,
        finalScore: Math.round(Number(new Decimal(s.finalScore.toString()).toString())),
        kktpThreshold:
          s.kktpThreshold == null ? null : Number(new Decimal(s.kktpThreshold.toString()).toString()),
        achievement: s.achievement,
        description: s.description,
      })),
    };
  }

  /**
   * Generates a report card snapshot in a single DB transaction.
   * Rejects when any required subject is INCOMPLETE; refuses to silently
   * overwrite an existing draft/review/locked/published report (idempotency).
   */
  async generate(user: SessionUser, dto: GenerateReportCardDto, req: Request) {
    const computed = await this.computeReportData(user, dto.studentId, dto.academicYearId, dto.semesterId);

    const existing = await this.prisma.reportCard.findMany({
      where: {
        studentId: computed.student.id,
        academicYearId: computed.year.id,
        semesterId: computed.semester.id,
      },
      select: { status: true, version: true },
    });
    if (existing.some((r) => MUTABLE_STATUSES.includes(r.status))) {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        "Rapor untuk siswa/semester ini sudah ada (draft/review/locked). Selesaikan atau hapus alurnya terlebih dahulu.",
      );
    }
    if (existing.some((r) => r.status === "PUBLISHED")) {
      throw Errors.conflict(
        ApiErrorCode.REPORT_ALREADY_PUBLISHED,
        "Rapor sudah dipublikasikan. Gunakan alur revisi untuk koreksi.",
      );
    }
    const version = existing.reduce((m, r) => Math.max(m, r.version), 0) + 1;

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reportCard.create({
        data: {
          studentId: computed.student.id,
          academicYearId: computed.year.id,
          semesterId: computed.semester.id,
          classId: computed.enrollment.classId,
          version,
          status: "DRAFT",
          generatedAt: new Date(),
        },
      });
      for (const s of computed.subjects) {
        await tx.reportCardSubject.create({
          data: {
            reportCardId: created.id,
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            finalScore: s.finalScore,
            kktpThreshold: s.kktpThreshold,
            achievement: s.achievement,
            description: s.description,
            snapshotJson: s.snapshotJson as unknown as object,
          },
        });
      }
      return tx.reportCard.findUniqueOrThrow({
        where: { id: created.id },
        include: { subjects: true, extracurriculars: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      });
    });

    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.REPORT_GENERATE,
      entityType: "ReportCard",
      entityId: report.id,
      afterJson: { version, subjectCount: computed.subjects.length },
    });
    return toReportDetailJson(report);
  }

  async review(user: SessionUser, id: string, req: Request) {
    const report = await this.policy.requireReportReviewAccess(user, id);
    if (report.status !== "DRAFT" && report.status !== "REVISION") {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Hanya rapor draft/revisi yang dapat direview.");
    }
    const updated = await this.prisma.reportCard.update({
      where: { id: report.id },
      data: { status: "REVIEW", reviewedAt: new Date(), reviewedById: user.id },
      include: { subjects: true, extracurriculars: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
    await this.audit.log({
      req, schoolId: user.schoolId, actorUserId: user.id,
      action: AuditAction.REPORT_REVIEW, entityType: "ReportCard", entityId: report.id,
      beforeJson: { status: report.status }, afterJson: { status: "REVIEW" },
    });
    return toReportDetailJson(updated);
  }

  async lock(user: SessionUser, id: string, req: Request) {
    const report = await this.policy.requireReportReviewAccess(user, id);
    if (report.status !== "REVIEW") {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Hanya rapor yang sudah direview yang dapat dikunci.");
    }
    const updated = await this.prisma.reportCard.update({
      where: { id: report.id },
      data: { status: "LOCKED", lockedAt: new Date(), lockedById: user.id },
      include: { subjects: true, extracurriculars: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
    await this.audit.log({
      req, schoolId: user.schoolId, actorUserId: user.id,
      action: AuditAction.REPORT_LOCK, entityType: "ReportCard", entityId: report.id,
      beforeJson: { status: "REVIEW" }, afterJson: { status: "LOCKED" },
    });
    return toReportDetailJson(updated);
  }

  /** Only SUPERADMIN (enforced by @Roles on the controller). */
  async publish(user: SessionUser, id: string, req: Request) {
    const report = await this.policy.reportCardInSchool(user.schoolId, id);
    if (report.status === "PUBLISHED") {
      throw Errors.conflict(ApiErrorCode.REPORT_ALREADY_PUBLISHED, "Rapor sudah dipublikasikan.");
    }
    if (report.status !== "LOCKED") {
      throw Errors.conflict(ApiErrorCode.REPORT_NOT_LOCKED, "Rapor harus dikunci (locked) sebelum dipublikasikan.");
    }
    const updated = await this.prisma.reportCard.update({
      where: { id: report.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: user.id },
      include: { subjects: true, extracurriculars: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
    await this.audit.log({
      req, schoolId: user.schoolId, actorUserId: user.id,
      action: AuditAction.REPORT_PUBLISH, entityType: "ReportCard", entityId: report.id,
      beforeJson: { status: "LOCKED" }, afterJson: { status: "PUBLISHED" },
    });
    return toReportDetailJson(updated);
  }

  /**
   * Creates a new report version (status REVISION) from a PUBLISHED report.
   * The published version stays immutable; the new version recalculates the
   * snapshot from current data and re-enters the review/lock/publish flow.
   */
  async revision(user: SessionUser, id: string, dto: CreateRevisionDto, req: Request) {
    const source = await this.policy.reportCardInSchool(user.schoolId, id);
    if (source.status !== "PUBLISHED") {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        "Hanya rapor yang sudah dipublikasikan yang dapat direvisi.",
      );
    }
    if (user.role === "TEACHER") {
      const covers = await this.policy.teacherCoversClass(user.id, source.classId, source.semesterId);
      if (!covers) throw Errors.forbidden("Anda bukan wali kelas/pengajar kelas ini.");
    }

    const computed = await this.computeReportData(
      user, source.studentId, source.academicYearId, source.semesterId,
    );
    const maxVersion = await this.prisma.reportCard.aggregate({
      where: {
        studentId: source.studentId,
        academicYearId: source.academicYearId,
        semesterId: source.semesterId,
      },
      _max: { version: true },
    });
    const version = (maxVersion._max.version ?? 0) + 1;

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reportCard.create({
        data: {
          studentId: source.studentId,
          academicYearId: source.academicYearId,
          semesterId: source.semesterId,
          classId: source.classId,
          version,
          status: "REVISION",
          generatedAt: new Date(),
          notes: dto.reason.trim(),
        },
      });
      for (const s of computed.subjects) {
        await tx.reportCardSubject.create({
          data: {
            reportCardId: created.id,
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            finalScore: s.finalScore,
            kktpThreshold: s.kktpThreshold,
            achievement: s.achievement,
            description: s.description,
            snapshotJson: s.snapshotJson as unknown as object,
          },
        });
      }
      return tx.reportCard.findUniqueOrThrow({
        where: { id: created.id },
        include: { subjects: true, extracurriculars: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      });
    });

    await this.audit.log({
      req, schoolId: user.schoolId, actorUserId: user.id,
      action: AuditAction.REPORT_REVISION, entityType: "ReportCard", entityId: report.id,
      beforeJson: { sourceReportId: source.id, sourceVersion: source.version },
      afterJson: { version, reason: dto.reason.trim() },
    });
    return toReportDetailJson(report);
  }

  /**
   * Ubah manual deskripsi satu mapel pada rapor. Hanya untuk rapor yang
   * masih bisa diubah (DRAFT/REVIEW/REVISION); rapor PUBLISHED/LOCKED
   * dilindungi trigger immutability di database. Penanda sumber menjadi
   * MANUAL sehingga regenerate versi baru tidak relevan (tiap generate
   * membuat versi baru) dan UI bisa menampilkan badge.
   */
  async updateSubjectDescription(
    user: SessionUser,
    reportCardId: string,
    subjectId: string,
    dto: UpdateSubjectDescriptionDto,
    req: Request,
  ) {
    const report = await this.policy.reportCardInSchool(user.schoolId, reportCardId);
    this.requireDescriptionEditable(report.status);
    if (user.role === "TEACHER") {
      const covers = await this.policy.teacherCoversClass(user.id, report.classId, report.semesterId);
      if (!covers) throw Errors.forbidden("Anda bukan wali kelas/pengajar kelas ini.");
    }

    const row = await this.prisma.reportCardSubject.findUnique({
      where: { reportCardId_subjectId: { reportCardId: report.id, subjectId } },
    });
    if (!row) throw Errors.notFound("Mapel pada rapor");

    const updated = await this.prisma.reportCardSubject.update({
      where: { id: row.id },
      data: { description: dto.description.trim(), descriptionSource: "MANUAL" },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.REPORT_DESCRIPTION_UPDATE,
      entityType: "ReportCardSubject",
      entityId: row.id,
      beforeJson: { description: row.description, descriptionSource: row.descriptionSource },
      afterJson: { description: updated.description, descriptionSource: updated.descriptionSource },
    });
    return {
      id: updated.id,
      subjectId: updated.subjectId,
      description: updated.description,
      descriptionSource: updated.descriptionSource,
    };
  }

  /**
   * Kembalikan deskripsi satu mapel ke hasil generator otomatis
   * (dihitung ulang dari data nilai terkini).
   */
  async resetSubjectDescription(
    user: SessionUser,
    reportCardId: string,
    subjectId: string,
    req: Request,
  ) {
    const report = await this.policy.reportCardInSchool(user.schoolId, reportCardId);
    this.requireDescriptionEditable(report.status);
    if (user.role === "TEACHER") {
      const covers = await this.policy.teacherCoversClass(user.id, report.classId, report.semesterId);
      if (!covers) throw Errors.forbidden("Anda bukan wali kelas/pengajar kelas ini.");
    }

    const row = await this.prisma.reportCardSubject.findUnique({
      where: { reportCardId_subjectId: { reportCardId: report.id, subjectId } },
    });
    if (!row) throw Errors.notFound("Mapel pada rapor");

    // Hitung ulang dari data terkini; melempar ASSESSMENT_INCOMPLETE bila
    // nilai belum lengkap (perilaku sama seperti generate).
    const computed = await this.computeReportData(
      user, report.studentId, report.academicYearId, report.semesterId,
    );
    const fresh = computed.subjects.find((s) => s.subjectId === subjectId);
    if (!fresh) {
      throw Errors.notFound("Mapel pada perhitungan rapor terkini");
    }

    const updated = await this.prisma.reportCardSubject.update({
      where: { id: row.id },
      data: { description: fresh.description, descriptionSource: "AUTO" },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.REPORT_DESCRIPTION_RESET,
      entityType: "ReportCardSubject",
      entityId: row.id,
      beforeJson: { description: row.description, descriptionSource: row.descriptionSource },
      afterJson: { description: updated.description, descriptionSource: updated.descriptionSource },
    });
    return {
      id: updated.id,
      subjectId: updated.subjectId,
      description: updated.description,
      descriptionSource: updated.descriptionSource,
    };
  }

  private requireDescriptionEditable(status: string): void {
    if (!["DRAFT", "REVIEW", "REVISION"].includes(status)) {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        "Deskripsi hanya dapat diubah pada rapor berstatus draf/review/revisi.",
      );
    }
  }

  // ------------------------------------------------------------------
  // Shared computation used by generate() and revision().
  // ------------------------------------------------------------------

  /**
   * Menghitung nilai per TP untuk satu siswa: rata-rata skor ternormalisasi
   * (0-100) dari penilaian yang dikaitkan ke TP tersebut. TP yang tidak
   * punya nilai (siswa belum dinilai pada penilaian terkait) tidak disertakan.
   */
  private async computeTpScores(
    assessments: Array<{ id: string; tpIds: string[] }>,
    normalizedScores: Record<string, Decimal>,
  ): Promise<Array<{ tpId: string; code: string; description: string; score: Decimal }>> {
    const tpIds = [...new Set(assessments.flatMap((a) => a.tpIds))];
    if (tpIds.length === 0) return [];

    const tps = await this.prisma.learningObjective.findMany({
      where: { id: { in: tpIds }, isActive: true },
      include: { cp: { select: { code: true } } },
    });
    // Urut: kode CP lalu kode TP (stabil & mudah dibaca di rapor).
    tps.sort((a, b) => a.cp.code.localeCompare(b.cp.code) || a.code.localeCompare(b.code));

    const out: Array<{ tpId: string; code: string; description: string; score: Decimal }> = [];
    for (const tp of tps) {
      const values: Decimal[] = [];
      for (const a of assessments) {
        if (a.tpIds.includes(tp.id)) {
          const v = normalizedScores[a.id];
          if (v !== undefined) values.push(v);
        }
      }
      if (values.length === 0) continue;
      const avg = values.reduce((acc, v) => acc.plus(v), new Decimal(0)).div(values.length);
      out.push({ tpId: tp.id, code: tp.code, description: tp.description, score: avg });
    }
    return out;
  }

  private async computeReportData(
    user: SessionUser,
    studentId: string,
    academicYearId: string,
    semesterId: string,
  ) {
    const student = await this.policy.studentInSchool(user.schoolId, studentId);
    const year = await this.policy.academicYearInSchool(user.schoolId, academicYearId);
    const semester = await this.policy.semesterInSchool(user.schoolId, semesterId);
    if (semester.academicYearId !== year.id) {
      throw Errors.validation(ApiErrorCode.INVALID_SEMESTER, "Semester tidak termasuk dalam tahun ajaran tersebut.");
    }

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, academicYearId: year.id, status: "ACTIVE" },
    });
    if (!enrollment) {
      throw Errors.validation(ApiErrorCode.REPORT_NOT_READY, "Siswa belum terdaftar aktif di tahun ajaran ini.");
    }

    if (user.role === "TEACHER") {
      const covers = await this.policy.teacherCoversClass(user.id, enrollment.classId, semester.id);
      if (!covers) {
        throw Errors.forbidden("Anda tidak memiliki akses rapor untuk kelas ini.");
      }
    } else if (user.role === "PARENT") {
      throw Errors.forbidden();
    }

    const scheme = await this.prisma.gradingScheme.findFirst({
      where: { academicYearId: year.id, semesterId: semester.id, status: "PUBLISHED" },
      include: { weights: true },
    });
    if (!scheme) {
      throw Errors.validation(ApiErrorCode.REPORT_NOT_READY, "Skema penilaian untuk semester ini belum dipublish.", {
        reason: "NO_PUBLISHED_SCHEME",
      });
    }

    // Subjects taught in this class+semester (active assignments).
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { classId: enrollment.classId, semesterId: semester.id, status: "ACTIVE" },
      include: { subject: true },
      distinct: ["subjectId"],
    });
    const subjects = assignments.map((a) => a.subject).filter((s) => s.isActive);
    if (subjects.length === 0) {
      throw Errors.validation(ApiErrorCode.REPORT_NOT_READY, "Belum ada mata pelajaran yang diajar di kelas ini.");
    }

    const computedSubjects: Array<{
      subjectId: string;
      subjectName: string;
      finalScore: Decimal;
      kktpThreshold: Decimal | null;
      achievement: "ACHIEVED" | "NOT_ACHIEVED" | "NOT_ASSESSED";
      description: string;
      snapshotJson: Record<string, unknown>;
    }> = [];
    const incomplete: Array<Record<string, unknown>> = [];

    for (const subject of subjects) {
      const assessments = await this.prisma.assessment.findMany({
        where: {
          semesterId: semester.id,
          classId: enrollment.classId,
          subjectId: subject.id,
          status: "PUBLISHED",
          category: { isActive: true },
          maxScore: { gt: 0 },
        },
        select: {
          id: true,
          categoryId: true,
          maxScore: true,
          learningObjectives: { select: { tpId: true } },
        },
      });
      const scores = await this.prisma.assessmentScore.findMany({
        where: { studentId: student.id, assessmentId: { in: assessments.map((a) => a.id) } },
        select: { assessmentId: true, score: true, normalizedScore: true },
      });
      const scoreMap: Record<string, Decimal.Value> = {};
      const normalizedMap: Record<string, Decimal> = {};
      for (const s of scores) {
        scoreMap[s.assessmentId] = s.score.toString();
        normalizedMap[s.assessmentId] = new Decimal(s.normalizedScore.toString());
      }

      const kktp = await this.prisma.kktpConfiguration.findFirst({
        where: { academicYearId: year.id, semesterId: semester.id, subjectId: subject.id },
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

      if (result.status !== "COMPLETE" || !result.finalScore) {
        incomplete.push({
          subjectId: subject.id,
          subjectName: subject.name,
          reason: result.reason,
          missingAssessments: result.missingAssessments,
        });
        continue;
      }

      const finalScore = result.finalScore;

      // Nilai per TP: rata-rata skor ternormalisasi dari penilaian yang
      // dikaitkan ke TP tersebut (hanya TP yang punya nilai yang disebut).
      const tpScores = await this.computeTpScores(
        assessments.map((a) => ({
          id: a.id,
          tpIds: a.learningObjectives.map((l) => l.tpId).filter((t): t is string => t !== null),
        })),
        normalizedMap,
      );

      const tpDescription =
        tpScores.length > 0 && kktp
          ? generateTpDescription({
              studentName: student.fullName,
              tpScores: tpScores.map((t) => ({ code: t.code, description: t.description, score: t.score })),
              kktpThreshold: kktp.threshold.toString(),
            })
          : null;
      const description =
        tpDescription ??
        generateSubjectDescription({
          studentName: student.fullName,
          subjectName: subject.name,
          finalScore,
          achievement: result.achievement,
          kktpThreshold: kktp ? kktp.threshold.toString() : null,
        });

      computedSubjects.push({
        subjectId: subject.id,
        subjectName: subject.name,
        finalScore,
        kktpThreshold: kktp ? new Decimal(kktp.threshold.toString()) : null,
        achievement: result.achievement,
        description,
        snapshotJson: {
          schemeId: scheme.id,
          descriptionSource: tpDescription ? "TP_AUTO" : "GENERIC_AUTO",
          tpScores: tpScores.map((t) => ({
            tpId: t.tpId,
            code: t.code,
            description: t.description,
            score: t.score.toString(),
          })),
          categoryAverages: result.categoryAverages.map((c) => ({
            categoryId: c.categoryId,
            average: c.average.toString(),
            weight: c.weight.toString(),
            weightedValue: c.weightedValue.toString(),
          })),
        },
      });
    }

    if (incomplete.length > 0) {
      throw Errors.validation(
        ApiErrorCode.ASSESSMENT_INCOMPLETE,
        "Rapor belum dapat dibuat: sebagian nilai belum lengkap.",
        { subjects: incomplete },
      );
    }

    return { student, year, semester, enrollment, subjects: computedSubjects };
  }
}

export function toReportJson(r: {
  id: string;
  studentId: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  version: number;
  status: string;
  generatedAt: Date | null;
  reviewedAt: Date | null;
  lockedAt: Date | null;
  publishedAt: Date | null;
}) {
  return {
    id: r.id,
    studentId: r.studentId,
    academicYearId: r.academicYearId,
    semesterId: r.semesterId,
    classId: r.classId,
    version: r.version,
    status: r.status,
    generatedAt: r.generatedAt ? r.generatedAt.toISOString() : null,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    lockedAt: r.lockedAt ? r.lockedAt.toISOString() : null,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
  };
}

export function toReportDetailJson(r: Parameters<typeof toReportJson>[0] & {
  cocurricularDescription: string | null;
  homeroomNotes: string | null;
  sickDays: number;
  permissionDays: number;
  unexcusedDays: number;
  extracurriculars: Array<{
    id: string;
    name: string;
    predicate: string;
    description: string | null;
    sortOrder: number;
  }>;
  subjects: Array<{
    id: string;
    reportCardId: string;
    subjectId: string;
    subjectName: string;
    finalScore: unknown;
    kktpThreshold: unknown;
    achievement: string;
    description: string | null;
    descriptionSource: string;
    snapshotJson: unknown;
  }>;
}) {
  return {
    ...toReportJson(r),
    cocurricularDescription: r.cocurricularDescription,
    homeroomNotes: r.homeroomNotes,
    sickDays: r.sickDays,
    permissionDays: r.permissionDays,
    unexcusedDays: r.unexcusedDays,
    extracurriculars: r.extracurriculars.map((e) => ({
      id: e.id,
      name: e.name,
      predicate: e.predicate,
      description: e.description,
      sortOrder: e.sortOrder,
    })),
    subjects: r.subjects.map((s) => ({
      id: s.id,
      reportCardId: s.reportCardId,
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      finalScore: Number(new Decimal(s.finalScore as Decimal.Value).toString()),
      kktpThreshold: s.kktpThreshold == null ? null : Number(new Decimal(s.kktpThreshold as Decimal.Value).toString()),
      achievement: s.achievement,
      description: s.description,
      descriptionSource: s.descriptionSource,
      snapshotJson: s.snapshotJson,
    })),
  };
}
