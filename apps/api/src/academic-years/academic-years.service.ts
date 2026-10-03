import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import { Paginated, PaginationParams, buildPaginated } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { CreateAcademicYearDto, CreateSemesterDto } from "./dto/academic-year.dto";

@Injectable()
export class AcademicYearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  async list(user: SessionUser, params: PaginationParams, status?: string): Promise<Paginated<unknown>> {
    const where = {
      schoolId: user.schoolId,
      ...(status ? { status: status as "DRAFT" | "ACTIVE" | "ARCHIVED" } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.academicYear.count({ where }),
      this.prisma.academicYear.findMany({
        where,
        orderBy: [{ startDate: "desc" }],
        skip: params.skip,
        take: params.limit,
      }),
    ]);
    return buildPaginated(data.map(toAcademicYearJson), total, params);
  }

  async get(user: SessionUser, id: string) {
    const year = await this.policy.academicYearInSchool(user.schoolId, id);
    return toAcademicYearJson(year);
  }

  async create(user: SessionUser, dto: CreateAcademicYearDto, req: Request) {
    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Tanggal mulai harus sebelum tanggal selesai.",
      );
    }
    const existing = await this.prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, name: dto.name.trim() },
      select: { id: true },
    });
    if (existing) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Tahun ajaran dengan nama ini sudah ada.");
    }

    const year = await this.prisma.academicYear.create({
      data: {
        schoolId: user.schoolId,
        name: dto.name.trim(),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: "DRAFT",
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.ACADEMIC_YEAR_CREATE,
      entityType: "AcademicYear",
      entityId: year.id,
      afterJson: toAcademicYearJson(year) as Record<string, unknown>,
    });
    return toAcademicYearJson(year);
  }

  /**
   * Activates an academic year. The single-ACTIVE invariant is enforced by
   * the partial unique index; the previously active year is archived in the
   * same transaction.
   */
  async activate(user: SessionUser, id: string, req: Request) {
    const year = await this.policy.academicYearInSchool(user.schoolId, id);
    if (year.status === "ACTIVE") return toAcademicYearJson(year);

    const result = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.academicYear.findFirst({
        where: { schoolId: user.schoolId, status: "ACTIVE" },
      });
      if (previous && previous.id !== year.id) {
        await tx.academicYear.update({
          where: { id: previous.id },
          data: { status: "ARCHIVED" },
        });
      }
      return tx.academicYear.update({
        where: { id: year.id },
        data: { status: "ACTIVE" },
      });
    });

    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.ACADEMIC_YEAR_ACTIVATE,
      entityType: "AcademicYear",
      entityId: result.id,
      beforeJson: { status: year.status },
      afterJson: { status: result.status },
    });
    return toAcademicYearJson(result);
  }

  async listSemesters(user: SessionUser, academicYearId: string) {
    const year = await this.policy.academicYearInSchool(user.schoolId, academicYearId);
    const semesters = await this.prisma.semester.findMany({
      where: { academicYearId: year.id },
      orderBy: [{ code: "asc" }],
    });
    return semesters.map(toSemesterJson);
  }

  async createSemester(user: SessionUser, academicYearId: string, dto: CreateSemesterDto, req: Request) {
    const year = await this.policy.academicYearInSchool(user.schoolId, academicYearId);

    if (dto.startDate && dto.endDate && new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Tanggal mulai semester harus sebelum tanggal selesai.",
      );
    }
    const existing = await this.prisma.semester.findFirst({
      where: { academicYearId: year.id, code: dto.code },
      select: { id: true },
    });
    if (existing) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Semester dengan kode ini sudah ada di tahun ajaran ini.");
    }

    const semester = await this.prisma.semester.create({
      data: {
        academicYearId: year.id,
        code: dto.code,
        name: dto.name.trim(),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: "DRAFT",
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.SEMESTER_CREATE,
      entityType: "Semester",
      entityId: semester.id,
      afterJson: toSemesterJson(semester) as Record<string, unknown>,
    });
    return toSemesterJson(semester);
  }
}

function toAcademicYearJson(year: {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
}) {
  return {
    id: year.id,
    name: year.name,
    startDate: year.startDate.toISOString().slice(0, 10),
    endDate: year.endDate.toISOString().slice(0, 10),
    status: year.status,
  };
}

function toSemesterJson(s: {
  id: string;
  academicYearId: string;
  code: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
}) {
  return {
    id: s.id,
    academicYearId: s.academicYearId,
    code: s.code,
    name: s.name,
    startDate: s.startDate ? s.startDate.toISOString().slice(0, 10) : null,
    endDate: s.endDate ? s.endDate.toISOString().slice(0, 10) : null,
    status: s.status,
  };
}
