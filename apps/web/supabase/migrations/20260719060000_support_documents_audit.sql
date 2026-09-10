/*
 * -------------------------------------------------------
 * Phase 8: support portal (tickets/messages/assignments), private
 * documents, audited time-limited support access, and append-only
 * audit logging.
 *
 * Simulation only. No real PHI. All synthetic entities use SIM- prefixed
 * IDs.
 *
 * This migration resolves the Phase 2 deferral (see
 * docs/progress/DECISIONS.md Phase 2): support_manager/support_agent get
 * a real, narrowly-scoped RLS bypass into tenant-owned data (remittances,
 * documents) -- but ONLY while a matching support_access_sessions row is
 * active, unexpired, and tied to a ticket assigned to that specific
 * support user. There is still no blanket cross-org bypass for any role.
 * -------------------------------------------------------
 */

/*
 * -------------------------------------------------------
 * Section: new access-control primitives
 * has_role() and has_platform_permission() generalize the
 * is_platform_admin() pattern from Phase 4 (permission-key-based rather
 * than the earlier hardcoded role check) to any is_platform_role=true
 * role. Needed because support_manager and support_agent hold identical
 * permission-key grants in role_permissions (see Phase 2 seed) but must
 * be given different data-visibility scope (support_manager: every
 * ticket; support_agent: ticket-scoped) -- a nuance the Phase 2 migration
 * comment explicitly deferred to this phase.
 * -------------------------------------------------------
 */
create or replace function public.has_role(role_key text)
    returns boolean
    language sql
    stable
    security definer
    set search_path = ''
as
$$
select exists (
    select 1
    from public.organization_memberships m
             join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.deleted_at is null
      and r.key = role_key
);
$$;

comment on function public.has_role(text) is 'True if the caller holds the given role key in any organization membership. Generalizes the is_platform_admin() pattern to any role, not just platform_super_admin.';

revoke all on function public.has_role(text) from public;
grant execute on function public.has_role(text) to authenticated;

create or replace function public.has_platform_permission(permission_key text)
    returns boolean
    language sql
    stable
    security definer
    set search_path = ''
as
$$
select exists (
    select 1
    from public.organization_memberships m
             join public.roles r on r.id = m.role_id
             join public.role_permissions rp on rp.role_id = r.id
             join public.permissions p on p.id = rp.permission_id
    where m.user_id = auth.uid()
      and m.deleted_at is null
      and r.is_platform_role = true
      and p.key = permission_key
);
$$;

comment on function public.has_platform_permission(text) is 'True if the caller holds a platform-wide role (is_platform_role=true, e.g. support_manager/support_agent/platform_super_admin) carrying the given permission key. Unlike has_permission(), not scoped to a specific target organization -- used for platform/support actions that are not yet tied to an active support_access_sessions row (e.g. seeing the ticket queue, starting a session).';

revoke all on function public.has_platform_permission(text) from public;
grant execute on function public.has_platform_permission(text) to authenticated;

/*
 * -------------------------------------------------------
 * Section: support_tickets
 * -------------------------------------------------------
 */

-- Unlike kit.check_claim_child_org_consistency() (Phase 5, requires
-- claim_id NOT NULL), claim_id is optional on both support_tickets and
-- documents -- a ticket/document need not relate to any specific claim.
-- This variant returns early when claim_id is null instead of raising.
create or replace function kit.check_nullable_claim_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    claim_org uuid;
begin
    if new.claim_id is null then
        return new;
    end if;

    select organization_id into claim_org from public.claims where id = new.claim_id;

    if claim_org is null then
        raise exception 'Referenced claim does not exist';
    end if;

    if claim_org <> new.organization_id then
        raise exception 'organization_id must match the referenced claim''s organization';
    end if;

    return new;
end;
$$;

