/**
 * Printable HTML template for the report card PDF.
 * Follows the official "LAPORAN HASIL BELAJAR" layout.
 * Rendered server-side from the report snapshot + current school/student
 * data — never recomputed from live assessment data (BR-006).
 */

export interface PdfSubjectRow {
  code: string;
  subjectName: string;
  finalScore: number | null;
  description: string | null;
}

export interface PdfExtracurricularRow {
  name: string;
  description: string | null;
}

export interface PdfReportData {
  schoolName: string;
  schoolAddress?: string | null;
  schoolCity?: string | null;
  studentName: string;
  nis: string | null;
  nisn: string | null;
  className: string;
  gradeLevel: number;
  semesterName: string;
  semesterNumber: number | null;
  academicYearName: string;
  reportDate: string | null;
  subjects: PdfSubjectRow[];
  cocurricularDescription?: string | null;
  homeroomNotes?: string | null;
  sickDays?: number | null;
  permissionDays?: number | null;
  unexcusedDays?: number | null;
  extracurriculars?: PdfExtracurricularRow[];
  homeroomTeacherName?: string | null;
  homeroomTeacherNbm?: string | null;
  headmasterName?: string | null;
  headmasterNip?: string | null;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fase kurikulum merdeka dari tingkat kelas: A=1-2, B=3-4, C=5-6. */
function faseForGrade(level: number): string {
  if (level <= 2) return "A";
  if (level <= 4) return "B";
  return "C";
}

/**
 * Urutan mapel resmi pada rapor + pengelompokan Muatan Lokal / Muatan Khusus.
 * Mapel yang tidak dikenal ditampilkan setelahnya tanpa nomor kelompok.
 */
const SUBJECT_ORDER: Array<{ code: string; label: string; group?: string; sub?: string }> = [
  { code: "PAI", label: "Pendidikan Agama Islam dan Budi Pekerti" },
  { code: "PPKN", label: "Pendidikan Pancasila" },
  { code: "BIND", label: "Bahasa Indonesia" },
  { code: "MTK", label: "Matematika" },
  { code: "IPAS", label: "Ilmu Pengetahuan Alam dan Sosial" },
  { code: "PJOK", label: "Pendidikan Jasmani, Olah Raga dan Kesehatan" },
  { code: "SNI", label: "Seni" },
  { code: "BING", label: "Bahasa Inggris" },
  { code: "BJAW", label: "Bahasa Jawa", group: "Muatan Lokal", sub: "a" },
  { code: "SBTK", label: "Seni Batik", group: "Muatan Lokal", sub: "b" },
  { code: "PKM", label: "Pendidikan Kemuhammadiyahan", group: "Muatan Khusus", sub: "a" },
  { code: "BARB", label: "Bahasa Arab", group: "Muatan Khusus", sub: "b" },
  { code: "INF", label: "Coding - Informatika", group: "Muatan Khusus", sub: "c" },
];

export function renderReportHtml(d: PdfReportData): string {
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const place = d.schoolCity?.trim() ? `${d.schoolCity.trim()}, ` : "";
  const dateLine = `${place}${d.reportDate ?? today}`;

  const byCode = new Map(d.subjects.map((s) => [s.code, s]));
  const known = new Set(SUBJECT_ORDER.map((o) => o.code));
  const extra = d.subjects.filter((s) => !known.has(s.code));

  let n = 0;
  let lastGroup: string | null = null;
  const rows: string[] = [];
  const pushRow = (no: string, name: string, s: PdfSubjectRow | undefined) => {
    const score = s?.finalScore;
    rows.push(`<tr>
      <td class="center">${esc(no)}</td>
      <td>${esc(name)}</td>
      <td class="center">${score === null || score === undefined ? "-" : score}</td>
      <td class="desc">${score === null || score === undefined ? "-" : esc(s?.description ?? "-")}</td>
    </tr>`);
  };

  for (const o of SUBJECT_ORDER) {
    const s = byCode.get(o.code);
    const name = s?.subjectName ?? o.label;
    if (o.group && o.group !== lastGroup) {
      n += 1;
      rows.push(`<tr><td class="center">${n}</td><td colspan="3"><b>${esc(o.group)}</b></td></tr>`);
      lastGroup = o.group;
    } else if (!o.group) {
      lastGroup = null;
      n += 1;
      pushRow(String(n), name, s);
      continue;
    }
    pushRow("", `${o.sub}. ${name}`, s);
  }
  for (const s of extra) {
    n += 1;
    pushRow(String(n), s.subjectName, s);
  }

  const cocurricular =
    d.cocurricularDescription && d.cocurricularDescription.trim()
      ? `<h3>KOKURIKULER</h3><p class="para">${esc(d.cocurricularDescription)}</p>`
      : "";

  const ekskulRows = (d.extracurriculars ?? [])
    .map(
      (e, i) => `<tr><td class="center">${i + 1}</td><td>${esc(e.name)}</td><td>${esc(e.description ?? "-")}</td></tr>`,
    )
    .join("");
  const ekskul = `<h3>EKSTRAKURIKULER</h3>
  <table class="grades">
    <thead><tr><th style="width:32px">No</th><th>Ekstrakurikuler</th><th>Keterangan</th></tr></thead>
    <tbody>${ekskulRows || `<tr><td class="center">-</td><td>-</td><td>-</td></tr>`}</tbody>
  </table>`;

  const day = (v: number | null | undefined) =>
    v === null || v === undefined || v === 0 ? "-" : String(v);

  const fmtNum = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "");

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8">
<style>
  body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 11.5px; color: #111; margin: 28px 32px; }
  h1 { font-size: 17px; text-align: center; margin: 0 0 14px; letter-spacing: 1px; }
  h3 { font-size: 12px; margin: 16px 0 6px; }
  .para { text-align: justify; margin: 4px 0; }
  table.identity { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.identity td { padding: 2px 6px 2px 0; vertical-align: top; }
  table.grades { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.grades th, table.grades td { border: 1px solid #333; padding: 5px 7px; vertical-align: top; }
  table.grades th { background: #eee; font-size: 11px; }
  .center { text-align: center; }
  .desc { text-align: justify; font-size: 11px; }
  .sign { display: flex; justify-content: space-between; margin-top: 36px; page-break-inside: avoid; }
  .sign div { text-align: center; width: 32%; font-size: 11px; }
  .sign .name { font-weight: bold; text-decoration: underline; }
  .footer { margin-top: 20px; font-size: 10px; color: #555; text-align: left; font-style: italic; }
</style></head>
<body>
  <h1>LAPORAN HASIL BELAJAR</h1>

  <table class="identity">
    <tr>
      <td style="width:17%">Nama</td><td style="width:33%">: <b>${esc(d.studentName)}</b></td>
      <td style="width:17%">Kelas</td><td>: <b>${esc(d.className)}</b></td>
    </tr>
    <tr>
      <td>NIS / NISN</td><td>: ${esc(fmtNum(d.nis))} / ${esc(fmtNum(d.nisn))}</td>
      <td>Fase</td><td>: ${esc(faseForGrade(d.gradeLevel))}</td>
    </tr>
    <tr>
      <td>Nama Sekolah</td><td>: ${esc(d.schoolName)}</td>
      <td>Semester</td><td>: ${d.semesterNumber ?? esc(d.semesterName)}</td>
    </tr>
    <tr>
      <td>Alamat</td><td>: ${esc(d.schoolAddress)}</td>
      <td>Tahun Ajaran</td><td>: ${esc(d.academicYearName)}</td>
    </tr>
  </table>

  <table class="grades">
    <thead><tr>
      <th style="width:30px">No</th><th>Mata Pelajaran</th>
      <th style="width:70px">Nilai Akhir</th><th>Capaian Kompetensi</th>
    </tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>
${cocurricular}
${ekskul}
  <h3>CATATAN WALI KELAS</h3>
  <p class="para">${esc(d.homeroomNotes?.trim() ? d.homeroomNotes : "-")}</p>

  <h3>KETIDAKHADIRAN</h3>
  <table class="identity" style="width:60%">
    <tr><td>Sakit</td><td>: ${day(d.sickDays)} hari</td></tr>
    <tr><td>Izin</td><td>: ${day(d.permissionDays)} hari</td></tr>
    <tr><td>Tanpa Keterangan</td><td>: ${day(d.unexcusedDays)} hari</td></tr>
  </table>

  <div class="sign">
    <div>Mengetahui,<br>Orang Tua / Wali Siswa<br><br><br><br><br>( .................................... )</div>
    <div>${esc(dateLine)}<br>Wali Kelas<br><br><br><br><br><span class="name">${esc(d.homeroomTeacherName ?? "( .................................... )")}</span>${d.homeroomTeacherNbm ? `<br>NBM. ${esc(d.homeroomTeacherNbm)}` : ""}</div>
    <div>Mengetahui,<br>Kepala Sekolah<br><br><br><br><br><span class="name">${esc(d.headmasterName ?? "( .................................... )")}</span>${d.headmasterNip ? `<br>NBM. ${esc(d.headmasterNip)}` : ""}</div>
  </div>
  <div class="footer">*Rapor Semester ${d.semesterNumber ?? ""}*</div>
</body></html>`;
}
