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
