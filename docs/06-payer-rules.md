# Payer Directory & Rules (Phase 4)

> Simulation only. All payer profiles are synthetic (`SIM-` prefixed), fictional, and not connected to any real payer, clearinghouse, or production X12 endpoint. No claim of HIPAA certification or production conformance is made or implied.

## Why payers are global, not tenant-owned

Every table introduced in Phase 2/3 is scoped to a single organization via `organization_id` + `has_org_access()`. Payers and their rules are different: a payer directory and its adjudication rules are reference data that every organization needs to see the same copy of — there is exactly one "SIM Medicare FFS National" in this simulation, not one per tenant. Modeling them as tenant-owned would mean either duplicating the directory into every org (drift-prone, meaningless) or inventing a fake "owning org" for global data (misleading).

Instead:
- `payers`, `payer_aliases`, `payer_routes`, `payer_supported_transactions`, `payer_rules`, `payer_rule_versions`, `payer_test_profiles` carry no `organization_id` at all.
- **Read:** any authenticated user (any org member) can read the active directory and rule set.
- **Write:** only a caller holding the `platform_super_admin` role (in *any* organization membership) can insert/update. Enforced via `public.is_platform_admin()`, a new `SECURITY DEFINER` helper, used the same way `has_org_access`/`has_permission` are used elsewhere.

`is_platform_admin()` is scoped narrowly: it is only consulted by RLS policies on the seven tables in this migration. It does **not** reopen the Phase 2 decision that platform/support roles get no cross-org bypass into tenant-owned data (organizations, patients, providers, claims, ...) — see `docs/progress/DECISIONS.md` Phase 2 and Phase 4 entries.

## Tables

| Table | Purpose |
|---|---|
| `payers` | The directory itself. `sim_payer_id` (unique, `SIM-`-prefixed), `display_name`, `category` (one of the 10 architecture categories below), `scope` (national/state/regional), `is_active`, soft-deletable (`deleted_at`). |
| `payer_aliases` | Alternate names/abbreviations shown in search. |
| `payer_routes` | Simulated connectivity routes (`direct`/`clearinghouse`/`gateway`). Not real production routes. |
| `payer_supported_transactions` | Which X12 transaction types (`837P`, `837I`, `835`, `276`, `277`, `270`, `271`, `999`, `TA1`, `277CA`) a payer "supports" in the simulation. |
| `payer_rules` | Stable rule identity (`rule_code`, `category`, optional `payer_id`, optional `claim_type`). |
| `payer_rule_versions` | The actual versioned, explainable rule content — never mutated after insert; editing a rule always inserts a new version. |
| `payer_test_profiles` | Per-payer simulated adjudication default (`paid`/`denied`), consumed by the Phase 7 adjudication simulator. |

## The ten seeded `SIM-` payers

Exactly ten, matching the ten-claim test-category set the build plan uses in later phases:

| `sim_payer_id` | Category | Display name |
|---|---|---|
| `SIM-MCFFS-001` | `medicare_ffs` | SIM Medicare FFS National |
| `SIM-MCADV-001` | `medicare_advantage` | SIM Medicare Advantage Plan |
| `SIM-MDFFS-001` | `medicaid_ffs` | SIM Medicaid FFS State Program |
| `SIM-MDMCO-001` | `medicaid_mco` | SIM Medicaid Managed Care Plan |
| `SIM-PPO-001` | `commercial_ppo` | SIM Commercial PPO Network |
| `SIM-HMO-001` | `commercial_hmo` | SIM Commercial HMO Network |
| `SIM-BLUE-001` | `blue_plan` | SIM Blue-Style Plan |
| `SIM-TRICARE-001` | `tricare` | SIM TRICARE-Style Plan |
| `SIM-MKTPL-001` | `marketplace` | SIM Marketplace Exchange Plan |
| `SIM-RBH-001` | `regional_bh` | SIM Regional Behavioral Health Network |

Each has an alias row, a simulated clearinghouse route, and all 6 supported-transaction types seeded. Two carry `payer_test_profiles.default_outcome = 'denied'` (`SIM-RBH-001` — missing prior auth; `SIM-MDMCO-001` — benefit limit exhausted), realizing Phase 7's "8 paid / 2 denied" ten-claim demo set — see "Adjudication wiring" below for how the Phase 7 simulator actually consumes this.

## Rule categories and versioning

`payer_rules.category` is one of:

| Category | `payer_id` | Meaning |
|---|---|---|
| `universal` | null | Applies to every claim regardless of payer (e.g. "at least one diagnosis code"). |
| `claim_type` | null | Applies by claim type (`professional`/`institutional`) across all payers. |
| `payer_edit` | required | Payer-specific pre-adjudication edit (e.g. "requires an active enrollment"). |
| `adjudication` | required | Payer-specific post-adjudication check. |
| `informational` | null | Never blocks; informational notice only. |

A DB `CHECK` constraint (`payer_rules_payer_scope`) enforces the `payer_id` requirement per category at the schema level, not just in the UI.

A `payer_rules` row is a **stable identity** (`rule_code`, unique, `SIM-`-prefixed). All actual rule content — the condition, outcome, severity, explanation, and effective dates — lives in `payer_rule_versions`, one immutable row per version. Adding a version never touches an existing version row; `AddRuleVersionDialog` computes `max(version_number) + 1` and inserts. The admin UI's rule-version-history view reads every version for a rule, unfiltered, so the full history is always visible.

