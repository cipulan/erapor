import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

/** PUT /profile — ubah nama lengkap sendiri. */
export class UpdateProfileDto {
  @IsString({ message: "Nama lengkap harus berupa teks." })
  @MinLength(3, { message: "Nama lengkap minimal 3 karakter." })
  fullName!: string;

  @IsOptional()
  @IsString({ message: "NBM harus berupa teks." })
  nbm?: string | null;
}

/** POST /profile/change-password — ubah password sendiri. */
export class ChangePasswordDto {
  @IsString({ message: "Password saat ini wajib diisi." })
  currentPassword!: string;

  @IsString({ message: "Password baru wajib diisi." })
  @MinLength(8, { message: "Password baru minimal 8 karakter." })
  newPassword!: string;
}

export const MANAGEABLE_ROLES = ["TEACHER", "PARENT"] as const;
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

/** POST /users — admin membuat akun guru/wali. */
export class CreateUserDto {
  @IsEmail({}, { message: "Format email tidak valid." })
  email!: string;

  @IsString({ message: "Nama lengkap harus berupa teks." })
  @MinLength(3, { message: "Nama lengkap minimal 3 karakter." })
  fullName!: string;

  @IsIn(MANAGEABLE_ROLES as unknown as string[], {
    message: "Role harus TEACHER atau PARENT.",
  })
  role!: ManageableRole;

  @IsOptional()
  @IsString({ message: "Password harus berupa teks." })
  @MinLength(8, { message: "Password minimal 8 karakter." })
  password?: string;
}

/** POST /users/:id/reset-password — admin me-reset password (opsional manual). */
export class ResetPasswordDto {
  @IsOptional()
  @IsString({ message: "Password harus berupa teks." })
  @MinLength(8, { message: "Password minimal 8 karakter." })
  newPassword?: string;
}

/** PATCH /users/:id — admin mengaktifkan/menonaktifkan akun. */
export class SetUserActiveDto {
  @IsBoolean({ message: "isActive harus berupa boolean." })
  isActive!: boolean;
}

/** PATCH /users/:id/profile — admin mengubah nama/email akun guru/wali. */
export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: "Nama lengkap harus berupa teks." })
  @MinLength(3, { message: "Nama lengkap minimal 3 karakter." })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: "Format email tidak valid." })
  email?: string;

  @IsOptional()
  @IsString({ message: "NBM harus berupa teks." })
  nbm?: string | null;
}

/** PATCH /users/:id/role — admin promote/demote role akun (termasuk SUPERADMIN). */
export class UpdateUserRoleDto {
  @IsIn(["TEACHER", "PARENT", "SUPERADMIN"], {
    message: "Role harus TEACHER, PARENT, atau SUPERADMIN.",
  })
  role!: "TEACHER" | "PARENT" | "SUPERADMIN";
}
