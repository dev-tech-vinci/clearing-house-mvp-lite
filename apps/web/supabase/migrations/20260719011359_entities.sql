/*
 * -------------------------------------------------------
 * Phase 3 — Providers, facilities, patients, coverages
 * Synthetic healthcare entities owned by an organization. Every table
 * carries organization_id, created_at/by, updated_at/by, deleted_at, and
 * an RLS policy set that reuses the Phase 2 has_org_access() helper --
 * org membership alone gates CRUD here (no finer permission key; the
 * architecture's role-permission matrix does not define one for these
 * entities, and org-owned CRUD is this phase's explicit acceptance gate).
 *
 * All *_id "SIM-" style columns are cosmetic, obviously-synthetic labels
 * (random hex suffix), not real identifiers. Simulation only -- no real
 * PHI. `payer_id` on coverages/organization_payer_enrollments is
 * intentionally nullable with NO foreign key yet: public.payers does not
 * exist until Phase 4, which will add the constraint.
 * -------------------------------------------------------
 */

/*
 * -------------------------------------------------------
 * Section: providers
 * -------------------------------------------------------
 */
create table if not exists
    public.providers
(
    id                uuid primary key default extensions.uuid_generate_v4(),
    organization_id   uuid         not null references public.organizations (id) on delete cascade,
    sim_provider_id   varchar(32)  not null default ('SIM-PROV-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    provider_type     varchar(20)  not null check (provider_type in ('individual', 'organization')),
    npi               varchar(10)  not null check (npi ~ '^[0-9]{10}$'),
    first_name        varchar(255),
    last_name         varchar(255),
    organization_name varchar(255),
    taxonomy_code     varchar(20),
    is_active         boolean      not null default true,
    created_at        timestamp with time zone default now(),
    created_by        uuid references auth.users,
    updated_at        timestamp with time zone,
    updated_by        uuid references auth.users,
    deleted_at        timestamp with time zone,
    constraint providers_name_by_type check (
        (provider_type = 'individual' and first_name is not null and last_name is not null)
            or
        (provider_type = 'organization' and organization_name is not null)
        )
);

comment on table public.providers is 'Synthetic rendering/billing providers owned by an organization. Simulation only -- no real NPIs or real provider identities.';
comment on column public.providers.sim_provider_id is 'Cosmetic, obviously-synthetic label (SIM-PROV-xxxxxxxx). Not a real business key -- id is the PK.';
comment on column public.providers.npi is 'Format-validated (10 digits) at the DB layer; Luhn checksum validation happens at the application layer (Zod). Synthetic values only.';

create index if not exists providers_org_id_idx on public.providers (organization_id, created_at);
create unique index if not exists providers_org_npi_active_idx on public.providers (organization_id, npi) where deleted_at is null;
create unique index if not exists providers_org_sim_id_idx on public.providers (organization_id, sim_provider_id) where deleted_at is null;

alter table public.providers enable row level security;

revoke all on public.providers from authenticated, service_role;
grant select, insert, update on table public.providers to authenticated;
grant select, insert, update, delete on table public.providers to service_role;

create policy providers_read on public.providers for select
    to authenticated using (deleted_at is null and public.has_org_access(organization_id));

create policy providers_insert on public.providers for insert
    to authenticated with check (public.has_org_access(organization_id));

create policy providers_update on public.providers for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_org_access(organization_id));

/*
 * -------------------------------------------------------
 * Section: facilities
 * -------------------------------------------------------
 */
create table if not exists
    public.facilities
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid         not null references public.organizations (id) on delete cascade,
    sim_facility_id varchar(32)  not null default ('SIM-FAC-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    name            varchar(255) not null,
    facility_type   varchar(50)  not null default 'outpatient_clinic'
        check (facility_type in ('outpatient_clinic', 'inpatient_hospital', 'residential', 'telehealth', 'other')),
    npi             varchar(10) check (npi ~ '^[0-9]{10}$'),
    address_line1   varchar(255),
    address_line2   varchar(255),
    city            varchar(100),
    state           varchar(2),
    postal_code     varchar(10),
    is_active       boolean      not null default true,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    updated_at      timestamp with time zone,
    updated_by      uuid references auth.users,
    deleted_at      timestamp with time zone
);

comment on table public.facilities is 'Synthetic places of service owned by an organization. Simulation only.';
comment on column public.facilities.sim_facility_id is 'Cosmetic, obviously-synthetic label (SIM-FAC-xxxxxxxx).';

create index if not exists facilities_org_id_idx on public.facilities (organization_id, created_at);
create unique index if not exists facilities_org_sim_id_idx on public.facilities (organization_id, sim_facility_id) where deleted_at is null;

alter table public.facilities enable row level security;

revoke all on public.facilities from authenticated, service_role;
grant select, insert, update on table public.facilities to authenticated;
grant select, insert, update, delete on table public.facilities to service_role;

