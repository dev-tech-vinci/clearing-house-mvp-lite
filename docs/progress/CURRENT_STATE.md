# Current State

> Snapshot of where the build stands right now. Updated at the end of every phase.

- **Last completed phase:** Phase 3 — Providers, facilities, patients, coverages (complete)
- **Branch:** `feat/bh-clearinghouse-mvp`
- **Baseline commit:** `37def9c20b01a3514cf69b5b3383bef3e5ffbcb9`
- **App state:** Multi-tenant with synthetic healthcare entities now. Phase 2 added organizations/memberships/roles/RLS (`20260718232603_organizations.sql`). Phase 3 adds migration `20260719011359_entities.sql`: `providers`, `facilities`, `patients`, `subscribers`, `coverages`, `organization_payer_enrollments`, all org-scoped via `has_org_access` RLS, plus two `SECURITY DEFINER` cross-org FK-consistency triggers (`kit.check_subscriber_patient_org`, `kit.check_coverage_org_consistency`). New package `packages/features/entities` (NPI Luhn validation, per-entity CRUD server actions, tabbed list+dialog UI). New routes `/home/providers` (Providers / Facilities / Payer Enrollments tabs) and `/home/patients` (Patients / Subscribers / Coverages tabs), both new — Phase 1 never created placeholders for these. `coverages.payer_id` / `organization_payer_enrollments.payer_id` are nullable with no FK yet (`public.payers` doesn't exist until Phase 4); both carry a required `payer_label` text field until then. Platform/support roles still have no cross-org RLS bypass (unchanged from Phase 2 — see `docs/progress/DECISIONS.md`). No claims, payers directory, or EDI domain logic exists yet.
- **Next phase:** Phase 4 — Payer directory & versioned rule admin (not started; do not start until this phase's evidence is reviewed)
