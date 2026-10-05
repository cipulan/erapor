import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import { ExtracurricularInputDto, UpdateCompletenessDto } from "./dto/report.dto";

const MAX_EXTRACURRICULARS = 10;

type ReportCardRow = {
  id: string;
  classId: string;
  status: string;
  cocurricularDescription: string | null;
  homeroomNotes: string | null;
  sickDays: number;
  permissionDays: number;
  unexcusedDays: number;
};

/**
 * Kelengkapan rapor oleh wali kelas (Fase 4): kokurikuler, ekstrakurikuler,
 * ketidakhadiran (sakit/izin/tanpa keterangan), dan catatan wali kelas.
 * Pengganti sheet KOKURIKULER, CATATAN, dan kolom S/I/A + Ekskul di
 * Data LHPP pada file generator Excel.
 */
@Injectable()
export class ReportCompletenessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  async updateCompleteness(
    user: SessionUser,
    reportCardId: string,
    dto: UpdateCompletenessDto,
    req: Request,
  ) {
    const report = await this.requireHomeroomScope(user, reportCardId);
    this.requireEditable(report.status);

    const data: {
      cocurricularDescription?: string | null;
      homeroomNotes?: string | null;
      sickDays?: number;
      permissionDays?: number;
      unexcusedDays?: number;
    } = {};
    if (dto.cocurricularDescription !== undefined) {
      data.cocurricularDescription = dto.cocurricularDescription?.trim() || null;
    }
    if (dto.homeroomNotes !== undefined) {
      data.homeroomNotes = dto.homeroomNotes?.trim() || null;
    }
    if (dto.sickDays !== undefined) data.sickDays = dto.sickDays;
    if (dto.permissionDays !== undefined) data.permissionDays = dto.permissionDays;
    if (dto.unexcusedDays !== undefined) data.unexcusedDays = dto.unexcusedDays;

    const updated = await this.prisma.reportCard.update({
      where: { id: report.id },
      data,
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.REPORT_COMPLETENESS_UPDATE,
      entityType: "ReportCard",
      entityId: report.id,
      beforeJson: toCompletenessJson(report),
      afterJson: toCompletenessJson(updated),
    });
    return toCompletenessJson(updated);
  }

  async listExtracurriculars(user: SessionUser, reportCardId: string) {
    const report = await this.policy.reportCardInSchool(user.schoolId, reportCardId);
    const rows = await this.prisma.extracurricularEntry.findMany({
      where: { reportCardId: report.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toExtracurricularJson);
  }

  async createExtracurricular(
    user: SessionUser,
    reportCardId: string,
    dto: ExtracurricularInputDto,
    req: Request,
  ) {
    const report = await this.requireHomeroomScope(user, reportCardId);
    this.requireEditable(report.status);

    const count = await this.prisma.extracurricularEntry.count({
      where: { reportCardId: report.id },
    });
    if (count >= MAX_EXTRACURRICULARS) {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        `Maksimal ${MAX_EXTRACURRICULARS} kegiatan ekstrakurikuler per rapor.`,
      );
    }

    const created = await this.prisma.extracurricularEntry.create({
      data: {
        reportCardId: report.id,
        name: dto.name.trim(),
        predicate: dto.predicate,
        description: dto.description?.trim() || null,
        sortOrder: count,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.EXTRACURRICULAR_CREATE,
      entityType: "ExtracurricularEntry",
      entityId: created.id,
      afterJson: toExtracurricularJson(created) as Record<string, unknown>,
    });
    return toExtracurricularJson(created);
  }

  async updateExtracurricular(
    user: SessionUser,
    reportCardId: string,
    entryId: string,
    dto: ExtracurricularInputDto,
    req: Request,
  ) {
    const report = await this.requireHomeroomScope(user, reportCardId);
    this.requireEditable(report.status);
    const entry = await this.entryInReport(report.id, entryId);

    const updated = await this.prisma.extracurricularEntry.update({
      where: { id: entry.id },
      data: {
        name: dto.name.trim(),
        predicate: dto.predicate,
        description: dto.description?.trim() || null,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.EXTRACURRICULAR_UPDATE,
      entityType: "ExtracurricularEntry",
      entityId: entry.id,
      beforeJson: toExtracurricularJson(entry) as Record<string, unknown>,
      afterJson: toExtracurricularJson(updated) as Record<string, unknown>,
    });
    return toExtracurricularJson(updated);
  }

  async deleteExtracurricular(user: SessionUser, reportCardId: string, entryId: string, req: Request) {
    const report = await this.requireHomeroomScope(user, reportCardId);
    this.requireEditable(report.status);
    const entry = await this.entryInReport(report.id, entryId);

    await this.prisma.extracurricularEntry.delete({ where: { id: entry.id } });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.EXTRACURRICULAR_DELETE,
      entityType: "ExtracurricularEntry",
      entityId: entry.id,
      beforeJson: toExtracurricularJson(entry) as Record<string, unknown>,
    });
  }

  private async entryInReport(reportCardId: string, entryId: string) {
    const entry = await this.prisma.extracurricularEntry.findFirst({
      where: { id: entryId, reportCardId },
    });
    if (!entry) throw Errors.notFound("Kegiatan ekstrakurikuler");
    return entry;
  }

  /**
   * Wali kelas = guru yang menjadi homeroomTeacherId pada kelas rapor.
   * Superadmin selalu boleh.
   */
  private async requireHomeroomScope(user: SessionUser, reportCardId: string) {
    const report = await this.policy.reportCardInSchool(user.schoolId, reportCardId);
    if (user.role === "TEACHER") {
      const klass = await this.prisma.class.findUnique({
        where: { id: report.classId },
        select: { homeroomTeacherId: true },
      });
      if (!klass || klass.homeroomTeacherId !== user.id) {
        throw Errors.forbidden("Hanya wali kelas yang dapat mengisi kelengkapan rapor ini.");
      }
    }
    return report;
  }

  private requireEditable(status: string): void {
    if (!["DRAFT", "REVIEW", "REVISION"].includes(status)) {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        "Kelengkapan rapor hanya dapat diubah pada rapor berstatus draf/review/revisi.",
      );
    }
  }
}

export function toCompletenessJson(r: ReportCardRow) {
  return {
    reportCardId: r.id,
    cocurricularDescription: r.cocurricularDescription,
    homeroomNotes: r.homeroomNotes,
    sickDays: r.sickDays,
    permissionDays: r.permissionDays,
    unexcusedDays: r.unexcusedDays,
  };
}

export function toExtracurricularJson(e: {
  id: string;
  reportCardId: string;
  name: string;
  predicate: string;
  description: string | null;
  sortOrder: number;
}) {
  return {
    id: e.id,
    reportCardId: e.reportCardId,
    name: e.name,
    predicate: e.predicate,
    description: e.description,
    sortOrder: e.sortOrder,
  };
}
