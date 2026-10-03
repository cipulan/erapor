"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { type UserRole } from "@erapor/api-client";
import { useAuth } from "./auth";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
  /** Untuk submenu tab di halaman yang sama (mis. /pengguna?tab=guru). */
  tab?: "guru" | "wali";
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
    title: "Pengguna",
    items: [
      { href: "/pengguna", tab: "guru", label: "Guru", roles: ["SUPERADMIN"] },
      { href: "/pengguna", tab: "wali", label: "Wali", roles: ["SUPERADMIN"] },
    ],
  },
  {
    title: "Akademik",
    items: [
      { href: "/tahun-ajaran", label: "Tahun Ajaran", roles: ["SUPERADMIN"] },
      { href: "/siswa", label: "Siswa", roles: ["SUPERADMIN"] },
      { href: "/wali", label: "Wali Siswa", roles: ["SUPERADMIN"] },
      { href: "/kelas", label: "Kelas", roles: ["SUPERADMIN"] },
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
  const [navOpen, setNavOpen] = useState(false);

  if (!user) return <>{children}</>;

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(user.role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="shell">
      {navOpen && <div className="backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar${navOpen ? " open" : ""}`}>
        <div className="brand">
          <h1>eRapor SD</h1>
          <small>Sistem Nilai &amp; Rapor</small>
        </div>
        <nav className="nav">
          <Suspense>
            <NavLinks groups={groups} onNavigate={() => setNavOpen(false)} />
          </Suspense>
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
          <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="Buka menu navigasi">
            ☰
          </button>
          <div className="who">
            Selamat datang, <strong>{user.fullName}</strong> ({ROLE_LABEL[user.role]})
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

/** Daftar link navigasi; dibungkus Suspense karena memakai useSearchParams. */
function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "guru";

  return (
    <>
      {groups.map((g) => (
        <div key={g.title}>
          <div className="nav-group">{g.title}</div>
          {g.items.map((i) => {
            const href = i.tab ? `${i.href}?tab=${i.tab}` : i.href;
            const pathOk = pathname === i.href || pathname.startsWith(i.href + "/");
            const active = pathOk && (!i.tab || activeTab === i.tab);
            return (
              <Link
                key={`${i.href}:${i.tab ?? i.label}`}
                href={href}
                className={active ? "active" : ""}
                onClick={onNavigate}
              >
                {i.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
