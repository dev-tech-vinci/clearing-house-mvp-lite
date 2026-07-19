# Data Model

> Updated per phase. Phase 2 introduces the identity/tenancy entity group. Later phases add provider/coverage, payer, claims, EDI/trace, remittance, support/docs, and governance groups — see `data-model-erd.mmd` for the full target ERD.

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

## Future entity groups (not yet built)

Provider/coverage (Phase 3) · Payer (Phase 4) · Claims (Phase 5) · EDI/trace (Phase 6) · Remittance (Phase 7) · Support/docs (Phase 8) · Governance/audit (Phase 8). See `data-model-erd.mmd` for the abridged target ERD across all phases.
