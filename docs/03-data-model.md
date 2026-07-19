# Data Model

> Updated per phase. Phase 2 introduces the identity/tenancy entity group; Phase 3 adds provider/coverage; Phase 4 adds the global payer/rules group; Phase 5 adds claims. Later phases add EDI/trace, remittance, support/docs, and governance groups — see `data-model-erd.mmd` for the full target ERD.

## Identity / tenancy (Phase 2)

Introduced by `apps/web/supabase/migrations/20260718232603_organizations.sql`.

| Table | Tenant-owned? | Purpose |
|---|---|---|
| `organizations` | — (is the tenant) | Top-level tenant entity. `id`, `name`, `slug` (unique), `created_at/by`, `updated_at/by`, `deleted_at` (soft delete). |
| `organization_memberships` | via `organization_id` | Links a user to an organization with a role. Unique on `(organization_id, user_id)` where `deleted_at is null`. |
| `roles` | no — global catalog | The nine roles from the architecture role-permission matrix. `key` (e.g. `org_owner`), `name`, `description`, `is_platform_role`. |
| `permissions` | no — global catalog | Permission keys (e.g. `members.invite`, `claims.create_edit`). |
| `role_permissions` | no — global catalog | Maps `roles` to `permissions`, seeded directly from the architecture matrix. |
| `invitations` | via `organization_id` | Pending/accepted/revoked/expired invites. `token` (opaque, unique), `email`, `role_id`, `expires_at` (7 days), `status`. |
| `user_profiles` (view) | — | Thin, RLS-preserving wrapper over `accounts` (`id`, `name`, `email`, `picture_url`, timestamps). `security_invoker = true`, so it is exactly as restrictive as `accounts_read` (self-only) — it does **not** grant cross-user visibility. |

**Every tenant-owned table** in this group carries `organization_id` (FK, not null except `organizations` itself), `created_at/by`, `updated_at/by`, `deleted_at` (soft delete), matching the invariant stated in `CLAUDE.md` / the architecture doc.

### Why cross-member visibility isn't via `user_profiles`

