import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, IS_PUBLIC_KEY } from "../../common/decorators/roles.decorator";
import { Errors } from "../../common/errors/api-exception";
import type { UserRole } from "../types/session-user";

/**
 * Enforces @Roles(...) metadata. Deny-by-default for role-restricted
 * endpoints: an authenticated user whose role is not listed gets 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role = req.user?.role as UserRole | undefined;
    if (!role || !required.includes(role)) {
      throw Errors.forbidden();
    }
    return true;
  }
}
