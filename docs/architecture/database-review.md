# Database Architecture Review — Final Baseline

## Multi-tenant isolation
School context is derived only from the authenticated session. The API must never trust a client-supplied schoolId for authorization. Cross-school consistency checks remain service-level transaction rules.

## Grading
Raw scores are stored in the assessment's native maximum and normalized to 0–100. Final score = sum(category average × published category weight / 100). Missing required scores produce INCOMPLETE, never zero. Published schemes are immutable.

## Report versioning
Reports are immutable snapshots after publication. Corrections create a new version. Historical published versions remain queryable. Report subject rows contain snapshot values for subject name, final score, KKTP and description.

## Important schema correction
AssessmentLearningObjective previously used nullable tpId as part of a primary key. PostgreSQL primary-key columns cannot be nullable. Final schema uses a UUID primary key and a compound unique index.

## Application-level invariants
The service layer must transactionally validate:
- role of teacher/homeroom teacher
- same-school ownership
- academic-year consistency across semester/class/assignment
- CP/TP belongs to the assessment subject
- assessment score student belongs to assessment class/year
- published grading weight total equals exactly 100.00
- report completeness before generation
- report state transitions
