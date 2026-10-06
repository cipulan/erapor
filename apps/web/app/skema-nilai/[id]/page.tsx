"use client";

import { use, useEffect, useState } from "react";
import type { AssessmentCategory, GradingScheme } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDateTime } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner } from "@/components/ui";

export default function SkemaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [scheme, setScheme] = useState<GradingScheme | null>(null);
  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [weights, setWeights] = useState<{ categoryId: string; weight: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [schemes, cats] = await Promise.all([
        api().gradingSchemes.list(),
        api().categories.list({ active: true }),
      ]);
      const s = schemes.find((x) => x.id === id) ?? null;
      setScheme(s);
      setCategories(cats);
      if (s) {
        setWeights(
          s.weights.length > 0
            ? s.weights.map((w) => ({ categoryId: w.categoryId, weight: String(w.weight) }))
            : cats.map((c) => ({ categoryId: c.id, weight: "" })),
        );
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  const total = weights.reduce((sum, w) => sum + (parseFloat(w.weight) || 0), 0);
  const isLocked = scheme?.isLocked === true;
  const isPublished = scheme?.status === "PUBLISHED";
  const editable = !isLocked && (scheme?.status === "DRAFT" || isPublished);

  function setWeight(i: number, v: string) {
    setWeights(weights.map((w, j) => (j === i ? { ...w, weight: v } : w)));
  }
  function addRow() {
    setWeights([...weights, { categoryId: "", weight: "" }]);
  }
  function removeRow(i: number) {
    setWeights(weights.filter((_, j) => j !== i));
  }

  async function onSave() {
    setError(""); setSuccess("");
    const parsed = weights
      .filter((w) => w.categoryId && w.weight !== "")
      .map((w) => ({ categoryId: w.categoryId, weight: parseFloat(w.weight) }));
    if (parsed.length === 0) { setError("Isi minimal satu bobot kategori."); return; }
    if (parsed.some((w) => Number.isNaN(w.weight) || w.weight < 0 || w.weight > 100)) {
      setError("Bobot harus angka 0–100.");
      return;
    }
    if (isPublished && !confirm("Skema sudah dipublish. Perubahan bobot hanya mempengaruhi preview nilai dan rapor yang dibuat setelah ini — rapor yang sudah terbit tidak berubah. Lanjutkan?")) return;
    setSaving(true);
    try {
      const s = await api().gradingSchemes.replaceWeights(id, { weights: parsed });
      setScheme(s);
      setSuccess("Bobot berhasil disimpan.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    if (Math.abs(total - 100) > 0.001) {
      setError("Total bobot harus tepat 100% sebelum publish.");
      return;
    }
    if (!confirm("Publish skema? Setelah publish, bobot masih bisa diubah sampai skema dikunci.")) return;
    setError(""); setSuccess("");
    setSaving(true);
    try {
      const s = await api().gradingSchemes.publish(id);
      setScheme(s);
      setSuccess("Skema berhasil di-publish.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onUnpublish() {
    if (!confirm("Batalkan publish? Skema kembali menjadi DRAFT dan bobot bisa diubah lagi.")) return;
    setError(""); setSuccess("");
    setSaving(true);
    try {
      const s = await api().gradingSchemes.unpublish(id);
      setScheme(s);
      setSuccess("Publish dibatalkan — skema kembali menjadi DRAFT.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onLock() {
    if (!confirm("Kunci skema? Setelah dikunci, bobot tidak dapat diubah lagi sampai dibuka kuncinya. Biasanya dilakukan di akhir semester setelah ujian akhir.")) return;
    setError(""); setSuccess("");
    setSaving(true);
    try {
      const s = await api().gradingSchemes.lock(id);
      setScheme(s);
      setSuccess("Skema berhasil dikunci.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!unlockReason.trim()) { setError("Alasan buka kunci wajib diisi."); return; }
    setError(""); setSuccess("");
    setSaving(true);
    try {
      const s = await api().gradingSchemes.unlock(id, { reason: unlockReason.trim() });
      setScheme(s);
      setShowUnlock(false);
      setUnlockReason("");
      setSuccess("Kunci darurat dibuka — skema dapat diubah kembali.");
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
        title="Kelola Bobot Skema"
        subtitle={scheme ? `Status: ${scheme.status}${isLocked ? " (Terkunci)" : ""}` : undefined}
        actions={
          !scheme ? undefined : isLocked ? (
            <Button variant="warn" onClick={() => setShowUnlock(true)} disabled={saving}>🔓 Buka Kunci Darurat</Button>
          ) : scheme.status === "DRAFT" ? (
            <Button variant="success" onClick={() => void onPublish()} disabled={saving}>Publish</Button>
          ) : isPublished ? (
            <div className="btn-row" style={{ marginTop: 0 }}>
              <Button variant="secondary" onClick={() => void onUnpublish()} disabled={saving}>Batalkan Publish</Button>
              <Button variant="danger" onClick={() => void onLock()} disabled={saving}>🔒 Kunci Skema</Button>
            </div>
          ) : undefined
        }
      />
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>

      {!scheme ? (
        <Card><p className="muted">Skema tidak ditemukan.</p></Card>
      ) : (
        <Card
          title="Bobot kategori"
          actions={
            isLocked ? <Badge status="LOCKED" /> :
            isPublished ? <span className="small muted">Dipublish {formatDateTime(scheme.publishedAt)}</span> :
            <Badge status={scheme.status} />
          }
        >
          {isLocked && (
            <Alert kind="info">🔒 Skema dikunci{formatDateTime(scheme.lockedAt) ? ` pada ${formatDateTime(scheme.lockedAt)}` : ""}. Bobot tidak dapat diubah. Gunakan "Buka Kunci Darurat" bila terjadi kesalahan — tercatat di audit log.</Alert>
          )}
          {!isLocked && isPublished && (
            <Alert kind="info">Skema sudah dipublish. Bobot masih bisa diubah — perubahan hanya mempengaruhi preview nilai dan rapor yang dibuat setelah ini; rapor yang sudah terbit tidak berubah. Kunci skema di akhir semester bila sudah final.</Alert>
          )}
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Kategori</th><th style={{ width: 140 }}>Bobot (%)</th>{editable && <th style={{ width: 60 }}></th>}</tr></thead>
              <tbody>
                {weights.map((w, i) => (
                  <tr key={i}>
                    <td>
                      {editable ? (
                        <select value={w.categoryId} onChange={(e) => setWeights(weights.map((x, j) => j === i ? { ...x, categoryId: e.target.value } : x))}>
                          <option value="">— Pilih kategori —</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        categories.find((c) => c.id === w.categoryId)?.name ?? w.categoryId.slice(0, 8)
                      )}
                    </td>
                    <td>
                      {editable
                        ? <input type="number" min={0} max={100} step="0.01" value={w.weight} onChange={(e) => setWeight(i, e.target.value)} />
                        : `${w.weight}%`}
                    </td>
                    {editable && <td><Button small variant="danger" onClick={() => removeRow(i)}>Hapus</Button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="btn-row" style={{ alignItems: "center" }}>
            {editable && <><Button variant="secondary" onClick={addRow}>+ Baris</Button><Button onClick={() => void onSave()} disabled={saving}>{saving ? "Menyimpan..." : "Simpan bobot"}</Button></>}
            <span className={Math.abs(total - 100) > 0.001 ? "badge red" : "badge green"}>Total: {total.toLocaleString("id-ID")}%</span>
          </div>
          {editable && <p className="small muted mt">Total bobot harus tepat 100% agar bisa di-publish.</p>}
        </Card>
      )}

      {showUnlock && (
        <Modal title="🔓 Buka Kunci Darurat" onClose={() => setShowUnlock(false)}>
          <form onSubmit={onUnlock}>
            <Alert kind="info">Buka kunci hanya untuk keadaan darurat (mis. salah kunci atau bobot keliru). Alasan wajib diisi dan tercatat di audit log.</Alert>
            <Field label="Alasan buka kunci">
              <textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} placeholder="Cth: salah input bobot SAS, seharusnya 40%" />
            </Field>
            <div className="btn-row">
              <Button type="submit" variant="warn" disabled={saving}>{saving ? "Memproses..." : "Buka Kunci"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowUnlock(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
