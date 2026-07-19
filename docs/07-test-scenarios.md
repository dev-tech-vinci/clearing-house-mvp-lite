# Test Scenarios (Phase 7)

> Simulation only. This document describes the deterministic ten-payer test set the adjudication simulator is built against, and points at the actual test files that exercise it. Phase 9 builds a standalone Python test client against the same set — this document is the source of truth for expected outcomes that both this repo's Playwright suite and Phase 9's client must agree with.

## The ten-payer / eight-paid-two-denied set

Every organization can build one claim against each of the ten seeded `SIM-` payers (`docs/06-payer-rules.md`). Adjudicating all ten deterministically produces **exactly 8 paid, 2 denied** — the outcome is a function of `payer_test_profiles.default_outcome` for the claim's actual payer, not a hardcoded per-claim result.

| `sim_payer_id` | Display name | Expected outcome | Denial reason (if any) |
|---|---|---|---|
| `SIM-MCFFS-001` | SIM Medicare FFS National | paid | — |
| `SIM-MCADV-001` | SIM Medicare Advantage Plan | paid | — |
| `SIM-MDFFS-001` | SIM Medicaid FFS State Program | paid | — |
| `SIM-MDMCO-001` | SIM Medicaid Managed Care Plan | **denied** | Benefit limit exhausted (`claim.benefitUnitsUsed`) |
| `SIM-PPO-001` | SIM Commercial PPO Network | paid | — |
| `SIM-HMO-001` | SIM Commercial HMO Network | paid | — |
| `SIM-BLUE-001` | SIM Blue-Style Plan | paid | — |
| `SIM-TRICARE-001` | SIM TRICARE-Style Plan | paid | — |
| `SIM-MKTPL-001` | SIM Marketplace Exchange Plan | paid | — |
| `SIM-RBH-001` | SIM Regional Behavioral Health Network | **denied** | Prior authorization missing/invalid (`claim.priorAuthNumber`) |

For a paid outcome on a $100.00-charge claim: $80.00 paid (the simulated 20% contractual write-off), one `CO`/`SIM-CARC-CO1` adjustment for $20.00, a generated `eft_traces` row, and a working Match EFT action. For a denied outcome: $0.00 paid, one `CO`-group adjustment for the full charge amount carrying the rule-specific `SIM-CARC-PA1` (prior auth) or the field-path-mapped code for benefit-limit, the triggering `payer_rules.id`, a recommended next action, and **no `eft_traces` row at all**.

## The two behavioral-health denial scenarios (explainable rules)

Both are `adjudication`-category `payer_rules` seeded in Phase 4 (`docs/06-payer-rules.md`), wired to their payer via `payer_test_profiles.denial_rule_code` in Phase 7:

1. **Required prior authorization missing or invalid** (`SIM-RULE-ADJ-SIM-RBH-001`, `field_path = 'claim.priorAuthNumber'`) — the behavioral-health scenario named explicitly in the Phase 7 build instructions (e.g. a PHP/IOP level of care requiring prior auth that wasn't obtained).
2. **Annual outpatient-therapy benefit limit exhausted** (`SIM-RULE-ADJ-SIM-MDMCO-001`, `field_path = 'claim.benefitUnitsUsed'`) — the second named scenario.

Both rules' `payer_rule_versions.explanation` is what actually renders in the denied remittance detail — editing either rule's text in `/admin/payer-rules` changes the demo's denial explanation with no code change.

## Rejection vs. denial — never merged

A **rejection** (pre-adjudication: TA1/999/277CA-stage, `docs/02-architecture.md`) and a **denial** (post-adjudication: 835/CARC-RARC-stage, this document) are structurally different outcomes recorded in different tables (`processing_jobs` vs. `remittances`) and reported as two separate dashboard metrics (`RejectionDenialRatesCard`, `docs/05-claim-lifecycle.md`). No test in this repo should ever assert a denial as a rejection or vice versa; the ten-payer set above is designed so that all ten submissions succeed past intake (0% rejection rate) and exactly two are denied at adjudication (20% denial rate) — a clean way to prove the two rates are independently computed and don't accidentally collapse into one "failure rate."

## Existing automated coverage

- **pgTAP** (`apps/web/supabase/tests/database/*.test.sql`, run via `supabase db test`): RLS/tenancy/idempotency/cross-org-FK-consistency proofs for every table, including `remittances-rls.test.sql`'s three idempotency guarantees and the `payment_matches`/`remittances.post_payment` RBAC gate. Not outcome-scenario tests — these prove access control and data integrity, not adjudication math.
- **Playwright** (`apps/e2e/tests/**/*.spec.ts`, run via `npx playwright test`): `tests/remittances/remittances.spec.ts` is the real-browser proof of this document's claims — one test verifies the paid/denied adjustment math, CARC/RARC display, EFT trace presence/absence, and reconciliation flow on two individual claims; the other builds, validates, approves, submits, and adjudicates one claim against every seeded payer in a single organization and asserts the aggregate **exactly 8 paid / 2 denied**, then confirms the dashboard's rejection/denial rate cards read `0.0%`/`20.0%`.

## Deferred to Phase 9

A standalone Python test client (`tools/edi-simulator/submit_10_test_claims.py`) driving the same ten-payer set through the REST API (`/api/v1/claims`, `/api/v1/claims/{id}/submit`, and Phase 7's REST additions) rather than a browser, plus negative-path tests (duplicate submission, invalid tenant, unauthorized role, unsupported route) and a Vitest unit layer. Not built yet — this document exists now so Phase 9's expected-outcomes fixture has a single source of truth to match against, per the build plan's Phase 7 Docs line.
