"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AcademicYear } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDate } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Pagination, Spinner, EmptyState } from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";

export default function TahunAjaranPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<AcademicYear[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError("");
    try {
      const r = await api().academicYears.list({ page: p, limit: 20 });
      setRows(r.data);
      setMeta({ total: r.meta.total, totalPages: r.meta.totalPages });
      setPage(r.meta.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setError("Nama, tanggal mulai, dan tanggal selesai wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      await api().academicYears.create(form);
      setShowForm(false);
      setForm({ name: "", startDate: "", endDate: "" });
      await load(1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onActivate(id: string) {
    if (!confirm("Aktifkan tahun ajaran ini? Tahun ajaran aktif lainnya akan dinonaktifkan.")) return;
    setError("");
    try {
      await api().academicYears.activate(id);
      await load(page);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Tahun Ajaran"
        subtitle="Kelola tahun ajaran dan semester"
        actions={<Button onClick={() => setShowForm(true)}>+ Tahun Ajaran</Button>}
      />
      <Alert kind="error">{error}</Alert>
      <Card>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <ResponsiveTable<AcademicYear>
            columns={[
              { key: "name", label: "Nama", render: (y) => <Link href={`/tahun-ajaran/${y.id}`}>{y.name}</Link> },
              { key: "startDate", label: "Mulai", render: (y) => formatDate(y.startDate) },
              { key: "endDate", label: "Selesai", render: (y) => formatDate(y.endDate) },
              { key: "status", label: "Status", render: (y) => <Badge status={y.status} /> },
              {
                key: "aksi", label: "Aksi",
                render: (y) => (
                  <div className="btn-row" style={{ marginTop: 0 }}>
                    <Link href={`/tahun-ajaran/${y.id}`} className="btn small secondary">Semester</Link>
                    {y.status !== "ACTIVE" && (
                      <Button small variant="success" onClick={() => void onActivate(y.id)}>Aktifkan</Button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={rows}
            rowKey={(y) => y.id}
            title={(y) => <Link href={`/tahun-ajaran/${y.id}`}>{y.name}</Link>}
            subtitle={(y) => `${formatDate(y.startDate)} – ${formatDate(y.endDate)}`}
          />
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={(p) => void load(p)} />
      </Card>

      {showForm && (
        <Modal title="Tambah Tahun Ajaran" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <Field label="Nama"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2026/2027" /></Field>
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