create table if not exists
    public.support_tickets
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid         not null references public.organizations (id) on delete cascade,
    claim_id        uuid references public.claims (id) on delete set null,
    sim_ticket_id   varchar(40)  not null default ('SIM-TCKT-' || upper(substr(replace(extensions.uuid_generate_v4()::text, '-', ''), 1, 8))),
    subject         varchar(255) not null,
    description     text         not null,
    status          varchar(20)  not null default 'open'
        check (status in ('open', 'in_progress', 'resolved', 'closed')),
    priority        varchar(10)  not null default 'normal'
        check (priority in ('low', 'normal', 'high', 'urgent')),
    assigned_to     uuid references auth.users,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    updated_at      timestamp with time zone default now(),
    updated_by      uuid references auth.users,
    closed_at       timestamp with time zone
);

comment on table public.support_tickets is 'Customer-opened support tickets. sim_ticket_id is a cosmetic synthetic label. Visibility: the owning org sees its own tickets; support_manager sees every ticket; support_agent sees only tickets assigned to them or currently unassigned (ticket-scoped, per the architecture role matrix).';

create index if not exists support_tickets_organization_id_idx on public.support_tickets (organization_id, created_at);
create index if not exists support_tickets_assigned_to_idx on public.support_tickets (assigned_to);

alter table public.support_tickets enable row level security;

revoke all on public.support_tickets from authenticated, service_role;
grant select, insert, update on table public.support_tickets to authenticated;
grant select, insert, update, delete on table public.support_tickets to service_role;

create policy support_tickets_read on public.support_tickets for select
    to authenticated using (
        public.has_org_access(organization_id)
        or public.has_role('support_manager')
        or (public.has_role('support_agent') and (assigned_to = auth.uid() or assigned_to is null))
    );

create policy support_tickets_insert on public.support_tickets for insert
    to authenticated with check (public.has_permission(organization_id, 'support.tickets.create'));

create policy support_tickets_update_customer on public.support_tickets for update
    to authenticated
    using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'support.tickets.create'));

create policy support_tickets_update_support on public.support_tickets for update
    to authenticated
    using (
        public.has_role('support_manager')
        or (public.has_role('support_agent') and (assigned_to = auth.uid() or assigned_to is null))
    )
    with check (public.has_role('support_manager') or public.has_role('support_agent'));

create trigger support_tickets_check_claim_org
    before insert or update
    on public.support_tickets
    for each row
execute function kit.check_nullable_claim_org_consistency();

/*
 * -------------------------------------------------------
 * Section: cross-org FK-consistency for support_* child tables
 * Reusable, keyed on ticket_id -> support_tickets.organization_id.
 * -------------------------------------------------------
 */
create or replace function kit.check_support_ticket_child_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    ticket_org uuid;
begin
    select organization_id into ticket_org from public.support_tickets where id = new.ticket_id;

    if ticket_org is null then
        raise exception 'Referenced support ticket does not exist';
    end if;

    if ticket_org <> new.organization_id then
        raise exception 'organization_id must match the referenced support ticket''s organization';
    end if;

    return new;
end;
$$;

/*
 * -------------------------------------------------------
 * Section: support_assignments
 * Support-internal assignment history. Not customer-visible -- the
 * customer sees only the ticket's current assigned_to via support_tickets
 * itself, not this table's full history.
 * -------------------------------------------------------
 */
create table if not exists
    public.support_assignments
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    ticket_id       uuid not null references public.support_tickets (id) on delete cascade,
    support_user_id uuid not null references auth.users,
    assigned_at     timestamp with time zone default now(),
    assigned_by     uuid references auth.users,
    unassigned_at   timestamp with time zone
);

create index if not exists support_assignments_ticket_id_idx on public.support_assignments (ticket_id);

alter table public.support_assignments enable row level security;

revoke all on public.support_assignments from authenticated, service_role;
grant select, insert, update on table public.support_assignments to authenticated;
grant select, insert, update, delete on table public.support_assignments to service_role;

