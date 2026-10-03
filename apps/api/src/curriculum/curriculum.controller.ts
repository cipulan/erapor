import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { SessionUser } from "../auth/types/session-user";
import { CurriculumService } from "./curriculum.service";
import { CreateCpDto, CreateTpDto } from "./dto/curriculum.dto";

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
}
