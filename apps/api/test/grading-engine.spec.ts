/**
 * Unit tests for the pure grading engine.
 * Covers docs/architecture/grading-engine.md §17 testing matrix.
 */
import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateGrade,
  normalizeScore,
  roundForDisplay,
  validateWeightsTotal,
} from "../src/grading/grading-engine";

const CAT_A = "cat-formatif";
const CAT_B = "cat-sumatif";

function input(overrides: Partial<Parameters<typeof calculateGrade>[0]> = {}) {
  return {
    weights: [
      { categoryId: CAT_A, weight: 30 },
      { categoryId: CAT_B, weight: 70 },
    ],
    assessments: [],
    scores: {},
    kktpThreshold: null,
    ...overrides,
  };
}

describe("normalizeScore", () => {
  it("score 40/50 normalizes to 80", () => {
    expect(normalizeScore(40, 50).toNumber()).toBe(80);
  });

  it("uses decimal arithmetic, not binary float", () => {
    // 1/3 * 100 must be exactly representable in decimal, not 33.333333333333336
    const n = normalizeScore(1, 3);
    expect(n.toString()).toBe("33.333333333333333333");
    expect(n.equals(new Decimal("33.333333333333333333"))).toBe(true);
  });
});

describe("calculateGrade", () => {
  it("averages category scores: 80 and 90 -> 85", () => {
    const result = calculateGrade(
      input({
        weights: [{ categoryId: CAT_A, weight: 100 }],
        assessments: [
          { id: "a1", categoryId: CAT_A, maxScore: 100 },
          { id: "a2", categoryId: CAT_A, maxScore: 100 },
        ],
        scores: { a1: 80, a2: 90 },
      }),
    );
    expect(result.status).toBe("COMPLETE");
    expect(result.categoryAverages).toHaveLength(1);
    expect(result.categoryAverages[0].average.toNumber()).toBe(85);
  });

  it("applies weights: 80*30% + 90*50% + 85*20% = 86", () => {
    const result = calculateGrade(
      input({
        weights: [
          { categoryId: "c1", weight: 30 },
          { categoryId: "c2", weight: 50 },
          { categoryId: "c3", weight: 20 },
        ],
        assessments: [
          { id: "a1", categoryId: "c1", maxScore: 100 },
          { id: "a2", categoryId: "c2", maxScore: 100 },
          { id: "a3", categoryId: "c3", maxScore: 100 },
        ],
        scores: { a1: 80, a2: 90, a3: 85 },
      }),
    );
    expect(result.status).toBe("COMPLETE");
    expect(result.finalScore!.toNumber()).toBe(86);
  });

  it("missing score -> INCOMPLETE (never treated as zero)", () => {
    const result = calculateGrade(
      input({
        weights: [{ categoryId: CAT_A, weight: 100 }],
        assessments: [
          { id: "a1", categoryId: CAT_A, maxScore: 100 },
          { id: "a2", categoryId: CAT_A, maxScore: 100 },
        ],
        scores: { a1: 80 }, // a2 missing
      }),
    );
    expect(result.status).toBe("INCOMPLETE");
    expect(result.reason).toBe("MISSING_SCORE");
    expect(result.finalScore).toBeUndefined();
    expect(result.missingAssessments).toEqual(["a2"]);
    expect(result.achievement).toBe("NOT_ASSESSED");
  });

  it("weighted category without eligible assessments -> INCOMPLETE", () => {
    const result = calculateGrade(
      input({
        weights: [
          { categoryId: CAT_A, weight: 30 },
          { categoryId: CAT_B, weight: 70 },
        ],
        assessments: [{ id: "a1", categoryId: CAT_A, maxScore: 100 }],
        scores: { a1: 80 },
      }),
    );
    expect(result.status).toBe("INCOMPLETE");
    expect(result.reason).toBe("NO_ASSESSMENT_FOR_WEIGHTED_CATEGORY");
  });

  it("zero-weight category without assessments is skipped, not incomplete", () => {
    const result = calculateGrade(
      input({
        weights: [
          { categoryId: CAT_A, weight: 100 },
          { categoryId: CAT_B, weight: 0 },
        ],
        assessments: [{ id: "a1", categoryId: CAT_A, maxScore: 100 }],
        scores: { a1: 80 },
      }),
    );
    expect(result.status).toBe("COMPLETE");
    expect(result.finalScore!.toNumber()).toBe(80);
  });

  it("KKTP: final 75 with threshold 75 -> ACHIEVED", () => {
    const result = calculateGrade(
      input({
        weights: [{ categoryId: CAT_A, weight: 100 }],
        assessments: [{ id: "a1", categoryId: CAT_A, maxScore: 100 }],
        scores: { a1: 75 },
        kktpThreshold: 75,
      }),
    );
    expect(result.achievement).toBe("ACHIEVED");
  });

  it("KKTP: final 74.99 with threshold 75 -> NOT_ACHIEVED (no float tolerance)", () => {
    const result = calculateGrade(
      input({
        weights: [{ categoryId: CAT_A, weight: 100 }],
        assessments: [{ id: "a1", categoryId: CAT_A, maxScore: 100 }],
        scores: { a1: 74.99 },
        kktpThreshold: 75,
      }),
    );
    expect(result.status).toBe("COMPLETE");
    expect(result.achievement).toBe("NOT_ACHIEVED");
  });

  it("KKTP: no threshold configured -> NOT_ASSESSED", () => {
    const result = calculateGrade(
      input({
        weights: [{ categoryId: CAT_A, weight: 100 }],
        assessments: [{ id: "a1", categoryId: CAT_A, maxScore: 100 }],
        scores: { a1: 90 },
      }),
    );
    expect(result.achievement).toBe("NOT_ASSESSED");
  });

  it("keeps full precision internally; rounding is display-only", () => {
    const result = calculateGrade(
      input({
        weights: [{ categoryId: CAT_A, weight: 100 }],
        assessments: [
          { id: "a1", categoryId: CAT_A, maxScore: 3 },
          { id: "a2", categoryId: CAT_A, maxScore: 3 },
          { id: "a3", categoryId: CAT_A, maxScore: 3 },
        ],
        scores: { a1: 2, a2: 2, a3: 3 }, // avg = 77.777...
      }),
    );
    expect(result.status).toBe("COMPLETE");
    // Internal value is NOT rounded to an integer (decimal.js keeps 20 sig digits).
    expect(result.finalScore!.toString()).toBe("77.777777777777777777");
    expect(roundForDisplay(result.finalScore!)).toBe(78);
  });

  it("accumulates weights without binary float error", () => {
    const result = calculateGrade(
      input({
        weights: [
          { categoryId: "c1", weight: 33.33 },
          { categoryId: "c2", weight: 33.33 },
          { categoryId: "c3", weight: 33.34 },
        ],
        assessments: [
          { id: "a1", categoryId: "c1", maxScore: 10 },
          { id: "a2", categoryId: "c2", maxScore: 10 },
          { id: "a3", categoryId: "c3", maxScore: 10 },
        ],
        scores: { a1: 1, a2: 1, a3: 1 }, // each normalized 10
      }),
    );
    // 10 * (33.33 + 33.33 + 33.34) / 100 = 10 exactly in decimal.
    expect(result.finalScore!.toString()).toBe("10");
  });
});

describe("validateWeightsTotal", () => {
  it("weights total 100 -> publish allowed", () => {
    expect(validateWeightsTotal([{ weight: 20 }, { weight: 80 }])).toBe(true);
    expect(validateWeightsTotal([{ weight: "33.33" }, { weight: "66.67" }])).toBe(true);
  });

  it("weights total 99 -> publish rejected", () => {
    expect(validateWeightsTotal([{ weight: 20 }, { weight: 79 }])).toBe(false);
  });

  it("weights total 100.01 -> publish rejected (exact decimal comparison)", () => {
    expect(validateWeightsTotal([{ weight: "33.34" }, { weight: "66.67" }])).toBe(false);
  });
});

describe("roundForDisplay", () => {
  it("86.75 -> 87", () => {
    expect(roundForDisplay(86.75)).toBe(87);
  });

  it("86.5 -> 87 (half up), 86.4 -> 86", () => {
    expect(roundForDisplay(86.5)).toBe(87);
    expect(roundForDisplay(86.4)).toBe(86);
  });
});
