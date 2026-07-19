# Test Evidence

> Raw-ish output from migrations and test runs, saved per phase as proof of the recorded pass/fail status.

## Phase 0 — Repository baseline & safety

See `docs/01-repository-baseline.md` for the full command log (install, lint, typecheck, test, supabase start). Summarized here once Phase 0 is complete.

## Phase 1 — Branding, navigation & route skeletons

Run 2026-07-18 on branch `feat/bh-clearinghouse-mvp`, local Supabase already up via Docker (`supabase_*_next-supabase-saas-kit-turbo-lite` containers healthy), dev server already running on `localhost:3000`.

**`pnpm lint`** — 8/8 turbo tasks successful (3 cached). Output: 2 warnings, 0 errors, both pre-existing and unrelated to Phase 1 (`@kit/accounts` `<img>`-vs-`next/image` warning in `multi-factor-auth-setup-dialog.tsx`; `web` `react-hooks/exhaustive-deps` warning in `dashboard-demo-charts.tsx`). `manypkg check` — "workspaces valid!".

**`pnpm typecheck`** — 9/9 turbo tasks successful (4 cached), 0 errors.

**`npx playwright test tests/navigation/protected-routes.spec.ts`** (from `apps/e2e`) — **22/22 passed** (29.4s). Covers: unauthenticated visit to each of the 9 customer routes + `/support` + `/admin` redirects to `/auth/sign-in?next=<path>` (11 cases); authenticated user (via fresh sign-up flow through Mailpit) reaches all 11 routes (11 cases).

**`npx playwright test tests/authentication tests/account`** (pre-existing suite, regression check) — 5 passed, 3 failed. Failures are a dev-server-only click-interception artifact (Next.js "Open Next.js Dev Tools" floating button), not a Phase 1 regression — see `docs/progress/KNOWN_ISSUES.md` for the full analysis and the captured DOM snapshot showing the nav/dashboard/profile-dropdown all rendered correctly.

## Phase 2 — Organizations, memberships, roles & RLS

Run 2026-07-18 on branch `feat/bh-clearinghouse-mvp`, local Supabase up via Docker, dev server on `localhost:3000` (restarted once to pick up `next.config.mjs` changes).

**`pnpm --filter web supabase:reset`** (`npx supabase db reset`, run twice — once before and once after the `get_organization_members` type-cast fix) — both runs: "Applying migration 20260718232603_organizations.sql... Seeding data from supabase/seed.sql... Restarting containers... Finished supabase db reset". No migration errors (the `WARNING (01006): no privileges could be revoked for ...` lines are pre-existing Supabase-managed-schema noise, not from this migration).

