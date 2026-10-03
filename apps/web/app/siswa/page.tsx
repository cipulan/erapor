"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Gender, Student } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Pagination, Spinner, EmptyState } from "@/components/ui";

export default function SiswaPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<Student[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", nis: "", nisn: "", gender: "" as "" | Gender, birthPlace: "", birthDate: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await api().students.list({ page: p, limit: 20, search: q || undefined });
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
    if (!form.fullName.trim()) { setError("Nama lengkap wajib diisi."); return; }
    setSaving(true);
    try {
      await api().students.create({
        fullName: form.fullName.trim(),
        nis: form.nis.trim() || undefined,
        nisn: form.nisn.trim() || undefined,
        gender: form.gender || undefined,
        birthPlace: form.birthPlace.trim() || undefined,
        birthDate: form.birthDate || undefined,
      });
      setShowForm(false);
      setForm({ fullName: "", nis: "", nisn: "", gender: "", birthPlace: "", birthDate: "" });
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
        title="Siswa"
        subtitle="Data siswa, enrollment, dan wali"
        actions={<Button onClick={() => setShowForm(true)}>+ Siswa</Button>}
      />
      <Alert kind="error">{error}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Cari">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama / NIS..." />
          </Field>
          <Button variant="secondary" onClick={() => void load(1, search)}>Cari</Button>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Nama</th><th>NIS</th><th>NISN</th><th>JK</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/siswa/${s.id}`}>{s.fullName}</Link></td>
                    <td>{s.nis ?? "-"}</td>
                    <td>{s.nisn ?? "-"}</td>
                    <td>{s.gender === "MALE" ? "L" : s.gender === "FEMALE" ? "P" : "-"}</td>
                    <td><Badge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={(p) => void load(p, search)} />
      </Card>

      {showForm && (
        <Modal title="Tambah Siswa" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <Field label="Nama lengkap"><input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <div className="form-row">
              <Field label="NIS"><input type="text" value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} /></Field>
              <Field label="NISN"><input type="text" value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} /></Field>
            </div>
            <div className="form-row">
              <Field label="Jenis kelamin">
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as "" | Gender })}>
                  <option value="">—</option>
                  <option value="MALE">Laki-laki</option>
                  <option value="FEMALE">Perempuan</option>
                </select>
              </Field>
              <Field label="Tanggal lahir"><input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></Field>
            </div>
            <Field label="Tempat lahir"><input type="text" value={form.birthPlace} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} /></Field>
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
