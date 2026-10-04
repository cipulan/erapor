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
  /** Nama ikon SVG yang ditampilkan di sidebar. */
  icon: string;
  /** Untuk submenu tab di halaman yang sama (mis. /pengguna?tab=guru). */
  tab?: "guru" | "wali" | "superadmin";
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Ikon garis (line icon) untuk menu sidebar — tanpa emoji. */
const ICON_PATHS: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 4 4-4L16.5 3.5z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};

function NavIcon({ name, size = 17 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] ?? "" }}
    />
  );
}

const NAV: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["SUPERADMIN", "TEACHER", "PARENT"] },
      { href: "/profil", label: "Profil", icon: "user", roles: ["SUPERADMIN", "TEACHER", "PARENT"] },
    ],
  },
  {
    title: "Pengguna",
    items: [
      { href: "/pengguna", tab: "guru", label: "Guru", icon: "briefcase", roles: ["SUPERADMIN"] },
      { href: "/pengguna", tab: "wali", label: "Wali", icon: "heart", roles: ["SUPERADMIN"] },
      { href: "/pengguna", tab: "superadmin", label: "Superadmin", icon: "shield", roles: ["SUPERADMIN"] },
    ],
  },
  {
    title: "Akademik",
    items: [
      { href: "/tahun-ajaran", label: "Tahun Ajaran", icon: "calendar", roles: ["SUPERADMIN"] },
      { href: "/siswa", label: "Siswa", icon: "users", roles: ["SUPERADMIN"] },
      { href: "/wali", label: "Wali Siswa", icon: "home", roles: ["SUPERADMIN"] },
      { href: "/kelas", label: "Kelas", icon: "layers", roles: ["SUPERADMIN"] },
    ],
  },
  {
    title: "Kurikulum",
    items: [
      { href: "/mapel", label: "Mata Pelajaran", icon: "book", roles: ["SUPERADMIN"] },
      { href: "/penugasan", label: "Penugasan Guru", icon: "clipboard", roles: ["SUPERADMIN"] },
    ],
  },
  {
    title: "Penilaian",
    items: [
      { href: "/kategori", label: "Kategori Penilaian", icon: "tag", roles: ["SUPERADMIN"] },
      { href: "/skema-nilai", label: "Skema Nilai", icon: "chart", roles: ["SUPERADMIN"] },
      { href: "/kktp", label: "KKTP", icon: "target", roles: ["SUPERADMIN"] },
      { href: "/penilaian", label: "Penilaian", icon: "edit", roles: ["SUPERADMIN", "TEACHER"] },
      { href: "/preview-nilai", label: "Preview Nilai", icon: "eye", roles: ["SUPERADMIN", "TEACHER"] },
    ],
  },
  {
    title: "Rapor",
    items: [
      { href: "/rapor", label: "Rapor", icon: "file", roles: ["SUPERADMIN", "TEACHER", "PARENT"] },
      { href: "/kenaikan-kelas", label: "Kenaikan Kelas", icon: "trend", roles: ["SUPERADMIN"] },
    ],
  },
  {
    title: "Lainnya",
    items: [{ href: "/audit", label: "Audit Log", icon: "clock", roles: ["SUPERADMIN"] }],
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
          <div className="brand-logo">
            <NavIcon name="dashboard" size={20} />
          </div>
          <div>
            <h1>eRapor</h1>
            <small>Sistem Nilai &amp; Rapor SD</small>
          </div>
        </div>
        <nav className="nav">
          <Suspense>
            <NavLinks groups={groups} onNavigate={() => setNavOpen(false)} />
          </Suspense>
        </nav>
        <div className="sidebar-foot">
          <div className="foot-user">
            <div className="foot-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
            <div className="foot-meta">
              <div><strong>{user.fullName}</strong></div>
              <div>{ROLE_LABEL[user.role]} · {user.email}</div>
            </div>
          </div>
          <button onClick={() => void logout()} className="btn-logout">
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
          <div className="user-chip">
            <div className="user-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
            <span>{user.fullName.split(" ")[0]}</span>
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
                <span className="nav-ico">
                  <NavIcon name={i.icon} />
                </span>
                <span>{i.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
