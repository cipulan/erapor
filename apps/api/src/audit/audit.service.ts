import { Injectable, Logger } from "@nestjs/common";
import { Request } from "express";
import type { Prisma } from "@erapor/database";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  req?: Request & { requestId?: string };
  schoolId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Must be JSON-serializable; callers pass plain objects from to*Json helpers. */
  beforeJson?: unknown;
  afterJson?: unknown;
}

/** Well-known audit actions (authorization-matrix §9). */
export const AuditAction = {
  AUTH_LOGIN: "AUTH_LOGIN",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  SCHOOL_UPDATE: "SCHOOL_UPDATE",
  ACADEMIC_YEAR_CREATE: "ACADEMIC_YEAR_CREATE",
  ACADEMIC_YEAR_ACTIVATE: "ACADEMIC_YEAR_ACTIVATE",
  SEMESTER_CREATE: "SEMESTER_CREATE",
  STUDENT_CREATE: "STUDENT_CREATE",
  STUDENT_UPDATE: "STUDENT_UPDATE",
  ENROLLMENT_CREATE: "ENROLLMENT_CREATE",
  GUARDIAN_CREATE: "GUARDIAN_CREATE",
  GUARDIAN_LINK: "GUARDIAN_LINK",
  CLASS_CREATE: "CLASS_CREATE",
  SUBJECT_CREATE: "SUBJECT_CREATE",
  CP_CREATE: "CP_CREATE",
  TP_CREATE: "TP_CREATE",
  ASSIGNMENT_CREATE: "ASSIGNMENT_CREATE",
  CATEGORY_CREATE: "CATEGORY_CREATE",
  GRADING_SCHEME_CREATE: "GRADING_SCHEME_CREATE",
  GRADING_SCHEME_WEIGHTS_UPDATE: "GRADING_SCHEME_WEIGHTS_UPDATE",
  GRADING_SCHEME_PUBLISH: "GRADING_SCHEME_PUBLISH",
  KKTP_UPSERT: "KKTP_UPSERT",
  ASSESSMENT_CREATE: "ASSESSMENT_CREATE",
  SCORES_BULK_UPDATE: "SCORES_BULK_UPDATE",
  SCORE_IMPORT_COMMIT: "SCORE_IMPORT_COMMIT",
  REPORT_GENERATE: "REPORT_GENERATE",
  REPORT_REVIEW: "REPORT_REVIEW",
  REPORT_LOCK: "REPORT_LOCK",
  REPORT_PUBLISH: "REPORT_PUBLISH",
  REPORT_REVISION: "REPORT_REVISION",
  PROMOTION_EXECUTE: "PROMOTION_EXECUTE",
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  USER_STATUS_UPDATE: "USER_STATUS_UPDATE",
  PROFILE_UPDATE: "PROFILE_UPDATE",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
} as const;

/**
 * Append-only audit log writer. Failures are logged but never break the
 * business operation they describe.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          schoolId: entry.schoolId,
          actorUserId: entry.actorUserId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          beforeJson: (entry.beforeJson ?? undefined) as Prisma.InputJsonValue | undefined,
          afterJson: (entry.afterJson ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: entry.req?.ip ?? null,
          userAgent: entry.req?.headers?.["user-agent"] ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${String(err)}`);
    }
  }
}
