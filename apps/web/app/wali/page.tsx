"use client";

import { useCallback, useEffect, useState } from "react";
import type { Guardian } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Button, Card, Field, Modal, PageHeader, Pagination, Spinner, EmptyState } from "@/components/ui";

export default function WaliPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<Guardian[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await api().guardians.list({ page: p, limit: 20, search: q || undefined });
      setRows(r.data);
      setMeta({ total: r.meta.total, totalPages: r.meta.totalPages });
      setPage(r.meta.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1, ""); }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { setError("Nama wali wajib diisi."); return; }
    setSaving(true);
    try {
      await api().guardians.create({
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setShowForm(false);
      setForm({ fullName: "", phone: "", email: "", address: "" });
      await load(1, search);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Wali"
        subtitle="Data wali/orang tua — tautkan ke siswa dari halaman detail siswa"
        actions={<Button onClick={() => setShowForm(true)}>+ Wali</Button>}
      />
      <Alert kind="error">{error}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Cari">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama wali..." />
          </Field>
          <Button variant="secondary" onClick={() => void load(1, search)}>Cari</Button>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Nama</th><th>Telepon</th><th>Email</th><th>Alamat</th></tr></thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id}>
                    <td>{g.fullName}</td>
                    <td>{g.phone ?? "-"}</td>
                    <td>{g.email ?? "-"}</td>
                    <td>{g.address ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={(p) => void load(p, search)} />
      </Card>

      {showForm && (
        <Modal title="Tambah Wali" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <Field label="Nama lengkap"><input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <div className="form-row">
              <Field label="Telepon"><input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            <Field label="Alamat"><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
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
