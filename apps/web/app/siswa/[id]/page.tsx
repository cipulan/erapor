"use client";

import { use, useEffect, useState } from "react";
import type { AcademicYear, ClassItem, Guardian, StudentDetail, StudentEnrollment } from "@erapor/api-client";
import { api } from "@/lib/api";
import { errorMessage, formatDate, formatDateTime } from "@/lib/format";
import { useRequireAuth } from "@/components/auth";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Spinner, EmptyState } from "@/components/ui";
import { ResponsiveTable } from "@/components/responsive-table";

export default function SiswaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: authLoading } = useRequireAuth(["SUPERADMIN"]);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allGuardians, setAllGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showEnroll, setShowEnroll] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ academicYearId: "", classId: "", enrollmentType: "NEW" as "NEW" | "PROMOTED" | "REPEATED" | "TRANSFERRED" });
  const [linkForm, setLinkForm] = useState({ guardianId: "", isPrimary: false });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const c = api();
      const [s, e, g, y, ag] = await Promise.all([
        c.students.get(id),
        c.students.enrollments(id),
        c.students.guardians(id),
        c.academicYears.list({ limit: 50 }),
        c.guardians.list({ limit: 100 }),
      ]);
      setStudent(s);
      setEnrollments(e);
      setGuardians(g);
      setYears(y.data);
      setAllGuardians(ag.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function loadClasses(yearId: string) {
    if (!yearId) { setClasses([]); return; }
    try {
      const r = await api().classes.list({ academicYearId: yearId, limit: 100 });
      setClasses(r.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollForm.academicYearId || !enrollForm.classId) { setError("Tahun ajaran dan kelas wajib dipilih."); return; }
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await api().students.createEnrollment(id, enrollForm);
      setShowEnroll(false);
      setEnrollForm({ academicYearId: "", classId: "", enrollmentType: "NEW" });
      setSuccess("Enrollment berhasil ditambahkan.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkForm.guardianId) { setError("Wali wajib dipilih."); return; }
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await api().students.linkGuardian(id, linkForm);
      setShowLink(false);
      setLinkForm({ guardianId: "", isPrimary: false });
      setSuccess("Wali berhasil ditautkan.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <Spinner />;

  return (
    <>
      <PageHeader title={student?.fullName ?? "Siswa"} subtitle="Detail siswa" />
      <Alert kind="error">{error}</Alert>
      <Alert kind="success">{success}</Alert>

      {student && (
        <Card title="Data diri">
          <dl className="kv">
            <dt>Nama</dt><dd>{student.fullName}</dd>
            <dt>NIS / NISN</dt><dd>{student.nis ?? "-"} / {student.nisn ?? "-"}</dd>
            <dt>Jenis kelamin</dt><dd>{student.gender === "MALE" ? "Laki-laki" : student.gender === "FEMALE" ? "Perempuan" : "-"}</dd>
            <dt>Tempat, tgl lahir</dt><dd>{student.birthPlace ?? "-"}, {formatDate(student.birthDate)}</dd>
            <dt>Status</dt><dd><Badge status={student.status} /></dd>
          </dl>
        </Card>
      )}

      <Card title="Enrollment" actions={<Button small onClick={() => setShowEnroll(true)}>+ Enrollment</Button>}>
        {enrollments.length === 0 ? <EmptyState text="Belum ada enrollment." /> : (
          <ResponsiveTable<StudentEnrollment>
            columns={[
              { key: "year", label: "Tahun ajaran", render: (en) => years.find((y) => y.id === en.academicYearId)?.name ?? en.academicYearId.slice(0, 8) },
              { key: "class", label: "Kelas", render: (en) => classes.find((c) => c.id === en.classId)?.name ?? en.classId.slice(0, 8) + "…" },
              { key: "type", label: "Tipe", render: (en) => <Badge status={en.enrollmentType} /> },
              { key: "status", label: "Status", render: (en) => <Badge status={en.status} /> },
              { key: "enrolledAt", label: "Terdaftar", render: (en) => formatDateTime(en.enrolledAt) },
            ]}
            rows={enrollments}
            rowKey={(en) => en.id}
            title={(en) => years.find((y) => y.id === en.academicYearId)?.name ?? "-"}
            subtitle={(en) => classes.find((c) => c.id === en.classId)?.name ?? "-"}
          />
        )}
      </Card>

      <Card title="Wali" actions={<Button small onClick={() => setShowLink(true)}>+ Tautkan wali</Button>}>
        {guardians.length === 0 ? <EmptyState text="Belum ada wali tertaut." /> : (
          <ResponsiveTable<Guardian>
            columns={[
              { key: "fullName", label: "Nama", render: (g) => g.fullName },
              { key: "phone", label: "Telepon", render: (g) => g.phone ?? "-" },
              { key: "email", label: "Email", render: (g) => g.email ?? "-" },
            ]}
            rows={guardians}
            rowKey={(g) => g.id}
            title={(g) => g.fullName}
            subtitle={(g) => g.phone ?? g.email ?? "-"}
          />
        )}
      </Card>

      {showEnroll && (
        <Modal title="Tambah Enrollment" onClose={() => setShowEnroll(false)}>
          <form onSubmit={onEnroll}>
            <Field label="Tahun ajaran">
              <select
                value={enrollForm.academicYearId}
                onChange={(e) => { setEnrollForm({ ...enrollForm, academicYearId: e.target.value, classId: "" }); void loadClasses(e.target.value); }}
              >
                <option value="">— Pilih —</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </Field>
            <Field label="Kelas">
              <select value={enrollForm.classId} onChange={(e) => setEnrollForm({ ...enrollForm, classId: e.target.value })}>
                <option value="">— Pilih —</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name} (tingkat {c.gradeLevel})</option>)}
              </select>
            </Field>
            <Field label="Tipe enrollment">
              <select value={enrollForm.enrollmentType} onChange={(e) => setEnrollForm({ ...enrollForm, enrollmentType: e.target.value as typeof enrollForm.enrollmentType })}>
                <option value="NEW">Baru</option>
                <option value="PROMOTED">Naik kelas</option>
                <option value="REPEATED">Tinggal kelas</option>
                <option value="TRANSFERRED">Pindahan</option>
              </select>
            </Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowEnroll(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}

      {showLink && (
        <Modal title="Tautkan Wali" onClose={() => setShowLink(false)}>
          <form onSubmit={onLink}>
            <Field label="Wali" hint="Buat dulu di menu Wali bila belum ada.">
              <select value={linkForm.guardianId} onChange={(e) => setLinkForm({ ...linkForm, guardianId: e.target.value })}>
                <option value="">— Pilih —</option>
                {allGuardians.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
              </select>
            </Field>
            <Field label="Wali utama">
              <select value={linkForm.isPrimary ? "1" : "0"} onChange={(e) => setLinkForm({ ...linkForm, isPrimary: e.target.value === "1" })}>
                <option value="0">Tidak</option>
                <option value="1">Ya</option>
              </select>
            </Field>
            <div className="btn-row">
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Tautkan"}</Button>
              <Button type="button" variant="secondary" onClick={() => setShowLink(false)}>Batal</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
