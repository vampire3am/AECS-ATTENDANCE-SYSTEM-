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
