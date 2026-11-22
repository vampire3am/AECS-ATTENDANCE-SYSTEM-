# Deployment

Vercel staging project: `aecs-attend-staging` (`prj_vLiHMAwmlGtGhkDUrR8OloIma0Fk`), team `Aashish`. Node.js 24, Next.js framework, Singapore functions. Deployment protection is preserved. Preview secrets use the isolated Neon staging runtime role. Owner URLs and local access/password files must never be deployed.

## Environment separation

| Environment       | Database                   | Credentials                                  |
| ----------------- | -------------------------- | -------------------------------------------- |
| Development       | `development` branch       | Gitignored local `.env`                      |
| Integration tests | `integration-tests` branch | Gitignored `.env.test`; explicit test marker |
| Vercel Preview    | `staging` branch           | Sensitive preview variables                  |
| Production        | `production` branch        | Not configured; requires explicit approval   |

Runtime needs `DATABASE_URL` and `AUTH_SECRET`. Local setup also uses `AUTH_URL` and `NEXT_PUBLIC_APP_URL`. For Vercel previews, omit the fixed auth URL so Auth.js uses the actual deployment host. Set the canonical `AUTH_URL` and `NEXT_PUBLIC_APP_URL` for production. Direct `DATABASE_URL_UNPOOLED` is for operator migrations only, not Vercel runtime.

Before staging deployment, push the reviewed source, run typecheck/lint/tests/build, then create a **preview** deployment of the exact commit. Do not pass `target: production`, promote a preview, or connect a production domain without approval. Production remains intentionally unconfigured. Keep deployment protection in place and use Vercel's authenticated access tools for review.

## Acceptance checks still required

The browser gate rejected local preview access, so these are outstanding, not claimed as passed:

- Login/logout, redirects, expired/deactivated sessions, and teacher attempts to access admin pages.
- Admin creation/edit/archive flows, schedules, enrollment, assignment and transfer screens.
- Teacher marks a 30-student class, changes individual statuses, reviews and submits; admin sees it and performs an audited correction.
- Offline shell reload, draft persistence/reconnection, lost server acknowledgement, conflict export/recovery and account switching.
- Excel/PDF download inspection, long/non-Latin student names, and large report pagination.
- Widths 320, 375, 390, 430, 768, 1024, 1280 and 1440 pixels; keyboard/focus and a real phone PWA install check.

No production release is approved until these checks, staging smoke tests, backup/restore rehearsal and environment review are complete. Generate proper PNG app icons before broad device distribution if a target browser does not accept the supplied SVG icon.

For production: first validate migrations on an isolated branch; take a verified backup; apply the committed migrations through the direct connection; provision the restricted production role; bootstrap the real admin with a separate strong credential; configure production secrets; build and smoke-test the exact release; obtain explicit approval; deploy. Record the release SHA and rollback plan. App rollback does not reverse database migrations; use compatible forward fixes and isolated restores.
