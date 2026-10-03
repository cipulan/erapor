import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@erapor/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { APP_CONFIG, AppConfig } from "../config/configuration";

/**
 * Application Prisma client (Prisma 7). The generated client is produced by
 * `npm run db:generate` into packages/database/src/generated/prisma.
 *
 * Prisma 7 requires a driver adapter: `new PrismaClient()` without one
 * throws at runtime. We use PrismaPg with the configured DATABASE_URL.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const adapter = new PrismaPg({ connectionString: config.databaseUrl });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
