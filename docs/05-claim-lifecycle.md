# Claim Lifecycle (Phase 5–6)

> Simulation only. All claim data is synthetic (`SIM-` prefixed patients/providers/facilities/claim IDs), diagnosis and procedure codes are drawn from a small, clearly-labeled, non-exhaustive reference list — not a licensed ICD-10-CM/CPT/HCPCS code set. Generated X12/ack payloads are scoped and clearly labeled simulated, not production-conformant. Actual adjudication/835/denials are Phase 7 scope.

## Scope: draft → validate → approve → submit → accepted for adjudication

`claims.status`:

`draft → validation_failed | validated → approved → submitted → accepted_for_adjudication`

This is intentionally a coarse subset of the architecture's full state machine (`Draft → Validating → Validation Failed → Validated → EDI Generated → Submitted → TA1 → 999 → 277CA → Accepted for Adjudication → Adjudicating → Paid/Partially Paid/Denied → 835 Received → EFT Matched → Posted → Corrected/Resubmitted → Closed`). Notably, **TA1/999/277CA are not separate `claims.status` values** — they're `transaction_events`/`acknowledgments` rows (see below), which is what those tables exist for; adding six more claims.status values that a UI would need to special-case, when the trace already captures the same information at finer grain, would be exactly the kind of speculative design `CLAUDE.md` asks to avoid. The remaining lifecycle states (adjudication onward) are added when Phase 7 actually drives them — same deferral pattern as Phase 3's `payer_id`.

## The 837P / 837I subset (deliberate)

**Professional (837P):** subscriber/patient, rendering & billing provider (NPI), diagnosis pointers (ICD-10-CM), service lines (CPT/HCPCS + modifiers, units, place of service), claim-level totals (computed from line charges, not stored).

**Institutional (837I):** facility (type-of-bill), admission/discharge dates, revenue codes (+ optional HCPCS on the line), diagnosis set. Occurrence/value/condition codes are placeholders in the architecture doc, not modeled here.

**Unsupported loops (documented, not silently dropped)** — matching the architecture doc verbatim: coordination of benefits / secondary payer, ambulance/spinal certification, drug (LIN/CTP) detail, full 2300 claim-level attachments, provider loops beyond the rendering provider (2420), NCPDP pharmacy, and occurrence/value/condition codes. The claim builder UI simply never exposes these fields. `POST /api/v1/claims` additionally rejects a request that includes a recognized-but-unsupported key (see `packages/features/claims/src/lib/unsupported-loops.ts` for the exact key list) with a `422 unsupported_loop` structured error naming which loop and why, rather than silently ignoring the field.

## Data model

Introduced by `apps/web/supabase/migrations/20260719030000_claims.sql`. All tables are org-owned (tenancy contract: `organization_id`, `created_at/by`, `updated_at/by` where the row has its own edit lifecycle, `deleted_at` where soft-delete applies).

| Table | Purpose |
|---|---|
| `claims` | Header: `claim_type`, `patient_id`/`subscriber_id`/`coverage_id`/`billing_provider_id` (required), `batch_id` (nullable), `status`, `validated_at`, `last_validation_result` (persisted explainable errors, jsonb), `approved_at`/`approved_by`. |
| `professional_claim_details` | 1:1 with a `professional` claim: `rendering_provider_id`. |
| `institutional_claim_details` | 1:1 with an `institutional` claim: `facility_id`, `type_of_bill`, `admission_date`, `discharge_date`. |
| `claim_diagnoses` | ICD-10-CM diagnosis pointers (`diagnosis_code`, `diagnosis_pointer` 1-12, `is_primary`). |
| `claim_lines` | Service lines: `procedure_code` (professional) or `revenue_code` (institutional), `modifiers`, `units`, `charge_amount`, `place_of_service`, `diagnosis_pointers` (which diagnoses this line points to). |
| `claim_documents` | Document metadata references. Schema + RLS only this phase — no upload UI (Phase 8 adds real storage). |
| `claim_relationships` | Links a claim to a related claim (`original`/`corrected`/`resubmission`/`reversal`). Schema + RLS only — the correction/resubmission workflow itself is later phase scope. |
| `claim_batches` | Groups claims for future EDI submission. Schema + RLS only — batch management UI belongs to Phase 6. |

Claim-level totals are **not** persisted on `claims` — they're computed on the fly by summing `claim_lines.charge_amount`, avoiding a derived-data staleness risk.

### Cross-org FK-consistency (reusing the Phase 3 pattern)

