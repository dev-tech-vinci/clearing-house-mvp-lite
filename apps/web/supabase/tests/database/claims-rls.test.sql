-- Phase 5 pgTAP suite: org-owned CRUD, cross-tenant denial, cross-org
-- FK-consistency trigger negatives (claims/lines can't reference another
-- org's patient/subscriber/coverage/provider/facility), and the RBAC
-- approval gate (claims_specialist can create/edit but not approve;
-- claims_manager can). All fixture data is synthetic (SIM- prefixed /
-- obviously fictional names). Wrapped in begin/rollback so the suite
-- never leaves state behind.
begin;

select plan(21);

-- ---------------------------------------------------------------------
-- Fixtures (inserted as postgres/superuser, bypasses RLS by design)
-- ---------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
    ('a1111111-1111-1111-1111-111111111111', 'sim-claims-specialist@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a2222222-2222-2222-2222-222222222222', 'sim-claims-manager@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a3333333-3333-3333-3333-333333333333', 'sim-claims-remit-specialist@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a4444444-4444-4444-4444-444444444444', 'sim-claims-org2-owner@example.test', '{}'::jsonb, 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, created_by)
values
    ('b1111111-1111-1111-1111-111111111111', 'SIM Claims Org One', 'sim-claims-org-one', 'a1111111-1111-1111-1111-111111111111'),
    ('b2222222-2222-2222-2222-222222222222', 'SIM Claims Org Two', 'sim-claims-org-two', 'a4444444-4444-4444-4444-444444444444');

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', id
from public.roles where key = 'claims_specialist';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', id
from public.roles where key = 'claims_manager';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', id
from public.roles where key = 'remittance_specialist';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444', id
from public.roles where key = 'org_owner';

-- org1 fixture entities
insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values ('e1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Patty', 'Testperson', '1990-01-01');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values ('e1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Patty', 'Testperson');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values ('e1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 'e1111111-1111-1111-1111-111111111111', 'SIM Test Payer');

insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('e1111111-1111-1111-1111-111111111114', 'b1111111-1111-1111-1111-111111111111', 'individual', '1000000001', 'Billy', 'Billingprovider');

insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('e1111111-1111-1111-1111-111111111115', 'b1111111-1111-1111-1111-111111111111', 'individual', '1000000019', 'Rhonda', 'Renderingprovider');

insert into public.facilities (id, organization_id, name)
values ('e1111111-1111-1111-1111-111111111116', 'b1111111-1111-1111-1111-111111111111', 'SIM Clinic One');

-- org2 fixture entities (mirror, used only for cross-tenant/trigger tests)
insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values ('e2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222', 'Petra', 'Otherpatient', '1995-09-09');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values ('e2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222221', 'Petra', 'Otherpatient');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values ('e2222222-2222-2222-2222-222222222223', 'b2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222221', 'SIM Other Payer');

insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('e2222222-2222-2222-2222-222222222224', 'b2222222-2222-2222-2222-222222222222', 'individual', '1000000002', 'Bea', 'Otherorgprovider');

insert into public.facilities (id, organization_id, name)
values ('e2222222-2222-2222-2222-222222222225', 'b2222222-2222-2222-2222-222222222222', 'SIM Clinic Two');

insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
values ('d2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222', 'professional', 'e2222222-2222-2222-2222-222222222221', 'e2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222223', 'e2222222-2222-2222-2222-222222222224');

-- a third org1 claim, kept without institutional_claim_details attached
-- yet, so the facility-org-mismatch trigger test below can insert into it
insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
values ('d1111111-1111-1111-1111-111111111117', 'b1111111-1111-1111-1111-111111111111', 'institutional', 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 'e1111111-1111-1111-1111-111111111113', 'e1111111-1111-1111-1111-111111111114');

-- switch to a simulated authenticated request, as org1's claims_specialist
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

-- ---------------------------------------------------------------------
-- org-owned CRUD: claims_specialist can create both claim types
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
       values ('d1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'professional', 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 'e1111111-1111-1111-1111-111111111113', 'e1111111-1111-1111-1111-111111111114') $$,
    'org-owned CRUD: claims_specialist can insert a professional claim into their own org'
);

select lives_ok(
    $$ insert into public.professional_claim_details (claim_id, organization_id, rendering_provider_id)
       values ('d1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111115') $$,
    'org-owned CRUD: claims_specialist can add professional_claim_details to their own claim'
);

select lives_ok(
    $$ insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
       values ('d1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'institutional', 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 'e1111111-1111-1111-1111-111111111113', 'e1111111-1111-1111-1111-111111111114') $$,
    'org-owned CRUD: claims_specialist can insert an institutional claim into their own org'
);

select lives_ok(
    $$ insert into public.institutional_claim_details (claim_id, organization_id, facility_id, type_of_bill)
       values ('d1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111116', '0761') $$,
    'org-owned CRUD: claims_specialist can add institutional_claim_details to their own claim'
);

select lives_ok(
    $$ insert into public.claim_diagnoses (organization_id, claim_id, diagnosis_code, diagnosis_pointer, is_primary)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'F32.9', 1, true) $$,
    'org-owned CRUD: claims_specialist can add a diagnosis to their own claim'
);

select lives_ok(
    $$ insert into public.claim_lines (organization_id, claim_id, line_number, service_date, procedure_code, units, charge_amount, diagnosis_pointers)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 1, current_date, '90834', 1, 150.00, '{1}') $$,
    'org-owned CRUD: claims_specialist can add a service line to their own claim'
);

-- ---------------------------------------------------------------------
-- Cross-tenant denial
-- ---------------------------------------------------------------------

select is(
    (select count(*)::int from public.claims where id = 'd2222222-2222-2222-2222-222222222221'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s claim'
);

select throws_ok(
    $$ insert into public.claims (organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
       values ('b2222222-2222-2222-2222-222222222222', 'professional', 'e2222222-2222-2222-2222-222222222221', 'e2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222223', 'e2222222-2222-2222-2222-222222222224') $$,
    'new row violates row-level security policy for table "claims"',
    'cross-tenant insert denied: org1 member cannot insert a claim into org2 (using org2''s own entities, so RLS -- not the FK-consistency trigger -- is what blocks it)'
);

-- ---------------------------------------------------------------------
-- Cross-org FK-consistency trigger negatives
-- ---------------------------------------------------------------------

select throws_ok(
    $$ insert into public.claims (organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
       values ('b1111111-1111-1111-1111-111111111111', 'professional', 'e2222222-2222-2222-2222-222222222221', 'e1111111-1111-1111-1111-111111111112', 'e1111111-1111-1111-1111-111111111113', 'e1111111-1111-1111-1111-111111111114') $$,
    'claim.organization_id must match the referenced patient''s organization',
    'cross-org FK trigger denied: claim cannot reference another org''s patient'
);

select throws_ok(
    $$ insert into public.claims (organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
       values ('b1111111-1111-1111-1111-111111111111', 'professional', 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 'e2222222-2222-2222-2222-222222222223', 'e1111111-1111-1111-1111-111111111114') $$,
    'claim.organization_id must match the referenced coverage''s organization',
    'cross-org FK trigger denied: claim cannot reference another org''s coverage'
);

select throws_ok(
    $$ insert into public.claims (organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
       values ('b1111111-1111-1111-1111-111111111111', 'professional', 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 'e1111111-1111-1111-1111-111111111113', 'e2222222-2222-2222-2222-222222222224') $$,
    'claim.organization_id must match the referenced billing provider''s organization',
    'cross-org FK trigger denied: claim cannot reference another org''s billing provider'
);

select throws_ok(
    $$ insert into public.professional_claim_details (claim_id, organization_id, rendering_provider_id)
       values ('d1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222224') $$,
    'professional_claim_details.organization_id must match the referenced rendering provider''s organization',
    'cross-org FK trigger denied: professional_claim_details cannot reference another org''s rendering provider'
);

select throws_ok(
    $$ insert into public.institutional_claim_details (claim_id, organization_id, facility_id, type_of_bill)
       values ('d1111111-1111-1111-1111-111111111117', 'b1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222225', '0761') $$,
    'institutional_claim_details.organization_id must match the referenced facility''s organization',
    'cross-org FK trigger denied: institutional_claim_details cannot reference another org''s facility'
);

select throws_ok(
    $$ insert into public.claim_diagnoses (organization_id, claim_id, diagnosis_code, diagnosis_pointer)
       values ('b2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'F41.1', 2) $$,
    'organization_id must match the referenced claim''s organization',
    'cross-org FK trigger denied: claim_diagnoses.organization_id must match its parent claim''s organization'
);

select throws_ok(
    $$ insert into public.claim_lines (organization_id, claim_id, line_number, service_date, procedure_code, units, charge_amount)
       values ('b2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 2, current_date, '90837', 1, 200.00) $$,
    'organization_id must match the referenced claim''s organization',
    'cross-org FK trigger denied: claim_lines.organization_id must match its parent claim''s organization'
);

select throws_ok(
    $$ insert into public.claim_relationships (organization_id, claim_id, related_claim_id, relationship_type)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222221', 'corrected') $$,
    'claim_relationships.organization_id must match the referenced related claim''s organization',
    'cross-org FK trigger denied: claim_relationships cannot link to another org''s claim'
);

-- ---------------------------------------------------------------------
-- RBAC: claims.create_edit vs claims.approve_submit
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

select throws_ok(
    $$ insert into public.claims (organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id)
       values ('b1111111-1111-1111-1111-111111111111', 'professional', 'e1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111112', 'e1111111-1111-1111-1111-111111111113', 'e1111111-1111-1111-1111-111111111114') $$,
    'new row violates row-level security policy for table "claims"',
    'RBAC: remittance_specialist lacks claims.create_edit and cannot insert a claim'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select lives_ok(
    $$ update public.claims set status = 'validated', updated_by = 'a1111111-1111-1111-1111-111111111111' where id = 'd1111111-1111-1111-1111-111111111111' $$,
    'claims_update_edit: claims_specialist can move their own claim to validated (claims.create_edit, status <> approved)'
);

-- Unlike Phase 4's payers_update negative (where a non-admin's USING
-- clause fails, so the row is never selected and the update silently
-- affects 0 rows), here claims_update_edit's USING clause is has_org_access
-- alone -- true for claims_specialist -- so the row IS selected, and it's
-- the WITH CHECK across both permissive policies that fails on the new
-- row. Postgres throws in that case rather than silently filtering.
select throws_ok(
    $$ update public.claims set status = 'approved', approved_by = 'a1111111-1111-1111-1111-111111111111' where id = 'd1111111-1111-1111-1111-111111111111' $$,
    'new row violates row-level security policy for table "claims"',
    'RBAC: claims_specialist cannot approve a claim (has claims.create_edit but not claims.approve_submit)'
);

select is(
    (select status from public.claims where id = 'd1111111-1111-1111-1111-111111111111'),
    'validated',
    'RBAC: the rejected approval attempt left the claim''s status unchanged'
);

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

update public.claims set status = 'approved', approved_by = 'a2222222-2222-2222-2222-222222222222'
where id = 'd1111111-1111-1111-1111-111111111111';

select is(
    (select status from public.claims where id = 'd1111111-1111-1111-1111-111111111111'),
    'approved',
    'RBAC: claims_manager (has claims.approve_submit) can approve the claim'
);

select * from finish();

rollback;
