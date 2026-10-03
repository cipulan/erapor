import { IsDateString, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAcademicYearDto {
  @IsString()
  @MinLength(1, { message: "Nama tahun ajaran wajib diisi." })
  name!: string;

  @IsDateString({}, { message: "Format tanggal mulai tidak valid (YYYY-MM-DD)." })
  startDate!: string;

  @IsDateString({}, { message: "Format tanggal selesai tidak valid (YYYY-MM-DD)." })
  endDate!: string;
}

export class CreateSemesterDto {
  @IsIn(["ODD", "EVEN"], { message: "Kode semester harus ODD atau EVEN." })
  code!: "ODD" | "EVEN";

  @IsString()
  @MinLength(1, { message: "Nama semester wajib diisi." })
  name!: string;

  @IsOptional()
  @IsDateString({}, { message: "Format tanggal mulai tidak valid (YYYY-MM-DD)." })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: "Format tanggal selesai tidak valid (YYYY-MM-DD)." })
  endDate?: string;
}
