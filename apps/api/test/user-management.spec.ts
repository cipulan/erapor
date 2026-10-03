/** Unit tests untuk manajemen akun: DTO, generatePassword, dan RolesGuard. Tanpa DB. */
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { generatePassword } from "../src/auth/crypto";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { Public, Roles } from "../src/common/decorators/roles.decorator";
import {
  ChangePasswordDto,
  CreateUserDto,
  ResetPasswordDto,
  SetUserActiveDto,
  UpdateProfileDto,
} from "../src/users/dto/user.dto";

describe("generatePassword", () => {
  it("menghasilkan password 12 karakter secara default", () => {
    const pw = generatePassword();
    expect(pw).toHaveLength(12);
    expect(pw).toMatch(/^[A-Za-z2-9]+$/);
  });

  it("menegakkan panjang minimum 8", () => {
    expect(generatePassword(3)).toHaveLength(8);
    expect(generatePassword(20)).toHaveLength(20);
  });

  it("menghasilkan nilai unik", () => {
    const set = new Set(Array.from({ length: 200 }, () => generatePassword()));
    expect(set.size).toBe(200);
  });
});

describe("UpdateProfileDto", () => {
  it("menolak nama < 3 karakter", async () => {
    const dto = new UpdateProfileDto();
    dto.fullName = "Bu";
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toBeDefined();
  });

  it("menerima nama valid", async () => {
    const dto = new UpdateProfileDto();
    dto.fullName = "Budi Santoso";
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe("ChangePasswordDto", () => {
  it("menolak password baru < 8 karakter", async () => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = "lama12345";
    dto.newPassword = "pendek";
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "newPassword")).toBe(true);
  });
});

describe("CreateUserDto", () => {
  function validDto() {
    const dto = new CreateUserDto();
    dto.email = "guru@sekolah.id";
    dto.fullName = "Guru Baru";
    dto.role = "TEACHER";
    return dto;
  }

  it("menerima DTO valid tanpa password (auto-generate)", async () => {
    expect(await validate(validDto())).toHaveLength(0);
  });

  it("menolak email tidak valid", async () => {
    const dto = validDto();
    dto.email = "bukan-email";
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("menolak role selain TEACHER/PARENT", async () => {
    const dto = validDto();
    (dto as unknown as { role: string }).role = "SUPERADMIN";
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "role")).toBe(true);
  });

  it("menolak password < 8 karakter bila diisi", async () => {
    const dto = validDto();
    dto.password = "pendek";
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });
});

describe("ResetPasswordDto", () => {
  it("boleh kosong (auto-generate)", async () => {
    expect(await validate(new ResetPasswordDto())).toHaveLength(0);
  });

  it("menolak newPassword < 8 karakter", async () => {
    const dto = new ResetPasswordDto();
    dto.newPassword = "abc";
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "newPassword")).toBe(true);
  });
});

describe("SetUserActiveDto", () => {
  it("menolak isActive bukan boolean", async () => {
    const dto = new SetUserActiveDto();
    (dto as unknown as { isActive: string }).isActive = "ya";
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "isActive")).toBe(true);
  });
});

describe("RolesGuard untuk endpoint admin", () => {
  const guard = new RolesGuard(new Reflector());

  function contextFor(handler: object, cls: object, role?: string): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    } as unknown as ExecutionContext;
  }

  class AdminOnly {
    @Roles("SUPERADMIN")
    handler() {}
  }

  it("mengizinkan SUPERADMIN", () => {
    const ctx = contextFor(AdminOnly.prototype.handler, AdminOnly, "SUPERADMIN");
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("menolak TEACHER dengan 403", () => {
    const ctx = contextFor(AdminOnly.prototype.handler, AdminOnly, "TEACHER");
    expect(() => guard.canActivate(ctx)).toThrowError(/Akses ditolak/);
  });

  it("mengizinkan endpoint @Public tanpa login", () => {
    class Terbuka {
      @Public()
      handler() {}
    }
    const ctx = contextFor(Terbuka.prototype.handler, Terbuka, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("mengizinkan semua role bila tanpa @Roles", () => {
    class Bebas {
      handler() {}
    }
    for (const role of ["SUPERADMIN", "TEACHER", "PARENT"]) {
      const ctx = contextFor(Bebas.prototype.handler, Bebas, role);
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });
});
