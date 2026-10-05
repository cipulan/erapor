import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateCpDto {
  @IsString()
  @MinLength(1, { message: "Kode CP wajib diisi." })
  code!: string;

  @IsString()
  @MinLength(1, { message: "Deskripsi CP wajib diisi." })
  description!: string;
}

export class CreateTpDto {
  @IsString()
  @MinLength(1, { message: "Kode TP wajib diisi." })
  code!: string;

  @IsString()
  @MinLength(1, { message: "Deskripsi TP wajib diisi." })
  description!: string;
}

export class UpdateCpDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Kode CP wajib diisi." })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Deskripsi CP wajib diisi." })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: "Status aktif harus boolean." })
  isActive?: boolean;
}

export class UpdateTpDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Kode TP wajib diisi." })
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Deskripsi TP wajib diisi." })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: "Status aktif harus boolean." })
  isActive?: boolean;
}
