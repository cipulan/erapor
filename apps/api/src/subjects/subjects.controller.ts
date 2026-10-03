import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { parsePagination } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { CreateSubjectDto, SubjectsService } from "./subjects.service";

@Controller("subjects")
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, parsePagination(query), query.active);
  }

  @Post()
  @Roles("SUPERADMIN")
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateSubjectDto, @Req() req: Request) {
    return this.service.create(user, dto, req);
  }
}
