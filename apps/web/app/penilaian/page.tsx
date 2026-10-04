"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AcademicYear, Assessment, AssessmentCategory, ClassItem, Semester, Subject, TeacherAssignment } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDate } from "@/lib/format";
import { useAuth, useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner, EmptyState } from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";

export default function PenilaianPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN", "TEACHER"]);
  const { user } = useAuth();
  const [rows, setRows] = useState<Assessment[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [filters, setFilters] = useState({ semesterId: "", classId: "", subjectId: "", categoryId: "", status: "" });
  const [yearId, setYearId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    teacherAssignmentId: "", semesterId: "", classId: "", subjectId: "",
    categoryId: "", title: "", description: "", assessmentDate: "", maxScore: "100",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (f: typeof filters) => {
    setLoading(true);
    setError("");
    try {
      setRows(await api().assessments.list({
        semesterId: f.semesterId || undefined,
        classId: f.classId || undefined,
        subjectId: f.subjectId || undefined,
        categoryId: f.categoryId || undefined,
        status: f.status || undefined,
      }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = api();
        const [y, sj, cat, asg] = await Promise.all([
          c.academicYears.list({ limit: 50 }),
          c.subjects.list({ limit: 100 }),
          c.categories.list({ active: true }),
          c.assignments.list(),
        ]);
        setYears(y.data);
        setSubjects(sj.data);
        setCategories(cat);
        setAssignments(asg);
        const active = y.data.find((x) => x.status === "ACTIVE");
        if (active) {
          setYearId(active.id);
          const [sems, cls] = await Promise.all([
            c.semesters.list(active.id),
            c.classes.list({ academicYearId: active.id, limit: 100 }),
          ]);
          setSemesters(sems);
          setClasses(cls.data);
        }
        await load({ semesterId: "", classId: "", subjectId: "", categoryId: "", status: "" });
      } catch (err) {
        setError(errorMessage(err));
        setLoading(false);
      }
    })();
  }, [load]);

  async function onYearChange(yid: string) {
    setYearId(yid);
    setFilters((f) => ({ ...f, semesterId: "", classId: "" }));
    if (yid) {
      const [sems, cls] = await Promise.all([
        api().semesters.list(yid).catch(() => []),
        api().classes.list({ academicYearId: yid, limit: 100 }).catch(() => ({ data: [] as ClassItem[], meta: { page: 1, limit: 0, total: 0, totalPages: 0 } })),
      ]);
      setSemesters(sems);
      setClasses(cls.data);
    } else {
      setSemesters([]);
      setClasses([]);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const maxScore = parseFloat(form.maxScore);
    if (!form.teacherAssignmentId || !form.semesterId || !form.classId || !form.subjectId || !form.categoryId || !form.title.trim()) {
      setError("Penugasan, semester, kelas, mapel, kategori, dan judul wajib diisi.");
      return;
    }
    if (Number.isNaN(maxScore) || maxScore <= 0) { setError("Skor maksimal harus lebih dari 0."); return; }
    setSaving(true);
    setError("");
    try {
      const a = await api().assessments.create({
        teacherAssignmentId: form.teacherAssignmentId,
        semesterId: form.semesterId,
        classId: form.classId,
        subjectId: form.subjectId,
        categoryId: form.categoryId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assessmentDate: form.assessmentDate || undefined,
        maxScore,
      });
      setShowForm(false);
      window.location.href = `/penilaian/${a.id}`;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? "—";

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Penilaian"
        subtitle={user?.role === "TEACHER" ? "Assessment milik Anda" : "Semua assessment"}
        actions={<Button onClick={() => setShowForm(true)}>+ Assessment</Button>}
      />
      <Alert kind="error">{error}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Tahun ajaran">
            <select value={yearId} onChange={(e) => void onYearChange(e.target.value)}>
              <option value="">Semua</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
          <Field label="Semester">
            <select value={filters.semesterId} onChange={(e) => { const f = { ...filters, semesterId: e.target.value }; setFilters(f); void load(f); }}>
              <option value="">Semua</option>
              {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Kelas">
            <select value={filters.classId} onChange={(e) => { const f = { ...filters, classId: e.target.value }; setFilters(f); void load(f); }}>
              <option value="">Semua</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={(e) => { const f = { ...filters, status: e.target.value }; setFilters(f); void load(f); }}>
              <option value="">Semua</option>
              <option value="DRAFT">Draf</option>
              <option value="PUBLISHED">Published</option>
              <option value="CLOSED">Tutup</option>
            </select>
          </Field>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <ResponsiveTable<Assessment>
            columns={[
              { key: "title", label: "Judul", render: (a) => <Link href={`/penilaian/${a.id}`}>{a.title}</Link> },
              { key: "class", label: "Kelas", render: (a) => nameOf(classes, a.classId) },
              { key: "subject", label: "Mapel", render: (a) => nameOf(subjects, a.subjectId) },
              { key: "category", label: "Kategori", render: (a) => categories.find((c) => c.id === a.categoryId)?.name ?? "—" },
              { key: "maxScore", label: "Maks", render: (a) => a.maxScore },
              { key: "date", label: "Tanggal", render: (a) => formatDate(a.assessmentDate) },
              { key: "status", label: "Status", render: (a) => <Badge status={a.status} /> },
            ]}
            rows={rows}
            rowKey={(a) => a.id}
            title={(a) => <Link href={`/penilaian/${a.id}`}>{a.title}</Link>}
            subtitle={(a) => `${nameOf(classes, a.classId)} · ${nameOf(subjects, a.subjectId)}`}
          />
        )}
      </Card>

      {showForm && (
        <Modal title="Buat Assessment" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <Field label="Penugasan guru" hint="Assessment dibuat dalam lingkup penugasan guru.">
              <select value={form.teacherAssignmentId} onChange={(e) => setForm({ ...form, teacherAssignmentId: e.target.value })}>
                <option value="">— Pilih —</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {nameOf(classes, a.classId)} · {nameOf(subjects, a.subjectId)} · {semesters.find((s) => s.id === a.semesterId)?.name ?? ""}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-row">
              <Field label="Semester">
                <select value={form.semesterId} onChange={(e) => setForm({ ...form, semesterId: e.target.value })}>
                  <option value="">— Pilih —</option>
                  {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Kelas">
                <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                  <option value="">— Pilih —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Mapel">
                <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                  <option value="">— Pilih —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Kategori">
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">— Pilih —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Judul"><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ulangan Harian 1" /></Field>
            <div className="form-row">
              <Field label="Skor maksimal"><input type="number" min={0.01} step="0.01" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} /></Field>
              <Field label="Tanggal"><input type="date" value={form.assessmentDate} onChange={(e) => setForm({ ...form, assessmentDate: e.target.value })} /></Field>
            </div>
            <Field label="Deskripsi"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