create policy support_assignments_read on public.support_assignments for select
    to authenticated using (
        public.has_role('support_manager')
        or (public.has_role('support_agent') and support_user_id = auth.uid())
    );

create policy support_assignments_insert on public.support_assignments for insert
    to authenticated with check (public.has_role('support_manager') or public.has_role('support_agent'));

create trigger support_assignments_check_org
    before insert or update
    on public.support_assignments
    for each row
execute function kit.check_support_ticket_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: support_messages
 * is_internal_note rows are support-only (never visible to the customer
 * org), matching "no claim-data edits/exposure unless explicitly
 * granted."
 * -------------------------------------------------------
 */
create table if not exists
    public.support_messages
(
    id               uuid primary key default extensions.uuid_generate_v4(),
    organization_id  uuid not null references public.organizations (id) on delete cascade,
    ticket_id        uuid not null references public.support_tickets (id) on delete cascade,
    sender_id        uuid references auth.users,
    body             text not null,
    is_internal_note boolean not null default false,
    created_at       timestamp with time zone default now(),
    created_by       uuid references auth.users
);

create index if not exists support_messages_ticket_id_idx on public.support_messages (ticket_id, created_at);

alter table public.support_messages enable row level security;

revoke all on public.support_messages from authenticated, service_role;
grant select, insert on table public.support_messages to authenticated;
grant select, insert, update, delete on table public.support_messages to service_role;

create policy support_messages_read on public.support_messages for select
    to authenticated using (
        (public.has_org_access(organization_id) and not is_internal_note)
        or public.has_role('support_manager')
        or public.has_role('support_agent')
    );

create policy support_messages_insert on public.support_messages for insert
    to authenticated with check (
        (
            public.has_permission(organization_id, 'support.tickets.create')
            and not is_internal_note
        )
        or public.has_role('support_manager')
        or public.has_role('support_agent')
    );

create trigger support_messages_check_org
    before insert or update
    on public.support_messages
    for each row
execute function kit.check_support_ticket_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: support_access_sessions
 * The no-silent-impersonation core. Enforced entirely by DB constraints
 * and RLS, not app-layer discipline: an assigned ticket (WITH CHECK
 * verifies support_tickets.assigned_to = the entering support user), a
 * typed reason (NOT NULL), a hard time limit (expires_at, checked >
 * started_at), least-privilege (granted_scope defaults to '{}' -- empty
 * means read-only; nothing in this phase implements a write-extension
 * mechanism, so every session is read-only in practice), start/end
 * timestamps, and org-visible history (customer org can read its own
 * org's rows -- see the read policy below).
 * -------------------------------------------------------
 */
create table if not exists
    public.support_access_sessions
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid                     not null references public.organizations (id) on delete cascade,
    ticket_id       uuid                     not null references public.support_tickets (id) on delete cascade,
    support_user_id uuid                     not null references auth.users,
    reason          text                     not null,
    granted_scope   text[]                   not null default '{}',
    started_at      timestamp with time zone not null default now(),
    expires_at      timestamp with time zone not null,
    ended_at        timestamp with time zone,
    ended_by        uuid references auth.users,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    constraint support_access_sessions_expiry_check check (expires_at > started_at)
);

comment on table public.support_access_sessions is 'Audited, time-limited support access. An active session is one where now() is between started_at and expires_at AND ended_at is still null. has_active_support_session(org_id) is the sole mechanism granting support staff read access into tenant-owned data -- no other RLS bypass exists for support_manager/support_agent.';

create index if not exists support_access_sessions_org_idx on public.support_access_sessions (organization_id);
create index if not exists support_access_sessions_support_user_idx on public.support_access_sessions (support_user_id);

alter table public.support_access_sessions enable row level security;

revoke all on public.support_access_sessions from authenticated, service_role;
grant select, insert, update on table public.support_access_sessions to authenticated;
grant select, insert, update, delete on table public.support_access_sessions to service_role;