The MakerKit Lite baseline's `accounts_read` RLS policy is self-only (`auth.uid() = id`) — appropriate for a personal-account model, but it means a plain view over `accounts` cannot show one org member another member's name/email without either (a) widening `accounts` RLS for every caller, which would leak profile data platform-wide, or (b) a tenant-scoped alternative. Phase 2 takes route (b): `public.get_organization_members(org_id)` is a `SECURITY DEFINER` function that first calls `has_org_access(org_id)` (raising if the caller isn't a member), then reads `accounts` internally (bypassing its RLS as the function owner) and returns only that organization's members. `accounts_read` itself is untouched.

### Helper functions (used by RLS policies and callable directly)

- `public.has_org_access(org_id uuid) returns boolean` — true if the caller has an active membership in the org.
- `public.has_permission(org_id uuid, permission_key text) returns boolean` — true if the caller's role in that org has the named permission.
- `public.create_organization(org_name text, org_slug text) returns organizations` — the only path that can insert a row into `organizations`; atomically creates the org and assigns the caller as `org_owner`.
- `public.accept_invitation(invitation_token text) returns organization_memberships` — validates the token/email/expiry binding server-side, then inserts the caller's membership and marks the invitation accepted.
- `public.get_organization_members(org_id uuid) returns table(...)` — tenant-scoped member list with name/email/role.

All five are `SECURITY DEFINER` with `set search_path = ''` and fully-qualified references, and each has a narrow `grant execute ... to authenticated` (never `anon`, never `public`). See `docs/04-rbac-and-rls.md` for why each needs to bypass RLS internally and why that's safe.

## Provider / coverage (Phase 3)

Introduced by `apps/web/supabase/migrations/20260719011359_entities.sql`. All six tables are tenant-owned (`organization_id`, `created_at/by`, `updated_at/by`, `deleted_at`), RLS-scoped via `has_org_access(organization_id)` only (no finer permission key — see `docs/progress/DECISIONS.md`), and carry a cosmetic, obviously-synthetic `sim_*_id` label (e.g. `SIM-PROV-A1B2C3D4`) distinct from the real `id` primary key.

| Table | Purpose |
|---|---|
| `providers` | Synthetic rendering/billing providers. `provider_type` (`individual`/`organization`), `npi` (format-checked at the DB layer via a `CHECK`, Luhn-checked at the app layer), name fields gated by type via the `providers_name_by_type` check constraint. NPI unique per org (not globally). |
| `facilities` | Synthetic places of service. `facility_type`, optional NPI, optional address. |
| `patients` | Synthetic patients. Name, date of birth, gender, optional address. **No real PHI — names must be obviously fictional.** |
| `subscribers` | Insurance policy holders, each tied to exactly one `patient_id` via `relationship_to_patient` (`self`/`spouse`/`child`/`other`). |
| `coverages` | Insurance coverage tied to a `subscriber_id` and the `patient_id` it covers. `member_id` is a cosmetic synthetic label (`SIM-MBR-xxxxxxxx`), never a real insurance ID. `payer_id` is nullable with **no FK yet** — see below. |
| `organization_payer_enrollments` | Tracks which simulated payers an org is enrolled with. `payer_id` nullable, no FK yet; `payer_label` is the required display value until Phase 4. |

### Cross-org FK-consistency triggers

RLS alone prevents *reading* another org's row, but not *creating* a row in your own org whose foreign key points at someone else's data. Two `BEFORE INSERT/UPDATE` trigger functions close that gap (both `SECURITY DEFINER`, `set search_path = ''`):

- `kit.check_subscriber_patient_org()` — a `subscribers` row's `organization_id` must match its `patient_id`'s own `organization_id`.
- `kit.check_coverage_org_consistency()` — a `coverages` row's `organization_id` must match both its `subscriber_id`'s and `patient_id`'s organization, **and** its `patient_id` must match the chosen `subscriber_id`'s own `patient_id` (a coverage can't cover a different patient than the subscriber it's attached to).

Covered by `apps/web/supabase/tests/database/entities-rls.test.sql`'s cross-org and same-org-mismatch negative tests.

### `payer_id` — wired in Phase 4

`coverages.payer_id` and `organization_payer_enrollments.payer_id` are now FK-constrained to `public.payers(id)` (`20260719020018_payers_fk_backfill.sql`), remaining nullable — a coverage/enrollment may still reference a payer outside the ten seeded profiles. `payer_label` remains as the display fallback for that case; it is no longer the sole source of truth. See `docs/06-payer-rules.md`.

## Payer / rules (Phase 4)

Introduced by `apps/web/supabase/migrations/20260719015820_payers.sql`. Unlike every prior group, these tables carry **no `organization_id`** — they are global reference data, readable by any authenticated user, writable only by `platform_super_admin` (via the new `public.is_platform_admin()` helper). Full detail, seed list, and rule-versioning semantics: `docs/06-payer-rules.md`.

| Table | Purpose |
|---|---|
| `payers` | The directory. `sim_payer_id` (unique, `SIM-`-prefixed), `category` (10 architecture categories), `scope`, `is_active`, soft-deletable. Exactly ten seeded. |
| `payer_aliases` | Alternate search names. |
| `payer_routes` | Simulated connectivity routes (not real). |
| `payer_supported_transactions` | Simulated supported X12 transaction types per payer. |
| `payer_rules` | Stable rule identity (`rule_code`, `category`, optional `payer_id`/`claim_type`); `payer_rules_payer_scope` CHECK enforces `payer_id` is required for `payer_edit`/`adjudication` categories only. |
| `payer_rule_versions` | Immutable versioned rule content, including the `rejection_or_denial` designation. Adding a version never mutates a prior one. |
| `payer_test_profiles` | Per-payer simulated adjudication default (`paid`/`denied`); scaffolding for Phase 7. |

### `is_platform_admin()`

`public.is_platform_admin() returns boolean` — `SECURITY DEFINER`, `set search_path = ''`, true if the caller holds `platform_super_admin` in any organization membership. Used only to gate writes on the seven tables above; grants no visibility into tenant-owned data and does not reopen the Phase 2 decision against a platform-role cross-org RLS bypass (see `docs/progress/DECISIONS.md`).

## Claims (Phase 5)

Introduced by `apps/web/supabase/migrations/20260719030000_claims.sql`. Org-owned, tenancy contract, `has_org_access`/`has_permission`-gated RLS. Full detail (rule-engine wiring, RBAC design, unsupported-loop list, status scope): `docs/05-claim-lifecycle.md`.

| Table | Purpose |
|---|---|
| `claims` | Header (`claim_type`, patient/subscriber/coverage/billing-provider, `status` scoped to `draft`/`validation_failed`/`validated`/`approved` this phase, `last_validation_result`). |
| `professional_claim_details` / `institutional_claim_details` | 1:1 detail rows (rendering provider / facility+type-of-bill+admission-discharge). |
| `claim_diagnoses` / `claim_lines` | ICD-10-CM diagnosis pointers; CPT/HCPCS or revenue-code service lines. |
| `claim_documents` / `claim_relationships` / `claim_batches` | Schema + RLS only this phase — no dedicated UI yet (document storage, correction/resubmission, and batch/EDI generation are later phases). |

### Cross-org FK-consistency

Same trigger pattern as Phase 3 (`kit.check_*_org` functions), reused and extended: `kit.check_claim_org_consistency()` on `claims`; a shared `kit.check_claim_child_org_consistency()` for the simple children; two narrower triggers for the rendering-provider/facility org match on the two detail tables (which also verify `claim_type` agreement); `kit.check_claim_relationships_org()` for cross-claim links.

### RBAC at the RLS layer

`claims` UPDATE uses **two permissive policies** (`claims_update_edit` requiring `claims.create_edit` and excluding `status = 'approved'`; `claims_update_approve` requiring `claims.approve_submit`) — the first use of multiple permissive policies for the same command in this repo. See `docs/05-claim-lifecycle.md` for why this throws (rather than silently filtering, as Phase 4's single-policy `payers_update` does) when a `claims_specialist` attempts to approve.

## Future entity groups (not yet built)

EDI/trace (Phase 6) · Remittance (Phase 7) · Support/docs (Phase 8) · Governance/audit (Phase 8). See `data-model-erd.mmd` for the abridged target ERD across all phases.
