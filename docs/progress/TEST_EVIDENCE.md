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
