import { ApiError } from "@erapor/api-client";

/** Ambil pesan error Bahasa Indonesia yang aman ditampilkan ke user. */
export function errorMessage(err: unknown, fallback = "Terjadi kesalahan. Silakan coba lagi."): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

/** true bila error berarti sesi habis / belum login. */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && err.isUnauthorized;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
