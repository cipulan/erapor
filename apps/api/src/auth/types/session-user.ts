export type UserRole = "SUPERADMIN" | "TEACHER" | "PARENT";

/**
 * Authenticated principal attached to the request by SessionAuthGuard.
 * schoolId ALWAYS comes from the session (BR-001) — never from the client.
 */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolId: string;
  sessionId: string;
}
