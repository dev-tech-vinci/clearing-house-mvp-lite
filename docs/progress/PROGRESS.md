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
