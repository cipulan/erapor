"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Subject } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Pagination, Spinner, EmptyState } from "@/components/ui";

export default function MapelPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<Subject[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", subjectType: "MANDATORY" as Subject["subjectType"] });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError("");
    try {
      const r = await api().subjects.list({ page: p, limit: 20 });
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
    if (!form.code.trim() || !form.name.trim()) { setError("Kode dan nama mapel wajib diisi."); return; }
    setSaving(true);
    try {
      await api().subjects.create({ code: form.code.trim(), name: form.name.trim(), subjectType: form.subjectType });
      setShowForm(false);
      setForm({ code: "", name: "", subjectType: "MANDATORY" });
      await load(1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Mata Pelajaran" subtitle="Kelola mapel, CP, dan TP" actions={<Button onClick={() => setShowForm(true)}>+ Mapel</Button>} />
      <Alert kind="error">{error}</Alert>
      <Card>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Kode</th><th>Nama</th><th>Tipe</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/mapel/${s.id}`}>{s.code}</Link></td>
                    <td>{s.name}</td>
                    <td><Badge status={s.subjectType} /></td>
                    <td><Badge status={s.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={(p) => void load(p)} />
      </Card>

      {showForm && (
        <Modal title="Tambah Mata Pelajaran" onClose={() => setShowForm(false)}>
          <form onSubmit={onCreate}>
            <div className="form-row">
              <Field label="Kode"><input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MTK" /></Field>
              <Field label="Nama"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Matematika" /></Field>
            </div>
            <Field label="Tipe">
              <select value={form.subjectType} onChange={(e) => setForm({ ...form, subjectType: e.target.value as Subject["subjectType"] })}>
                <option value="MANDATORY">Wajib</option>
                <option value="ADDITIONAL">Tambahan</option>
                <option value="LOCAL">Mulok</option>
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
