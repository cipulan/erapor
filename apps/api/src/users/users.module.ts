import { Injectable, Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Internal user helpers. The OpenAPI contract exposes no /users endpoints;
 * user provisioning happens through the seed script (and future admin UI).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(schoolId: string, email: string) {
    return this.prisma.user.findFirst({
      where: { schoolId, email: email.trim().toLowerCase() },
    });
  }

  listTeachers(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId, role: "TEACHER", isActive: true },
      orderBy: [{ fullName: "asc" }],
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
  }
}

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
