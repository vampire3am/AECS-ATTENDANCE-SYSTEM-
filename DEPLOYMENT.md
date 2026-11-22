# Deployment

Vercel staging project: `aecs-attend-staging` (`prj_vLiHMAwmlGtGhkDUrR8OloIma0Fk`), team `Aashish`. Node.js 24, Next.js framework, Singapore functions. Deployment protection is preserved. Preview and the authorized live slot use the isolated Neon staging runtime role. Owner URLs and local access/password files must never be deployed.

Live URL: https://aecs-attend-staging-aashish-33b8.vercel.app/login. The user explicitly authorized this live deployment on 2026-11-22. Deployment dpl_6Mha9znuW6zajMRsKzEPnY3X1V2j is READY, using source bd4e6e1 and the staging Neon database. The earlier mismatched Preview request was cancelled; the current deployment deliberately uses this staging project’s Production slot.

## Environment separation

| Environment       | Database                   | Credentials                                  |
| ----------------- | -------------------------- | -------------------------------------------- |
| Development       | `development` branch       | Gitignored local `.env`                      |
| Integration tests | `integration-tests` branch | Gitignored `.env.test`; explicit test marker |
| Vercel Preview    | `staging` branch           | Sensitive preview variables                  |
| Live Vercel Production slot | `staging` branch | Sensitive production variables in staging project |
| Reserved AECS production | `production` branch | Not configured |

Runtime needs `DATABASE_URL` and `AUTH_SECRET`. Local setup also uses `AUTH_URL` and `NEXT_PUBLIC_APP_URL`. For Vercel previews, omit the fixed auth URL so Auth.js uses the actual deployment host. Set the canonical `AUTH_URL` and `NEXT_PUBLIC_APP_URL` for production. Direct `DATABASE_URL_UNPOOLED` is for operator migrations only, not Vercel runtime.

The reviewed source passed typecheck/lint/tests/build before deployment. Live deployment is now authorized and uses the Vercel Production target of the dedicated staging project. The reserved Neon production branch remains unconfigured. Keep deployment protection in place and use Vercel’s authenticated access tools for review.

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

Verified live over authenticated HTTP: credential sign-in, session cookie, nine admin screens, teacher home and Excel/PDF signatures. These checks do not replace browser/mobile interaction and offline acceptance tests.
