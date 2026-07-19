# RBAC & Row-Level Security

> Introduced in Phase 2. Updated as later phases add tenant-owned tables and role-gated actions. Phase 8 resolves the "no cross-org bypass yet" deferral below with the audited support-access-session model.

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

## Deliberate scope boundary (Phase 2–7): no cross-org bypass yet

`platform_super_admin`, `support_manager`, and `support_agent` were seeded as roles with their full permission-matrix rows recorded in `role_permissions` from Phase 2 (documentation-complete), **but Phase 2 through Phase 7 granted them no RLS bypass.** There was no code path in those phases that let a user see an organization they didn't hold a membership row in, regardless of role.

**Why:** the architecture ties platform/support cross-org visibility to the audited support-access-session model ("no silent impersonation" — assigned ticket, typed reason, time-limited, least-privilege, full audit trail), which was deferred to Phase 8. Building an unaudited cross-tenant bypass ahead of that infrastructure would have been inventing a backdoor the architecture explicitly says must not exist without an audit trail. Through Phase 7, **tenant isolation was strict for every role, including these three** — confirmed by every phase's pgTAP suite's cross-tenant-denial assertions, which never special-cased any role.

`platform_super_admin` still has no cross-org bypass — `is_platform_admin()` (Phase 4) only gates writes to global reference data (payers/payer rules), never tenant-owned data. Only `support_manager`/`support_agent`, and only through the mechanism below, gained one.

## Phase 8: the audited support-access-session bypass

Two new access-control primitives, alongside `has_org_access`/`has_permission` (Phase 2) and `is_platform_admin` (Phase 4):

