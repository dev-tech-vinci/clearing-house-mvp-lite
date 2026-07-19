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

## Phase 2 — Organizations, memberships, roles & RLS

Run 2026-07-18 on branch `feat/bh-clearinghouse-mvp`, local Supabase up via Docker, dev server on `localhost:3000` (restarted once to pick up `next.config.mjs` changes).

**`pnpm --filter web supabase:reset`** (`npx supabase db reset`, run twice — once before and once after the `get_organization_members` type-cast fix) — both runs: "Applying migration 20260718232603_organizations.sql... Seeding data from supabase/seed.sql... Restarting containers... Finished supabase db reset". No migration errors (the `WARNING (01006): no privileges could be revoked for ...` lines are pre-existing Supabase-managed-schema noise, not from this migration).

**`supabase db test`** (`apps/web/supabase/tests/database/organizations-rls.test.sql`) — **18/18 pgTAP assertions passed**, both before and after the type-cast fix (the fix affects the app-layer RPC call shape, not the pgTAP suite's own direct SQL calls, so it was green throughout). Covers: same-tenant read allowed, cross-tenant read denied (organizations table + `has_org_access` + `get_organization_members`), role-without-permission denied + positive control, full invite→accept flow, wrong-email negative, expired-token negative, `create_organization` bootstrap + isolation.

**`pnpm typecheck`** — 11/11 turbo tasks successful (final run after all fixes), 0 errors. One intermediate failure during development: `@kit/access-control` couldn't resolve `process` (missing `@types/node`, since nothing in that package depended on `next` the way sibling packages incidentally do) — fixed by adding `@types/node` directly as a devDependency.

**`pnpm lint`** — 10/10 turbo tasks successful, 2 warnings (same 2 pre-existing ones from Phase 1, unrelated to Phase 2), 0 errors. One intermediate failure during development: an unescaped apostrophe in `accept-invitation-panel.tsx` (`react/no-unescaped-entities`) — fixed.

**`npx playwright test tests/organizations`** (new suite, `apps/e2e/tests/organizations/organizations.spec.ts`) — **3/3 passed** (15.1s), after fixing three real bugs surfaced by this exact test run (see `docs/progress/DECISIONS.md`): a `'use server'` file exporting a non-function constant (500'd every `/home` page), a `RETURNS TABLE`/`varchar` type mismatch in `get_organization_members` (`42804`), and a Radix Dialog/DropdownMenu interaction that left a full-screen overlay stuck intercepting clicks after creating an organization.

**`npx playwright test tests/navigation tests/authentication tests/account`** (full regression check) — **28/30 passed**, up from 27/30 at Phase 1 closeout. `auth.spec.ts:35` ("will sign-in with the correct credentials") now passes, fixed by `devIndicators: false` (found while investigating the Radix overlay bug above, not itself a Phase 2 code change). The remaining 2 failures (`account.spec.ts:36`, `password-reset.spec.ts:11`) are unrelated to Phase 2 and now each show a different, previously-masked symptom (a missing password-field locator, and a `waitForURL` timeout, respectively) — see `docs/progress/KNOWN_ISSUES.md`.
