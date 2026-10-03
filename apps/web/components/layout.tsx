"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type UserRole } from "@erapor/api-client";
import { useAuth } from "./auth";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: ["SUPERADMIN", "TEACHER", "PARENT"] },
      { href: "/profil", label: "Profil", roles: ["SUPERADMIN", "TEACHER", "PARENT"] },
    ],
  },
  {
    title: "Akademik",
    items: [
      { href: "/tahun-ajaran", label: "Tahun Ajaran", roles: ["SUPERADMIN"] },
      { href: "/siswa", label: "Siswa", roles: ["SUPERADMIN"] },
      { href: "/wali", label: "Wali", roles: ["SUPERADMIN"] },
      { href: "/kelas", label: "Kelas", roles: ["SUPERADMIN"] },
      { href: "/pengguna", label: "Pengguna", roles: ["SUPERADMIN"] },
    ],
  },
  {
    title: "Kurikulum",
    items: [
      { href: "/mapel", label: "Mata Pelajaran", roles: ["SUPERADMIN"] },
      { href: "/penugasan", label: "Penugasan Guru", roles: ["SUPERADMIN"] },
    ],
  },
  {
    title: "Penilaian",
    items: [
      { href: "/kategori", label: "Kategori Penilaian", roles: ["SUPERADMIN"] },
      { href: "/skema-nilai", label: "Skema Nilai", roles: ["SUPERADMIN"] },
      { href: "/kktp", label: "KKTP", roles: ["SUPERADMIN"] },
      { href: "/penilaian", label: "Penilaian", roles: ["SUPERADMIN", "TEACHER"] },
      { href: "/preview-nilai", label: "Preview Nilai", roles: ["SUPERADMIN", "TEACHER"] },
    ],
  },
  {
    title: "Rapor",
    items: [
      { href: "/rapor", label: "Rapor", roles: ["SUPERADMIN", "TEACHER", "PARENT"] },
      { href: "/kenaikan-kelas", label: "Kenaikan Kelas", roles: ["SUPERADMIN"] },
    ],
  },
  {
    title: "Lainnya",
    items: [{ href: "/audit", label: "Audit Log", roles: ["SUPERADMIN"] }],
  },
];

const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  TEACHER: "Guru",
  PARENT: "Wali Murid",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return <>{children}</>;

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(user.role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>eRapor SD</h1>
          <small>Sistem Nilai &amp; Rapor</small>
        </div>
        <nav className="nav">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="nav-group">{g.title}</div>
              {g.items.map((i) => (
                <Link key={i.href} href={i.href} className={pathname === i.href || pathname.startsWith(i.href + "/") ? "active" : ""}>
                  {i.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div><strong style={{ color: "#fff" }}>{user.fullName}</strong></div>
          <div>{ROLE_LABEL[user.role]} · {user.email}</div>
          <button
            onClick={() => void logout()}
            style={{ marginTop: 8, background: "none", border: "1px solid #3a4f7d", color: "#dbe4f5", borderRadius: 6, padding: "6px 10px", cursor: "pointer", width: "100%" }}
          >
            Keluar
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="who">
            Selamat datang, <strong>{user.fullName}</strong> ({ROLE_LABEL[user.role]})
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
