"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Card, PageHeader, Spinner } from "@/components/ui";

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div className="stat" style={{ cursor: "pointer" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div className="lbl">{desc}</div>
      </div>
    </Link>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState({ siswa: 0, kelas: 0, rapor: 0, raporTerbit: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = api();
        const [s, k, r, rp] = await Promise.all([
          c.students.list({ limit: 1 }),
          c.classes.list({ limit: 1 }),
          c.reports.list({ limit: 1 }),
          c.reports.list({ limit: 1, status: "PUBLISHED" }),
        ]);
        setStats({ siswa: s.meta.total, kelas: k.meta.total, rapor: r.meta.total, raporTerbit: rp.meta.total });
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;
  return (
    <>
      <Alert kind="error">{error}</Alert>
      <div className="grid cols-4">
        <div className="stat"><div className="num">{stats.siswa}</div><div className="lbl">Siswa</div></div>
        <div className="stat"><div className="num">{stats.kelas}</div><div className="lbl">Kelas</div></div>
        <div className="stat"><div className="num">{stats.rapor}</div><div className="lbl">Rapor</div></div>
        <div className="stat"><div className="num">{stats.raporTerbit}</div><div className="lbl">Rapor Terbit</div></div>
      </div>
      <Card title="Jalan pintas">
        <div className="grid cols-3">
          <QuickLink href="/tahun-ajaran" title="Tahun Ajaran" desc="Kelola tahun ajaran & semester" />
          <QuickLink href="/siswa" title="Siswa" desc="Data siswa & enrollment" />
          <QuickLink href="/penilaian" title="Penilaian" desc="Assessment & input nilai" />
          <QuickLink href="/rapor" title="Rapor" desc="Generate, review & terbitkan" />
          <QuickLink href="/skema-nilai" title="Skema Nilai" desc="Bobot kategori & publish" />
          <QuickLink href="/kenaikan-kelas" title="Kenaikan Kelas" desc="Promosi massal" />
        </div>
      </Card>
    </>
  );
}

function TeacherDashboard() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    api().assessments.list().then((a) => setCount(a.length)).catch(() => {});
  }, []);
  return (
    <div className="grid cols-3">
      <div className="stat"><div className="num">{count}</div><div className="lbl">Assessment saya</div></div>
      <QuickLink href="/penilaian" title="Penilaian" desc="Kelola assessment & nilai" />
      <QuickLink href="/preview-nilai" title="Preview Nilai" desc="Lihat status nilai siswa" />
      <QuickLink href="/rapor" title="Rapor" desc="Review rapor kelas" />
    </div>
  );
}

function ParentDashboard() {
  const [children, setChildren] = useState<{ id: string; fullName: string }[]>([]);
  useEffect(() => {
    api().students.list({ limit: 50 }).then((r) => setChildren(r.data)).catch(() => {});
  }, []);
  return (
    <Card title="Anak saya">
      {children.length === 0 ? (
        <p className="muted">Belum ada data anak yang terhubung dengan akun ini.</p>
      ) : (
        <div className="grid cols-3">
          {children.map((s) => (
            <QuickLink key={s.id} href={`/rapor?studentId=${s.id}`} title={s.fullName} desc="Lihat rapor" />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  if (loading || !user) return <Spinner />;
  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Selamat datang, ${user.fullName}`} />
      {user.role === "SUPERADMIN" && <AdminDashboard />}
      {user.role === "TEACHER" && <TeacherDashboard />}
      {user.role === "PARENT" && <ParentDashboard />}
    </>
  );
}
