/**
 * Authorization tests per docs/architecture/authorization-matrix.md §10.
 * The Prisma layer is mocked; these verify the policy service decisions
 * (403 vs 404) and the RolesGuard deny-by-default behavior.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Reflector } from "@nestjs/core";

vi.mock("../src/prisma/prisma.service", () => ({
  PrismaService: class PrismaService {},
}));

import { ResourcePolicyService } from "../src/authorization/resource-policy.service";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { ApiErrorCode } from "../src/common/errors/error-codes";
import { ApiException } from "../src/common/errors/api-exception";
import type { SessionUser } from "../src/auth/types/session-user";

const prismaMock: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {
  student: { findFirst: vi.fn() },
  class: { findFirst: vi.fn() },
  assessment: { findFirst: vi.fn() },
  reportCard: { findFirst: vi.fn() },
  teacherAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
  studentGuardian: { findFirst: vi.fn(), findMany: vi.fn() },
  studentEnrollment: { findMany: vi.fn() },
};

function user(role: SessionUser["role"], id = "user-1"): SessionUser {
  return {
    id,
    email: `${role.toLowerCase()}@sekolah.id`,
    fullName: role,
    role,
    schoolId: "school-1",
    sessionId: "session-1",
  };
}

async function rejectedWith(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiException);
    return err as ApiException;
  }
  throw new Error("Expected promise to reject, but it resolved");
}

describe("ResourcePolicyService", () => {
  let policy: ResourcePolicyService;

  beforeEach(() => {
    vi.clearAllMocks();
    policy = new ResourcePolicyService(prismaMock as never);
  });

  it("teacher accessing another teacher's assessment -> 404", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue({
      id: "asm-1",
      teacherAssignment: { teacherId: "other-teacher" },
    });
    const err = await rejectedWith(policy.requireTeacherOwnsAssessment("user-1", "school-1", "asm-1"));
    expect(err.getStatus()).toBe(404);
    expect(err.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
  });

  it("teacher accessing own assessment -> allowed", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue({
      id: "asm-1",
      teacherAssignment: { teacherId: "user-1" },
    });
    const result = await policy.requireTeacherOwnsAssessment("user-1", "school-1", "asm-1");
    expect(result.id).toBe("asm-1");
  });

  it("parent accessing unrelated student -> 404", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "stu-1" });
    prismaMock.studentGuardian.findFirst.mockResolvedValue(null);
    const err = await rejectedWith(policy.requireParentStudent("user-1", "school-1", "stu-1"));
    expect(err.getStatus()).toBe(404);
  });

  it("parent accessing draft (unpublished) report -> 403", async () => {
    prismaMock.reportCard.findFirst.mockResolvedValue({
      id: "rep-1",
      studentId: "stu-1",
      classId: "class-1",
      semesterId: "sem-1",
      status: "DRAFT",
    });
    prismaMock.student.findFirst.mockResolvedValue({ id: "stu-1" });
    prismaMock.studentGuardian.findFirst.mockResolvedValue({ studentId: "stu-1" });
    const err = await rejectedWith(policy.requireReportReadAccess(user("PARENT"), "rep-1"));
    expect(err.getStatus()).toBe(403);
    expect(err.code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
  });

  it("parent accessing published report of linked student -> allowed", async () => {
    prismaMock.reportCard.findFirst.mockResolvedValue({
      id: "rep-1",
      studentId: "stu-1",
      classId: "class-1",
      semesterId: "sem-1",
      status: "PUBLISHED",
    });
    prismaMock.student.findFirst.mockResolvedValue({ id: "stu-1" });
    prismaMock.studentGuardian.findFirst.mockResolvedValue({ studentId: "stu-1" });
    const result = await policy.requireReportReadAccess(user("PARENT"), "rep-1");
    expect(result.id).toBe("rep-1");
  });

  it("teacher accessing report of unrelated class -> 404", async () => {
    prismaMock.reportCard.findFirst.mockResolvedValue({
      id: "rep-1",
      studentId: "stu-1",
      classId: "class-9",
      semesterId: "sem-1",
      status: "REVIEW",
    });
    prismaMock.class.findFirst.mockResolvedValue({ homeroomTeacherId: "someone-else" });
    prismaMock.teacherAssignment.findFirst.mockResolvedValue(null);
    const err = await rejectedWith(policy.requireReportReadAccess(user("TEACHER"), "rep-1"));
    expect(err.getStatus()).toBe(404);
  });

  it("superadmin can read any report in the school", async () => {
    prismaMock.reportCard.findFirst.mockResolvedValue({
      id: "rep-1",
      studentId: "stu-1",
      status: "DRAFT",
    });
    const result = await policy.requireReportReadAccess(user("SUPERADMIN"), "rep-1");
    expect(result.id).toBe("rep-1");
  });

  it("cross-school record resolves to 404 (no data leakage)", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null); // scoped by schoolId
    const err = await rejectedWith(policy.studentInSchool("school-1", "stu-foreign"));
    expect(err.getStatus()).toBe(404);
  });
});

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector());

  function contextFor(role: SessionUser["role"], roles: Array<SessionUser["role"]> | undefined) {
    const handler = function handler() {};
    if (roles) Reflect.defineMetadata(ROLES_KEY, roles, handler);
    return {
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user: user(role) }) }),
    } as never;
  }

  it("teacher attempting SUPERADMIN-only publish -> 403", () => {
    expect(() => guard.canActivate(contextFor("TEACHER", ["SUPERADMIN"]))).toThrowError(ApiException);
    try {
      guard.canActivate(contextFor("TEACHER", ["SUPERADMIN"]));
    } catch (err) {
      expect((err as ApiException).getStatus()).toBe(403);
      expect((err as ApiException).code).toBe(ApiErrorCode.AUTH_FORBIDDEN);
    }
  });

  it("parent attempting score modification (SUPERADMIN/TEACHER only) -> 403", () => {
    expect(() => guard.canActivate(contextFor("PARENT", ["SUPERADMIN", "TEACHER"]))).toThrowError();
  });

  it("superadmin on SUPERADMIN-only route -> allowed", () => {
    expect(guard.canActivate(contextFor("SUPERADMIN", ["SUPERADMIN"]))).toBe(true);
  });

  it("endpoint without @Roles allows any authenticated role", () => {
    expect(guard.canActivate(contextFor("PARENT", undefined))).toBe(true);
  });
});