- **`has_role(role_key)`** — true if the caller holds the given role key in *any* organization membership. Generalizes `is_platform_admin()`'s pattern to any role, not just `platform_super_admin`. Used to give `support_manager` full ticket-queue visibility while `support_agent` gets ticket-scoped visibility (assigned tickets, or unassigned ones they could pick up) — a nuance the Phase 2 migration comment explicitly flagged as deferred, since the seeded permission matrix grants both roles the identical `organizations.view_all` permission key and can't express the manager-vs-agent distinction on its own.
- **`has_active_support_session(target_org_id)`** — true if the caller has a currently-active (started, unexpired, unended) `support_access_sessions` row for that org. This is the **only** RLS bypass a `support_manager`/`support_agent` ever gets into tenant-owned data, and it is read-only by construction: it appears only in the `SELECT` policies of `remittances` and `documents` (the two "E" — session-scoped — rows in the architecture's abridged role matrix), never in an `INSERT`/`UPDATE` policy anywhere.

A session requires, all enforced at the DB layer (not just app-level discipline):
- **An assigned ticket** — `support_access_sessions_insert`'s `WITH CHECK` requires `support_tickets.assigned_to` to already equal the entering user. There is no way to start a session against a ticket you haven't first self-assigned.
- **A typed reason** — `reason` is `NOT NULL`, and the Zod schema additionally requires at least 10 characters.
- **A time limit** — `expires_at` is `NOT NULL` with a `CHECK (expires_at > started_at)` constraint; the UI caps duration at 240 minutes.
- **Least-privilege, read-only** — `granted_scope text[]` defaults to `'{}'`; nothing in this phase implements a mechanism to extend a session's scope beyond the default read access, so every session is read-only in practice, matching "no claim-data edits unless explicitly granted."
- **Start/end timestamps + full audit trail** — every session start/end is also logged to `audit_events` (`support_session.started`/`support_session.ended`), independent of the session row itself.
- **A prominent banner** — `SupportAccessBanner` renders "SUPPORT ACCESS ACTIVE" with the reason and expiry, driven by the exact same `activeSession` lookup that gates the session-scoped data sections — there is no code path that shows a customer's remittances/documents to support staff without the banner being visible at the same time.
- **Customer-visible history** — `support_access_sessions_read`'s `has_org_access(organization_id)` clause means the customer org can always see every session (active or ended) ever granted against it, via `SupportAccessHistory` on `/home/support`.

## Governance: append-only audit_events

`audit_events` (Phase 8) has an `INSERT` policy only — no `UPDATE`/`DELETE` grant to `authenticated` at all, the same proven pattern as `transaction_events` (Phase 6). A shared `logAuditEvent()` helper (`@kit/audit`) is called explicitly from every security-sensitive action this phase names: `approveClaimAction` (`claim.approved`), `submitClaimAction` (`claim.submitted`), `updateMemberRoleAction` (`member.role_changed`), `startAccessSessionAction`/`endAccessSessionAction` (`support_session.started`/`.ended`), and `getDocumentSignedUrlAction` (`document.view`/`document.download`). There is no trigger-based auto-instrumentation — a future security-sensitive action needs its own explicit `logAuditEvent()` call, or it silently won't appear in the audit trail.

## RLS policy summary

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `organizations` | `deleted_at is null and has_org_access(id)` | none (only via `create_organization()`, which runs as the function owner and bypasses RLS) | `has_permission(id, 'organizations.update')` |
| `organization_memberships` | `has_org_access(organization_id)` | none (only via `create_organization()` / `accept_invitation()`) | `has_permission(organization_id, 'members.assign_role')` (covers role changes and soft-delete/removal) |
| `invitations` | `has_org_access(organization_id)` | `has_permission(organization_id, 'members.invite')` | `has_permission(organization_id, 'members.invite')` (covers revoke) |
| `roles` / `permissions` / `role_permissions` | `true` (global read-only catalog) | none to `authenticated` | none to `authenticated` |
| `support_tickets` | `has_org_access` OR `has_role('support_manager')` OR (`has_role('support_agent')` AND assigned-to-me-or-unassigned) | `has_permission(org, 'support.tickets.create')` | two policies: customer (`has_org_access`/same permission) and support (`has_role` manager/agent, same scoping as SELECT) |
| `documents` | `has_permission(org, 'documents.view_download')` OR `has_active_support_session(org)` | `has_permission(org, 'documents.view_download')` | same (soft-delete only) |
| `support_access_sessions` | `has_org_access(org)` OR `support_user_id = auth.uid()` OR `has_role('support_manager')` | `has_platform_permission('support.access_session.enter')` AND caller is the ticket's `assigned_to` | `support_user_id = auth.uid()` OR `has_role('support_manager')` (ending a session) |
| `audit_events` | `has_permission`/`has_platform_permission('audit.view'\|'audit.view_own')` | `actor_id = auth.uid()` AND (`has_org_access` OR `has_platform_permission('support.access_session.enter')`) | none — append-only |

Every helper function referenced above is `SECURITY DEFINER` with `set search_path = ''` — see `docs/03-data-model.md` for the full list and why each needs to read tenant tables as its own owner (to avoid recursive-policy evaluation when a policy on `organization_memberships` calls a function that itself queries `organization_memberships`).

## Documents: private storage, never a public URL

`documents` (Phase 8) is served from a **private** Storage bucket (`org_documents`, `public = false`, `file_size_limit`/`allowed_mime_types` allowlisted) — never the pre-existing public `account_image` bucket, which stays reserved for avatars. `storage.objects` RLS is keyed on a `{organization_id}/...` path convention: `public.has_permission(((storage.foldername(name))[1])::uuid, 'documents.view_download')` for the org-owned path, `OR public.has_active_support_session(...)` for the session-scoped path. A document is only ever reachable via a short-TTL (60s) signed URL issued by `getDocumentSignedUrlAction`, which itself only succeeds if the caller's own RLS-scoped client can already `SELECT` that storage object — the action adds no second access check on top of RLS, it only logs what RLS already allowed, to both `document_access_events` (detailed, per-access) and `audit_events` (`document.view`/`document.download`, the coarser cross-cutting log).

## Negative tests (pgTAP)

`apps/web/supabase/tests/database/organizations-rls.test.sql` — 18 assertions, run via `supabase db test`:

- **Same-tenant read allowed:** an org's owner can select that org and its own membership row.
- **Cross-tenant read denied:** the same owner gets zero rows for a different org, `has_org_access()` returns false, and `get_organization_members()` raises for it.
- **Role without permission denied:** a `claims_specialist` (who lacks `members.invite`) has their `INSERT` into `invitations` rejected by RLS; a positive control confirms they *do* have `claims.create_edit`.
- **Invite → accept flow:** an owner creates an invitation; the invited user (matching email, not yet a member) accepts it via `accept_invitation()` and gains `has_org_access()`; the invitation's status flips to `accepted`.
- **Wrong-email negative:** a different user cannot accept an invitation addressed to someone else's email.
- **Expired negative:** an invitation past `expires_at` cannot be accepted.
- **`create_organization` bootstrap:** a brand-new user with no memberships can create an org and is atomically made its owner; an unrelated user has no access to that new org.

`apps/web/supabase/tests/database/support-documents-audit-rls.test.sql` (Phase 8) — 30 assertions:

- Org-owned CRUD for `support_tickets`/`support_messages`/`documents`, cross-tenant read/insert denial, and cross-org FK-consistency trigger negatives (`support_messages`→ticket, `support_ticket_documents`→ticket, `support_ticket_documents`→document, `documents`→claim).
- **Ticket-scoping:** a `support_agent` sees their own assigned ticket and any unassigned ticket, but not one assigned to a different agent; a `support_manager` sees every ticket regardless of assignment.
- **The support-access session mechanism, proven end to end:** starting a session against a ticket not assigned to the caller is denied outright (RLS `WITH CHECK`); once genuinely assigned and a session is active, the agent can read a document and a remittance belonging to that org; ending the session (or letting it naturally expire, tested as a distinct case from manually ending it) immediately removes that access; a customer org can see the full session history (active and ended) via `support_access_sessions_read`.
- **Documents privacy:** the `org_documents` bucket's `public` flag is `false`; a cross-tenant `storage.objects` read for another org's path prefix returns zero rows, the same-org read succeeds.
- **Audit append-only:** `UPDATE`/`DELETE` on `audit_events` both fail with `permission denied for table audit_events` — no grant exists at all, not merely an RLS filter.

## UI enforcement (defense in depth, not the source of truth)

The invite/manage-members UI (`packages/features/organizations`) hides the "Invite member" button, per-row role selectors, and remove/revoke actions unless the server-computed `has_permission(org_id, 'members.invite')` is true for the current user. This is a UX convenience — the actual enforcement is the RLS policies above; hiding a button never substitutes for a policy.
