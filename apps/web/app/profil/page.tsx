"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserProfile } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useAuth, useRequireAuth } from "@/components/auth";
import { Alert, Button, Card, Field, PageHeader, Spinner } from "@/components/ui";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Superadmin",
  TEACHER: "Guru",
  PARENT: "Wali Murid",
};

export default function ProfilPage() {
  const { loading: authLoading } = useRequireAuth();
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api().profile.get();
      setProfile(p);
      setFullName(p.fullName);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveName() {
    setNameMsg(null);
    const nama = fullName.trim();
    if (nama.length < 3) {
      setNameMsg({ kind: "error", text: "Nama lengkap minimal 3 karakter." });
      return;
    }
    setSavingName(true);
    try {
      const p = await api().profile.update({ fullName: nama });
      setProfile(p);
      await refresh();
      setNameMsg({ kind: "success", text: "Nama berhasil diperbarui." });
    } catch (err) {
      setNameMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    setPwMsg(null);
    if (!currentPassword) {
      setPwMsg({ kind: "error", text: "Password saat ini wajib diisi." });
      return;
    }
    if (newPassword.length < 8) {
      setPwMsg({ kind: "error", text: "Password baru minimal 8 karakter." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ kind: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    setSavingPw(true);
    try {
      const r = await api().profile.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg({ kind: "success", text: r.message });
    } catch (err) {
      setPwMsg({ kind: "error", text: errorMessage(err, "Password saat ini salah.") });
    } finally {
      setSavingPw(false);
    }
  }

  if (authLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Profil" subtitle="Kelola data profil dan password akun Anda" />
      <Card title="Data Profil">
        <Alert kind="error">{profile ? "" : "Gagal memuat profil."}</Alert>
        {profile && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <div><strong>Sekolah:</strong> {profile.schoolName}</div>
            <div><strong>Email:</strong> {profile.email}</div>
            <div><strong>Peran:</strong> {ROLE_LABEL[profile.role] ?? profile.role}</div>
            <div><strong>Status:</strong> {profile.isActive ? "Aktif" : "Nonaktif"}</div>
          </div>
        )}
        <Field label="Nama lengkap">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nama lengkap"
            maxLength={100}
          />
        </Field>
        <Alert kind={nameMsg?.kind ?? "error"}>{nameMsg?.text ?? ""}</Alert>
        <Button onClick={() => void saveName()} disabled={savingName}>
          {savingName ? "Menyimpan..." : "Simpan Nama"}
        </Button>
      </Card>

      <Card title="Ubah Password">
        <Field label="Password saat ini">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Password saat ini"
            autoComplete="current-password"
          />
        </Field>
        <Field label="Password baru" hint="Minimal 8 karakter">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Password baru"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Konfirmasi password baru">
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password baru"
            autoComplete="new-password"
          />
        </Field>
        <Alert kind={pwMsg?.kind ?? "error"}>{pwMsg?.text ?? ""}</Alert>
        <Button onClick={() => void savePassword()} disabled={savingPw}>
          {savingPw ? "Menyimpan..." : "Ubah Password"}
        </Button>
      </Card>
    </>
  );
}