RLS stops a caller from *reading* another org's row; it doesn't stop them from *creating* a row in their own org whose FK points at someone else's data. `kit.check_claim_org_consistency()` (on `claims`) verifies the patient/subscriber/coverage/billing-provider/batch all belong to the claim's own organization, and that the subscriber's patient and the coverage's subscriber+patient match. A reusable `kit.check_claim_child_org_consistency()` enforces the same for `professional_claim_details`/`institutional_claim_details`/`claim_diagnoses`/`claim_lines`/`claim_documents` (child's `organization_id` must match its parent claim's). Two narrower triggers additionally verify the rendering provider's org (professional) and the facility's org (institutional), plus that the detail row's parent claim actually has the matching `claim_type`. `kit.check_claim_relationships_org()` verifies both linked claims belong to the caller's org. Covered by `apps/web/supabase/tests/database/claims-rls.test.sql`.

### RBAC: `claims.create_edit` vs `claims.approve_submit`

Both permissions were already seeded correctly in Phase 2's role-permission matrix: `claims_specialist` has `claims.create_edit` and `claims.correct_resubmit` but **not** `claims.approve_submit`; `claims_manager`/`org_admin`/`org_owner` have all three. Phase 5 is the first phase to actually enforce this at the RLS layer, via **two permissive UPDATE policies** on `claims`:

- `claims_update_edit` — `with check (has_permission('claims.create_edit') and status <> 'approved')`
- `claims_update_approve` — `with check (has_permission('claims.approve_submit'))`

Postgres combines multiple permissive policies' `WITH CHECK` clauses with `OR`. A `claims_specialist` writing `status = 'approved'` fails both checks. Because `claims_update_edit`'s `USING` clause (`has_org_access`, not permission-scoped) still matches the row, Postgres evaluates the write and — unlike Phase 4's `payers_update` negative, where the `USING` clause itself fails and the row is silently never selected — **throws** `new row violates row-level security policy`, since the row was selected but no applicable policy's `WITH CHECK` passed. Both denial shapes are correct RLS behavior; which one you get depends on whether `USING` or `WITH CHECK` is what fails. See `docs/progress/DECISIONS.md` for the full comparison.

Two atomic `SECURITY INVOKER` (not `DEFINER`) RPCs, `create_professional_claim`/`create_institutional_claim`, insert the claim header and its 1:1 detail row in one transaction. Unlike Phase 2's `create_organization`/`accept_invitation` (which need `SECURITY DEFINER` to solve a genuine bootstrap problem — a brand-new org has no members yet), these RPCs run entirely under the caller's own RLS: the caller already has org access and `claims.create_edit` by the time either is called, so there's no privilege escalation to justify.

## Validation: wiring to the Phase 4 rule catalog

