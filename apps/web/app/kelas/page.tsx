"use client";

import { useCallback, useEffect, useState } from "react";
import type { AcademicYear, ClassItem, UserItem } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Button, Card, Field, Modal, PageHeader, Pagination, Spinner, EmptyState } from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";

export default function KelasPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<ClassItem[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ academicYearId: "", name: "", gradeLevel: 1, homeroomTeacherId: "" });
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState<UserItem[]>([]);

  function openForm() {
    setForm({ academicYearId: yearFilter || "", name: "", gradeLevel: 1, homeroomTeacherId: "" });
    setShowForm(true);
    void api().users.list({ role: "TEACHER", limit: 100 }).then(
      (r) => setTeachers(r.data),
      () => setTeachers([]),
    );
  }

  const load = useCallback(async (p: number, yearId: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await api().classes.list({ page: p, limit: 20, academicYearId: yearId || undefined });
      setRows(r.data);
      setMeta({ total: r.meta.total, totalPages: r.meta.totalPages });
      setPage(r.meta.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api().academicYears.list({ limit: 50 }).then((r) => {
      setYears(r.data);
      const active = r.data.find((y) => y.status === "ACTIVE");
      const yid = active?.id ?? "";
      setYearFilter(yid);
      void load(1, yid);
    }).catch((err) => { setError(errorMessage(err)); setLoading(false); });
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.academicYearId || !form.name.trim()) { setError("Tahun ajaran dan nama kelas wajib diisi."); return; }
    setSaving(true);
    try {
      await api().classes.create({
        academicYearId: form.academicYearId,
        name: form.name.trim(),
        gradeLevel: form.gradeLevel,
        homeroomTeacherId: form.homeroomTeacherId.trim() || undefined,
      });
      setShowForm(false);
      setForm({ academicYearId: "", name: "", gradeLevel: 1, homeroomTeacherId: "" });
      await load(1, yearFilter);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Kelas" subtitle="Kelola kelas per tahun ajaran" actions={<Button onClick={openForm}>+ Kelas</Button>} />
      <Alert kind="error">{error}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Tahun ajaran">
            <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); void load(1, e.target.value); }}>
              <option value="">Semua</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <ResponsiveTable<ClassItem>
            columns={[
              { key: "name", label: "Nama", render: (c) => c.name },
              { key: "gradeLevel", label: "Tingkat", render: (c) => c.gradeLevel },
              { key: "academicYear", label: "Tahun ajaran", render: (c) => years.find((y) => y.id === c.academicYearId)?.name ?? "-" },
            ]}
            rows={rows}
            rowKey={(c) => c.id}
            title={(c) => c.name}
            subtitle={(c) => `Tingkat ${c.gradeLevel} · ${years.find((y) => y.id === c.academicYearId)?.name ?? "-"}`}
          />
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={(p) => void load(p, yearFilter)} />
      </Card>

      {showForm && (
        <Modal title="Tambah Kelas" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <Field label="Tahun ajaran">
              <select value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}>
                <option value="">— Pilih —</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </Field>
            <div className="form-row">
              <Field label="Nama kelas"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="4A" /></Field>
              <Field label="Tingkat (1–6)">
                <input type="number" min={1} max={6} value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Wali kelas (opsional)">
              <select value={form.homeroomTeacherId} onChange={(e) => setForm({ ...form, homeroomTeacherId: e.target.value })}>
                <option value="">— Tanpa wali kelas —</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName} ({t.email})</option>)}
              </select>
            </Field>
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
