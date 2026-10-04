import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { SessionUser } from "../auth/types/session-user";
import { DashboardStatsQueryDto } from "./dto/dashboard.dto";

export interface SubjectAvg {
  name: string;
  avg: number;
}

export interface ClassAvg {
  classId: string;
  name: string;
  studentCount: number;
  avg: number | null;
}

export interface ActivityItem {
  id: string;
  actorName: string;
  action: string;
  label: string;
  createdAt: string;
}

export interface DashboardStats {
  academicYear: { id: string; name: string } | null;
  semester: { id: string; name: string } | null;
  totals: { students: number; teachers: number; classes: number; assessments: number };
  avgScore: number | null;
  kktp: { achieved: number; notAchieved: number; percent: number | null };
  reportsByStatus: { DRAFT: number; REVIEW: number; LOCKED: number; PUBLISHED: number; REVISION: number };
  avgPerSubject: SubjectAvg[];
  avgPerClass: ClassAvg[];
  recentActivity: ActivityItem[];
}

const ACTION_LABELS: Record<string, string> = {
  SCHOOL_UPDATE: "memperbarui data sekolah",
  ACADEMIC_YEAR_CREATE: "membuat tahun ajaran baru",
  ACADEMIC_YEAR_ACTIVATE: "mengaktifkan tahun ajaran",
  SEMESTER_CREATE: "membuat semester baru",
  STUDENT_CREATE: "menambah data siswa",
  ENROLLMENT_CREATE: "mendaftarkan siswa ke kelas",
  GUARDIAN_CREATE: "menambah data wali murid",
  CLASS_CREATE: "membuat kelas baru",
  SUBJECT_CREATE: "menambah mata pelajaran",
  ASSIGNMENT_CREATE: "menambah penugasan guru",
  GRADING_SCHEME_PUBLISH: "mempublish skema nilai",
  KKTP_UPSERT: "mengatur KKTP",
  ASSESSMENT_CREATE: "membuat assessment baru",
  SCORES_BULK_UPDATE: "menginput nilai",
  SCORE_IMPORT_COMMIT: "mengimpor nilai dari CSV",
  REPORT_GENERATE: "menggenerate rapor",
  REPORT_REVIEW: "mereview rapor",
  REPORT_LOCK: "mengunci rapor",
  REPORT_PUBLISH: "menerbitkan rapor",
  REPORT_REVISION: "membuka revisi rapor",
  PROMOTION_EXECUTE: "menjalankan kenaikan kelas",
  USER_CREATE: "membuat akun pengguna",
  USER_PASSWORD_RESET: "mereset password akun",
  USER_STATUS_UPDATE: "mengubah status akun",
  PROFILE_UPDATE: "memperbarui profil",
  PASSWORD_CHANGE: "mengubah password",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Agregat statistik dashboard. Khusus SUPERADMIN. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(user: SessionUser, q: DashboardStatsQueryDto): Promise<DashboardStats> {
    const [students, teachers] = await Promise.all([
      this.prisma.student.count({ where: { schoolId: user.schoolId, status: "ACTIVE" } }),
      this.prisma.user.count({ where: { schoolId: user.schoolId, role: "TEACHER", isActive: true } }),
    ]);

    const year = q.academicYearId
      ? await this.prisma.academicYear.findFirstOrThrow({
          where: { id: q.academicYearId, schoolId: user.schoolId },
        }).catch(() => {
          throw new NotFoundException("Tahun ajaran tidak ditemukan.");
        })
      : await this.prisma.academicYear.findFirst({
          where: { schoolId: user.schoolId, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        });

    const empty: DashboardStats = {
      academicYear: year ? { id: year.id, name: year.name } : null,
      semester: null,
      totals: { students, teachers, classes: 0, assessments: 0 },
      avgScore: null,
      kktp: { achieved: 0, notAchieved: 0, percent: null },
      reportsByStatus: { DRAFT: 0, REVIEW: 0, LOCKED: 0, PUBLISHED: 0, REVISION: 0 },
      avgPerSubject: [],
      avgPerClass: [],
      recentActivity: await this.recentActivity(user.schoolId),
    };
    if (!year) return empty;

    const semester = q.semesterId
      ? await this.prisma.semester.findFirstOrThrow({
          where: { id: q.semesterId, academicYearId: year.id },
        }).catch(() => {
          throw new NotFoundException("Semester tidak ditemukan.");
        })
      : await this.prisma.semester.findFirst({
          where: { academicYearId: year.id, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        });
    if (semester) {
      empty.semester = { id: semester.id, name: semester.name };
    }

    const [classCount, assessmentCount, statusGroups, classes, enrollCounts] = await Promise.all([
      this.prisma.class.count({ where: { schoolId: user.schoolId, academicYearId: year.id } }),
      semester
        ? this.prisma.assessment.count({ where: { semesterId: semester.id } })
        : Promise.resolve(0),
      semester
        ? this.prisma.reportCard.groupBy({
            by: ["status"],
            _count: { _all: true },
            where: { academicYearId: year.id, semesterId: semester.id },
          })
        : Promise.resolve([]),
      this.prisma.class.findMany({
        where: { schoolId: user.schoolId, academicYearId: year.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.studentEnrollment.groupBy({
        by: ["classId"],
        _count: { _all: true },
        where: { academicYearId: year.id, status: "ACTIVE" },
      }),
    ]);
    empty.totals.classes = classCount;
    empty.totals.assessments = assessmentCount;
    for (const g of statusGroups) {
      if (g.status in empty.reportsByStatus) {
        empty.reportsByStatus[g.status as keyof typeof empty.reportsByStatus] = g._count._all;
      }
    }

    if (semester) {
      const rows = await this.prisma.reportCardSubject.findMany({
        where: { reportCard: { academicYearId: year.id, semesterId: semester.id } },
        select: {
          finalScore: true,
          achievement: true,
          subjectName: true,
          reportCard: { select: { classId: true } },
        },
      });

      let sum = 0;
      let achieved = 0;
      let notAchieved = 0;
      const bySubject = new Map<string, { sum: number; n: number }>();
      const byClass = new Map<string, { sum: number; n: number }>();
      for (const r of rows) {
        const v = Number(r.finalScore);
        sum += v;
        if (r.achievement === "ACHIEVED") achieved += 1;
        else if (r.achievement === "NOT_ACHIEVED") notAchieved += 1;
        const s = bySubject.get(r.subjectName) ?? { sum: 0, n: 0 };
        s.sum += v; s.n += 1; bySubject.set(r.subjectName, s);
        const c = byClass.get(r.reportCard.classId) ?? { sum: 0, n: 0 };
        c.sum += v; c.n += 1; byClass.set(r.reportCard.classId, c);
      }

      if (rows.length > 0) empty.avgScore = round1(sum / rows.length);
      const assessed = achieved + notAchieved;
      empty.kktp = {
        achieved,
        notAchieved,
        percent: assessed > 0 ? round1((achieved / assessed) * 100) : null,
      };
      empty.avgPerSubject = [...bySubject.entries()]
        .map(([name, s]) => ({ name, avg: round1(s.sum / s.n) }))
        .sort((a, b) => b.avg - a.avg);

      const enrollMap = new Map(enrollCounts.map((e) => [e.classId, e._count._all]));
      empty.avgPerClass = classes.map((c) => {
        const agg = byClass.get(c.id);
        return {
          classId: c.id,
          name: c.name,
          studentCount: enrollMap.get(c.id) ?? 0,
          avg: agg ? round1(agg.sum / agg.n) : null,
        };
      }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
    } else {
      const enrollMap = new Map(enrollCounts.map((e) => [e.classId, e._count._all]));
      empty.avgPerClass = classes.map((c) => ({
        classId: c.id,
        name: c.name,
        studentCount: enrollMap.get(c.id) ?? 0,
        avg: null,
      }));
    }

    return empty;
  }

  private async recentActivity(schoolId: string): Promise<ActivityItem[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { schoolId, action: { notIn: ["AUTH_LOGIN", "AUTH_LOGOUT"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { fullName: true } } },
    });
    return logs.map((l) => ({
      id: l.id,
      actorName: l.actor?.fullName ?? "Sistem",
      action: l.action,
      label: ACTION_LABELS[l.action] ?? l.action,
      createdAt: l.createdAt.toISOString(),
    }));
  }
}
