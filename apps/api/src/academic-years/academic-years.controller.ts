import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { parsePagination } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { AcademicYearsService } from "./academic-years.service";
import { CreateAcademicYearDto, CreateSemesterDto } from "./dto/academic-year.dto";

@Controller("academic-years")
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, parsePagination(query), query.status);
  }

  @Post()
  @Roles("SUPERADMIN")
  async create(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateAcademicYearDto,
    @Req() req: Request,
  ) {
    return this.service.create(user, dto, req);
  }

  @Get(":id")
  @Roles("SUPERADMIN", "TEACHER")
  async get(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.service.get(user, id);
  }

  @Post(":id/activate")
  @HttpCode(200)
  @Roles("SUPERADMIN")
  async activate(@CurrentUser() user: SessionUser, @Param("id") id: string, @Req() req: Request) {
    return this.service.activate(user, id, req);
  }

  @Get(":id/semesters")
  @Roles("SUPERADMIN", "TEACHER")
  async listSemesters(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.service.listSemesters(user, id);
  }

  @Post(":id/semesters")
  @Roles("SUPERADMIN")
  async createSemester(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: CreateSemesterDto,
    @Req() req: Request,
  ) {
    return this.service.createSemester(user, id, dto, req);
  }
}
