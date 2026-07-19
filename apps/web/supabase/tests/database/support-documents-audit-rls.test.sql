-- Phase 8 pgTAP suite: org-owned CRUD/read for support tickets/messages/
-- documents, cross-tenant denial, cross-org FK-consistency trigger
-- negatives, ticket-scoping (support_manager sees everything,
-- support_agent sees only assigned/unassigned tickets), the
-- support_access_sessions no-silent-impersonation mechanism (assigned-
-- ticket requirement, active-session access works, ended/expired-session
-- access denied, no-session access denied, support-access history
-- visible to the customer org), private Storage bucket + cross-tenant
-- object denial, and audit_events append-only proof. All fixture data is
-- synthetic. Wrapped in begin/rollback so the suite never leaves state
-- behind.
begin;

select plan(30);

-- ---------------------------------------------------------------------
-- Fixtures (inserted as postgres/superuser, bypasses RLS by design)
-- ---------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
    ('a1111111-1111-1111-1111-111111111111', 'sim-sup-org1-owner@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a2222222-2222-2222-2222-222222222222', 'sim-sup-org2-owner@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a3333333-3333-3333-3333-333333333333', 'sim-sup-manager@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a4444444-4444-4444-4444-444444444444', 'sim-sup-agent-a@example.test', '{}'::jsonb, 'authenticated', 'authenticated'),
    ('a5555555-5555-5555-5555-555555555555', 'sim-sup-agent-b@example.test', '{}'::jsonb, 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, created_by)
values
    ('b1111111-1111-1111-1111-111111111111', 'SIM Support Org One', 'sim-support-org-one', 'a1111111-1111-1111-1111-111111111111'),
    ('b2222222-2222-2222-2222-222222222222', 'SIM Support Org Two', 'sim-support-org-two', 'a2222222-2222-2222-2222-222222222222'),
    ('b3333333-3333-3333-3333-333333333333', 'SIM Support Staff Home Org', 'sim-support-staff-home', 'a3333333-3333-3333-3333-333333333333');

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', id from public.roles where key = 'org_owner';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', id from public.roles where key = 'org_owner';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', id from public.roles where key = 'support_manager';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', id from public.roles where key = 'support_agent';

insert into public.organization_memberships (organization_id, user_id, role_id)
select 'b3333333-3333-3333-3333-333333333333', 'a5555555-5555-5555-5555-555555555555', id from public.roles where key = 'support_agent';

-- Minimal claim chain, org1 and org2 (needed only for the documents.claim_id
-- cross-org trigger negative and a remittances fixture -- not used for
-- anything else in this suite, so kept intentionally bare).
insert into public.patients (id, organization_id, first_name, last_name, date_of_birth)
values
    ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Sam', 'Suptestone', '1990-01-01'),
    ('c2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222', 'Sal', 'Suptesttwo', '1991-02-02');

insert into public.subscribers (id, organization_id, patient_id, first_name, last_name)
values
    ('c1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Sam', 'Suptestone'),
    ('c2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222221', 'Sal', 'Suptesttwo');

insert into public.coverages (id, organization_id, subscriber_id, patient_id, payer_label)
values
    ('c1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111111', 'SIM Test Payer'),
    ('c2222222-2222-2222-2222-222222222223', 'b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222221', 'SIM Test Payer');

insert into public.providers (id, organization_id, provider_type, npi, first_name, last_name)
values
    ('c1111111-1111-1111-1111-111111111114', 'b1111111-1111-1111-1111-111111111111', 'individual', '1000000051', 'Pat', 'Suptestprovider'),
    ('c2222222-2222-2222-2222-222222222224', 'b2222222-2222-2222-2222-222222222222', 'individual', '1000000052', 'Pam', 'Suptestprovidertwo');

