# Database

Neon project: `curly-lake-44290872`, AWS Singapore, PostgreSQL 18. Branches are `production`, `development`, `staging` and `integration-tests`. Application schema/data have been installed in development, staging and test; production is reserved and intentionally unmigrated pending release approval.

The Drizzle schema is in `lib/db/schema.ts`. Versioned migrations are in `drizzle/`; run the installed Drizzle Kit generator, review SQL and apply it through `scripts/migrate.ts`. Never use `drizzle-kit push` against production. The initial migration also owns `student_code_seq`; subsequent generated snapshots do not describe trigger/function bodies, so retain the custom SQL migrations.

| Table               | Purpose                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| profiles            | Staff identity, password hash, role, active status and session revocation version |
| courses / batches   | Course catalog and fixed class groups                                             |
| students            | Learners with sequence-generated AECS codes                                       |
| enrollments         | Student/batch/course membership intervals and transfer history                    |
| batch_schedules     | ISO weekday timetable and effective dates                                         |
| teacher_assignments | Active staff/batch responsibility                                                 |
| class_sessions      | Dated class slot, immutable roster seal, submission/version metadata              |
| attendance_records  | Unique session/student snapshot and attendance status                             |
| app_settings        | Singleton organization policy                                                     |
| audit_logs          | Append-only administrative/security/correction history                            |
| login_attempts      | Persistent login/check-in rate-limit counters                                     |
| checkin_windows     | Hashed, short-lived classroom QR tokens for open sessions                         |
| student_checkins    | Unique session/student check-in requests and audited staff verification           |

Constraints include unique student codes/email, unique course/batch codes, composite batch/course foreign keys, one active student/course membership, overlap rejection for historical enrollment intervals, ISO weekday/time/date checks, a unique class slot, a unique attendance row, singleton settings and bounded attendance percentages. Important query keys have indexes. Enrollment and attendance operations acquire row locks; transactions use node-postgres through Drizzle, not the stateless Neon HTTP driver.

Migrations 0004–0005 add and backfill a unique immutable private check-in code on every enrollment, QR windows and check-in requests. Database triggers enforce roster/enrollment binding and staff-only verification while sessions are open. Transferring a student creates a new enrollment and therefore a new code; historical enrollment codes stay attached to their original batch/course.

Runtime traffic uses `aecs_runtime` through Neon's pooler. It has no schema ownership, table deletion, audit mutation or DDL privileges. Owner credentials are direct connections used only for migration and operator provisioning. `scripts/provision-runtime.ts` refuses to rotate an existing role automatically. Pass an env-file path when provisioning staging: `node scripts/with-env.mjs .env.staging scripts/provision-runtime.ts .env.staging`.

Migration 0003 briefly disables the session transition trigger **inside the migration transaction** solely to seal existing historical snapshots, then reenables it. No attendance, enrollment or audit records are deleted. The database and runtime role are explicitly configured for Asia/Kathmandu; application calendar calculations also specify that timezone.

Backups: the provisioned free-plan project currently reports a six-hour retained history window. Before launch, confirm that retention meets AECS's recovery needs and select an appropriate plan. Take encrypted `pg_dump` backups through the direct owner connection according to the organization's retention policy. Restore backups into a new isolated branch, apply pending migrations, verify row counts/constraints/login/report totals, and rehearse recovery before switching application configuration. Never reset production as a migration fix.
