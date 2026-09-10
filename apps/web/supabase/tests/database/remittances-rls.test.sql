-- Phase 7 pgTAP suite: org-owned CRUD/read for the remittance/reconciliation
-- tables, cross-tenant denial, cross-org FK-consistency trigger negatives,
-- the claims.approve_submit permission gate for adjudication writes, the
-- remittances.post_payment permission gate for payment_matches writes, and
-- the uniqueness constraints that ARE the idempotency guarantees
-- (remittances.claim_id, payment_matches.eft_trace_id). All fixture data
-- is synthetic. Wrapped in begin/rollback so the suite never leaves state
-- behind.
begin;

select plan(18);

-- ---------------------------------------------------------------------
-- Fixtures (inserted as postgres/superuser, bypasses RLS by design)
-- ---------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
    ('a1111111-1111-1111-1111-111111111111', 'sim-remit-org1-manager@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a2222222-2222-2222-2222-222222222222', 'sim-remit-org1-specialist@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a3333333-3333-3333-3333-333333333333', 'sim-remit-org1-auditor@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a4444444-4444-4444-4444-444444444444', 'sim-remit-org2-owner@example.test', '{}'::jsonb, 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, created_by)
values
    ('b1111111-1111-1111-1111-111111111111', 'SIM Remit Org One', 'sim-remit-org-one', 'a1111111-1111-1111-1111-111111111111'),
    ('b2222222-2222-2222-2222-222222222222', 'SIM Remit Org Two', 'sim-remit-org-two', 'a4444444-4444-4444-4444-444444444444');

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', id
from public.roles where key = 'claims_manager';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', id
from public.roles where key = 'remittance_specialist';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', id
from public.roles where key = 'read_only_auditor';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444', id
from public.roles where key = 'org_owner';

-- org1 fixture claim
insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Remi', 'Testperson', '1990-01-01');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values ('c1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Remi', 'Testperson');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values ('c1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111111', 'SIM Test Payer');

insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('c1111111-1111-1111-1111-111111111114', 'b1111111-1111-1111-1111-111111111111', 'individual', '1000000041', 'Billy', 'Remitprovider');

insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id, status)
values ('c1111111-1111-1111-1111-111111111115', 'b1111111-1111-1111-1111-111111111111', 'professional', 'c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111113', 'c1111111-1111-1111-1111-111111111114', 'accepted_for_adjudication');

-- org2 fixture claim + remittance (mirror, used only for cross-tenant/trigger tests)
insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values ('c2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222', 'Peg', 'Otherpatient', '1995-09-09');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values ('c2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222221', 'Peg', 'Otherpatient');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values ('c2222222-2222-2222-2222-222222222223', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222221', 'SIM Other Payer');

insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('c2222222-2222-2222-2222-222222222224', 'b2222222-2222-2222-2222-222222222222', 'individual', '1000000042', 'Bea', 'Otherorgprovider');

insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id, status)
values ('c2222222-2222-2222-2222-222222222225', 'b2222222-2222-2222-2222-222222222222', 'professional', 'c2222222-2222-2222-2222-222222222221', 'c2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222223', 'c2222222-2222-2222-2222-222222222224', 'accepted_for_adjudication');

insert into public.remittances (id, organization_id, claim_id, sim_remittance_id, isa13, gs06, st02, raw_835_payload, payload_hash, total_paid_amount, outcome, status)
values ('d2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222225', 'SIM-ERA-FIXTURE', '000000009', '000000009', '0009', '835 fixture payload', 'deadbeef', 80, 'paid', 'paid');

-- org2's remit_claims row, used only as the cross-org FK-trigger negative
-- target for remit_service_lines below.
insert into public.remit_claims (id, organization_id, remittance_id, claim_id, charge_amount, paid_amount, patient_responsibility)
values ('d2222222-2222-2222-2222-222222222229', 'b2222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222221', 'c2222222-2222-2222-2222-222222222225', 100.00, 80.00, 0);