create policy facilities_read on public.facilities for select
    to authenticated using (deleted_at is null and public.has_org_access(organization_id));

create policy facilities_insert on public.facilities for insert
    to authenticated with check (public.has_org_access(organization_id));

create policy facilities_update on public.facilities for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_org_access(organization_id));

/*
 * -------------------------------------------------------
 * Section: patients
 * -------------------------------------------------------
 */
create table if not exists
    public.patients
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid         not null references public.organizations (id) on delete cascade,
    sim_patient_id  varchar(32)  not null default ('SIM-PAT-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    first_name      varchar(255) not null,
    last_name       varchar(255) not null,
    date_of_birth   date         not null,
    gender          varchar(20)  not null default 'unknown' check (gender in ('female', 'male', 'other', 'unknown')),
    address_line1   varchar(255),
    address_line2   varchar(255),
    city            varchar(100),
    state           varchar(2),
    postal_code     varchar(10),
    is_active       boolean      not null default true,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    updated_at      timestamp with time zone,
    updated_by      uuid references auth.users,
    deleted_at      timestamp with time zone
);

comment on table public.patients is 'Synthetic patients owned by an organization. Simulation only -- no real PHI. Names must be obviously fictional.';
comment on column public.patients.sim_patient_id is 'Cosmetic, obviously-synthetic label (SIM-PAT-xxxxxxxx).';

create index if not exists patients_org_id_idx on public.patients (organization_id, created_at);
create unique index if not exists patients_org_sim_id_idx on public.patients (organization_id, sim_patient_id) where deleted_at is null;

alter table public.patients enable row level security;

revoke all on public.patients from authenticated, service_role;
grant select, insert, update on table public.patients to authenticated;
grant select, insert, update, delete on table public.patients to service_role;

create policy patients_read on public.patients for select
    to authenticated using (deleted_at is null and public.has_org_access(organization_id));

create policy patients_insert on public.patients for insert
    to authenticated with check (public.has_org_access(organization_id));

create policy patients_update on public.patients for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_org_access(organization_id));

/*
 * -------------------------------------------------------
 * Section: subscribers
 * -------------------------------------------------------
 */
create table if not exists
    public.subscribers
(
    id                      uuid primary key default extensions.uuid_generate_v4(),
    organization_id         uuid         not null references public.organizations (id) on delete cascade,
    sim_subscriber_id       varchar(32)  not null default ('SIM-SUB-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    patient_id              uuid         not null references public.patients (id) on delete cascade,
    relationship_to_patient varchar(20)  not null default 'self' check (relationship_to_patient in ('self', 'spouse', 'child', 'other')),
    first_name              varchar(255) not null,
    last_name               varchar(255) not null,
    date_of_birth           date,
    is_active               boolean      not null default true,
    created_at              timestamp with time zone default now(),
    created_by              uuid references auth.users,
    updated_at              timestamp with time zone,
    updated_by              uuid references auth.users,
    deleted_at              timestamp with time zone
);

comment on table public.subscribers is 'Synthetic insurance policy holders, each tied to exactly one patient. Simulation only -- no real PHI.';
comment on column public.subscribers.patient_id is 'The patient this subscriber record relates to. relationship_to_patient describes how (self/spouse/child/other).';

create index if not exists subscribers_org_id_idx on public.subscribers (organization_id, created_at);
create index if not exists subscribers_patient_id_idx on public.subscribers (patient_id);
create unique index if not exists subscribers_org_sim_id_idx on public.subscribers (organization_id, sim_subscriber_id) where deleted_at is null;

alter table public.subscribers enable row level security;

revoke all on public.subscribers from authenticated, service_role;
grant select, insert, update on table public.subscribers to authenticated;
grant select, insert, update, delete on table public.subscribers to service_role;

create policy subscribers_read on public.subscribers for select
    to authenticated using (deleted_at is null and public.has_org_access(organization_id));

create policy subscribers_insert on public.subscribers for insert
    to authenticated with check (public.has_org_access(organization_id));

create policy subscribers_update on public.subscribers for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_org_access(organization_id));

-- Cross-org data-integrity guard: RLS alone stops you *reading* another
-- org's row, but not from creating a row in your own org whose FK points
-- at someone else's patient. This trigger closes that gap.
create or replace function kit.check_subscriber_patient_org()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    patient_org uuid;
begin
    select organization_id into patient_org from public.patients where id = new.patient_id;

    if patient_org is null then
        raise exception 'Referenced patient does not exist';
    end if;

    if patient_org <> new.organization_id then
        raise exception 'subscriber.organization_id must match the referenced patient''s organization';
    end if;

    return new;
end;
$$;

create trigger subscribers_check_patient_org
    before insert or update
    on public.subscribers
    for each row
execute function kit.check_subscriber_patient_org();

/*
 * -------------------------------------------------------
 * Section: coverages
 * -------------------------------------------------------
 */
