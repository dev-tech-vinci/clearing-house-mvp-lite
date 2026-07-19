-- Phase 6 pgTAP suite: org-owned CRUD/read for the EDI/trace tables,
-- cross-tenant denial, cross-org FK-consistency trigger negatives, the
-- claims.approve_submit permission gate, the processing_jobs uniqueness
-- that IS the idempotency guarantee, and the append-only proof for
-- transaction_events (no UPDATE/DELETE grant to authenticated at all).
-- All fixture data is synthetic. Wrapped in begin/rollback so the suite
-- never leaves state behind.
begin;

select plan(16);

-- ---------------------------------------------------------------------
-- Fixtures (inserted as postgres/superuser, bypasses RLS by design)
-- ---------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
    ('a1111111-1111-1111-1111-111111111111', 'sim-edi-org1-manager@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a2222222-2222-2222-2222-222222222222', 'sim-edi-org1-remit-specialist@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a3333333-3333-3333-3333-333333333333', 'sim-edi-org2-owner@example.test', '{}'::jsonb, 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, created_by)
values
    ('b1111111-1111-1111-1111-111111111111', 'SIM EDI Org One', 'sim-edi-org-one', 'a1111111-1111-1111-1111-111111111111'),
    ('b2222222-2222-2222-2222-222222222222', 'SIM EDI Org Two', 'sim-edi-org-two', 'a3333333-3333-3333-3333-333333333333');

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', id
from public.roles where key = 'claims_manager';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', id
from public.roles where key = 'remittance_specialist';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', id
from public.roles where key = 'org_owner';

-- org1 fixture claim
insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Edie', 'Testperson', '1990-01-01');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values ('c1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Edie', 'Testperson');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values ('c1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111111', 'SIM Test Payer');

insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('c1111111-1111-1111-1111-111111111114', 'b1111111-1111-1111-1111-111111111111', 'individual', '1000000031', 'Billy', 'Ediprovider');

insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id, status)
values ('c1111111-1111-1111-1111-111111111115', 'b1111111-1111-1111-1111-111111111111', 'professional', 'c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111113', 'c1111111-1111-1111-1111-111111111114', 'approved');

-- org2 fixture claim (mirror, used only for cross-tenant/trigger tests)
insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values ('c2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222', 'Peg', 'Otherpatient', '1995-09-09');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values ('c2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222221', 'Peg', 'Otherpatient');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values ('c2222222-2222-2222-2222-222222222223', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222221', 'SIM Other Payer');

insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('c2222222-2222-2222-2222-222222222224', 'b2222222-2222-2222-2222-222222222222', 'individual', '1000000032', 'Bea', 'Otherorgprovider');

insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id, status)
values ('c2222222-2222-2222-2222-222222222225', 'b2222222-2222-2222-2222-222222222222', 'professional', 'c2222222-2222-2222-2222-222222222221', 'c2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222223', 'c2222222-2222-2222-2222-222222222224', 'approved');

insert into public.processing_jobs (id, organization_id, claim_id, idempotency_key, correlation_id, status)
values ('d2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222225', 'submit:i2222222-2222-2222-2222-222222222225', gen_random_uuid(), 'completed');

insert into public.transaction_events (id, organization_id, claim_id, event_name, event_category, actor_type, status, explanation, correlation_id)
values ('d2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222225', 'claim_submitted', 'submission', 'user', 'submitted', 'org2 fixture event', gen_random_uuid());

-- switch to a simulated authenticated request, as org1's claims_manager
-- (has claims.approve_submit)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

-- ---------------------------------------------------------------------
-- org-owned CRUD / idempotency
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.processing_jobs (id, organization_id, claim_id, idempotency_key, correlation_id, status)
       values ('d1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'submit:i1111111-1111-1111-1111-111111111115', gen_random_uuid(), 'processing') $$,
    'org-owned CRUD: claims_manager can claim the idempotency slot for their own org''s claim'
);

select throws_ok(
    $$ insert into public.processing_jobs (organization_id, claim_id, idempotency_key, correlation_id, status)
       values ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'submit:i1111111-1111-1111-1111-111111111115', gen_random_uuid(), 'processing') $$,
    'duplicate key value violates unique constraint "processing_jobs_claim_id_key"',
    'idempotency: a second processing_jobs row for the same claim_id is rejected by the unique constraint -- this IS the duplicate-submit guarantee'
);

select lives_ok(
    $$ insert into public.edi_transactions (id, organization_id, claim_id, transaction_type, isa13, gs06, st02)
       values ('d1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', '837P', '000000001', '000000001', '0001') $$,
    'org-owned CRUD: claims_manager can generate an edi_transactions row for their own claim'
);