create policy support_access_sessions_read on public.support_access_sessions for select
    to authenticated using (
        public.has_org_access(organization_id)
        or support_user_id = auth.uid()
        or public.has_role('support_manager')
    );

-- Requires an assigned ticket: the entering support user must already be
-- the ticket's assigned_to (self-assign happens via support_tickets
-- update before this insert -- enforced here, not just by app discipline).
create policy support_access_sessions_insert on public.support_access_sessions for insert
    to authenticated with check (
        public.has_platform_permission('support.access_session.enter')
        and support_user_id = auth.uid()
        and exists (
            select 1
            from public.support_tickets t
            where t.id = ticket_id
              and t.assigned_to = auth.uid()
        )
    );

-- Ending a session early (setting ended_at/ended_by): the session's own
-- support user, or a support_manager.
create policy support_access_sessions_update on public.support_access_sessions for update
    to authenticated
    using (support_user_id = auth.uid() or public.has_role('support_manager'))
    with check (support_user_id = auth.uid() or public.has_role('support_manager'));

create trigger support_access_sessions_check_org
    before insert or update
    on public.support_access_sessions
    for each row
execute function kit.check_support_ticket_child_org_consistency();

create or replace function public.has_active_support_session(target_org_id uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = ''
as
$$
select exists (
    select 1
    from public.support_access_sessions s
    where s.organization_id = target_org_id
      and s.support_user_id = auth.uid()
      and s.started_at <= now()
      and s.expires_at > now()
      and s.ended_at is null
);
$$;

comment on function public.has_active_support_session(uuid) is 'True if the caller has a currently-active (started, unexpired, unended) support_access_sessions row for target_org_id. The only RLS bypass a support_manager/support_agent gets into tenant-owned data -- read-only by construction (no policy uses this to grant INSERT/UPDATE on tenant-owned tables).';

revoke all on function public.has_active_support_session(uuid) from public;
grant execute on function public.has_active_support_session(uuid) to authenticated;

/*
 * -------------------------------------------------------
 * Section: documents (Phase 8's real, generic, privately-stored document
 * registry -- separate from Phase 5's claim_documents, which is metadata
 * only with no storage wiring and stays that way; a document here can
 * optionally reference a claim via the nullable claim_id).
 * -------------------------------------------------------
 */
create table if not exists
    public.documents
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid         not null references public.organizations (id) on delete cascade,
    claim_id        uuid references public.claims (id) on delete set null,
    sim_document_id varchar(40)  not null default ('SIM-DOC-' || upper(substr(replace(extensions.uuid_generate_v4()::text, '-', ''), 1, 8))),
    file_name       varchar(255) not null,
    storage_path    text         not null unique,
    mime_type       varchar(100) not null,
    file_size_bytes integer      not null check (file_size_bytes > 0),
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    updated_at      timestamp with time zone default now(),
    updated_by      uuid references auth.users,
    deleted_at      timestamp with time zone
);

comment on table public.documents is 'Private document registry. storage_path is the object key in the private org_documents Storage bucket (path convention: {organization_id}/{uuid}-{file_name}). Never served via a public URL -- always a short-TTL signed URL, issued only if the caller''s RLS grants them SELECT on this row (org documents.view_download permission, or an active support_access_sessions row).';

create index if not exists documents_organization_id_idx on public.documents (organization_id, created_at);
create index if not exists documents_claim_id_idx on public.documents (claim_id);

alter table public.documents enable row level security;

revoke all on public.documents from authenticated, service_role;
grant select, insert, update on table public.documents to authenticated;
grant select, insert, update, delete on table public.documents to service_role;

create policy documents_read on public.documents for select
    to authenticated using (
        (public.has_permission(organization_id, 'documents.view_download') and deleted_at is null)
        or public.has_active_support_session(organization_id)
    );

-- No dedicated "documents.upload" permission is seeded (the architecture's
-- role matrix only defines a combined "View / Download documents" row) --
-- upload is gated on the same documents.view_download permission rather
-- than inventing an unseeded permission key.
create policy documents_insert on public.documents for insert
    to authenticated with check (public.has_permission(organization_id, 'documents.view_download'));

