# CLAUDE.md — Agent Operating Contract

This repository is being converted from MakerKit Lite (a personal-account-only Next.js/Supabase SaaS starter) into a **multi-tenant behavioral-health clearinghouse simulator**. This is a simulation/demo project — not a real clearinghouse.

**Authoritative plan:** `docs/CLAUDE_CODE_BUILD_PLAN.md` — read it in full before making changes. It defines every phase (Objective, Preconditions, Files to inspect/create/modify, Migrations, Commands, Tests, Expected result, Acceptance criteria, Rollback, Docs, Commit) and is the single source of truth for scope and sequencing. `Behavioral_Health_Clearinghouse_MVP_Technical_Architecture.md` in `docs/` is the companion executive architecture doc.

## Non-negotiables

1. **Simulation only.** No real PHI, ever. All synthetic entities use `SIM-` prefixed IDs and fictional names. Do not fabricate payer connectivity, claim HIPAA certification, or claim production X12 conformance without evidence.
2. **One phase at a time**, in order. Do not start a phase until the previous phase's acceptance criteria are met and recorded.
3. **Work on the feature branch** `feat/bh-clearinghouse-mvp`. Do not commit directly to `main`.
4. **Inspect before editing.** Read the existing MakerKit implementation of a pattern before replacing or extending it. Do not replace working MakerKit patterns unnecessarily.
5. **Show the plan before changing files** for anything beyond the current phase's explicit scope.
6. **Run format + lint + typecheck + tests after each phase.** A phase is not done until these are green (or failures are pre-existing and documented).
7. **Review `git diff`** before committing.
8. **Update `docs/progress/*`** every phase: `CURRENT_STATE.md`, `PROGRESS.md`, `DECISIONS.md`, `CHANGELOG_IMPLEMENTATION.md`, `KNOWN_ISSUES.md`.
9. **Save migration + test output** to `docs/progress/TEST_EVIDENCE.md`.
10. **Commit after each successful phase** using conventional commits (see per-phase commit message in the build plan).
11. **Never commit** `.env` files, secrets, service-role keys, or real health data.
12. **Stop and document blockers** in `docs/progress/KNOWN_ISSUES.md` instead of inventing behavior or silently working around a missing precondition.
13. **Keep the app runnable** at the end of every phase.
14. **Do not start a phase until the previous phase passes its acceptance criteria.**

## Verified repository baseline

See `docs/01-repository-baseline.md` for the recorded baseline (commit SHA, tool versions, command output). If README, structure, or package versions ever disagree with the actual repo files, **the repo files are authoritative**.

## Repository structure decisions

- Keep MakerKit's `@kit/*` package boundaries and Server-Action-first convention.
- Add domain logic as new feature packages under `packages/features/<domain>`, mirroring the existing `accounts` / `auth` split.
- REST is added **only** under `apps/web/app/api/v1/*`, for the Python test client and machine/negative tests. Server Actions remain the UI mutation path.
- A single `apps/worker` app hosts the deterministic claim processor so processing can move off the request path later without touching feature packages.
- Do not invent a structure that fights MakerKit's conventions.

## API & processing design (build starting Phase 6, decided now)

- Server Actions for UI mutations; versioned Route Handlers (`app/api/v1/*`) for the Python client and negative tests; Supabase RPC for set-based DB operations; `apps/worker` for the processor.
- Every `/api/v1` endpoint: JWT auth → resolve org membership + role → Zod validation → idempotency key (`Idempotency-Key` header) → one DB transaction per state change → structured error envelope `{ error: { code, message, correlationId, details? } }` → correlation ID echoed → pagination (`?limit&cursor`) + filtering → `audit_events` row on security-sensitive actions.
- Processing pattern: submit → preserve raw input → create canonical claim → `processing_jobs` row → deterministic `ClaimProcessor` advances the state machine → each transition writes an immutable `transaction_events` row → payer rules produce explainable `rule_evaluations` → simulated result (+ synthetic 835 where applicable) → UI reads current status + full event history. MVP runs synchronously behind the `ClaimProcessor` interface.

## Documentation map

- `docs/00-product-scope.md`, `docs/01-repository-baseline.md`, `docs/02-architecture.md`, `docs/03-data-model.md`, `docs/04-rbac-and-rls.md`, `docs/05-claim-lifecycle.md`, `docs/06-payer-rules.md`, `docs/07-test-scenarios.md`, `docs/08-local-runbook.md`
- `docs/progress/CURRENT_STATE.md`, `docs/progress/PROGRESS.md`, `docs/progress/DECISIONS.md`, `docs/progress/CHANGELOG_IMPLEMENTATION.md`, `docs/progress/KNOWN_ISSUES.md`, `docs/progress/TEST_EVIDENCE.md`

## Guardrails (do NOT)

Fabricate payer connectivity · invent payer IDs · claim HIPAA certification · claim production X12 conformance without evidence · copy proprietary implementation guides or paid-MakerKit code · reproduce large copyrighted code sets (CPT/CDT/X12/HCPCS) · treat acceptance as payment · treat a rejection as a denial · assume the full MakerKit feature set exists in Lite.

When a detail cannot be verified, write: **"Not verified — requires implementation or legal validation."**
