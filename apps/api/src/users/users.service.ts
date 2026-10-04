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
  MANAGEABLE_ROLES,
  ResetPasswordDto,
  SetUserActiveDto,
  UpdateProfileDto,
  UpdateUserDto,
} from "./dto/user.dto";

const profileSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  school: { select: { name: true } },
} as const;

const userItemSelect = {
  id: true,
  email: true,
  fullName: true,
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
      data: { fullName: dto.fullName.trim() },
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

  /** Target admin hanya TEACHER/PARENT dalam sekolah yang sama; selain itu 404. */
  private async manageableTarget(admin: SessionUser, id: string) {
    const target = await this.prisma.user.findFirst({
      where: { id, schoolId: admin.schoolId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
    if (!target || target.role === "SUPERADMIN") {
      throw Errors.notFound("Pengguna");
    }
    return target;
  }

  async listUsers(
    user: SessionUser,
    params: PaginationParams,
    role: string | undefined,
    q: string | undefined,
  ): Promise<Paginated<unknown>> {
    if (!role || !(MANAGEABLE_ROLES as readonly string[]).includes(role)) {
      throw Errors.validation(
        ApiErrorCode.VALIDATION_ERROR,
        "Parameter role wajib diisi: TEACHER atau PARENT.",
      );
    }
    const keyword = q?.trim();
    const where = {
      schoolId: user.schoolId,
      role: role as "TEACHER" | "PARENT",
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
    const target = await this.manageableTarget(admin, id);
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
    const target = await this.manageableTarget(admin, id);
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
    const target = await this.manageableTarget(admin, id);
    const data: { fullName?: string; email?: string } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
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
}