insert into public.claims (id, organization_id, claim_type, patient_id, subscriber_id, coverage_id, billing_provider_id, status)
values
    ('c1111111-1111-1111-1111-111111111115', 'b1111111-1111-1111-1111-111111111111', 'professional', 'c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111113', 'c1111111-1111-1111-1111-111111111114', 'accepted_for_adjudication'),
    ('c2222222-2222-2222-2222-222222222225', 'b2222222-2222-2222-2222-222222222222', 'professional', 'c2222222-2222-2222-2222-222222222221', 'c2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222223', 'c2222222-2222-2222-2222-222222222224', 'accepted_for_adjudication');

insert into public.remittances (id, organization_id, claim_id, sim_remittance_id, isa13, gs06, st02, raw_835_payload, payload_hash, total_paid_amount, outcome, status)
values ('d1111111-1111-1111-1111-111111111131', 'b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111115', 'SIM-ERA-SUPFIXTURE', '000000020', '000000020', '0020', '835 fixture payload', 'cafef00d', 80, 'paid', 'paid');

-- Support tickets: ticket1 assigned to agent A, ticket2 unassigned,
-- ticket4 assigned to agent B (used to prove agent A cannot see it),
-- ticket3 belongs to org2 (cross-tenant negative target).
insert into public.support_tickets (id, organization_id, subject, description, assigned_to)
values
    ('d1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'SIM ticket one', 'Fixture ticket assigned to agent A', 'a4444444-4444-4444-4444-444444444444'),
    ('d1111111-1111-1111-1111-111111111112', 'b1111111-1111-1111-1111-111111111111', 'SIM ticket two', 'Fixture unassigned ticket', null),
    ('d1111111-1111-1111-1111-111111111113', 'b1111111-1111-1111-1111-111111111111', 'SIM ticket four', 'Fixture ticket assigned to agent B', 'a5555555-5555-5555-5555-555555555555'),
    ('d2222222-2222-2222-2222-222222222221', 'b2222222-2222-2222-2222-222222222222', 'SIM ticket three', 'Fixture org2 ticket', null);

insert into public.documents (id, organization_id, file_name, storage_path, mime_type, file_size_bytes)
values
    ('d1111111-1111-1111-1111-111111111121', 'b1111111-1111-1111-1111-111111111111', 'sim-doc-one.pdf', 'b1111111-1111-1111-1111-111111111111/sim-doc-one.pdf', 'application/pdf', 1024),
    ('d2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'sim-doc-two.pdf', 'b2222222-2222-2222-2222-222222222222/sim-doc-two.pdf', 'application/pdf', 2048);

insert into storage.objects (bucket_id, name)
values ('org_documents', 'b1111111-1111-1111-1111-111111111111/sim-fake-object.pdf');

-- storage.buckets has its own RLS restricting SELECT for authenticated
-- users to buckets they own or that are public -- checked here, still as
-- postgres/superuser, before switching to an authenticated role below.
select is(
    (select public from storage.buckets where id = 'org_documents'),
    false,
    'documents privacy: the org_documents Storage bucket is private, not public'
);

-- ---------------------------------------------------------------------
-- As org1's owner: org-owned CRUD, cross-tenant negatives, cross-org
-- FK-consistency trigger negatives
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select lives_ok(
    $$ insert into public.support_tickets (organization_id, subject, description)
       values ('b1111111-1111-1111-1111-111111111111', 'SIM new ticket', 'Org1 owner opens a ticket') $$,
    'org-owned CRUD: org1 owner can open a support ticket for their own org'
);

select lives_ok(
    $$ insert into public.support_messages (organization_id, ticket_id, body)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'SIM customer reply') $$,
    'org-owned CRUD: org1 owner can post a non-internal message on their own ticket'
);

select lives_ok(
    $$ insert into public.documents (organization_id, file_name, storage_path, mime_type, file_size_bytes)
       values ('b1111111-1111-1111-1111-111111111111', 'sim-new-doc.pdf', 'b1111111-1111-1111-1111-111111111111/sim-new-doc.pdf', 'application/pdf', 512) $$,
    'org-owned CRUD: org1 owner can register a new document for their own org'
);

select is(
    (select count(*)::int from public.support_tickets where id = 'd2222222-2222-2222-2222-222222222221'),
    0,
    'cross-tenant read denied: org1 owner cannot see org2''s ticket'
);

select throws_ok(
    $$ insert into public.support_tickets (organization_id, subject, description)
       values ('b2222222-2222-2222-2222-222222222222', 'SIM blocked ticket', 'blocked') $$,
    'new row violates row-level security policy for table "support_tickets"',
    'cross-tenant insert denied: org1 owner cannot open a ticket for org2'
);

select throws_ok(
    $$ insert into public.support_messages (organization_id, ticket_id, body)
       values ('b1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222221', 'blocked') $$,
    'organization_id must match the referenced support ticket''s organization',
    'cross-org FK trigger denied: support_messages cannot reference another org''s ticket'
);

select throws_ok(
    $$ insert into public.support_ticket_documents (organization_id, ticket_id, document_id)
       values ('b1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222221', 'd1111111-1111-1111-1111-111111111121') $$,
    'organization_id must match the referenced support ticket''s organization',
    'cross-org FK trigger denied: support_ticket_documents cannot reference another org''s ticket'
);

select throws_ok(
    $$ insert into public.support_ticket_documents (organization_id, ticket_id, document_id)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222') $$,
    'organization_id must match the referenced document''s organization',
    'cross-org FK trigger denied: support_ticket_documents cannot reference another org''s document'
);

select throws_ok(
    $$ insert into public.documents (organization_id, claim_id, file_name, storage_path, mime_type, file_size_bytes)
       values ('b1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222225', 'sim-blocked.pdf', 'b1111111-1111-1111-1111-111111111111/sim-blocked.pdf', 'application/pdf', 100) $$,
    'organization_id must match the referenced claim''s organization',
    'cross-org FK trigger denied: documents cannot reference another org''s claim'
);

-- ---------------------------------------------------------------------
-- Ticket-scoping and the support_access_sessions mechanism, as agent A
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a4444444-4444-4444-4444-444444444444', true);

select is(
    (select count(*)::int from public.support_tickets where id = 'd1111111-1111-1111-1111-111111111111'),
    1,
    'ticket-scoping: support_agent (assigned) can see their own assigned ticket'
);

select is(
    (select count(*)::int from public.support_tickets where id = 'd1111111-1111-1111-1111-111111111112'),
    1,
    'ticket-scoping: support_agent can see an unassigned ticket'
);

select is(
    (select count(*)::int from public.support_tickets where id = 'd1111111-1111-1111-1111-111111111113'),
    0,
    'ticket-scoping: support_agent cannot see a ticket assigned to a different agent'
);

select is(
    (select count(*)::int from public.documents where id = 'd1111111-1111-1111-1111-111111111121'),
    0,
    'no session: support_agent with no active support_access_sessions row sees no org1 documents'
);

select throws_ok(
    $$ insert into public.support_access_sessions (organization_id, ticket_id, support_user_id, reason, expires_at)
       values ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111112', 'a4444444-4444-4444-4444-444444444444', 'SIM Trying to access an unassigned ticket', now() + interval '1 hour') $$,
    'new row violates row-level security policy for table "support_access_sessions"',
    'support_access_sessions requires an assigned ticket: agent A cannot start a session against a ticket not assigned to them'
);

select lives_ok(
    $$ insert into public.support_access_sessions (id, organization_id, ticket_id, support_user_id, reason, expires_at)
       values ('d1111111-1111-1111-1111-111111111141', 'b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'a4444444-4444-4444-4444-444444444444', 'SIM Investigating a stuck claim per customer request', now() + interval '1 hour') $$,
    'support_access_sessions insert allowed: agent A starts a session against their own assigned ticket'
);

select is(
    (select count(*)::int from public.documents where id = 'd1111111-1111-1111-1111-111111111121'),
    1,
    'active session: agent A can now read org1''s document during the active session'
);

select is(
    (select count(*)::int from public.remittances where id = 'd1111111-1111-1111-1111-111111111131'),
    1,
    'active session: agent A can now read org1''s remittance during the active session (the other E-scoped table)'
);

select lives_ok(
    $$ update public.support_access_sessions set ended_at = now(), ended_by = 'a4444444-4444-4444-4444-444444444444'
       where id = 'd1111111-1111-1111-1111-111111111141' $$,
    'agent A can end their own session early'
);

select is(
    (select count(*)::int from public.documents where id = 'd1111111-1111-1111-1111-111111111121'),
    0,
    'ended session: agent A can no longer read org1''s document once the session has been ended'
);

select lives_ok(
    $$ insert into public.support_access_sessions (id, organization_id, ticket_id, support_user_id, reason, started_at, expires_at)
       values ('d1111111-1111-1111-1111-111111111142', 'b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'a4444444-4444-4444-4444-444444444444', 'SIM A session that has already expired', now() - interval '2 hours', now() - interval '1 hour') $$,
    'a naturally-expired session can be recorded (started and ended in the past)'
);

select is(
    (select count(*)::int from public.documents where id = 'd1111111-1111-1111-1111-111111111121'),
    0,
    'expired session: agent A cannot read org1''s document once expires_at has passed, even though ended_at is still null'
);

-- ---------------------------------------------------------------------
-- Support-access history visible to the customer org
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select is(
    (select count(*)::int from public.support_access_sessions where support_user_id = 'a4444444-4444-4444-4444-444444444444'),
    2,
    'support-access history visible to the customer org: org1 owner can see both of agent A''s sessions against their org'
);

-- ---------------------------------------------------------------------
-- support_manager sees every ticket, not just assigned/unassigned ones
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a3333333-3333-3333-3333-333333333333', true);

select is(
    (select count(*)::int from public.support_tickets where organization_id = 'b1111111-1111-1111-1111-111111111111'),
    4,
    'ticket-scoping: support_manager sees every org1 ticket, including one assigned to a different agent'
);

-- ---------------------------------------------------------------------
-- Private Storage bucket + cross-tenant object denial
-- ---------------------------------------------------------------------

select set_config('request.jwt.claim.sub', 'a2222222-2222-2222-2222-222222222222', true);

select is(
    (select count(*)::int from storage.objects where bucket_id = 'org_documents' and name = 'b1111111-1111-1111-1111-111111111111/sim-fake-object.pdf'),
    0,
    'documents privacy: org2 cannot see (and therefore cannot get a signed URL for) an object under org1''s path prefix'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select is(
    (select count(*)::int from storage.objects where bucket_id = 'org_documents' and name = 'b1111111-1111-1111-1111-111111111111/sim-fake-object.pdf'),
    1,
    'documents privacy: org1 can see (and therefore can get a signed URL for) an object under its own path prefix'
);

-- ---------------------------------------------------------------------
-- audit_events: append-only
-- ---------------------------------------------------------------------

select lives_ok(
    $$ insert into public.audit_events (id, organization_id, actor_id, action, target_type, target_id)
       values ('d1111111-1111-1111-1111-111111111151', 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'claim.approved', 'claim', 'c1111111-1111-1111-1111-111111111115') $$,
    'org1 owner can insert an audit_events row for their own org, as themselves'
);

select is(
    (select count(*)::int from public.audit_events where id = 'd1111111-1111-1111-1111-111111111151'),
    1,
    'org1 owner (has audit.view) can read the audit event they just created'
);

select throws_ok(
    $$ update public.audit_events set action = 'sim-tampered' where id = 'd1111111-1111-1111-1111-111111111151' $$,
    'permission denied for table audit_events',
    'audit_events is append-only: UPDATE is denied outright (no grant exists, not merely an RLS filter)'
);

select throws_ok(
    $$ delete from public.audit_events where id = 'd1111111-1111-1111-1111-111111111151' $$,
    'permission denied for table audit_events',
    'audit_events is append-only: DELETE is denied outright'
);

select * from finish();

rollback;
