import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class CreateClassDto {
  @IsUUID("4", { message: "academicYearId tidak valid." })
  academicYearId!: string;

  @IsString()
  @MinLength(1, { message: "Nama kelas wajib diisi." })
  name!: string;

  @IsInt({ message: "Tingkat kelas harus bilangan bulat." })
  @Min(1, { message: "Tingkat kelas minimal 1." })
  @Max(6, { message: "Tingkat kelas maksimal 6." })
  gradeLevel!: number;

  @IsOptional()
  @IsUUID("4", { message: "homeroomTeacherId tidak valid." })
  homeroomTeacherId?: string;
}

/** PATCH /classes/:id — admin mengubah nama / wali kelas (gradeLevel immutable). */
export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Nama kelas wajib diisi." })
  name?: string;

  @IsOptional()
  @IsUUID("4", { message: "homeroomTeacherId tidak valid." })
  homeroomTeacherId?: string | null;
}

export class PromoteClassDto {
  @IsUUID("4", { message: "targetAcademicYearId tidak valid." })
  targetAcademicYearId!: string;

  @IsUUID("4", { message: "targetClassId tidak valid." })
  targetClassId!: string;

  @IsOptional()
  @IsUUID("4", { each: true, message: "studentIds harus berisi UUID valid." })
  studentIds?: string[];

  @IsOptional()
  @IsIn(["PROMOTED", "REPEATED"], { message: "Tipe enrollment tidak valid." })
  enrollmentType?: "PROMOTED" | "REPEATED";
}
