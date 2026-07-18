# Implementation Changelog

> Human-readable, phase-by-phase summary of what actually changed in the codebase. Complements `git log` — this is the narrative version.

## Phase 0 — Repository baseline & safety

- No application behavior changed.
- Added `CLAUDE.md` (agent operating contract) and `docs/progress/*` skeletons.
- Created feature branch `feat/bh-clearinghouse-mvp`.
- Recorded baseline environment, dependency versions, and command output in `docs/01-repository-baseline.md`.

## Phase 1 — Branding, navigation & route skeletons

- Rebranded the public site strings in `apps/web/.env` from MakerKit defaults to "BH Clearinghouse Simulator" (name, title, description — all public, non-secret config).
- Added nine placeholder customer routes under `apps/web/app/home/(customer)/`: `dashboard`, `claims`, `claim-batches`, `remittances`, `payers`, `documents`, `support`, `users`, `audit`. Each renders a shared `PlaceholderNotice` component (`apps/web/components/placeholder-notice.tsx`) stating the screen is a Phase-1 skeleton with synthetic-only data.
- Added `apps/web/app/support/{layout,page}.tsx` and `apps/web/app/admin/{layout,page}.tsx` — new protected portal skeletons, each using a shared `PortalHeader` component (`apps/web/components/portal-header.tsx`) that reuses the existing profile-account dropdown.
- Extended `apps/web/config/paths.config.ts` with the nine new customer paths plus `supportPortal` (`/support`) and `adminPortal` (`/admin`).
- Extended `apps/web/config/navigation.config.tsx` with a new "Clearinghouse" nav group linking all nine customer routes, each with a `lucide-react` icon.
- Refactored `apps/web/middleware.ts`: extracted the existing `/home/*` auth+MFA gate into a reusable `requireAuthHandler` function and applied it to `/support/*` and `/admin/*` as well. This is intentionally the same coarse "logged in" gate as `/home` — Phase 2 replaces it with organization-membership and role-based checks once those tables exist.
- Added new i18n keys to `apps/web/public/locales/en/common.json` for the new nav labels and portal titles.
- Added `apps/e2e/tests/navigation/protected-routes.spec.ts` — 22 Playwright cases covering unauthenticated redirect-to-sign-in and authenticated reachability for all 11 new routes.
- No database migrations. No new packages under `packages/features/`.
