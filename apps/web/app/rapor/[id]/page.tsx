"use client";

import { use, useEffect, useState } from "react";
import type { ExtracurricularEntry, ReportCardDetail, ReportCardSubject, Student, UpdateCompletenessInput } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDateTime, formatNumber } from "@/lib/format";
import { useAuth, useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner } from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";

const EDITABLE_STATUSES = ["DRAFT", "REVIEW", "REVISION"];

const KOKURIKULER_TEMPLATE =
  "Ananda sudah baik dalam keimanan dan ketaqwaan terhadap Tuhan yang Maha Esa yang terlihat dari cara berdoa dan beribadah. " +
  "Ananda sudah baik dalam kreativitas yang terlihat dari kemampuan mengembangkan keterampilannya dalam membuat karya. " +
  "Ananda sudah baik dalam berkolaborasi yang terlihat dari kemampuan bekerjasama dengan sesama teman. " +
  "Ananda sudah baik dalam komunikasi yang terlihat saat menyampaikan pendapat di kelas dengan percaya diri dan berbicara dengan sopan.";

/* ---------- tampilan read-only kelengkapan rapor ---------- */
function CompletenessView({ report }: { report: ReportCardDetail }) {
  return (
    <>
      <h4>Kokurikuler</h4>
      <p className="small">{report.cocurricularDescription || "—"}</p>
      <h4 className="mt">Ekstrakurikuler</h4>
      {report.extracurriculars.length === 0 ? (
        <p className="small muted">—</p>
      ) : (
        <ul>
          {report.extracurriculars.map((e) => (
            <li key={e.id}>
              <strong>{e.name}</strong> <Badge label={e.predicate} />
              {e.description && <span className="small"> — {e.description}</span>}
            </li>
          ))}
        </ul>
      )}
      <h4 className="mt">Ketidakhadiran</h4>
      <dl className="kv">
        <dt>Sakit</dt><dd>{report.sickDays} hari</dd>
        <dt>Izin</dt><dd>{report.permissionDays} hari</dd>
        <dt>Tanpa keterangan</dt><dd>{report.unexcusedDays} hari</dd>
      </dl>
      <h4 className="mt">Catatan wali kelas</h4>
      <p className="small">{report.homeroomNotes || "—"}</p>
    </>
  );
}

function hasCompletenessData(r: ReportCardDetail): boolean {
  return (
    !!r.cocurricularDescription ||
    !!r.homeroomNotes ||
    r.sickDays > 0 ||
    r.permissionDays > 0 ||
    r.unexcusedDays > 0 ||
    r.extracurriculars.length > 0
  );
}

