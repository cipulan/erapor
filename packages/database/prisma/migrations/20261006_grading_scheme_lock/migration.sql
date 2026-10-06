-- Skema nilai fleksibel + kunci admin: skema PUBLISHED yang belum dikunci
-- boleh diubah bobotnya (tercatat di audit); penguncian bersifat eksplisit
-- oleh admin di akhir semester. is_locked dipakai sebagai pengganti nilai
-- enum baru agar migrasi tetap sederhana.
ALTER TABLE "grading_schemes"
  ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "locked_at" TIMESTAMP(3);

-- Revisi trigger: skema terkunci immutable penuh; transisi kunci
-- (PUBLISHED -> terkunci) dan buka-kunci darurat (terkunci -> PUBLISHED)
-- tetap diizinkan karena selalu lewat endpoint beraudit.
CREATE OR REPLACE FUNCTION prevent_published_grading_scheme_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PUBLISHED' OR OLD.is_locked THEN
      RAISE EXCEPTION 'Published/locked grading scheme is immutable';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: skema terkunci tidak boleh diubah kecuali dibuka kuncinya
  -- (transisi is_locked TRUE -> FALSE lewat endpoint unlock beraudit).
  IF OLD.is_locked THEN
    IF NEW.is_locked = FALSE
       AND NEW.id = OLD.id
       AND NEW.status = OLD.status
       AND NEW.academic_year_id = OLD.academic_year_id
       AND NEW.semester_id = OLD.semester_id
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Locked grading scheme is immutable; unlock it first';
  END IF;

  IF OLD.status = 'PUBLISHED' THEN
    -- Batalkan publish (aturan lama, tetap dipertahankan).
    IF NEW.status = 'DRAFT'
       AND NEW.id = OLD.id
       AND NEW.academic_year_id = OLD.academic_year_id
       AND NEW.semester_id = OLD.semester_id
       AND NEW.published_at IS NULL
       AND NOT EXISTS (
         SELECT 1
         FROM assessment_scores s
         JOIN assessments a ON a.id = s.assessment_id
         WHERE a.semester_id = OLD.semester_id
       )
    THEN
      RETURN NEW;
    END IF;
    -- Kunci skema: PUBLISHED tetap, is_locked menjadi TRUE.
    IF NEW.status = OLD.status
       AND NEW.id = OLD.id
       AND NEW.is_locked = TRUE
       AND NEW.locked_at IS NOT NULL
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Published grading scheme is immutable except lock/unpublish';
  END IF;

  RETURN NEW;
END;
$$;

-- Bobot skema terkunci tidak boleh diubah lewat baris turunannya.
CREATE OR REPLACE FUNCTION prevent_locked_scheme_weight_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  scheme_locked BOOLEAN;
BEGIN
  SELECT gs.is_locked INTO scheme_locked
  FROM grading_schemes gs
  WHERE gs.id = COALESCE(NEW.grading_scheme_id, OLD.grading_scheme_id);

  IF COALESCE(scheme_locked, FALSE) THEN
    RAISE EXCEPTION 'Weights of a locked grading scheme cannot be changed';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "grading_scheme_weights_locked_guard" ON "grading_scheme_weights";
CREATE TRIGGER "grading_scheme_weights_locked_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "grading_scheme_weights"
FOR EACH ROW
EXECUTE FUNCTION prevent_locked_scheme_weight_change();
