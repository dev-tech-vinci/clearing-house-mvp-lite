# Known Issues / Blockers

> Anything that stops a phase's acceptance criteria from being met, recorded instead of worked around silently.

## Open

(none — see below for items resolved during Phase 0)

## Resolved during Phase 0

- **pnpm not installed / not on PATH.** Node was present (`v20.8.0`) but neither `pnpm` nor `corepack enable` worked out of the box (`corepack enable` failed with `EPERM: operation not permitted, open 'E:\Node JS\pnpm.CMD'`, likely a permissions issue with the Node install location). Resolved by running `npm install -g pnpm@10.18.2`, which matches the version pinned in `package.json` (`packageManager: pnpm@10.18.2`).
- **Docker Desktop not installed.** `docker` was not on PATH and no Docker Desktop installation was found under `Program Files`. This blocks `pnpm --filter web supabase:start` and any Playwright e2e test that depends on local Supabase. User is installing Docker Desktop; local Supabase start and e2e tests will be run once it's available and the result appended to `docs/01-repository-baseline.md`.
