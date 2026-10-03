"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ApiError, type UserRole, type UserSummary } from "@erapor/api-client";
import { api } from "@/lib/api";

interface AuthState {
  user: UserSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, refresh: async () => {}, logout: async () => {} });

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const me = await api().me();
      setUser(me.user);
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) setUser(null);
      // error lain (mis. server mati): biarkan user lama, jangan paksa logout
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Halaman login tidak perlu cek sesi.
    if (pathname === "/login") {
      setLoading(false);
      return;
    }
    void refresh();
  }, [pathname, refresh]);

  const logout = useCallback(async () => {
    try {
      await api().logout();
    } catch {
      /* abaikan */
    }
    setUser(null);
    window.location.href = "/login";
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

/**
 * Guard halaman: wajib login; bila roles diisi, role harus cocok.
 * Penyembunyian menu per role HANYA untuk UX — keamanan tetap di server.
 */
export function useRequireAuth(roles?: UserRole[]): { user: UserSummary | null; loading: boolean } {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace("/akses-ditolak");
    }
  }, [user, loading, router, roles]);

  return { user, loading };
}
