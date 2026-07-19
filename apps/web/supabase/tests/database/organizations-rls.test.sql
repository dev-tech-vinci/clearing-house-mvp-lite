-- Phase 2 pgTAP suite: tenant isolation, role/permission enforcement, and
-- the invitation accept flow. All fixture data is synthetic (SIM- prefixed).
-- Wrapped in begin/rollback so the suite never leaves state behind.
begin;

select plan(18);

-- ---------------------------------------------------------------------
-- Fixtures (inserted as postgres/superuser, bypasses RLS by design)
-- ---------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
    ('11111111-1111-1111-1111-111111111111', 'sim-owner1@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('22222222-2222-2222-2222-222222222222', 'sim-specialist1@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('33333333-3333-3333-3333-333333333333', 'sim-outsider@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('44444444-4444-4444-4444-444444444444', 'sim-newmember@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('55555555-5555-5555-5555-555555555555', 'sim-founder@example.test', '{}'::jsonb, 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, created_by)
values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SIM Org One', 'sim-org-one', '11111111-1111-1111-1111-111111111111'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SIM Org Two', 'sim-org-two', '33333333-3333-3333-3333-333333333333');

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', id
from public.roles where key = 'org_owner';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', id
from public.roles where key = 'claims_specialist';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', id
from public.roles where key = 'org_owner';

-- an already-expired invitation, for the expiry negative test
insert into public.invitations (organization_id, email, role_id, invited_by, expires_at)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sim-expired@example.test', id,
       '11111111-1111-1111-1111-111111111111', now() - interval '1 day'
from public.roles where key = 'read_only_auditor';

select token as expired_token from public.invitations where email = 'sim-expired@example.test' \gset

-- switch to a simulated authenticated request from here on
set local role authenticated;

-- ---------------------------------------------------------------------
-- Same-tenant read allowed / cross-tenant read denied (as org1 owner)
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select ok(
    public.has_org_access('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    'same-tenant: org1 owner has_org_access(org1) is true'
);

select is(
    (select count(*)::int from public.organizations where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    1,
    'same-tenant read allowed: org1 owner can select org1'
);

select is(
    (select count(*)::int from public.organizations where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    0,
    'cross-tenant read denied: org1 owner cannot select org2'
);

select ok(
    not public.has_org_access('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'cross-tenant: org1 owner has_org_access(org2) is false'
);

select throws_ok(
    $$ select public.get_organization_members('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
    'Not a member of this organization',
    'cross-tenant read denied: get_organization_members(org2) rejects the org1 owner'
);

-- ---------------------------------------------------------------------
-- Role without permission denied (as org1 claims_specialist)
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select ok(
    public.has_permission('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'claims.create_edit'),
    'positive control: claims_specialist has claims.create_edit in org1'
);

select ok(
    not public.has_permission('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'members.invite'),
    'claims_specialist lacks members.invite in org1'
);

select throws_ok(
    $$ insert into public.invitations (organization_id, email, role_id)
       select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sim-blocked@example.test', id
       from public.roles where key = 'read_only_auditor' $$,
    'new row violates row-level security policy for table "invitations"',
    'role without permission denied: claims_specialist cannot create an invitation in org1'
);

-- ---------------------------------------------------------------------
-- Invitation + accept flow (as org1 owner, then as the invitee)
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select lives_ok(
    $$ insert into public.invitations (organization_id, email, role_id)
       select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sim-newmember@example.test', id
       from public.roles where key = 'claims_specialist' $$,
    'org1 owner can create an invitation'
);

select token as invite_token from public.invitations where email = 'sim-newmember@example.test' \gset

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

select ok(
    not public.has_org_access('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    'invitee has no org access before accepting'
);

select lives_ok(
    format('select public.accept_invitation(%L)', :'invite_token'),
    'invitee (matching email) can accept a valid, unexpired invitation'
);

select ok(
    public.has_org_access('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    'invitee has org access after accepting'
);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is(
    (select status from public.invitations where email = 'sim-newmember@example.test'),
    'accepted',
    'invitation status flips to accepted after the accept RPC runs'
);

-- ---------------------------------------------------------------------
-- Negative accept-flow tests
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.invitations (organization_id, email, role_id)
       select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sim-second-invite@example.test', id
       from public.roles where key = 'read_only_auditor' $$,
    'org1 owner can create a second invitation for the wrong-email negative test'
);

select token as second_invite_token from public.invitations where email = 'sim-second-invite@example.test' \gset

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select throws_ok(
    format('select public.accept_invitation(%L)', :'second_invite_token'),
    'This invitation was issued to a different email address',
    'wrong-email user cannot accept an invitation addressed to someone else'
);

select throws_ok(
    format('select public.accept_invitation(%L)', :'expired_token'),
    'Invitation not found, already used, or expired',
    'expired invitation cannot be accepted'
);

-- ---------------------------------------------------------------------
-- create_organization: atomic bootstrap of a new org + owner membership
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);

select lives_ok(
    $$ select public.create_organization('SIM Founder Org', 'sim-founder-org') $$,
    'a brand-new user can create an organization and is atomically made org_owner'
);

select ok(
    public.has_permission(
        (select id from public.organizations where slug = 'sim-founder-org'),
        'organizations.update'
    ),
    'the creator has org_owner-level permission on their new organization'
);

select * from finish();

rollback;
