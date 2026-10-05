import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

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

export class UpdateSubjectDescriptionDto {
  @IsString()
  @MinLength(1, { message: "Deskripsi wajib diisi." })
  @MaxLength(2000, { message: "Deskripsi maksimal 2000 karakter." })
  description!: string;
}

/**
 * Kelengkapan rapor oleh wali kelas (Fase 4). Semua field opsional;
 * string kosong/null mengosongkan nilai yang tersimpan.
 */
export class UpdateCompletenessDto {
  @IsOptional()
  @IsString()
  @MaxLength(3000, { message: "Deskripsi kokurikuler maksimal 3000 karakter." })
  cocurricularDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Catatan wali kelas maksimal 2000 karakter." })
  homeroomNotes?: string | null;

  @IsOptional()
  @IsInt({ message: "Jumlah hari harus bilangan bulat." })
  @Min(0)
  @Max(365)
  sickDays?: number;

  @IsOptional()
  @IsInt({ message: "Jumlah hari harus bilangan bulat." })
  @Min(0)
  @Max(365)
  permissionDays?: number;

  @IsOptional()
  @IsInt({ message: "Jumlah hari harus bilangan bulat." })
  @Min(0)
  @Max(365)
  unexcusedDays?: number;
}

export class ExtracurricularInputDto {
  @IsString()
  @MinLength(1, { message: "Nama kegiatan wajib diisi." })
  @MaxLength(120, { message: "Nama kegiatan maksimal 120 karakter." })
  name!: string;

  @IsIn(["A", "B", "C", "D"], { message: "Predikat harus A, B, C, atau D." })
  predicate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Deskripsi maksimal 1000 karakter." })
  description?: string | null;
}
