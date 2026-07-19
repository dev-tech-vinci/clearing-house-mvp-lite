# RBAC & Row-Level Security

> Introduced in Phase 2. Updated as later phases add tenant-owned tables and role-gated actions.

## The nine roles

Seeded in `public.roles` by `apps/web/supabase/migrations/20260718232603_organizations.sql`, sourced directly from the role-permission matrix in `docs/Behavioral_Health_Clearinghouse_MVP_Technical_Architecture.md`:

| Role key | Name | Scope |
|---|---|---|
| `platform_super_admin` | Platform Super Admin | Platform-wide |
| `support_manager` | Support Manager | Platform-wide |
| `support_agent` | Support Agent | Platform-wide |
| `org_owner` | Org Owner | Org-scoped |
| `org_admin` | Org Admin | Org-scoped |
| `claims_manager` | Claims Manager | Org-scoped |
| `claims_specialist` | Claims Specialist | Org-scoped |
| `remittance_specialist` | Remittance Specialist | Org-scoped |
| `read_only_auditor` | Read-Only Auditor | Org-scoped |

The six org-scoped roles are assigned via `organization_memberships.role_id` and are fully functional in Phase 2 (create org → owner; invite → assign any of the five non-owner org-scoped roles; change role; remove member).

## Deliberate scope boundary: no cross-org bypass yet

`platform_super_admin`, `support_manager`, and `support_agent` are seeded as roles with their full permission-matrix rows recorded in `role_permissions` (documentation-complete), **but Phase 2 does not grant them any RLS bypass.** Concretely: there is no code path in this phase that lets a user see an organization they don't hold a membership row in, regardless of role.

**Why:** the architecture ties platform/support cross-org visibility to the audited support-access-session model ("no silent impersonation" — assigned ticket, typed reason, time-limited, least-privilege, full audit trail), which is Phase 8 scope. Building an unaudited cross-tenant bypass now, ahead of that infrastructure, would be inventing a backdoor the architecture explicitly says must not exist without an audit trail. In Phase 2, **tenant isolation is strict for every role, including these three** — confirmed by the pgTAP suite's cross-tenant-denial assertions, which don't special-case any role.

This means: until Phase 8, a `platform_super_admin` seeded via a future admin bootstrap process would need their own `organization_memberships` row in an org to access it, exactly like any other role. That's intentional, not an oversight.

## RLS policy summary

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `organizations` | `deleted_at is null and has_org_access(id)` | none (only via `create_organization()`, which runs as the function owner and bypasses RLS) | `has_permission(id, 'organizations.update')` |
| `organization_memberships` | `has_org_access(organization_id)` | none (only via `create_organization()` / `accept_invitation()`) | `has_permission(organization_id, 'members.assign_role')` (covers role changes and soft-delete/removal) |
| `invitations` | `has_org_access(organization_id)` | `has_permission(organization_id, 'members.invite')` | `has_permission(organization_id, 'members.invite')` (covers revoke) |
| `roles` / `permissions` / `role_permissions` | `true` (global read-only catalog) | none to `authenticated` | none to `authenticated` |

Every helper function referenced above is `SECURITY DEFINER` with `set search_path = ''` — see `docs/03-data-model.md` for the full list and why each needs to read tenant tables as its own owner (to avoid recursive-policy evaluation when a policy on `organization_memberships` calls a function that itself queries `organization_memberships`).

## Negative tests (pgTAP)

`apps/web/supabase/tests/database/organizations-rls.test.sql` — 18 assertions, run via `supabase db test`:

- **Same-tenant read allowed:** an org's owner can select that org and its own membership row.
- **Cross-tenant read denied:** the same owner gets zero rows for a different org, `has_org_access()` returns false, and `get_organization_members()` raises for it.
- **Role without permission denied:** a `claims_specialist` (who lacks `members.invite`) has their `INSERT` into `invitations` rejected by RLS; a positive control confirms they *do* have `claims.create_edit`.
- **Invite → accept flow:** an owner creates an invitation; the invited user (matching email, not yet a member) accepts it via `accept_invitation()` and gains `has_org_access()`; the invitation's status flips to `accepted`.
- **Wrong-email negative:** a different user cannot accept an invitation addressed to someone else's email.
- **Expired negative:** an invitation past `expires_at` cannot be accepted.
- **`create_organization` bootstrap:** a brand-new user with no memberships can create an org and is atomically made its owner; an unrelated user has no access to that new org.

## UI enforcement (defense in depth, not the source of truth)

The invite/manage-members UI (`packages/features/organizations`) hides the "Invite member" button, per-row role selectors, and remove/revoke actions unless the server-computed `has_permission(org_id, 'members.invite')` is true for the current user. This is a UX convenience — the actual enforcement is the RLS policies above; hiding a button never substitutes for a policy.
