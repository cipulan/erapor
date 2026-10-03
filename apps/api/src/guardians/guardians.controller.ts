import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { parsePagination } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { GuardiansService } from "./guardians.service";
import { CreateGuardianDto } from "../students/dto/student.dto";

@Controller("guardians")
export class GuardiansController {
  constructor(private readonly service: GuardiansService) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, parsePagination(query), query.search);
  }

  @Post()
  @Roles("SUPERADMIN")
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateGuardianDto, @Req() req: Request) {
    return this.service.create(user, dto, req);
  }
}
