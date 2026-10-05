import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { SessionUser } from "../auth/types/session-user";
import { CurriculumService } from "./curriculum.service";
import { CreateCpDto, CreateTpDto, UpdateCpDto, UpdateTpDto } from "./dto/curriculum.dto";

@Controller()
export class CurriculumController {
  constructor(private readonly service: CurriculumService) {}

  @Post("subjects/:subjectId/cp")
  @Roles("SUPERADMIN", "TEACHER")
  async createCp(
    @CurrentUser() user: SessionUser,
    @Param("subjectId") subjectId: string,
    @Body() dto: CreateCpDto,
    @Req() req: Request,
  ) {
    return this.service.createCp(user, subjectId, dto, req);
  }

  @Post("cp/:cpId/tp")
  @Roles("SUPERADMIN", "TEACHER")
  async createTp(
    @CurrentUser() user: SessionUser,
    @Param("cpId") cpId: string,
    @Body() dto: CreateTpDto,
    @Req() req: Request,
  ) {
    return this.service.createTp(user, cpId, dto, req);
  }

  @Get("subjects/:subjectId/curriculum")
  @Roles("SUPERADMIN", "TEACHER")
  async listSubjectCurriculum(
    @CurrentUser() user: SessionUser,
    @Param("subjectId") subjectId: string,
  ) {
    return this.service.listSubjectCurriculum(user, subjectId);
  }

  @Patch("cp/:cpId")
  @Roles("SUPERADMIN", "TEACHER")
  async updateCp(
    @CurrentUser() user: SessionUser,
    @Param("cpId") cpId: string,
    @Body() dto: UpdateCpDto,
    @Req() req: Request,
  ) {
    return this.service.updateCp(user, cpId, dto, req);
  }

  @Delete("cp/:cpId")
  @Roles("SUPERADMIN", "TEACHER")
  async deleteCp(
    @CurrentUser() user: SessionUser,
    @Param("cpId") cpId: string,
    @Req() req: Request,
  ) {
    await this.service.deleteCp(user, cpId, req);
    return { ok: true };
  }

  @Patch("tp/:tpId")
  @Roles("SUPERADMIN", "TEACHER")
  async updateTp(
    @CurrentUser() user: SessionUser,
    @Param("tpId") tpId: string,
    @Body() dto: UpdateTpDto,
    @Req() req: Request,
  ) {
    return this.service.updateTp(user, tpId, dto, req);
  }

  @Delete("tp/:tpId")
  @Roles("SUPERADMIN", "TEACHER")
  async deleteTp(
    @CurrentUser() user: SessionUser,
    @Param("tpId") tpId: string,
    @Req() req: Request,
  ) {
    await this.service.deleteTp(user, tpId, req);
    return { ok: true };
  }
}
