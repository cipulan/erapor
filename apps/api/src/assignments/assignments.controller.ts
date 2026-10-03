import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { SessionUser } from "../auth/types/session-user";
import { AssignmentsService } from "./assignments.service";
import { CreateTeacherAssignmentDto } from "./dto/assignment.dto";

@Controller("teacher-assignments")
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER")
  async list(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.list(user, query);
  }

  @Post()
  @Roles("SUPERADMIN")
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateTeacherAssignmentDto, @Req() req: Request) {
    return this.service.create(user, dto, req);
  }
}
