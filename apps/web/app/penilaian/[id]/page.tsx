"use client";

import { use, useEffect, useState } from "react";
import type { Assessment, AssessmentScore, ClassItem, CurriculumOutcome, ImportPreview, Student, Subject } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDate } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, PageHeader, Spinner, EmptyState } from "@/components/ui";

export default function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN", "TEACHER"]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [scores, setScores] = useState<Record<string, AssessmentScore>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // import
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // TP yang diukur
  const [editingTp, setEditingTp] = useState(false);
  const [curriculum, setCurriculum] = useState<CurriculumOutcome[]>([]);
  const [tpSelection, setTpSelection] = useState<string[]>([]);
  const [tpLoading, setTpLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const a = await api().assessments.get(id);
      setAssessment(a);
      const [st, sc, cl, sb] = await Promise.all([
        api().students.list({ classId: a.classId, limit: 100 }),
        api().scores.list(id),
        api().classes.list({ limit: 100 }),
        api().subjects.list({ limit: 100 }),
      ]);
      setStudents(st.data);
      setClasses(cl.data);
      setSubjects(sb.data);
      const map: Record<string, AssessmentScore> = {};
      const e: Record<string, string> = {};
      for (const s of sc) {
        map[s.studentId] = s;
        e[s.studentId] = String(s.score);
      }
      setScores(map);
      setEdits(e);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  function setEdit(studentId: string, v: string) {
    setEdits({ ...edits, [studentId]: v });
  }

  function validateAll(): { ok: boolean; payload: { studentId: string; score: number }[]; bad: string[] } {
    const max = assessment?.maxScore ?? 0;
    const payload: { studentId: string; score: number }[] = [];
    const bad: string[] = [];
    for (const s of students) {
      const raw = (edits[s.id] ?? "").trim();
      if (raw === "") continue; // kosong = tidak diubah / tidak diisi
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > max) {
        bad.push(s.id);
      } else {
        payload.push({ studentId: s.id, score: n });
      }
    }
    return { ok: bad.length === 0, payload, bad };
  }

  async function onSave() {
    setError(""); setSuccess("");
    const { ok, payload, bad } = validateAll();
    if (!ok) {
      setError(`Ada ${bad.length} nilai tidak valid. Nilai harus angka 0–${assessment?.maxScore}.`);
      return;
    }
    if (payload.length === 0) { setError("Tidak ada nilai yang diisi."); return; }
    if (!confirm(`Simpan ${payload.length} nilai?`)) return;
    setSaving(true);
    try {
      await api().scores.replace(id, { scores: payload });
      setSuccess(`${payload.length} nilai berhasil disimpan.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteScore(s: Student) {
    if (!confirm(`Hapus nilai ${s.fullName}?`)) return;
    setError(""); setSuccess("");
    setSaving(true);
    try {
      await api().scores.remove(id, s.id);
      setSuccess(`Nilai ${s.fullName} dihapus.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onPreviewImport() {
    if (!file) { setError("Pilih file CSV/XLSX dulu."); return; }
    setImportBusy(true);
    setError(""); setSuccess(""); setPreview(null);
    try {
      const p = await api().scoreImport.preview(id, file);
      setPreview(p);
      if (!p.valid) setError("File tidak valid — perbaiki baris yang bermasalah sebelum commit.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setImportBusy(false);
    }
  }

  async function onCommitImport() {
    if (!preview) return;
    if (!confirm(`Commit ${preview.validRows} baris nilai dari file?`)) return;
    setImportBusy(true);
    setError(""); setSuccess("");
    try {
      const r = await api().scoreImport.commit(id, preview.importId);
      setSuccess(`${r.importedRows} nilai berhasil diimpor.`);
      setPreview(null);
      setFile(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setImportBusy(false);
    }
  }

  async function startEditTp() {
    if (!assessment) return;
    setError(""); setTpLoading(true);
    try {
      const list = await api().curriculum.listSubjectCurriculum(assessment.subjectId);
      setCurriculum(list);
      setTpSelection((assessment.tps ?? []).map((t) => t.id));
      setEditingTp(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setTpLoading(false);
    }
  }

  function toggleTpSelection(tpId: string) {
    setTpSelection((prev) => (prev.includes(tpId) ? prev.filter((t) => t !== tpId) : [...prev, tpId]));
  }

  async function onSaveTp() {
    setError(""); setSuccess("");
    setSaving(true);
    try {
      await api().assessments.setTps(id, { tpIds: tpSelection });
      setEditingTp(false);
      setSuccess("TP yang diukur berhasil diperbarui.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <Spinner />;

  const { bad } = validateAll();
  const className = classes.find((c) => c.id === assessment?.classId)?.name ?? "—";
  const subjectName = subjects.find((s) => s.id === assessment?.subjectId)?.name ?? "—";

  return (
    <>
      <PageHeader
        title={assessment?.title ?? "Assessment"}
        subtitle={assessment ? `Kelas ${className} · ${subjectName} · Skor maks ${assessment.maxScore} · ${formatDate(assessment.assessmentDate)}` : undefined}
        actions={assessment ? <Badge status={assessment.status} /> : undefined}
      />
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>

      <Card
        title="TP yang diukur"
        actions={editingTp ? (
          <div className="btn-row" style={{ marginTop: 0 }}>
            <Button small variant="secondary" onClick={() => setEditingTp(false)} disabled={saving}>Batal</Button>
            <Button small onClick={() => void onSaveTp()} disabled={saving || tpLoading}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        ) : (
          <Button small variant="secondary" onClick={() => void startEditTp()}>Ubah</Button>
        )}
      >
        {editingTp ? (
          tpLoading ? <Spinner /> : curriculum.length === 0 ? (
            <p className="muted small">Mapel ini belum punya TP. Tambahkan dulu di halaman detail mapel.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {curriculum.map((cp) => {
                const active = (cp.tps ?? []).filter((t) => t.isActive);
                if (active.length === 0) return null;
                return (
                  <div key={cp.id}>
                    <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>{cp.code}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {active.map((tp) => (
                        <label
                          key={tp.id}
                          title={tp.description}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            border: tpSelection.includes(tp.id) ? "2px solid #5b2d8e" : "1.5px solid #d9cdf3",
                            background: tpSelection.includes(tp.id) ? "#efe7fb" : "#fff",
                            borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer",
                          }}
                        >
                          <input type="checkbox" checked={tpSelection.includes(tp.id)} onChange={() => toggleTpSelection(tp.id)} />
                          <b>{tp.code}</b>
                          <span className="muted small">{tp.description.length > 50 ? `${tp.description.slice(0, 50)}…` : tp.description}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (assessment?.tps?.length ?? 0) === 0 ? (
          <EmptyState text="Belum ada TP terkait. Penilaian ini tetap masuk hitungan nilai akhir." />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(assessment?.tps ?? []).map((tp) => (
              <span key={tp.id} className="badge blue" title={tp.description} style={{ fontSize: 13, padding: "6px 12px" }}>
                <b>{tp.code}</b>&nbsp;· {tp.description.length > 60 ? `${tp.description.slice(0, 60)}…` : tp.description}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Input nilai (bulk)"
        actions={<Button onClick={() => void onSave()} disabled={saving}>{saving ? "Menyimpan..." : "Simpan nilai"}</Button>}
      >
        {students.length === 0 ? <EmptyState text="Tidak ada siswa di kelas ini." /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th className="hide-mobile" style={{ width: 40 }}>No</th><th>Nama</th><th style={{ width: 130 }}>Nilai</th><th style={{ width: 110 }}>Normalisasi</th><th style={{ width: 70 }}></th></tr></thead>
              <tbody>
                {students.map((s, i) => {
                  const invalid = bad.includes(s.id);
                  const existing = scores[s.id];
                  return (
                    <tr key={s.id}>
                      <td className="hide-mobile">{i + 1}</td>
                      <td>{s.fullName}</td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={`score-input${invalid ? " invalid" : ""}`}
                          value={edits[s.id] ?? ""}
                          onChange={(e) => setEdit(s.id, e.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td className="muted small">
                        {existing ? `${existing.normalizedScore}` : "—"}
                      </td>
                      <td>
                        {existing && (
                          <Button small variant="danger" onClick={() => void onDeleteScore(s)} disabled={saving}>Hapus</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted mt">
          Kosongkan bila siswa belum dinilai. Nilai tersimpan bersifat transaksional: bila satu baris invalid, tidak ada yang tersimpan.
        </p>
      </Card>

      <Card title="Import CSV/XLSX">
        <p className="small muted">Dua tahap: upload → preview → commit. File maksimal 10 MB.</p>
        <div className="toolbar">
          <Field label="File">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Button variant="secondary" onClick={() => void onPreviewImport()} disabled={importBusy || !file}>
            {importBusy ? "Memproses..." : "Upload & preview"}
          </Button>
        </div>

        {preview && (
          <>
            <div className="btn-row" style={{ marginBottom: 12 }}>
              <span className="badge blue">Total {preview.totalRows}</span>
              <span className="badge green">Valid {preview.validRows}</span>
              <span className="badge red">Invalid {preview.invalidRows}</span>
            </div>
            {preview.errors.length > 0 && (
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Baris</th><th>Kode</th><th>Pesan</th></tr></thead>
                  <tbody>
                    {preview.errors.map((e, i) => (
                      <tr key={i}><td>{e.row}</td><td className="small">{e.code}</td><td>{e.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="btn-row">
              <Button variant="success" onClick={() => void onCommitImport()} disabled={importBusy || !preview.valid}>
                {importBusy ? "Memproses..." : `Commit ${preview.validRows} baris`}
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
