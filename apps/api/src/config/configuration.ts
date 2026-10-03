/**
 * Application configuration loaded from environment variables.
 * Every value is configurable via env with a safe default; secrets are
 * never hardcoded. Required secrets throw at startup when missing.
 */

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  databaseUrl: string;
  sessionSecret: string;
  sessionTtlHours: number;
  sessionCookieName: string;
  cookieSecure: boolean;
  bcryptRounds: number;
  loginRateLimitMax: number;
  loginRateLimitWindowMs: number;
  chromeExecutablePath: string;
  pdfTimeoutMs: number;
  importPreviewTtlMinutes: number;
  maxUploadMb: number;
}

export const APP_CONFIG = Symbol("APP_CONFIG");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numberOr(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  const sessionSecret = required("SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long");
  }

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  const cookieSecureRaw = process.env.COOKIE_SECURE;
  const cookieSecure =
    cookieSecureRaw !== undefined && cookieSecureRaw !== ""
      ? cookieSecureRaw.toLowerCase() === "true"
      : isProduction;

  return {
    port: numberOr("PORT", 3001),
    nodeEnv,
    isProduction,
    databaseUrl: required("DATABASE_URL"),
    sessionSecret,
    sessionTtlHours: numberOr("SESSION_TTL_HOURS", 12),
    sessionCookieName: process.env.SESSION_COOKIE_NAME || "school_report_session",
    cookieSecure,
    bcryptRounds: numberOr("BCRYPT_ROUNDS", 12),
    loginRateLimitMax: numberOr("LOGIN_RATE_LIMIT_MAX", 10),
    loginRateLimitWindowMs: numberOr("LOGIN_RATE_LIMIT_WINDOW_MS", 60_000),
    chromeExecutablePath:
      process.env.CHROME_EXECUTABLE_PATH || "/opt/meta-chromium/chrome",
    pdfTimeoutMs: numberOr("PDF_TIMEOUT_MS", 30_000),
    importPreviewTtlMinutes: numberOr("IMPORT_PREVIEW_TTL_MINUTES", 30),
    maxUploadMb: numberOr("MAX_UPLOAD_MB", 10),
  };
}
