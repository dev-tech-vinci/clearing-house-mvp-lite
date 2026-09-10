# CLAUDE_CODE_BUILD_PLAN.md
## Behavioral Health Clearinghouse Simulator — Machine-Readable Implementation Guide

> **Read this with** `Behavioral_Health_Clearinghouse_MVP_Technical_Architecture.pdf` (the executive architecture doc). This file is the detailed, phase-by-phase, file-by-file plan for Claude Code. **Do not deploy. Do not use real PHI. Synthetic data only (`SIM-` IDs, fictional names).**
>
> **Golden rules for Claude Code**
> 1. Work on a feature branch. 2. Inspect existing code before editing. 3. Do not replace working MakerKit patterns unnecessarily. 4. Show the plan before changing files. 5. Apply **one phase at a time**. 6. Run format + lint + typecheck + tests after each phase. 7. Review `git diff`. 8. Update `docs/progress/*`. 9. Save migration + test output to `docs/progress/TEST_EVIDENCE.md`. 10. Commit after each successful phase (conventional commits). 11. Never commit `.env`, secrets, service-role keys, or real health data. 12. Stop and document blockers in `KNOWN_ISSUES.md` instead of inventing behavior. 13. Keep the app runnable at the end of every phase. 14. **Do not start a phase until the previous phase passes its acceptance criteria.**

---

## 0. Verified repository baseline (commit `37def9c20b01a3514cf69b5b3383bef3e5ffbcb9`, inspected 2026-07-16)

**If README, structure, and package versions ever disagree, the actual repo files are authoritative.**

