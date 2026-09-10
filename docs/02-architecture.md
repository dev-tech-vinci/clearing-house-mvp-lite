# Architecture

> Created in Phase 6, once the processing pattern CLAUDE.md describes ("API & processing design") was actually built and there was something real to document. Earlier phases' architecture is covered in `docs/03-data-model.md` (data) and `docs/04-rbac-and-rls.md` (access control); this doc is the cross-cutting "how does a request actually flow through this system" picture.

## Layering

- **Server Actions** (`'use server'` functions in each `packages/features/<domain>` package) are the UI mutation path — CSRF-protected, form-oriented, called directly from client components via `useMutation`.
- **Route Handlers** under `apps/web/app/api/v1/*` are the versioned REST surface, for the Python test client (future) and negative/API-level tests. Every endpoint: JWT auth (`requireApiUser`) → resolve org membership/permission (`requireOrgPermission`/`requirePlatformAdmin`) → Zod validation → one DB transaction per state change (where the DB supports it directly, e.g. an RPC) → structured error envelope `{ error: { code, message, correlationId, details? } }` → correlation ID echoed in the response header → pagination (`?limit&cursor`) where the resource is a list.
- **Supabase RPC functions** (`public.*`) handle set-based or multi-table-atomic DB operations that a single PostgREST call can't express — e.g. `create_organization` (Phase 2, bootstraps a membership `SECURITY DEFINER` has to bypass RLS for), `create_professional_claim`/`create_institutional_claim` (Phase 5, atomic header+detail insert, deliberately `SECURITY INVOKER` since no bootstrap problem exists there).
- **`apps/worker`** (Phase 6) hosts the deterministic `ClaimProcessor` — the one piece of business logic complex enough, and stateful enough across many tables, that it doesn't fit cleanly as a single RPC or a single Server Action. It has no Next.js dependency, so it can move behind a durable queue later without any feature package changing.

## The submit pipeline (Phase 6)

```
POST /api/v1/claims/{id}/submit  or  submitClaimAction
        │
        ▼
apps/worker: DeterministicClaimProcessor.process()
        │
        ├─ 1. INSERT processing_jobs (UNIQUE on claim_id) ──► duplicate? log to
        │                                                      replay_attempts,
        │                                                      return early.
        ├─ 2. Re-run the Phase 5 rule engine (loadClaimValidationContext +
        │      evaluateClaimRulesDetailed) — persist every result to
        │      rule_evaluations. Any failure ⇒ one transaction_events
        │      "submission_rejected" row, claims.status → validation_failed,
        │      stop. No EDI is generated for a rejected submission.
        ├─ 3. Generate control numbers (ISA13/GS06/ST02) + a synthetic 837
        │      payload (packages/features/edi's generators, hosted in
        │      apps/worker) → edi_transactions + edi_payloads (outbound,
        │      hashed).
        ├─ 4. claims.status → submitted; transaction_events:
        │      claim_submitted, edi_generated.
        ├─ 5. TA1 → 999 → 277CA, each: edi_payloads (inbound) +
        │      acknowledgments + one transaction_events row, always
        │      "accepted" on this simulator's happy path.
        └─ 6. claims.status → accepted_for_adjudication; final
               transaction_events row; processing_jobs.status → completed.
```

Every `transaction_events` row shares one `correlation_id` per submission and links to the previous row via `previous_event_id`, so the Transaction Trace UI can render the full chain for a claim. The table is append-only (INSERT-only grant, no UPDATE/DELETE) — see `docs/progress/DECISIONS.md` for why, and `apps/web/supabase/tests/database/edi-rls.test.sql` for the proof.

## Idempotency

The whole guarantee reduces to one fact: `processing_jobs.claim_id` is `UNIQUE`. The processor's first write is that insert; if it fails on the uniqueness constraint, everything downstream — EDI generation, the ack sequence, rule evaluation persistence — is skipped, and the attempt is logged to `replay_attempts` with `outcome = 'duplicate_ignored'`. This is a real, DB-enforced guarantee for "duplicate submit ⇒ no second processing effect," not an application-level check that could race. It is *not* full cross-statement transactionality for the rest of the pipeline (steps 3–6 are sequential, individually-committed writes, not one wrapped transaction) — a mid-pipeline crash after step 1 could leave a claim in a partially-processed state. This is a deliberate MVP simplification (see `docs/progress/DECISIONS.md`), acceptable because the one property that actually needs to be airtight — never double-processing the same claim — doesn't depend on it.

## Rejection vs. denial (hard rule)

A **rejection** happens before adjudication (TA1/999/277CA, Phase 6). A **denial** happens after adjudication (835 with CARC/RARC, Phase 7). Phase 6 never writes an adjudication-stage `transaction_events` row, and its only failure path (submit-time re-validation) is explicitly a rejection — see `docs/05-claim-lifecycle.md`.

## What's simulated vs. real

Simulated: X12 payload content and structure (plausible-shaped, not production-conformant — see `packages/features/edi` / `apps/worker`'s `lib/synthetic-x12.ts`), control numbers (random, not from a real interchange sequence), acknowledgment outcomes (always accepted on this phase's happy path), payer connectivity and routes.

Real: RLS-enforced multi-tenancy, the RBAC permission matrix, the append-only trace's actual DB-level immutability, the idempotency guarantee, the rule-engine wiring (rule content genuinely comes from the live `payer_rule_versions` table, not hardcoded strings).
