import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { LoginRateLimitGuard } from "./guards/login-rate-limit.guard";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, RolesGuard, LoginRateLimitGuard],
  exports: [AuthService, SessionAuthGuard, RolesGuard],
})
export class AuthModule {}
