import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import { CreateTeacherAssignmentDto } from "./dto/assignment.dto";

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
  ) {}

  async list(user: SessionUser, filters: Record<string, string>) {
    const where: Record<string, unknown> = {};
    if (user.role === "TEACHER") {
      where.teacherId = user.id;
    } else if (filters.teacherId) {
      where.teacherId = filters.teacherId;
    }
    if (filters.academicYearId) {
      await this.policy.academicYearInSchool(user.schoolId, filters.academicYearId);
      where.academicYearId = filters.academicYearId;
    }
    if (filters.semesterId) {
      await this.policy.semesterInSchool(user.schoolId, filters.semesterId);
      where.semesterId = filters.semesterId;
    }
    if (filters.classId) {
      await this.policy.classInSchool(user.schoolId, filters.classId);
      where.classId = filters.classId;
    }
    if (filters.subjectId) {
      await this.policy.subjectInSchool(user.schoolId, filters.subjectId);
      where.subjectId = filters.subjectId;
    }
    // Assignments are always scoped to the school through their relations.
    where.class = { schoolId: user.schoolId };

    const data = await this.prisma.teacherAssignment.findMany({
      where,
      orderBy: [{ createdAt: "asc" }],
    });
    return data.map(toAssignmentJson);
  }

  async create(user: SessionUser, dto: CreateTeacherAssignmentDto, req: Request) {
    const teacher = await this.prisma.user.findFirst({
      where: { id: dto.teacherId, schoolId: user.schoolId },
    });
    if (!teacher) throw Errors.notFound("Guru");
    if (teacher.role !== "TEACHER") {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Penugasan hanya untuk user dengan role guru.");
    }

    const year = await this.policy.academicYearInSchool(user.schoolId, dto.academicYearId);
    const semester = await this.policy.semesterInSchool(user.schoolId, dto.semesterId);
    if (semester.academicYearId !== year.id) {
      throw Errors.validation(ApiErrorCode.INVALID_SEMESTER, "Semester tidak termasuk dalam tahun ajaran tersebut.");
    }
    const klass = await this.policy.classInSchool(user.schoolId, dto.classId);
    if (klass.academicYearId !== year.id) {
      throw Errors.validation(
        ApiErrorCode.INVALID_ACADEMIC_YEAR,
        "Kelas tidak termasuk dalam tahun ajaran tersebut.",
      );
    }
    await this.policy.subjectInSchool(user.schoolId, dto.subjectId);

    const dup = await this.prisma.teacherAssignment.findFirst({
      where: {
        teacherId: teacher.id,
        semesterId: semester.id,
        classId: klass.id,
        subjectId: dto.subjectId,
      },
      select: { id: true },
    });
    if (dup) {
      throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Penugasan mengajar ini sudah ada.");
    }

    const assignment = await this.prisma.teacherAssignment.create({
      data: {
        teacherId: teacher.id,
        academicYearId: year.id,
        semesterId: semester.id,
        classId: klass.id,
        subjectId: dto.subjectId,
        status: "ACTIVE",
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.ASSIGNMENT_CREATE,
      entityType: "TeacherAssignment",
      entityId: assignment.id,
      afterJson: toAssignmentJson(assignment) as Record<string, unknown>,
    });
    return toAssignmentJson(assignment);
  }
}

export function toAssignmentJson(a: {
  id: string;
  teacherId: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  status: string;
}) {
  return {
    id: a.id,
    teacherId: a.teacherId,
    academicYearId: a.academicYearId,
    semesterId: a.semesterId,
    classId: a.classId,
    subjectId: a.subjectId,
    status: a.status,
  };
}
