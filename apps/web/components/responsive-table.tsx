"use client";

import { useEffect, useState } from "react";

export interface RTColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
}

interface ResponsiveTableProps<T> {
  columns: RTColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Judul baris pada daftar ringkas mobile & bottom sheet. */
  title: (row: T) => React.ReactNode;
  /** Sub-judul pada daftar ringkas mobile (mis. info kunci kedua). */
  subtitle?: (row: T) => React.ReactNode;
  /** Tombol aksi di dalam bottom sheet (mis. Lihat detail, Ubah). */
  actions?: (row: T) => React.ReactNode;
  emptyText?: string;
}

/**
 * Tabel responsif pola "Daftar Ringkas + Detail":
 * - Desktop: tabel biasa (identik dengan markup sebelumnya).
 * - Mobile (<=700px): daftar ringkas; ketuk baris membuka bottom sheet
 *   berisi seluruh kolom sebagai pasangan label-nilai + tombol aksi.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  title,
  subtitle,
  actions,
  emptyText = "Belum ada data.",
}: ResponsiveTableProps<T>) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openRow = rows.find((r) => rowKey(r) === openKey) ?? null;

  useEffect(() => {
    if (!openRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openRow]);

  return (
    <>
      <div className="table-wrap rt-desktop">
        <table className="tbl">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty">{emptyText}</div>}
      </div>

      <div className="rt-mobile">
        {rows.length === 0 && <div className="empty">{emptyText}</div>}
        {rows.map((r) => (
          <button key={rowKey(r)} type="button" className="rt-row" onClick={() => setOpenKey(rowKey(r))}>
            <span className="rt-row-text">
              <span className="rt-row-title">{title(r)}</span>
              {subtitle && <span className="rt-row-sub">{subtitle(r)}</span>}
            </span>
            <span className="rt-chev" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      {openRow && (
        <>
          <div className="rt-backdrop" onClick={() => setOpenKey(null)} aria-hidden="true" />
          <div
            className="rt-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              // Ketuk link/tombol apapun di dalam sheet -> tutup sheet dulu,
              // supaya modal/halaman tujuan tidak tertutup panel.
              const t = e.target as HTMLElement;
              if (t.closest("a,button")) setOpenKey(null);
            }}
          >
            <div className="rt-grab" aria-hidden="true" />
            <div className="rt-sheet-title">{title(openRow)}</div>
            {subtitle && <div className="rt-sheet-sub">{subtitle(openRow)}</div>}
            <dl className="rt-detail">
              {columns.map((c) => (
                <div key={c.key} className="rt-field">
                  <dt>{c.label}</dt>
                  <dd>{c.render(openRow)}</dd>
                </div>
              ))}
            </dl>
            {actions && <div className="rt-actions">{actions(openRow)}</div>}
            <button type="button" className="rt-close" onClick={() => setOpenKey(null)}>
              Tutup
            </button>
          </div>
        </>
      )}
    </>
  );
}
