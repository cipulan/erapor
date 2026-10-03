import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth";
import { AppShell } from "@/components/layout";

export const metadata: Metadata = {
  title: "eRapor SD — Sistem Nilai & Rapor",
  description: "Sistem informasi nilai dan rapor sekolah dasar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
