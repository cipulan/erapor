"use client";

import React from "react";

/* ---------- tombol ---------- */
type BtnVariant = "primary" | "secondary" | "success" | "warn" | "danger";
export function Button({
  variant = "primary",
  small,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; small?: boolean }) {
  const cls = `btn${variant === "primary" ? "" : ` ${variant}`}${small ? " small" : ""}`;
  return <button className={cls} {...props} />;
}

/**
 * Tombol salin dengan fallback untuk non-HTTPS (clipboard API butuh secure
 * context; di akses HTTP via IP LAN pakai textarea + execCommand).
 */
export function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  async function onCopy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      /* bukan secure context — pakai fallback di bawah */
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }
  return (
    <Button variant="secondary" onClick={() => void onCopy()}>
      {copied ? "Tersalin ✓" : label}
    </Button>
  );
}

/* ---------- kartu & kepala halaman ---------- */
export function Card({ title, children, actions }: { title?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          {title ? <h3 style={{ margin: 0 }}>{title}</h3> : <span />}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="btn-row" style={{ marginTop: 0 }}>{actions}</div>
    </div>
  );
}

/* ---------- form ---------- */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/* ---------- badge status ---------- */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "green", PUBLISHED: "green", ACHIEVED: "green",
  DRAFT: "gray", INACTIVE: "gray", CLOSED: "gray", ARCHIVED: "gray",
  REVIEW: "blue", LOCKED: "amber", COMPLETE: "green",
  INCOMPLETE: "red", NOT_ACHIEVED: "red", REVISION: "amber",
  SUPERADMIN: "blue", TEACHER: "green", PARENT: "amber",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draf", ACTIVE: "Aktif", INACTIVE: "Nonaktif", ARCHIVED: "Arsip",
  REVIEW: "Review", LOCKED: "Terkunci", PUBLISHED: "Terbit", REVISION: "Revisi",
  COMPLETE: "Lengkap", INCOMPLETE: "Belum lengkap",
  ACHIEVED: "Tercapai", NOT_ACHIEVED: "Belum tercapai", NOT_ASSESSED: "Belum dinilai",
  ODD: "Ganjil", EVEN: "Genap", CLOSED: "Tutup",
  MALE: "Laki-laki", FEMALE: "Perempuan",
  MANDATORY: "Wajib", ADDITIONAL: "Tambahan", LOCAL: "Mulok",
  NEW: "Baru", PROMOTED: "Naik kelas", REPEATED: "Tinggal kelas", TRANSFERRED: "Pindahan",
  GRADUATED: "Lulus", COMPLETED: "Selesai", CANCELLED: "Batal",
  SUPERADMIN: "Superadmin", TEACHER: "Guru", PARENT: "Wali",
};

export function Badge({ status, label }: { status?: string | null; label?: string }) {
  const key = (status ?? "").toUpperCase();
  const color = STATUS_COLORS[key] ?? "gray";
  const text = label ?? STATUS_LABELS[key] ?? status ?? "-";
  return <span className={`badge ${color}`}>{text}</span>;
}

/* ---------- alert / spinner / empty ---------- */
export function Alert({ kind, children }: { kind: "error" | "success" | "info"; children: React.ReactNode }) {
  if (!children) return null;
  return <div className={`alert ${kind}`}>{children}</div>;
}

export function Spinner({ text }: { text?: string }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
      <span className="spinner" /> {text ?? "Memuat..."}
    </div>
  );
}

export function EmptyState({ text }: { text?: string }) {
  return <div className="empty">{text ?? "Belum ada data."}</div>;
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ---------- pagination ---------- */
export function Pagination({ page, totalPages, total, onPage }: {
  page: number; totalPages: number; total: number; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return <div className="pager">Total {total} data</div>;
  return (
    <div className="pager">
      <Button small variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Sebelumnya</Button>
      <span>Halaman {page} dari {totalPages} (total {total})</span>
      <Button small variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Berikutnya →</Button>
    </div>
  );
}
