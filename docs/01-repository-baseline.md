# Repository Baseline

> Recorded once, at the start of Phase 0, before any behavioral-health domain changes. If README, structure, or package versions ever disagree with the actual repo files, **the repo files are authoritative** — this document is a snapshot, not a source of truth going forward.

## Baseline commit

- **SHA:** `37def9c20b01a3514cf69b5b3383bef3e5ffbcb9`
- **Subject:** "Add deployment options to README"
- **Inspected:** 2026-07-16
- **Branch created from baseline:** `feat/bh-clearinghouse-mvp`

## Toolchain (verified on this machine)

- Node: `v20.8.0` (repo requires `>=18.18.0`, `.nvmrc` prefers 20)
- pnpm: `10.18.2` (matches `packageManager: pnpm@10.18.2` pinned in `package.json`)
- Monorepo: Turborepo `2.5.8` + pnpm workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/**`, `tooling/*`)

## Application stack (`apps/web`)

Next.js `15.5.9`, React `19.2.1`, TailwindCSS `4.1.14`, Shadcn UI (`@kit/ui`), Supabase-js `2.75.0`, Zod `3.25`, React Query `5.90`, `@tanstack/react-table` `8.21`, react-hook-form `7.65`, i18next, TypeScript `5.9`.

## Structure at baseline

- **Auth:** `packages/features/auth` (`@kit/auth`) — password, magic-link, OAuth, MFA. Routes `apps/web/app/auth/*`. Middleware `apps/web/middleware.ts` does CSRF (`@edge-csrf/nextjs`), MFA gate, and request-id.
- **Account model:** `packages/features/accounts` (`@kit/accounts`) + `public.accounts` table — **personal-account only**. No organizations, teams, memberships, roles, or invitations.
- **DB:** one migration, `apps/web/supabase/migrations/20241219010757_schema.sql` (accounts + RLS `accounts_read`/`accounts_update` + triggers `on_auth_user_created/updated`, `protect_account_fields`). `seed.sql` effectively empty.
- **Storage:** one bucket, `account_image`, **public**. No private buckets.
- **Service role:** already guarded (`packages/supabase/src/get-service-role-key.ts`, `clients/server-admin-client.ts` both `import 'server-only'`).
- **API surface:** Server Actions + `@makerkit/data-loader-supabase`. Only route handlers are `app/version/route.ts` and `app/sitemap.xml/route.ts`. No `app/api` REST layer.
- **Tests:** Playwright e2e in `apps/e2e` (auth + account only). `supabase db test` (pgTAP) wired via `pnpm --filter web supabase:test`. No Vitest / unit runner installed at baseline.

## Environment setup issues encountered and resolved

See `docs/progress/KNOWN_ISSUES.md` ("Resolved during Phase 0") for the full detail:

- `corepack enable` failed with `EPERM` on this machine's Node install location — resolved with a direct `npm install -g pnpm@10.18.2`.
- Docker Desktop was not initially installed, which blocks `pnpm --filter web supabase:start` and any Supabase-backed Playwright test. Resolved once Docker Desktop was installed locally.

## Command output

A full `pnpm install` / `pnpm lint` / `pnpm typecheck` / `pnpm test` / `supabase:start` run against the pure baseline (before any Phase 1 route/nav changes) was not separately captured to a log file. Phase 1 closeout (`docs/progress/TEST_EVIDENCE.md`) captures the first recorded `lint` / `typecheck` / e2e run, taken with Phase 1's route skeletons and nav changes already applied — treat that as the earliest command-output evidence in this repository's history.

**Not verified — no separate pre-Phase-1 command log exists.**
