"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AcademicYear, GradingScheme, Semester } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner, EmptyState } from "@/components/ui";

export default function SkemaNilaiPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<GradingScheme[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ academicYearId: "", semesterId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (yearId: string) => {
    setLoading(true);
    setError("");
    try {
      setRows(await api().gradingSchemes.list(yearId ? { academicYearId: yearId } : undefined));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const y = await api().academicYears.list({ limit: 50 });
        setYears(y.data);
        const active = y.data.find((x) => x.status === "ACTIVE");
        const yid = active?.id ?? "";
        setYearFilter(yid);
        if (yid) setSemesters(await api().semesters.list(yid));
        await load(yid);
      } catch (err) {
        setError(errorMessage(err));
        setLoading(false);
      }
    })();
  }, [load]);

  async function onFilterYear(yid: string) {
    setYearFilter(yid);
    setSemesters(yid ? await api().semesters.list(yid).catch(() => []) : []);
    void load(yid);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.academicYearId || !form.semesterId) { setError("Tahun ajaran dan semester wajib dipilih."); return; }
    setSaving(true);
    setError("");
    try {
      const s = await api().gradingSchemes.create(form);
      setShowForm(false);
      window.location.href = `/skema-nilai/${s.id}`;
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Skema Nilai" subtitle="Atur bobot kategori per semester, lalu publish" actions={<Button onClick={() => setShowForm(true)}>+ Skema</Button>} />
      <Alert kind="error">{error}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Tahun ajaran">
            <select value={yearFilter} onChange={(e) => void onFilterYear(e.target.value)}>
              <option value="">Semua</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Semester</th><th>Status</th><th>Bobot</th><th>Aksi</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{semesters.find((x) => x.id === s.semesterId)?.name ?? s.semesterId.slice(0, 8) + "…"}</td>
                    <td><Badge status={s.status} /></td>
                    <td className="small">{s.weights.map((w) => `${w.weight}%`).join(" + ") || "-"}</td>
                    <td><Link href={`/skema-nilai/${s.id}`} className="btn small secondary">Kelola</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <Modal title="Buat Skema Nilai" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <Field label="Tahun ajaran">
              <select value={form.academicYearId} onChange={async (e) => {
                const yid = e.target.value;
                setForm({ academicYearId: yid, semesterId: "" });
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
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Buat & atur bobot"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
