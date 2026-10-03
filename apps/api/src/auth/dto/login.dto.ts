import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "Format email tidak valid." })
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password minimal 8 karakter." })
  password!: string;
}
