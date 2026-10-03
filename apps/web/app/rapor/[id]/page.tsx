"use client";

import { use, useEffect, useState } from "react";
import type { ReportCardDetail, Student } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDateTime, formatNumber } from "@/lib/format";
import { useAuth, useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner } from "@/components/ui";

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

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api().reports.get(id);
      setReport(r);
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

  useEffect(() => { void load(); }, [id]);

  async function act(label: string, fn: () => Promise<ReportCardDetail>) {
    if (!confirm(`${label}?`)) return;
    setBusy(true);
    setError(""); setSuccess("");
    try {
      const r = await fn();
      setReport(r);
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
      setReport(r);
      setSuccess(`Revisi dibuat (versi ${r.version}).`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) return <Spinner />;

  const isSuper = user?.role === "SUPERADMIN";
  const status = report?.status;

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
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Mapel</th><th>Nilai akhir</th><th>KKTP</th><th>Status</th><th>Deskripsi</th></tr></thead>
                <tbody>
                  {report.subjects.map((s) => (
                    <tr key={s.id}>
                      <td>{s.subjectName}</td>
                      <td><strong>{formatNumber(s.finalScore, 0)}</strong></td>
                      <td>{s.kktpThreshold ?? "—"}</td>
                      <td><Badge status={s.achievement} /></td>
                      <td className="small">{s.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="kv mt">
              <dt>Dibuat</dt><dd>{formatDateTime(report.generatedAt)}</dd>
              <dt>Direview</dt><dd>{formatDateTime(report.reviewedAt)}</dd>
              <dt>Dikunci</dt><dd>{formatDateTime(report.lockedAt)}</dd>
              <dt>Diterbitkan</dt><dd>{formatDateTime(report.publishedAt)}</dd>
            </dl>
          </Card>

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
    </>
  );
}
