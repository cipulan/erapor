import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import { CreateCpDto, CreateTpDto } from "./dto/curriculum.dto";

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
