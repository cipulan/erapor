/**
 * End-to-end smoke test for the eRapor SD API.
 *
 * Prerequisites:
 *   - PostgreSQL running, DATABASE_URL reachable, migrations applied, seed loaded
 *     (packages/database: TRUNCATE ... CASCADE, then `npm run seed`)
 *   - API running:  node dist/main.js   (PORT=3001)
 *
 * Usage: node smoke.mjs
 * Exits non-zero if any check fails.
 */
const BASE = process.env.API_BASE ?? "http://localhost:3001/api/v1";
const COOKIE_NAME = "school_report_session";

// NOTE: the seed generates random UUIDs on every run, so all reference IDs
// are discovered through the API (never hardcoded).

let passed = 0;
let failed = 0;
const failures = [];

async function check(name, expected, fn) {
  let actual;
  let detail = "";
  try {
    actual = await fn();
  } catch (e) {
    actual = `THREW: ${e.message}`;
  }
  const ok = Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  if (ok) {
    passed++;
    console.log(`  ok   ${name} -> ${actual}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL ${name} -> got ${actual}, want ${expected}${detail}`);
  }
}

const jars = {}; // role -> cookie header string

async function req(role, method, path, body, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  if (role && jars[role]) headers.cookie = jars[role];
  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  return res;
}

async function login(role, email, password) {
  const res = await req(null, "POST", "/auth/login", { email, password });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (m) jars[role] = `${COOKIE_NAME}=${m[1]}`;
  return res.status;
}

