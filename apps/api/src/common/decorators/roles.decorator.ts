import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "../../auth/types/session-user";

export const ROLES_KEY = "required_roles";
export const IS_PUBLIC_KEY = "is_public";

/**
 * Restricts an endpoint to the given roles. Endpoints without @Roles
 * still require authentication (SessionAuthGuard) but no specific role.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Marks an endpoint as not requiring authentication (e.g. /auth/login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
