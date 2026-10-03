import Link from "next/link";
import { Card } from "@/components/ui";

export default function AksesDitolak() {
  return (
    <div style={{ maxWidth: 520, margin: "60px auto" }}>
      <Card title="Akses ditolak">
        <p className="muted">
          Akun Anda tidak memiliki izin untuk membuka halaman ini.
          Keamanan ditegakkan di server; hubungi superadmin bila Anda merasa ini keliru.
        </p>
        <div className="btn-row">
          <Link href="/dashboard" className="btn secondary">Kembali ke Dashboard</Link>
        </div>
      </Card>
    </div>
  );
}
