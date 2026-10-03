import type {
  AcademicYear,
  Assessment,
  AssessmentCategory,
  AssessmentScore,
  AuditLog,
  AuthMe,
  BulkScoresInput,
  ClassItem,
  CreateAcademicYearInput,
  CreateAssessmentCategoryInput,
  CreateAssessmentInput,
  CreateClassInput,
  CreateCpInput,
  CreateEnrollmentInput,
  CreateGuardianInput,
  CreateSemesterInput,
  CreateStudentInput,
  CreateSubjectInput,
  CreateTeacherAssignmentInput,
  CreateTpInput,
  ErrorBody,
  GenerateReportCardInput,
  GradePreview,
  GradingScheme,
  Guardian,
  ImportCommitResult,
  ImportPreview,
  KktpConfiguration,
  LinkGuardianInput,
  Paginated,
  PromoteClassInput,
  PromotionResult,
  ReplaceWeightsInput,
  ReportCard,
  ReportCardDetail,
  Semester,
  Student,
  StudentDetail,
  StudentEnrollment,
  Subject,
  TeacherAssignment,
  UpsertKktpInput,
} from "./types.js";

/**
 * Error dari API. `message` sudah Bahasa Indonesia dari backend;
 * tampilkan langsung ke user bila ada.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  get isValidation(): boolean {
    return this.status === 422;
  }
}

export interface ClientOptions {
  /** Base URL API, mis. "/api/v1" (lewat proxy same-origin). */
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

type QueryValue = string | number | boolean | undefined | null;

function buildQuery<T extends object>(params?: T): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface PageParams {
  page?: number;
  limit?: number;
}

