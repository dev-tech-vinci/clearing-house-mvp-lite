-- Phase 3 pgTAP suite: org-owned CRUD, cross-tenant denial, and cross-org
-- FK-consistency trigger negatives for providers, facilities, patients,
-- subscribers, coverages, and organization_payer_enrollments. All fixture
-- data is synthetic (SIM- prefixed / obviously fictional names). Wrapped
-- in begin/rollback so the suite never leaves state behind.
begin;

select plan(22);

-- ---------------------------------------------------------------------
-- Fixtures (inserted as postgres/superuser, bypasses RLS by design)
-- ---------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
    ('d1111111-1111-1111-1111-111111111111', 'sim-entities-owner1@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('d2222222-2222-2222-2222-222222222222', 'sim-entities-owner2@example.test', '{}'::jsonb, 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, created_by)
values
    ('c1111111-1111-1111-1111-111111111111', 'SIM Entities Org One', 'sim-entities-org-one', 'd1111111-1111-1111-1111-111111111111'),
    ('c2222222-2222-2222-2222-222222222222', 'SIM Entities Org Two', 'sim-entities-org-two', 'd2222222-2222-2222-2222-222222222222');

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'c1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', id
from public.roles where key = 'org_owner';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'c2222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', id
from public.roles where key = 'org_owner';

-- org1 fixture entities
insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('e1000000-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', 'individual', '1000000001', 'Simone', 'Fictional');

insert into public.facilities (id, organization_id, name)
values ('e1000000-0000-0000-0000-000000000002', 'c1111111-1111-1111-1111-111111111111', 'SIM Clinic One');

insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values
    ('e1000000-0000-0000-0000-000000000003', 'c1111111-1111-1111-1111-111111111111', 'Patty', 'Testperson', '1990-01-01'),
    ('e1000000-0000-0000-0000-000000000004', 'c1111111-1111-1111-1111-111111111111', 'Pat', 'Secondtest', '1985-05-05');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values ('e1000000-0000-0000-0000-000000000005', 'c1111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000003', 'Patty', 'Testperson');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values ('e1000000-0000-0000-0000-000000000006', 'c1111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000003', 'SIM Test Payer');

insert into public.organization_payer_enrollments (id, organization_id, payer_label)
values ('e1000000-0000-0000-0000-000000000007', 'c1111111-1111-1111-1111-111111111111', 'SIM Test Payer');

-- org2 fixture entities (mirror, used only for cross-tenant read/trigger tests)
insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values ('e2000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', 'individual', '1000000002', 'Bea', 'Otherorg');

insert into public.facilities (id, organization_id, name)
values ('e2000000-0000-0000-0000-000000000002', 'c2222222-2222-2222-2222-222222222222', 'SIM Clinic Two');

insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values ('e2000000-0000-0000-0000-000000000003', 'c2222222-2222-2222-2222-222222222222', 'Petra', 'Otherpatient', '1995-09-09');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values ('e2000000-0000-0000-0000-000000000005', 'c2222222-2222-2222-2222-222222222222', 'e2000000-0000-0000-0000-000000000003', 'Petra', 'Otherpatient');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values ('e2000000-0000-0000-0000-000000000006', 'c2222222-2222-2222-2222-222222222222', 'e2000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000003', 'SIM Other Payer');

insert into public.organization_payer_enrollments (id, organization_id, payer_label)
values ('e2000000-0000-0000-0000-000000000007', 'c2222222-2222-2222-2222-222222222222', 'SIM Other Payer');

-- switch to a simulated authenticated request, as org1's owner, for every
-- assertion below
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-1111-1111-111111111111', true);

-- ---------------------------------------------------------------------
-- providers
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.providers (organization_id, provider_type, npi, first_name, last_name)
       values ('c1111111-1111-1111-1111-111111111111', 'individual', '1000000099', 'Test', 'Newprovider') $$,
    'org-owned CRUD: org1 member can insert a provider into their own org'
);

select is(
    (select count(*)::int from public.providers where id = 'e2000000-0000-0000-0000-000000000001'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s provider'
);

select throws_ok(
    $$ insert into public.providers (organization_id, provider_type, npi, first_name, last_name)
       values ('c2222222-2222-2222-2222-222222222222', 'individual', '1000000098', 'Blocked', 'Insert') $$,
    'new row violates row-level security policy for table "providers"',
    'cross-tenant insert denied: org1 member cannot insert a provider into org2'
);

select throws_ok(
    $$ insert into public.providers (organization_id, provider_type, npi, first_name, last_name)
       values ('c1111111-1111-1111-1111-111111111111', 'individual', '12345', 'Bad', 'Npi') $$,
    'new row for relation "providers" violates check constraint "providers_npi_check"',
    'invalid NPI format is rejected by the DB check constraint'
);

-- ---------------------------------------------------------------------
-- facilities
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.facilities (organization_id, name)
       values ('c1111111-1111-1111-1111-111111111111', 'SIM New Clinic') $$,
    'org-owned CRUD: org1 member can insert a facility into their own org'
);

