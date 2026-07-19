# Data Model

> Updated per phase. Phase 2 introduces the identity/tenancy entity group; Phase 3 adds provider/coverage. Later phases add payer, claims, EDI/trace, remittance, support/docs, and governance groups — see `data-model-erd.mmd` for the full target ERD.

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

### `payer_id` — deliberately unwired

`coverages.payer_id` and `organization_payer_enrollments.payer_id` are nullable `uuid` columns with **no foreign key constraint** — `public.payers` doesn't exist until Phase 4. Both tables carry a required `payer_label` text field for display until then. Phase 4 must add the FK constraint to both tables once the payer directory exists.

## Future entity groups (not yet built)

Payer (Phase 4) · Claims (Phase 5) · EDI/trace (Phase 6) · Remittance (Phase 7) · Support/docs (Phase 8) · Governance/audit (Phase 8). See `data-model-erd.mmd` for the abridged target ERD across all phases.
