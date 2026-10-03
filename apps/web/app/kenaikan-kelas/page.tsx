"use client";

import { useEffect, useState } from "react";
import type { AcademicYear, ClassItem, PromotionResult } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Button, Card, Field, PageHeader, Spinner, EmptyState } from "@/components/ui";

export default function KenaikanKelasPage() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [sourceClasses, setSourceClasses] = useState<ClassItem[]>([]);
  const [targetClasses, setTargetClasses] = useState<ClassItem[]>([]);
  const [form, setForm] = useState({
    sourceClassId: "",
    sourceYearId: "",
    targetAcademicYearId: "",
    targetClassId: "",
    enrollmentType: "PROMOTED" as "PROMOTED" | "REPEATED",
  });
  const [result, setResult] = useState<PromotionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const y = await api().academicYears.list({ limit: 50 });
        setYears(y.data);
        const active = y.data.find((x) => x.status === "ACTIVE");
        if (active) {
          setForm((f) => ({ ...f, sourceYearId: active.id }));
          const c = await api().classes.list({ academicYearId: active.id, limit: 100 });
          setSourceClasses(c.data);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSourceYear(yid: string) {
    setForm({ ...form, sourceYearId: yid, sourceClassId: "" });
    setSourceClasses(yid ? (await api().classes.list({ academicYearId: yid, limit: 100 }).catch(() => ({ data: [] as ClassItem[] }))).data : []);
  }

  async function onTargetYear(yid: string) {
    setForm({ ...form, targetAcademicYearId: yid, targetClassId: "" });
    setTargetClasses(yid ? (await api().classes.list({ academicYearId: yid, limit: 100 }).catch(() => ({ data: [] as ClassItem[] }))).data : []);
  }

  async function onExecute(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!form.sourceClassId || !form.targetAcademicYearId || !form.targetClassId) {
      setError("Kelas sumber, tahun ajaran tujuan, dan kelas tujuan wajib dipilih.");
      return;
    }
    if (!confirm("Jalankan kenaikan kelas? Enrollment baru akan dibuat untuk siswa kelas sumber.")) return;
    setBusy(true);
    try {
      const r = await api().promotion.promote(form.sourceClassId, {
        targetAcademicYearId: form.targetAcademicYearId,
        targetClassId: form.targetClassId,
        enrollmentType: form.enrollmentType,
      });
      setResult(r);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Kenaikan Kelas" subtitle="Promosikan siswa ke kelas/tahun ajaran berikutnya" />
      <Alert kind="error">{error}</Alert>

      <Card title="Parameter promosi">
        <form onSubmit={onExecute}>
          <div className="form-row">
            <Field label="Tahun ajaran sumber">
              <select value={form.sourceYearId} onChange={(e) => void onSourceYear(e.target.value)}>
                <option value="">— Pilih —</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </Field>
            <Field label="Kelas sumber">
              <select value={form.sourceClassId} onChange={(e) => setForm({ ...form, sourceClassId: e.target.value })}>
                <option value="">— Pilih —</option>
                {sourceClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Tahun ajaran tujuan">
              <select value={form.targetAcademicYearId} onChange={(e) => void onTargetYear(e.target.value)}>
                <option value="">— Pilih —</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </Field>
            <Field label="Kelas tujuan">
              <select value={form.targetClassId} onChange={(e) => setForm({ ...form, targetClassId: e.target.value })}>
                <option value="">— Pilih —</option>
                {targetClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Tipe enrollment">
            <select value={form.enrollmentType} onChange={(e) => setForm({ ...form, enrollmentType: e.target.value as "PROMOTED" | "REPEATED" })}>
              <option value="PROMOTED">Naik kelas</option>
              <option value="REPEATED">Tinggal kelas</option>
            </select>
          </Field>
          <div className="btn-row">
            <Button type="submit" disabled={busy}>{busy ? "Memproses..." : "Jalankan promosi"}</Button>
          </div>
        </form>
      </Card>

      {result && (
        <Card title="Hasil promosi">
          <div className="btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
            <span className="badge green">Dibuat: {result.created}</span>
            <span className="badge gray">Dilewati: {result.skipped}</span>
            <span className={result.errors.length > 0 ? "badge red" : "badge gray"}>Error: {result.errors.length}</span>
          </div>
          {result.errors.length === 0 ? (
            <EmptyState text="Tidak ada error." />
          ) : (
            <pre className="debug">{JSON.stringify(result.errors, null, 2)}</pre>
          )}
        </Card>
      )}
    </>
  );
}
