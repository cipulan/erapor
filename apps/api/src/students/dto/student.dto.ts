import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  nis?: string;

  @IsOptional()
  @IsString()
  nisn?: string;

  @IsString()
  @MinLength(1, { message: "Nama lengkap wajib diisi." })
  fullName!: string;

  @IsOptional()
  @IsIn(["MALE", "FEMALE"], { message: "Jenis kelamin harus MALE atau FEMALE." })
  gender?: "MALE" | "FEMALE";

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @IsDateString({}, { message: "Format tanggal lahir tidak valid (YYYY-MM-DD)." })
  birthDate?: string;
}

/** PATCH /students/:id — admin mengubah data diri siswa (semua field opsional). */
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  nis?: string;

  @IsOptional()
  @IsString()
  nisn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Nama lengkap wajib diisi." })
  fullName?: string;

  @IsOptional()
  @IsIn(["MALE", "FEMALE"], { message: "Jenis kelamin harus MALE atau FEMALE." })
  gender?: "MALE" | "FEMALE";

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @IsDateString({}, { message: "Format tanggal lahir tidak valid (YYYY-MM-DD)." })
  birthDate?: string;
}

export class CreateEnrollmentDto {
  @IsUUID("4", { message: "academicYearId tidak valid." })
  academicYearId!: string;

  @IsUUID("4", { message: "classId tidak valid." })
  classId!: string;

  @IsIn(["NEW", "PROMOTED", "REPEATED", "TRANSFERRED"], {
    message: "Tipe enrollment tidak valid.",
  })
  enrollmentType!: "NEW" | "PROMOTED" | "REPEATED" | "TRANSFERRED";
}

export class LinkGuardianDto {
  @IsUUID("4", { message: "guardianId tidak valid." })
  guardianId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateGuardianDto {
  @IsString()
  @MinLength(1, { message: "Nama lengkap wali wajib diisi." })
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
