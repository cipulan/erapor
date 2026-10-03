# Grading Engine Specification

## 1. Purpose

Dokumen ini mendefinisikan aturan kalkulasi nilai untuk MVP aplikasi rapor sekolah agar implementasi backend menghasilkan nilai yang deterministik dan dapat diuji.

## 2. Scope

Mencakup:
- normalisasi nilai assessment;
- pengelompokan nilai berdasarkan assessment category;
- pembobotan category;
- final score;
- status kelengkapan nilai;
- evaluasi KKTP;
- preview nilai;
- pembuatan snapshot nilai pada report card.

Tidak mencakup aturan pedagogis di luar data yang disimpan sistem.

## 3. Source Data

Input minimal:
- `academicYearId`
- `semesterId`
- `subjectId`
- `studentId`
- published `gradingScheme`
- assessments untuk subject/semester yang relevan
- assessment scores siswa
- KKTP configuration untuk subject/semester.

Assessment harus:
- berada pada subject dan semester yang sama;
- memiliki category aktif;
- memiliki `maxScore > 0`;
- memiliki status `PUBLISHED` atau status yang ditetapkan sistem sebagai eligible untuk kalkulasi.

## 4. Normalisasi Score

Untuk setiap raw score:

`normalizedScore = (rawScore / assessment.maxScore) * 100`

Constraints:
- `rawScore >= 0`
- `rawScore <= assessment.maxScore`
- hasil berada pada `0..100`.
- Simpan raw score dan max score; jangan mengganti raw score menjadi nilai 0..100 di database.

Contoh:
- raw = 42
- max = 50
- normalized = 84

## 5. Category Average

Untuk setiap assessment category yang memiliki assessment eligible:

`categoryAverage = AVG(normalizedScore)`

Hanya score yang benar-benar ada yang dihitung.

Nilai kosong **tidak dianggap 0**.

## 6. Missing Score Rule

Sebelum final score dihitung, sistem harus menentukan apakah seluruh score yang diwajibkan tersedia.

MVP menggunakan aturan berikut:

- Jika sebuah published assessment memiliki siswa yang termasuk populasi penilaian tetapi score belum tersedia, status grading = `INCOMPLETE`.
- `INCOMPLETE` berarti final score tidak boleh dipublikasikan ke report.
- Sistem boleh menampilkan partial calculation untuk preview, tetapi harus diberi status incomplete.
- Missing score tidak dimasukkan sebagai angka 0.

Jika semua score tersedia, status grading = `COMPLETE`.

## 7. Final Score

Untuk setiap category yang termasuk published grading scheme:

`weightedCategory = categoryAverage * weight / 100`

`finalScore = SUM(weightedCategory)`

Published grading scheme wajib memiliki total weight tepat 100.

Contoh:
- Formatif average = 80, weight = 30
- Sumatif average = 90, weight = 50
- Proyek average = 85, weight = 20

`finalScore = 80*0.30 + 90*0.50 + 85*0.20 = 86`

## 8. Rounding

Perhitungan internal menggunakan decimal precision dan tidak dibulatkan pada setiap intermediate step.

Rounding hanya dilakukan untuk display/snapshot sesuai policy MVP:
- internal: decimal;
- display report: nearest integer;
- contoh `86.75 -> 87`.

Implementasi backend harus menggunakan decimal arithmetic, bukan floating-point binary arithmetic untuk hasil final.

## 9. KKTP

KKTP disimpan per:
- academic year;
- semester;
- subject.

Rule:

`ACHIEVED` jika `finalScore >= threshold`.

`NOT_ACHIEVED` jika `finalScore < threshold`.

Jika grading status `INCOMPLETE`, achievement status = `NOT_ASSESSED`.

## 10. Category With No Assessment

Jika grading scheme memiliki category dengan weight > 0 tetapi tidak ada assessment eligible:
- grading status = `INCOMPLETE`;
- final score tidak boleh dipakai untuk publish.

Ini mencegah weight category hilang secara diam-diam.

## 11. Calculation Pseudocode

