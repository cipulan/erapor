"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner } from "@/components/ui";

export default function MapelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [subject, setSubject] = useState<{ code: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCp, setShowCp] = useState(false);
  const [showTp, setShowTp] = useState(false);
  const [cpForm, setCpForm] = useState({ code: "", description: "" });
  const [tpForm, setTpForm] = useState({ cpId: "", code: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api().subjects.list({ limit: 100 }).then((r) => {
      const s = r.data.find((x) => x.id === id);
      if (s) setSubject({ code: s.code, name: s.name });
    }).catch((err) => setError(errorMessage(err))).finally(() => setLoading(false));
  }, [id]);

  async function onCreateCp(e: React.FormEvent) {
    e.preventDefault();
    if (!cpForm.code.trim() || !cpForm.description.trim()) { setError("Kode dan deskripsi CP wajib diisi."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await api().curriculum.createCp(id, { code: cpForm.code.trim(), description: cpForm.description.trim() });
      setShowCp(false);
      setCpForm({ code: "", description: "" });
      setSuccess("CP berhasil ditambahkan.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onCreateTp(e: React.FormEvent) {
    e.preventDefault();
    if (!tpForm.cpId.trim() || !tpForm.code.trim() || !tpForm.description.trim()) {
      setError("ID CP, kode, dan deskripsi TP wajib diisi.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      await api().curriculum.createTp(tpForm.cpId.trim(), { code: tpForm.code.trim(), description: tpForm.description.trim() });
      setShowTp(false);
      setTpForm({ cpId: "", code: "", description: "" });
      setSuccess("TP berhasil ditambahkan.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader title={subject ? `${subject.code} — ${subject.name}` : "Mata Pelajaran"} subtitle="Kelola CP & TP" />
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>
      <Alert kind="info">
        Backend saat ini hanya menyediakan endpoint <em>pembuatan</em> CP/TP (tanpa daftar).
        Untuk membuat TP, masukkan ID CP yang didapat saat CP dibuat (atau dari database).
      </Alert>
      <div className="grid cols-2">
        <Card title="Capaian Pembelajaran (CP)" actions={<Button small onClick={() => setShowCp(true)}>+ CP</Button>}>
          <p className="muted small">CP terkait mapel ini dibuat lewat tombol di atas.</p>
        </Card>
        <Card title="Tujuan Pembelajaran (TP)" actions={<Button small onClick={() => setShowTp(true)}>+ TP</Button>}>
          <p className="muted small">TP harus terkait ke sebuah CP melalui ID-nya.</p>
        </Card>
      </div>
      <Card>
        <Badge status="ACTIVE" label="Mapel aktif" />
      </Card>

      {showCp && (
        <Modal title="Tambah CP" onClose={() => setShowCp(false)}>
          <form onSubmit={onCreateCp}>
            <Field label="Kode CP"><input type="text" value={cpForm.code} onChange={(e) => setCpForm({ ...cpForm, code: e.target.value })} placeholder="CP-MTK-1" /></Field>
            <Field label="Deskripsi"><textarea value={cpForm.description} onChange={(e) => setCpForm({ ...cpForm, description: e.target.value })} /></Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowCp(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
      {showTp && (
        <Modal title="Tambah TP" onClose={() => setShowTp(false)}>
          <form onSubmit={onCreateTp}>
            <Field label="ID CP" hint="UUID CP induk (lihat hasil pembuatan CP).">
              <input type="text" value={tpForm.cpId} onChange={(e) => setTpForm({ ...tpForm, cpId: e.target.value })} placeholder="UUID CP" />
            </Field>
            <Field label="Kode TP"><input type="text" value={tpForm.code} onChange={(e) => setTpForm({ ...tpForm, code: e.target.value })} placeholder="TP-MTK-1.1" /></Field>
            <Field label="Deskripsi"><textarea value={tpForm.description} onChange={(e) => setTpForm({ ...tpForm, description: e.target.value })} /></Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowTp(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
