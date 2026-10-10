import { Inject, Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { APP_CONFIG, AppConfig } from "../config/configuration";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import { Paginated, PaginationParams, buildPaginated } from "../common/http/pagination";
import type { SessionUser } from "../auth/types/session-user";
import { generatePassword, hashPassword, verifyPassword } from "../auth/crypto";
import {
  ChangePasswordDto,
  CreateUserDto,
  ResetPasswordDto,
  SetUserActiveDto,
  UpdateProfileDto,
  UpdateUserDto,
  UpdateUserRoleDto,
} from "./dto/user.dto";

const profileSelect = {
  id: true,
  email: true,
  fullName: true,
  nbm: true,
  role: true,
  isActive: true,
  school: { select: { name: true } },
} as const;

const userItemSelect = {
  id: true,
  email: true,
  fullName: true,
  nbm: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
} as const;

type ProfileRecord = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  school: { name: string };
};

function toProfileJson(record: ProfileRecord) {
  return {
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    role: record.role,
    isActive: record.isActive,
    schoolName: record.school.name,
  };
}

/**
 * Manajemen akun pengguna: profil & password milik sendiri (semua role),
 * serta CRUD akun guru/wali oleh SUPERADMIN. School selalu diambil dari
 * sesi (BR-001) — tidak pernah dari input client.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  findByEmail(schoolId: string, email: string) {
    return this.prisma.user.findFirst({
      where: { schoolId, email: email.trim().toLowerCase() },
    });
  }

  listTeachers(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId, role: "TEACHER", isActive: true },
      orderBy: [{ fullName: "asc" }],
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
  }

  // ---------- Profil sendiri ----------

  async getProfile(user: SessionUser) {
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: profileSelect,
    });
    if (!record) throw Errors.sessionExpired();
    return toProfileJson(record);
  }

  async updateProfile(user: SessionUser, dto: UpdateProfileDto, req: Request) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { fullName: dto.fullName.trim(), ...(dto.nbm !== undefined ? { nbm: dto.nbm?.trim() || null } : {}) },
      select: profileSelect,
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.PROFILE_UPDATE,
      entityType: "User",
      entityId: user.id,
      afterJson: { fullName: updated.fullName },
    });
    return toProfileJson(updated);
  }

  async changePassword(user: SessionUser, dto: ChangePasswordDto, req: Request) {
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });
    const ok = record ? await verifyPassword(dto.currentPassword, record.passwordHash) : false;
    if (!ok) {
      throw Errors.invalidCredentials();
    }
    if (dto.currentPassword === dto.newPassword) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Password baru tidak boleh sama dengan password saat ini.",
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(dto.newPassword, this.config.bcryptRounds) },
    });
    // Cabut semua sesi lain user ini; sesi yang sedang dipakai dipertahankan.
    await this.prisma.session.updateMany({
      where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.PASSWORD_CHANGE,
      entityType: "User",
      entityId: user.id,
    });
    return { message: "Password berhasil diubah." };
  }

  // ---------- Admin: kelola akun guru/wali ----------

  /** Target kelola antar-admin: boleh role apapun (termasuk SUPERADMIN), tetap satu sekolah. */
  private async anyTarget(admin: SessionUser, id: string) {
    const target = await this.prisma.user.findFirst({
      where: { id, schoolId: admin.schoolId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
    if (!target) {
      throw Errors.notFound("Pengguna");
    }
    return target;
  }

  /** Sekolah tidak boleh kehabisan superadmin aktif. */
  private async assertNotLastActiveSuperadmin(admin: SessionUser, targetId: string) {
    const others = await this.prisma.user.count({
      where: {
        schoolId: admin.schoolId,
        role: "SUPERADMIN",
        isActive: true,
        id: { not: targetId },
      },
    });
    if (others === 0) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Tidak dapat memproses: sekolah harus memiliki minimal satu superadmin aktif.",
      );
    }
  }

  async listUsers(
    user: SessionUser,
    params: PaginationParams,
    role: string | undefined,
    q: string | undefined,
  ): Promise<Paginated<unknown>> {
    const ALLOWED_ROLES = ["TEACHER", "PARENT", "SUPERADMIN"] as const;
    if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Parameter role wajib diisi: TEACHER, PARENT, atau SUPERADMIN.",
      );
    }
    const keyword = q?.trim();
    const where = {
      schoolId: user.schoolId,
      role: role as "TEACHER" | "PARENT" | "SUPERADMIN",
      ...(keyword
        ? {
            OR: [
              { fullName: { contains: keyword, mode: "insensitive" as const } },
              { email: { contains: keyword, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userItemSelect,
        orderBy: [{ fullName: "asc" }],
        skip: params.skip,
        take: params.limit,
      }),
    ]);
    return buildPaginated(data, total, params);
  }

  async createUser(admin: SessionUser, dto: CreateUserDto, req: Request) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { schoolId: admin.schoolId, email },
      select: { id: true },
    });
    if (existing) {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        "Email sudah digunakan oleh akun lain di sekolah ini.",
      );
    }
    const generated = !dto.password || dto.password.length === 0;
    const password = generated ? generatePassword(12) : dto.password!;
    const created = await this.prisma.user.create({
      data: {
        schoolId: admin.schoolId,
        email,
        fullName: dto.fullName.trim(),
        role: dto.role,
        passwordHash: await hashPassword(password, this.config.bcryptRounds),
        isActive: true,
      },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
    await this.audit.log({
      req,
      schoolId: admin.schoolId,
      actorUserId: admin.id,
      action: AuditAction.USER_CREATE,
      entityType: "User",
      entityId: created.id,
      afterJson: { email: created.email, fullName: created.fullName, role: created.role },
    });
    return {
      user: created,
      ...(generated ? { generatedPassword: password } : {}),
    };
  }

  async resetPassword(admin: SessionUser, id: string, dto: ResetPasswordDto, req: Request) {
    if (id === admin.id) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Gunakan menu Profil untuk mengganti password akun sendiri.",
      );
    }
    const target = await this.anyTarget(admin, id);
    const generated = !dto.newPassword || dto.newPassword.length === 0;
    const newPassword = generated ? generatePassword(12) : dto.newPassword!;
    await this.prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(newPassword, this.config.bcryptRounds) },
    });
    // Cabut SEMUA sesi user tersebut (termasuk yang sedang aktif).
    await this.prisma.session.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      req,
      schoolId: admin.schoolId,
      actorUserId: admin.id,
      action: AuditAction.USER_PASSWORD_RESET,
      entityType: "User",
      entityId: target.id,
    });
    return generated ? { generatedPassword: newPassword } : {};
  }

  async setActive(admin: SessionUser, id: string, dto: SetUserActiveDto, req: Request) {
    if (id === admin.id) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Anda tidak dapat menonaktifkan akun sendiri.",
      );
    }
    const target = await this.anyTarget(admin, id);
    if (target.role === "SUPERADMIN" && !dto.isActive) {
      await this.assertNotLastActiveSuperadmin(admin, target.id);
    }
    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { isActive: dto.isActive },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
    if (!dto.isActive) {
      await this.prisma.session.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      req,
      schoolId: admin.schoolId,
      actorUserId: admin.id,
      action: AuditAction.USER_STATUS_UPDATE,
      entityType: "User",
      entityId: target.id,
      afterJson: { isActive: dto.isActive },
    });
    return updated;
  }

  /** Admin (SUPERADMIN) mengubah nama/email akun guru/wali. */
  async updateUser(admin: SessionUser, id: string, dto: UpdateUserDto, req: Request) {
    if (id === admin.id) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Gunakan menu Profil untuk mengubah data akun sendiri.",
      );
    }
    const target = await this.anyTarget(admin, id);
    const data: { fullName?: string; email?: string; nbm?: string | null } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.nbm !== undefined) data.nbm = dto.nbm?.trim() || null;
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const dup = await this.prisma.user.findFirst({
        where: { schoolId: admin.schoolId, email, id: { not: target.id } },
        select: { id: true },
      });
      if (dup) {
        throw Errors.conflict(ApiErrorCode.RESOURCE_CONFLICT, "Email sudah digunakan akun lain.");
      }
      data.email = email;
    }
    if (Object.keys(data).length === 0) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Tidak ada perubahan yang dikirim.");
    }
    const before = { fullName: target.fullName, email: target.email };
    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data,
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
    await this.audit.log({
      req,
      schoolId: admin.schoolId,
      actorUserId: admin.id,
      action: AuditAction.USER_UPDATE,
      entityType: "User",
      entityId: target.id,
      beforeJson: before,
      afterJson: data,
    });
    return updated;
  }

  /** Admin (SUPERADMIN) promote/demote role akun — termasuk antar-superadmin. */
  async updateRole(admin: SessionUser, id: string, dto: UpdateUserRoleDto, req: Request) {
    if (id === admin.id) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Anda tidak dapat mengubah role akun sendiri.",
      );
    }
    const target = await this.anyTarget(admin, id);
    if (target.role === dto.role) {
      throw Errors.validation(ApiErrorCode.VALIDATION_ERROR, "Role akun sudah sama.");
    }
    if (target.role === "SUPERADMIN" && dto.role !== "SUPERADMIN") {
      await this.assertNotLastActiveSuperadmin(admin, target.id);
    }
    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { role: dto.role },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
    await this.audit.log({
      req,
      schoolId: admin.schoolId,
      actorUserId: admin.id,
      action: AuditAction.USER_ROLE_UPDATE,
      entityType: "User",
      entityId: target.id,
      beforeJson: { role: target.role },
      afterJson: { role: dto.role },
    });
    return updated;
  }
}
