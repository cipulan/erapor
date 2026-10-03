import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateSchoolDto {
  @IsString()
  @MinLength(3, { message: "Nama sekolah minimal 3 karakter." })
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: "Email sekolah tidak valid." })
  email?: string;

  @IsOptional()
  @IsString()
  headmasterName?: string;

  @IsOptional()
  @IsString()
  headmasterNip?: string;
}