-- a second org1 claim, already adjudicated + an unmatched EFT trace, used
-- below to test the payment_matches permission gate in isolation from the
-- uniqueness guard (the first eft_trace gets legitimately matched earlier
-- in this suite, so a fresh, still-unmatched one is needed here).
insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id, status)
values ('c1111111-1111-1111-1111-111111111116', 'b1111111-1111-1111-1111-111111111111', 'professional', 'c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111113', 'c1111111-1111-1111-1111-111111111114', 'accepted_for_adjudication');

insert into public.remittances (id, organization_id, claim_id, sim_remittance_id, isa13, gs06, st02, raw_835_payload, payload_hash, total_paid_amount, outcome, status)
values ('d1111111-1111-1111-1111-111111111115', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111116', 'SIM-ERA-00000003', '000000014', '000000014', '0014', '835 second payload', 'f00dcafe', 80.00, 'paid', 'paid');

insert into public.eft_traces (id, organization_id, remittance_id, eft_trace_number, amount)
values ('d1111111-1111-1111-1111-111111111116', 'b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111115', 'SIM-EFT-00000002', 80.00);

-- switch to a simulated authenticated request, as org1's claims_manager
-- (has claims.approve_submit + remittances.view)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

-- ---------------------------------------------------------------------
-- org-owned CRUD / idempotency
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.remittances (id, organization_id, claim_id, sim_remittance_id, isa13, gs06, st02, raw_835_payload, payload_hash, total_paid_amount, outcome, status)
       values ('d1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'SIM-ERA-00000001', '000000010', '000000010', '0010', '835 test payload', 'cafebabe', 80.00, 'paid', 'paid') $$,
    'org-owned CRUD: claims_manager can adjudicate (insert remittances) for their own org''s claim'
);

select throws_ok(
    $$ insert into public.remittances (organization_id, claim_id, sim_remittance_id, isa13, gs06, st02, raw_835_payload, payload_hash, total_paid_amount, outcome, status)
       values ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'SIM-ERA-00000002', '000000011', '000000011', '0011', 'dup', 'x', 0, 'denied', 'denied') $$,
    'duplicate key value violates unique constraint "remittances_claim_id_key"',
    'idempotency: a second remittances row for the same claim_id is rejected -- this IS the duplicate-adjudication guarantee'
);

