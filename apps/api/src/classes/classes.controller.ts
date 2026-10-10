import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { parsePagination } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { ClassesService } from "./classes.service";
import { CreateClassDto, PromoteClassDto, UpdateClassDto } from "./dto/class.dto";

@Controller("classes")
export class ClassesController {
  constructor(private readonly service: ClassesService) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER", "PARENT")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, parsePagination(query), query.academicYearId);
  }

  @Post()
  @Roles("SUPERADMIN")
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateClassDto, @Req() req: Request) {
    return this.service.create(user, dto, req);
  }

  @Patch(":id")
  @Roles("SUPERADMIN")
  async update(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: UpdateClassDto,
    @Req() req: Request,
  ) {
    return this.service.update(user, id, dto, req);
  }

  @Post(":id/promote")
  @HttpCode(200)
  @Roles("SUPERADMIN")
  async promote(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: PromoteClassDto,
    @Req() req: Request,
  ) {
    return this.service.promote(user, id, dto, req);
  }
}
