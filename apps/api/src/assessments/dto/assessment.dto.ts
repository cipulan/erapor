import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
export class CreateAssessmentDto {
  @IsUUID("4", { message: "teacherAssignmentId tidak valid." })
  teacherAssignmentId!: string;

  @IsUUID("4", { message: "semesterId tidak valid." })
  semesterId!: string;

  @IsUUID("4", { message: "classId tidak valid." })
  classId!: string;

  @IsUUID("4", { message: "subjectId tidak valid." })
  subjectId!: string;

  @IsUUID("4", { message: "categoryId tidak valid." })
  categoryId!: string;

  @IsString()
  @MinLength(1, { message: "Judul asesmen wajib diisi." })
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString({}, { message: "Format tanggal asesmen tidak valid (YYYY-MM-DD)." })
  assessmentDate?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Nilai maksimum harus angka maksimal 2 desimal." })
  @Type(() => Number)
  maxScore!: number;

  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "CLOSED"], { message: "Status asesmen tidak valid." })
  status?: "DRAFT" | "PUBLISHED" | "CLOSED";

  @IsOptional()
  @IsArray({ message: "Daftar TP harus berupa array." })
  @IsUUID("4", { each: true, message: "tpId tidak valid." })
  tpIds?: string[];
}

export class SetAssessmentTpsDto {
  @IsArray({ message: "Daftar TP harus berupa array." })
  @IsUUID("4", { each: true, message: "tpId tidak valid." })
  tpIds!: string[];
}

export class ScoreItemDto {
  @IsUUID("4", { message: "studentId tidak valid." })
  studentId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Nilai harus angka maksimal 2 desimal." })
  @Type(() => Number)
  score!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkScoresDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Minimal satu nilai." })
  @ValidateNested({ each: true })
  @Type(() => ScoreItemDto)
  scores!: ScoreItemDto[];
}

export class ImportCommitDto {
  @IsUUID("4", { message: "importId tidak valid." })
  importId!: string;
}
