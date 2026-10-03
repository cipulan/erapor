import Decimal from "decimal.js";

/**
 * Pure domain grading engine (docs/architecture/grading-engine.md).
 *
 * Deliberately free of HTTP, NestJS, and persistence concerns:
 * - accepts typed domain input,
 * - performs ALL arithmetic with decimal.js (never binary float),
 * - returns a deterministic calculation result.
 *
 * Rules implemented:
 * - normalizedScore = rawScore / maxScore * 100
 * - categoryAverage = AVG of present normalized scores (missing scores are
 *   NOT treated as zero)
 * - finalScore = SUM(categoryAverage * weight / 100)
 * - a weighted category (> 0) without eligible assessments -> INCOMPLETE
 * - a missing required score -> INCOMPLETE (final score not publishable)
 * - KKTP: ACHIEVED when finalScore >= threshold, NOT_ACHIEVED when below,
 *   NOT_ASSESSED when grading is INCOMPLETE or no threshold configured
 * - rounding happens ONLY for display (nearest integer); raw/internal
 *   values are never overwritten
 */

export type GradeStatus = "COMPLETE" | "INCOMPLETE";
export type AchievementStatus = "ACHIEVED" | "NOT_ACHIEVED" | "NOT_ASSESSED";

export type IncompleteReason =
  | "MISSING_SCORE"
  | "NO_ASSESSMENT_FOR_WEIGHTED_CATEGORY"
  | "NO_PUBLISHED_SCHEME";

export interface CategoryWeightInput {
  categoryId: string;
  weight: Decimal.Value;
}

export interface EligibleAssessmentInput {
  id: string;
  categoryId: string;
  maxScore: Decimal.Value;
}

export interface GradeCalculationInput {
  /** Published scheme weights (must total exactly 100 — validated at publish). */
  weights: CategoryWeightInput[];
  /** Eligible assessments only (e.g. PUBLISHED, active category, maxScore > 0). */
  assessments: EligibleAssessmentInput[];
  /** Raw scores keyed by assessment id. Only PRESENT scores go here. */
  scores: Record<string, Decimal.Value>;
  /** KKTP threshold for the subject/semester, when configured. */
  kktpThreshold?: Decimal.Value | null;
}

export interface CategoryAverageResult {
  categoryId: string;
  /** Average of normalized (0-100) scores in this category, full precision. */
  average: Decimal;
  weight: Decimal;
  /** average * weight / 100, full precision. */
  weightedValue: Decimal;
}

export interface GradeCalculationResult {
  status: GradeStatus;
  reason?: IncompleteReason;
  categoryAverages: CategoryAverageResult[];
  /** Full-precision final score (0-100). Present only when COMPLETE. */
  finalScore?: Decimal;
  achievement: AchievementStatus;
  /** Assessment ids with a missing required score. */
  missingAssessments: string[];
}

const ZERO = new Decimal(0);
const ONE_HUNDRED = new Decimal(100);

export function calculateGrade(input: GradeCalculationInput): GradeCalculationResult {
  const missingAssessments: string[] = [];
  const categoryAverages: CategoryAverageResult[] = [];
  let total = new Decimal(0);

  for (const w of input.weights) {
    const weight = new Decimal(w.weight);
    if (weight.isNegative()) {
      throw new Error(`Negative weight is not allowed (category ${w.categoryId})`);
    }

    const categoryAssessments = input.assessments.filter((a) => a.categoryId === w.categoryId);

    if (categoryAssessments.length === 0) {
      if (weight.gt(0)) {
        return incomplete(
          "NO_ASSESSMENT_FOR_WEIGHTED_CATEGORY",
          categoryAverages,
          missingAssessments,
        );
      }
      // Zero-weight category without assessments contributes nothing.
      categoryAverages.push({ categoryId: w.categoryId, average: ZERO, weight, weightedValue: ZERO });
      continue;
    }

    const normalized: Decimal[] = [];
    for (const a of categoryAssessments) {
      const raw = input.scores[a.id];
      if (raw === undefined || raw === null || `${raw}`.trim() === "") {
        missingAssessments.push(a.id);
        continue;
      }
      const maxScore = new Decimal(a.maxScore);
      if (maxScore.lte(0)) {
        throw new Error(`Assessment ${a.id} has non-positive maxScore`);
      }
      const rawDec = new Decimal(raw);
      if (rawDec.isNegative() || rawDec.gt(maxScore)) {
        throw new Error(`Score ${rawDec.toString()} is outside 0..${maxScore.toString()}`);
      }
      normalized.push(rawDec.div(maxScore).mul(ONE_HUNDRED));
    }

    if (missingAssessments.length > 0) {
      return incomplete("MISSING_SCORE", categoryAverages, missingAssessments);
    }

    const average = normalized
      .reduce((acc, n) => acc.plus(n), new Decimal(0))
      .div(normalized.length);
    const weightedValue = average.mul(weight).div(ONE_HUNDRED);
    categoryAverages.push({ categoryId: w.categoryId, average, weight, weightedValue });
    total = total.plus(weightedValue);
  }

  const finalScore = total;
  const threshold =
    input.kktpThreshold === undefined || input.kktpThreshold === null
      ? null
      : new Decimal(input.kktpThreshold);

  let achievement: AchievementStatus = "NOT_ASSESSED";
  if (threshold !== null) {
    achievement = finalScore.gte(threshold) ? "ACHIEVED" : "NOT_ACHIEVED";
  }

  return {
    status: "COMPLETE",
    categoryAverages,
    finalScore,
    achievement,
    missingAssessments,
  };
}

function incomplete(
  reason: IncompleteReason,
  categoryAverages: CategoryAverageResult[],
  missingAssessments: string[],
): GradeCalculationResult {
  return {
    status: "INCOMPLETE",
    reason,
    categoryAverages,
    achievement: "NOT_ASSESSED",
    missingAssessments: [...missingAssessments],
  };
}

/**
 * Published grading schemes must total EXACTLY 100 (decimal comparison,
 * no float tolerance).
 */
export function validateWeightsTotal(weights: Array<{ weight: Decimal.Value }>): boolean {
  const total = weights.reduce((acc, w) => acc.plus(new Decimal(w.weight)), new Decimal(0));
  return total.equals(ONE_HUNDRED);
}

/** Display rounding: nearest integer (86.75 -> 87). Internal values untouched. */
export function roundForDisplay(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/** Normalizes a raw score to the 0-100 scale with decimal arithmetic. */
export function normalizeScore(rawScore: Decimal.Value, maxScore: Decimal.Value): Decimal {
  const max = new Decimal(maxScore);
  if (max.lte(0)) throw new Error("maxScore must be positive");
  return new Decimal(rawScore).div(max).mul(ONE_HUNDRED);
}
