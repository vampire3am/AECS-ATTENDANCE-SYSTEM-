# AECS Attend

Next.js App Router + TypeScript modular monolith; Auth.js (next-auth stable v4 credentials), Neon PostgreSQL, Drizzle, Tailwind, shadcn-style accessible primitives. No Supabase/Firebase. Staff only: super_admin and teacher. Asia/Kathmandu calendar dates.

Database: node-postgres pool + Drizzle interactive transactions. Migrations use direct URLs; application uses pooled least-privilege role. Keep database invariants in versioned SQL migrations. All mutations validate Zod and authorize against current database profiles. Attendance locks sessions, snapshots roster, finalizes atomically; admin corrections require audited reasons.

Never log/commit credentials. Do not deploy production without explicit approval. Prefer focused reads/tests. Update PROGRESS.md after milestones, and this file after architecture changes.

Commands: pnpm dev/build/typecheck/lint/test/db:generate/db:migrate. `scripts/bootstrap.ts` creates the first admin from process environment, never a default password.

Current modules: administration screens live under `features/admin/pages`; server business logic is in `lib/services`; Auth.js credentials are in `lib/auth/credentials.ts`. IndexedDB data is actor-scoped and conflicts must be preserved/exportable. Runtime traffic uses a restricted pooled role, while each environment has a separate direct migration URL. Integration tests require an explicit isolated test-branch marker.

Current live environment: user explicitly authorized Vercel hosting on 2026-11-22. The Production slot of project aecs-attend-staging uses the isolated Neon staging branch. Do not migrate or switch to the reserved Neon production branch without authorization. Authenticated live HTTP smoke checks pass; browser/mobile/offline acceptance remains outstanding. See PROGRESS.md and DEPLOYMENT.md.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Public URL is https://aecs-attendance.vercel.app. User explicitly requested no Vercel account gate; keep app-level staff authentication enforced.

Student QR check-in is authorized: each enrollment has a unique immutable private random code bound to student/course/batch. Staff open two-minute classroom QR windows. Student scans create pending requests only; assigned teacher confirmation marks present and increments the session version. Transfers issue new codes. Do not expose enrollment codes to public roster APIs or treat a scan as proof of physical presence.

Public student entry: guests at / and all users at /student reach the StudentPortal. The private enrollment code is verified via rate-limited POST /api/enrollment/verify before enabling the in-app QR camera scanner. Camera decoding uses a lazily loaded @zxing/browser module with local image and link fallbacks; only same-origin /check-in QR URLs are accepted. Permissions-Policy allows camera=(self). Codes stay in component memory and are revalidated at check-in. Staff retain /login and role-protected routes.

Admin Students must show administrative Student ID separately from private enrollment check-in codes; never accept predictable AECS-000001-style IDs as student authentication. Current codes are copied from Enrollment & check-in code. Shared enrollmentCodeInput provides explicit guidance on this distinction.

Common QR: /check-in is the permanent institute-wide QR for every current/future batch. Code-only submissions derive the batch server-side from the active private enrollment code and resolve exactly one open class today. No client batch selector; zero/multiple open classes reject. Admin Batches and teacher pages expose the same downloadable QR. Teacher confirmation remains required; legacy rotating session links remain supported.

Brand/UI: preserve the supplied AECS logo at public/brand/aecs-logo.png; Brand is the shared identity component. Manrope is self-hosted by next/font. Shared brand blue/orange tokens and form/table/card styles live in app/globals.css. Batch overview is a setup summary; roster/enrollment, timetable and sessions have separate tabs. Common QR is a native disclosure. AttendanceMarking accepts the check-in panel as children after its class summary; submission stays in normal document flow.

Authorized live-data reset on 2026-11-22 preserved Super Admin and website settings; all operational records and teachers were cleared. Offline storage namespace is aecs-attend-reset-20261122. Service worker v3 purges the legacy aecs-attend roster/draft stores on activation. Development/test Neon branches were outside the requested live reset.

Daily flow (2026-11-23): Today is the admin/teacher landing page; Students and Batches are primary navigation, with advanced tools under Manage. lib/services/workflows.ts provides atomic course+batch+teacher+schedule setup, student+enrollment creation, generated teacher credentials and idempotent batch-locked Start class (today only; one open class per batch). It reuses the sealed-roster opening helper. Never log generated passwords/codes. Current actor reads use React request-scoped cache; mutations still freshly reauthorize in actorTransaction. catalog loads only requested lists concurrently; Today is a read-only summary and does not generate sessions. Root/admin/teacher loading boundaries use WorkspaceLoading; no artificial delay.

Teacher isolation (2026-11-23): teacher_course_assignments AND teacher_assignments jointly control all batch access, including reads, mutations, reports and cached roster visibility. Course access does not grant access to other teachers’ batches. New teacher-created batches auto-assign the creator. Admin-created/assigned batches grant the teacher course creation access; removing a course grant deactivates its batch assignments and invalidates existing teacher sessions via migration 0007’s database trigger. Re-granting a course does not restore old batch memberships. Only admins grant access or create staff/courses. Teacher students, schedules, enrollments and reports must use assigned-batch predicates/requireBatch; never expose global student details or private codes from another enrollment. Migration 0006 backfills existing course access and protects grant writes. Login has per-account and trusted Vercel IP throttles, Argon2id and fresh profile/session checks.

Revocation UI: /api/staff/access is private/no-store and checks fresh actor permissions. Teacher AccessGuard checks on navigation, focus and every 15 seconds while visible, sending revoked sessions to login. Offline roster reopening requires current server authorization; unsynced drafts stay preserved but unauthorized cached rosters are hidden/pruned. requirePageActor redirects expired sessions cleanly; APIs retain explicit 401/403 errors. Teachers admin view uses responsive cards.

Enrollment sharing: EnrollmentCode offers a staff-only Send on WhatsApp draft action in student lists, batch rosters and enrollment success. lib/enrollment-message.ts encodes the private code, student/course/batch and same-origin /check-in link. Local Nepal mobiles normalize to +977; explicit international numbers are supported; unrecognized numbers open the contact chooser. Staff review and send in WhatsApp; no automatic messaging, SDK, new credentials or database mutation.

Upcoming enrollments: code verification recognizes valid future enrollments and returns startsOn/canCheckIn; attendance still enforces effective dates server-side. Today shows all current/future enrolled students separately from eligibleStudentCount, which gates Start class. Existing-student enrollment uses a debounced, bounded, freshly authorized search; teachers see only students already visible in assigned batches. Same-course overlaps return 409 with Transfer guidance. Batch/student locks and database overlap guards protect concurrent enrollment; no duplicate student record is created.
