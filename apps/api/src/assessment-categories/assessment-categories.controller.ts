import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { SessionUser } from "../auth/types/session-user";
import { AssessmentCategoriesService } from "./assessment-categories.service";
import { CreateAssessmentCategoryDto } from "./dto/assessment-category.dto";

@Controller("assessment-categories")
export class AssessmentCategoriesController {
  constructor(private readonly service: AssessmentCategoriesService) {}

  @Get()
  @Roles("SUPERADMIN", "TEACHER")
  async list(@CurrentUser() user: SessionUser, @Query("active") active?: string) {
    return this.service.list(user, active);
  }

  @Post()
  @Roles("SUPERADMIN")
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateAssessmentCategoryDto, @Req() req: Request) {
    return this.service.create(user, dto, req);
  }
}
