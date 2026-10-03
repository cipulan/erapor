import { Body, Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { SessionUser } from "../auth/types/session-user";
import { UsersService } from "./users.service";
import { ChangePasswordDto, UpdateProfileDto } from "./dto/user.dto";

/**
 * Profil & password milik sendiri. Di bawah global prefix menjadi
 * /api/v1/profile. Semua method hanya butuh login (SessionAuthGuard
 * global); tanpa @Roles sehingga berlaku untuk semua role.
 */
@Controller("profile")
export class ProfileController {
  constructor(private readonly service: UsersService) {}

  @Get()
  getProfile(@CurrentUser() user: SessionUser) {
    return this.service.getProfile(user);
  }

  @Put()
  updateProfile(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    return this.service.updateProfile(user, dto, req);
  }

  @Post("change-password")
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: SessionUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.service.changePassword(user, dto, req);
  }
}
