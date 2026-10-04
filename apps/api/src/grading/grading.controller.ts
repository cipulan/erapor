import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { SessionUser } from "../auth/types/session-user";
import { GradingService } from "./grading.service";
import { CreateGradingSchemeDto, ReplaceWeightsDto, UpsertKktpDto } from "./dto/grading.dto";

@Controller()
export class GradingController {
  constructor(private readonly service: GradingService) {}

  @Get("grading-schemes")
  @Roles("SUPERADMIN", "TEACHER")
  async listSchemes(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.listSchemes(user, query);
  }

  @Post("grading-schemes")
  @Roles("SUPERADMIN")
  async createScheme(@CurrentUser() user: SessionUser, @Body() dto: CreateGradingSchemeDto, @Req() req: Request) {
    return this.service.createScheme(user, dto, req);
  }

  @Put("grading-schemes/:id/weights")
  @Roles("SUPERADMIN")
  async replaceWeights(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: ReplaceWeightsDto,
    @Req() req: Request,
  ) {
    return this.service.replaceWeights(user, id, dto, req);
  }

  @Post("grading-schemes/:id/publish")
  @HttpCode(200)
  @Roles("SUPERADMIN")
  async publishScheme(@CurrentUser() user: SessionUser, @Param("id") id: string, @Req() req: Request) {
    return this.service.publishScheme(user, id, req);
  }

  @Post("grading-schemes/:id/unpublish")
  @HttpCode(200)
  @Roles("SUPERADMIN")
  async unpublishScheme(@CurrentUser() user: SessionUser, @Param("id") id: string, @Req() req: Request) {
    return this.service.unpublishScheme(user, id, req);
  }

  @Get("kktp-configurations")
  @Roles("SUPERADMIN", "TEACHER")
  async listKktp(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.listKktp(user, query);
  }

  @Post("kktp-configurations")
  @HttpCode(200)
  @Roles("SUPERADMIN")
  async upsertKktp(@CurrentUser() user: SessionUser, @Body() dto: UpsertKktpDto, @Req() req: Request) {
    return this.service.upsertKktp(user, dto, req);
  }

  @Get("grading/students/:studentId")
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async preview(
    @CurrentUser() user: SessionUser,
    @Param("studentId") studentId: string,
    @Query("academicYearId") academicYearId: string,
    @Query("semesterId") semesterId: string,
    @Query("subjectId") subjectId: string,
  ) {
    return this.service.previewStudentGrade(user, studentId, academicYearId, semesterId, subjectId);
  }
}