async function json(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

console.log("== 1. Auth ==");
await check("login wrong password -> 401", 401, async () =>
  login("nobody", "admin@sekolah.id", "salahpassword"),
);
await check("login admin -> 200", 200, async () =>
  login("admin", "admin@sekolah.id", "admin123"),
);
await check("me without cookie -> 401", 401, async () =>
  (await req(null, "GET", "/auth/me")).status,
);
await check("me as admin -> 200", 200, async () =>
  (await req("admin", "GET", "/auth/me")).status,
);
await check("login guru -> 200", 200, async () =>
  login("guru", "budi@sekolah.id", "guru12345"),
);
await check("login wali -> 200", 200, async () =>
  login("wali", "wali@sekolah.id", "wali12345"),
);

console.log("== 1b. Discover seed IDs ==");
const adminMe = await json(await req("admin", "GET", "/auth/me"));
const guruMe = await json(await req("guru", "GET", "/auth/me"));
const years = (await json(await req("admin", "GET", "/academic-years?limit=50")))?.data ?? [];
const YEAR = (years.find((y) => y.status === "ACTIVE") ?? years[0])?.id;
const sems = (await json(await req("admin", "GET", `/academic-years/${YEAR}/semesters`))) ?? [];
const SEM = sems[0]?.id;
const classes = (await json(await req("admin", "GET", `/classes?academicYearId=${YEAR}&limit=50`)))?.data ?? [];
const CLASS_4A = classes.find((c) => c.name === "4A")?.id;
const subjects = (await json(await req("admin", "GET", "/subjects?limit=50")))?.data ?? [];
const SUBJECT = subjects.find((s) => s.name === "Matematika")?.id;
const assigns = (await json(await req("admin", "GET",
  `/teacher-assignments?semesterId=${SEM}&classId=${CLASS_4A}&subjectId=${SUBJECT}&teacherId=${guruMe.user.id}`))) ?? [];
const ASSIGN = assigns[0]?.id;
const cats = (await json(await req("admin", "GET", "/assessment-categories?active=true"))) ?? [];
const CAT_FORMATIF = cats.find((c) => c.name === "Formatif")?.id;
const CAT_SUMATIF = cats.find((c) => c.name === "Sumatif")?.id;
const students = (await json(await req("guru", "GET", `/students?classId=${CLASS_4A}&limit=100`)))?.data ?? [];
const STUDENT_1 = students[0]?.id;
for (const [n, v] of [["YEAR", YEAR], ["SEM", SEM], ["CLASS_4A", CLASS_4A], ["SUBJECT", SUBJECT],
    ["ASSIGN", ASSIGN], ["CAT_FORMATIF", CAT_FORMATIF], ["CAT_SUMATIF", CAT_SUMATIF], ["STUDENT_1", STUDENT_1]]) {
  await check(`discover ${n}`, true, async () => !!v);
}

console.log("== 2. Guards (RBAC deny-by-default) ==");
await check("guru create academic year -> 403", 403, async () =>
  (await req("guru", "POST", "/academic-years", { name: "X", startDate: "2027-07-01", endDate: "2028-06-30" })).status,
);
await check("wali list audit logs -> 403", 403, async () =>
  (await req("wali", "GET", "/audit-logs")).status,
);
await check("guru get other assessment -> 404", 404, async () =>
  (await req("guru", "GET", "/assessments/00000000-0000-0000-0000-000000000000")).status,
);
await check("wali generate report card -> 403", 403, async () =>
  (await req("wali", "POST", "/report-cards/generate", { studentId: STUDENT_1, academicYearId: YEAR, semesterId: SEM })).status,
);
await check("wali publish report card -> 403", 403, async () =>
  (await req("wali", "POST", "/report-cards/00000000-0000-0000-0000-000000000000/publish")).status,
);

console.log("== 3. Academic years / semesters / classes (admin) ==");
let year2, sem2, class5a;
await check("list academic years -> 200", 200, async () =>
  (await req("admin", "GET", "/academic-years")).status,
);
await check("create academic year 2027/2028 -> 201", 201, async () => {
  const r = await req("admin", "POST", "/academic-years", {
    name: "2027/2028", startDate: "2027-07-01", endDate: "2028-06-30",
  });
  year2 = (await json(r))?.id;
  return r.status;
});
await check("duplicate academic year -> 409", 409, async () =>
  (await req("admin", "POST", "/academic-years", {
    name: "2027/2028", startDate: "2027-07-01", endDate: "2028-06-30",
  })).status,
);
await check("create semester in new year -> 201", 201, async () => {
  const r = await req("admin", "POST", `/academic-years/${year2}/semesters`, {
    code: "ODD", name: "Semester 1 (Ganjil)", startDate: "2027-07-01", endDate: "2027-12-31",
  });
  sem2 = (await json(r))?.id;
  return r.status;
});
await check("create class 5A in new year -> 201", 201, async () => {
  const r = await req("admin", "POST", "/classes", {
    academicYearId: year2, name: "5A", gradeLevel: 5,
  });
  class5a = (await json(r))?.id;
  return r.status;
});

console.log("== 4. Assessments + scores (guru) ==");
let assessmentF, assessmentS;
await check("30 students listed", 30, async () => students.length);
await check("create formatif assessment -> 201", 201, async () => {
  const r = await req("guru", "POST", "/assessments", {
    teacherAssignmentId: ASSIGN, semesterId: SEM, classId: CLASS_4A,
    subjectId: SUBJECT, categoryId: CAT_FORMATIF,
    title: "Kuis 1", maxScore: 100,
  });
  assessmentF = (await json(r))?.id;
  return r.status;
});
await check("create sumatif assessment -> 201", 201, async () => {
  const r = await req("guru", "POST", "/assessments", {
    teacherAssignmentId: ASSIGN, semesterId: SEM, classId: CLASS_4A,
    subjectId: SUBJECT, categoryId: CAT_SUMATIF,
    title: "UTS", maxScore: 100,
  });
  assessmentS = (await json(r))?.id;
  return r.status;
});
await check("bulk scores formatif (30) -> 200", 200, async () => {
  const scores = students.map((s, i) => ({ studentId: s.id, score: 70 + (i % 31) }));
  const r = await req("guru", "PUT", `/assessments/${assessmentF}/scores`, { scores });
  return r.status;
});
await check("bulk scores sumatif (30) -> 200", 200, async () => {
  const scores = students.map((s, i) => ({ studentId: s.id, score: 75 + (i % 26) }));
  const r = await req("guru", "PUT", `/assessments/${assessmentS}/scores`, { scores });
  return r.status;
});
await check("score > max_score -> 422", 422, async () => {
  const r = await req("guru", "PUT", `/assessments/${assessmentF}/scores`, {
    scores: [{ studentId: students[0].id, score: 101 }],
  });
  return r.status;
});
await check("grade preview -> 200", 200, async () =>
  (await req("guru", "GET", `/grading/students/${STUDENT_1}?academicYearId=${YEAR}&semesterId=${SEM}&subjectId=${SUBJECT}`)).status,
);

console.log("== 5. Import 2-phase (guru, CSV) ==");
let importId;
await check("import preview -> 200", 200, async () => {
  const nis = students.slice(0, 3).map((s) => s.nis).join(",");
  void nis;
  const rows = students.slice(0, 3).map((s, i) => `${s.nis},${80 + i}`).join("\n");
  const csv = `nis,score\n${rows}\n`;
  const form = new FormData();
  form.append("file", new Blob([csv], { type: "text/csv" }), "nilai.csv");
  const headers = jars.guru ? { cookie: jars.guru } : {};
  const r = await fetch(`${BASE}/assessments/${assessmentF}/scores/import`, {
    method: "POST", headers, body: form,
  });
  importId = (await json(r))?.importId;
  return r.status;
});
await check("import commit -> 200", 200, async () =>
  (await req("guru", "POST", `/assessments/${assessmentF}/scores/import/commit`, { importId })).status,
);

console.log("== 6. Grading schemes (admin) ==");
let scheme2;
await check("create draft scheme (new year) -> 201", 201, async () => {
  const r = await req("admin", "POST", "/grading-schemes", {
    academicYearId: year2, semesterId: sem2,
  });
  scheme2 = (await json(r))?.id;
  return r.status;
});
await check("weights total 99 (draft) -> 200", 200, async () =>
  (await req("admin", "PUT", `/grading-schemes/${scheme2}/weights`, {
    weights: [
      { categoryId: CAT_FORMATIF, weight: 19 },
      { categoryId: CAT_SUMATIF, weight: 80 },
    ],
  })).status,
);
await check("publish scheme with total 99 -> 409", 409, async () =>
  (await req("admin", "POST", `/grading-schemes/${scheme2}/publish`)).status,
);
await check("weights total 100 -> 200", 200, async () =>
  (await req("admin", "PUT", `/grading-schemes/${scheme2}/weights`, {
    weights: [
      { categoryId: CAT_FORMATIF, weight: 20 },
      { categoryId: CAT_SUMATIF, weight: 80 },
    ],
  })).status,
);
await check("publish scheme -> 200", 200, async () =>
  (await req("admin", "POST", `/grading-schemes/${scheme2}/publish`)).status,
);
await check("weights after publish -> 409", 409, async () =>
  (await req("admin", "PUT", `/grading-schemes/${scheme2}/weights`, {
    weights: [
      { categoryId: CAT_FORMATIF, weight: 20 },
      { categoryId: CAT_SUMATIF, weight: 80 },
    ],
  })).status,
);

console.log("== 7. Report cards: generate -> review -> lock -> publish ==");
let reportId, revisionId;
await check("generate report -> 201", 201, async () => {
  const r = await req("guru", "POST", "/report-cards/generate", {
    studentId: STUDENT_1, academicYearId: YEAR, semesterId: SEM,
  });
  reportId = (await json(r))?.id;
  return r.status;
});
await check("generate duplicate -> 409", 409, async () =>
  (await req("guru", "POST", "/report-cards/generate", {
    studentId: STUDENT_1, academicYearId: YEAR, semesterId: SEM,
  })).status,
);
await check("guru publish draft -> 403", 403, async () =>
  (await req("guru", "POST", `/report-cards/${reportId}/publish`)).status,
);
await check("review -> 200", 200, async () =>
  (await req("guru", "POST", `/report-cards/${reportId}/review`)).status,
);
await check("lock -> 200", 200, async () =>
  (await req("guru", "POST", `/report-cards/${reportId}/lock`)).status,
);
await check("publish (admin) -> 200", 200, async () =>
  (await req("admin", "POST", `/report-cards/${reportId}/publish`)).status,
);
await check("pdf -> 200 + %PDF", "200+%PDF", async () => {
  const r = await req("admin", "GET", `/report-cards/${reportId}/pdf`);
  const buf = Buffer.from(await r.arrayBuffer());
  return `${r.status}+${buf.subarray(0, 4).toString()}`;
});
await check("wali list own child reports -> 200", 200, async () =>
  (await req("wali", "GET", `/report-cards?studentId=${STUDENT_1}`)).status,
);
await check("create revision -> 201", 201, async () => {
  const r = await req("admin", "POST", `/report-cards/${reportId}/revision`, {
    reason: "Perbaikan deskripsi",
  });
  revisionId = (await json(r))?.id;
  return r.status;
});
await check("wali pdf of draft revision -> 403/404", true, async () => {
  const s = (await req("wali", "GET", `/report-cards/${revisionId}/pdf`)).status;
  return s === 403 || s === 404;
});

console.log("== 8. Promotion (admin) ==");
await check("guru promote -> 403", 403, async () =>
  (await req("guru", "POST", `/classes/${CLASS_4A}/promote`, {
    targetAcademicYearId: year2, targetClassId: class5a,
  })).status,
);
await check("promote 4A -> 5A -> 200", 200, async () =>
  (await req("admin", "POST", `/classes/${CLASS_4A}/promote`, {
    targetAcademicYearId: year2, targetClassId: class5a,
  })).status,
);
await check("promote duplicate -> 200 idempotent (skipped=30)", true, async () => {
  const r = await req("admin", "POST", `/classes/${CLASS_4A}/promote`, {
    targetAcademicYearId: year2, targetClassId: class5a,
  });
  const b = await json(r);
  return r.status === 200 && b?.created === 0 && b?.skipped === 30;
});

console.log("== 9. Audit + logout ==");
await check("audit logs (admin) -> 200 non-empty", true, async () => {
  const r = await req("admin", "GET", "/audit-logs?limit=5");
  const b = await json(r);
  return r.status === 200 && (b?.data?.length ?? 0) > 0;
});
await check("logout admin -> 204", 204, async () =>
  (await req("admin", "POST", "/auth/logout")).status,
);
await check("me after logout -> 401", 401, async () =>
  (await req("admin", "GET", "/auth/me")).status,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("Failures:", failures);
  process.exit(1);
}