export function createApiClient(options: ClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new ApiError(0, "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
    }

    if (res.status === 204) return undefined as T;

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const body: unknown = isJson ? await res.json().catch(() => null) : null;

    if (!res.ok) {
      const err = (body ?? {}) as ErrorBody;
      const message =
        err.message ||
        (res.status === 401
          ? "Sesi berakhir. Silakan login kembali."
          : res.status === 403
            ? "Akses ditolak. Anda tidak memiliki izin."
            : res.status === 404
              ? "Data tidak ditemukan."
              : `Terjadi kesalahan (HTTP ${res.status}).`);
      throw new ApiError(res.status, message, err.code, err.details);
    }
    return body as T;
  }

  const get = <T>(path: string) => request<T>(path, { method: "GET" });
  const post = <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });
  const put = <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data === undefined ? undefined : JSON.stringify(data) });

  return {
    // ---- Auth ----
    login: (email: string, password: string) =>
      post<AuthMe>("/auth/login", { email, password }),
    logout: () => post<void>("/auth/logout"),
    me: () => get<AuthMe>("/auth/me"),

    // ---- Tahun ajaran & semester ----
    academicYears: {
      list: (params?: PageParams & { status?: string }) =>
        get<Paginated<AcademicYear>>(`/academic-years${buildQuery(params)}`),
      create: (data: CreateAcademicYearInput) => post<AcademicYear>("/academic-years", data),
      get: (id: string) => get<AcademicYear>(`/academic-years/${id}`),
      activate: (id: string) => post<AcademicYear>(`/academic-years/${id}/activate`),
    },
    semesters: {
      list: (academicYearId: string) => get<Semester[]>(`/academic-years/${academicYearId}/semesters`),
      create: (academicYearId: string, data: CreateSemesterInput) =>
        post<Semester>(`/academic-years/${academicYearId}/semesters`, data),
    },

    // ---- Siswa ----
    students: {
      list: (params?: PageParams & { search?: string; classId?: string; academicYearId?: string; status?: string }) =>
        get<Paginated<Student>>(`/students${buildQuery(params)}`),
      create: (data: CreateStudentInput) => post<Student>("/students", data),
      get: (id: string) => get<StudentDetail>(`/students/${id}`),
      enrollments: (id: string) => get<StudentEnrollment[]>(`/students/${id}/enrollments`),
      createEnrollment: (id: string, data: CreateEnrollmentInput) =>
        post<StudentEnrollment>(`/students/${id}/enrollments`, data),
      guardians: (id: string) => get<Guardian[]>(`/students/${id}/guardians`),
      linkGuardian: (id: string, data: LinkGuardianInput) =>
        post<Guardian>(`/students/${id}/guardians`, data),
    },
    guardians: {
      list: (params?: PageParams & { search?: string }) =>
        get<Paginated<Guardian>>(`/guardians${buildQuery(params)}`),
      create: (data: CreateGuardianInput) => post<Guardian>("/guardians", data),
    },

    // ---- Kelas ----
    classes: {
      list: (params?: PageParams & { academicYearId?: string }) =>
        get<Paginated<ClassItem>>(`/classes${buildQuery(params)}`),
      create: (data: CreateClassInput) => post<ClassItem>("/classes", data),
    },

    // ---- Mapel & kurikulum ----
    subjects: {
      list: (params?: PageParams & { active?: boolean }) =>
        get<Paginated<Subject>>(`/subjects${buildQuery(params)}`),
      create: (data: CreateSubjectInput) => post<Subject>("/subjects", data),
    },
    curriculum: {
      createCp: (subjectId: string, data: CreateCpInput) =>
        post<{ id: string }>(`/subjects/${subjectId}/cp`, data),
      createTp: (cpId: string, data: CreateTpInput) => post<{ id: string }>(`/cp/${cpId}/tp`, data),
    },

    // ---- Penugasan guru ----
    assignments: {
      list: (params?: { academicYearId?: string; semesterId?: string; classId?: string; subjectId?: string; teacherId?: string }) =>
        get<TeacherAssignment[]>(`/teacher-assignments${buildQuery(params)}`),
      create: (data: CreateTeacherAssignmentInput) =>
        post<TeacherAssignment>("/teacher-assignments", data),
    },

    // ---- Kategori & skema nilai ----
    categories: {
      list: (params?: { active?: boolean }) =>
        get<AssessmentCategory[]>(`/assessment-categories${buildQuery(params)}`),
      create: (data: CreateAssessmentCategoryInput) =>
        post<AssessmentCategory>("/assessment-categories", data),
    },
    gradingSchemes: {
      list: (params?: { academicYearId?: string; semesterId?: string }) =>
        get<GradingScheme[]>(`/grading-schemes${buildQuery(params)}`),
      create: (data: { academicYearId: string; semesterId: string }) =>
        post<GradingScheme>("/grading-schemes", data),
      replaceWeights: (id: string, data: ReplaceWeightsInput) =>
        put<GradingScheme>(`/grading-schemes/${id}/weights`, data),
      publish: (id: string) => post<GradingScheme>(`/grading-schemes/${id}/publish`),
    },
    kktp: {
      list: (params?: { academicYearId?: string; semesterId?: string; subjectId?: string }) =>
        get<KktpConfiguration[]>(`/kktp-configurations${buildQuery(params)}`),
      upsert: (data: UpsertKktpInput) => post<KktpConfiguration>("/kktp-configurations", data),
    },

    // ---- Penilaian ----
    assessments: {
      list: (params?: { semesterId?: string; classId?: string; subjectId?: string; categoryId?: string; status?: string }) =>
        get<Assessment[]>(`/assessments${buildQuery(params)}`),
      create: (data: CreateAssessmentInput) => post<Assessment>("/assessments", data),
      get: (id: string) => get<Assessment>(`/assessments/${id}`),
    },
    scores: {
      list: (assessmentId: string) => get<AssessmentScore[]>(`/assessments/${assessmentId}/scores`),
      replace: (assessmentId: string, data: BulkScoresInput) =>
        put<AssessmentScore[]>(`/assessments/${assessmentId}/scores`, data),
    },
    scoreImport: {
      preview: (assessmentId: string, file: File) => {
        const fd = new FormData();
        fd.append("file", file);
        return request<ImportPreview>(`/assessments/${assessmentId}/scores/import`, {
          method: "POST",
          body: fd,
        });
      },
      commit: (assessmentId: string, importId: string) =>
        post<ImportCommitResult>(`/assessments/${assessmentId}/scores/import/commit`, { importId }),
    },

    // ---- Preview nilai ----
    grading: {
      preview: (studentId: string, params: { academicYearId: string; semesterId: string; subjectId: string }) =>
        get<GradePreview>(`/grading/students/${studentId}${buildQuery(params)}`),
    },

    // ---- Rapor ----
    reports: {
      list: (params?: PageParams & { academicYearId?: string; semesterId?: string; classId?: string; studentId?: string; status?: string }) =>
        get<Paginated<ReportCard>>(`/report-cards${buildQuery(params)}`),
      generate: (data: GenerateReportCardInput) => post<ReportCardDetail>("/report-cards/generate", data),
      get: (id: string) => get<ReportCardDetail>(`/report-cards/${id}`),
      review: (id: string) => post<ReportCardDetail>(`/report-cards/${id}/review`),
      lock: (id: string) => post<ReportCardDetail>(`/report-cards/${id}/lock`),
      publish: (id: string) => post<ReportCardDetail>(`/report-cards/${id}/publish`),
      revision: (id: string, reason: string) =>
        post<ReportCardDetail>(`/report-cards/${id}/revision`, { reason }),
      pdfUrl: (id: string) => `/api/v1/report-cards/${id}/pdf`,
    },

    // ---- Kenaikan kelas ----
    promotion: {
      promote: (classId: string, data: PromoteClassInput) =>
        post<PromotionResult>(`/classes/${classId}/promote`, data),
    },

    // ---- Audit ----
    audit: {
      list: (params?: PageParams & { entityType?: string; entityId?: string; action?: string }) =>
        get<Paginated<AuditLog>>(`/audit-logs${buildQuery(params)}`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
