import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import type { SessionUser } from "../auth/types/session-user";
import { DashboardService } from "./dashboard.service";
import { DashboardStatsQueryDto } from "./dto/dashboard.dto";

/**
 * Agregat statistik dashboard. Di bawah global prefix menjadi /api/v1/dashboard.
 * Khusus SUPERADMIN.
 */
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("stats")
  @Roles("SUPERADMIN")
  getStats(@CurrentUser() user: SessionUser, @Query() query: DashboardStatsQueryDto) {
    return this.service.getStats(user, query);
  }
}
