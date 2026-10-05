/**
 * Printable HTML template for the report card PDF.
 * Rendered server-side from the immutable report snapshot — never from
 * live assessment data (BR-006).
 */

import { predicateForScore } from "../grading/description-generator";

export interface PdfSubjectRow {
  subjectName: string;
  finalScore: number;
  kktpThreshold: number | null;
  achievement: string;
  description: string | null;
}

export interface PdfExtracurricularRow {
  name: string;
  predicate: string;
  description: string | null;
}

export interface PdfReportData {
  schoolName: string;
  schoolAddress?: string | null;
  studentName: string;
  nis: string | null;
  nisn: string | null;
  className: string;
  gradeLevel: number;
  semesterName: string;
  academicYearName: string;
  version: number;
  status: string;
  publishedAt: string | null;
  subjects: PdfSubjectRow[];
  cocurricularDescription?: string | null;
  homeroomNotes?: string | null;
  sickDays?: number;
  permissionDays?: number;
  unexcusedDays?: number;
  extracurriculars?: PdfExtracurricularRow[];
  homeroomTeacherName?: string | null;
  headmasterName?: string | null;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function predicate(score: number, kktpThreshold: number | null): string {
  return predicateForScore(score, kktpThreshold);
}

function achievementLabel(a: string): string {
  switch (a) {
    case "ACHIEVED":
      return "Tercapai";
    case "NOT_ACHIEVED":
      return "Belum tercapai";
    default:
      return "Belum dinilai";
  }
}

export function renderReportHtml(d: PdfReportData): string {
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  const rows = d.subjects
    .map(
      (s, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${esc(s.subjectName)}</td>
        <td class="center">${s.kktpThreshold ?? "-"}</td>
        <td class="center">${s.finalScore}</td>
        <td class="center">${predicate(s.finalScore, s.kktpThreshold)}</td>
        <td class="center">${esc(achievementLabel(s.achievement))}</td>
      </tr>
      <tr>
        <td></td>
        <td colspan="5" class="desc">${esc(s.description)}</td>
      </tr>`,
    )
    .join("");

  const avg =
    d.subjects.length > 0
      ? Math.round(d.subjects.reduce((a, s) => a + s.finalScore, 0) / d.subjects.length)
      : 0;

  const cocurricular =
    d.cocurricularDescription && d.cocurricularDescription.trim()
      ? `
  <h3>Kokurikuler</h3>
  <p class="para">${esc(d.cocurricularDescription)}</p>`
      : "";

  const ekskulRows = (d.extracurriculars ?? [])
    .map(
      (e, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${esc(e.name)}</td>
        <td class="center">${esc(e.predicate)}</td>
        <td>${esc(e.description ?? "-")}</td>
      </tr>`,
    )
    .join("");
  const ekskul =
    ekskulRows.length > 0
      ? `
  <h3>Ekstrakurikuler</h3>
  <table class="grades">
    <thead><tr><th style="width:32px">No</th><th>Kegiatan</th><th style="width:70px">Predikat</th><th>Deskripsi</th></tr></thead>
    <tbody>${ekskulRows}</tbody>
  </table>`
      : "";

  const day = (n: number | undefined) => (n === undefined || n === null ? "-" : n === 0 ? "-" : String(n));
  const attendance = `
  <h3>Ketidakhadiran</h3>
  <table class="info">
    <tr><td>Sakit</td><td>: ${day(d.sickDays)} hari</td></tr>
    <tr><td>Izin</td><td>: ${day(d.permissionDays)} hari</td></tr>
    <tr><td>Tanpa keterangan</td><td>: ${day(d.unexcusedDays)} hari</td></tr>
  </table>`;

  const notes =
    d.homeroomNotes && d.homeroomNotes.trim()
      ? `
  <h3>Catatan Wali Kelas</h3>
  <p class="para">${esc(d.homeroomNotes)}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8">
<style>
  body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 12px; color: #111; margin: 32px; }
  h1 { font-size: 18px; text-align: center; margin: 0; }
  h2 { font-size: 14px; text-align: center; margin: 4px 0 16px; font-weight: normal; }
  h3 { font-size: 13px; margin: 18px 0 6px; border-bottom: 1px solid #999; padding-bottom: 2px; }
  .para { text-align: justify; }
  .school { text-align: center; margin-bottom: 16px; }
  .school .name { font-size: 16px; font-weight: bold; }
  table.info { margin-bottom: 12px; }
  table.info td { padding: 2px 8px 2px 0; vertical-align: top; }
  table.grades { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.grades th, table.grades td { border: 1px solid #333; padding: 6px 8px; }
  table.grades th { background: #eee; }
  .center { text-align: center; }
  .desc { font-style: italic; color: #333; }
  .sign { display: flex; justify-content: space-between; margin-top: 40px; }
  .sign div { text-align: center; width: 220px; }
  .footer { margin-top: 24px; font-size: 10px; color: #555; text-align: center; }
</style></head>
<body>
  <div class="school">
    <div class="name">${esc(d.schoolName)}</div>
    <div>${esc(d.schoolAddress)}</div>
  </div>
  <h1>LAPORAN HASIL BELAJAR PESERTA DIDIK</h1>
  <h2>Semester ${esc(d.semesterName)} &mdash; Tahun Ajaran ${esc(d.academicYearName)}</h2>

  <table class="info">
    <tr><td>Nama Peserta Didik</td><td>: <b>${esc(d.studentName)}</b></td><td>Kelas</td><td>: <b>${esc(d.className)}</b></td></tr>
    <tr><td>NIS / NISN</td><td>: ${esc(d.nis)} / ${esc(d.nisn)}</td><td>Semester</td><td>: ${esc(d.semesterName)}</td></tr>
  </table>

  <table class="grades">
    <thead><tr>
      <th style="width:32px">No</th><th>Mata Pelajaran</th><th>KKTP</th>
      <th>Nilai</th><th>Predikat</th><th>Capaian</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p><b>Rata-rata nilai: ${avg}</b></p>
${cocurricular}${ekskul}${attendance}${notes}

  <div class="sign">
    <div>Mengetahui,<br>Kepala Sekolah<br><br><br><br><br><u>${esc(d.headmasterName ?? "( .................................... )")}</u></div>
    <div>${esc(today)}<br>Wali Kelas<br><br><br><br><br><u>${esc(d.homeroomTeacherName ?? "( .................................... )")}</u></div>
  </div>
  <div class="footer">Dokumen ini dicetak dari sistem eRapor SD &mdash; versi rapor ${d.version} (${esc(d.status)})</div>
</body></html>`;
}
