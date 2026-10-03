import { Module } from "@nestjs/common";
import { ProfileController } from "./profile.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/**
 * Manajemen akun pengguna. PrismaService, AuditService, dan APP_CONFIG
 * berasal dari module global sehingga tidak perlu diimpor di sini.
 */
@Module({
  controllers: [ProfileController, UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
