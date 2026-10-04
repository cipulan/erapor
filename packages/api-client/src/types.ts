/**
 * Tipe data mengikuti kontrak docs/api/openapi.yaml (camelCase, sesuai respons backend).
 */

export type UserRole = "SUPERADMIN" | "TEACHER" | "PARENT";

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthMe {
  user: UserSummary;
}

/* ---------- Profil & manajemen pengguna ---------- */

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  schoolName: string;
}

export interface UserItem extends UserSummary {
  lastLoginAt: string | null;
}

export interface SchoolProfile {
  id: string;
  name: string;
  code: string | null;
  timezone: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  headmasterName: string | null;
  headmasterNip: string | null;
}

export interface UpdateSchoolInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  headmasterName?: string;
  headmasterNip?: string;
}

export interface DashboardSubjectAvg {
  name: string;
  avg: number;
}

export interface DashboardClassAvg {
  classId: string;
  name: string;
  studentCount: number;
  avg: number | null;
}

export interface DashboardActivity {
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
  avgPerSubject: DashboardSubjectAvg[];
  avgPerClass: DashboardClassAvg[];
  recentActivity: DashboardActivity[];
}

export interface UpdateProfileInput {
  fullName: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface MessageResult {
  message: string;
}

export type ManageableRole = "TEACHER" | "PARENT";

export interface CreateUserInput {
  email: string;
  fullName: string;
  role: ManageableRole;
  password?: string;
}

export interface CreateUserResult {
  user: UserSummary;
  generatedPassword?: string;
}

export interface ResetPasswordInput {
  newPassword?: string;
}

export interface ResetPasswordResult {
  generatedPassword?: string;
}

export type AcademicYearStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
}
export interface CreateAcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
}

export type SemesterCode = "ODD" | "EVEN";
export type SemesterStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export interface Semester {
  id: string;
  academicYearId: string;
  code: SemesterCode;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: SemesterStatus;
}
export interface CreateSemesterInput {
  code: SemesterCode;
  name: string;
  startDate?: string;
  endDate?: string;
}

export type StudentStatus = "ACTIVE" | "GRADUATED" | "TRANSFERRED" | "INACTIVE";
export type Gender = "MALE" | "FEMALE";
export interface Student {
  id: string;
  nis: string | null;
  nisn: string | null;
  fullName: string;
  gender: Gender | null;
  birthPlace: string | null;
  birthDate: string | null;
  status: StudentStatus;
}
export interface CreateStudentInput {
  nis?: string;
  nisn?: string;
  fullName: string;
  gender?: Gender;
  birthPlace?: string;
  birthDate?: string;
}
export interface StudentEnrollment {
  id: string;
  studentId: string;
  academicYearId: string;
  classId: string;
  status: string;
  enrollmentType: string;
  enrolledAt: string;
  completedAt: string | null;
}
export interface StudentDetail extends Student {
  enrollments?: StudentEnrollment[];
}
export interface CreateEnrollmentInput {
  academicYearId: string;
  classId: string;
  enrollmentType: "NEW" | "PROMOTED" | "REPEATED" | "TRANSFERRED";
}

export interface Guardian {
  id: string;
  userId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}
export interface CreateGuardianInput {
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
}
export interface LinkGuardianInput {
  guardianId: string;
  isPrimary?: boolean;
}

export interface ClassItem {
  id: string;
  academicYearId: string;
  name: string;
  gradeLevel: number;
  homeroomTeacherId: string | null;
}
export interface CreateClassInput {
  academicYearId: string;
  name: string;
  gradeLevel: number;
  homeroomTeacherId?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  subjectType: "MANDATORY" | "ADDITIONAL" | "LOCAL";
  isActive: boolean;
}
export interface CreateSubjectInput {
  code: string;
  name: string;
  subjectType: Subject["subjectType"];
}
export interface CreateCpInput {
  code: string;
  description: string;
}
export interface CreateTpInput {
  code: string;
  description: string;
}

export interface TeacherAssignment {
  id: string;
  teacherId: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  status: "ACTIVE" | "INACTIVE";
}
export interface CreateTeacherAssignmentInput {
  teacherId: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
}

export interface AssessmentCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}
export interface CreateAssessmentCategoryInput {
  name: string;
  description?: string;
}

export type GradingSchemeStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export interface GradingSchemeWeight {
  id: string;
  categoryId: string;
  weight: number;
}
export interface GradingScheme {
  id: string;
  academicYearId: string;
  semesterId: string;
  status: GradingSchemeStatus;
  publishedAt: string | null;
  weights: GradingSchemeWeight[];
}
export interface ReplaceWeightsInput {
  weights: { categoryId: string; weight: number }[];
}

export interface KktpConfiguration {
  id: string;
  academicYearId: string;
  semesterId: string;
  subjectId: string;
  threshold: number;
  description: string | null;
}
export interface UpsertKktpInput {
  academicYearId: string;
  semesterId: string;
  subjectId: string;
  threshold: number;
  description?: string;
}

export type AssessmentStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export interface Assessment {
  id: string;
  teacherAssignmentId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  categoryId: string;
  title: string;
  description: string | null;
  assessmentDate: string | null;
  maxScore: number;
  status: AssessmentStatus;
}
export interface CreateAssessmentInput {
  teacherAssignmentId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  categoryId: string;
  title: string;
  description?: string;
  assessmentDate?: string;
  maxScore: number;
}
export interface AssessmentScore {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number;
  normalizedScore: number;
  note: string | null;
}
export interface BulkScoresInput {
  scores: { studentId: string; score: number; note?: string }[];
}

export interface ImportRowError {
  row: number;
  code: string;
  message: string;
}
export interface ImportPreview {
  importId: string;
  valid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportRowError[];
}
export interface ImportCommitResult {
  importId: string;
  importedRows: number;
}

export type GradeStatus = "COMPLETE" | "INCOMPLETE";
export type AchievementStatus = "ACHIEVED" | "NOT_ACHIEVED" | "NOT_ASSESSED";
export interface GradePreviewCategory {
  categoryId: string;
  average: number;
  weight: number;
  weightedValue: number;
}
export interface GradePreview {
  studentId: string;
  academicYearId: string;
  semesterId: string;
  subjectId: string;
  status: GradeStatus;
  categoryAverages?: GradePreviewCategory[];
  finalScore: number | null;
  kktpThreshold: number | null;
  achievement: AchievementStatus | null;
  missingAssessments?: string[];
}

export type ReportCardStatus = "DRAFT" | "REVIEW" | "LOCKED" | "PUBLISHED" | "REVISION";
export interface ReportCardSubject {
  id: string;
  reportCardId: string;
  subjectId: string;
  subjectName: string;
  finalScore: number;
  kktpThreshold: number | null;
  achievement: AchievementStatus;
  description: string | null;
}
export interface ReportCard {
  id: string;
  studentId: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  version: number;
  status: ReportCardStatus;
  generatedAt: string | null;
  reviewedAt: string | null;
  lockedAt: string | null;
  publishedAt: string | null;
}
export interface ReportCardDetail extends ReportCard {
  subjects: ReportCardSubject[];
}
export interface GenerateReportCardInput {
  studentId: string;
  academicYearId: string;
  semesterId: string;
}

export interface PromoteClassInput {
  targetAcademicYearId: string;
  targetClassId: string;
  studentIds?: string[];
  enrollmentType?: "PROMOTED" | "REPEATED";
}
export interface PromotionResult {
  sourceClassId: string;
  targetClassId: string;
  created: number;
  skipped: number;
  errors: unknown[];
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface ErrorBody {
  code?: string;
  message?: string;
  details?: unknown;
}
