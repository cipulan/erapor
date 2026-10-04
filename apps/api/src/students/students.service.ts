import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import { Paginated, PaginationParams, buildPaginated } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { CreateEnrollmentDto, CreateStudentDto, LinkGuardianDto, UpdateStudentDto } from "./dto/student.dto";

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  /** Applies teacher/parent scoping to the student where clause. */
  private async scopedStudentIds(user: SessionUser): Promise<string[] | null> {
    if (user.role === "SUPERADMIN") return null;
    if (user.role === "TEACHER") {
      return this.policy.teacherStudentIds(user.schoolId, user.id);
    }
    return this.policy.parentStudentIds(user.id, user.schoolId);
  }

  async list(
    user: SessionUser,
    params: PaginationParams,
    filters: { search?: string; classId?: string; academicYearId?: string; status?: string },
  ): Promise<Paginated<unknown>> {
    const scoped = await this.scopedStudentIds(user);
    const where: Record<string, unknown> = { schoolId: user.schoolId };
    if (scoped) where.id = { in: scoped };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { nis: { contains: q, mode: "insensitive" } },
        { nisn: { contains: q, mode: "insensitive" } },
      ];
    }
    if (filters.classId || filters.academicYearId) {
      const enrollmentWhere: Record<string, unknown> = { status: "ACTIVE" };
      if (filters.classId) {
        // Class must belong to the school; 404 otherwise.
        await this.policy.classInSchool(user.schoolId, filters.classId);
        if (user.role === "TEACHER") {
          const classIds = await this.policy.teacherClassIds(user.id);
          if (!classIds.includes(filters.classId)) {
            return buildPaginated([], 0, params); // hide other teachers' classes
          }
        }
        enrollmentWhere.classId = filters.classId;
      }
      if (filters.academicYearId) {
        await this.policy.academicYearInSchool(user.schoolId, filters.academicYearId);
        enrollmentWhere.academicYearId = filters.academicYearId;
      }
      where.enrollments = { some: enrollmentWhere };
    }

    const [total, data] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy: [{ fullName: "asc" }],
        skip: params.skip,
        take: params.limit,
      }),
    ]);
    return buildPaginated(data.map(toStudentJson), total, params);
  }

  async get(user: SessionUser, id: string) {
    const student = await this.policy.studentInSchool(user.schoolId, id);
    await this.assertStudentReadable(user, student.id);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId: student.id },
      orderBy: [{ enrolledAt: "desc" }],
    });
    return { ...toStudentJson(student), enrollments: enrollments.map(toEnrollmentJson) };
  }

  async create(user: SessionUser, dto: CreateStudentDto, req: Request) {
    if (dto.nis) {
      const dup = await this.prisma.student.findFirst({
        where: { schoolId: user.schoolId, nis: dto.nis.trim() },
        select: { id: true },
      });
      if (dup) {
        throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "NIS sudah digunakan siswa lain.");
      }
    }
    const student = await this.prisma.student.create({
      data: {
        schoolId: user.schoolId,
        nis: dto.nis?.trim() || null,
        nisn: dto.nisn?.trim() || null,
        fullName: dto.fullName.trim(),
        gender: dto.gender ?? null,
        birthPlace: dto.birthPlace?.trim() || null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        status: "ACTIVE",
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.STUDENT_CREATE,
      entityType: "Student",
      entityId: student.id,
      afterJson: toStudentJson(student) as Record<string, unknown>,
    });
    return toStudentJson(student);
  }

  /** SUPERADMIN mengubah data diri siswa. */
  async update(user: SessionUser, id: string, dto: UpdateStudentDto, req: Request) {
    const student = await this.policy.studentInSchool(user.schoolId, id);
    const data: {
      nis?: string | null;
      nisn?: string | null;
      fullName?: string;
      gender?: "MALE" | "FEMALE" | null;
      birthPlace?: string | null;
      birthDate?: Date | null;
    } = {};
    if (dto.nis !== undefined) {
      const nis = dto.nis.trim() || null;
      if (nis) {
        const dup = await this.prisma.student.findFirst({
          where: { schoolId: user.schoolId, nis, id: { not: student.id } },
          select: { id: true },
        });
        if (dup) {
          throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "NIS sudah digunakan siswa lain.");
        }
      }
      data.nis = nis;
    }
    if (dto.nisn !== undefined) data.nisn = dto.nisn.trim() || null;
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.birthPlace !== undefined) data.birthPlace = dto.birthPlace.trim() || null;
    if (dto.birthDate !== undefined) data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (Object.keys(data).length === 0) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Tidak ada perubahan yang dikirim.");
    }
    const before = toStudentJson(student);
    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data,
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.STUDENT_UPDATE,
      entityType: "Student",
      entityId: student.id,
      beforeJson: before as Record<string, unknown>,
      afterJson: toStudentJson(updated) as Record<string, unknown>,
    });
    return toStudentJson(updated);
  }

  async listEnrollments(user: SessionUser, studentId: string) {
    const student = await this.policy.studentInSchool(user.schoolId, studentId);
    await this.assertStudentReadable(user, student.id);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId: student.id },
      orderBy: [{ enrolledAt: "desc" }],
    });
    return enrollments.map(toEnrollmentJson);
  }

  async createEnrollment(user: SessionUser, studentId: string, dto: CreateEnrollmentDto, req: Request) {
    const student = await this.policy.studentInSchool(user.schoolId, studentId);
    const year = await this.policy.academicYearInSchool(user.schoolId, dto.academicYearId);
    const klass = await this.policy.classInSchool(user.schoolId, dto.classId);
    if (klass.academicYearId !== year.id) {
      throw Errors.validation(
        ApiErrorCode.INVALID_ACADEMIC_YEAR,
        "Kelas tidak termasuk dalam tahun ajaran tersebut.",
      );
    }

    const dup = await this.prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, academicYearId: year.id },
      select: { id: true },
    });
    if (dup) {
      throw Errors.conflict(
        ApiErrorCode.STUDENT_ALREADY_ENROLLED,
        "Siswa sudah terdaftar di tahun ajaran ini.",
      );
    }

    const enrollment = await this.prisma.studentEnrollment.create({
      data: {
        studentId: student.id,
        academicYearId: year.id,
        classId: klass.id,
        status: "ACTIVE",
        enrollmentType: dto.enrollmentType,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.ENROLLMENT_CREATE,
      entityType: "StudentEnrollment",
      entityId: enrollment.id,
      afterJson: toEnrollmentJson(enrollment) as Record<string, unknown>,
    });
    return toEnrollmentJson(enrollment);
  }

  async listGuardians(user: SessionUser, studentId: string) {
    const student = await this.policy.studentInSchool(user.schoolId, studentId);
    await this.assertStudentReadable(user, student.id);
    const links = await this.prisma.studentGuardian.findMany({
      where: { studentId: student.id, guardian: { schoolId: user.schoolId } },
      include: { guardian: true },
      orderBy: [{ isPrimary: "desc" }],
    });
    return links.map((l) => toGuardianJson(l.guardian));
  }

  async linkGuardian(user: SessionUser, studentId: string, dto: LinkGuardianDto, req: Request) {
    const student = await this.policy.studentInSchool(user.schoolId, studentId);
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: dto.guardianId, schoolId: user.schoolId },
    });
    if (!guardian) throw Errors.notFound("Wali");

    const existing = await this.prisma.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId: student.id, guardianId: guardian.id } },
    });
    if (existing) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Wali sudah terhubung dengan siswa ini.");
    }

    await this.prisma.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        isPrimary: dto.isPrimary ?? false,
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.GUARDIAN_LINK,
      entityType: "StudentGuardian",
      entityId: guardian.id,
      afterJson: { studentId: student.id, guardianId: guardian.id },
    });
    return toGuardianJson(guardian);
  }

  private async assertStudentReadable(user: SessionUser, studentId: string): Promise<void> {
    if (user.role === "SUPERADMIN") return;
    if (user.role === "TEACHER") {
      const ids = await this.policy.teacherStudentIds(user.schoolId, user.id);
      if (!ids.includes(studentId)) throw Errors.notFound("Siswa");
      return;
    }
    await this.policy.requireParentStudent(user.id, user.schoolId, studentId);
  }
}

export function toStudentJson(s: {
  id: string;
  nis: string | null;
  nisn: string | null;
  fullName: string;
  gender: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
  status: string;
}) {
  return {
    id: s.id,
    nis: s.nis,
    nisn: s.nisn,
    fullName: s.fullName,
    gender: s.gender,
    birthPlace: s.birthPlace,
    birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : null,
    status: s.status,
  };
}

export function toEnrollmentJson(e: {
  id: string;
  studentId: string;
  academicYearId: string;
  classId: string;
  status: string;
  enrollmentType: string;
  enrolledAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: e.id,
    studentId: e.studentId,
    academicYearId: e.academicYearId,
    classId: e.classId,
    status: e.status,
    enrollmentType: e.enrollmentType,
    enrolledAt: e.enrolledAt.toISOString(),
    completedAt: e.completedAt ? e.completedAt.toISOString() : null,
  };
}

export function toGuardianJson(g: {
  id: string;
  userId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}) {
  return {
    id: g.id,
    userId: g.userId,
    fullName: g.fullName,
    phone: g.phone,
    email: g.email,
    address: g.address,
  };
}
