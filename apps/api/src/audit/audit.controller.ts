import { Controller, Get, Query } from "@nestjs/common";
import { Injectable, Module } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { parsePagination, buildPaginated } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: SessionUser, params: ReturnType<typeof parsePagination>, filters: Record<string, string>) {
    const where: Record<string, unknown> = { schoolId: user.schoolId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = filters.action;

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: params.skip,
        take: params.limit,
      }),
    ]);
    return buildPaginated(data.map(toAuditJson), total, params);
  }
}

function toAuditJson(a: {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: Date;
}) {
  return {
    id: a.id,
    actorUserId: a.actorUserId,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    beforeJson: a.beforeJson,
    afterJson: a.afterJson,
    createdAt: a.createdAt.toISOString(),
  };
}

@Controller("audit-logs")
export class AuditController {
  constructor(private readonly service: AuditQueryService) {}

  @Get()
  @Roles("SUPERADMIN")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, parsePagination(query), query);
  }
}

@Module({
  controllers: [AuditController],
  providers: [AuditQueryService],
})
export class AuditQueryModule {}
