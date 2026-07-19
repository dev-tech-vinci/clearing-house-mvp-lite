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

## Phase 2 — Organizations, memberships, roles & RLS

- Added migration `apps/web/supabase/migrations/20260718232603_organizations.sql`: tables `organizations`, `organization_memberships`, `roles`, `permissions`, `role_permissions`, `invitations`; view `user_profiles` (`security_invoker = true` wrapper over `accounts`); functions `has_org_access`, `has_permission`, `create_organization`, `accept_invitation`, `get_organization_members` (all `SECURITY DEFINER`, `set search_path = ''`, narrow `grant execute ... to authenticated`); RLS on every new table; installs the `pgtap` extension (first pgTAP suite in this repo); seeds the nine roles + full permission-matrix mapping sourced from the architecture doc.
- Added `apps/web/supabase/tests/database/organizations-rls.test.sql` — 18 pgTAP assertions: same-tenant read allowed, cross-tenant read denied (organizations table, `has_org_access`, `get_organization_members`), role-without-permission denied (with a positive-control counterpart), full invite→accept flow, wrong-email negative, expired-token negative, and `create_organization` bootstrap/isolation.
- Added package `packages/features/organizations` (`@kit/organizations`): schemas (`create-organization`, `invite-member`, `update-member-role`, `remove-member`, `revoke-invitation`, `accept-invitation`, `switch-organization`); server API (`organizations.api.ts`) and server actions (`server-actions.ts`, all via `enhanceAction`, running as the calling user so RLS is the real enforcement); components `OrganizationSwitcher(+Container)`, `CreateOrganizationDialog`, `InviteMemberDialog`, `OrganizationMembersPage`, `AcceptInvitationPanel`.
- Added package `packages/features/access-control` (`@kit/access-control`): `ROLES`/`PERMISSIONS` TS constants mirroring the SQL seed keys; server helpers `hasOrgAccess`/`hasPermission` (wrap the `has_org_access`/`has_permission` RPCs); client hook `useHasPermission`.
- Modified `apps/web/app/home/_components/home-sidebar.tsx` — added `OrganizationSwitcherContainer` to the sidebar header.
- Replaced the Phase 1 placeholder at `apps/web/app/home/(customer)/users/page.tsx` with a real members + pending-invitations view, gated on a server-computed `has_permission(org_id, 'members.invite')` check.
- Added `apps/web/app/home/(customer)/invitations/accept/page.tsx` (`?token=`) and `pathsConfig.app.acceptInvitation`.
- Added `apps/e2e/tests/organizations/organizations.spec.ts` — 3 Playwright cases: create-organization-and-see-it-in-switcher, owner-sees-members-and-can-invite, accept-invitation-page-error-handling. Not required by this phase's build-plan entry (which only specifies pgTAP) but added because building real UI without driving it in a browser isn't verification — see `docs/progress/DECISIONS.md` for the three real bugs this caught.
- `apps/web/next.config.mjs`: added `@kit/access-control` and `@kit/organizations` to `transpilePackages`/`optimizePackageImports`; added `devIndicators: false` (see Decisions/Known Issues).
- No changes to `apps/web/supabase/seed.sql` — the pgTAP suite creates and rolls back its own fixture data rather than relying on permanent seed rows.

## Phase 3 — Providers, facilities, patients, coverages

- Added migration `apps/web/supabase/migrations/20260719011359_entities.sql`: tables `providers`, `facilities`, `patients`, `subscribers`, `coverages`, `organization_payer_enrollments`, each org-scoped via `has_org_access(organization_id)` RLS (SELECT/INSERT/UPDATE), full tenancy contract (`organization_id`, `created_at/by`, `updated_at/by`, `deleted_at`), per-table `sim_*_id` cosmetic synthetic labels, and NPI `CHECK` constraints on `providers`/`facilities`; trigger functions `kit.check_subscriber_patient_org()` and `kit.check_coverage_org_consistency()` (both `SECURITY DEFINER`) enforcing cross-org FK consistency that RLS alone can't.
- Added `apps/web/supabase/tests/database/entities-rls.test.sql` — 22 pgTAP assertions covering org-owned CRUD, cross-tenant read/insert denial, an NPI-format negative, and both FK-consistency trigger negatives (cross-org and same-org patient/subscriber mismatch), across all six tables.
- Added package `packages/features/entities` (`@kit/entities`): `lib/npi.ts` (CMS NPI Luhn checksum validator, `80840`-prefixed); per-entity Zod schemas (Create/Update/Deactivate + a permissive `*FormSchema` for client-side dialog typing); `entities.api.ts` (read methods); six server-action files (`providers`/`facilities`/`patients`/`subscribers`/`coverages`/`enrollments.actions.ts`, all via `enhanceAction`, running as the calling user); components — `ProviderDialog`/`ProvidersTab`, `FacilityDialog`/`FacilitiesTab`, `EnrollmentDialog`/`EnrollmentsTab`, `PatientDialog`/`PatientsTab`, `SubscriberDialog`/`SubscribersTab`, `CoverageDialog`/`CoveragesTab`, and the tab-group wrappers `ProvidersPageContent`/`PatientsPageContent` — using `@kit/ui/data-table` (the plain TanStack Table wrapper) and `@kit/ui/tabs`.
- Added new routes `apps/web/app/home/(customer)/providers/page.tsx` and `.../patients/page.tsx` — both brand new (Phase 1 never created placeholders for these) — each server-loading the current org's data and rendering the corresponding `*PageContent`.
- Extended `apps/web/config/paths.config.ts` (`providers`, `patients`) and `apps/web/config/navigation.config.tsx` (new nav entries between Dashboard and Claims) and `public/locales/en/common.json`.
- Added `apps/e2e/tests/entities/entities.spec.ts` — 3 Playwright cases: add a provider + facility, add a patient, cross-org isolation (a second org sees neither). Not required by this phase's build-plan entry (pgTAP-only) but added for the same reason as Phase 2's UI suite — see `docs/progress/DECISIONS.md` for the real bug this caught.
- `apps/web/package.json` / `next.config.mjs`: added `@kit/entities` as a dependency and to `transpilePackages`/`optimizePackageImports`.
- No changes to `apps/web/supabase/seed.sql` — same rationale as Phase 2 (no stable demo org exists yet to attach permanent seed rows to); pgTAP fixtures + organic UI creation satisfy the build plan's "seed a few synthetic providers/patients" for now.
