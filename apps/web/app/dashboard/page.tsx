"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardStats, UserProfile } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Spinner } from "@/components/ui";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return String(n).replace(".", ",");
}

const CARD: React.CSSProperties = {
  background: "#fff",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 8px 24px rgba(0,0,0,.06)",
};

function Donut({ percent }: { percent: number | null }) {
  const C = 439.8;
  const p = percent ?? 0;
  return (
    <svg width="168" height="168" viewBox="0 0 170 170">
      <circle cx="85" cy="85" r="70" fill="none" stroke="#fef3c7" strokeWidth="20" />
      <circle
        cx="85" cy="85" r="70" fill="none" stroke="#10b981" strokeWidth="20"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p / 100)}
        transform="rotate(-90 85 85)"
      />
      <text x="85" y="82" textAnchor="middle" fontSize="30" fontWeight="800" fill="#1e293b">
        {percent === null ? "—" : `${fmt(percent)}%`}
      </text>
      <text x="85" y="105" textAnchor="middle" fontSize="13" fill="#64748b">🎉</text>
    </svg>
  );
}

function KpiCard({ icon, value, label, sub, gradient }: {
  icon: string; value: string; label: string; sub: string; gradient: string;
}) {
  return (
    <div style={{ ...CARD, background: gradient, color: "#fff", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -30, top: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.14)" }} />
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.92, margin: "2px 0 8px" }}>{label}</div>
      <span style={{ display: "inline-block", background: "rgba(255,255,255,.22)", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{sub}</span>
    </div>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800 }}>{children}</h3>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8" }}>{sub}</div>}
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function AdminDashboard({ userName }: { userName: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([api().dashboard.stats(), api().profile.get()]);
        setStats(s);
        setProfile(p);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;

  const firstName = userName.split(" ")[0];
  const period = stats?.academicYear
    ? `${stats.academicYear.name}${stats.semester ? ` · ${stats.semester.name}` : ""}`
    : "Belum ada tahun ajaran aktif";

  return (
    <>
      <div style={{
        background: "linear-gradient(120deg, #4f46e5, #7c3aed 55%, #a855f7)",
        borderRadius: 28, padding: "28px 32px", color: "#fff",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 20, boxShadow: "0 12px 32px rgba(124,58,237,.3)", flexWrap: "wrap", gap: 14,
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>👋 Halo, {firstName}!</h2>
          <p style={{ fontSize: 13, opacity: 0.85 }}>
            {profile?.schoolName ?? "eRapor"} · {period} · Berikut ringkasan sekolahmu hari ini
          </p>
        </div>
        <div style={{
          background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)",
          padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700,
        }}>
          ⭐ Superadmin
        </div>
      </div>

      <Alert kind="error">{error}</Alert>
      {stats && !stats.academicYear && (
        <Alert kind="info">Belum ada tahun ajaran aktif. Aktifkan tahun ajaran di menu Tahun Ajaran untuk melihat statistik lengkap.</Alert>
      )}

      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        <KpiCard icon="🧒" value={String(stats?.totals.students ?? 0)} label="Total Siswa" sub="siswa aktif" gradient="linear-gradient(135deg,#6366f1,#8b5cf6)" />
        <KpiCard icon="👩‍🏫" value={String(stats?.totals.teachers ?? 0)} label="Guru Aktif" sub="guru mengajar" gradient="linear-gradient(135deg,#0ea5e9,#22d3ee)" />
        <KpiCard icon="📈" value={fmt(stats?.avgScore)} label="Rata-rata Nilai" sub="nilai akhir rapor" gradient="linear-gradient(135deg,#f59e0b,#f97316)" />
        <KpiCard icon="🎯" value={stats?.kktp.percent == null ? "—" : `${fmt(stats.kktp.percent)}%`} label="Ketuntasan KKTP" sub="siswa tuntas" gradient="linear-gradient(135deg,#10b981,#34d399)" />
      </div>

      <div className="grid cols-2 dash-stack" style={{ marginBottom: 20 }}>
        <div style={CARD}>
          <SectionTitle sub="Rata-rata nilai akhir · semester berjalan">🏆 Peringkat Mata Pelajaran</SectionTitle>
          {(!stats || stats.avgPerSubject.length === 0) && (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Belum ada nilai rapor pada semester ini.</p>
          )}
          {stats?.avgPerSubject.slice(0, 7).map((s, i) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11, fontSize: 13 }}>
              <span style={{ width: 100, fontWeight: 700, color: "#475569", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name}</span>
              <div style={{ flex: 1, height: 22, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 999, width: `${Math.min(100, s.avg)}%`,
                  background: i < 3 ? "linear-gradient(90deg,#a78bfa,#7c3aed)" : i < 5 ? "linear-gradient(90deg,#60a5fa,#3b82f6)" : "linear-gradient(90deg,#fbbf24,#f59e0b)",
                  display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, fontSize: 13,
                }}>
                  {i < 3 ? MEDALS[i] : ""}
                </div>
              </div>
              <span style={{ width: 40, textAlign: "right", fontWeight: 800, flexShrink: 0 }}>{fmt(s.avg)}</span>
            </div>
          ))}
        </div>
        <div style={{ ...CARD, textAlign: "center" }}>
          <div style={{ textAlign: "left" }}>
            <SectionTitle sub="Ambang KKTP · seluruh mapel">🎯 Ketuntasan KKTP</SectionTitle>
          </div>
          <Donut percent={stats?.kktp.percent ?? null} />
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 10 }}>
            <strong style={{ color: "#10b981" }}>{stats?.kktp.achieved ?? 0} tuntas</strong>
            {" · "}{stats?.kktp.notAchieved ?? 0} perlu bimbingan
          </div>
        </div>
      </div>

      <div className="grid cols-3 dash-stack" style={{ marginBottom: 20 }}>
        <div style={CARD}>
          <SectionTitle sub={`${Object.values(stats?.reportsByStatus ?? {}).reduce((a, b) => a + b, 0)} rapor semester ini`}>📄 Perjalanan Rapor</SectionTitle>
          <div className="dash-pipe">
            {[
              { n: stats?.reportsByStatus.DRAFT ?? 0, l: "📝 Draft", g: "linear-gradient(135deg,#94a3b8,#64748b)" },
              { n: stats?.reportsByStatus.REVIEW ?? 0, l: "👀 Review", g: "linear-gradient(135deg,#fbbf24,#f59e0b)" },
              { n: stats?.reportsByStatus.LOCKED ?? 0, l: "🔒 Terkunci", g: "linear-gradient(135deg,#a78bfa,#8b5cf6)" },
              { n: stats?.reportsByStatus.PUBLISHED ?? 0, l: "🚀 Terbit", g: "linear-gradient(135deg,#34d399,#10b981)" },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: "center", borderRadius: 18, padding: "14px 6px", color: "#fff", background: s.g }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{s.n}</div>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <SectionTitle sub="Menu favorit">⚡ Jalan Pintas</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { href: "/penilaian", t: "📝 Penilaian", d: "Input nilai", g: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
                { href: "/rapor", t: "📄 Rapor", d: "Terbitkan", g: "linear-gradient(135deg,#0ea5e9,#22d3ee)" },
                { href: "/siswa", t: "👥 Siswa", d: "Data siswa", g: "linear-gradient(135deg,#f59e0b,#f97316)" },
                { href: "/kktp", t: "🎯 KKTP", d: "Ambang", g: "linear-gradient(135deg,#10b981,#34d399)" },
              ].map((l) => (
                <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
                  <div style={{ borderRadius: 18, padding: 14, color: "#fff", background: l.g, fontSize: 13, fontWeight: 800 }}>
                    {l.t}<div style={{ fontWeight: 600, opacity: 0.85, fontSize: 11.5, marginTop: 2 }}>{l.d}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div style={CARD}>
          <SectionTitle sub="Rata-rata nilai akhir">🏫 Kelas Teratas</SectionTitle>
          {(!stats || stats.avgPerClass.length === 0) && (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Belum ada data kelas.</p>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px" }}>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #f1f5f9" }}></th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #f1f5f9" }}>Kelas</th>
                <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid #f1f5f9" }}>Avg</th>
              </tr>
            </thead>
            <tbody>
              {stats?.avgPerClass.slice(0, 4).map((c, i) => (
                <tr key={c.classId}>
                  <td style={{ padding: "9px 10px", borderTop: "1px solid #f8fafc" }}>{MEDALS[i] ?? `${i + 1}️⃣`}</td>
                  <td style={{ padding: "9px 10px", borderTop: "1px solid #f8fafc" }}>
                    <strong>{c.name}</strong>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.studentCount} siswa</div>
                  </td>
                  <td style={{ padding: "9px 10px", borderTop: "1px solid #f8fafc", textAlign: "right" }}>
                    <strong>{fmt(c.avg)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats && stats.avgPerClass.length > 0 && stats.avgPerClass[0].avg !== null && (
            <div style={{ marginTop: 12, background: "#f0fdf4", borderRadius: 14, padding: 12, fontSize: 12.5, color: "#166534" }}>
              💡 <strong>Tips:</strong> {stats.avgPerClass[0].name} memimpin dengan rata-rata {fmt(stats.avgPerClass[0].avg)} — pertahankan!
            </div>
          )}
        </div>
        <div style={CARD}>
          <SectionTitle sub="Aktivitas sekolah">🔔 Kabar Terbaru</SectionTitle>
          {(!stats || stats.recentActivity.length === 0) && (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Belum ada aktivitas tercatat.</p>
          )}
          {stats?.recentActivity.map((a) => (
            <div key={a.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "2px solid #f8fafc", fontSize: 13, alignItems: "flex-start" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 12, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              }}>
                {a.actorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{a.actorName}</strong> {a.label}
                <div style={{ color: "#94a3b8", fontSize: 11 }}>{timeAgo(a.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TeacherDashboard({ userName }: { userName: string }) {
  const [assessments, setAssessments] = useState<{ status: string }[]>([]);
  useEffect(() => {
    api().assessments.list().then((a) => setAssessments(a)).catch(() => {});
  }, []);
  const firstName = userName.split(" ")[0];
  const published = assessments.filter((a) => a.status === "PUBLISHED").length;
  const draft = assessments.filter((a) => a.status === "DRAFT").length;
  const links = [
    { href: "/penilaian", t: "📝 Penilaian", d: "Kelola assessment & nilai", g: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
    { href: "/preview-nilai", t: "👀 Preview Nilai", d: "Lihat status nilai siswa", g: "linear-gradient(135deg,#0ea5e9,#22d3ee)" },
    { href: "/rapor", t: "📄 Rapor", d: "Review rapor kelas", g: "linear-gradient(135deg,#10b981,#34d399)" },
  ];
  return (
    <>
      <div style={{
        background: "linear-gradient(120deg, #0ea5e9, #3b82f6 60%, #6366f1)",
        borderRadius: 28, padding: "28px 32px", color: "#fff",
        marginBottom: 20, boxShadow: "0 12px 32px rgba(59,130,246,.3)",
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>👋 Halo, {firstName}!</h2>
        <p style={{ fontSize: 13, opacity: 0.85 }}>Semangat mengajar hari ini — berikut ringkasan penilaianmu</p>
      </div>
      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <KpiCard icon="📝" value={String(assessments.length)} label="Assessment Saya" sub="total assessment" gradient="linear-gradient(135deg,#6366f1,#8b5cf6)" />
        <KpiCard icon="🚀" value={String(published)} label="Dipublish" sub="siap dinilai" gradient="linear-gradient(135deg,#0ea5e9,#22d3ee)" />
        <KpiCard icon="📝" value={String(draft)} label="Draft" sub="belum dipublish" gradient="linear-gradient(135deg,#f59e0b,#f97316)" />
      </div>
      <div style={CARD}>
        <SectionTitle sub="Aksi cepat">⚡ Jalan Pintas</SectionTitle>
        <div className="dash-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
              <div style={{ borderRadius: 18, padding: 14, color: "#fff", background: l.g, fontSize: 13, fontWeight: 800 }}>
                {l.t}<div style={{ fontWeight: 600, opacity: 0.85, fontSize: 11.5, marginTop: 2 }}>{l.d}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

function ParentDashboard({ userName }: { userName: string }) {
  const [children, setChildren] = useState<{ id: string; fullName: string }[]>([]);
  useEffect(() => {
    api().students.list({ limit: 50 }).then((r) => setChildren(r.data)).catch(() => {});
  }, []);
  const firstName = userName.split(" ")[0];
  return (
    <>
      <div style={{
        background: "linear-gradient(120deg, #10b981, #34d399 60%, #22d3ee)",
        borderRadius: 28, padding: "28px 32px", color: "#fff",
        marginBottom: 20, boxShadow: "0 12px 32px rgba(16,185,129,.3)",
      }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>👋 Halo, {firstName}!</h2>
        <p style={{ fontSize: 13, opacity: 0.85 }}>Pantau perkembangan belajar putra-putri Anda di sini</p>
      </div>
      <div style={CARD}>
        <SectionTitle sub="Klik untuk melihat rapor">🧒 Anak Saya</SectionTitle>
        {children.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Belum ada data anak yang terhubung dengan akun ini.</p>
        ) : (
          <div className="dash-links">
            {children.map((s, i) => (
              <Link key={s.id} href={`/rapor?studentId=${s.id}`} style={{ textDecoration: "none" }}>
                <div style={{
                  borderRadius: 18, padding: 18, color: "#fff", fontWeight: 800, fontSize: 14,
                  background: [
                    "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    "linear-gradient(135deg,#0ea5e9,#22d3ee)",
                    "linear-gradient(135deg,#f59e0b,#f97316)",
                    "linear-gradient(135deg,#10b981,#34d399)",
                    "linear-gradient(135deg,#ec4899,#f472b6)",
                  ][i % 5],
                }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>🎒</div>
                  {s.fullName}
                  <div style={{ fontWeight: 600, opacity: 0.85, fontSize: 12, marginTop: 4 }}>Lihat rapor →</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  if (loading || !user) return <Spinner />;
  return (
    <>
      {user.role === "SUPERADMIN" && <AdminDashboard userName={user.fullName} />}
      {user.role === "TEACHER" && <TeacherDashboard userName={user.fullName} />}
      {user.role === "PARENT" && <ParentDashboard userName={user.fullName} />}
    </>
  );
}
