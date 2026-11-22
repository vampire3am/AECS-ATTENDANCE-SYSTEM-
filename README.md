# AECS Attend

Staff attendance workspace for Abroad Education Consultancy Services, Nepal. Administrators manage courses, batches, schedules, staff and fixed enrollments. Teachers open scheduled classes, mark a roster and submit attendance directly. There is no student login or approval queue.

**Live acceptance environment:** [https://aecs-attendance.vercel.app](https://aecs-attendance.vercel.app). Vercel hosts the app and Neon retains the database. Authenticated HTTP smoke checks pass; browser/mobile/offline acceptance is still pending. Do not treat the deployment as completion of every launch check.

## Stack

Next.js 16 App Router, React, TypeScript, Tailwind, shadcn/ui-compatible Radix primitives, React Hook Form, Zod, Auth.js/NextAuth v4, Neon PostgreSQL, Drizzle, Recharts and IndexedDB. Node.js 24 and pnpm 11.25.0. Exact dependencies and lockfile are committed. Server Components fetch data directly; a client query cache is not needed for current screens.

## Run locally

1. Install Node.js 24 and pnpm 11.25.0.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env` and configure the **development** Neon branch. Use the pooled runtime URL for `DATABASE_URL`, the direct owner URL for `DATABASE_URL_UNPOOLED`, and a randomly generated `AUTH_SECRET` of at least 32 bytes.
4. Run `pnpm db:migrate` and `pnpm db:provision-runtime`. The latter creates a restricted login once and updates only the runtime URL in the selected local env file.
5. Create the first administrator with `pnpm staff:bootstrap`, supplying `BOOTSTRAP_NAME`, `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD` through your process environment. Use a password of at least 14 characters. Bootstrap refuses when any staff account already exists.
6. Run `pnpm dev` and open `/login`.

Never put credentials in Git, shell arguments, screenshots or issue reports. Account recovery is administrator-assisted; email reset delivery is not configured. An operator can use `pnpm staff:reset-password` with `RESET_EMAIL`, `RESET_PASSWORD` and a mandatory `RESET_REASON` in the environment; this revokes existing sessions and writes an audit event.

## Commands

| Command                                | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                             | Local development                                         |
| `pnpm typecheck` / `pnpm lint`         | Strict TypeScript and ESLint                              |
| `pnpm test`                            | Unit, offline-storage and optional live integration tests |
| `pnpm build` / `pnpm start`            | Production build and local server                         |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and apply versioned migrations                   |
| `pnpm format`                          | Format source                                             |

Live database tests run **only** when `TEST_DATABASE_BRANCH=integration-tests` and an isolated test `DATABASE_URL` are provided. A gitignored `.env.test` may supply these plus its own direct migration URL. Run `node scripts/with-env.mjs .env.test scripts/migrate.ts` before integration tests. Tests create uniquely named fixtures and preserve audit history on that isolated branch. Without test configuration, those tests are explicitly skipped; CI runs the unit and storage suites and the build.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [DEPLOYMENT.md](DEPLOYMENT.md) and [PROGRESS.md](PROGRESS.md).
