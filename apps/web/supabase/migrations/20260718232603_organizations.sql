/*
 * -------------------------------------------------------
 * Phase 2 — Organizations, memberships, roles & RLS
 * Introduces multi-tenancy on top of the MakerKit Lite personal-account
 * baseline. Every tenant-owned table carries organization_id, created_at/by,
 * updated_at/by, deleted_at (soft delete), and an RLS policy that scopes rows
 * to the caller's org memberships.
 *
 * Role/permission seed data below is sourced directly from the
 * "Role-permission matrix" in
 * docs/Behavioral_Health_Clearinghouse_MVP_Technical_Architecture.md.
 * Simulation only — SIM- prefixed synthetic org/user data is created by
 * pgTAP tests and the app, never by this migration.
 * -------------------------------------------------------
 */

-- pgTAP is not installed in the baseline local DB image; this phase
-- introduces the first pgTAP suite (supabase/tests/database/*.test.sql), so
-- install it here to guarantee `supabase db test` works after any reset.
create extension if not exists pgtap with schema extensions;

/*
 * -------------------------------------------------------
 * Section: organizations
 * -------------------------------------------------------
 */
create table if not exists
    public.organizations
(
    id         uuid primary key     default extensions.uuid_generate_v4(),
    name       varchar(255) not null,
    slug       varchar(255) not null unique,
    created_at timestamp with time zone default now(),
    created_by uuid references auth.users,
    updated_at timestamp with time zone,
    updated_by uuid references auth.users,
    deleted_at timestamp with time zone
);

comment on table public.organizations is 'Tenant organizations. Top-level entity that all other tenant-owned tables reference via organization_id.';
comment on column public.organizations.slug is 'URL-safe unique identifier for the organization.';
comment on column public.organizations.deleted_at is 'Soft-delete marker. Non-null rows are excluded by RLS.';

alter table public.organizations
    enable row level security;

revoke all on public.organizations
    from
    authenticated,
    service_role;

grant select, update on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organizations to service_role;

/*
 * -------------------------------------------------------
 * Section: roles & permissions (global catalog, not tenant-owned)
 * -------------------------------------------------------
 */
create table if not exists
    public.roles
(
    id              uuid primary key     default extensions.uuid_generate_v4(),
    key             varchar(64) not null unique,
    name            varchar(128) not null,
    description     text,
    is_platform_role boolean not null default false,
    created_at      timestamp with time zone default now()
);

comment on table public.roles is 'Global catalog of the nine roles defined in the architecture role-permission matrix. Not tenant-owned.';
comment on column public.roles.is_platform_role is 'True for roles that operate across organizations (Platform Super Admin, Support Manager, Support Agent). Phase 2 seeds these roles but does not grant them a cross-tenant RLS bypass -- see docs/progress/DECISIONS.md.';

alter table public.roles
    enable row level security;

revoke all on public.roles
    from
    authenticated,
    service_role;

grant select on table public.roles to authenticated;
grant select, insert, update, delete on table public.roles to service_role;

create policy roles_read on public.roles for
    select
    to authenticated using (true);

create table if not exists
    public.permissions
(
    id          uuid primary key     default extensions.uuid_generate_v4(),
    key         varchar(128) not null unique,
    description text,
    created_at  timestamp with time zone default now()
);

comment on table public.permissions is 'Global catalog of permission keys referenced by role_permissions and checked via public.has_permission(). Not tenant-owned.';

alter table public.permissions
    enable row level security;

revoke all on public.permissions
    from
    authenticated,
    service_role;

grant select on table public.permissions to authenticated;
grant select, insert, update, delete on table public.permissions to service_role;

create policy permissions_read on public.permissions for
    select
    to authenticated using (true);

create table if not exists
    public.role_permissions
(
    role_id       uuid not null references public.roles (id) on delete cascade,
    permission_id uuid not null references public.permissions (id) on delete cascade,
    created_at    timestamp with time zone default now(),
    primary key (role_id, permission_id)
);

comment on table public.role_permissions is 'Maps roles to permissions per the architecture role-permission matrix. Not tenant-owned.';

alter table public.role_permissions
    enable row level security;

revoke all on public.role_permissions
    from
    authenticated,
    service_role;

grant select on table public.role_permissions to authenticated;
grant select, insert, update, delete on table public.role_permissions to service_role;

create policy role_permissions_read on public.role_permissions for
    select
    to authenticated using (true);

/*
 * -------------------------------------------------------
 * Section: organization_memberships
 * -------------------------------------------------------
 */
create table if not exists
    public.organization_memberships
(
    id              uuid primary key     default extensions.uuid_generate_v4(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    user_id         uuid not null references auth.users (id) on delete cascade,
    role_id         uuid not null references public.roles (id),
    invited_by      uuid references auth.users,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    updated_at      timestamp with time zone,
    updated_by      uuid references auth.users,
    deleted_at      timestamp with time zone
);

comment on table public.organization_memberships is 'Links a user to an organization with a role. Tenant-owned via organization_id.';

create unique index if not exists organization_memberships_org_user_active_idx
    on public.organization_memberships (organization_id, user_id)
    where deleted_at is null;

create index if not exists organization_memberships_org_id_idx
    on public.organization_memberships (organization_id, created_at);

create index if not exists organization_memberships_user_id_idx
    on public.organization_memberships (user_id);

alter table public.organization_memberships
    enable row level security;

revoke all on public.organization_memberships
    from
    authenticated,
    service_role;

grant select, update on table public.organization_memberships to authenticated;
grant select, insert, update, delete on table public.organization_memberships to service_role;

/*
 * -------------------------------------------------------
 * Section: invitations
 * -------------------------------------------------------
 */
create table if not exists
    public.invitations
(
    id              uuid primary key     default extensions.uuid_generate_v4(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    email           varchar(320) not null,
    role_id         uuid not null references public.roles (id),
    invited_by      uuid references auth.users,
    token           varchar(64) not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
    status          varchar(16) not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
    expires_at      timestamp with time zone not null default (now() + interval '7 days'),
    accepted_at     timestamp with time zone,
    accepted_by     uuid references auth.users,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    updated_at      timestamp with time zone,
    updated_by      uuid references auth.users,
    deleted_at      timestamp with time zone
);

comment on table public.invitations is 'Pending/accepted/revoked org invitations, accepted via public.accept_invitation(token). Tenant-owned via organization_id.';

create index if not exists invitations_org_id_idx
    on public.invitations (organization_id, created_at);

create unique index if not exists invitations_org_email_pending_idx
    on public.invitations (organization_id, lower(email))
    where status = 'pending';

alter table public.invitations
    enable row level security;

revoke all on public.invitations
    from
    authenticated,
    service_role;

grant select, insert, update on table public.invitations to authenticated;
grant select, insert, update, delete on table public.invitations to service_role;

/*
 * -------------------------------------------------------
 * Section: user_profiles -- thin, RLS-preserving wrapper over accounts
 * Deliberately NOT a cross-user visibility bypass: security_invoker means
 * this view is exactly as restrictive as accounts_read (self-only). Cross-
 * member visibility for the members list is handled by the tenant-scoped
 * public.get_organization_members() function below, not by this view.
 * -------------------------------------------------------
 */
create or replace view public.user_profiles
with (security_invoker = true) as
select
    id,
    name,
    email,
    picture_url,
    created_at,
    updated_at
from public.accounts;

comment on view public.user_profiles is 'Read-only, RLS-preserving wrapper over accounts for use by tenant-domain features. security_invoker = true: exactly as restrictive as accounts_read (self-only).';

grant select on public.user_profiles to authenticated;

/*
 * -------------------------------------------------------
 * Section: helper functions (SECURITY DEFINER, pinned search_path,
 * narrow EXECUTE grants). These read organization_memberships /
 * role_permissions internally as the function owner, bypassing RLS on
 * those tables to avoid recursive-policy evaluation -- the standard
 * Supabase pattern for RLS helper functions.
 * -------------------------------------------------------
 */
create or replace function public.has_org_access(target_org_id uuid)
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
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.deleted_at is null
);
$$;

comment on function public.has_org_access(uuid) is 'True if the calling user has an active (non-deleted) membership in the given organization.';

revoke all on function public.has_org_access(uuid) from public;
grant execute on function public.has_org_access(uuid) to authenticated;

create or replace function public.has_permission(target_org_id uuid, permission_key text)
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
             join public.role_permissions rp on rp.role_id = m.role_id
             join public.permissions p on p.id = rp.permission_id
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.deleted_at is null
      and p.key = permission_key
);
$$;

comment on function public.has_permission(uuid, text) is 'True if the calling user''s role in the given organization has the named permission.';

revoke all on function public.has_permission(uuid, text) from public;
grant execute on function public.has_permission(uuid, text) to authenticated;

/*
 * -------------------------------------------------------
 * Section: RLS policies that depend on the helper functions
 * -------------------------------------------------------
 */
create policy organizations_read on public.organizations for
    select
    to authenticated using (
        deleted_at is null
        and public.has_org_access(id)
    );

create policy organizations_update on public.organizations
    for update
    to authenticated using (
        public.has_permission(id, 'organizations.update')
    )
    with check (
        public.has_permission(id, 'organizations.update')
    );

create policy organization_memberships_read on public.organization_memberships for
    select
    to authenticated using (
        public.has_org_access(organization_id)
    );

create policy organization_memberships_update on public.organization_memberships
    for update
    to authenticated using (
        public.has_permission(organization_id, 'members.assign_role')
    )
    with check (
        public.has_permission(organization_id, 'members.assign_role')
    );

create policy invitations_read on public.invitations for
    select
    to authenticated using (
        public.has_org_access(organization_id)
    );

create policy invitations_insert on public.invitations
    for insert
    to authenticated with check (
        public.has_permission(organization_id, 'members.invite')
    );

create policy invitations_update on public.invitations
    for update
    to authenticated using (
        public.has_permission(organization_id, 'members.invite')
    )
    with check (
        public.has_permission(organization_id, 'members.invite')
    );

/*
 * -------------------------------------------------------
 * Section: create_organization / accept_invitation RPCs
 * Both SECURITY DEFINER with pinned search_path: they perform the one
 * legitimate bootstrap insert that RLS would otherwise block (a brand new
 * org has no members yet to satisfy has_permission checks).
 * -------------------------------------------------------
 */
create or replace function public.create_organization(org_name text, org_slug text)
    returns public.organizations
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    new_org        public.organizations;
    owner_role_id  uuid;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    select id into owner_role_id from public.roles where key = 'org_owner';

    if owner_role_id is null then
        raise exception 'org_owner role is not seeded';
    end if;

    insert into public.organizations (name, slug, created_by, updated_by)
    values (org_name, org_slug, auth.uid(), auth.uid())
    returning * into new_org;

    insert into public.organization_memberships (organization_id, user_id, role_id, created_by, updated_by)
    values (new_org.id, auth.uid(), owner_role_id, auth.uid(), auth.uid());

    return new_org;
end;
$$;

comment on function public.create_organization(text, text) is 'Creates an organization and atomically assigns the caller as org_owner. The only path by which a row can be inserted into public.organizations.';

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

create or replace function public.accept_invitation(invitation_token text)
    returns public.organization_memberships
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    inv            public.invitations;
    caller_email   text;
    new_membership public.organization_memberships;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    select email into caller_email from public.accounts where id = auth.uid();

    select * into inv
    from public.invitations
    where token = invitation_token
      and status = 'pending'
      and expires_at > now();

    if inv.id is null then
        raise exception 'Invitation not found, already used, or expired';
    end if;

    if caller_email is null or lower(inv.email) <> lower(caller_email) then
        raise exception 'This invitation was issued to a different email address';
    end if;

    insert into public.organization_memberships (organization_id, user_id, role_id, invited_by, created_by, updated_by)
    values (inv.organization_id, auth.uid(), inv.role_id, inv.invited_by, auth.uid(), auth.uid())
    on conflict (organization_id, user_id) where deleted_at is null
        do update set role_id = excluded.role_id, updated_by = auth.uid(), updated_at = now()
    returning * into new_membership;

    update public.invitations
    set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    where id = inv.id;

    return new_membership;
end;
$$;

comment on function public.accept_invitation(text) is 'Validates the token/email/expiry binding server-side, then inserts the caller''s organization_membership and marks the invitation accepted. The only path by which a caller can gain a membership in an org they do not already belong to.';

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.get_organization_members(target_org_id uuid)
    returns table
            (
                membership_id uuid,
                user_id       uuid,
                name          text,
                email         text,
                picture_url   text,
                role_key      text,
                role_name     text,
                created_at    timestamp with time zone
            )
    language plpgsql
    stable
    security definer
    set search_path = ''
as
$$
begin
    if not public.has_org_access(target_org_id) then
        raise exception 'Not a member of this organization';
    end if;

    return query
        select
            m.id,
            m.user_id,
            a.name::text,
            a.email::text,
            a.picture_url::text,
            r.key::text,
            r.name::text,
            m.created_at
        from public.organization_memberships m
                 join public.accounts a on a.id = m.user_id
                 join public.roles r on r.id = m.role_id
        where m.organization_id = target_org_id
          and m.deleted_at is null
        order by m.created_at asc;
end;
$$;

comment on function public.get_organization_members(uuid) is 'Tenant-scoped member list (name/email/role) for organizations the caller belongs to. Reads accounts internally as the function owner so per-user accounts RLS is never widened.';

revoke all on function public.get_organization_members(uuid) from public;
grant execute on function public.get_organization_members(uuid) to authenticated;

/*
 * -------------------------------------------------------
 * Section: seed -- nine roles + permission catalog + role/permission matrix
 * Sourced from the role-permission matrix in
 * docs/Behavioral_Health_Clearinghouse_MVP_Technical_Architecture.md.
 * "E" (support-access-session-scoped) and "ticket-scoped" cells are seeded
 * for documentation completeness but are not enforced by has_permission()
 * in Phase 2 -- see docs/progress/DECISIONS.md.
 * -------------------------------------------------------
 */
insert into public.roles (key, name, description, is_platform_role)
values
    ('platform_super_admin', 'Platform Super Admin', 'Full platform access: payer/rule management, cross-org visibility, data export, audit.', true),
    ('support_manager', 'Support Manager', 'Manages support tickets and staff; ticket-scoped remittance/document visibility; can enter audited support-access sessions.', true),
    ('support_agent', 'Support Agent', 'Front-line support; correction assistance, ticket-scoped visibility, own-action audit log only.', true),
    ('org_owner', 'Org Owner', 'Full control of the organization: members, roles, claims, remittances, exports.', false),
    ('org_admin', 'Org Admin', 'Same operational permissions as Org Owner within the organization.', false),
    ('claims_manager', 'Claims Manager', 'Creates, edits, approves and submits claims; views remittances.', false),
    ('claims_specialist', 'Claims Specialist', 'Creates and edits claims, corrects/resubmits; views remittances.', false),
    ('remittance_specialist', 'Remittance Specialist', 'Views remittances and posts payments.', false),
    ('read_only_auditor', 'Read-Only Auditor', 'Read-only visibility into remittances, documents, exports, and audit logs.', false)
on conflict (key) do nothing;

insert into public.permissions (key, description)
values
    ('members.invite', 'Create/invite users into an organization'),
    ('members.assign_role', 'Assign or change a member''s role'),
    ('organizations.update', 'Edit organization settings'),
    ('claims.create_edit', 'Create/edit claims'),
    ('claims.approve_submit', 'Approve/submit claims'),
    ('claims.correct_resubmit', 'Correct/resubmit claims'),
    ('remittances.view', 'View remittances'),
    ('remittances.post_payment', 'Post payments'),
    ('payers.manage', 'Edit payers / payer rules (platform-wide)'),
    ('documents.view_download', 'View/download documents'),
    ('support.tickets.create', 'Open support tickets'),
    ('organizations.view_all', 'View all organizations (platform/support only)'),
    ('support.access_session.enter', 'Enter an audited support-access session'),
    ('data.export', 'Export data'),
    ('audit.view', 'View audit logs (full)'),
    ('audit.view_own', 'View audit logs (own actions only)')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (values
    ('platform_super_admin', 'members.invite'),
    ('platform_super_admin', 'members.assign_role'),
    ('platform_super_admin', 'organizations.update'),
    ('platform_super_admin', 'payers.manage'),
    ('platform_super_admin', 'organizations.view_all'),
    ('platform_super_admin', 'data.export'),
    ('platform_super_admin', 'audit.view'),

    ('support_manager', 'remittances.view'),
    ('support_manager', 'documents.view_download'),
    ('support_manager', 'support.tickets.create'),
    ('support_manager', 'organizations.view_all'),
    ('support_manager', 'support.access_session.enter'),
    ('support_manager', 'audit.view'),

    ('support_agent', 'claims.correct_resubmit'),
    ('support_agent', 'remittances.view'),
    ('support_agent', 'documents.view_download'),
    ('support_agent', 'support.tickets.create'),
    ('support_agent', 'organizations.view_all'),
    ('support_agent', 'support.access_session.enter'),
    ('support_agent', 'audit.view_own'),

    ('org_owner', 'members.invite'),
    ('org_owner', 'members.assign_role'),
    ('org_owner', 'organizations.update'),
    ('org_owner', 'claims.create_edit'),
    ('org_owner', 'claims.approve_submit'),
    ('org_owner', 'claims.correct_resubmit'),
    ('org_owner', 'remittances.view'),
    ('org_owner', 'remittances.post_payment'),
    ('org_owner', 'documents.view_download'),
    ('org_owner', 'support.tickets.create'),
    ('org_owner', 'data.export'),
    ('org_owner', 'audit.view'),

    ('org_admin', 'members.invite'),
    ('org_admin', 'members.assign_role'),
    ('org_admin', 'organizations.update'),
    ('org_admin', 'claims.create_edit'),
    ('org_admin', 'claims.approve_submit'),
    ('org_admin', 'claims.correct_resubmit'),
    ('org_admin', 'remittances.view'),
    ('org_admin', 'remittances.post_payment'),
    ('org_admin', 'documents.view_download'),
    ('org_admin', 'support.tickets.create'),
    ('org_admin', 'data.export'),
    ('org_admin', 'audit.view'),

    ('claims_manager', 'claims.create_edit'),
    ('claims_manager', 'claims.approve_submit'),
    ('claims_manager', 'claims.correct_resubmit'),
    ('claims_manager', 'remittances.view'),
    ('claims_manager', 'documents.view_download'),
    ('claims_manager', 'support.tickets.create'),

    ('claims_specialist', 'claims.create_edit'),
    ('claims_specialist', 'claims.correct_resubmit'),
    ('claims_specialist', 'remittances.view'),
    ('claims_specialist', 'documents.view_download'),
    ('claims_specialist', 'support.tickets.create'),

    ('remittance_specialist', 'remittances.view'),
    ('remittance_specialist', 'remittances.post_payment'),
    ('remittance_specialist', 'documents.view_download'),

    ('read_only_auditor', 'remittances.view'),
    ('read_only_auditor', 'documents.view_download'),
    ('read_only_auditor', 'data.export'),
    ('read_only_auditor', 'audit.view')
) as matrix(role_key, permission_key)
    join public.roles r on r.key = matrix.role_key
    join public.permissions p on p.key = matrix.permission_key
on conflict (role_id, permission_id) do nothing;
