# Authorization Matrix

## 1. Authorization Model

Application uses RBAC with three roles:

- `SUPERADMIN`
- `TEACHER`
- `PARENT`

The application is deployed for exactly one school.

Every request is scoped to the school associated with the authenticated session. The client must never be trusted to choose `schoolId`.

Authorization has two layers:

1. **Role permission** — whether the role may perform the action.
2. **Resource scope** — whether the authenticated user may access the specific record.

## 2. Global Rules

### School isolation

For every repository/service query:
- derive `schoolId` from authenticated session;
- include school ownership checks;
- reject records belonging to another school as `404` or `403` according to API convention;
- never accept arbitrary `schoolId` as an authorization boundary.

### Parent scope

Parent may access only:
- their own user account;
- students linked through `student_guardians`;
- published reports for those students.

### Teacher scope

Teacher may access grading/class data only through active teacher assignments and assigned classes/subjects.

Teacher must not be able to:
- edit another teacher's assignment;
- access unrelated class/subject scores;
- publish report cards.

### Superadmin scope

Superadmin may manage all school resources.

Superadmin cannot bypass database integrity constraints.

## 3. Role Matrix

Legend:
- `C` = create
- `R` = read
- `U` = update
- `D` = delete/deactivate
- `A` = approve/publish/lock
- `—` = not allowed

| Module | SUPERADMIN | TEACHER | PARENT |
|---|---|---|---|
| Authentication | R/U self | R/U self | R/U self |
| Users | CRUD | — | — |
| Academic years | CRUD/A | R | — |
| Semesters | CRUD/A | R | — |
| Students | CRUD | R assigned scope | R linked only |
| Guardians | CRUD | R assigned scope | R linked only |
| Enrollments | CRUD | R assigned scope | R linked child |
| Classes | CRUD/A | R assigned | R via child |
| Subjects | CRUD/D | R | R |
| CP | CRUD/D | R assigned subject | R |
| TP | CRUD/D | CRUD assigned subject | R |
| Teacher assignments | CRUD/A | R own | — |
| Assessment categories | CRUD | R | — |
| Grading schemes | CRUD/A | R | — |
| KKTP | CRUD | R assigned subject | R through published report |
| Assessments | CRUD own assignment | CRUD own assignment | — |
| Scores | CRUD own assignment | CRUD own assignment | — |
| Import scores | C/commit | C/commit own assignment | — |
| Grading preview | R all | R assigned scope | R published only |
| Report generation | C | C/recommendation according to assigned scope | — |
| Report review | A | A if assigned reviewer/homeroom | — |
| Report lock | A | A if assigned reviewer/homeroom | — |
| Report publish | A | — | — |
| Report revision | A | C/request | — |
| Report PDF | R all | R assigned scope | R published linked child |
| Promotion | C/A | R | — |
| Audit logs | R | — | — |

## 4. Endpoint Authorization

| Endpoint | SUPERADMIN | TEACHER | PARENT | Scope |
|---|---:|---:|---:|---|
| POST `/auth/login` | C | C | C | public login |
| POST `/auth/logout` | C | C | C | own session |
| GET `/auth/me` | R | R | R | self |
| GET `/academic-years` | R | R | — | school |
| POST `/academic-years` | C | — | — | school |
| GET `/academic-years/{id}` | R | R | — | school |
| POST `/academic-years/{id}/activate` | A | — | — | school |
| GET `/academic-years/{id}/semesters` | R | R | — | school |
| POST `/academic-years/{id}/semesters` | C | — | — | school |
| GET `/students` | R | R | R | teacher assigned / parent linked |
| POST `/students` | C | — | — | school |
| GET `/students/{id}` | R | R | R | scoped |
| GET `/students/{id}/enrollments` | R | R | R | scoped |
| POST `/students/{id}/enrollments` | C | — | — | school |
| GET `/students/{id}/guardians` | R | R | R | scoped |
| POST `/students/{id}/guardians` | C | — | — | school |
| GET `/guardians` | R | R | R | scoped |
| POST `/guardians` | C | — | — | school |
| GET `/classes` | R | R | R | teacher/parent derived scope |
| POST `/classes` | C | — | — | school |
| GET `/subjects` | R | R | R | school |
| POST `/subjects` | C | — | — | school |
| POST `/subjects/{subjectId}/cp` | C | C | — | teacher assigned subject |
| POST `/cp/{cpId}/tp` | C | C | — | teacher assigned subject |
| GET `/teacher-assignments` | R | R own | — | own/assigned |
| POST `/teacher-assignments` | C | — | — | school |
| GET `/assessment-categories` | R | R | — | school |
| POST `/assessment-categories` | C | — | — | school |
| GET `/grading-schemes` | R | R | — | school |
| POST `/grading-schemes` | C | — | — | school |
| PUT `/grading-schemes/{id}/weights` | U | — | — | draft only |
| POST `/grading-schemes/{id}/publish` | A | — | — | scheme validation |
| GET `/kktp-configurations` | R | R | — | school/assigned subject |
| POST `/kktp-configurations` | C | — | — | school |
| GET `/grading/students/{studentId}` | R | R | R | parent published only |
| GET `/assessments` | R | R | — | teacher assignment scope |
| POST `/assessments` | C | C | — | teacher assignment scope |
| GET `/assessments/{id}` | R | R | — | teacher assignment scope |
| GET `/assessments/{id}/scores` | R | R | — | teacher assignment scope |
| PUT `/assessments/{id}/scores` | U | U | — | teacher assignment scope |
| POST `/assessments/{id}/scores/import` | C | C | — | teacher assignment scope |
| POST `/assessments/{id}/scores/import/commit` | A | A | — | preview token owner |
| GET `/report-cards` | R | R | R | parent linked + published |
| POST `/report-cards/generate` | C | C | — | teacher assigned; final generation scope |
| GET `/report-cards/{id}` | R | R | R | scoped; parent published |
| POST `/report-cards/{id}/review` | A | A | — | assigned reviewer |
| POST `/report-cards/{id}/lock` | A | A | — | assigned reviewer |
| POST `/report-cards/{id}/publish` | A | — | — | school |
| POST `/report-cards/{id}/revision` | A | C/request | — | scoped |
| GET `/report-cards/{id}/pdf` | R | R | R | parent published |
| POST `/classes/{id}/promote` | C/A | — | — | school |
| GET `/audit-logs` | R | — | — | school |