select is(
    (select count(*)::int from public.facilities where id = 'e2000000-0000-0000-0000-000000000002'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s facility'
);

select throws_ok(
    $$ insert into public.facilities (organization_id, name)
       values ('c2222222-2222-2222-2222-222222222222', 'SIM Blocked Clinic') $$,
    'new row violates row-level security policy for table "facilities"',
    'cross-tenant insert denied: org1 member cannot insert a facility into org2'
);

-- ---------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.patients (organization_id, first_name, last_name, date_of_birth)
       values ('c1111111-1111-1111-1111-111111111111', 'Tess', 'Newpatient', '2000-01-01') $$,
    'org-owned CRUD: org1 member can insert a patient into their own org'
);

select is(
    (select count(*)::int from public.patients where id = 'e2000000-0000-0000-0000-000000000003'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s patient'
);

select throws_ok(
    $$ insert into public.patients (organization_id, first_name, last_name, date_of_birth)
       values ('c2222222-2222-2222-2222-222222222222', 'Blocked', 'Patient', '2000-01-01') $$,
    'new row violates row-level security policy for table "patients"',
    'cross-tenant insert denied: org1 member cannot insert a patient into org2'
);

-- ---------------------------------------------------------------------
-- subscribers
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.subscribers (organization_id, patient_id, first_name, last_name)
       values ('c1111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000003', 'Patty', 'Testperson') $$,
    'org-owned CRUD: org1 member can insert a subscriber for their own org''s patient'
);

select is(
    (select count(*)::int from public.subscribers where id = 'e2000000-0000-0000-0000-000000000005'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s subscriber'
);

select throws_ok(
    $$ insert into public.subscribers (organization_id, patient_id, first_name, last_name)
       values ('c2222222-2222-2222-2222-222222222222', 'e2000000-0000-0000-0000-000000000003', 'Blocked', 'Insert') $$,
    'new row violates row-level security policy for table "subscribers"',
    'cross-tenant insert denied: org1 member cannot insert a subscriber into org2 (using org2''s own patient, so RLS -- not the FK-consistency trigger -- is what blocks it)'
);

select throws_ok(
    $$ insert into public.subscribers (organization_id, patient_id, first_name, last_name)
       values ('c1111111-1111-1111-1111-111111111111', 'e2000000-0000-0000-0000-000000000003', 'Cross', 'OrgPatient') $$,
    'subscriber.organization_id must match the referenced patient''s organization',
    'cross-org FK trigger denied: subscriber cannot reference another org''s patient'
);

-- ---------------------------------------------------------------------
-- coverages
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.coverages (organization_id, subscriber_id, patient_id, payer_label)
       values ('c1111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000003', 'SIM New Payer') $$,
    'org-owned CRUD: org1 member can insert a coverage for their own org''s subscriber/patient'
);

select is(
    (select count(*)::int from public.coverages where id = 'e2000000-0000-0000-0000-000000000006'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s coverage'
);

select throws_ok(
    $$ insert into public.coverages (organization_id, subscriber_id, patient_id, payer_label)
       values ('c2222222-2222-2222-2222-222222222222', 'e2000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000003', 'SIM Blocked Payer') $$,
    'new row violates row-level security policy for table "coverages"',
    'cross-tenant insert denied: org1 member cannot insert a coverage into org2 (using org2''s own subscriber/patient, so RLS -- not the FK-consistency trigger -- is what blocks it)'
);

select throws_ok(
    $$ insert into public.coverages (organization_id, subscriber_id, patient_id, payer_label)
       values ('c1111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000003', 'SIM Cross Org Payer') $$,
    'coverage.organization_id must match both the referenced subscriber''s and patient''s organization',
    'cross-org FK trigger denied: coverage cannot reference another org''s patient'
);

select throws_ok(
    $$ insert into public.coverages (organization_id, subscriber_id, patient_id, payer_label)
       values ('c1111111-1111-1111-1111-111111111111', 'e1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000004', 'SIM Mismatched Payer') $$,
    'coverage.patient_id must match the referenced subscriber''s patient',
    'same-org FK trigger denied: coverage.patient_id must match subscriber.patient_id'
);

-- ---------------------------------------------------------------------
-- organization_payer_enrollments
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.organization_payer_enrollments (organization_id, payer_label)
       values ('c1111111-1111-1111-1111-111111111111', 'SIM New Enrollment') $$,
    'org-owned CRUD: org1 member can insert a payer enrollment into their own org'
);

select is(
    (select count(*)::int from public.organization_payer_enrollments where id = 'e2000000-0000-0000-0000-000000000007'),
    0,
    'cross-tenant read denied: org1 member cannot see org2''s payer enrollment'
);

select throws_ok(
    $$ insert into public.organization_payer_enrollments (organization_id, payer_label)
       values ('c2222222-2222-2222-2222-222222222222', 'SIM Blocked Enrollment') $$,
    'new row violates row-level security policy for table "organization_payer_enrollments"',
    'cross-tenant insert denied: org1 member cannot insert a payer enrollment into org2'
);

select * from finish();

rollback;
