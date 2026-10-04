import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { parsePagination } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { UsersService } from "./users.service";
import {
  CreateUserDto,
  ResetPasswordDto,
  SetUserActiveDto,
  UpdateUserDto,
  UpdateUserRoleDto,
} from "./dto/user.dto";

/**
 * Kelola akun guru & wali oleh SUPERADMIN. Di bawah global prefix
 * menjadi /api/v1/users. Endpoint profil diri ada di ProfileController
 * (/api/v1/profile).
 */
@Controller("users")
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Roles("SUPERADMIN")
  listUsers(@CurrentUser() user: SessionUser, @Query() query: Record<string, string>) {
    return this.service.listUsers(user, parsePagination(query), query.role, query.q);
  }

  @Post()
  @Roles("SUPERADMIN")
  createUser(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateUserDto,
    @Req() req: Request,
  ) {
    return this.service.createUser(user, dto, req);
  }

  @Post(":id/reset-password")
  @HttpCode(200)
  @Roles("SUPERADMIN")
  resetPassword(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    return this.service.resetPassword(user, id, dto, req);
  }

  @Patch(":id")
  @Roles("SUPERADMIN")
  setActive(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: SetUserActiveDto,
    @Req() req: Request,
  ) {
    return this.service.setActive(user, id, dto, req);
  }

  @Patch(":id/profile")
  @Roles("SUPERADMIN")
  updateUser(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.service.updateUser(user, id, dto, req);
  }

  @Patch(":id/role")
  @Roles("SUPERADMIN")
  updateRole(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: Request,
  ) {
    return this.service.updateRole(user, id, dto, req);
  }
}
