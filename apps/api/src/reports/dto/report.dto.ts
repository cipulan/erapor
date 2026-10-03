import { IsString, IsUUID, MinLength } from "class-validator";

export class GenerateReportCardDto {
  @IsUUID("4", { message: "studentId tidak valid." })
  studentId!: string;

  @IsUUID("4", { message: "academicYearId tidak valid." })
  academicYearId!: string;

  @IsUUID("4", { message: "semesterId tidak valid." })
  semesterId!: string;
}

export class CreateRevisionDto {
  @IsString()
  @MinLength(1, { message: "Alasan revisi wajib diisi." })
  reason!: string;
}
