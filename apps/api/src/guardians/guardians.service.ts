import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { Errors } from "../common/errors/api-exception";
import { Paginated, PaginationParams, buildPaginated } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { toGuardianJson } from "../students/students.service";
import { CreateGuardianDto } from "../students/dto/student.dto";

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    user: SessionUser,
    params: PaginationParams,
    search?: string,
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = { schoolId: user.schoolId };
    if (user.role === "PARENT") {
      // Parents only see their own guardian record(s).
      where.userId = user.id;
    }
    if (search) {
      where.fullName = { contains: search.trim(), mode: "insensitive" };
    }
    const [total, data] = await Promise.all([
      this.prisma.guardian.count({ where }),
      this.prisma.guardian.findMany({
        where,
        orderBy: [{ fullName: "asc" }],
        skip: params.skip,
        take: params.limit,
      }),
    ]);
    return buildPaginated(data.map(toGuardianJson), total, params);
  }

  async create(user: SessionUser, dto: CreateGuardianDto, req: Request) {
    const guardian = await this.prisma.guardian.create({
      data: {
        schoolId: user.schoolId,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.GUARDIAN_CREATE,
      entityType: "Guardian",
      entityId: guardian.id,
      afterJson: toGuardianJson(guardian) as Record<string, unknown>,
    });
    return toGuardianJson(guardian);
  }

  async get(user: SessionUser, id: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id, schoolId: user.schoolId },
    });
    if (!guardian) throw Errors.notFound("Wali");
    if (user.role === "PARENT" && guardian.userId !== user.id) {
      throw Errors.notFound("Wali");
    }
    return toGuardianJson(guardian);
  }
}
