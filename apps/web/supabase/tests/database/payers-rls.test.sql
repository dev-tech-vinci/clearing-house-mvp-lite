-- Phase 4 pgTAP suite: payers/payer-rules are global reference data --
-- readable by any authenticated user, writable only by a
-- platform_super_admin. Wrapped in begin/rollback so the suite never
-- leaves state behind.
begin;

select plan(17);

-- ---------------------------------------------------------------------
-- Seed data sanity (from the migration itself, not fixtures)
-- ---------------------------------------------------------------------

select is(
    (select count(*)::int from public.payers where sim_payer_id like 'SIM-%'),
    10,
    'seed: exactly ten SIM- prefixed payers exist'
);

select is(
    (select count(*)::int from public.payers where sim_payer_id not like 'SIM-%'),
    0,
    'seed: no payer exists without a SIM- prefix'
);

-- ---------------------------------------------------------------------
-- Phase 9: payer_supported_transactions -- exactly one payer/transaction
-- combination is deliberately unsupported (SIM-MCFFS-001's 837I), giving
-- the Python client's "unsupported payer route" negative test a real
-- case to submit against, without touching any transaction type the
-- ten-claim happy-path set actually exercises. The enforcement logic
-- itself lives in apps/worker (DeterministicClaimProcessor.process()) --
-- pgTAP can only prove the seed data is what that logic expects to find,
-- not exercise the TypeScript rejection path itself.
-- ---------------------------------------------------------------------

select is(
    (select pst.is_active from public.payer_supported_transactions pst
        join public.payers p on p.id = pst.payer_id
        where p.sim_payer_id = 'SIM-MCFFS-001' and pst.transaction_type = '837I'),
    false,
    'seed: SIM-MCFFS-001 does not support 837I (the one deliberate unsupported-route fixture)'
);

select is(
    (select pst.is_active from public.payer_supported_transactions pst
        join public.payers p on p.id = pst.payer_id
        where p.sim_payer_id = 'SIM-MCFFS-001' and pst.transaction_type = '837P'),
    true,
    'seed: SIM-MCFFS-001 still supports 837P -- the happy-path fixture type for this payer is untouched'
);

select is(
    (select count(*)::int from public.payer_supported_transactions where is_active = false),
    1,
    'seed: exactly one payer_supported_transactions row is inactive -- no other payer/transaction combo was accidentally disabled'
);

-- ---------------------------------------------------------------------
-- Fixtures: one platform_super_admin, one plain org member (non-admin)
-- ---------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
    ('f1111111-1111-1111-1111-111111111111', 'sim-platform-admin@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('f2222222-2222-2222-2222-222222222222', 'sim-plain-member@example.test', '{}'::jsonb, 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, created_by)
values ('a9999999-9999-9999-9999-999999999999', 'SIM Payers Test Org', 'sim-payers-test-org', 'f1111111-1111-1111-1111-111111111111');

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'a9999999-9999-9999-9999-999999999999', 'f1111111-1111-1111-1111-111111111111', id
from public.roles where key = 'platform_super_admin';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'a9999999-9999-9999-9999-999999999999', 'f2222222-2222-2222-2222-222222222222', id
from public.roles where key = 'claims_specialist';

-- switch to a simulated authenticated request, as the plain (non-admin)
-- member, for the negative tests
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-2222-2222-222222222222', true);

select ok(
    not public.is_platform_admin(),
    'plain org member is not a platform admin'
);

select is(
    (select count(*)::int from public.payers),
    10,
    'read allowed: any authenticated user can read the payer directory'
);

select throws_ok(
    $$ insert into public.payers (sim_payer_id, display_name, category)
       values ('SIM-BLOCKED-001', 'SIM Blocked Payer', 'commercial_ppo') $$,
    'new row violates row-level security policy for table "payers"',
    'unauthorized payer modification denied: non-admin cannot insert a payer'
);

-- RLS UPDATE denial doesn't throw (Postgres treats a failing USING clause
-- as a row filter, same as an unmatched WHERE) -- assert 0 rows changed
-- instead of expecting an exception.
update public.payers set display_name = 'Hacked' where sim_payer_id = 'SIM-MCFFS-001';

select is(
    (select display_name from public.payers where sim_payer_id = 'SIM-MCFFS-001'),
    'SIM Medicare FFS National',
    'unauthorized payer modification denied: non-admin update silently affects 0 rows, value unchanged'
);

select throws_ok(
    $$ insert into public.payer_rules (rule_code, category)
       values ('SIM-RULE-BLOCKED-001', 'universal') $$,
    'new row violates row-level security policy for table "payer_rules"',
    'unauthorized payer-rule modification denied: non-admin cannot insert a payer_rule'
);

select throws_ok(
    $$ insert into public.payer_rule_versions (payer_rule_id, version_number, condition, outcome, severity, rejection_or_denial, explanation)
       select id, 2, 'blocked', 'reject', 'error', 'rejection', 'blocked'
       from public.payer_rules where rule_code = 'SIM-RULE-UNIV-001' $$,
    'new row violates row-level security policy for table "payer_rule_versions"',
    'unauthorized payer-rule modification denied: non-admin cannot insert a payer_rule_version'
);

-- ---------------------------------------------------------------------
-- Platform admin CAN manage payers and rules
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'f1111111-1111-1111-1111-111111111111', true);

select ok(
    public.is_platform_admin(),
    'platform_super_admin is recognized as a platform admin'
);

select lives_ok(
    $$ insert into public.payers (sim_payer_id, display_name, category)
       values ('SIM-ADMINTEST-001', 'SIM Admin Test Payer', 'commercial_ppo') $$,
    'platform admin can insert a payer'
);

select lives_ok(
    $$ update public.payers set notes = 'Updated by admin test' where sim_payer_id = 'SIM-MCFFS-001' $$,
    'platform admin can update a payer'
);

-- rule versioning: adding a new version to an existing rule keeps both
-- versions queryable
select lives_ok(
    $$ insert into public.payer_rule_versions (payer_rule_id, version_number, condition, outcome, severity, rejection_or_denial, explanation)
       select id, 2, 'diagnosis code present and valid against the code set', 'reject', 'error', 'rejection', 'Updated explanation: diagnosis code must also be a valid, billable code.'
       from public.payer_rules where rule_code = 'SIM-RULE-UNIV-001' $$,
    'platform admin can insert a new rule version'
);

select is(
    (select count(*)::int
     from public.payer_rule_versions v
              join public.payer_rules r on r.id = v.payer_rule_id
     where r.rule_code = 'SIM-RULE-UNIV-001'),
    2,
    'rule versioning: both version 1 and version 2 remain queryable'
);

select is(
    (select rejection_or_denial
     from public.payer_rule_versions v
              join public.payer_rules r on r.id = v.payer_rule_id
     where r.rule_code = 'SIM-RULE-ADJ-SIM-RBH-001'
       and v.version_number = 1),
    'denial',
    'explainable + designated: the RBH adjudication rule is tagged as a denial (post-adjudication), not a rejection'
);

select * from finish();

rollback;
