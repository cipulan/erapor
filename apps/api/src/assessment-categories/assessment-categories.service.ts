import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import { CreateAssessmentCategoryDto } from "./dto/assessment-category.dto";

@Injectable()
export class AssessmentCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: SessionUser, active?: string) {
    const where: Record<string, unknown> = { schoolId: user.schoolId };
    if (active !== undefined && active !== "") where.isActive = active === "true";
    const data = await this.prisma.assessmentCategory.findMany({
      where,
      orderBy: [{ name: "asc" }],
    });
    return data.map(toCategoryJson);
  }

  async create(user: SessionUser, dto: CreateAssessmentCategoryDto, req: Request) {
    const dup = await this.prisma.assessmentCategory.findFirst({
      where: { schoolId: user.schoolId, name: dto.name.trim() },
      select: { id: true },
    });
    if (dup) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Kategori penilaian dengan nama ini sudah ada.");
    }
    const category = await this.prisma.assessmentCategory.create({
      data: {
        schoolId: user.schoolId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isActive: true,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.CATEGORY_CREATE,
      entityType: "AssessmentCategory",
      entityId: category.id,
      afterJson: toCategoryJson(category) as Record<string, unknown>,
    });
    return toCategoryJson(category);
  }
}

export function toCategoryJson(c: {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}) {
  return { id: c.id, name: c.name, description: c.description, isActive: c.isActive };
}