export default function RaporDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN", "TEACHER", "PARENT"]);
  const { user } = useAuth();
  const [report, setReport] = useState<ReportCardDetail | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [reason, setReason] = useState("");

  /* ---- form kelengkapan rapor ---- */
  const [kokur, setKokur] = useState("");
  const [notes, setNotes] = useState("");
  const [sick, setSick] = useState("0");
  const [permission, setPermission] = useState("0");
  const [unexcused, setUnexcused] = useState("0");

  /* ---- modal deskripsi mapel ---- */
  const [descSubject, setDescSubject] = useState<ReportCardSubject | null>(null);
  const [descText, setDescText] = useState("");

  /* ---- modal ekstrakurikuler ---- */
  const [ekskulModal, setEkskulModal] = useState(false);
  const [ekskulEditing, setEkskulEditing] = useState<ExtracurricularEntry | null>(null);
  const [ekskulName, setEkskulName] = useState("");
  const [ekskulPredicate, setEkskulPredicate] = useState<"A" | "B" | "C" | "D">("A");
  const [ekskulDesc, setEkskulDesc] = useState("");

  function applyReport(r: ReportCardDetail) {
    setReport(r);
    setKokur(r.cocurricularDescription ?? "");
    setNotes(r.homeroomNotes ?? "");
    setSick(String(r.sickDays ?? 0));
    setPermission(String(r.permissionDays ?? 0));
    setUnexcused(String(r.unexcusedDays ?? 0));
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api().reports.get(id);
      applyReport(r);
      try {
        setStudent(await api().students.get(r.studentId));
      } catch {
        /* parent mungkin tidak boleh akses detail siswa — abaikan */
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  /** Muat ulang data rapor tanpa spinner penuh (setelah simpan). */
  async function refresh() {
    try {
      applyReport(await api().reports.get(id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function act(label: string, fn: () => Promise<ReportCardDetail>) {
    if (!confirm(`${label}?`)) return;
    setBusy(true);
    setError(""); setSuccess("");
    try {
      const r = await fn();
      applyReport(r);
      setSuccess(`Berhasil: ${label.toLowerCase()}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError("Alasan revisi wajib diisi."); return; }
    setBusy(true);
    setError(""); setSuccess("");
    try {
      const r = await api().reports.revision(id, reason.trim());
      setShowRevision(false);
      setReason("");
      applyReport(r);
      setSuccess(`Revisi dibuat (versi ${r.version}).`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveCompleteness(data: UpdateCompletenessInput, label: string) {
    setBusy(true);
    setError(""); setSuccess("");
    try {
      await api().reports.updateCompleteness(id, data);
      await refresh();
      setSuccess(`Berhasil: ${label}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function parseDays(value: string): number | null {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return null;
    return n;
  }

  async function onSaveAttendance() {
    const s = parseDays(sick);
    const p = parseDays(permission);
    const u = parseDays(unexcused);
    if (s === null || p === null || u === null) {
      setError("Jumlah hari harus berupa angka bulat 0 atau lebih.");
      return;
    }
    await saveCompleteness({ sickDays: s, permissionDays: p, unexcusedDays: u }, "ketidakhadiran disimpan");
  }

  function openDescModal(s: ReportCardSubject) {
    setDescSubject(s);
    setDescText(s.description ?? "");
  }

  async function onSaveDescription(e: React.FormEvent) {
    e.preventDefault();
    if (!descSubject) return;
    const text = descText.trim();
    if (!text) { setError("Deskripsi tidak boleh kosong."); return; }
    setBusy(true);
    setError(""); setSuccess("");
    try {
      await api().reports.updateSubjectDescription(id, descSubject.subjectId, { description: text });
      setDescSubject(null);
      setDescText("");
      await refresh();
      setSuccess("Berhasil: deskripsi mapel diperbarui.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onResetDescription() {
    if (!descSubject) return;
    if (!confirm("Kembalikan deskripsi ke hasil otomatis? Perubahan manual akan hilang.")) return;
    setBusy(true);
    setError(""); setSuccess("");
    try {
      await api().reports.resetSubjectDescription(id, descSubject.subjectId);
      setDescSubject(null);
      setDescText("");
      await refresh();
      setSuccess("Berhasil: deskripsi dikembalikan ke hasil otomatis.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function openEkskulModal(entry: ExtracurricularEntry | null) {
    setEkskulEditing(entry);
    setEkskulName(entry?.name ?? "");
    setEkskulPredicate((entry?.predicate ?? "A") as "A" | "B" | "C" | "D");
    setEkskulDesc(entry?.description ?? "");
    setEkskulModal(true);
  }

  async function onSaveEkskul(e: React.FormEvent) {
    e.preventDefault();
    const name = ekskulName.trim();
    if (!name) { setError("Nama kegiatan wajib diisi."); return; }
    setBusy(true);
    setError(""); setSuccess("");
    try {
      const payload = { name, predicate: ekskulPredicate, description: ekskulDesc.trim() || null };
      if (ekskulEditing) {
        await api().reports.extracurriculars.update(id, ekskulEditing.id, payload);
      } else {
        await api().reports.extracurriculars.create(id, payload);
      }
      setEkskulModal(false);
      await refresh();
      setSuccess(`Berhasil: kegiatan ekstrakurikuler ${ekskulEditing ? "diperbarui" : "ditambahkan"}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteEkskul(entry: ExtracurricularEntry) {
    if (!confirm(`Hapus kegiatan "${entry.name}"?`)) return;
    setBusy(true);
    setError(""); setSuccess("");
    try {
      await api().reports.extracurriculars.remove(id, entry.id);
      await refresh();
      setSuccess("Berhasil: kegiatan ekstrakurikuler dihapus.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) return <Spinner />;

  const isSuper = user?.role === "SUPERADMIN";
  const isStaff = isSuper || user?.role === "TEACHER";
  const isParent = user?.role === "PARENT";
  const status = report?.status;
  const editable = status ? EDITABLE_STATUSES.includes(status) : false;
  const canEdit = isStaff && editable;

  const columns = [
    { key: "subjectName", label: "Mapel", render: (s: ReportCardSubject) => s.subjectName },
    { key: "finalScore", label: "Nilai akhir", render: (s: ReportCardSubject) => <strong>{formatNumber(s.finalScore, 0)}</strong> },
    { key: "kktpThreshold", label: "KKTP", render: (s: ReportCardSubject) => s.kktpThreshold ?? "—" },
    { key: "achievement", label: "Status", render: (s: ReportCardSubject) => <Badge status={s.achievement} /> },
    { key: "description", label: "Deskripsi", render: (s: ReportCardSubject) => <span className="small">{s.description ?? "—"}</span> },
    {
      key: "source",
      label: "Sumber",
      render: (s: ReportCardSubject) => (
        <Badge status={s.descriptionSource} label={s.descriptionSource === "MANUAL" ? "MANUAL" : "OTOMATIS"} />
      ),
    },
    ...(canEdit
      ? [{
          key: "actions",
          label: "Aksi",
          render: (s: ReportCardSubject) => (
            <Button small variant="secondary" onClick={() => openDescModal(s)}>
              Ubah
            </Button>
          ),
        }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={student ? `Rapor — ${student.fullName}` : "Rapor"}
        subtitle={report ? `Versi ${report.version}` : undefined}
        actions={report ? <Badge status={report.status} /> : undefined}
      />
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>

      {!report ? (
        <Card><p className="muted">Rapor tidak ditemukan atau Anda tidak memiliki akses.</p></Card>
      ) : (
        <>
          <Card title="Nilai per mata pelajaran">
            <ResponsiveTable<ReportCardSubject>
              columns={columns}
              rows={report.subjects}
              rowKey={(s) => s.id}
              title={(s) => s.subjectName}
              subtitle={(s) => `Nilai akhir ${formatNumber(s.finalScore, 0)}`}
            />
            <dl className="kv mt">
              <dt>Dibuat</dt><dd>{formatDateTime(report.generatedAt)}</dd>
              <dt>Direview</dt><dd>{formatDateTime(report.reviewedAt)}</dd>
              <dt>Dikunci</dt><dd>{formatDateTime(report.lockedAt)}</dd>
              <dt>Diterbitkan</dt><dd>{formatDateTime(report.publishedAt)}</dd>
            </dl>
          </Card>

          {/* ---- Kelengkapan rapor (Fase 4) ---- */}
          {isStaff && (
            <Card title="Kelengkapan rapor">
              {canEdit ? (
                <>
                  <Field label="Kokurikuler" hint="Deskripsi capaian kokurikuler siswa semester ini.">
                    <textarea value={kokur} onChange={(e) => setKokur(e.target.value)} rows={4} maxLength={2000} />
                  </Field>
                  <div className="btn-row">
                    <Button small onClick={() => void saveCompleteness({ cocurricularDescription: kokur.trim() || null }, "kokurikuler disimpan")} disabled={busy}>
                      Simpan kokurikuler
                    </Button>
                    <Button small variant="secondary" onClick={() => setKokur(KOKURIKULER_TEMPLATE)} disabled={busy}>
                      Pakai template
                    </Button>
                  </div>

                  <h4 className="mt">Ekstrakurikuler</h4>
                  {report.extracurriculars.length === 0 ? (
                    <p className="small muted">Belum ada kegiatan ekstrakurikuler.</p>
                  ) : (
                    report.extracurriculars.map((e) => (
                      <div key={e.id} className="btn-row" style={{ alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <strong>{e.name}</strong> <Badge label={e.predicate} />
                          {e.description && <div className="small">{e.description}</div>}
                        </div>
                        <Button small variant="secondary" onClick={() => openEkskulModal(e)} disabled={busy}>Ubah</Button>
                        <Button small variant="danger" onClick={() => void onDeleteEkskul(e)} disabled={busy}>Hapus</Button>
                      </div>
                    ))
                  )}
                  <div className="btn-row">
                    <Button small variant="secondary" onClick={() => openEkskulModal(null)} disabled={busy}>
                      + Tambah kegiatan
                    </Button>
                  </div>

                  <h4 className="mt">Ketidakhadiran</h4>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 110 }}>
                      <Field label="Sakit (hari)">
                        <input type="number" min={0} value={sick} onChange={(e) => setSick(e.target.value)} />
                      </Field>
                    </div>
                    <div style={{ flex: 1, minWidth: 110 }}>
                      <Field label="Izin (hari)">
                        <input type="number" min={0} value={permission} onChange={(e) => setPermission(e.target.value)} />
                      </Field>
                    </div>
                    <div style={{ flex: 1, minWidth: 130 }}>
                      <Field label="Tanpa keterangan (hari)">
                        <input type="number" min={0} value={unexcused} onChange={(e) => setUnexcused(e.target.value)} />
                      </Field>
                    </div>
                  </div>
                  <div className="btn-row">
                    <Button small onClick={() => void onSaveAttendance()} disabled={busy}>
                      Simpan ketidakhadiran
                    </Button>
                  </div>

                  <Field label="Catatan wali kelas" hint="Tercetak di rapor di bawah tabel nilai.">
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
                  </Field>
                  <div className="btn-row">
                    <Button small onClick={() => void saveCompleteness({ homeroomNotes: notes.trim() || null }, "catatan wali kelas disimpan")} disabled={busy}>
                      Simpan catatan
                    </Button>
                  </div>
                </>
              ) : (
                <CompletenessView report={report} />
              )}
            </Card>
          )}

          {isParent && hasCompletenessData(report) && (
            <Card title="Kelengkapan rapor">
              <CompletenessView report={report} />
            </Card>
          )}

          <Card title="Alur persetujuan">
            <div className="btn-row" style={{ marginTop: 0 }}>
              {status === "DRAFT" && (
                <Button onClick={() => void act("Kirim ke review", () => api().reports.review(id))} disabled={busy}>
                  Kirim ke Review
                </Button>
              )}
              {status === "REVIEW" && (
                <Button variant="warn" onClick={() => void act("Kunci rapor", () => api().reports.lock(id))} disabled={busy}>
                  Kunci
                </Button>
              )}
              {status === "LOCKED" && isSuper && (
                <Button variant="success" onClick={() => void act("Terbitkan rapor", () => api().reports.publish(id))} disabled={busy}>
                  Terbitkan
                </Button>
              )}
              {status === "LOCKED" && !isSuper && (
                <span className="small muted">Menunggu superadmin untuk menerbitkan.</span>
              )}
              {status === "PUBLISHED" && isSuper && (
                <Button variant="warn" onClick={() => setShowRevision(true)} disabled={busy}>
                  Buat revisi
                </Button>
              )}
              {(status === "PUBLISHED" || status === "LOCKED") && (
                <a className="btn secondary" href={api().reports.pdfUrl(id)} download>
                  Unduh PDF
                </a>
              )}
            </div>
            {!isSuper && user?.role === "TEACHER" && (
              <p className="small muted mt">Tombol Terbitkan hanya tersedia untuk superadmin.</p>
            )}
          </Card>
        </>
      )}

      {showRevision && (
        <Modal title="Buat Revisi Rapor" onClose={() => setShowRevision(false)}>
          <form onSubmit={onRevision}>
            <Alert kind="info">Revisi membuat versi baru. Versi terbit sebelumnya tetap tersimpan dan dapat diaudit.</Alert>
            <Field label="Alasan revisi">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cth: koreksi nilai Matematika" />
            </Field>
            <div className="btn-row">
              <Button type="submit" disabled={busy}>{busy ? "Memproses..." : "Buat revisi"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowRevision(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}

      {descSubject && (
        <Modal title={`Ubah deskripsi — ${descSubject.subjectName}`} onClose={() => setDescSubject(null)}>
          <form onSubmit={onSaveDescription}>
            <Field label="Deskripsi" hint="Maksimal 2000 karakter. Perubahan tercatat di audit log.">
              <textarea
                value={descText}
                onChange={(e) => setDescText(e.target.value)}
                rows={5}
                maxLength={2000}
              />
            </Field>
            <div className="btn-row">
              <Button type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button>
              {descSubject.descriptionSource === "MANUAL" && (
                <Button type="button" variant="warn" onClick={() => void onResetDescription()} disabled={busy}>
                  Kembalikan ke otomatis
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setDescSubject(null)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}

      {ekskulModal && (
        <Modal title={ekskulEditing ? `Ubah kegiatan — ${ekskulEditing.name}` : "Tambah kegiatan ekstrakurikuler"} onClose={() => setEkskulModal(false)}>
          <form onSubmit={onSaveEkskul}>
            <Field label="Nama kegiatan">
              <input value={ekskulName} onChange={(e) => setEkskulName(e.target.value)} placeholder="Cth: Pramuka" maxLength={100} />
            </Field>
            <Field label="Predikat">
              <select value={ekskulPredicate} onChange={(e) => setEkskulPredicate(e.target.value as "A" | "B" | "C" | "D")}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </Field>
            <Field label="Deskripsi capaian">
              <textarea value={ekskulDesc} onChange={(e) => setEkskulDesc(e.target.value)} rows={3} maxLength={1000} placeholder="Cth: Siswa aktif mengikuti kegiatan dan menunjukkan kedisiplinan." />
            </Field>
            <div className="btn-row">
              <Button type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={() => setEkskulModal(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
