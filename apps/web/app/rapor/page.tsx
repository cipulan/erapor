"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AcademicYear, ReportCard, Semester, Student } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useAuth, useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Pagination, Spinner, EmptyState } from "@/components/ui";

function RaporList() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ReportCard[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filters, setFilters] = useState({
    academicYearId: "",
    semesterId: "",
    status: "",
    studentId: searchParams.get("studentId") ?? "",
  });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showGen, setShowGen] = useState(false);
  const [genForm, setGenForm] = useState({ studentId: "", academicYearId: "", semesterId: "" });
  const [genBusy, setGenBusy] = useState(false);

  const load = useCallback(async (f: typeof filters, p: number) => {
    setLoading(true);
    setError("");
    try {
      const r = await api().reports.list({
        page: p,
        limit: 20,
        academicYearId: f.academicYearId || undefined,
        semesterId: f.semesterId || undefined,
        status: f.status || undefined,
        studentId: f.studentId || undefined,
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

  useEffect(() => {
    (async () => {
      try {
        const c = api();
        const [y, st] = await Promise.all([c.academicYears.list({ limit: 50 }), c.students.list({ limit: 100 })]);
        setYears(y.data);
        setStudents(st.data);
        const active = y.data.find((x) => x.status === "ACTIVE");
        const f = { ...filters, academicYearId: active?.id ?? "" };
        if (active) setSemesters(await c.semesters.list(active.id));
        setFilters(f);
        await load(f, 1);
      } catch (err) {
        setError(errorMessage(err));
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function onFilterYear(yid: string) {
    const f = { ...filters, academicYearId: yid, semesterId: "" };
    setFilters(f);
    setSemesters(yid ? await api().semesters.list(yid).catch(() => []) : []);
    void load(f, 1);
  }

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genForm.studentId || !genForm.academicYearId || !genForm.semesterId) {
      setError("Siswa, tahun ajaran, dan semester wajib dipilih.");
      return;
    }
    setGenBusy(true);
    setError(""); setSuccess("");
    try {
      const r = await api().reports.generate(genForm);
      setShowGen(false);
      setSuccess(`Rapor berhasil dibuat (versi ${r.version}).`);
      await load(filters, 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenBusy(false);
    }
  }

  const studentName = (id: string) => students.find((s) => s.id === id)?.fullName ?? id.slice(0, 8) + "…";
  const canGenerate = user?.role === "SUPERADMIN" || user?.role === "TEACHER";

  return (
    <>
      <PageHeader
        title="Rapor"
        subtitle={user?.role === "PARENT" ? "Rapor anak yang sudah terbit" : "Generate, review, kunci, dan terbitkan rapor"}
        actions={canGenerate ? <Button onClick={() => setShowGen(true)}>+ Generate rapor</Button> : undefined}
      />
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>
      <Card>
        <div className="toolbar">
          <Field label="Tahun ajaran">
            <select value={filters.academicYearId} onChange={(e) => void onFilterYear(e.target.value)}>
              <option value="">Semua</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
          <Field label="Semester">
            <select value={filters.semesterId} onChange={(e) => { const f = { ...filters, semesterId: e.target.value }; setFilters(f); void load(f, 1); }}>
              <option value="">Semua</option>
              {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={filters.status} onChange={(e) => { const f = { ...filters, status: e.target.value }; setFilters(f); void load(f, 1); }}>
              <option value="">Semua</option>
              <option value="DRAFT">Draf</option>
              <option value="REVIEW">Review</option>
              <option value="LOCKED">Terkunci</option>
              <option value="PUBLISHED">Terbit</option>
              <option value="REVISION">Revisi</option>
            </select>
          </Field>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Siswa</th><th>Versi</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/rapor/${r.id}`}>{studentName(r.studentId)}</Link></td>
                    <td>v{r.version}</td>
                    <td><Badge status={r.status} /></td>
                    <td><Link href={`/rapor/${r.id}`} className="btn small secondary">Buka</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={(p) => void load(filters, p)} />
      </Card>

      {showGen && (
        <Modal title="Generate Rapor" onClose={() => setShowGen(false)}>
          <form onSubmit={onGenerate}>
            <Field label="Siswa">
              <select value={genForm.studentId} onChange={(e) => setGenForm({ ...genForm, studentId: e.target.value })}>
                <option value="">— Pilih —</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </Field>
            <div className="form-row">
              <Field label="Tahun ajaran">
                <select value={genForm.academicYearId} onChange={async (e) => {
                  const yid = e.target.value;
                  setGenForm({ ...genForm, academicYearId: yid, semesterId: "" });
                  setSemesters(yid ? await api().semesters.list(yid).catch(() => []) : []);
                }}>
                  <option value="">— Pilih —</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </Field>
              <Field label="Semester">
                <select value={genForm.semesterId} onChange={(e) => setGenForm({ ...genForm, semesterId: e.target.value })}>
                  <option value="">— Pilih —</option>
                  {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <p className="small muted">Generate gagal bila nilai belum lengkap atau skema belum di-publish.</p>
            <div className="btn-row">
              <Button type="submit" disabled={genBusy}>{genBusy ? "Memproses..." : "Generate"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowGen(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function RaporPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN", "TEACHER", "PARENT"]);
  if (authLoading) return <Spinner />;
  return (
    <Suspense fallback={<Spinner />}>
      <RaporList />
    </Suspense>
  );
}
