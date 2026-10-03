"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuditLog } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDateTime } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Card, Field, PageHeader, Pagination, Spinner, EmptyState, Button } from "@/components/ui";

export default function AuditPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ action: "", entityType: "", entityId: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (f: typeof filters, p: number) => {
    setLoading(true);
    setError("");
    try {
      const r = await api().audit.list({
        page: p,
        limit: 20,
        action: f.action || undefined,
        entityType: f.entityType || undefined,
        entityId: f.entityId || undefined,
      });
      setRows(r.data);
      setMeta({ total: r.meta.total, totalPages: r.meta.totalPages });
      setPage(r.meta.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(filters, 1); }, [load]);

  if (authLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Jejak aktivitas penting — read-only" />
      <Alert kind="error">{error}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Aksi">
            <input type="text" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} placeholder="cth: REPORT_PUBLISH" />
          </Field>
          <Field label="Tipe entitas">
            <input type="text" value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })} placeholder="cth: ReportCard" />
          </Field>
          <Field label="ID entitas">
            <input type="text" value={filters.entityId} onChange={(e) => setFilters({ ...filters, entityId: e.target.value })} placeholder="UUID" />
          </Field>
          <Button variant="secondary" onClick={() => void load(filters, 1)}>Filter</Button>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Waktu</th><th>Aksi</th><th>Entitas</th><th>ID entitas</th><th>Pelaku</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="small">{formatDateTime(a.createdAt)}</td>
                    <td><span className="badge blue">{a.action}</span></td>
                    <td>{a.entityType}</td>
                    <td className="small">{a.entityId ? a.entityId.slice(0, 8) + "…" : "-"}</td>
                    <td className="small">{a.actorUserId ? a.actorUserId.slice(0, 8) + "…" : "sistem"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={(p) => void load(filters, p)} />
      </Card>
    </>
  );
}
