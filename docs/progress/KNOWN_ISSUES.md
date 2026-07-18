# Known Issues / Blockers

> Anything that stops a phase's acceptance criteria from being met, recorded instead of worked around silently.

## Open

- **3 pre-existing Playwright specs flake against `next dev`:** `tests/account/account.spec.ts:36` ("user can update their password"), `tests/authentication/auth.spec.ts:35` ("will sign-in with the correct credentials"), and `tests/authentication/password-reset.spec.ts:11` fail when run against a `pnpm dev` server. Root cause per the captured DOM snapshot: a floating "Open Next.js Dev Tools" button (Next.js 15's dev-mode indicator) overlaps and intercepts the click on `[data-test="account-dropdown-trigger"]`, not an application or navigation defect — the page itself (nav, dashboard, profile dropdown) renders correctly in the same snapshot. Not caused by Phase 1's changes (nav config, paths config, middleware refactor, or the new route skeletons don't touch `auth.po.ts`, the dropdown component, or dev-server config). Should be re-verified against a production build (`pnpm build && pnpm start`) or with the dev-tools indicator disabled before Phase 9's full test-pyramid pass; left open rather than silently patched.
- **Stray `'node_modules'` (literal single-quote in the folder name) directories exist as untracked junk** under `apps/web`, `packages/features/{accounts,auth}`, `packages/{i18n,next,shared,supabase,ui}`, `tooling/{eslint,prettier}` — visible in `git status` but not matched by `.gitignore`. Likely leftover from a shell quoting mistake in an earlier command (not created by this session). Not staged or committed in any phase commit. Left in place rather than deleted without confirmation — flag to the user for cleanup.

(see below for items resolved during Phase 0)

## Resolved during Phase 0

- **pnpm not installed / not on PATH.** Node was present (`v20.8.0`) but neither `pnpm` nor `corepack enable` worked out of the box (`corepack enable` failed with `EPERM: operation not permitted, open 'E:\Node JS\pnpm.CMD'`, likely a permissions issue with the Node install location). Resolved by running `npm install -g pnpm@10.18.2`, which matches the version pinned in `package.json` (`packageManager: pnpm@10.18.2`).
- **Docker Desktop not installed.** `docker` was not on PATH and no Docker Desktop installation was found under `Program Files`. This blocks `pnpm --filter web supabase:start` and any Playwright e2e test that depends on local Supabase. User is installing Docker Desktop; local Supabase start and e2e tests will be run once it's available and the result appended to `docs/01-repository-baseline.md`.
