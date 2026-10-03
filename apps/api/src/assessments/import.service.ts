import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import Decimal from "decimal.js";
import * as ExcelJS from "exceljs";
import { Request } from "express";
import { APP_CONFIG, AppConfig } from "../config/configuration";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditAction } from "../audit/audit.service";
import { ResourcePolicyService } from "../authorization/resource-policy.service";
import { Errors } from "../common/errors/api-exception";
import { ApiErrorCode } from "../common/errors/error-codes";
import type { SessionUser } from "../auth/types/session-user";
import { AssessmentsService } from "./assessments.service";

export interface ImportRowError {
  row: number;
  code: string;
  message: string;
}

export interface ImportPreview {
  importId: string;
  valid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportRowError[];
}

interface ParsedRow {
  studentId: string;
  score: number;
  note?: string;
}

interface PreviewToken {
  id: string;
  assessmentId: string;
  schoolId: string;
  createdBy: string;
  rows: ParsedRow[];
  expiresAt: number;
}

const SCORE_ALIASES = ["score", "nilai", "skor"];
const NIS_ALIASES = ["nis"];
const NISN_ALIASES = ["nisn"];

/**
 * Two-phase score import (Epic 12):
 *   POST /assessments/:id/scores/import        -> validates, returns preview + importId
 *   POST /assessments/:id/scores/import/commit  -> applies the previewed rows transactionally
 *
 * Accepted files: .xlsx, .xls, .csv with a header row containing at minimum
 * an identifier column (`nis`, or `nisn`) and a score column
 * (`score` / `nilai` / `skor`).
 */
@Injectable()
export class ImportService {
  private readonly tokens = new Map<string, PreviewToken>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: ResourcePolicyService,
    private readonly assessments: AssessmentsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async preview(
    user: SessionUser,
    assessmentId: string,
    file: { buffer: Buffer; originalname: string },
  ): Promise<ImportPreview> {
    const assessment = await this.scopedAssessment(user, assessmentId);
    const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      throw Errors.validation(
        ApiErrorCode.IMPORT_INVALID_FORMAT,
        "Format file tidak didukung. Gunakan file XLSX atau CSV.",
      );
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw Errors.validation(ApiErrorCode.IMPORT_INVALID_FORMAT, "File kosong.");
    }