create table if not exists
    public.coverages
(
    id                uuid primary key default extensions.uuid_generate_v4(),
    organization_id   uuid        not null references public.organizations (id) on delete cascade,
    subscriber_id     uuid        not null references public.subscribers (id) on delete cascade,
    patient_id        uuid        not null references public.patients (id) on delete cascade,
    member_id         varchar(64) not null default ('SIM-MBR-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    group_number      varchar(64),
    payer_id          uuid,
    payer_label       varchar(255) not null,
    coverage_type     varchar(20)  not null default 'primary' check (coverage_type in ('primary', 'secondary', 'tertiary')),
    effective_date    date,
    termination_date  date,
    is_active         boolean      not null default true,
    created_at        timestamp with time zone default now(),
    created_by        uuid references auth.users,
    updated_at        timestamp with time zone,
    updated_by        uuid references auth.users,
    deleted_at        timestamp with time zone
);

comment on table public.coverages is 'Synthetic insurance coverage tied to a subscriber and the patient they cover. Simulation only -- no real PHI or real insurance IDs.';
comment on column public.coverages.member_id is 'Cosmetic, obviously-synthetic insurance member/card ID (SIM-MBR-xxxxxxxx). Never a real insurance ID.';
comment on column public.coverages.payer_id is 'No FK yet -- public.payers does not exist until Phase 4. payer_label is the required display value until then.';

create index if not exists coverages_org_id_idx on public.coverages (organization_id, created_at);
create index if not exists coverages_subscriber_id_idx on public.coverages (subscriber_id);
create index if not exists coverages_patient_id_idx on public.coverages (patient_id);

alter table public.coverages enable row level security;

revoke all on public.coverages from authenticated, service_role;
grant select, insert, update on table public.coverages to authenticated;
grant select, insert, update, delete on table public.coverages to service_role;

create policy coverages_read on public.coverages for select
    to authenticated using (deleted_at is null and public.has_org_access(organization_id));

create policy coverages_insert on public.coverages for insert
    to authenticated with check (public.has_org_access(organization_id));

create policy coverages_update on public.coverages for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_org_access(organization_id));

create or replace function kit.check_coverage_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    sub_org     uuid;
    sub_patient uuid;
    pat_org     uuid;
begin
    select organization_id, patient_id into sub_org, sub_patient
    from public.subscribers
    where id = new.subscriber_id;

    if sub_org is null then
        raise exception 'Referenced subscriber does not exist';
    end if;

    select organization_id into pat_org from public.patients where id = new.patient_id;

    if pat_org is null then
        raise exception 'Referenced patient does not exist';
    end if;

    if sub_org <> new.organization_id or pat_org <> new.organization_id then
        raise exception 'coverage.organization_id must match both the referenced subscriber''s and patient''s organization';
    end if;

    if sub_patient <> new.patient_id then
        raise exception 'coverage.patient_id must match the referenced subscriber''s patient';
    end if;

    return new;
end;
$$;

create trigger coverages_check_org_consistency
    before insert or update
    on public.coverages
    for each row
execute function kit.check_coverage_org_consistency();

/*
 * -------------------------------------------------------
 * Section: organization_payer_enrollments
 * -------------------------------------------------------
 */
create table if not exists
    public.organization_payer_enrollments
(
    id               uuid primary key default extensions.uuid_generate_v4(),
    organization_id  uuid         not null references public.organizations (id) on delete cascade,
    payer_id         uuid,
    payer_label      varchar(255) not null,
    status           varchar(20)  not null default 'pending' check (status in ('pending', 'active', 'inactive')),
    effective_date   date,
    termination_date date,
    notes            text,
    created_at       timestamp with time zone default now(),
    created_by       uuid references auth.users,
    updated_at       timestamp with time zone,
    updated_by       uuid references auth.users,
    deleted_at       timestamp with time zone
);

comment on table public.organization_payer_enrollments is 'Tracks which (simulated) payers an organization is enrolled to submit claims to. Simulation only.';
comment on column public.organization_payer_enrollments.payer_id is 'No FK yet -- public.payers does not exist until Phase 4. payer_label is the required display value until then.';

create index if not exists org_payer_enrollments_org_id_idx on public.organization_payer_enrollments (organization_id, created_at);

alter table public.organization_payer_enrollments enable row level security;

revoke all on public.organization_payer_enrollments from authenticated, service_role;
grant select, insert, update on table public.organization_payer_enrollments to authenticated;
grant select, insert, update, delete on table public.organization_payer_enrollments to service_role;

create policy org_payer_enrollments_read on public.organization_payer_enrollments for select
    to authenticated using (deleted_at is null and public.has_org_access(organization_id));

create policy org_payer_enrollments_insert on public.organization_payer_enrollments for insert
    to authenticated with check (public.has_org_access(organization_id));

create policy org_payer_enrollments_update on public.organization_payer_enrollments for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_org_access(organization_id));
