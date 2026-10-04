import { IsOptional, IsUUID } from "class-validator";

export class DashboardStatsQueryDto {
  @IsOptional()
  @IsUUID("4", { message: "academicYearId harus UUID yang valid." })
  academicYearId?: string;

  @IsOptional()
  @IsUUID("4", { message: "semesterId harus UUID yang valid." })
  semesterId?: string;
}