select lives_ok(
    $$ insert into public.remit_claims (id, organization_id, remittance_id, claim_id, charge_amount, paid_amount, patient_responsibility)
       values ('d1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 100.00, 80.00, 0) $$,
    'org-owned CRUD: claims_manager can insert the remit_claims breakdown'
);

select lives_ok(
    $$ insert into public.claim_adjustments (organization_id, remit_claim_id, adjustment_group, carc_code, amount, explanation)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111112', 'CO', 'SIM-CARC-CO1', 20.00, 'Simulated contractual adjustment') $$,
    'org-owned CRUD: claims_manager can insert a claim_adjustments row'
);

select lives_ok(
    $$ insert into public.eft_traces (id, organization_id, remittance_id, eft_trace_number, amount)
       values ('d1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'SIM-EFT-00000001', 80.00) $$,
    'org-owned CRUD: claims_manager can insert an eft_traces row for a paid remittance'
);

select lives_ok(
    $$ insert into public.remit_service_lines (organization_id, remit_claim_id, charge_amount, paid_amount)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111112', 100.00, 80.00) $$,
    'org-owned CRUD: claims_manager can insert the per-line remit_service_lines breakdown'
);

-- ---------------------------------------------------------------------
-- payment_matches: gated on remittances.post_payment, not claims.approve_submit
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select lives_ok(
    $$ insert into public.payment_matches (id, organization_id, eft_trace_id, remittance_id, matched_amount)
       values ('d1111111-1111-1111-1111-111111111114', 'b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111113', 'd1111111-1111-1111-1111-111111111111', 80.00) $$,
    'RBAC: remittance_specialist (has remittances.post_payment) can match an EFT deposit'
);

select throws_ok(
    $$ insert into public.payment_matches (organization_id, eft_trace_id, remittance_id, matched_amount)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111113', 'd1111111-1111-1111-1111-111111111111', 80.00) $$,
    'duplicate key value violates unique constraint "payment_matches_eft_trace_id_key"',
    'idempotency: a second payment_matches row for the same eft_trace_id is rejected -- this IS the duplicate-match guarantee'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select throws_ok(
    $$ insert into public.eft_traces (organization_id, remittance_id, eft_trace_number, amount)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'SIM-EFT-BLOCKED', 999) $$,
    'duplicate key value violates unique constraint "eft_traces_remittance_id_key"',
    'a remittance can only have one eft_traces row (unique on remittance_id)'
);

-- ---------------------------------------------------------------------
-- Cross-tenant denial
-- ---------------------------------------------------------------------

select is(
    (select count(*)::int from public.remittances where id = 'd2222222-2222-2222-2222-222222222221'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s remittances row'
);

select throws_ok(
    $$ insert into public.remittances (organization_id, claim_id, sim_remittance_id, isa13, gs06, st02, raw_835_payload, payload_hash, total_paid_amount, outcome, status)
       values ('b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222225', 'SIM-ERA-BLOCKED', '000000012', '000000012', '0012', 'blocked', 'x', 0, 'denied', 'denied') $$,
    'new row violates row-level security policy for table "remittances"',
    'cross-tenant insert denied: org1 member cannot insert into org2 (using org2''s own claim, so RLS -- not the FK-consistency trigger -- is what blocks it)'
);

-- ---------------------------------------------------------------------
-- Cross-org FK-consistency trigger negatives
-- ---------------------------------------------------------------------

select throws_ok(
    $$ insert into public.remit_claims (organization_id, remittance_id, claim_id, charge_amount, paid_amount)
       values ('b1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222221', 'c1111111-1111-1111-1111-111111111115', 100, 80) $$,
    'organization_id must match the referenced remittance''s organization',
    'cross-org FK trigger denied: remit_claims cannot reference another org''s remittance'
);

select throws_ok(
    $$ insert into public.eft_traces (organization_id, remittance_id, eft_trace_number, amount)
       values ('b1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222221', 'SIM-EFT-BLOCKED2', 999) $$,
    'organization_id must match the referenced remittance''s organization',
    'cross-org FK trigger denied: eft_traces cannot reference another org''s remittance'
);

select throws_ok(
    $$ insert into public.claim_adjustments (organization_id, remit_claim_id, adjustment_group, carc_code, amount, explanation)
       values ('b2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111112', 'CO', 'SIM-CARC-BLOCKED', 1, 'blocked') $$,
    'organization_id must match the referenced remit_claim''s organization',
    'cross-org FK trigger denied: claim_adjustments cannot reference another org''s remit_claim'
);

select throws_ok(
    $$ insert into public.remit_service_lines (organization_id, remit_claim_id, charge_amount, paid_amount)
       values ('b1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222229', 100, 80) $$,
    'organization_id must match the referenced remit_claim''s organization',
    'cross-org FK trigger denied: remit_service_lines cannot reference another org''s remit_claim'
);

-- ---------------------------------------------------------------------
-- Permission gates
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

select is(
    (select count(*)::int from public.remittances where organization_id = 'b1111111-1111-1111-1111-111111111111'),
    2,
    'RBAC: read_only_auditor (has remittances.view) can read org1''s remittances'
);

select throws_ok(
    $$ insert into public.remittances (organization_id, claim_id, sim_remittance_id, isa13, gs06, st02, raw_835_payload, payload_hash, total_paid_amount, outcome, status)
       values ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'SIM-ERA-BLOCKED3', '000000013', '000000013', '0013', 'blocked', 'x', 0, 'denied', 'denied') $$,
    'new row violates row-level security policy for table "remittances"',
    'RBAC: read_only_auditor lacks claims.approve_submit and cannot adjudicate (insert remittances)'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select throws_ok(
    $$ insert into public.payment_matches (organization_id, eft_trace_id, remittance_id, matched_amount)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111116', 'd1111111-1111-1111-1111-111111111115', 80.00) $$,
    'new row violates row-level security policy for table "payment_matches"',
    'RBAC: claims_manager has claims.approve_submit but lacks remittances.post_payment and cannot match/post a payment, even on a fresh, unmatched EFT trace'
);

select * from finish();

rollback;
