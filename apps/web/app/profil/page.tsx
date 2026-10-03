"use client";

import { useCallback, useEffect, useState } from "react";
import type { SchoolProfile, UserProfile } from "@erapor/api-client";
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

  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [schoolForm, setSchoolForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    headmasterName: "",
    headmasterNip: "",
  });
  const [savingSchool, setSavingSchool] = useState(false);
  const [schoolMsg, setSchoolMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api().profile.get();
      setProfile(p);
      setFullName(p.fullName);
      if (p.role === "SUPERADMIN") {
        try {
          const s = await api().school.get();
          setSchool(s);
          setSchoolForm({
            name: s.name,
            address: s.address ?? "",
            phone: s.phone ?? "",
            email: s.email ?? "",
            headmasterName: s.headmasterName ?? "",
            headmasterNip: s.headmasterNip ?? "",
          });
        } catch {
          setSchool(null);
        }
      }
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

  async function saveSchool() {
    setSchoolMsg(null);
    if (schoolForm.name.trim().length < 3) {
      setSchoolMsg({ kind: "error", text: "Nama sekolah minimal 3 karakter." });
      return;
    }
    setSavingSchool(true);
    try {
      const s = await api().school.update({
        name: schoolForm.name.trim(),
        address: schoolForm.address,
        phone: schoolForm.phone,
        email: schoolForm.email,
        headmasterName: schoolForm.headmasterName,
        headmasterNip: schoolForm.headmasterNip,
      });
      setSchool(s);
      setSchoolMsg({ kind: "success", text: "Data sekolah berhasil diperbarui." });
    } catch (err) {
      setSchoolMsg({ kind: "error", text: errorMessage(err) });
    } finally {
      setSavingSchool(false);
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

      {profile?.role === "SUPERADMIN" && (
        <Card
          title="Data Sekolah"
          actions={<span className="badge green">Khusus Superadmin</span>}
        >
          <Alert kind="error">{school ? "" : "Gagal memuat data sekolah."}</Alert>
          <Field label="Nama sekolah">
            <input
              type="text"
              value={schoolForm.name}
              onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
              placeholder="Nama sekolah"
              maxLength={120}
            />
          </Field>
          <Field label="Alamat">
            <input
              type="text"
              value={schoolForm.address}
              onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
              placeholder="Alamat sekolah"
              maxLength={200}
            />
          </Field>
          <div className="form-row">
            <Field label="Telepon">
              <input
                type="text"
                value={schoolForm.phone}
                onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                placeholder="Nomor telepon"
                maxLength={30}
              />
            </Field>
            <Field label="Email sekolah">
              <input
                type="email"
                value={schoolForm.email}
                onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                placeholder="Email sekolah"
                maxLength={120}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Nama kepala sekolah" hint="Nama ini tercetak sebagai penandatangan di rapor PDF.">
              <input
                type="text"
                value={schoolForm.headmasterName}
                onChange={(e) => setSchoolForm({ ...schoolForm, headmasterName: e.target.value })}
                placeholder="Nama kepala sekolah"
                maxLength={100}
              />
            </Field>
            <Field label="NIP kepala sekolah">
              <input
                type="text"
                value={schoolForm.headmasterNip}
                onChange={(e) => setSchoolForm({ ...schoolForm, headmasterNip: e.target.value })}
                placeholder="NIP kepala sekolah"
                maxLength={30}
              />
            </Field>
          </div>
          <Alert kind={schoolMsg?.kind ?? "error"}>{schoolMsg?.text ?? ""}</Alert>
          <Button onClick={() => void saveSchool()} disabled={savingSchool}>
            {savingSchool ? "Menyimpan..." : "Simpan Data Sekolah"}
          </Button>
        </Card>
      )}

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
