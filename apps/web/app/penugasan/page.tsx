"use client";

import { useCallback, useEffect, useState } from "react";
import type { AcademicYear, ClassItem, Semester, Subject, TeacherAssignment, UserItem } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner, EmptyState } from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";

export default function PenugasanPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<TeacherAssignment[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<UserItem[]>([]);
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ teacherId: "", academicYearId: "", semesterId: "", classId: "", subjectId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (yearId: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await api().assignments.list(yearId ? { academicYearId: yearId } : undefined);
      setRows(r);
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
        const [y, cl, sj, tr] = await Promise.all([
          c.academicYears.list({ limit: 50 }),
          c.classes.list({ limit: 100 }),
          c.subjects.list({ limit: 100 }),
          c.users.list({ role: "TEACHER", limit: 100 }),
        ]);
        setYears(y.data);
        setClasses(cl.data);
        setSubjects(sj.data);
        setTeachers(tr.data);
        const active = y.data.find((x) => x.status === "ACTIVE");
        const yid = active?.id ?? "";
        setYearFilter(yid);
        if (yid) {
          const sems = await c.semesters.list(yid);
          setSemesters(sems);
        }
        await load(yid);
      } catch (err) {
        setError(errorMessage(err));
        setLoading(false);
      }
    })();
  }, [load]);

  async function onFormYearChange(yid: string) {
    setForm({ ...form, academicYearId: yid, semesterId: "", classId: "" });
    if (yid) {
      try {
        const [sems, cls] = await Promise.all([
          api().semesters.list(yid),
          api().classes.list({ academicYearId: yid, limit: 100 }),
        ]);
        setSemesters(sems);
        setClasses(cls.data);
      } catch (err) {
        setError(errorMessage(err));
      }
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const { teacherId, academicYearId, semesterId, classId, subjectId } = form;
    if (!teacherId.trim() || !academicYearId || !semesterId || !classId || !subjectId) {
      setError("Semua field wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api().assignments.create({ teacherId: teacherId.trim(), academicYearId, semesterId, classId, subjectId });
      setShowForm(false);
      setForm({ teacherId: "", academicYearId: "", semesterId: "", classId: "", subjectId: "" });
      await load(yearFilter);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (list: { id: string; name: string }[], id: string) =>
    list.find((x) => x.id === id)?.name ?? id.slice(0, 8) + "…";

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Penugasan Guru" subtitle="Assign guru → kelas → mapel per semester" actions={<Button onClick={() => setShowForm(true)}>+ Penugasan</Button>} />
      <Alert kind="error">{error}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Tahun ajaran">
            <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); void load(e.target.value); }}>
              <option value="">Semua</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <ResponsiveTable<TeacherAssignment>
            columns={[
              { key: "teacher", label: "Guru", render: (a) => teachers.find((t) => t.id === a.teacherId)?.fullName ?? a.teacherId.slice(0, 8) + "…" },
              { key: "class", label: "Kelas", render: (a) => nameOf(classes, a.classId) },
              { key: "subject", label: "Mapel", render: (a) => nameOf(subjects, a.subjectId) },
              { key: "semester", label: "Semester", render: (a) => semesters.find((s) => s.id === a.semesterId)?.name ?? a.semesterId.slice(0, 8) + "…" },
              { key: "status", label: "Status", render: (a) => <Badge status={a.status} /> },
            ]}
            rows={rows}
            rowKey={(a) => a.id}
            title={(a) => teachers.find((t) => t.id === a.teacherId)?.fullName ?? "-"}
            subtitle={(a) => `${nameOf(classes, a.classId)} · ${nameOf(subjects, a.subjectId)}`}
          />
        )}
      </Card>

      {showForm && (
        <Modal title="Tambah Penugasan" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <Field label="Guru">
              <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">— Pilih guru —</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName} ({t.email})</option>)}
              </select>
            </Field>
            <div className="form-row">
              <Field label="Tahun ajaran">
                <select value={form.academicYearId} onChange={(e) => void onFormYearChange(e.target.value)}>
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
            <div className="form-row">
              <Field label="Kelas">
                <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                  <option value="">— Pilih —</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Mapel">
                <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                  <option value="">— Pilih —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
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