create policy documents_update on public.documents for update
    to authenticated
    using (public.has_permission(organization_id, 'documents.view_download'))
    with check (public.has_permission(organization_id, 'documents.view_download'));

create trigger documents_check_claim_org
    before insert or update
    on public.documents
    for each row
execute function kit.check_nullable_claim_org_consistency();

create or replace function kit.check_document_child_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    doc_org uuid;
begin
    select organization_id into doc_org from public.documents where id = new.document_id;

    if doc_org is null then
        raise exception 'Referenced document does not exist';
    end if;

    if doc_org <> new.organization_id then
        raise exception 'organization_id must match the referenced document''s organization';
    end if;

    return new;
end;
$$;

/*
 * -------------------------------------------------------
 * Section: support_ticket_documents (ticket attachments)
 * Two parent FKs (ticket_id, document_id) -- both need their own
 * org-consistency trigger (the same class of gap Phase 7's remit_claims
 * had, caught by its own pgTAP negative -- not repeating that miss here).
 * -------------------------------------------------------
 */
create table if not exists
    public.support_ticket_documents
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    ticket_id       uuid not null references public.support_tickets (id) on delete cascade,
    document_id     uuid not null references public.documents (id) on delete cascade,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users
);

create index if not exists support_ticket_documents_ticket_id_idx on public.support_ticket_documents (ticket_id);

alter table public.support_ticket_documents enable row level security;

revoke all on public.support_ticket_documents from authenticated, service_role;
grant select, insert on table public.support_ticket_documents to authenticated;
grant select, insert, update, delete on table public.support_ticket_documents to service_role;

create policy support_ticket_documents_read on public.support_ticket_documents for select
    to authenticated using (
        public.has_org_access(organization_id)
        or public.has_role('support_manager')
        or public.has_role('support_agent')
    );

create policy support_ticket_documents_insert on public.support_ticket_documents for insert
    to authenticated with check (
        public.has_permission(organization_id, 'support.tickets.create')
        or public.has_role('support_manager')
        or public.has_role('support_agent')
    );

create trigger support_ticket_documents_check_ticket_org
    before insert or update
    on public.support_ticket_documents
    for each row
execute function kit.check_support_ticket_child_org_consistency();

create trigger support_ticket_documents_check_document_org
    before insert or update
    on public.support_ticket_documents
    for each row
execute function kit.check_document_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: document_access_events
 * Logs every view/download. Insert-only from the app's perspective (no
 * UPDATE policy -- an access event, once logged, is never edited),
 * though unlike audit_events/transaction_events this one does grant
 * DELETE to authenticated for retention/GDPR-style cleanup later; no
 * code path in this phase actually deletes a row.
 * -------------------------------------------------------
 */
create table if not exists
    public.document_access_events
(
    id                         uuid primary key default extensions.uuid_generate_v4(),
    organization_id            uuid        not null references public.organizations (id) on delete cascade,
    document_id                uuid        not null references public.documents (id) on delete cascade,
    accessed_by                uuid references auth.users,
    access_type                varchar(20) not null check (access_type in ('view', 'download')),
    support_access_session_id  uuid references public.support_access_sessions (id) on delete set null,
    created_at                 timestamp with time zone default now()
);

create index if not exists document_access_events_document_id_idx on public.document_access_events (document_id, created_at);

alter table public.document_access_events enable row level security;

revoke all on public.document_access_events from authenticated, service_role;
grant select, insert on table public.document_access_events to authenticated;
grant select, insert, update, delete on table public.document_access_events to service_role;

create policy document_access_events_read on public.document_access_events for select
    to authenticated using (
        public.has_permission(organization_id, 'documents.view_download')
        or public.has_active_support_session(organization_id)
        or public.has_role('support_manager')
    );

