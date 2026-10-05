import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import { CreateCpDto, CreateTpDto, UpdateCpDto, UpdateTpDto } from "./dto/curriculum.dto";

/**
 * Curriculum: CP (Capaian Pembelajaran) per subject and TP (Tujuan
 * Pembelajaran) per CP. Teachers may manage CP/TP for their assigned
 * subjects; superadmins for any subject in the school.
 */
@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  async createCp(user: SessionUser, subjectId: string, dto: CreateCpDto, req: Request) {
    const subject = await this.policy.subjectInSchool(user.schoolId, subjectId);
    if (user.role === "TEACHER") {
      await this.policy.requireTeacherAssignmentScope(user.id, { subjectId: subject.id });
    }

    const dup = await this.prisma.curriculumOutcome.findFirst({
      where: { subjectId: subject.id, code: dto.code.trim() },
      select: { id: true },
    });
    if (dup) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Kode CP sudah digunakan untuk mata pelajaran ini.");
    }

    const cp = await this.prisma.curriculumOutcome.create({
      data: {
        subjectId: subject.id,
        code: dto.code.trim(),
        description: dto.description.trim(),
        isActive: true,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.CP_CREATE,
      entityType: "CurriculumOutcome",
      entityId: cp.id,
      afterJson: toCpJson(cp) as Record<string, unknown>,
    });
    return toCpJson(cp);
  }

  async createTp(user: SessionUser, cpId: string, dto: CreateTpDto, req: Request) {
    const cp = await this.policy.cpInSchool(user.schoolId, cpId);
    if (user.role === "TEACHER") {
      await this.policy.requireTeacherAssignmentScope(user.id, { subjectId: cp.subjectId });
    }

    const dup = await this.prisma.learningObjective.findFirst({
      where: { cpId: cp.id, code: dto.code.trim() },
      select: { id: true },
    });
    if (dup) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Kode TP sudah digunakan untuk CP ini.");
    }

    const tp = await this.prisma.learningObjective.create({
      data: {
        cpId: cp.id,
        code: dto.code.trim(),
        description: dto.description.trim(),
        isActive: true,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.TP_CREATE,
      entityType: "LearningObjective",
      entityId: tp.id,
      afterJson: toTpJson(tp) as Record<string, unknown>,
    });
    return toTpJson(tp);
  }

  /** Daftar CP beserta TP-nya untuk satu mapel, terurut menurut kode. */
  async listSubjectCurriculum(user: SessionUser, subjectId: string) {
    const subject = await this.policy.subjectInSchool(user.schoolId, subjectId);
    const cps = await this.prisma.curriculumOutcome.findMany({
      where: { subjectId: subject.id },
      include: {
        learningObjectives: { orderBy: { code: "asc" } },
        _count: { select: { learningObjectives: true } },
      },
      orderBy: { code: "asc" },
    });
    return cps.map((cp) => ({
      ...toCpJson(cp),
      tps: cp.learningObjectives.map(toTpJson),
    }));
  }

  async updateCp(user: SessionUser, cpId: string, dto: UpdateCpDto, req: Request) {
    const cp = await this.policy.cpInSchool(user.schoolId, cpId);
    if (user.role === "TEACHER") {
      await this.policy.requireTeacherAssignmentScope(user.id, { subjectId: cp.subjectId });
    }
    const data: { code?: string; description?: string; isActive?: boolean } = {};
    if (dto.code !== undefined) {
      const code = dto.code.trim();
      const dup = await this.prisma.curriculumOutcome.findFirst({
        where: { subjectId: cp.subjectId, code, id: { not: cp.id } },
        select: { id: true },
      });
      if (dup) {
        throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Kode CP sudah digunakan untuk mata pelajaran ini.");
      }
      data.code = code;
    }
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.curriculumOutcome.update({
      where: { id: cp.id },
      data,
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.CP_UPDATE,
      entityType: "CurriculumOutcome",
      entityId: cp.id,
      beforeJson: toCpJson(cp) as Record<string, unknown>,
      afterJson: toCpJson(updated) as Record<string, unknown>,
    });
    return toCpJson(updated);
  }

  async deleteCp(user: SessionUser, cpId: string, req: Request) {
    const cp = await this.policy.cpInSchool(user.schoolId, cpId);
    if (user.role === "TEACHER") {
      await this.policy.requireTeacherAssignmentScope(user.id, { subjectId: cp.subjectId });
    }
    const tpCount = await this.prisma.learningObjective.count({ where: { cpId: cp.id } });
    if (tpCount > 0) {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        "CP tidak dapat dihapus karena masih memiliki TP. Nonaktifkan atau pindahkan TP terlebih dahulu.",
      );
    }
    await this.prisma.curriculumOutcome.delete({ where: { id: cp.id } });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.CP_DELETE,
      entityType: "CurriculumOutcome",
      entityId: cp.id,
      beforeJson: toCpJson(cp) as Record<string, unknown>,
    });
  }

  async updateTp(user: SessionUser, tpId: string, dto: UpdateTpDto, req: Request) {
    const tp = await this.policy.tpInSchool(user.schoolId, tpId);
    if (user.role === "TEACHER") {
      await this.policy.requireTeacherAssignmentScope(user.id, { subjectId: tp.cp.subjectId });
    }
    const data: { code?: string; description?: string; isActive?: boolean } = {};
    if (dto.code !== undefined) {
      const code = dto.code.trim();
      const dup = await this.prisma.learningObjective.findFirst({
        where: { cpId: tp.cpId, code, id: { not: tp.id } },
        select: { id: true },
      });
      if (dup) {
        throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Kode TP sudah digunakan untuk CP ini.");
      }
      data.code = code;
    }
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.learningObjective.update({
      where: { id: tp.id },
      data,
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.TP_UPDATE,
      entityType: "LearningObjective",
      entityId: tp.id,
      beforeJson: toTpJson(tp) as Record<string, unknown>,
      afterJson: toTpJson(updated) as Record<string, unknown>,
    });
    return toTpJson(updated);
  }

  /**
   * TP yang sudah dipakai penilaian tidak dapat dihapus (melindungi histori
   * rapor) — nonaktifkan saja via PATCH isActive=false.
   */
  async deleteTp(user: SessionUser, tpId: string, req: Request) {
    const tp = await this.policy.tpInSchool(user.schoolId, tpId);
    if (user.role === "TEACHER") {
      await this.policy.requireTeacherAssignmentScope(user.id, { subjectId: tp.cp.subjectId });
    }
    const used = await this.prisma.assessmentLearningObjective.count({ where: { tpId: tp.id } });
    if (used > 0) {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        "TP tidak dapat dihapus karena sudah dipakai penilaian. Nonaktifkan saja.",
      );
    }
    await this.prisma.learningObjective.delete({ where: { id: tp.id } });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.TP_DELETE,
      entityType: "LearningObjective",
      entityId: tp.id,
      beforeJson: toTpJson(tp) as Record<string, unknown>,
    });
  }
}

export function toCpJson(cp: {
  id: string;
  subjectId: string;
  code: string;
  description: string;
  isActive: boolean;
}) {
  return {
    id: cp.id,
    subjectId: cp.subjectId,
    code: cp.code,
    description: cp.description,
    isActive: cp.isActive,
  };
}

export function toTpJson(tp: {
  id: string;
  cpId: string;
  code: string;
  description: string;
  isActive: boolean;
}) {
  return {
    id: tp.id,
    cpId: tp.cpId,
    code: tp.code,
    description: tp.description,
    isActive: tp.isActive,
  };
}
