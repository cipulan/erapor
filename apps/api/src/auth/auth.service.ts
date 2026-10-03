import { Inject, Injectable } from "@nestjs/common";
import { CookieOptions, Request, Response } from "express";
import { APP_CONFIG, AppConfig } from "../config/configuration";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { Errors } from "../common/errors/api-exception";
import { generateSessionToken, hashSessionToken, verifyPassword } from "./crypto";
import { SessionUser } from "./types/session-user";
import { LoginDto } from "./dto/login.dto";

export interface AuthMeResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: SessionUser["role"];
    isActive: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: "lax",
      path: "/",
      maxAge: this.config.sessionTtlHours * 3_600_000,
    };
  }

  getCookieName(): string {
    return this.config.sessionCookieName;
  }

  async login(dto: LoginDto, req: Request, res: Response): Promise<AuthMeResponse> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        schoolId: true,
        passwordHash: true,
      },
    });

    const passwordOk = user ? await verifyPassword(dto.password, user.passwordHash) : false;
    if (!user || !passwordOk) {
      // Generic message: do not reveal whether the email exists.
      throw Errors.invalidCredentials();
    }
    if (!user.isActive) {
      throw Errors.invalidCredentials();
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlHours * 3_600_000);

    const session = await this.prisma.session.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.cookie(this.config.sessionCookieName, token, this.cookieOptions());

    const me = this.toAuthMe(user);
    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: "AUTH_LOGIN",
      entityType: "Session",
      entityId: session.id,
    });
    return me;
  }

  async logout(req: Request, res: Response, user: SessionUser | undefined): Promise<void> {
    if (user?.sessionId) {
      await this.prisma.session.updateMany({
        where: { id: user.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        req,
        schoolId: user.schoolId,
        actorUserId: user.id,
        action: "AUTH_LOGOUT",
        entityType: "Session",
        entityId: user.sessionId,
      });
    }
    res.clearCookie(this.config.sessionCookieName, { path: "/" });
  }

  /** Resolves an opaque token to a SessionUser, or null when invalid/expired. */
  async resolveSession(token: string): Promise<SessionUser | null> {
    const tokenHash = hashSessionToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true,
            schoolId: true,
          },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    if (!session.user.isActive) return null;

    // Sliding activity marker (best effort).
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role as SessionUser["role"],
      schoolId: session.user.schoolId,
      sessionId: session.id,
    };
  }

  private toAuthMe(user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
  }): AuthMeResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as SessionUser["role"],
        isActive: user.isActive,
      },
    };
  }
}