select throws_ok(
    $$ insert into public.edi_transactions (organization_id, claim_id, transaction_type, isa13, gs06, st02)
       values ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', '837P', '000000002', '000000002', '0002') $$,
    'duplicate key value violates unique constraint "edi_transactions_claim_id_key"',
    'a claim can only have one edi_transactions row (unique on claim_id), matching one submission per claim in this phase'
);

select lives_ok(
    $$ insert into public.edi_payloads (organization_id, edi_transaction_id, direction, transaction_type, raw_payload, payload_hash)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111112', 'outbound', '837P', '* SIMULATED 837P~', 'deadbeef') $$,
    'org-owned CRUD: claims_manager can store the outbound payload'
);

select lives_ok(
    $$ insert into public.acknowledgments (organization_id, edi_transaction_id, ack_type, status, code, explanation)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111112', 'TA1', 'accepted', 'TA1-A', 'Simulated TA1: accepted') $$,
    'org-owned CRUD: claims_manager can record a TA1 acknowledgment'
);

select lives_ok(
    $$ insert into public.rule_evaluations (organization_id, claim_id, rule_code, category, passed, severity, rejection_or_denial, explanation)
       values ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'SIM-RULE-UNIV-001', 'universal', true, 'error', 'rejection', 'Diagnosis present') $$,
    'org-owned CRUD: claims_manager can record a rule evaluation'
);

select lives_ok(
    $$ insert into public.replay_attempts (organization_id, claim_id, idempotency_key, outcome, processing_job_id)
       values ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'submit:i1111111-1111-1111-1111-111111111115', 'processed', 'd1111111-1111-1111-1111-111111111111') $$,
    'org-owned CRUD: claims_manager can log a replay attempt'
);

select lives_ok(
    $$ insert into public.transaction_events (id, organization_id, claim_id, event_name, event_category, actor_type, status, explanation, correlation_id)
       values ('d1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'claim_submitted', 'submission', 'user', 'submitted', 'Claim submitted for processing.', gen_random_uuid()) $$,
    'org-owned CRUD: claims_manager can append a transaction_events row'
);

-- ---------------------------------------------------------------------
-- Cross-tenant denial
-- ---------------------------------------------------------------------

select is(
    (select count(*)::int from public.processing_jobs where id = 'd2222222-2222-2222-2222-222222222221'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s processing_jobs row'
);

select is(
    (select count(*)::int from public.transaction_events where id = 'd2222222-2222-2222-2222-222222222222'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s transaction_events row'
);

select throws_ok(
    $$ insert into public.edi_transactions (organization_id, claim_id, transaction_type, isa13, gs06, st02)
       values ('b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222225', '837P', '000000003', '000000003', '0003') $$,
    'new row violates row-level security policy for table "edi_transactions"',
    'cross-tenant insert denied: org1 member cannot insert into org2 (using org2''s own claim, so RLS -- not the FK-consistency trigger -- is what blocks it)'
);

-- ---------------------------------------------------------------------
-- Cross-org FK-consistency trigger negative
-- ---------------------------------------------------------------------

select throws_ok(
    $$ insert into public.transaction_events (organization_id, claim_id, event_name, event_category, actor_type, status, explanation, correlation_id)
       values ('b1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222225', 'claim_submitted', 'submission', 'user', 'submitted', 'blocked', gen_random_uuid()) $$,
    'organization_id must match the referenced claim''s organization',
    'cross-org FK trigger denied: transaction_events cannot reference another org''s claim'
);

-- ---------------------------------------------------------------------
-- Permission gate: claims.approve_submit
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select throws_ok(
    $$ insert into public.transaction_events (organization_id, claim_id, event_name, event_category, actor_type, status, explanation, correlation_id)
       values ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'claim_submitted', 'submission', 'user', 'submitted', 'blocked', gen_random_uuid()) $$,
    'new row violates row-level security policy for table "transaction_events"',
    'RBAC: remittance_specialist lacks claims.approve_submit and cannot write a transaction_events row, even in their own org'
);

-- ---------------------------------------------------------------------
-- Append-only: transaction_events has no UPDATE/DELETE grant at all
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select throws_ok(
    $$ update public.transaction_events set status = 'tampered' where id = 'd1111111-1111-1111-1111-111111111113' $$,
    'permission denied for table transaction_events',
    'append-only: UPDATE on transaction_events is denied outright (no grant), not just filtered by RLS'
);

select throws_ok(
    $$ delete from public.transaction_events where id = 'd1111111-1111-1111-1111-111111111113' $$,
    'permission denied for table transaction_events',
    'append-only: DELETE on transaction_events is denied outright (no grant)'
);

select * from finish();

rollback;
