import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { APP_CONFIG, AppConfig } from "../../config/configuration";
import { IS_PUBLIC_KEY } from "../../common/decorators/roles.decorator";
import { Errors } from "../../common/errors/api-exception";
import { AuthService } from "../auth.service";
import { SessionUser } from "../types/session-user";

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
    requestId?: string;
  }
}

/**
 * Validates the HTTP-only session cookie against the sessions table and
 * attaches the SessionUser (with schoolId from the session, BR-001).
 * Skipped for @Public() endpoints.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[this.config.sessionCookieName];
    if (typeof token !== "string" || token.length === 0) {
      throw Errors.sessionExpired();
    }

    const user = await this.authService.resolveSession(token);
    if (!user) {
      throw Errors.sessionExpired();
    }
    req.user = user;
    return true;
  }
}
