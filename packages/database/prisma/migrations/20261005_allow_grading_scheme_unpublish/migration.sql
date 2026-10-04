-- Allow the explicit, audited unpublish transition (PUBLISHED -> DRAFT) on
-- grading schemes. Every other modification of a published scheme stays blocked,
-- and unpublish is only permitted while no scores exist for the semester
-- (mirrors the application-level guard in GradingService.unpublishScheme).
CREATE OR REPLACE FUNCTION prevent_published_grading_scheme_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'Published grading scheme is immutable';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.status = 'PUBLISHED' THEN
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
    RAISE EXCEPTION 'Published grading scheme is immutable';
  END IF;

  RETURN NEW;
END;
$$;
