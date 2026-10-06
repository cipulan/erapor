import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateGradingSchemeDto {
  @IsUUID("4", { message: "academicYearId tidak valid." })
  academicYearId!: string;

  @IsUUID("4", { message: "semesterId tidak valid." })
  semesterId!: string;
}

export class WeightItemDto {
  @IsUUID("4", { message: "categoryId tidak valid." })
  categoryId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Bobot harus angka maksimal 2 desimal." })
  @Min(0, { message: "Bobot minimal 0." })
  @Max(100, { message: "Bobot maksimal 100." })
  @Type(() => Number)
  weight!: number;
}

export class ReplaceWeightsDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Minimal satu bobot kategori." })
  @ValidateNested({ each: true })
  @Type(() => WeightItemDto)
  weights!: WeightItemDto[];
}

export class UnlockGradingSchemeDto {
  @IsString()
  @MinLength(1, { message: "Alasan buka kunci wajib diisi." })
  @MaxLength(500, { message: "Alasan maksimal 500 karakter." })
  reason!: string;
}

export class UpsertKktpDto {
  @IsUUID("4", { message: "academicYearId tidak valid." })
  academicYearId!: string;

  @IsUUID("4", { message: "semesterId tidak valid." })
  semesterId!: string;

  @IsUUID("4", { message: "subjectId tidak valid." })
  subjectId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Threshold harus angka maksimal 2 desimal." })
  @Min(0, { message: "Threshold minimal 0." })
  @Max(100, { message: "Threshold maksimal 100." })
  @Type(() => Number)
  threshold!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
