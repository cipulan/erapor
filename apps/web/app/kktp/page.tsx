"use client";

import { useCallback, useEffect, useState } from "react";
import type { AcademicYear, KktpConfiguration, Semester, Subject } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Button, Card, Field, Modal, PageHeader, Spinner, EmptyState } from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";

export default function KktpPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<KktpConfiguration[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filters, setFilters] = useState({ academicYearId: "", semesterId: "", subjectId: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ academicYearId: "", semesterId: "", subjectId: "", threshold: "75", description: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (f: typeof filters) => {
    setLoading(true);
    setError("");
    try {
      setRows(await api().kktp.list({
        academicYearId: f.academicYearId || undefined,
        semesterId: f.semesterId || undefined,
        subjectId: f.subjectId || undefined,
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
        const [y, sj] = await Promise.all([c.academicYears.list({ limit: 50 }), c.subjects.list({ limit: 100 })]);
        setYears(y.data);
        setSubjects(sj.data);
        const active = y.data.find((x) => x.status === "ACTIVE");
        const yid = active?.id ?? "";
        if (yid) {
          setSemesters(await c.semesters.list(yid));
          setFilters((f) => ({ ...f, academicYearId: yid }));
          await load({ academicYearId: yid, semesterId: "", subjectId: "" });
        } else {
          await load({ academicYearId: "", semesterId: "", subjectId: "" });
        }
      } catch (err) {
        setError(errorMessage(err));
        setLoading(false);
      }
    })();
  }, [load]);

  async function onFilterYear(yid: string) {
    const f = { ...filters, academicYearId: yid, semesterId: "" };
    setFilters(f);
    setSemesters(yid ? await api().semesters.list(yid).catch(() => []) : []);
    void load(f);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const threshold = parseFloat(form.threshold);
    if (!form.academicYearId || !form.semesterId || !form.subjectId) { setError("Tahun ajaran, semester, dan mapel wajib dipilih."); return; }
    if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) { setError("Threshold harus angka 0–100."); return; }
    setSaving(true);
    setError("");
    try {
      await api().kktp.upsert({
        academicYearId: form.academicYearId,
        semesterId: form.semesterId,
        subjectId: form.subjectId,
        threshold,
        description: form.description.trim() || undefined,
      });
      setShowForm(false);
      setForm({ academicYearId: "", semesterId: "", subjectId: "", threshold: "75", description: "" });
      await load(filters);
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
      <PageHeader title="KKTP" subtitle="Kriteria Ketercapaian Tujuan Pembelajaran per mapel" actions={<Button onClick={() => setShowForm(true)}>+ Atur KKTP</Button>} />
      <Alert kind="error">{error}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Tahun ajaran">
            <select value={filters.academicYearId} onChange={(e) => void onFilterYear(e.target.value)}>
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
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <ResponsiveTable<KktpConfiguration>
            columns={[
              { key: "subject", label: "Mapel", render: (k) => nameOf(subjects, k.subjectId) },
              { key: "semester", label: "Semester", render: (k) => nameOf(semesters, k.semesterId) },
              { key: "threshold", label: "Threshold", render: (k) => <strong>{k.threshold}</strong> },
              { key: "description", label: "Keterangan", render: (k) => k.description ?? "-" },
            ]}
            rows={rows}
            rowKey={(k) => k.id}
            title={(k) => nameOf(subjects, k.subjectId)}
            subtitle={(k) => `${nameOf(semesters, k.semesterId)} · KKTP ${k.threshold}`}
          />
        )}
      </Card>

      {showForm && (
        <Modal title="Atur KKTP" onClose={() => setShowForm(false)}>
          <form onSubmit={onSave}>
            <div className="form-row">
              <Field label="Tahun ajaran">
                <select value={form.academicYearId} onChange={async (e) => {
                  const yid = e.target.value;
                  setForm({ ...form, academicYearId: yid, semesterId: "" });
                  setSemesters(yid ? await api().semesters.list(yid).catch(() => []) : []);
                }}>
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
              <Field label="Mapel">
                <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                  <option value="">— Pilih —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Threshold (0–100)">
                <input type="number" min={0} max={100} step="0.01" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
              </Field>
            </div>
            <Field label="Keterangan"><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
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