create policy document_access_events_insert on public.document_access_events for insert
    to authenticated with check (
        public.has_permission(organization_id, 'documents.view_download')
        or public.has_active_support_session(organization_id)
    );

create trigger document_access_events_check_org
    before insert or update
    on public.document_access_events
    for each row
execute function kit.check_document_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: audit_events -- append-only (INSERT policy only, no
 * UPDATE/DELETE grant to authenticated at all, matching the
 * transaction_events pattern proven in Phase 6). Generated for
 * security-sensitive actions: role changes, support session start/end,
 * document access, claim approval/submission.
 * -------------------------------------------------------
 */
create table if not exists
    public.audit_events
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid         not null references public.organizations (id) on delete cascade,
    actor_id        uuid references auth.users,
    action          varchar(100) not null,
    target_type     varchar(50),
    target_id       uuid,
    metadata        jsonb        not null default '{}'::jsonb,
    correlation_id  uuid,
    created_at      timestamp with time zone default now()
);

comment on table public.audit_events is 'Append-only audit trail for security-sensitive actions (role changes, support session start/end, document access, claim approval/submission). No UPDATE/DELETE grant exists at all for authenticated -- proven by pgTAP, same pattern as transaction_events.';

create index if not exists audit_events_organization_id_idx on public.audit_events (organization_id, created_at);
create index if not exists audit_events_actor_id_idx on public.audit_events (actor_id);

alter table public.audit_events enable row level security;

revoke all on public.audit_events from authenticated, service_role;
grant select, insert on table public.audit_events to authenticated;
grant select, insert, update, delete on table public.audit_events to service_role;

create policy audit_events_read on public.audit_events for select
    to authenticated using (
        public.has_permission(organization_id, 'audit.view')
        or (public.has_permission(organization_id, 'audit.view_own') and actor_id = auth.uid())
        or public.has_platform_permission('audit.view')
        or (public.has_platform_permission('audit.view_own') and actor_id = auth.uid())
    );

create policy audit_events_insert on public.audit_events for insert
    to authenticated with check (
        actor_id = auth.uid()
        and (
            public.has_org_access(organization_id)
            or public.has_platform_permission('support.access_session.enter')
        )
    );

/*
 * -------------------------------------------------------
 * Section: private Storage bucket for documents
 * NOT the public account_image bucket -- a brand-new private bucket with
 * a file-size/type allowlist, org-scoped RLS via a path convention
 * ({organization_id}/{uuid}-{file_name}), and the same active-session
 * bypass as the documents table's own RLS.
 * -------------------------------------------------------
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'org_documents',
    'org_documents',
    false,
    10485760,
    array['application/pdf', 'image/png', 'image/jpeg', 'text/plain']
)
on conflict (id) do nothing;

create policy org_documents_select on storage.objects for select
    to authenticated using (
        bucket_id = 'org_documents'
        and (
            public.has_permission(((storage.foldername(name))[1])::uuid, 'documents.view_download')
            or public.has_active_support_session(((storage.foldername(name))[1])::uuid)
        )
    );

create policy org_documents_insert on storage.objects for insert
    to authenticated with check (
        bucket_id = 'org_documents'
        and public.has_permission(((storage.foldername(name))[1])::uuid, 'documents.view_download')
    );

create policy org_documents_delete on storage.objects for delete
    to authenticated using (
        bucket_id = 'org_documents'
        and public.has_permission(((storage.foldername(name))[1])::uuid, 'documents.view_download')
    );

/*
 * -------------------------------------------------------
 * Section: extend Phase 7's remittances RLS with the support-session
 * bypass -- the other "E" (session-scoped) row in the architecture's
 * abridged role matrix besides documents.
 * -------------------------------------------------------
 */
drop policy if exists remittances_read on public.remittances;

create policy remittances_read on public.remittances for select
    to authenticated using (
        public.has_permission(organization_id, 'remittances.view')
        or public.has_active_support_session(organization_id)
    );
