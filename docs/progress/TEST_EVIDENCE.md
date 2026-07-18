# Test Evidence

> Raw-ish output from migrations and test runs, saved per phase as proof of the recorded pass/fail status.

## Phase 0 — Repository baseline & safety

See `docs/01-repository-baseline.md` for the full command log (install, lint, typecheck, test, supabase start). Summarized here once Phase 0 is complete.

## Phase 1 — Branding, navigation & route skeletons

Run 2026-07-18 on branch `feat/bh-clearinghouse-mvp`, local Supabase already up via Docker (`supabase_*_next-supabase-saas-kit-turbo-lite` containers healthy), dev server already running on `localhost:3000`.

**`pnpm lint`** — 8/8 turbo tasks successful (3 cached). Output: 2 warnings, 0 errors, both pre-existing and unrelated to Phase 1 (`@kit/accounts` `<img>`-vs-`next/image` warning in `multi-factor-auth-setup-dialog.tsx`; `web` `react-hooks/exhaustive-deps` warning in `dashboard-demo-charts.tsx`). `manypkg check` — "workspaces valid!".

**`pnpm typecheck`** — 9/9 turbo tasks successful (4 cached), 0 errors.

**`npx playwright test tests/navigation/protected-routes.spec.ts`** (from `apps/e2e`) — **22/22 passed** (29.4s). Covers: unauthenticated visit to each of the 9 customer routes + `/support` + `/admin` redirects to `/auth/sign-in?next=<path>` (11 cases); authenticated user (via fresh sign-up flow through Mailpit) reaches all 11 routes (11 cases).

**`npx playwright test tests/authentication tests/account`** (pre-existing suite, regression check) — 5 passed, 3 failed. Failures are a dev-server-only click-interception artifact (Next.js "Open Next.js Dev Tools" floating button), not a Phase 1 regression — see `docs/progress/KNOWN_ISSUES.md` for the full analysis and the captured DOM snapshot showing the nav/dashboard/profile-dropdown all rendered correctly.
