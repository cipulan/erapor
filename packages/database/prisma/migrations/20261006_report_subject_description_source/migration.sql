-- Penanda sumber deskripsi per mapel pada rapor: AUTO (hasil generator) atau
-- MANUAL (diubah manual oleh guru/wali kelas). Baris lama dianggap AUTO.
-- Kolom ini dibaca UI untuk menampilkan badge dan tombol "kembalikan ke otomatis".
ALTER TABLE "report_card_subjects"
  ADD COLUMN "description_source" TEXT NOT NULL DEFAULT 'AUTO';
