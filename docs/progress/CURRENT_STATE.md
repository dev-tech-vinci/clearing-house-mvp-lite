# Current State

> Snapshot of where the build stands right now. Updated at the end of every phase.

- **Last completed phase:** Phase 2 — Organizations, memberships, roles & RLS (complete)
- **Branch:** `feat/bh-clearinghouse-mvp`
- **Baseline commit:** `37def9c20b01a3514cf69b5b3383bef3e5ffbcb9`
- **App state:** Multi-tenant now. New migration `20260718232603_organizations.sql` adds `organizations`, `organization_memberships`, `roles`, `permissions`, `role_permissions`, `invitations`, the `user_profiles` view, and five `SECURITY DEFINER` helper functions (`has_org_access`, `has_permission`, `create_organization`, `accept_invitation`, `get_organization_members`), all RLS-enforced. Nine roles + the full permission matrix are seeded from the architecture doc. New packages `packages/features/organizations` (org switcher, create-org dialog, members/invitations management, invite-accept flow) and `packages/features/access-control` (role/permission constants + server/client permission checks). `/home/users` now shows real members + pending invitations instead of the Phase 1 placeholder; a new `/home/invitations/accept` route handles invite acceptance. The sidebar shows an organization switcher. Platform/support roles (`platform_super_admin`, `support_manager`, `support_agent`) are seeded but have **no cross-org RLS bypass** in this phase — see `docs/progress/DECISIONS.md`. No claims, payers, or EDI domain logic exists yet.
- **Next phase:** Phase 3 — Providers, facilities, patients, coverages (not started; do not start until this phase's evidence is reviewed)