`payer_rule_versions.condition` is human-readable text, not a machine-executable expression — there is no generic rule interpreter. Instead, `packages/features/claims/src/lib/validate-claim.ts` defines one deterministic TypeScript predicate per known seeded `rule_code` (universal + claim-type + payer-edit categories only — adjudication-category rules are post-adjudication and evaluated in a later phase, never at draft-validate time; informational rules aren't blocking checks). This *is* the "rule engine" for this phase: a fixed, known mapping from `rule_code` to a real check.

Critically, the **message** shown to the user — `explanation`, `suggestedCorrection`, `severity`, `rejectionOrDenial` — is always read from the live `payer_rule_versions` row for that rule, fetched fresh on every validate call, never hardcoded in the predicate. Editing a rule's explanation text through the Phase 4 admin UI changes what claim builders see immediately, with no code deploy. `packages/features/claims/src/server/validate-claim.server.ts` is the one shared implementation used by both `validateClaimAction` (Server Action, UI path) and `POST /api/v1/claims/{id}/validate` (REST path) — duplicating this logic once already caused a real bug in Phase 4 (see `docs/progress/DECISIONS.md`), so it's factored out this time.

Three of the six evaluated rules (`SIM-RULE-UNIV-003` subscriber present, `SIM-RULE-CT-001` rendering NPI present, `SIM-RULE-CT-002` type-of-bill present) can never actually fail once a claim row exists — those fields are `NOT NULL` at the DB layer. They're still evaluated for parity with the seeded rule catalog and to correctly report them as passing, not because a failure is reachable in practice. The other three are genuinely reachable: `SIM-RULE-UNIV-001` (at least one diagnosis) fails on a freshly created claim before a diagnosis is added; `SIM-RULE-UNIV-002` (service date not in the future) fails if a line's service date is later than today; the payer-edit rule (`SIM-RULE-EDIT-<payer>`, active enrollment required) fails if the organization has no `active` `organization_payer_enrollments` row for the claim's payer.

## Synthetic code reference lists

`packages/features/claims/src/lib/synthetic-codes.ts` — small, illustrative, non-exhaustive lists of BH-relevant ICD-10-CM diagnosis codes, CPT/HCPCS service codes, UB-04 revenue codes, type-of-bill codes, and place-of-service codes. Descriptions are original, short, plain-English summaries — not copied from any licensed code manual. Not a substitute for a real terminology service; do not extend this into anything resembling a full code set.

## EDI generation, acknowledgments, and the trace (Phase 6)

Introduced by `apps/web/supabase/migrations/20260719040000_edi.sql`. Submitting an approved claim runs `apps/worker`'s `DeterministicClaimProcessor` synchronously — see `docs/02-architecture.md` for the full pipeline diagram and the idempotency/rejection design. Summary:

1. Re-runs the Phase 5 rule engine (universal + claim-type + payer-edit rules) and persists every result — pass or fail — to `rule_evaluations`, not just failures (`claims.last_validation_result` only ever stores failures from the interactive Validate button).
2. If anything fails: one `transaction_events` row (`submission_rejected`, category `validation`), `claims.status → validation_failed`, and nothing else happens — no EDI is generated. This is a genuine rejection (pre-adjudication), computed from real rule results, not a hardcoded always-succeed path.
3. If everything passes: generates synthetic control numbers (`ISA13`/`GS06`/`ST02`) and a synthetic 837P/837I payload (`edi_transactions` + `edi_payloads`, hashed), then walks TA1 → 999 → 277CA — each step writes an `edi_payloads` (inbound) row, an `acknowledgments` row, and one `transaction_events` row — always accepted on this simulator's happy path, ending at `accepted_for_adjudication`.

### Tables

| Table | Purpose |
|---|---|
| `processing_jobs` | One row per claim submission, ever (`claim_id` `UNIQUE`) — this constraint *is* the idempotency guarantee. |
| `edi_transactions` | The outbound 837 transaction for a claim (`claim_id` `UNIQUE` — one submission per claim this phase), with its control numbers. |
| `edi_payloads` | Raw synthetic payload text + sha256 hash, both the outbound 837 and every inbound ack. |
| `acknowledgments` | Simulated TA1/999/277CA results. |
| `rule_evaluations` | Every applicable rule's pass/fail outcome at submit time — the full audit trail behind an accept/reject decision. |
| `replay_attempts` | One row per submit attempt, first or duplicate — the queryable proof idempotency held. |
| `transaction_events` | **Append-only.** Every checkpoint, every field the architecture doc names (event name/category, timestamp, actor, claim/batch IDs, ISA13/GS06/ST02, payer, route, request/response hash, status, code, explanation, rule ID, correlation ID, previous event, next recommended action). `INSERT` policy only — no `UPDATE`/`DELETE` grant to `authenticated` at all, proven by `apps/web/supabase/tests/database/edi-rls.test.sql`. |

### Idempotency

A duplicate submit of the same claim is detected by the `processing_jobs.claim_id` unique constraint on the processor's very first write — if it fails with a uniqueness violation, the attempt is logged to `replay_attempts` (`outcome = 'duplicate_ignored'`) and nothing else is written: no new `edi_transactions`, no new `transaction_events`. Proven via a real duplicate `POST /api/v1/claims/{id}/submit` in `apps/e2e/tests/edi/edi.spec.ts`, asserting the trace event count is unchanged after the second call.

### The Transaction Trace UI

`packages/features/transaction-trace` renders every `transaction_events` field for a claim, in order, on the claim detail page. Deliberately a separate package from `packages/features/edi` — later phases (remittance, Phase 7) will also write to the same `transaction_events` spine, not just the EDI pipeline.

## Not yet built (deferred, documented)

- `claim_documents`/`claim_relationships`/`claim_batches` UI — schema and RLS exist since Phase 5; upload, correction/resubmission, and batch-management screens are later phases.
- Adjudication, 835, denials, remittance — Phase 7. No adjudication-stage `transaction_events` row is ever written by Phase 6 — the rejection-vs-denial line is enforced by simply never crossing it here.
- Editing claim header fields (patient/subscriber/coverage/provider/facility) after creation — only `notes` is editable via `PATCH /api/v1/claims/{id}`; changing the clinical/financial header is treated as a correction, which belongs to the (not-yet-built) `claim_relationships`-based workflow, not a silent in-place edit.
- Full cross-statement transactionality for the submit pipeline — the idempotency guarantee (one `processing_jobs` row per claim, ever) is real and DB-enforced, but steps after it are sequential individually-committed writes, not one wrapped transaction. See `docs/02-architecture.md` and `docs/progress/DECISIONS.md`.
