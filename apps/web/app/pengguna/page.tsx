"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ManageableRole, UserItem, UserRole } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDateTime } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import {
  Alert, Badge, Button, Card, CopyButton, EmptyState, Field, Modal,
  PageHeader, Pagination, Spinner,
} from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";

type Tab = UserRole;
const TABS: { key: Tab; label: string }[] = [
  { key: "TEACHER", label: "Guru" },
  { key: "PARENT", label: "Wali" },
  { key: "SUPERADMIN", label: "Superadmin" },
];
const TAB_PARAM: Record<Tab, string> = { TEACHER: "guru", PARENT: "wali", SUPERADMIN: "superadmin" };

function randomPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export default function PenggunaPage() {
  return (
    <Suspense fallback={<div className="card"><Spinner /></div>}>
      <PenggunaInner />
    </Suspense>
  );
}

function PenggunaInner() {
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const tabFromUrl: Tab = tabParam === "wali" ? "PARENT" : tabParam === "superadmin" ? "SUPERADMIN" : "TEACHER";
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [rows, setRows] = useState<UserItem[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (role: Tab, keyword: string, p: number) => {
    setLoading(true);
    setError(""); setSuccess("");
    try {
      const r = await api().users.list({ role, q: keyword || undefined, page: p, limit: 20 });
      setRows(r.data);
      setMeta({ total: r.meta.total, totalPages: r.meta.totalPages });
      setPage(r.meta.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab, q, 1); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sinkron tab dengan ?tab= di URL (dipakai link submenu navigasi).
  useEffect(() => {
    setTab(tabFromUrl);
    setQ("");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  function switchTab(t: Tab) {
    router.replace(`/pengguna?tab=${TAB_PARAM[t]}`);
  }

  // ---------- modal tambah ----------
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPw, setAddPw] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState("");
  const [addResult, setAddResult] = useState<string | null>(null);

  function openAdd() {
    setAddName(""); setAddEmail(""); setAddPw("");
    setAddError(""); setAddResult(null);
    setShowAdd(true);
  }

  async function submitAdd() {
    setAddError("");
    if (addName.trim().length < 3) { setAddError("Nama lengkap minimal 3 karakter."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.trim())) { setAddError("Format email tidak valid."); return; }
    if (addPw && addPw.length < 8) { setAddError("Password minimal 8 karakter."); return; }
    setAddBusy(true);
    try {
      const r = await api().users.create({
        fullName: addName.trim(),
        email: addEmail.trim(),
        role: tab as ManageableRole,
        ...(addPw ? { password: addPw } : {}),
      });
      setAddResult(r.generatedPassword ?? null);
      if (!r.generatedPassword) setShowAdd(false);
      void load(tab, q, 1);
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAddBusy(false);
    }
  }

  // ---------- modal reset password ----------
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);

  function openReset(u: UserItem) {
    setResetTarget(u); setResetPw("");
    setResetError(""); setResetResult(null);
  }

  async function submitReset() {
    if (!resetTarget) return;
    setResetError("");
    if (resetPw && resetPw.length < 8) { setResetError("Password minimal 8 karakter."); return; }
    setResetBusy(true);
    try {
      const r = await api().users.resetPassword(resetTarget.id, resetPw ? { newPassword: resetPw } : {});
      setResetResult(r.generatedPassword ?? null);
      if (!r.generatedPassword) setResetTarget(null);
    } catch (err) {
      setResetError(errorMessage(err));
    } finally {
      setResetBusy(false);
    }
  }

  // ---------- modal ubah akun ----------
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  function openEdit(u: UserItem) {
    setEditTarget(u);
    setEditName(u.fullName);
    setEditEmail(u.email);
    setEditError("");
  }

  async function submitEdit() {
    if (!editTarget) return;
    setEditError("");
    const fullName = editName.trim();
    const email = editEmail.trim();
    if (fullName.length < 3) { setEditError("Nama lengkap minimal 3 karakter."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setEditError("Format email tidak valid."); return; }
    const data: { fullName?: string; email?: string } = {};
    if (fullName !== editTarget.fullName) data.fullName = fullName;
    if (email.toLowerCase() !== editTarget.email.toLowerCase()) data.email = email;
    if (Object.keys(data).length === 0) { setEditError("Tidak ada perubahan."); return; }
    setEditBusy(true);
    try {
      await api().users.updateProfile(editTarget.id, data);
      setEditTarget(null);
      setSuccess(`Akun ${tabLabel} berhasil diubah.`);
      void load(tab, q, page);
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setEditBusy(false);
    }
  }

  // ---------- nonaktif/aktifkan ----------
  const [confirmTarget, setConfirmTarget] = useState<UserItem | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function submitToggle() {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      await api().users.setActive(confirmTarget.id, !confirmTarget.isActive);
      setConfirmTarget(null);
      void load(tab, q, page);
    } catch (err) {
      setError(errorMessage(err));
      setConfirmTarget(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  // ---------- modal ubah role (promote/demote) ----------
  const [roleTarget, setRoleTarget] = useState<UserItem | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState("");

  function openRole(u: UserItem) {
    setRoleTarget(u);
    setRoleError("");
  }

  async function submitRole(newRole: UserRole) {
    if (!roleTarget) return;
    setRoleError("");
    setRoleBusy(true);
    try {
      await api().users.updateRole(roleTarget.id, { role: newRole });
      setRoleTarget(null);
      setSuccess(`Role ${roleTarget.fullName} berhasil diubah.`);
      void load(tab, q, page);
    } catch (err) {
      setRoleError(errorMessage(err));
    } finally {
      setRoleBusy(false);
    }
  }

  if (authLoading) return <Spinner />;
  const tabLabel = tab === "TEACHER" ? "guru" : tab === "PARENT" ? "wali" : "superadmin";

  return (
    <>
      <PageHeader
        title="Pengguna"
        subtitle="Kelola akun guru dan wali — hanya superadmin"
        actions={tab === "SUPERADMIN" ? undefined : <Button onClick={openAdd}>+ Tambah {tab === "TEACHER" ? "Guru" : "Wali"}</Button>}
      />
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? "primary" : "secondary"}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card>
        <div className="toolbar">
          <Field label="Pencarian">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama atau email..."
              onKeyDown={(e) => { if (e.key === "Enter") void load(tab, q, 1); }}
            />
          </Field>
          <Button variant="secondary" onClick={() => void load(tab, q, 1)}>Cari</Button>
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState text={`Belum ada akun ${tabLabel}.`} /> : (
          <ResponsiveTable<UserItem>
            columns={[
              { key: "fullName", label: "Nama", render: (u) => u.fullName },
              { key: "role", label: "Role", render: (u) => <Badge status={u.role} /> },
              { key: "email", label: "Email", render: (u) => <span className="small">{u.email}</span> },
              { key: "status", label: "Status", render: (u) => <Badge status={u.isActive ? "ACTIVE" : "INACTIVE"} /> },
              { key: "lastLoginAt", label: "Login terakhir", render: (u) => <span className="small">{formatDateTime(u.lastLoginAt)}</span> },
              {
                key: "aksi", label: "Aksi",
                render: (u) => (
                  <div className="btn-row">
                    <Button small variant="secondary" onClick={() => openEdit(u)}>Ubah</Button>
                    {u.role === "SUPERADMIN" ? (
                      <Button small variant="secondary" onClick={() => openRole(u)}>Turunkan Role</Button>
                    ) : (
                      <Button small variant="secondary" onClick={() => openRole(u)}>Jadikan Superadmin</Button>
                    )}
                    <Button small variant="secondary" onClick={() => openReset(u)}>Reset password</Button>
                    <Button
                      small
                      variant={u.isActive ? "warn" : "success"}
                      onClick={() => setConfirmTarget(u)}
                    >
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={rows}
            rowKey={(u) => u.id}
            title={(u) => u.fullName}
            subtitle={(u) => u.email}
          />
        )}
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPage={(p) => void load(tab, q, p)} />
      </Card>

      {showAdd && (
        <Modal title={`Tambah ${tab === "TEACHER" ? "Guru" : "Wali"}`} onClose={() => { if (!addBusy) setShowAdd(false); }}>
          {addResult ? (
            <>
              <Alert kind="success">Akun berhasil dibuat. Simpan password ini — hanya ditampilkan sekali:</Alert>
              <div className="toolbar">
                <code style={{ fontSize: 18, letterSpacing: 1 }}>{addResult}</code>
                <CopyButton text={addResult} />
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <Button onClick={() => setShowAdd(false)}>Selesai</Button>
              </div>
            </>
          ) : (
            <>
              <Field label="Nama lengkap">
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Nama lengkap" maxLength={100} />
              </Field>
              <Field label="Email">
                <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="nama@sekolah.id" />
              </Field>
              <Field label="Password" hint="Kosongkan agar dibuat otomatis oleh server. Minimal 8 karakter bila diisi manual.">
                <div className="toolbar">
                  <input
                    type="text"
                    value={addPw}
                    onChange={(e) => setAddPw(e.target.value)}
                    placeholder="(opsional)"
                    autoComplete="new-password"
                  />
                  <Button variant="secondary" onClick={() => setAddPw(randomPassword())}>Generate</Button>
                </div>
              </Field>
              <Alert kind="error">{addError}</Alert>
              <div className="btn-row">
                <Button onClick={() => void submitAdd()} disabled={addBusy}>{addBusy ? "Menyimpan..." : "Buat Akun"}</Button>
                <Button variant="secondary" onClick={() => setShowAdd(false)} disabled={addBusy}>Batal</Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset password — ${resetTarget.fullName}`} onClose={() => { if (!resetBusy) setResetTarget(null); }}>
          {resetResult ? (
            <>
              <Alert kind="success">Password baru berhasil dibuat. Simpan — hanya ditampilkan sekali:</Alert>
              <div className="toolbar">
                <code style={{ fontSize: 18, letterSpacing: 1 }}>{resetResult}</code>
                <CopyButton text={resetResult} />
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <Button onClick={() => setResetTarget(null)}>Selesai</Button>
              </div>
            </>
          ) : (
            <>
              <Alert kind="info">Semua sesi login pengguna ini akan dicabut.</Alert>
              <Field label="Password baru" hint="Kosongkan agar dibuat otomatis oleh server. Minimal 8 karakter bila diisi manual.">
                <div className="toolbar">
                  <input
                    type="text"
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    placeholder="(opsional)"
                    autoComplete="new-password"
                  />
                  <Button variant="secondary" onClick={() => setResetPw(randomPassword())}>Generate</Button>
                </div>
              </Field>
              <Alert kind="error">{resetError}</Alert>
              <div className="btn-row">
                <Button variant="warn" onClick={() => void submitReset()} disabled={resetBusy}>{resetBusy ? "Memproses..." : "Reset Password"}</Button>
                <Button variant="secondary" onClick={() => setResetTarget(null)} disabled={resetBusy}>Batal</Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {editTarget && (
        <Modal title={`Ubah akun — ${editTarget.fullName}`} onClose={() => { if (!editBusy) setEditTarget(null); }}>
          <Field label="Nama lengkap">
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} />
          </Field>
          <Field label="Email">
            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} maxLength={100} />
          </Field>
          <Alert kind="error">{editError}</Alert>
          <div className="btn-row">
            <Button onClick={() => void submitEdit()} disabled={editBusy}>{editBusy ? "Menyimpan..." : "Simpan"}</Button>
            <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={editBusy}>Batal</Button>
          </div>
        </Modal>
      )}

      {confirmTarget && (
        <Modal
          title={confirmTarget.isActive ? "Nonaktifkan akun?" : "Aktifkan akun?"}
          onClose={() => { if (!confirmBusy) setConfirmTarget(null); }}
        >
          <p>
            {confirmTarget.isActive
              ? <>Akun <strong>{confirmTarget.fullName}</strong> ({confirmTarget.email}) tidak akan bisa login lagi dan semua sesinya dicabut.</>
              : <>Akun <strong>{confirmTarget.fullName}</strong> ({confirmTarget.email}) bisa login kembali.</>}
          </p>
          <div className="btn-row">
            <Button
              variant={confirmTarget.isActive ? "danger" : "success"}
              onClick={() => void submitToggle()}
              disabled={confirmBusy}
            >
              {confirmBusy ? "Memproses..." : confirmTarget.isActive ? "Ya, nonaktifkan" : "Ya, aktifkan"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)} disabled={confirmBusy}>Batal</Button>
          </div>
        </Modal>
      )}

      {roleTarget && (
        <Modal
          title={roleTarget.role === "SUPERADMIN" ? `Turunkan role — ${roleTarget.fullName}` : `Jadikan superadmin — ${roleTarget.fullName}`}
          onClose={() => { if (!roleBusy) setRoleTarget(null); }}
        >
          {roleTarget.role === "SUPERADMIN" ? (
            <>
              <p>Akun <strong>{roleTarget.fullName}</strong> ({roleTarget.email}) akan kehilangan akses superadmin. Pilih role baru:</p>
              <Alert kind="error">{roleError}</Alert>
              <div className="btn-row">
                <Button variant="warn" onClick={() => void submitRole("TEACHER")} disabled={roleBusy}>{roleBusy ? "Memproses..." : "Jadikan Guru"}</Button>
                <Button variant="warn" onClick={() => void submitRole("PARENT")} disabled={roleBusy}>{roleBusy ? "Memproses..." : "Jadikan Wali"}</Button>
                <Button variant="secondary" onClick={() => setRoleTarget(null)} disabled={roleBusy}>Batal</Button>
              </div>
            </>
          ) : (
            <>
              <p>Akun <strong>{roleTarget.fullName}</strong> ({roleTarget.email}) akan mendapatkan <strong>akses penuh superadmin</strong> ke seluruh data dan pengaturan sekolah.</p>
              <Alert kind="error">{roleError}</Alert>
              <div className="btn-row">
                <Button onClick={() => void submitRole("SUPERADMIN")} disabled={roleBusy}>{roleBusy ? "Memproses..." : "Ya, Jadikan Superadmin"}</Button>
                <Button variant="secondary" onClick={() => setRoleTarget(null)} disabled={roleBusy}>Batal</Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
