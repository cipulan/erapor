/** Unit tests for the draft report description generator (Epic 14). */
import { describe, expect, it } from "vitest";
import { generateSubjectDescription } from "../src/grading/description-generator";

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
