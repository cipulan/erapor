import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { SessionUser } from "../auth/types/session-user";
import { SchoolService } from "./school.service";
import { UpdateSchoolDto } from "./dto/school.dto";

/**
 * Profil sekolah. Di bawah global prefix menjadi /api/v1/school.
 * GET untuk semua role login; PUT khusus SUPERADMIN.
 */
@Controller("school")
export class SchoolController {
  constructor(private readonly service: SchoolService) {}

  @Get()
  getSchool(@CurrentUser() user: SessionUser) {
    return this.service.getSchool(user);
  }

  @Put()
  @Roles("SUPERADMIN")
  updateSchool(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateSchoolDto,
    @Req() req: Request,
  ) {
    return this.service.updateSchool(user, dto, req);
  }
}
