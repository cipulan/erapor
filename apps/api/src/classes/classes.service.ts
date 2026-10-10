import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import { Paginated, PaginationParams, buildPaginated } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { CreateClassDto, PromoteClassDto, UpdateClassDto } from "./dto/class.dto";

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  async list(
    user: SessionUser,
    params: PaginationParams,
    academicYearId?: string,
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = { schoolId: user.schoolId };
    if (academicYearId) {
      await this.policy.academicYearInSchool(user.schoolId, academicYearId);
      where.academicYearId = academicYearId;
    }
    if (user.role === "TEACHER") {
      const classIds = await this.policy.teacherClassIds(user.id);
      where.id = { in: classIds };
    } else if (user.role === "PARENT") {
      const studentIds = await this.policy.parentStudentIds(user.id, user.schoolId);
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          studentId: { in: studentIds },
          status: "ACTIVE",
          ...(academicYearId ? { academicYearId } : {}),
        },
        select: { classId: true },
        distinct: ["classId"],
      });
      where.id = { in: enrollments.map((e) => e.classId) };
    }

    const [total, data] = await Promise.all([
      this.prisma.class.count({ where }),
      this.prisma.class.findMany({
        where,
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
        skip: params.skip,
        take: params.limit,
      }),
    ]);
    const classIds = data.map((d) => d.id);
    const counts = classIds.length
      ? await this.prisma.studentEnrollment.groupBy({
          by: ["classId"],
          where: { classId: { in: classIds }, status: "ACTIVE" },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(counts.map((c) => [c.classId, c._count._all]));
    return buildPaginated(
      data.map((d) =>
        toClassJson({ ...d, _count: { enrollments: countMap.get(d.id) ?? 0 } }),
      ),
      total,
      params,
    );
  }

  async create(user: SessionUser, dto: CreateClassDto, req: Request) {
    const year = await this.policy.academicYearInSchool(user.schoolId, dto.academicYearId);

    if (dto.homeroomTeacherId) {
      const teacher = await this.prisma.user.findFirst({
        where: { id: dto.homeroomTeacherId, schoolId: user.schoolId },
      });
      if (!teacher) throw Errors.notFound("Guru");
      if (teacher.role !== "TEACHER") {
        throw Errors.validation(
          ApiErrorCode.VALIDATION_ERROR,
          "Wali kelas harus user dengan role guru.",
        );
      }
    }

    const dup = await this.prisma.class.findFirst({
      where: { academicYearId: year.id, name: dto.name.trim() },
      select: { id: true },
    });
    if (dup) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Kelas dengan nama ini sudah ada di tahun ajaran ini.");
    }

    const klass = await this.prisma.class.create({
      data: {
        schoolId: user.schoolId,
        academicYearId: year.id,
        name: dto.name.trim(),
        gradeLevel: dto.gradeLevel,
        homeroomTeacherId: dto.homeroomTeacherId ?? null,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.CLASS_CREATE,
      entityType: "Class",
      entityId: klass.id,
      afterJson: toClassJson(klass) as Record<string, unknown>,
    });
    return toClassJson(klass);
  }

  /**
   * Update kelas: nama dan/atau wali kelas. gradeLevel immutable — mengubahnya
   * akan merusak konsistensi KKTP per tingkat & rapor yang sudah terbit.
   * SUPERADMIN only.
   */
  async update(user: SessionUser, id: string, dto: UpdateClassDto, req: Request) {
    const klass = await this.policy.classInSchool(user.schoolId, id);
    const data: { name?: string; homeroomTeacherId?: string | null } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const dup = await this.prisma.class.findFirst({
        where: { academicYearId: klass.academicYearId, name, id: { not: klass.id } },
        select: { id: true },
      });
      if (dup) {
        throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Kelas dengan nama ini sudah ada di tahun ajaran ini.");
      }
      data.name = name;
    }

    if (dto.homeroomTeacherId !== undefined) {
      if (dto.homeroomTeacherId) {
        const teacher = await this.prisma.user.findFirst({
          where: { id: dto.homeroomTeacherId, schoolId: user.schoolId },
        });
        if (!teacher) throw Errors.notFound("Guru");
        if (teacher.role !== "TEACHER") {
          throw Errors.validation(
            ApiErrorCode.VALIDATION_ERROR,
            "Wali kelas harus user dengan role guru.",
          );
        }
      }
      data.homeroomTeacherId = dto.homeroomTeacherId ?? null;
    }

    if (Object.keys(data).length === 0) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Tidak ada perubahan yang dikirim.");
    }

    const before = toClassJson(klass);
    const updated = await this.prisma.class.update({ where: { id: klass.id }, data });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.CLASS_UPDATE,
      entityType: "Class",
      entityId: klass.id,
      beforeJson: before as Record<string, unknown>,
      afterJson: toClassJson(updated) as Record<string, unknown>,
    });
    return toClassJson(updated);
  }

  /**
   * Bulk promotion: creates NEW enrollments in the target academic year/class.
   * Historical enrollments are never modified (BR-011). SUPERADMIN only.
   */
  async promote(user: SessionUser, classId: string, dto: PromoteClassDto, req: Request) {
    const sourceClass = await this.policy.classInSchool(user.schoolId, classId);
    const targetYear = await this.policy.academicYearInSchool(user.schoolId, dto.targetAcademicYearId);
    const targetClass = await this.policy.classInSchool(user.schoolId, dto.targetClassId);

    if (targetClass.academicYearId !== targetYear.id) {
      throw Errors.validation(
        ApiErrorCode.INVALID_ACADEMIC_YEAR,
        "Kelas tujuan tidak termasuk dalam tahun ajaran tujuan.",
      );
    }
    if (targetYear.id === sourceClass.academicYearId) {
      throw Errors.validation(
        ApiErrorCode.INVALID_ACADEMIC_YEAR,
        "Kenaikan kelas harus ke tahun ajaran yang berbeda.",
      );
    }

    let sourceEnrollments = await this.prisma.studentEnrollment.findMany({
      where: { classId: sourceClass.id, status: "ACTIVE" },
      select: { studentId: true },
    });
    if (dto.studentIds && dto.studentIds.length > 0) {
      const wanted = new Set(dto.studentIds);
      sourceEnrollments = sourceEnrollments.filter((e) => wanted.has(e.studentId));
    }

    const enrollmentType = dto.enrollmentType ?? "PROMOTED";
    let created = 0;
    let skipped = 0;
    const errors: Array<Record<string, unknown>> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const e of sourceEnrollments) {
        const exists = await tx.studentEnrollment.findFirst({
          where: { studentId: e.studentId, academicYearId: targetYear.id },
          select: { id: true },
        });
        if (exists) {
          skipped += 1;
          continue;
        }
        try {
          await tx.studentEnrollment.create({
            data: {
              studentId: e.studentId,
              academicYearId: targetYear.id,
              classId: targetClass.id,
              status: "ACTIVE",
              enrollmentType,
            },
          });
          created += 1;
        } catch (err) {
          errors.push({ studentId: e.studentId, message: String(err) });
        }
      }
    });

    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.PROMOTION_EXECUTE,
      entityType: "StudentEnrollment",
      entityId: targetClass.id,
      afterJson: {
        sourceClassId: sourceClass.id,
        targetClassId: targetClass.id,
        targetAcademicYearId: targetYear.id,
        created,
        skipped,
      },
    });

    return {
      sourceClassId: sourceClass.id,
      targetClassId: targetClass.id,
      created,
      skipped,
      errors,
    };
  }
}

export function toClassJson(c: {
  id: string;
  academicYearId: string;
  name: string;
  gradeLevel: number;
  homeroomTeacherId: string | null;
  _count?: { enrollments: number };
}) {
  return {
    id: c.id,
    academicYearId: c.academicYearId,
    name: c.name,
    gradeLevel: c.gradeLevel,
    homeroomTeacherId: c.homeroomTeacherId,
    studentCount: c._count?.enrollments ?? 0,
  };
}