Seeded: 3 universal + 2 claim-type + 10 payer-edit (one per payer) + 10 adjudication (one per payer) + 2 informational = 27 rule versions across 27 rules.

### The rejection-vs-denial designation

Every `payer_rule_versions` row carries `rejection_or_denial` (`'rejection' | 'denial' | 'not_applicable'`), matching the architecture's hard distinction between:
- **Rejection** — pre-adjudication (TA1/999/277CA-stage). The claim never entered adjudication; nothing was decided about payment.
- **Denial** — post-adjudication (835 CARC/RARC-stage). The claim was adjudicated and payment was refused for a specific, cited reason.

Per `CLAUDE.md`'s non-negotiables, this repo never treats a rejection as a denial, or acceptance as payment. Universal/claim-type/payer-edit rules in the seed data are tagged `rejection` (they fire before adjudication); adjudication-category rules are tagged `denial`; informational rules are `not_applicable`.

## Admin UI

- `/home/payers` — read-only directory (`PayersDirectory`), search by name/alias/`sim_payer_id`, available to any authenticated user.
- `/admin/payers` — full CRUD (`PayersAdminTable`): search, filter by category, sort, add, edit, deactivate/reactivate (`is_active` toggle), soft delete (`deleted_at`), CSV import/export. Gated on `is_platform_admin()`; a non-admin sees `AdminAccessDenied` instead.
- `/admin/payer-rules` — rule + version admin (`PayerRulesAdminTable`): add a rule (creates the rule identity + version 1 together), add a new version to an existing rule, view full version history. Same admin gate.

CSV import/export columns: `sim_payer_id, display_name, legal_name, category, scope, state, network_name, enrollment_required, test_production, is_active`. Import upserts by `sim_payer_id` (creates if new, updates if it already exists in the directory).

## REST surface (`/api/v1/payers`)

First use of the `app/api/v1/*` Route Handler surface described in `CLAUDE.md`, ahead of Phase 6's claim-submission API — payers needed a machine-readable surface now for the CSV import path and future test-client use. Follows the same structured error envelope and pagination contract:

- `GET /api/v1/payers` — list, `?category=`, `?search=`, `?limit=`/`?cursor=` pagination.
- `POST /api/v1/payers` — create (platform admin only).
- `PATCH /api/v1/payers/{id}` — update (platform admin only).
- `POST /api/v1/payers/import` — bulk upsert by `sim_payer_id` (platform admin only).

Idempotency-Key handling and `audit_events` rows are **not yet implemented** on this surface — both are explicitly out of scope until Phase 6 (idempotency infra) and Phase 8 (`audit_events` table) per `docs/progress/DECISIONS.md`.

## `payer_id` FK wiring (completing Phase 3's deferral)

Phase 3 added `coverages.payer_id` and `organization_payer_enrollments.payer_id` as nullable columns with no FK, because `public.payers` didn't exist yet, plus a required `payer_label` text fallback field. Migration `20260719020018_payers_fk_backfill.sql` best-effort backfills `payer_id` on existing rows by matching `payer_label` against the new directory (`sim_payer_id` exact match, or a `display_name`/substring match), then adds the FK constraint on both tables. `payer_label` is **not** removed — it remains the display fallback for any coverage/enrollment whose payer isn't one of the ten seeded profiles. The `CoverageDialog`/`EnrollmentDialog` UI now use a real `PayerSelect` picker (`@kit/payers`) instead of a free-text field.

## Platform admin bootstrap — no self-service path yet

There is no UI flow to grant a user the `platform_super_admin` role in this phase — Phase 4 builds only the admin surfaces that role can use once granted, not a bootstrap flow. See `docs/progress/KNOWN_ISSUES.md`.

## Adjudication wiring (Phase 7)

`payer_test_profiles` was scaffolding through Phase 4–6 — a `default_outcome` column with no code path that ever read it. Phase 7's migration (`20260719050000_remittances.sql`) is the first thing that both **reads** it (`apps/worker`'s `ClaimProcessor.adjudicate()` looks up the claim's payer via `coverage.payer_id` and branches on `payer_test_profiles.default_outcome` — never a per-claim or per-payer-ID branch in application code) and **completes** it: a new `denial_rule_code` column is backfilled for the two `default_outcome = 'denied'` payers, pointing at their already-seeded adjudication-category `payer_rules.rule_code` (`SIM-RULE-ADJ-SIM-RBH-001` for prior-auth, `SIM-RULE-ADJ-SIM-MDMCO-001` for benefit-limit).

A denial's explanation is read from that rule's **live** `payer_rule_versions.explanation`, fetched fresh at adjudication time — editing the rule's text in `/admin/payer-rules` changes what a future denial shows immediately, the same "DB is the content, code is the mechanism" pattern Phase 5 established for pre-adjudication validation. The rule's `field_path` (`claim.priorAuthNumber` / `claim.benefitUnitsUsed`) is additionally used to resolve a `SIM-` prefixed CARC/RARC pair via a small fixed map in `apps/worker/src/lib/simulated-adjustment-codes.ts` — see `docs/05-claim-lifecycle.md` and `docs/progress/DECISIONS.md` for why these codes are never asserted as real X12 CARC/RARC values.

A payer with no `payer_test_profiles` row, or one with `default_outcome = 'paid'` (the column's default), is always paid — there is no separate "list of denial payers" maintained anywhere in application code; adding a new denial scenario to the demo set means adding/updating exactly one `payer_test_profiles` row plus its `denial_rule_code`'s `payer_rules` seed, not touching `apps/worker`.
