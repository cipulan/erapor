/** Unit tests for the draft report description generator (Epic 14). */
import { describe, expect, it } from "vitest";
import {
  generateSubjectDescription,
  generateTpDescription,
  predicateBands,
  predicateForScore,
} from "../src/grading/description-generator";

describe("generateSubjectDescription", () => {
  it("mentions student, subject, rounded score, and KKTP achievement", () => {
    const text = generateSubjectDescription({
      studentName: "Siswa 01",
      subjectName: "Matematika",
      finalScore: 86.75,
      achievement: "ACHIEVED",
      kktpThreshold: 75,
    });
    expect(text).toContain("Siswa 01");
    expect(text).toContain("Matematika");
    expect(text).toContain("87"); // display rounding
    expect(text).toContain("telah memenuhi KKTP (75)");
  });

  it("states unmet KKTP when NOT_ACHIEVED", () => {
    const text = generateSubjectDescription({
      studentName: "Siswa 02",
      subjectName: "Matematika",
      finalScore: 60,
      achievement: "NOT_ACHIEVED",
      kktpThreshold: 75,
    });
    expect(text).toContain("belum memenuhi KKTP (75)");
    expect(text).toContain("perlu bimbingan");
  });

  it("handles missing KKTP threshold gracefully", () => {
    const text = generateSubjectDescription({
      studentName: "Siswa 03",
      subjectName: "IPA",
      finalScore: 92,
      achievement: "NOT_ASSESSED",
      kktpThreshold: null,
    });
    expect(text).toContain("sangat baik");
    expect(text).not.toContain("KKTP (");
  });

  it("is deterministic", () => {
    const args = {
      studentName: "Siswa 01",
      subjectName: "Matematika",
      finalScore: 80,
      achievement: "ACHIEVED" as const,
      kktpThreshold: 75,
    };
    expect(generateSubjectDescription(args)).toBe(generateSubjectDescription(args));
  });
});

describe("predicateBands", () => {
  it("derives Excel thresholds from KKTP 73", () => {
    expect(predicateBands(73)).toEqual({ aMin: 91, bMin: 82, cMin: 73 });
  });

  it("derives thresholds from KKTP 75", () => {
    // range 25 -> third 8.33 -> aMin 92, bMin 83, cMin 75
    expect(predicateBands(75)).toEqual({ aMin: 92, bMin: 83, cMin: 75 });
  });
});

describe("predicateForScore", () => {
  it("uses KKTP-derived bands when threshold present", () => {
    expect(predicateForScore(91, 73)).toBe("A");
    expect(predicateForScore(85, 73)).toBe("B");
    expect(predicateForScore(73, 73)).toBe("C");
    expect(predicateForScore(72.9, 73)).toBe("D");
  });

  it("falls back to fixed 90/80/70 bands without KKTP", () => {
    expect(predicateForScore(90, null)).toBe("A");
    expect(predicateForScore(89.9, null)).toBe("B");
    expect(predicateForScore(70, null)).toBe("C");
    expect(predicateForScore(69.9, null)).toBe("D");
  });
});

describe("generateTpDescription", () => {
  const tps = (scores: Array<[string, number]>) =>
    scores.map(([code, score]) => ({
      code,
      description: `uraian ${code}`,
      score,
    }));

  it("mirrors the Excel three-tier wording for KKTP 73", () => {
    const text = generateTpDescription({
      studentName: "Syamila",
      tpScores: tps([
        ["TP1", 92],
        ["TP2", 88],
        ["TP3", 76],
        ["TP4", 65],
      ]),
      kktpThreshold: 73,
    });
    expect(text).not.toBeNull();
    // TP1 (>91): penguasaan; TP2 (82-90): silent; TP3 (73-81): bimbingan; TP4 (<73): bantuan
    expect(text).toContain("Ananda Syamila menunjukkan penguasaan dalam uraian TP1.");
    expect(text).toContain("Dengan bimbingan guru, menunjukkan pemahaman dalam uraian TP3.");
    expect(text).toContain("Dengan bantuan guru, diharapkan dapat menunjukkan pemahaman dalam uraian TP4.");
    expect(text).not.toContain("uraian TP2");
  });

  it("rounds TP scores before tiering, like Excel", () => {
    const text = generateTpDescription({
      studentName: "Budi",
      tpScores: tps([["TP1", 90.6]]), // rounds to 91 -> silent band, not mastered (>91 strict)
      kktpThreshold: 73,
    });
    expect(text).toBeNull(); // falls back to generic description
  });

  it("mentions multiple TPs in the same tier", () => {
    const text = generateTpDescription({
      studentName: "Citra",
      tpScores: tps([
        ["TP1", 95],
        ["TP2", 93],
      ]),
      kktpThreshold: 73,
    });
    expect(text).toBe("Ananda Citra menunjukkan penguasaan dalam uraian TP1; uraian TP2.");
  });

  it("returns null when no TP lands in a mentioned tier", () => {
    const text = generateTpDescription({
      studentName: "Dedi",
      tpScores: tps([["TP1", 85]]),
      kktpThreshold: 73,
    });
    expect(text).toBeNull();
  });

  it("is deterministic", () => {
    const args = {
      studentName: "Syamila",
      tpScores: tps([["TP1", 92]]),
      kktpThreshold: 73,
    };
    expect(generateTpDescription(args)).toBe(generateTpDescription(args));
  });
});