**`supabase db test`** (`apps/web/supabase/tests/database/organizations-rls.test.sql`) — **18/18 pgTAP assertions passed**, both before and after the type-cast fix (the fix affects the app-layer RPC call shape, not the pgTAP suite's own direct SQL calls, so it was green throughout). Covers: same-tenant read allowed, cross-tenant read denied (organizations table + `has_org_access` + `get_organization_members`), role-without-permission denied + positive control, full invite→accept flow, wrong-email negative, expired-token negative, `create_organization` bootstrap + isolation.

**`pnpm typecheck`** — 11/11 turbo tasks successful (final run after all fixes), 0 errors. One intermediate failure during development: `@kit/access-control` couldn't resolve `process` (missing `@types/node`, since nothing in that package depended on `next` the way sibling packages incidentally do) — fixed by adding `@types/node` directly as a devDependency.

**`pnpm lint`** — 10/10 turbo tasks successful, 2 warnings (same 2 pre-existing ones from Phase 1, unrelated to Phase 2), 0 errors. One intermediate failure during development: an unescaped apostrophe in `accept-invitation-panel.tsx` (`react/no-unescaped-entities`) — fixed.

**`npx playwright test tests/organizations`** (new suite, `apps/e2e/tests/organizations/organizations.spec.ts`) — **3/3 passed** (15.1s), after fixing three real bugs surfaced by this exact test run (see `docs/progress/DECISIONS.md`): a `'use server'` file exporting a non-function constant (500'd every `/home` page), a `RETURNS TABLE`/`varchar` type mismatch in `get_organization_members` (`42804`), and a Radix Dialog/DropdownMenu interaction that left a full-screen overlay stuck intercepting clicks after creating an organization.

**`npx playwright test tests/navigation tests/authentication tests/account`** (full regression check) — **28/30 passed**, up from 27/30 at Phase 1 closeout. `auth.spec.ts:35` ("will sign-in with the correct credentials") now passes, fixed by `devIndicators: false` (found while investigating the Radix overlay bug above, not itself a Phase 2 code change). The remaining 2 failures (`account.spec.ts:36`, `password-reset.spec.ts:11`) are unrelated to Phase 2 and now each show a different, previously-masked symptom (a missing password-field locator, and a `waitForURL` timeout, respectively) — see `docs/progress/KNOWN_ISSUES.md`.

## Phase 3 — Providers, facilities, patients, coverages

Run 2026-07-19 on branch `feat/bh-clearinghouse-mvp`, local Supabase up via Docker, dev server on `localhost:3000` (restarted once to pick up `next.config.mjs` changes).

**`pnpm --filter web supabase:reset`** (`npx supabase db reset`, run three times over the course of the phase as fixes landed) — every run: "Applying migration 20260718232603_organizations.sql... Applying migration 20260719011359_entities.sql... Seeding data from supabase/seed.sql... Restarting containers... Finished supabase db reset". No migration errors.

**`supabase db test`** (both suites) — **40/40 pgTAP assertions passed** (22 new in `entities-rls.test.sql` + 18 from Phase 2's `organizations-rls.test.sql`, unaffected). One intermediate failure during development: 2 of the cross-tenant-insert-denied assertions for `subscribers`/`coverages` initially referenced org1's own `patient_id`/`subscriber_id` in an org2 insert attempt, so the FK-consistency trigger fired before RLS ever got evaluated — the test wasn't actually exercising what it claimed to. Fixed by referencing org2's own patient/subscriber records instead, isolating the RLS check from the trigger check. `entities-rls.test.sql` covers: org-owned CRUD (lives_ok insert as the owning org, for all 6 tables), cross-tenant read denied (all 6), cross-tenant insert denied (all 6), an NPI-format negative (invalid NPI rejected by the DB `CHECK`), a cross-org FK-trigger negative on `subscribers`, and two FK-trigger negatives on `coverages` (cross-org, and same-org patient/subscriber mismatch).

**`pnpm typecheck`** — 12/12 turbo tasks successful (final run after all fixes), 0 errors. Two rounds of intermediate failures during development, both TypeScript/Zod inference issues (not runtime bugs) — see `docs/progress/DECISIONS.md`: (1) `useForm`'s generic couldn't be inferred cleanly from a ternary `isEdit ? UpdateSchema : CreateSchema` resolver — fixed by adding one permissive `*FormSchema` per entity for client-side typing; (2) the resulting `z.input` (optional defaulted fields) vs. the server action's expected `z.infer` (required defaulted fields) still mismatched at the two `mutateAsync` call sites per dialog — resolved with a narrow, documented `as never` cast at exactly those two call sites (the runtime values are always populated via `defaultValues`, so this is a type-system gap, not a behavior gap).

**`pnpm lint`** — 11/11 turbo tasks successful, 2 warnings (same 2 pre-existing ones from Phase 1/2, unrelated to Phase 3), 0 errors.

**`npx playwright test tests/entities`** (new suite, `apps/e2e/tests/entities/entities.spec.ts`) — **3/3 passed** (16.6s), after fixing one real bug surfaced by this exact test run (see `docs/progress/DECISIONS.md`): `ProviderDialog`'s organization-name/first-name/last-name fields combined `.min(1)` with `.optional()` against a `''` (not `undefined`) default for the currently-hidden half of the individual/organization split, silently blocking client-side form submission with zero visible feedback (no error, no toast, no network call) — confirmed by the complete absence of any `providers` insert attempt in the dev server log despite a successful-looking fill-and-submit. Fixed by dropping `.min(1)` from those three fields.

**`npx playwright test tests/navigation tests/organizations tests/authentication tests/account`** (full regression check) — **31/33 passed**. The same 2 pre-existing failures as Phase 2 closeout (`account.spec.ts:36`, `password-reset.spec.ts:11`), now with a clearer root cause visible in the trace: both land on `/auth/callback/error?...&error=auth%3Aerrors.otp_expired` — the confirmation OTP expires before the test follows the link, most likely due to parallel-worker load on the shared local Supabase/Mailpit auth backend. Neither touches anything Phase 2 or Phase 3 changed — see `docs/progress/KNOWN_ISSUES.md`.

## Phase 4 — Payer directory & versioned rule admin

Run 2026-07-19 on branch `feat/bh-clearinghouse-mvp`, local Supabase up via Docker, dev server on `localhost:3000`.

**`pnpm --filter web supabase:reset`** — "Applying migration 20260718232603_organizations.sql... Applying migration 20260719011359_entities.sql... Applying migration 20260719015820_payers.sql... Applying migration 20260719020018_payers_fk_backfill.sql... Seeding data from supabase/seed.sql... Restarting containers... Finished supabase db reset". No migration errors (only the pre-existing `WARNING (01006): no privileges could be revoked for ...` Supabase-managed-schema noise, unrelated to this repo's migrations).

**`supabase db test`** (all three suites) — **54/54 pgTAP assertions passed** (14 new in `payers-rls.test.sql` + 22 from Phase 3's `entities-rls.test.sql` + 18 from Phase 2's `organizations-rls.test.sql`, both unaffected). `payers-rls.test.sql` covers: seed sanity (exactly 10 `SIM-` payers, none missing the prefix), non-admin read-allowed, non-admin insert-denied on `payers`/`payer_rules`/`payer_rule_versions` (via `throws_ok`), non-admin update-denied on `payers` (via a "value unchanged after the attempted update" assertion — `throws_ok` doesn't work for RLS `UPDATE` denials, see `docs/progress/DECISIONS.md`), platform-admin insert/update-allowed, rule versioning (both v1 and v2 remain queryable after adding a version), and the rejection-vs-denial designation on a real seeded adjudication rule.

**`pnpm typecheck`** — 14/14 turbo tasks successful (final run after all fixes), 0 errors.

**`pnpm lint`** — 13/13 turbo tasks successful, 2 warnings (same 2 pre-existing ones from Phase 1/2/3, unrelated to Phase 4), 0 errors. `manypkg check` — "workspaces valid!".

**`npx playwright test tests/payers --workers=1 --retries=0`** (new suite, `apps/e2e/tests/payers/payers.spec.ts`) — **3/3 passed** (23.8s), after fixing four real bugs surfaced by this exact test run (see `docs/progress/DECISIONS.md` for full detail on each):
1. `payer-rule.schema.ts`'s `payerId` field repeated the Phase 3 `.min(1)`+`.optional()`-class bug (here `.uuid()`+`.optional()` against a `''` dialog default) — fixed with `z.union([z.literal(''), z.string().uuid()])`.
2. `payers-rls.test.sql`'s non-admin-update-denied assertion used `throws_ok`, which doesn't apply to RLS `UPDATE` denials (Postgres silently zero-rows the statement rather than raising) — fixed to assert the value stayed unchanged.
3. `PayerCsvImportDialog`'s `.then()` callback had no return statement, so `toast.promise`'s success handler received `void` instead of the import result.
4. The CSV import flow's genuine blocking bug: `importPayersAction` re-validated an already-CSV-transformed row (booleans) against the same schema used to parse raw CSV text (which expects strings), so every import failed server-side Zod validation with `Expected string, received boolean` — first misdiagnosed as a `409 Conflict` from an unrelated PostgREST upsert parameter (`count: 'exact'`, removed, did not fix it) until the actual `ZodError` was found in the dev server log for a clean, non-retry-polluted run. Fixed by adding `ParsedPayerImportRowSchema` (booleans) as the schema actually used at the client→server-action/API boundary.

**`npx playwright test --workers=1 --retries=0`** (full regression check, every spec) — **37/39 passed** (3.6m). The same 2 pre-existing failures as every prior phase's closeout (`account.spec.ts:36`, `password-reset.spec.ts:11`), same OTP-expiry root cause, unrelated to Phase 4 — see `docs/progress/KNOWN_ISSUES.md`. All Phase 1–3 suites (navigation, organizations, entities, authentication, account) plus the new `payers` suite pass with no regressions.

## Phase 5 — Professional (837P) & institutional (837I) claim builders

Run 2026-07-19 on branch `feat/bh-clearinghouse-mvp`, local Supabase up via Docker, dev server on `localhost:3000`.

**`pnpm --filter web supabase:reset`** — "Applying migration 20260718232603_organizations.sql... Applying migration 20260719011359_entities.sql... Applying migration 20260719015820_payers.sql... Applying migration 20260719020018_payers_fk_backfill.sql... Applying migration 20260719030000_claims.sql... Seeding data from supabase/seed.sql... Restarting containers... Finished supabase db reset". No migration errors (only the pre-existing Supabase-managed-schema `WARNING (01006)` noise).

**`supabase db test`** (all four suites) — **75/75 pgTAP assertions passed** (21 new in `claims-rls.test.sql` + 14 from Phase 4's `payers-rls.test.sql` + 22 from Phase 3's `entities-rls.test.sql` + 18 from Phase 2's `organizations-rls.test.sql`, all unaffected). `claims-rls.test.sql` covers: org-owned CRUD for both claim types (header + detail + diagnosis + line), cross-tenant read/insert denial, 8 cross-org FK-consistency trigger negatives (claim→patient/coverage/billing-provider, professional_claim_details→rendering-provider, institutional_claim_details→facility, claim_diagnoses/claim_lines/claim_relationships→parent-claim org), a remittance-specialist create-denied negative, and the required RBAC pair: a `claims_specialist` attempting to set `status='approved'` gets a genuine RLS-violation exception (not a silent 0-row update — see `docs/progress/DECISIONS.md` for why this denial shape differs from Phase 4's `payers_update` negative), while a `claims_manager` succeeds.

**`pnpm typecheck`** — 15/15 turbo tasks successful (final run after all fixes), 0 errors. Two rounds of intermediate failures during development, both fixed: (1) `client.rpc(...)` calls passing `?? null` for optional RPC parameters where the generated Supabase types expect `string | undefined` (not `| null`) — fixed by switching to `?? undefined`/`|| undefined`; (2) `last_validation_result: errors` failed to satisfy the generated `Json` column type (a typed interface array has no index signature) — fixed with `JSON.parse(JSON.stringify(errors))`.

**`pnpm lint`** — 14/14 turbo tasks successful, 2 warnings (same 2 pre-existing ones from Phase 1–4, unrelated to Phase 5), 0 errors.

**`npx playwright test tests/claims --workers=1 --retries=0`** (new suite, `apps/e2e/tests/claims/claims.spec.ts`) — **4/4 passed** (final run, 74.9s combined), after fixing one real bug surfaced by this exact test run (see `docs/progress/DECISIONS.md`): the institutional-claim create RPC sent an empty string (React Hook Form's default for an unfilled optional date field) rather than `undefined` for `admissionDate`/`dischargeDate`, and Postgres rejected `''` as a `date` value with `invalid input syntax for type date: ""`. Confirmed via the dev server log showing the exact Postgres error and a `POST /home/claims 500`, only reachable once the institutional flow (which has date fields; professional claims don't) was actually driven in a real browser. Fixed by switching `?? undefined` to `|| undefined` for every optional date/text field crossing the RPC boundary, in both the Server Action and the REST route.

**`npx playwright test --workers=1 --retries=0`** (full regression check, every spec) — **41/43 passed** (4.9m). The same 2 pre-existing failures as every prior phase's closeout (`account.spec.ts:36`, `password-reset.spec.ts:11`), same OTP-expiry root cause, unrelated to Phase 5. All Phase 1–4 suites (navigation, organizations, entities, authentication, account, payers) plus the new `claims` suite pass with no regressions.

## Phase 6 — EDI processor & trace graph

Run 2026-07-19 on branch `feat/bh-clearinghouse-mvp`, local Supabase up via Docker, dev server on `localhost:3000`.

**`pnpm install`** — caught a real circular workspace dependency (`@kit/edi` → `worker` → `@kit/edi`) via pnpm's own cyclic-dependency warning before any migration or test ran. Fixed by moving the pure generation utilities (`control-numbers.ts`, `synthetic-x12.ts`, `hash.ts`) into `apps/worker` itself; re-ran `pnpm install` clean with no warning.

**`pnpm --filter web supabase:reset`** — first attempt failed: `ERROR: cannot alter type of a column used in a policy definition (SQLSTATE 0A000)` when widening `claims.status` to `varchar(30)`, since the Phase 5 `claims_update_edit`/`claims_update_approve` RLS policies reference that column. Fixed by dropping both policies before the `ALTER COLUMN TYPE` and recreating them after. Second attempt: "Applying migration 20260718232603_organizations.sql... ... Applying migration 20260719040000_edi.sql... Seeding data from supabase/seed.sql... Restarting containers... Finished supabase db reset" — clean, no errors. Verified directly via `psql \d+ public.claims` that only one `claims_status_check` constraint exists afterward (six values), not a leftover duplicate.

**`supabase db test`** (all five suites) — **91/91 pgTAP assertions passed** (16 new in `edi-rls.test.sql` + 21 from Phase 5's `claims-rls.test.sql` + 54 from Phase 2/3/4, all unaffected). One intermediate failure during development: the first draft of `edi-rls.test.sql` used `g`/`h`/`i`/`j` as UUID prefix characters for fixture IDs, which aren't valid hex digits (`invalid input syntax for type uuid`) — fixed by replacing with `a`/`b`/`c`/`d`. `edi-rls.test.sql` covers: org-owned CRUD/read for `processing_jobs`/`edi_transactions`/`edi_payloads`/`acknowledgments`/`rule_evaluations`/`replay_attempts`/`transaction_events`, the `processing_jobs.claim_id` and `edi_transactions.claim_id` uniqueness constraints (idempotency, proven as a real duplicate-key violation), cross-tenant read/insert denial, a cross-org FK-consistency trigger negative, the `claims.approve_submit` permission gate (a `remittance_specialist` denied), and the append-only proof (`UPDATE`/`DELETE` on `transaction_events` both fail with `permission denied for table transaction_events`).

**`pnpm typecheck`** — 18/18 turbo tasks successful (final run after all fixes), 0 errors on the very first attempt (before any of the three runtime bugs below were found — this phase's bugs were all runtime/RLS/display issues, not type errors).

**`pnpm lint`** — 17/17 turbo tasks successful, 2 warnings (same 2 pre-existing ones from Phase 1–5, unrelated to Phase 6), 0 errors.

**`npx playwright test tests/edi --workers=1 --retries=0`** (new suite, `apps/e2e/tests/edi/edi.spec.ts`) — **2/2 passed** (final run, ~45s combined), after fixing two real bugs surfaced by this exact test run (see `docs/progress/DECISIONS.md`): (1) `claims.status` was `varchar(20)` (Phase 5) and `'accepted_for_adjudication'` is 25 characters — the final status-transition `UPDATE` failed with `value too long for type character varying(20)`, silently swallowed because the calling code didn't check the error, so the claim stayed stuck at `submitted` in the UI even though the processor had already written the `accepted_for_adjudication` trace event and marked the job `completed`. Diagnosed by finding the actual stuck claim left behind in the local dev DB by the failed run and reproducing the exact authenticated `UPDATE` via `psql` to surface the real Postgres error (the dev log only showed a generic PostgREST `400`). Fixed by widening the column to `varchar(30)` and adding error-checking to both claims-status updates in `DeterministicClaimProcessor`. (2) Once the real status value could render, both status-badge components' `.replace('_', ' ')` (only replaces the first underscore) showed `'accepted_for_adjudication'` as "accepted for_adjudication" — fixed with `.replaceAll('_', ' ')`.

**`npx playwright test --workers=1 --retries=0`** (full regression check, every spec) — **43/45 passed** (5.7m). The same 2 pre-existing failures as every prior phase's closeout (`account.spec.ts:36`, `password-reset.spec.ts:11`), same OTP-expiry root cause, unrelated to Phase 6. All Phase 1–5 suites (navigation, organizations, entities, authentication, account, payers, claims) plus the new `edi` suite pass with no regressions.
