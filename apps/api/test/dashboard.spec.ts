/** Unit test DashboardService.getStats dengan Prisma yang di-mock. Tanpa DB. */
import { describe, expect, it, vi } from "vitest";
import { DashboardService } from "../src/dashboard/dashboard.service";

function mockPrisma() {
  return {
    student: { count: vi.fn().mockResolvedValue(180) },
    user: { count: vi.fn().mockResolvedValue(12) },
    academicYear: {
      findFirst: vi.fn().mockResolvedValue({ id: "y1", name: "2026/2027" }),
      findFirstOrThrow: vi.fn(),
    },
    semester: {
      findFirst: vi.fn().mockResolvedValue({ id: "s1", name: "Semester 1 (Ganjil)" }),
      findFirstOrThrow: vi.fn(),
    },
    class: {
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([
        { id: "c1", name: "4A" },
        { id: "c2", name: "4B" },
      ]),
    },
    assessment: { count: vi.fn().mockResolvedValue(45) },
    reportCard: {
      groupBy: vi.fn().mockResolvedValue([
        { status: "PUBLISHED", _count: { _all: 5 } },
        { status: "DRAFT", _count: { _all: 2 } },
      ]),
    },
    studentEnrollment: {
      groupBy: vi.fn().mockResolvedValue([
        { classId: "c1", _count: { _all: 30 } },
        { classId: "c2", _count: { _all: 28 } },
      ]),
    },
    reportCardSubject: {
      findMany: vi.fn().mockResolvedValue([
        { finalScore: 80, achievement: "ACHIEVED", subjectName: "Matematika", reportCard: { classId: "c1" } },
        { finalScore: 70, achievement: "NOT_ACHIEVED", subjectName: "Matematika", reportCard: { classId: "c1" } },
        { finalScore: 90, achievement: "ACHIEVED", subjectName: "IPA", reportCard: { classId: "c2" } },
      ]),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([
        { id: "a1", action: "REPORT_PUBLISH", actor: { fullName: "Admin" }, createdAt: new Date("2026-10-04T10:00:00Z") },
      ]),
    },
  };
}

const user = { id: "u1", schoolId: "sch1", role: "SUPERADMIN" } as never;

describe("DashboardService.getStats", () => {
  it("menghitung total, rata-rata, KKTP, dan agregat per mapel/kelas", async () => {
    const svc = new DashboardService(mockPrisma() as never);
    const s = await svc.getStats(user, {});

    expect(s.totals).toEqual({ students: 180, teachers: 12, classes: 2, assessments: 45 });
    expect(s.avgScore).toBe(80);
    expect(s.kktp).toEqual({ achieved: 2, notAchieved: 1, percent: 66.7 });
    expect(s.reportsByStatus.PUBLISHED).toBe(5);
    expect(s.reportsByStatus.DRAFT).toBe(2);
    expect(s.avgPerSubject).toEqual([
      { name: "IPA", avg: 90 },
      { name: "Matematika", avg: 75 },
    ]);
    expect(s.avgPerClass[0]).toMatchObject({ name: "4B", studentCount: 28, avg: 90 });
    expect(s.avgPerClass[1]).toMatchObject({ name: "4A", studentCount: 30, avg: 75 });
    expect(s.recentActivity[0]).toMatchObject({
      actorName: "Admin",
      action: "REPORT_PUBLISH",
      label: "menerbitkan rapor",
    });
  });

  it("mengembalikan statistik kosong yang aman bila tanpa tahun ajaran aktif", async () => {
    const prisma = mockPrisma();
    prisma.academicYear.findFirst = vi.fn().mockResolvedValue(null);
    const svc = new DashboardService(prisma as never);
    const s = await svc.getStats(user, {});

    expect(s.academicYear).toBeNull();
    expect(s.avgScore).toBeNull();
    expect(s.avgPerSubject).toEqual([]);
    expect(s.totals.students).toBe(180);
  });
});
