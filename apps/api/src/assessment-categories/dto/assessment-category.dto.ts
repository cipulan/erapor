import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateAssessmentCategoryDto {
  @IsString()
  @MinLength(1, { message: "Nama kategori wajib diisi." })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
