import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import type { SessionUser } from "../auth/types/session-user";
import { UpdateSchoolDto } from "./dto/school.dto";

export interface SchoolJson {
  id: string;
  name: string;
  code: string | null;
  timezone: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  headmasterName: string | null;
  headmasterNip: string | null;
  city: string | null;
}

function toSchoolJson(s: {
  id: string;
  name: string;
  code: string | null;
  timezone: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  headmasterName: string | null;
  headmasterNip: string | null;
  city: string | null;
}): SchoolJson {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    timezone: s.timezone,
    address: s.address,
    phone: s.phone,
    email: s.email,
    headmasterName: s.headmasterName,
    headmasterNip: s.headmasterNip,
    city: s.city,
  };
}

/** Profil sekolah. GET untuk semua role login; PUT khusus SUPERADMIN. */
@Injectable()
export class SchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getSchool(user: SessionUser): Promise<SchoolJson> {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: user.schoolId },
    });
    return toSchoolJson(school);
  }

  async updateSchool(user: SessionUser, dto: UpdateSchoolDto, req: Request): Promise<SchoolJson> {
    const clean = (v: string | undefined): string | null => {
      const t = v?.trim() ?? "";
      return t.length > 0 ? t : null;
    };
    const school = await this.prisma.school.update({
      where: { id: user.schoolId },
      data: {
        name: dto.name.trim(),
        address: clean(dto.address),
        city: clean(dto.city),
        phone: clean(dto.phone),
        email: clean(dto.email),
        headmasterName: clean(dto.headmasterName),
        headmasterNip: clean(dto.headmasterNip),
      },
    });
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.SCHOOL_UPDATE,
      entityType: "School",
      entityId: school.id,
      afterJson: { name: school.name, headmasterName: school.headmasterName },
    });
    return toSchoolJson(school);
  }
}
