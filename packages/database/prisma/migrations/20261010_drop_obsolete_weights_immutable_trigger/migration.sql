-- Drop the obsolete immutability trigger on grading_scheme_weights.
--
-- Migration 20261006_grading_scheme_lock introduced the flexible-scheme rule:
-- weights of a PUBLISHED scheme may still be edited until the scheme is
-- explicitly locked (guarded by grading_scheme_weights_locked_guard, which
-- only blocks changes when is_locked = TRUE).
--
-- However it never dropped the original trigger from 20261003_init
-- (grading_scheme_weights_immutable_after_publish), which blocks ANY weight
-- change on published schemes. Both triggers stayed active, so the flexible
-- weights feature never actually worked at the DB level (PUT
-- /grading-schemes/:id/weights on a published scheme failed with 500).
--
-- This migration removes the obsolete trigger and its function. The
-- locked-only guard remains in place.

DROP TRIGGER IF EXISTS "grading_scheme_weights_immutable_after_publish" ON "grading_scheme_weights";
DROP FUNCTION IF EXISTS prevent_published_grading_weight_change();
