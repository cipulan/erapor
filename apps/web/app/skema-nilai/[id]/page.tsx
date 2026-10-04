"use client";

import { use, useEffect, useState } from "react";
import type { AssessmentCategory, GradingScheme } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDateTime } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, PageHeader, Spinner } from "@/components/ui";

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
  const editable = scheme?.status === "DRAFT";

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
    if (!confirm("Publish skema? Setelah publish, bobot tidak bisa diubah lagi.")) return;
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

  if (authLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Kelola Bobot Skema"
        subtitle={scheme ? `Status: ${scheme.status}` : undefined}
        actions={
          editable ? (
            <Button variant="success" onClick={() => void onPublish()} disabled={saving}>Publish</Button>
          ) : scheme?.status === "PUBLISHED" ? (
            <Button variant="secondary" onClick={() => void onUnpublish()} disabled={saving}>Batalkan Publish</Button>
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
          actions={scheme.status === "PUBLISHED" ? <span className="small muted">Dipublish {formatDateTime(scheme.publishedAt)}</span> : <Badge status={scheme.status} />}
        >
          {!editable && (
            <Alert kind="info">Skema berstatus Terbit sehingga bobot dikunci. Untuk mengubah, batalkan dulu publish-nya via tombol di atas — hanya bisa bila belum ada nilai yang diinput pada semester ini.</Alert>
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
    </>
  );
}
