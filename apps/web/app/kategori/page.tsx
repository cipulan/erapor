"use client";

import { useCallback, useEffect, useState } from "react";
import type { AssessmentCategory } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner, EmptyState } from "@/components/ui";

export default function KategoriPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<AssessmentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await api().categories.list());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nama kategori wajib diisi."); return; }
    setSaving(true);
    try {
      await api().categories.create({ name: form.name.trim(), description: form.description.trim() || undefined });
      setShowForm(false);
      setForm({ name: "", description: "" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Kategori Penilaian" subtitle="Cth: Formatif, Sumatif, Proyek" actions={<Button onClick={() => setShowForm(true)}>+ Kategori</Button>} />
      <Alert kind="error">{error}</Alert>
      <Card>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Nama</th><th>Deskripsi</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.description ?? "-"}</td>
                    <td><Badge status={c.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <Modal title="Tambah Kategori" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <Field label="Nama"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Formatif" /></Field>
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
