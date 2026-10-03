import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/roles.decorator";
import { SessionUser } from "./types/session-user";
import { AuthService, AuthMeResponse } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { LoginRateLimitGuard } from "./guards/login-rate-limit.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(LoginRateLimitGuard)
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthMeResponse> {
    return this.authService.login(dto, req, res);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.authService.logout(req, res, user);
  }

  @Get("me")
  async me(@CurrentUser() user: SessionUser): Promise<AuthMeResponse> {
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: true,
      },
    };
  }
}
