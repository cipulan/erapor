"use client";

import { useEffect, useState } from "react";
import type { AcademicYear, AssessmentCategory, GradePreview, Semester, Student, Subject } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatNumber } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Card, Field, PageHeader, Spinner, EmptyState } from "@/components/ui";
import { Button } from "@/components/ui";

export default function PreviewNilaiPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN", "TEACHER"]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [form, setForm] = useState({ studentId: "", academicYearId: "", semesterId: "", subjectId: "" });
  const [result, setResult] = useState<GradePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = api();
        const [y, sj, cat, st] = await Promise.all([
          c.academicYears.list({ limit: 50 }),
          c.subjects.list({ limit: 100 }),
          c.categories.list(),
          c.students.list({ limit: 100 }),
        ]);
        setYears(y.data);
        setSubjects(sj.data);
        setCategories(cat);
        setStudents(st.data);
        const active = y.data.find((x) => x.status === "ACTIVE");
        if (active) {
          setForm((f) => ({ ...f, academicYearId: active.id }));
          setSemesters(await c.semesters.list(active.id));
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onYearChange(yid: string) {
    setForm({ ...form, academicYearId: yid, semesterId: "" });
    setSemesters(yid ? await api().semesters.list(yid).catch(() => []) : []);
  }

  async function onCheck() {
    setError("");
    setResult(null);
    if (!form.studentId || !form.academicYearId || !form.semesterId || !form.subjectId) {
      setError("Pilih siswa, tahun ajaran, semester, dan mapel.");
      return;
    }
    setBusy(true);
    try {
      const r = await api().grading.preview(form.studentId, {
        academicYearId: form.academicYearId,
        semesterId: form.semesterId,
        subjectId: form.subjectId,
      });
      setResult(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id.slice(0, 8);

  if (authLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Preview Nilai" subtitle="Hitung nilai akhir siswa dari skema yang sudah publish" />
      <Alert kind="error">{error}</Alert>
      <Card title="Parameter">
        <div className="form-row">
          <Field label="Siswa">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">— Pilih —</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </Field>
          <Field label="Mapel">
            <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">— Pilih —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Tahun ajaran">
            <select value={form.academicYearId} onChange={(e) => void onYearChange(e.target.value)}>
              <option value="">— Pilih —</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
          <Field label="Semester">
            <select value={form.semesterId} onChange={(e) => setForm({ ...form, semesterId: e.target.value })}>
              <option value="">— Pilih —</option>
              {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="btn-row">
          <Button onClick={() => void onCheck()} disabled={busy}>{busy ? "Menghitung..." : "Hitung preview"}</Button>
        </div>
      </Card>

      {result && (
        <Card
          title="Hasil perhitungan"
          actions={<Badge status={result.status} />}
        >
          {result.status === "INCOMPLETE" && (
            <Alert kind="error">
              Nilai belum lengkap — final score tidak boleh dipublikasikan ke rapor.
              {result.missingAssessments && result.missingAssessments.length > 0 && (
                <> Assessment yang belum ada nilainya: {result.missingAssessments.length}.</>
              )}
            </Alert>
          )}
          {result.categoryAverages && result.categoryAverages.length > 0 ? (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Kategori</th><th>Rata-rata</th><th>Bobot</th><th>Kontribusi</th></tr></thead>
                <tbody>
                  {result.categoryAverages.map((c) => (
                    <tr key={c.categoryId}>
                      <td>{catName(c.categoryId)}</td>
                      <td>{formatNumber(c.average)}</td>
                      <td>{formatNumber(c.weight)}%</td>
                      <td>{formatNumber(c.weightedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState text="Belum ada nilai pada kategori manapun." />}
          <dl className="kv mt">
            <dt>Nilai akhir</dt><dd><strong>{result.finalScore !== null ? formatNumber(result.finalScore) : "—"}</strong></dd>
            <dt>KKTP</dt><dd>{result.kktpThreshold !== null ? result.kktpThreshold : "—"}</dd>
            <dt>Status KKTP</dt><dd>{result.achievement ? <Badge status={result.achievement} /> : "—"}</dd>
          </dl>
        </Card>
      )}
    </>
  );
}
