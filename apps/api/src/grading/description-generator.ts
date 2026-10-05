import Decimal from "decimal.js";
import { roundForDisplay } from "./grading-engine";
import type { AchievementStatus } from "./grading-engine";

export interface SubjectDescriptionInput {
  studentName: string;
  subjectName: string;
  finalScore: Decimal.Value;
  achievement: AchievementStatus;
  kktpThreshold?: Decimal.Value | null;
}

/**
 * Generates a draft report description (Epic 14 — US-130) in Indonesian.
 * Pure and deterministic: same input always yields the same text.
 * Teachers/homeroom teachers refine the draft; the final text is stored
 * as a snapshot on the report card.
 */
export function generateSubjectDescription(input: SubjectDescriptionInput): string {
  const score = new Decimal(input.finalScore);
  const display = roundForDisplay(score);
  const predicate = predicateFor(score);

  const threshold =
    input.kktpThreshold === undefined || input.kktpThreshold === null
      ? null
      : new Decimal(input.kktpThreshold);

  let kktpSentence: string;
  if (threshold === null) {
    kktpSentence = "Capaian pembelajaran terdokumentasi pada rapor ini.";
  } else if (input.achievement === "ACHIEVED") {
    kktpSentence = `Capaian pembelajaran telah memenuhi KKTP (${threshold.toString()}).`;
  } else {
    kktpSentence = `Capaian pembelajaran belum memenuhi KKTP (${threshold.toString()}) dan perlu ditingkatkan.`;
  }

  return (
    `Ananda ${input.studentName} menunjukkan hasil ${predicate} pada mata pelajaran ` +
    `${input.subjectName} dengan nilai akhir ${display}. ${kktpSentence}`
  );
}

function predicateFor(score: Decimal): string {
  if (score.gte(90)) return "sangat baik";
  if (score.gte(80)) return "baik";
  if (score.gte(70)) return "cukup";
  return "perlu bimbingan";
}

// ---------------------------------------------------------------------------
// Deskripsi per TP (3 lapis, meniru file Excel nilai aktif).
// Ambang predikat diturunkan dari KKTP: rentang (100 - KKTP) dibagi tiga
// sama besar. Contoh KKTP 73 -> A >= 91, B 82-90, C 73-81, D < 73.
// ---------------------------------------------------------------------------

export interface TpScoreInput {
  code: string;
  description: string;
  /** Nilai TP ternormalisasi 0-100 (belum dibulatkan). */
  score: Decimal.Value;
}

export interface TpDescriptionInput {
  studentName: string;
  tpScores: TpScoreInput[];
  kktpThreshold: Decimal.Value;
}

/**
 * Ambang bawah tiap predikat (A/B/C) yang diturunkan dari KKTP,
 * meniru logika file Excel: rentang di atas KKTP dibagi 3.
 * KKTP 73 -> { aMin: 91, bMin: 82, cMin: 73 }.
 */
export function predicateBands(kktpThreshold: Decimal.Value): {
  aMin: number;
  bMin: number;
  cMin: number;
} {
  const k = new Decimal(kktpThreshold);
  const third = new Decimal(100).minus(k).div(3);
  return {
    aMin: Math.round(k.plus(third.times(2)).toNumber()),
    bMin: Math.round(k.plus(third).toNumber()),
    cMin: Math.round(k.toNumber()),
  };
}

/** Predikat huruf A/B/C/D dengan ambang dinamis dari KKTP (null -> ambang fixed lama). */
export function predicateForScore(score: number, kktpThreshold: number | null): "A" | "B" | "C" | "D" {
  if (kktpThreshold !== null) {
    const { aMin, bMin, cMin } = predicateBands(kktpThreshold);
    if (score >= aMin) return "A";
    if (score >= bMin) return "B";
    if (score >= cMin) return "C";
    return "D";
  }
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "D";
}

type TpTier = "MASTERED" | "SILENT" | "GUIDED" | "ASSISTED";

/**
 * Menghasilkan deskripsi rapor per TP dengan tiga lapis kalimat, meniru Excel:
 * - nilai TP (dibulatkan) > aMin        -> "Menunjukkan penguasaan dalam ..."
 * - bMin s.d. aMin                      -> tidak disebut (sesuai Excel)
 * - cMin (KKTP) s.d. bMin-1             -> "Dengan bimbingan guru, menunjukkan pemahaman dalam ..."
 * - di bawah KKTP                       -> "Dengan bantuan guru, diharapkan dapat menunjukkan pemahaman dalam ..."
 *
 * TP tanpa nilai tidak ikut dihitung (dipanggil hanya dengan TP bernilai).
 * Mengembalikan null bila tidak ada TP yang masuk lapis yang disebutkan,
 * sehingga pemanggil bisa fallback ke deskripsi generik.
 */
export function generateTpDescription(input: TpDescriptionInput): string | null {
  const { aMin, bMin, cMin } = predicateBands(input.kktpThreshold);

  const mastered: string[] = [];
  const guided: string[] = [];
  const assisted: string[] = [];

  for (const tp of input.tpScores) {
    const rounded = roundForDisplay(new Decimal(tp.score));
    const tier: TpTier =
      rounded > aMin ? "MASTERED" : rounded >= bMin ? "SILENT" : rounded >= cMin ? "GUIDED" : "ASSISTED";
    if (tier === "MASTERED") mastered.push(tp.description.trim());
    else if (tier === "GUIDED") guided.push(tp.description.trim());
    else if (tier === "ASSISTED") assisted.push(tp.description.trim());
  }

  const parts: string[] = [];
  if (mastered.length > 0) {
    parts.push(`menunjukkan penguasaan dalam ${mastered.join("; ")}.`);
  }
  if (guided.length > 0) {
    parts.push(`Dengan bimbingan guru, menunjukkan pemahaman dalam ${guided.join("; ")}.`);
  }
  if (assisted.length > 0) {
    parts.push(`Dengan bantuan guru, diharapkan dapat menunjukkan pemahaman dalam ${assisted.join("; ")}.`);
  }

  if (parts.length === 0) return null;
  const first = parts[0];
  const rest = parts.slice(1);
  // "Ananda X" hanya di awal; kalimat berikutnya diawali huruf kapital.
  const body =
    first.charAt(0).toLowerCase() === first.charAt(0)
      ? `Ananda ${input.studentName} ${first}`
      : `Ananda ${input.studentName} ${first.charAt(0).toLowerCase()}${first.slice(1)}`;
  return rest.length > 0 ? `${body} ${rest.join(" ")}` : body;
}
