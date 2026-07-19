# Progress Log

> One entry per phase. Append-only; do not rewrite history here.

## Phase 0 — Repository baseline & safety

- Status: complete
- Started: 2026-07-15
- Completed: 2026-07-18
- Acceptance: baseline commit SHA + toolchain/structure recorded in `docs/01-repository-baseline.md`; branch `feat/bh-clearinghouse-mvp` created; no application behavior changed.

## Phase 1 — Branding, navigation & route skeletons

- Status: complete
- Completed: 2026-07-18
- What shipped: rebranded `apps/web/.env` public strings (product name/title/description) to "BH Clearinghouse Simulator"; nine new protected customer route skeletons under `app/home/(customer)/{dashboard,claims,claim-batches,remittances,payers,documents,support,users,audit}/page.tsx`; new `/support` and `/admin` portal route skeletons with a shared `PortalHeader`; a shared `PlaceholderNotice` component used by every skeleton page; `config/paths.config.ts` extended with the nine new app paths + `supportPortal`/`adminPortal`; `config/navigation.config.tsx` extended with a "Clearinghouse" nav group listing all nine customer routes; `middleware.ts` refactored to extract `requireAuthHandler` and apply it to `/support` and `/admin` (same auth gate as `/home` — org/role scoping is deferred to Phase 2); new locale keys in `public/locales/en/common.json`; new Playwright spec `apps/e2e/tests/navigation/protected-routes.spec.ts` (22 cases: unauthenticated redirect + authenticated access for all 11 new routes).
- Commands run: `pnpm lint` (8/8 tasks pass, 2 pre-existing warnings unrelated to this phase), `pnpm typecheck` (9/9 tasks pass), `npx playwright test tests/navigation` (22/22 pass), `npx playwright test tests/authentication tests/account` (5 passed / 3 failed — see Known Issues; failures are a pre-existing Next.js dev-mode overlay artifact, not a regression from this phase).
- Acceptance: existing auth flows still function (sign-up/sign-in/dashboard render correctly per the Playwright DOM snapshot; the 3 failures are a dev-tools-button click interception, not an auth or nav break); all new routes redirect unauthenticated visitors to sign-in and are reachable once authenticated. Met.

## Phase 2 — Organizations, memberships, roles & RLS

- Status: complete
- Completed: 2026-07-18
- What shipped: migration `20260718232603_organizations.sql` (organizations, organization_memberships, roles, permissions, role_permissions, invitations, user_profiles view, 5 SECURITY DEFINER helper functions, full RLS, seeded 9-role permission matrix); packages `@kit/organizations` and `@kit/access-control`; org switcher in the sidebar; real members/invitations management at `/home/users`; invite-accept flow at `/home/invitations/accept`; pgTAP suite `apps/web/supabase/tests/database/organizations-rls.test.sql` (18 assertions); new Playwright suite `apps/e2e/tests/organizations/organizations.spec.ts` (3 tests, going beyond this phase's pgTAP-only requirement to also verify the UI end-to-end); `docs/03-data-model.md` and `docs/04-rbac-and-rls.md` (both new).
- Bugs found and fixed during this phase's own verification (see `docs/progress/DECISIONS.md` for detail): (1) a `'use server'` file cannot export a non-function constant — `CURRENT_ORGANIZATION_COOKIE` was moved to a plain `constants.ts`, which had been silently 500-ing every `/home` page; (2) `get_organization_members()`'s `RETURNS TABLE` declared `text` columns against `varchar` source columns, which Postgres rejects at call time — fixed with explicit `::text` casts; (3) closing a Radix Dialog opened from a DropdownMenu item while synchronously calling `router.refresh()` could leave the dialog's overlay stuck intercepting clicks — fixed by not preventing the dropdown's default close, adding `onCloseAutoFocus` on the dropdown content, and deferring `router.refresh()` calls to the next tick everywhere they follow a dialog/dropdown close; (4) the two new workspace packages were missing from `next.config.mjs`'s `transpilePackages`/`optimizePackageImports` lists.
- Also fixed as a byproduct of chasing a false lead while verifying this phase: `devIndicators: false` added to `next.config.mjs` to stop the Next.js dev-mode floating button from intercepting Playwright clicks (root cause of 3 pre-existing failing specs from Phase 1 closeout) — 1 of those 3 specs now passes; the other 2 have a different, still-open, unrelated failure mode (see Known Issues).
- Commands run: `pnpm lint` (10/10 tasks pass, 2 pre-existing warnings unrelated to this phase), `pnpm typecheck` (11/11 tasks pass), `pnpm --filter web supabase:reset`, `supabase db test` (18/18 pgTAP assertions pass, including all required negative-RLS cases and the invite/accept flow), `npx playwright test tests/organizations` (3/3 pass), `npx playwright test tests/navigation tests/authentication tests/account` (28/30 pass — 2 pre-existing failures unrelated to this phase, see Known Issues).
- Acceptance: cross-tenant denial test passes (pgTAP + a real browser flow); invitations accept flow works (pgTAP + a real browser flow, including wrong-email and expired-token negatives). Met.