    const workbook = new ExcelJS.Workbook();
    try {
      if (ext === "csv") {
        await workbook.csv.read(Readable.from(file.buffer.toString("utf-8")));
      } else {
        await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
      }
    } catch {
      throw Errors.validation(ApiErrorCode.IMPORT_INVALID_FORMAT, "File tidak dapat dibaca sebagai XLSX/CSV.");
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw Errors.validation(
        ApiErrorCode.IMPORT_INVALID_FORMAT,
        "File harus memiliki baris header dan minimal satu baris data.",
      );
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, col) => {
      headers[col - 1] = String(cell.value ?? "").trim().toLowerCase();
    });

    const idCol = findColumn(headers, [...NIS_ALIASES, ...NISN_ALIASES]);
    const idIsNisn = idCol >= 0 && NISN_ALIASES.includes(headers[idCol]);
    const scoreCol = findColumn(headers, SCORE_ALIASES);
    if (idCol < 0 || scoreCol < 0) {
      throw Errors.validation(
        ApiErrorCode.IMPORT_INVALID_FORMAT,
        "Header tidak dikenali. File harus memiliki kolom 'nis' (atau 'nisn') dan 'score'/'nilai'.",
        { foundHeaders: headers.filter(Boolean) },
      );
    }

    const maxScore = new Decimal(assessment.maxScore.toString());
    const errors: ImportRowError[] = [];
    const rows: ParsedRow[] = [];
    const seen = new Set<string>();
    let totalRows = 0;

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const rawId = cellText(row.getCell(idCol + 1).value);
      const rawScore = cellText(row.getCell(scoreCol + 1).value);
      if (!rawId && !rawScore) continue; // skip fully empty rows
      totalRows++;

      if (!rawId) {
        errors.push({ row: r, code: "MISSING_IDENTIFIER", message: "NIS/NISN kosong." });
        continue;
      }
      if (seen.has(rawId.toLowerCase())) {
        errors.push({ row: r, code: "DUPLICATE_ROW", message: `Duplikat baris untuk identifier ${rawId}.` });
        continue;
      }
      seen.add(rawId.toLowerCase());

      const student = await this.prisma.student.findFirst({
        where: idIsNisn
          ? { schoolId: user.schoolId, nisn: rawId }
          : { schoolId: user.schoolId, nis: rawId },
        select: { id: true },
      });
      if (!student) {
        errors.push({ row: r, code: "UNKNOWN_STUDENT", message: `Siswa dengan ${idIsNisn ? "NISN" : "NIS"} '${rawId}' tidak ditemukan.` });
        continue;
      }

      const enrolled = await this.prisma.studentEnrollment.findFirst({
        where: {
          studentId: student.id,
          classId: assessment.classId,
          academicYearId: assessment.teacherAssignment.academicYearId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!enrolled) {
        errors.push({ row: r, code: "STUDENT_NOT_ENROLLED", message: `Siswa '${rawId}' tidak terdaftar aktif di kelas asesmen ini.` });
        continue;
      }

      if (!rawScore) {
        errors.push({ row: r, code: "INVALID_SCORE", message: "Nilai kosong." });
        continue;
      }
      const scoreNum = Number(rawScore.replace(",", "."));
      if (!Number.isFinite(scoreNum)) {
        errors.push({ row: r, code: "INVALID_SCORE", message: `Nilai '${rawScore}' bukan angka.` });
        continue;
      }
      const scoreDec = new Decimal(scoreNum);
      if (scoreDec.isNegative() || scoreDec.gt(maxScore)) {
        errors.push({
          row: r,
          code: "SCORE_EXCEEDS_MAX",
          message: `Nilai ${scoreNum} di luar rentang 0..${maxScore.toString()}.`,
        });
        continue;
      }

      rows.push({ studentId: student.id, score: scoreDec.toNumber() });
    }

    const importId = randomUUID();
    this.tokens.set(importId, {
      id: importId,
      assessmentId: assessment.id,
      schoolId: user.schoolId,
      createdBy: user.id,
      rows,
      expiresAt: Date.now() + this.config.importPreviewTtlMinutes * 60_000,
    });
    this.sweepExpired();

    return {
      importId,
      valid: errors.length === 0,
      totalRows,
      validRows: rows.length,
      invalidRows: errors.length,
      errors,
    };
  }

  async commit(
    user: SessionUser,
    assessmentId: string,
    importId: string,
    req: Request,
  ): Promise<{ importId: string; importedRows: number }> {
    const assessment = await this.scopedAssessment(user, assessmentId);
    const token = this.tokens.get(importId);
    this.sweepExpired();

    if (
      !token ||
      token.assessmentId !== assessment.id ||
      token.schoolId !== user.schoolId ||
      (token.createdBy !== user.id && user.role !== "SUPERADMIN")
    ) {
      throw Errors.conflict(
        ApiErrorCode.RESOURCE_CONFLICT,
        "Sesi import tidak valid, kedaluwarsa, atau bukan milik Anda.",
      );
    }
    if (token.rows.length === 0) {
      this.tokens.delete(importId);
      throw Errors.validation(ApiErrorCode.IMPORT_VALIDATION_FAILED, "Tidak ada baris valid untuk diimport.");
    }

    const saved = await this.assessments.applyImportRows(user, assessment.id, token.rows, req);
    this.tokens.delete(importId);

    await this.audit.log({
      req,
      schoolId: user.schoolId,
      actorUserId: user.id,
      action: AuditAction.SCORE_IMPORT_COMMIT,
      entityType: "AssessmentScore",
      entityId: assessment.id,
      afterJson: { assessmentId: assessment.id, importId, importedRows: saved.length },
    });

    return { importId, importedRows: saved.length };
  }

  private async scopedAssessment(user: SessionUser, id: string) {
    if (user.role === "TEACHER") {
      return this.policy.requireTeacherOwnsAssessment(user.id, user.schoolId, id);
    }
    return this.policy.assessmentInSchool(user.schoolId, id);
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [id, t] of this.tokens) {
      if (t.expiresAt <= now) this.tokens.delete(id);
    }
  }
}

function findColumn(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (aliases.includes(headers[i])) return i;
  }
  return -1;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray((value as { richText: Array<{ text: string }> }).richText)) {
      return (value as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join("");
    }
    if ("text" in value) return String((value as { text: unknown }).text ?? "");
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}
