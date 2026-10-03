import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import { Paginated, PaginationParams, buildPaginated } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { IsIn, IsString, MinLength } from "class-validator";

export class CreateSubjectDto {
  @IsString()
  @MinLength(1, { message: "Kode mata pelajaran wajib diisi." })
  code!: string;

  @IsString()
  @MinLength(1, { message: "Nama mata pelajaran wajib diisi." })
  name!: string;

  @IsIn(["MANDATORY", "ADDITIONAL", "LOCAL"], { message: "Tipe mata pelajaran tidak valid." })
  subjectType!: "MANDATORY" | "ADDITIONAL" | "LOCAL";
}

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  async list(user: SessionUser, params: PaginationParams, active?: string): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = { schoolId: user.schoolId };
    if (active !== undefined && active !== "") {
      where.isActive = active === "true";
    }
    const [total, data] = await Promise.all([
      this.prisma.subject.count({ where }),
      this.prisma.subject.findMany({
        where,
        orderBy: [{ name: "asc" }],
        skip: params.skip,
        take: params.limit,
      }),
    ]);
    return buildPaginated(data.map(toSubjectJson), total, params);
  }

  async create(user: SessionUser, dto: CreateSubjectDto, req: Request) {
    const dup = await this.prisma.subject.findFirst({
      where: { schoolId: user.schoolId, code: dto.code.trim() },
      select: { id: true },
    });
    if (dup) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Kode mata pelajaran sudah digunakan.");
    }
    const subject = await this.prisma.subject.create({
      data: {
        schoolId: user.schoolId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        subjectType: dto.subjectType,
        isActive: true,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.SUBJECT_CREATE,
      entityType: "Subject",
      entityId: subject.id,
      afterJson: toSubjectJson(subject) as Record<string, unknown>,
    });
    return toSubjectJson(subject);
  }
}

export function toSubjectJson(s: {
  id: string;
  code: string;
  name: string;
  subjectType: string;
  isActive: boolean;
}) {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    subjectType: s.subjectType,
    isActive: s.isActive,
  };
}