## 5. Important Resource-Level Checks

### Student

Teacher access requires:
- student enrolled in a class;
- class is covered by teacher assignment where relevant.

Parent access requires:
- active `student_guardians` link.

### Assessment

Teacher may modify an assessment only when:
- assessment belongs to the teacher's active assignment;
- assessment is not in an immutable lifecycle state.

Suggested lifecycle:
- `DRAFT`: editable;
- `PUBLISHED`: scores editable according to policy;
- `CLOSED`: no normal edits; correction requires controlled workflow.

### Scores

Teacher may update scores only when:
- assessment belongs to teacher assignment;
- student belongs to the assignment's class/semester;
- score is within `0..maxScore`.

Bulk update must execute transactionally.

### Grading Scheme

Only `SUPERADMIN` may:
- create;
- edit weights;
- publish;
- archive.

Once `PUBLISHED`, weights cannot be updated in place.

### Report Card

Recommended state machine:

```text
DRAFT -> REVIEW -> LOCKED -> PUBLISHED
                         |
                         v
                      REVISION
```

Rules:
- `DRAFT`: generated/editable by authorized staff.
- `REVIEW`: reviewer validates.
- `LOCKED`: content frozen for publication.
- `PUBLISHED`: visible to parent; immutable.
- `REVISION`: creates a new version; previous published version remains immutable/auditable.

Only `SUPERADMIN` can transition `LOCKED -> PUBLISHED`.

### Promotion

Only `SUPERADMIN` can execute promotion.

Promotion must:
- create next academic year's enrollment;
- never modify historical enrollment;
- reject if target academic year/class is invalid;
- prevent duplicate student/year enrollment.

## 6. Authorization Service Contract

Recommended backend pattern:

```text
AuthGuard
  -> SessionResolver
  -> RoleGuard
  -> ResourcePolicy
  -> Service
  -> Repository
```

Example:

```text
requireRole(SUPERADMIN)

requireTeacherAssignment(
  session.userId,
  semesterId,
  classId,
  subjectId
)

requireParentStudentLink(
  session.userId,
  studentId
)
```

Resource policy functions should be reusable and testable independently of controllers.

## 7. Deny-by-Default

Every endpoint is denied unless:
1. a valid session exists;
2. role is allowed;
3. resource belongs to the authenticated user's school;
4. resource-specific scope passes.

Do not implement authorization as frontend-only route hiding.

## 8. HTTP Responses

Recommended:
- `401` — no valid authenticated session.
- `403` — authenticated but role/scope is not permitted.
- `404` — resource does not exist or application intentionally hides cross-scope existence.
- `409` — valid permission but state/conflict prevents operation.
- `422` — semantic validation failure.

## 9. Audit Requirements

Audit at minimum:
- login/logout/security events;
- academic year activation;
- grading scheme publication;
- score import commit;
- report generation;
- report review;
- report lock;
- report publication;
- report revision;
- promotion;
- critical master-data changes.

Audit record should include:
- actor user ID;
- action;
- entity type;
- entity ID;
- timestamp;
- relevant before/after or structured metadata;
- request correlation ID where available.

## 10. Security Tests

Contractor must include tests for:
- teacher accessing another teacher's assessment -> `403/404`;
- teacher accessing unrelated class -> `403/404`;
- parent accessing unrelated student -> `403/404`;
- parent accessing draft report -> `403/404`;
- parent accessing another school's record -> `403/404`;
- teacher publishing report -> `403`;
- parent modifying score -> `403`;
- teacher modifying published grading scheme -> `403`;
- non-superadmin promotion -> `403`;
- cross-school ID enumeration -> no data leakage.

## 11. Implementation Rule

Authorization must be enforced server-side at service/policy level even if controller guards exist.

Frontend permissions are for UX only and are not security controls.
