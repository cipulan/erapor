import { IsString, MinLength } from "class-validator";

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
