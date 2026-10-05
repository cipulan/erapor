"use client";

import { use, useCallback, useEffect, useState } from "react";
import type { CurriculumOutcome, LearningObjective, Subject } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner, EmptyState } from "@/components/ui";

type ModalKind = "addCp" | "addTp" | "editCp" | "editTp" | null;

export default function MapelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [cps, setCps] = useState<CurriculumOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modal, setModal] = useState<ModalKind>(null);
  const [saving, setSaving] = useState(false);

  const [cpForm, setCpForm] = useState({ code: "", description: "" });
  const [tpForm, setTpForm] = useState({ cpId: "", code: "", description: "" });
  const [editCp, setEditCp] = useState({ id: "", code: "", description: "", isActive: true });
  const [editTp, setEditTp] = useState({ id: "", code: "", description: "", isActive: true });

  const refresh = useCallback(async () => {
    const list = await api().curriculum.listSubjectCurriculum(id);
    setCps(list);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const [s, list] = await Promise.all([
          api().subjects.list({ limit: 100 }),
          api().curriculum.listSubjectCurriculum(id),
        ]);
        setSubject(s.data.find((x) => x.id === id) ?? null);
        setCps(list);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function closeModal() {
    setModal(null);
    setCpForm({ code: "", description: "" });
    setTpForm({ cpId: "", code: "", description: "" });
  }

  async function onCreateCp(e: React.FormEvent) {
    e.preventDefault();
    if (!cpForm.code.trim() || !cpForm.description.trim()) { setError("Kode dan deskripsi CP wajib diisi."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await api().curriculum.createCp(id, { code: cpForm.code.trim(), description: cpForm.description.trim() });
      closeModal();
      await refresh();
      setSuccess("CP berhasil ditambahkan.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onCreateTp(e: React.FormEvent) {
    e.preventDefault();
    if (!tpForm.cpId || !tpForm.code.trim() || !tpForm.description.trim()) {
      setError("CP induk, kode, dan deskripsi TP wajib diisi.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      await api().curriculum.createTp(tpForm.cpId, { code: tpForm.code.trim(), description: tpForm.description.trim() });
      closeModal();
      await refresh();
      setSuccess("TP berhasil ditambahkan.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openEditCp(cp: CurriculumOutcome) {
    setEditCp({ id: cp.id, code: cp.code, description: cp.description, isActive: cp.isActive });
    setModal("editCp");
  }

  async function onUpdateCp(e: React.FormEvent) {
    e.preventDefault();
    if (!editCp.code.trim() || !editCp.description.trim()) { setError("Kode dan deskripsi CP wajib diisi."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await api().curriculum.updateCp(editCp.id, {
        code: editCp.code.trim(),
        description: editCp.description.trim(),
        isActive: editCp.isActive,
      });
      setModal(null);
      await refresh();
      setSuccess("CP berhasil diubah.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteCp(cp: CurriculumOutcome) {
    if (!confirm(`Hapus CP "${cp.code}" beserta deskripsinya?`)) return;
    setError(""); setSuccess("");
    try {
      await api().curriculum.deleteCp(cp.id);
      await refresh();
      setSuccess("CP berhasil dihapus.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function openAddTp(cpId: string) {
    setTpForm({ cpId, code: "", description: "" });
    setModal("addTp");
  }

  function openEditTp(tp: LearningObjective) {
    setEditTp({ id: tp.id, code: tp.code, description: tp.description, isActive: tp.isActive });
    setModal("editTp");
  }

  async function onUpdateTp(e: React.FormEvent) {
    e.preventDefault();
    if (!editTp.code.trim() || !editTp.description.trim()) { setError("Kode dan deskripsi TP wajib diisi."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await api().curriculum.updateTp(editTp.id, {
        code: editTp.code.trim(),
        description: editTp.description.trim(),
        isActive: editTp.isActive,
      });
      setModal(null);
      await refresh();
      setSuccess("TP berhasil diubah.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteTp(tpId: string, code: string) {
    if (!confirm(`Hapus TP "${code}"?`)) return;
    setError(""); setSuccess("");
    try {
      await api().curriculum.deleteTp(tpId);
      await refresh();
      setSuccess("TP berhasil dihapus.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onToggleTp(tp: { id: string; code: string; isActive: boolean }) {
    setError(""); setSuccess("");
    try {
      await api().curriculum.updateTp(tp.id, { isActive: !tp.isActive });
      await refresh();
      setSuccess(`TP "${tp.code}" ${tp.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (authLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title={subject ? `${subject.code} — ${subject.name}` : "Mata Pelajaran"}
        subtitle="Kelola Capaian Pembelajaran (CP) & Tujuan Pembelajaran (TP)"
        actions={<Button onClick={() => setModal("addCp")}>+ CP</Button>}
      />
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>

      {cps.length === 0 ? (
        <Card title="Capaian Pembelajaran (CP)">
          <EmptyState text="Belum ada CP untuk mapel ini. Tambahkan CP pertama lewat tombol + CP." />
        </Card>
      ) : (
        cps.map((cp) => (
          <Card
            key={cp.id}
            title={cp.code}
            actions={
              <div className="btn-row" style={{ marginTop: 0 }}>
                <Badge status={cp.isActive ? "ACTIVE" : "INACTIVE"} />
                <Button small variant="secondary" onClick={() => openAddTp(cp.id)}>+ TP</Button>
                <Button small variant="secondary" onClick={() => openEditCp(cp)}>Ubah</Button>
                <Button small variant="danger" onClick={() => void onDeleteCp(cp)}>Hapus</Button>
              </div>
            }
          >
            <p className="small" style={{ marginBottom: 12 }}>{cp.description}</p>
            {(cp.tps ?? []).length === 0 ? (
              <p className="muted small">Belum ada TP di CP ini.</p>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th style={{ width: 120 }}>Kode</th><th>Deskripsi TP</th><th style={{ width: 90 }}>Status</th><th style={{ width: 200 }}></th></tr></thead>
                  <tbody>
                    {(cp.tps ?? []).map((tp) => (
                      <tr key={tp.id} style={tp.isActive ? undefined : { opacity: 0.55 }}>
                        <td><b>{tp.code}</b></td>
                        <td className="small">{tp.description}</td>
                        <td><Badge status={tp.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                        <td>
                          <div className="btn-row" style={{ marginTop: 0, gap: 6 }}>
                            <Button small variant="secondary" onClick={() => openEditTp(tp)}>Ubah</Button>
                            <Button small variant="secondary" onClick={() => void onToggleTp(tp)}>
                              {tp.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                            <Button small variant="danger" onClick={() => void onDeleteTp(tp.id, tp.code)}>Hapus</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))
      )}

      {modal === "addCp" && (
        <Modal title="Tambah CP" onClose={closeModal}>
          <form onSubmit={onCreateCp}>
            <Field label="Kode CP"><input type="text" value={cpForm.code} onChange={(e) => setCpForm({ ...cpForm, code: e.target.value })} placeholder="CP-MTK-1" /></Field>
            <Field label="Deskripsi"><textarea value={cpForm.description} onChange={(e) => setCpForm({ ...cpForm, description: e.target.value })} /></Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={closeModal}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "addTp" && (
        <Modal title="Tambah TP" onClose={closeModal}>
          <form onSubmit={onCreateTp}>
            <Field label="CP induk" hint="Pilih CP tempat TP ini berada.">
              <select value={tpForm.cpId} onChange={(e) => setTpForm({ ...tpForm, cpId: e.target.value })}>
                <option value="">— Pilih CP —</option>
                {cps.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.description.slice(0, 60)}</option>)}
              </select>
            </Field>
            <Field label="Kode TP"><input type="text" value={tpForm.code} onChange={(e) => setTpForm({ ...tpForm, code: e.target.value })} placeholder="TP-MTK-1.1" /></Field>
            <Field label="Deskripsi"><textarea value={tpForm.description} onChange={(e) => setTpForm({ ...tpForm, description: e.target.value })} /></Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={closeModal}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "editCp" && (
        <Modal title="Ubah CP" onClose={() => setModal(null)}>
          <form onSubmit={onUpdateCp}>
            <Field label="Kode CP"><input type="text" value={editCp.code} onChange={(e) => setEditCp({ ...editCp, code: e.target.value })} /></Field>
            <Field label="Deskripsi"><textarea value={editCp.description} onChange={(e) => setEditCp({ ...editCp, description: e.target.value })} /></Field>
            <Field label="Status">
              <select value={editCp.isActive ? "1" : "0"} onChange={(e) => setEditCp({ ...editCp, isActive: e.target.value === "1" })}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={() => setModal(null)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "editTp" && (
        <Modal title="Ubah TP" onClose={() => setModal(null)}>
          <form onSubmit={onUpdateTp}>
            <Field label="Kode TP"><input type="text" value={editTp.code} onChange={(e) => setEditTp({ ...editTp, code: e.target.value })} /></Field>
            <Field label="Deskripsi"><textarea value={editTp.description} onChange={(e) => setEditTp({ ...editTp, description: e.target.value })} /></Field>
            <Field label="Status">
              <select value={editTp.isActive ? "1" : "0"} onChange={(e) => setEditTp({ ...editTp, isActive: e.target.value === "1" })}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={() => setModal(null)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
