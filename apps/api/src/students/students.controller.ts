import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { parsePagination } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { StudentsService } from "./students.service";
import { CreateEnrollmentDto, CreateStudentDto, LinkGuardianDto, UpdateStudentDto } from "./dto/student.dto";

@Controller("students")
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, parsePagination(query), {
      search: query.search,
      classId: query.classId,
      academicYearId: query.academicYearId,
      status: query.status,
    });
  }

  @Post()
  @Roles("SUPERADMIN")
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateStudentDto, @Req() req: Request) {
    return this.service.create(user, dto, req);
  }

  @Patch(":id")
  @Roles("SUPERADMIN")
  async update(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: UpdateStudentDto,
    @Req() req: Request,
  ) {
    return this.service.update(user, id, dto, req);
  }

  @Get(":id")
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async get(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.service.get(user, id);
  }

  @Get(":id/enrollments")
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async listEnrollments(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.service.listEnrollments(user, id);
  }

  @Post(":id/enrollments")
  @Roles("SUPERADMIN")
  async createEnrollment(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: CreateEnrollmentDto,
    @Req() req: Request,
  ) {
    return this.service.createEnrollment(user, id, dto, req);
  }

  @Get(":id/guardians")
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async listGuardians(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.service.listGuardians(user, id);
  }

  @Post(":id/guardians")
  @Roles("SUPERADMIN")
  async linkGuardian(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: LinkGuardianDto,
    @Req() req: Request,
  ) {
    return this.service.linkGuardian(user, id, dto, req);
  }
}
