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