```text
calculateGrade(student, semester, subject):

  scheme = getPublishedGradingScheme(semester)
  if scheme == null:
      return NOT_READY

  validateWeightTotal(scheme) == 100

  assessments = getEligibleAssessments(
      student.school,
      semester,
      subject
  )

  for each categoryWeight in scheme.weights:
      categoryAssessments = assessments where categoryId == categoryWeight.categoryId

      if categoryAssessments is empty:
          return INCOMPLETE("NO_ASSESSMENT_FOR_WEIGHTED_CATEGORY")

      scores = []
      for assessment in categoryAssessments:
          score = getScore(assessment.id, student.id)

          if score is missing:
              return INCOMPLETE("MISSING_SCORE")

          normalized = decimal(score.rawScore)
                       / decimal(assessment.maxScore)
                       * 100

          scores.append(normalized)

      categoryAverage = average(scores)

      contribution =
          categoryAverage
          * decimal(categoryWeight.weight)
          / 100

      total += contribution

  finalScore = total

  threshold = getKKTP(semester, subject)

  if threshold is missing:
      achievement = NOT_ASSESSED
  else if finalScore >= threshold:
      achievement = ACHIEVED
  else:
      achievement = NOT_ACHIEVED

  return COMPLETE(finalScore, achievement)
```

## 12. Preview vs Published Report

### Preview

`GET /grading/students/{studentId}` may calculate current values from current published scheme and eligible assessments.

Preview is not a historical snapshot.

### Report Generation

`POST /report-cards/generate` must:
1. validate student enrollment;
2. validate semester;
3. load published grading scheme;
4. calculate every required subject;
5. reject generation if required data is incomplete;
6. create report card version;
7. copy calculated values into report-card snapshot tables.

### Published Report

Once report status is `PUBLISHED`:
- displayed score must come from report-card snapshot;
- later assessment edits do not mutate the published report;
- later grading scheme or KKTP changes do not mutate the published report.

## 13. Revision

A published report is immutable.

If correction is needed:
1. create a new report card version;
2. copy/recalculate data;
3. status starts at `REVISION` or the configured draft/review state;
4. new version must pass review/lock/publish lifecycle;
5. old published version remains auditable.

Recommended version rule:

`version = max(existing versions for student + academicYear + semester) + 1`

## 14. Transaction Requirements

Report generation and report publication must use a database transaction.

The transaction boundary for report generation should include:
- validation of source configuration;
- creation of report card;
- creation of report-card subject snapshots;
- creation of relevant audit event.

Do not allow a partially generated report.

## 15. Idempotency

For a normal generation request:
- if an existing draft/review/locked report exists for the same student + academic year + semester, API should return conflict unless caller explicitly requests a revision/regeneration flow.

Do not silently overwrite an existing report.

## 16. Error Conditions

Use existing API error codes where applicable:
- `INVALID_SEMESTER`
- `INVALID_ACADEMIC_YEAR`
- `INVALID_TEACHER_ASSIGNMENT`
- `INVALID_WEIGHT_TOTAL`
- `GRADING_SCHEME_PUBLISHED`
- `ASSESSMENT_INCOMPLETE`
- `REPORT_NOT_READY`
- `REPORT_ALREADY_PUBLISHED`
- `REPORT_REVISION_REQUIRED`

Suggested grading-specific reasons:
- `NO_PUBLISHED_GRADING_SCHEME`
- `NO_ASSESSMENT_FOR_WEIGHTED_CATEGORY`
- `MISSING_SCORE`
- `MISSING_KKTP`
- `INVALID_ASSESSMENT_SCOPE`

## 17. Testing Matrix

| Case | Expected |
|---|---|
| score 40/50 | normalized 80 |
| category scores 80, 90 | average 85 |
| weights total 100 | publish allowed |
| weights total 99 | publish rejected |
| missing score | INCOMPLETE |
| missing score | not treated as zero |
| weighted category has no assessment | INCOMPLETE |
| final 75, KKTP 75 | ACHIEVED |
| final 74.99, KKTP 75 | NOT_ACHIEVED |
| final 86.75 | display 87 |
| published report + raw score edit | published snapshot unchanged |
| published scheme + weight edit | rejected |
| published report + revision | new version |

## 18. Implementation Notes

Recommended service boundaries:

```text
GradingSchemeService
AssessmentService
ScoreService
GradingEngine
KktpService
ReportCardService
```

`GradingEngine` should be a pure domain service where possible:
- no HTTP concerns;
- no authorization decisions;
- no direct request parsing;
- accepts typed domain input;
- returns deterministic calculation result.

Persistence and authorization remain outside the pure calculation function.
