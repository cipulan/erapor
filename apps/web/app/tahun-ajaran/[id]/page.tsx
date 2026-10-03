"use client";

import { use, useEffect, useState } from "react";
import type { AcademicYear, Semester } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDate } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner, EmptyState } from "@/components/ui";

export default function TahunAjaranDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [year, setYear] = useState<AcademicYear | null>(null);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "ODD" as "ODD" | "EVEN", name: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [y, s] = await Promise.all([
        api().academicYears.get(id),
        api().semesters.list(id),
      ]);
      setYear(y);
      setSemesters(s);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nama semester wajib diisi."); return; }
    setSaving(true);
    try {
      await api().semesters.create(id, {
        code: form.code,
        name: form.name.trim(),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      setShowForm(false);
      setForm({ code: "ODD", name: "", startDate: "", endDate: "" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title={year ? `Tahun Ajaran ${year.name}` : "Tahun Ajaran"}
        subtitle={year ? `${formatDate(year.startDate)} – ${formatDate(year.endDate)}` : undefined}
        actions={<Button onClick={() => setShowForm(true)}>+ Semester</Button>}
      />
      <Alert kind="error">{error}</Alert>
      {year && <Card><Badge status={year.status} /></Card>}
      <Card title="Semester">
        {semesters.length === 0 ? <EmptyState text="Belum ada semester." /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Nama</th><th>Kode</th><th>Periode</th><th>Status</th></tr></thead>
              <tbody>
                {semesters.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td><Badge status={s.code} /></td>
                    <td>{formatDate(s.startDate)} – {formatDate(s.endDate)}</td>
                    <td><Badge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <Modal title="Tambah Semester" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <div className="form-row">
              <Field label="Kode">
                <select value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value as "ODD" | "EVEN" })}>
                  <option value="ODD">Ganjil</option>
                  <option value="EVEN">Genap</option>
                </select>
              </Field>
              <Field label="Nama"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Semester 1" /></Field>
            </div>
            <div className="form-row">
              <Field label="Tanggal mulai"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
              <Field label="Tanggal selesai"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
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
