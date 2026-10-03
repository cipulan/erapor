"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@erapor/api-client";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth";
import { Alert, Button, Field } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      await api().login(email.trim(), password);
      await refresh();
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>eRapor SD</h1>
        <p className="sub">Sistem Nilai &amp; Rapor Sekolah Dasar — silakan masuk.</p>
        <Alert kind="error">{error}</Alert>
        <form onSubmit={onSubmit}>
          <Field label="Email">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@sekolah.id"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Button type="submit" disabled={busy} {...{ style: { width: "100%" } }}>
            {busy ? "Memeriksa..." : "Masuk"}
          </Button>
        </form>
      </div>
    </div>
  );
}