- **Monorepo:** Turborepo 2.5.8 + pnpm 10.18.2 workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/**`, `tooling/*`). Node ≥18.18 (`.nvmrc`).
- **App:** `apps/web` — Next.js **15.5.9**, React **19.2.1**, TailwindCSS **4.1.14**, Shadcn UI (`@kit/ui`), Supabase-js **2.75.0**, Zod 3.25, React Query 5.90, `@tanstack/react-table` 8.21, react-hook-form 7.65, i18next, TypeScript 5.9.
- **Auth:** `packages/features/auth` (`@kit/auth`) — password, magic-link, OAuth, MFA. Routes `apps/web/app/auth/*`. Middleware `apps/web/middleware.ts` does CSRF (`@edge-csrf/nextjs`), MFA gate (`checkRequiresMultiFactorAuthentication`), and request-id.
- **Account model:** `packages/features/accounts` (`@kit/accounts`) + `public.accounts` table — **PERSONAL ACCOUNT ONLY. No organizations, teams, memberships, roles, or invitations exist.**
- **DB:** one migration `apps/web/supabase/migrations/20241219010757_schema.sql` (accounts + RLS `accounts_read`/`accounts_update` + triggers `on_auth_user_created/updated`, `protect_account_fields`). `seed.sql` is effectively empty.
- **Storage:** one bucket `account_image`, **PUBLIC** (`public=true`). No private buckets.
- **Service role:** already guarded — `packages/supabase/src/get-service-role-key.ts` and `clients/server-admin-client.ts` both `import 'server-only'`. Clients: `browser-client`, `server-client`, `middleware-client`, `server-admin-client`.
- **API:** Server Actions + `@makerkit/data-loader-supabase`. Only route handlers are `app/version/route.ts` and `app/sitemap.xml/route.ts`. **No `app/api` REST layer.**
- **Tests:** Playwright e2e in `apps/e2e` (auth + account only). `supabase db test` (pgTAP) wired via `pnpm --filter web supabase:test`. **No Vitest / unit runner installed.**
- **Scripts (root):** `pnpm dev`, `build`, `lint`, `format`, `typecheck`, `test`, `supabase:web:start|stop|reset|typegen`. App scripts: `supabase:start|stop|reset|test`, `supabase:typegen:*`.

### Repository structure decision (reasoning)
Keep MakerKit's `@kit/*` package boundaries and the **Server-Action-first** convention; add domain logic as **new feature packages** (`packages/features/<domain>`) so each domain is testable in isolation and mirrors the existing `accounts`/`auth` split. Add REST **only** under `apps/web/app/api/v1/*` because the Python client and negative tests need a stable machine surface that Server Actions (CSRF-bound, form-oriented) don't cleanly provide. Add a single `apps/worker` app for the deterministic processor so processing can later move off the request path without touching feature packages. Do not invent a structure that fights MakerKit's conventions.

### Documentation to create and keep current (every phase updates the relevant files)
`CLAUDE.md` (agent operating contract) · `docs/00-product-scope.md` · `docs/01-repository-baseline.md` · `docs/02-architecture.md` · `docs/03-data-model.md` · `docs/04-rbac-and-rls.md` · `docs/05-claim-lifecycle.md` · `docs/06-payer-rules.md` · `docs/07-test-scenarios.md` · `docs/08-local-runbook.md` · `docs/progress/CURRENT_STATE.md` · `docs/progress/PROGRESS.md` · `docs/progress/DECISIONS.md` · `docs/progress/CHANGELOG_IMPLEMENTATION.md` · `docs/progress/KNOWN_ISSUES.md` · `docs/progress/TEST_EVIDENCE.md`.

---

## API & service design (build in Phase 6+; specify now)

**Decision:** Server Actions for UI mutations (reuse Lite's CSRF-protected pattern); **versioned Route Handlers** `app/api/v1/*` for the Python client and machine/negative tests; Supabase RPC only for set-based DB operations; `apps/worker` for the processor. Firm recommendation — not a menu.

**Every `/api/v1` endpoint:** JWT auth → resolve org membership + role → Zod validation → **idempotency key** (header `Idempotency-Key`) → one DB transaction per state change → structured error envelope `{ error: { code, message, correlationId, details? } }` → correlation ID echoed → pagination (`?limit&cursor`) + filtering → **audit_events** row on security-sensitive actions.

**Interfaces (verbs → routes):** create claim `POST /claims` · update claim `PATCH /claims/{id}` · validate `POST /claims/{id}/validate` · approve `POST /claims/{id}/approve` · submit `POST /claims/{id}/submit` · get `GET /claims/{id}` · search `GET /claims` · trace `GET /claims/{id}/trace` · correct/resubmit `POST /claims/{id}/correct` · search payers `GET /payers` · upsert payer `POST/PATCH /payers` · import directory `POST /payers/import` · retrieve remittance `GET /remittances` + `GET /remittances/{id}` · match EFT `POST /remittances/{id}/match-eft` · create ticket `POST /support/tickets` · add message `POST /support/tickets/{id}/messages` · begin support access `POST /support/access-sessions` · end support access `POST /support/access-sessions/{id}/end` · run simulator `POST /simulator/runs` · test-run results `GET /simulator/runs/{id}`.

**Processing pattern (firm):** submit path validates auth+tenant → preserves raw input → creates canonical claim → records a `processing_jobs` row → a deterministic `ClaimProcessor` advances the state machine → each transition writes an **immutable** `transaction_events` row → payer rules produce explainable `rule_evaluations` → a simulated result is generated → a synthetic 835 where applicable → the UI reads current status + full event history. **MVP runs synchronously** from the submit path behind the `ClaimProcessor` interface. **Abstractions that must exist now to avoid a rewrite:** canonical claim model, `processing_jobs`, immutable event log, idempotency keys, rule-evaluation record. Later: durable queue, separate worker loop, retries, DLQ, webhooks, external gateway adapters.

---

## Implementation phases

> Template applied to **every** phase: **Objective · Preconditions · Files to inspect · Files to create · Files to modify · Migrations · Commands · Tests · Expected visible result · Acceptance criteria · Rollback · Docs · Commit.**

### Phase 0 — Repository baseline & safety
- **Objective:** Establish a runnable, recorded baseline without changing behavior.
- **Preconditions:** Git, Node ≥18.18 (prefer 20), pnpm 10, Docker Desktop, Python 3 installed.
- **Inspect:** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `apps/web/package.json`, `apps/web/middleware.ts`, `apps/web/supabase/*`, `apps/e2e/*`.
- **Create:** feature branch `feat/bh-clearinghouse-mvp`; `docs/01-repository-baseline.md` (paste SHA, versions, structure); `docs/progress/*` skeletons; `CLAUDE.md`.
- **Modify:** none (no behavior change).
- **Migrations:** none.
- **Commands:** `pnpm install` · `pnpm --filter web supabase:start` · `pnpm test` · `pnpm lint` · `pnpm typecheck`.
- **Tests:** run existing Playwright + record pass/fail as the baseline.
- **Expected result:** app boots at `localhost:3000`; Supabase local up; baseline test/lint status recorded.
- **Acceptance:** SHA + baseline recorded in `docs/01-repository-baseline.md`; branch created; nothing else changed.
- **Rollback:** delete branch.
- **Docs:** `01-repository-baseline.md`, `progress/CURRENT_STATE.md`.
- **Commit:** `chore: record baseline and scaffold docs (no behavior change)`.

### Phase 1 — Branding, navigation & route skeletons
- **Objective:** Rebrand demo, add nav, add empty **protected** route skeletons for customer/support/admin. Preserve auth.
- **Preconditions:** Phase 0 green.
- **Inspect:** `apps/web/config/{app,navigation,paths}.config.*`, `app/home/*`, `middleware.ts`, `@kit/ui` layout components.
- **Create:** `app/home/(customer)/{dashboard,claims,claim-batches,remittances,payers,documents,support,users,audit}/page.tsx` (placeholders); `app/support/*` and `app/admin/*` skeletons; nav config entries.
- **Modify:** `config/*` (branding, nav), `middleware.ts` matcher to guard `/support` and `/admin`.
- **Migrations:** none.
- **Commands:** `pnpm dev`, `pnpm lint`, `pnpm typecheck`.
- **Tests:** Playwright smoke: authenticated user reaches new routes; unauthenticated redirected.
- **Expected result:** rebranded shell; empty routes render behind auth.
- **Acceptance:** existing auth flows still pass; new routes protected.
- **Rollback:** `git revert` the phase commit.
- **Docs:** `02-architecture.md` (nav map), `progress/*`.
- **Commit:** `feat(ui): app shell, navigation, protected route skeletons`.

### Phase 2 — Organizations, memberships, roles & RLS
- **Objective:** Introduce multi-tenancy and RBAC with enforced tenant isolation.
- **Preconditions:** Phase 1 green.
- **Inspect:** `supabase/migrations/20241219010757_schema.sql` (copy the RLS/trigger patterns), `packages/features/accounts`.
- **Create:** `packages/features/organizations`, `packages/features/access-control`; migration `..._organizations.sql` (`organizations`, `organization_memberships`, `roles`, `permissions`, `role_permissions`, `invitations`); helper `has_org_access(org_id)` + `has_permission(org_id, perm)` SQL functions; pgTAP tests in `supabase/tests/`.
- **Modify:** `user_profiles` view/wrapper over `accounts`; seed the nine roles + permission matrix; org switcher in nav.
- **Migrations:** organizations + RBAC + RLS policies; seed roles/permissions.
- **Commands:** `pnpm --filter web supabase:reset` · `supabase:test` · `pnpm typecheck`.
- **Tests (must include NEGATIVE RLS):** same-tenant read allowed; **cross-tenant read denied**; role without permission denied.
- **Expected result:** a user in Org A cannot see Org B rows; roles differ visibly.
- **Acceptance:** cross-tenant denial test passes; invitations accept flow works.
- **Rollback:** `supabase db reset` to prior migration; revert commit.
- **Docs:** `03-data-model.md`, `04-rbac-and-rls.md`.
- **Commit:** `feat(tenancy): organizations, memberships, roles, RLS + negative tests`.

### Phase 3 — Providers, facilities, patients, coverages
- **Objective:** Synthetic healthcare entities owned by an org, with validation.
- **Preconditions:** Phase 2 green.
- **Inspect:** access-control helpers; `@kit/ui` form + `react-hook-form` + Zod patterns.
- **Create:** migration for `providers`, `facilities`, `patients`, `subscribers`, `coverages`, `organization_payer_enrollments` (all with `organization_id` + audit cols + soft delete + RLS); forms + list tables (`@tanstack/react-table`).
- **Modify:** nav; seed a few synthetic providers/patients (`SIM-`, fictional names).
- **Migrations:** provider/coverage tables + RLS.
- **Commands:** `supabase:reset`, `supabase:test`, `pnpm typecheck`, `pnpm lint`.
- **Tests:** CRUD unit tests; RLS org-ownership tests; NPI format validation (optionally cross-check via NPI registry).
- **Expected result:** org users manage synthetic providers/patients; other orgs can't see them.
- **Acceptance:** validation blocks bad input; RLS enforced.
- **Rollback:** revert migration + commit.
- **Docs:** `03-data-model.md`.
- **Commit:** `feat(entities): providers, facilities, patients, coverages (synthetic)`.

### Phase 4 — Payer directory & versioned rule admin
- **Objective:** Database-driven payer directory + explainable versioned rules.
- **Preconditions:** Phase 3 green.
- **Inspect:** data-loader patterns; table components.
- **Create:** `packages/features/payers`, `packages/features/payer-rules`; migration for `payers`, `payer_aliases`, `payer_routes`, `payer_supported_transactions`, `payer_rules`, `payer_rule_versions`, `payer_test_profiles`; CSV import/export; admin UI (search/filter/sort/add/edit/deactivate/reactivate/soft-delete); `GET/POST/PATCH /api/v1/payers`, `POST /api/v1/payers/import`.
- **Modify:** admin nav; **seed ten `SIM-` payer profiles** + rule sets (5 categories: universal, claim-type, payer edits, adjudication, informational).
- **Migrations:** payer + rule tables + RLS (payers global/admin-owned; rules versioned).
- **Commands:** `supabase:reset`, `supabase:test`, `pnpm typecheck`.
- **Tests:** payer CRUD; search/filter; rule versioning; unauthorized payer-rule modification denied.
- **Expected result:** searchable directory with 10 clearly-simulated payers; rules show version + rejection-vs-denial designation.
- **Acceptance:** directory operations work; rules are versioned + explainable; only Platform Super Admin edits rules.
- **Rollback:** revert migration + commit.
- **Docs:** `06-payer-rules.md`.
- **Commit:** `feat(payers): database-driven directory + versioned explainable rules`.

### Phase 5 — Professional (837P) & institutional (837I) claim builders
- **Objective:** Scoped claim data model + builders + draft/approval workflow.
- **Preconditions:** Phase 4 green.
- **Inspect:** entity forms from Phase 3; access-control for approve/submit permissions.
- **Create:** `packages/features/claims`; migration for `claims`, `professional_claim_details`, `institutional_claim_details`, `claim_diagnoses`, `claim_lines`, `claim_documents`, `claim_relationships`, `claim_batches`; New Professional / New Institutional builders; draft + approval workflow; `POST /claims`, `PATCH /claims/{id}`, `POST /claims/{id}/validate|approve`.
- **Modify:** nav; Zod schemas for the supported 837P/837I subset; document unsupported loops with explicit messages.
- **Migrations:** claim tables + RLS.
- **Commands:** `supabase:reset`, `supabase:test`, `pnpm typecheck`, `pnpm lint`.
- **Tests:** claim validation unit tests; draft persistence; approval permission tests; unsupported-loop rejection message.
- **Expected result:** create → save draft → validate → approve for both claim types.
- **Acceptance:** both claim types build, validate, and gate approval by role.
- **Rollback:** revert migration + commit.
- **Docs:** `05-claim-lifecycle.md`.
- **Commit:** `feat(claims): 837P + 837I builders with draft/approval`.

### Phase 6 — EDI processor & trace graph
- **Objective:** Generate scoped synthetic EDI; produce TA1/999/277CA events; drive the state machine with a full trace UI; idempotent + replay-safe.
- **Preconditions:** Phase 5 green.
- **Inspect:** claims feature; server-admin-client (for privileged audited writes only).
- **Create:** `packages/features/edi`, `packages/features/transaction-trace`, `apps/worker` (`ClaimProcessor`); migration for `edi_transactions`, `edi_payloads`, `transaction_events` (append-only), `acknowledgments`, `processing_jobs`, `rule_evaluations`, `replay_attempts`; control-number generator (ISA13/GS06/ST02); payload hashing; `POST /claims/{id}/submit`, `GET /claims/{id}/trace`.
- **Modify:** submit path → enqueue job → processor advances states; Transaction Trace UI showing all fields.
- **Migrations:** EDI/trace tables; **append-only policy** (INSERT only) on `transaction_events`.
- **Commands:** `supabase:reset`, `supabase:test`, `pnpm typecheck`.
- **Tests:** control-number generation; idempotency (duplicate submit = one effect); TA1/999/277CA event creation; replay protection.
- **Expected result:** submit produces raw payload + TA1→999→277CA trace with hashes + correlation IDs.
- **Acceptance:** full trace visible; duplicate submissions don't double-process; rejections stop pre-adjudication.
- **Rollback:** revert migration + commit.
- **Docs:** `05-claim-lifecycle.md`, `02-architecture.md`.
- **Commit:** `feat(edi): scoped X12 generation, ack events, state machine, idempotent trace`.

### Phase 7 — Adjudication simulator, remittances & reconciliation
- **Objective:** Simulate adjudication (8 paid / 2 denied), synthetic 835 + adjustments + EFT match, remittance UI.
- **Preconditions:** Phase 6 green.
- **Inspect:** rule engine (Phase 4), trace (Phase 6).
- **Create:** `packages/features/remittances`; migration for `remittances`, `remit_claims`, `remit_service_lines`, `claim_adjustments`, `eft_traces`, `payment_matches`; adjudication rules on `payer_test_profiles`; `GET /remittances`, `POST /remittances/{id}/match-eft`.
- **Modify:** processor → adjudicate → PAID (835 + adjustments + EFT) or DENIED (rule + next action, **no EFT**); Remittance + Payment Reconciliation UI; dashboard shows **separate** rejection vs denial rates.
- **Migrations:** remittance/reconciliation tables + RLS.
- **Commands:** `supabase:reset`, `supabase:test`, `pnpm typecheck`.
- **Tests:** adjustment math; 8-paid/2-denied outcome; denied has no EFT; CARC/RARC display verified (or `SIM-` labeled).
- **Expected result:** paid claims show payment + adjustment + EFT; denied show rule + recommended next action.
- **Acceptance:** exactly 8 paid / 2 denied on the seeded set; denials never labeled rejections.
- **Rollback:** revert migration + commit.
- **Docs:** `05-claim-lifecycle.md`, `06-payer-rules.md`, `07-test-scenarios.md`.
- **Commit:** `feat(remit): adjudication sim, synthetic 835, adjustments, EFT reconciliation`.

### Phase 8 — Support portal, documents & audit
- **Objective:** Ticketing, private documents, time-limited audited support access, append-only audit.
- **Preconditions:** Phase 7 green.
- **Inspect:** access-control; storage config (Lite's public `account_image` bucket — do NOT reuse for PHI docs).
- **Create:** `packages/features/support`, `packages/features/documents`, `packages/features/audit`; migration for `support_tickets`, `support_messages`, `support_assignments`, `support_ticket_documents`, `documents`, `document_access_events`, `support_access_sessions`, `audit_events`; **private** Storage buckets + signed-URL issuance; `POST /support/tickets`, `.../messages`, `POST /support/access-sessions`, `.../end`.
- **Modify:** support UI + "SUPPORT ACCESS ACTIVE" banner; RLS that grants support reads only during an active, unexpired session; append-only audit triggers on sensitive actions.
- **Migrations:** support/docs/audit tables; private buckets; audit INSERT-only policy.
- **Commands:** `supabase:reset`, `supabase:test`, `pnpm typecheck`.
- **Tests:** support-session access; **expired** support access denied; document privacy (no public URL); audit rows generated; no silent impersonation.
- **Expected result:** tickets assignable; docs private via signed URLs; support access banner + audit trail.
- **Acceptance:** support access is least-privilege, time-limited, fully audited; audit is append-only.
- **Rollback:** revert migration + commit.
- **Docs:** `04-rbac-and-rls.md`, `03-data-model.md`.
- **Commit:** `feat(support): tickets, private docs, audited time-limited access, append-only audit`.

### Phase 9 — Python test client & automated suite
- **Objective:** Ten-claim E2E + full test pyramid + evidence.
- **Preconditions:** Phase 8 green.
- **Inspect:** `/api/v1` contracts; seed accounts.
- **Create:** `tools/edi-simulator/submit_10_test_claims.py`, `requirements.txt`, `pytest.ini`, `fixtures/payers.json`, `fixtures/claims/`, `fixtures/expected-outcomes.json`, `tests/test_end_to_end.py`; Vitest unit tests; pgTAP RLS tests; Playwright workflows.
- **Modify:** add `vitest` to `apps/web` (not currently installed); wire `pnpm test` to include unit.
- **Migrations:** none (may add a `--reset`/`--seed` RPC or reuse `supabase db reset`).
- **Commands:** `python -m venv && pip install -r requirements.txt` · `python submit_10_test_claims.py --base-url http://localhost:3000 --reset --seed` · `pytest` · `pnpm test` · `supabase:test`.
- **Tests:** asserts **8 paid, 2 denied**, neither denial an intake rejection; negative tests (TA1/999/277CA rejection, duplicate submission, invalid tenant, unauthorized role, missing document, unsupported route). **The two adjudication denials must NOT fail at ack stages.**
- **Expected result:** green E2E with JSON evidence saved.
- **Acceptance:** repeatable (idempotency prevents duplicates); non-zero exit on expectation failure.
- **Rollback:** revert commit (tests only).
- **Docs:** `07-test-scenarios.md`, `progress/TEST_EVIDENCE.md`.
- **Commit:** `test(e2e): python 10-claim client + vitest + pgTAP + playwright evidence`.

### Phase 10 — Hardening & local demo release
- **Objective:** Ship a stable local MVP.
- **Preconditions:** Phase 9 green.
- **Inspect:** all `docs/progress/*`, `KNOWN_ISSUES.md`.
- **Create:** `docs/08-local-runbook.md`; demo seed; release notes.
- **Modify:** fix lint/TS issues; reset + reseed; verify all roles, tenant isolation, and all ten claim traces.
- **Migrations:** none (consolidate if needed).
- **Commands:** full suite: `pnpm lint && pnpm typecheck && pnpm test && supabase:test && pytest`.
- **Tests:** entire pyramid green; manual role + isolation + trace verification.
- **Expected result:** clean run from `supabase:reset` → seed → demo → tests.
- **Acceptance:** every item in "Final local-MVP acceptance criteria" (below) is true.
- **Rollback:** revert to last green tag.
- **Docs:** `08-local-runbook.md`, `progress/CURRENT_STATE.md`.
- **Commit / tag:** `chore(release): local MVP v0.1.0` → `git tag mvp-local-v0.1.0`.

---

## Final local-MVP acceptance criteria (Phase 10 gate)

App runs locally · local Supabase starts via Docker · sign-up/seeded login works · multiple orgs exist · **cross-org reads denied** · roles produce visibly different permissions · org admin manages users · users create professional + institutional claims and save drafts · authorized users approve/submit · payers searchable/add/edit/deactivate · payer rules versioned + explainable · transaction trace shows every checkpoint · **rejections and denials displayed separately** · remittances searchable/viewable · documents private · support tickets create/assign · support access restricted + audited · audit rows for sensitive actions · Python script submits ten claims → **exactly eight paid, exactly two denied after adjudication** · paid claims have simulated 835 · denied claims show rule + next action · re-run without duplicates · existing MakerKit auth still works · TypeScript passes · lint passes · Playwright passes · Python passes · RLS isolation passes · no real PHI · no production payer connectivity implied.

## Test pyramid (tools chosen for the actual repo)
- **Unit:** add **Vitest** (not installed at baseline) — validation, transitions, permissions, rule eval, adjustments, control numbers, idempotency.
- **DB/RLS:** **pgTAP** via existing `supabase db test` — same/cross tenant, support-session, expired access, admin access, unauthorized rule edit.
- **API integration:** create/update/submit claim, duplicate submit, trace, remit, payer CRUD, ticket creation.
- **Browser:** **Playwright** (already present) — login, role nav, claim creation (both types), submission, trace, remit, payer search, support workflow.
- **Python E2E:** ten claims, 8 paid / 2 denied, complete trace, repeatable.

## Guardrails (do NOT)
Fabricate payer connectivity · invent payer IDs · claim HIPAA certification · claim production X12 conformance without evidence · copy proprietary implementation guides or paid-MakerKit code · reproduce large copyrighted code sets (CPT/CDT/X12/HCPCS) · treat acceptance as payment · treat a rejection as a denial · assume the full MakerKit feature set exists in Lite. When a detail cannot be verified, write: **"Not verified — requires implementation or legal validation."**
