/*
 * -------------------------------------------------------
 * Phase 5 — Professional (837P) & institutional (837I) claim builders
 * Scoped, synthetic claim data model. Every table is org-owned (tenancy
 * contract: organization_id, created_at/by, updated_at/by where the row
 * has its own edit lifecycle, deleted_at where soft-delete makes sense),
 * gated on has_org_access()/has_permission() exactly like Phase 3's
 * entities. Cross-org FK-consistency is enforced by BEFORE INSERT/UPDATE
 * triggers, reusing the exact pattern from
 * apps/web/supabase/migrations/20260719011359_entities.sql
 * (kit.check_subscriber_patient_org / kit.check_coverage_org_consistency).
 *
 * claim_documents, claim_relationships, and claim_batches get schema +
 * RLS + pgTAP coverage in this migration but no dedicated UI yet -- real
 * document storage is Phase 8 scope, correction/resubmission workflow and
 * EDI batch generation are Phase 6/7 scope. See docs/05-claim-lifecycle.md
 * and docs/progress/DECISIONS.md.
 *
 * Simulation only -- SIM- prefixed IDs, synthetic ICD-10/CPT/HCPCS values
 * only (packages/features/claims/src/lib/synthetic-codes.ts), no real PHI,
 * no real payer connectivity, no EDI generation yet.
 * -------------------------------------------------------
 */

/*
 * -------------------------------------------------------
 * Section: claim_batches
 * Schema + RLS only this phase -- EDI batch generation is Phase 6.
 * -------------------------------------------------------
 */
create table if not exists
    public.claim_batches
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid        not null references public.organizations (id) on delete cascade,
    sim_batch_id    varchar(32) not null default ('SIM-BATCH-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    batch_name      varchar(255),
    status          varchar(20) not null default 'open' check (status in ('open', 'closed', 'submitted')),
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    updated_at      timestamp with time zone,
    updated_by      uuid references auth.users,
    deleted_at      timestamp with time zone
);

comment on table public.claim_batches is 'Groups claims for (future, Phase 6) EDI submission. Schema + RLS only this phase -- no batch-management UI yet.';

create index if not exists claim_batches_org_id_idx on public.claim_batches (organization_id, created_at);

alter table public.claim_batches enable row level security;

revoke all on public.claim_batches from authenticated, service_role;
grant select, insert, update on table public.claim_batches to authenticated;
grant select, insert, update, delete on table public.claim_batches to service_role;

create policy claim_batches_read on public.claim_batches for select
    to authenticated using (deleted_at is null and public.has_org_access(organization_id));

create policy claim_batches_insert on public.claim_batches for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.create_edit'));

create policy claim_batches_update on public.claim_batches for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.create_edit'));

/*
 * -------------------------------------------------------
 * Section: claims
 * status is intentionally scoped to this phase's draft->validate->approve
 * workflow only (draft, validation_failed, validated, approved). The full
 * EDI/adjudication lifecycle from the architecture doc's state machine
 * (edi_generated, submitted, ta1_received, ... closed) is added by
 * whichever later phase actually drives those transitions -- same
 * deferral pattern as Phase 3's payer_id, not an oversight.
 * -------------------------------------------------------
 */
create table if not exists
    public.claims
(
    id                    uuid primary key default extensions.uuid_generate_v4(),
    organization_id       uuid        not null references public.organizations (id) on delete cascade,
    sim_claim_id          varchar(32) not null default ('SIM-CLM-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    claim_type            varchar(20) not null check (claim_type in ('professional', 'institutional')),
    patient_id            uuid        not null references public.patients (id),
    subscriber_id         uuid        not null references public.subscribers (id),
    coverage_id           uuid        not null references public.coverages (id),
    billing_provider_id   uuid        not null references public.providers (id),
    batch_id              uuid references public.claim_batches (id),
    status                varchar(20) not null default 'draft' check (status in ('draft', 'validation_failed', 'validated', 'approved')),
    validated_at          timestamp with time zone,
    last_validation_result jsonb,
    approved_at           timestamp with time zone,
    approved_by           uuid references auth.users,
    notes                 text,
    created_at            timestamp with time zone default now(),
    created_by            uuid references auth.users,
    updated_at            timestamp with time zone,
    updated_by            uuid references auth.users,
    deleted_at            timestamp with time zone
);

comment on table public.claims is 'Scoped, synthetic 837P/837I claim headers. Simulation only -- no real PHI, no real payer connectivity, no EDI generation yet (Phase 6).';
comment on column public.claims.sim_claim_id is 'Cosmetic, obviously-synthetic label (SIM-CLM-xxxxxxxx).';
comment on column public.claims.last_validation_result is 'Persisted output of the last validateClaimAction run: array of {ruleCode, fieldPath, severity, rejectionOrDenial, explanation, suggestedCorrection}, sourced from live payer_rule_versions rows, not hardcoded strings.';

create index if not exists claims_org_id_idx on public.claims (organization_id, created_at);
create index if not exists claims_patient_id_idx on public.claims (patient_id);
create index if not exists claims_subscriber_id_idx on public.claims (subscriber_id);
create index if not exists claims_coverage_id_idx on public.claims (coverage_id);
create index if not exists claims_billing_provider_id_idx on public.claims (billing_provider_id);
create unique index if not exists claims_org_sim_id_idx on public.claims (organization_id, sim_claim_id) where deleted_at is null;

alter table public.claims enable row level security;

revoke all on public.claims from authenticated, service_role;
grant select, insert, update on table public.claims to authenticated;
grant select, insert, update, delete on table public.claims to service_role;

create policy claims_read on public.claims for select
    to authenticated using (deleted_at is null and public.has_org_access(organization_id));

create policy claims_insert on public.claims for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.create_edit'));

-- RBAC enforcement for approval, at the RLS layer (not just the UI): two
-- permissive UPDATE policies. A caller with only claims.create_edit
-- (e.g. claims_specialist) can write any status EXCEPT 'approved'; only a
-- caller with claims.approve_submit can write status = 'approved'. Postgres
-- combines multiple permissive policies' WITH CHECK clauses with OR, so a
-- claims_specialist trying to set status='approved' fails both checks and
-- the update silently affects 0 rows (same RLS-UPDATE-denial shape as
-- Phase 4's payers_update policy -- see docs/progress/DECISIONS.md).
create policy claims_update_edit on public.claims for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.create_edit') and status <> 'approved');

create policy claims_update_approve on public.claims for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.approve_submit'));

-- Cross-org data-integrity guard, reusing the Phase 3 pattern: RLS alone
-- stops you *reading* another org's row, not from creating a claim in your
-- own org whose FKs point at someone else's patient/subscriber/coverage/
-- provider/batch.
create or replace function kit.check_claim_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    patient_org    uuid;
    sub_org        uuid;
    sub_patient    uuid;
    cov_org        uuid;
    cov_subscriber uuid;
    cov_patient    uuid;
    provider_org   uuid;
    batch_org      uuid;
begin
    select organization_id into patient_org from public.patients where id = new.patient_id;

    if patient_org is null then
        raise exception 'Referenced patient does not exist';
    end if;

    if patient_org <> new.organization_id then
        raise exception 'claim.organization_id must match the referenced patient''s organization';
    end if;

    select organization_id, patient_id into sub_org, sub_patient from public.subscribers where id = new.subscriber_id;

    if sub_org is null then
        raise exception 'Referenced subscriber does not exist';
    end if;

    if sub_org <> new.organization_id then
        raise exception 'claim.organization_id must match the referenced subscriber''s organization';
    end if;

    if sub_patient <> new.patient_id then
        raise exception 'claim.patient_id must match the referenced subscriber''s patient';
    end if;

    select organization_id, subscriber_id, patient_id into cov_org, cov_subscriber, cov_patient
    from public.coverages
    where id = new.coverage_id;

    if cov_org is null then
        raise exception 'Referenced coverage does not exist';
    end if;

    if cov_org <> new.organization_id then
        raise exception 'claim.organization_id must match the referenced coverage''s organization';
    end if;

    if cov_subscriber <> new.subscriber_id or cov_patient <> new.patient_id then
        raise exception 'claim.coverage_id must match the referenced subscriber and patient';
    end if;

    select organization_id into provider_org from public.providers where id = new.billing_provider_id;

    if provider_org is null then
        raise exception 'Referenced billing provider does not exist';
    end if;

    if provider_org <> new.organization_id then
        raise exception 'claim.organization_id must match the referenced billing provider''s organization';
    end if;

    if new.batch_id is not null then
        select organization_id into batch_org from public.claim_batches where id = new.batch_id;

        if batch_org is null then
            raise exception 'Referenced claim batch does not exist';
        end if;

        if batch_org <> new.organization_id then
            raise exception 'claim.organization_id must match the referenced batch''s organization';
        end if;
    end if;

    return new;
end;
$$;

create trigger claims_check_org_consistency
    before insert or update
    on public.claims
    for each row
execute function kit.check_claim_org_consistency();

/*
 * -------------------------------------------------------
 * Section: professional_claim_details / institutional_claim_details
 * 1:1 with claims (claim_id is the PK). No deleted_at -- these live and
 * die with their parent claim, not soft-deleted independently.
 * -------------------------------------------------------
 */
create table if not exists
    public.professional_claim_details
(
    claim_id               uuid primary key references public.claims (id) on delete cascade,
    organization_id        uuid not null references public.organizations (id) on delete cascade,
    rendering_provider_id  uuid not null references public.providers (id),
    created_at             timestamp with time zone default now(),
    created_by             uuid references auth.users,
    updated_at             timestamp with time zone,
    updated_by             uuid references auth.users
);

comment on table public.professional_claim_details is '837P subset: rendering provider only. Diagnoses/lines live in claim_diagnoses/claim_lines.';

alter table public.professional_claim_details enable row level security;

revoke all on public.professional_claim_details from authenticated, service_role;
grant select, insert, update on table public.professional_claim_details to authenticated;
grant select, insert, update, delete on table public.professional_claim_details to service_role;

create policy professional_claim_details_read on public.professional_claim_details for select
    to authenticated using (public.has_org_access(organization_id));

create policy professional_claim_details_insert on public.professional_claim_details for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.create_edit'));

create policy professional_claim_details_update on public.professional_claim_details for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.create_edit'));

create table if not exists
    public.institutional_claim_details
(
    claim_id        uuid primary key references public.claims (id) on delete cascade,
    organization_id uuid        not null references public.organizations (id) on delete cascade,
    facility_id     uuid        not null references public.facilities (id),
    type_of_bill    varchar(4)  not null check (type_of_bill ~ '^[0-9]{3,4}$'),
    admission_date  date,
    discharge_date  date,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users,
    updated_at      timestamp with time zone,
    updated_by      uuid references auth.users
);

comment on table public.institutional_claim_details is '837I subset: facility, type-of-bill, admission/discharge. Occurrence/value/condition codes are deliberately unsupported -- see docs/05-claim-lifecycle.md.';

alter table public.institutional_claim_details enable row level security;

revoke all on public.institutional_claim_details from authenticated, service_role;
grant select, insert, update on table public.institutional_claim_details to authenticated;
grant select, insert, update, delete on table public.institutional_claim_details to service_role;

create policy institutional_claim_details_read on public.institutional_claim_details for select
    to authenticated using (public.has_org_access(organization_id));

create policy institutional_claim_details_insert on public.institutional_claim_details for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.create_edit'));

create policy institutional_claim_details_update on public.institutional_claim_details for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.create_edit'));

-- Generic cross-org guard, reused across every simple claim-child table
-- below: the child's organization_id must match its parent claim's.
create or replace function kit.check_claim_child_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    claim_org uuid;
begin
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

create trigger professional_claim_details_check_org
    before insert or update
    on public.professional_claim_details
    for each row
execute function kit.check_claim_child_org_consistency();

create trigger institutional_claim_details_check_org
    before insert or update
    on public.institutional_claim_details
    for each row
execute function kit.check_claim_child_org_consistency();

-- Narrower guards: the rendering provider / facility must belong to the
-- same org, AND the detail row's claim_type must actually match (a
-- professional_claim_details row can't attach to an institutional claim).
create or replace function kit.check_professional_details_provider_org()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    provider_org   uuid;
    claim_type_val varchar;
begin
    select organization_id into provider_org from public.providers where id = new.rendering_provider_id;

    if provider_org is null then
        raise exception 'Referenced rendering provider does not exist';
    end if;

    if provider_org <> new.organization_id then
        raise exception 'professional_claim_details.organization_id must match the referenced rendering provider''s organization';
    end if;

    select claim_type into claim_type_val from public.claims where id = new.claim_id;

    if claim_type_val is distinct from 'professional' then
        raise exception 'professional_claim_details.claim_id must reference a claim with claim_type = professional';
    end if;

    return new;
end;
$$;

create trigger professional_claim_details_check_provider_org
    before insert or update
    on public.professional_claim_details
    for each row
execute function kit.check_professional_details_provider_org();

create or replace function kit.check_institutional_details_facility_org()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    fac_org        uuid;
    claim_type_val varchar;
begin
    select organization_id into fac_org from public.facilities where id = new.facility_id;

    if fac_org is null then
        raise exception 'Referenced facility does not exist';
    end if;

    if fac_org <> new.organization_id then
        raise exception 'institutional_claim_details.organization_id must match the referenced facility''s organization';
    end if;

    select claim_type into claim_type_val from public.claims where id = new.claim_id;

    if claim_type_val is distinct from 'institutional' then
        raise exception 'institutional_claim_details.claim_id must reference a claim with claim_type = institutional';
    end if;

    return new;
end;
$$;

create trigger institutional_claim_details_check_facility_org
    before insert or update
    on public.institutional_claim_details
    for each row
execute function kit.check_institutional_details_facility_org();

/*
 * -------------------------------------------------------
 * Section: claim_diagnoses / claim_lines
 * Freely editable while a claim is being drafted -- hard delete allowed
 * (they're line items, not independently-lifecycled entities).
 * -------------------------------------------------------
 */
create table if not exists
    public.claim_diagnoses
(
    id                uuid primary key default extensions.uuid_generate_v4(),
    organization_id   uuid        not null references public.organizations (id) on delete cascade,
    claim_id          uuid        not null references public.claims (id) on delete cascade,
    diagnosis_code    varchar(10) not null,
    diagnosis_pointer smallint    not null check (diagnosis_pointer between 1 and 12),
    is_primary        boolean     not null default false,
    created_at        timestamp with time zone default now(),
    created_by        uuid references auth.users,
    unique (claim_id, diagnosis_pointer)
);

comment on table public.claim_diagnoses is 'ICD-10-CM diagnosis pointers for a claim. diagnosis_code values are drawn from a small synthetic reference list (packages/features/claims/src/lib/synthetic-codes.ts), not a full licensed code set.';

create index if not exists claim_diagnoses_claim_id_idx on public.claim_diagnoses (claim_id);

alter table public.claim_diagnoses enable row level security;

revoke all on public.claim_diagnoses from authenticated, service_role;
grant select, insert, update, delete on table public.claim_diagnoses to authenticated;
grant select, insert, update, delete on table public.claim_diagnoses to service_role;

create policy claim_diagnoses_read on public.claim_diagnoses for select
    to authenticated using (public.has_org_access(organization_id));

create policy claim_diagnoses_insert on public.claim_diagnoses for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.create_edit'));

create policy claim_diagnoses_update on public.claim_diagnoses for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.create_edit'));

create policy claim_diagnoses_delete on public.claim_diagnoses for delete
    to authenticated using (public.has_permission(organization_id, 'claims.create_edit'));

create trigger claim_diagnoses_check_org
    before insert or update
    on public.claim_diagnoses
    for each row
execute function kit.check_claim_child_org_consistency();

create table if not exists
    public.claim_lines
(
    id                  uuid primary key default extensions.uuid_generate_v4(),
    organization_id     uuid         not null references public.organizations (id) on delete cascade,
    claim_id            uuid         not null references public.claims (id) on delete cascade,
    line_number         smallint     not null,
    service_date        date         not null,
    procedure_code      varchar(10),
    revenue_code        varchar(4),
    modifiers           text[],
    units               smallint     not null default 1 check (units > 0),
    charge_amount       numeric(10, 2) not null check (charge_amount >= 0),
    place_of_service    varchar(2),
    diagnosis_pointers  smallint[]   not null default '{}',
    created_at          timestamp with time zone default now(),
    created_by          uuid references auth.users,
    updated_at          timestamp with time zone,
    updated_by          uuid references auth.users,
    unique (claim_id, line_number),
    constraint claim_lines_code_present check (procedure_code is not null or revenue_code is not null)
);

comment on table public.claim_lines is 'Service lines (CPT/HCPCS for professional, revenue code +/- HCPCS for institutional). Codes are drawn from a small synthetic reference list, not a full licensed code set. Which of procedure_code/revenue_code is required for a given claim_type is enforced at the application layer (Zod), not the DB, since that depends on the parent claim''s claim_type.';

create index if not exists claim_lines_claim_id_idx on public.claim_lines (claim_id);

alter table public.claim_lines enable row level security;

revoke all on public.claim_lines from authenticated, service_role;
grant select, insert, update, delete on table public.claim_lines to authenticated;
grant select, insert, update, delete on table public.claim_lines to service_role;

create policy claim_lines_read on public.claim_lines for select
    to authenticated using (public.has_org_access(organization_id));

create policy claim_lines_insert on public.claim_lines for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.create_edit'));

create policy claim_lines_update on public.claim_lines for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.create_edit'));

create policy claim_lines_delete on public.claim_lines for delete
    to authenticated using (public.has_permission(organization_id, 'claims.create_edit'));

create trigger claim_lines_check_org
    before insert or update
    on public.claim_lines
    for each row
execute function kit.check_claim_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: claim_documents, claim_relationships
 * Schema + RLS only this phase -- no dedicated UI. Real document storage
 * is Phase 8; correction/resubmission workflow is later.
 * -------------------------------------------------------
 */
create table if not exists
    public.claim_documents
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid         not null references public.organizations (id) on delete cascade,
    claim_id        uuid         not null references public.claims (id) on delete cascade,
    document_name   varchar(255) not null,
    document_type   varchar(50),
    notes           text,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users
);

comment on table public.claim_documents is 'Document metadata references for a claim. No file storage wired yet -- Phase 8 adds real document upload/download.';

create index if not exists claim_documents_claim_id_idx on public.claim_documents (claim_id);

alter table public.claim_documents enable row level security;

revoke all on public.claim_documents from authenticated, service_role;
grant select, insert, update, delete on table public.claim_documents to authenticated;
grant select, insert, update, delete on table public.claim_documents to service_role;

create policy claim_documents_read on public.claim_documents for select
    to authenticated using (public.has_org_access(organization_id));

create policy claim_documents_insert on public.claim_documents for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.create_edit'));

create policy claim_documents_delete on public.claim_documents for delete
    to authenticated using (public.has_permission(organization_id, 'claims.create_edit'));

create trigger claim_documents_check_org
    before insert or update
    on public.claim_documents
    for each row
execute function kit.check_claim_child_org_consistency();

create table if not exists
    public.claim_relationships
(
    id                uuid primary key default extensions.uuid_generate_v4(),
    organization_id   uuid        not null references public.organizations (id) on delete cascade,
    claim_id          uuid        not null references public.claims (id) on delete cascade,
    related_claim_id  uuid        not null references public.claims (id) on delete cascade,
    relationship_type varchar(20) not null check (relationship_type in ('original', 'corrected', 'resubmission', 'reversal')),
    created_at        timestamp with time zone default now(),
    created_by        uuid references auth.users,
    unique (claim_id, related_claim_id),
    constraint claim_relationships_no_self_reference check (claim_id <> related_claim_id)
);

comment on table public.claim_relationships is 'Links a claim to a related claim (correction/resubmission/reversal). No UI yet -- the correct/resubmit workflow is later phase scope.';

create index if not exists claim_relationships_claim_id_idx on public.claim_relationships (claim_id);
create index if not exists claim_relationships_related_claim_id_idx on public.claim_relationships (related_claim_id);

alter table public.claim_relationships enable row level security;

revoke all on public.claim_relationships from authenticated, service_role;
grant select, insert on table public.claim_relationships to authenticated;
grant select, insert, update, delete on table public.claim_relationships to service_role;

create policy claim_relationships_read on public.claim_relationships for select
    to authenticated using (public.has_org_access(organization_id));

create policy claim_relationships_insert on public.claim_relationships for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.correct_resubmit'));

create or replace function kit.check_claim_relationships_org()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    claim_org   uuid;
    related_org uuid;
begin
    select organization_id into claim_org from public.claims where id = new.claim_id;

    if claim_org is null then
        raise exception 'Referenced claim does not exist';
    end if;

    if claim_org <> new.organization_id then
        raise exception 'claim_relationships.organization_id must match the referenced claim''s organization';
    end if;

    select organization_id into related_org from public.claims where id = new.related_claim_id;

    if related_org is null then
        raise exception 'Referenced related claim does not exist';
    end if;

    if related_org <> new.organization_id then
        raise exception 'claim_relationships.organization_id must match the referenced related claim''s organization';
    end if;

    return new;
end;
$$;

create trigger claim_relationships_check_org
    before insert or update
    on public.claim_relationships
    for each row
execute function kit.check_claim_relationships_org();

/*
 * -------------------------------------------------------
 * Section: create_professional_claim / create_institutional_claim RPCs
 * Atomically insert the claims header + its 1:1 detail row in one
 * transaction. Deliberately SECURITY INVOKER (the default, no "security
 * definer" here) -- unlike Phase 2's create_organization/accept_invitation,
 * there is no bootstrap problem: the caller already has org access and
 * claims.create_edit by the time this is called, so both inserts run
 * under the caller's own RLS with no privilege escalation.
 * -------------------------------------------------------
 */
create or replace function public.create_professional_claim(
    p_organization_id uuid,
    p_patient_id uuid,
    p_subscriber_id uuid,
    p_coverage_id uuid,
    p_billing_provider_id uuid,
    p_rendering_provider_id uuid,
    p_notes text default null
)
    returns public.claims
    language plpgsql
    set search_path = ''
as
$$
declare
    new_claim public.claims;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    insert into public.claims (
        organization_id, claim_type, patient_id, subscriber_id, coverage_id,
        billing_provider_id, notes, created_by, updated_by
    )
    values (
        p_organization_id, 'professional', p_patient_id, p_subscriber_id, p_coverage_id,
        p_billing_provider_id, p_notes, auth.uid(), auth.uid()
    )
    returning * into new_claim;

    insert into public.professional_claim_details (
        claim_id, organization_id, rendering_provider_id, created_by, updated_by
    )
    values (
        new_claim.id, p_organization_id, p_rendering_provider_id, auth.uid(), auth.uid()
    );

    return new_claim;
end;
$$;

comment on function public.create_professional_claim(uuid, uuid, uuid, uuid, uuid, uuid, text) is 'Atomically creates a claims row (claim_type=professional) and its professional_claim_details row, entirely under the caller''s own RLS.';

revoke all on function public.create_professional_claim(uuid, uuid, uuid, uuid, uuid, uuid, text) from public;
grant execute on function public.create_professional_claim(uuid, uuid, uuid, uuid, uuid, uuid, text) to authenticated;

create or replace function public.create_institutional_claim(
    p_organization_id uuid,
    p_patient_id uuid,
    p_subscriber_id uuid,
    p_coverage_id uuid,
    p_billing_provider_id uuid,
    p_facility_id uuid,
    p_type_of_bill varchar,
    p_admission_date date default null,
    p_discharge_date date default null,
    p_notes text default null
)
    returns public.claims
    language plpgsql
    set search_path = ''
as
$$
declare
    new_claim public.claims;
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;

    insert into public.claims (
        organization_id, claim_type, patient_id, subscriber_id, coverage_id,
        billing_provider_id, notes, created_by, updated_by
    )
    values (
        p_organization_id, 'institutional', p_patient_id, p_subscriber_id, p_coverage_id,
        p_billing_provider_id, p_notes, auth.uid(), auth.uid()
    )
    returning * into new_claim;

    insert into public.institutional_claim_details (
        claim_id, organization_id, facility_id, type_of_bill, admission_date, discharge_date, created_by, updated_by
    )
    values (
        new_claim.id, p_organization_id, p_facility_id, p_type_of_bill, p_admission_date, p_discharge_date, auth.uid(), auth.uid()
    );

    return new_claim;
end;
$$;

comment on function public.create_institutional_claim(uuid, uuid, uuid, uuid, uuid, uuid, varchar, date, date, text) is 'Atomically creates a claims row (claim_type=institutional) and its institutional_claim_details row, entirely under the caller''s own RLS.';

revoke all on function public.create_institutional_claim(uuid, uuid, uuid, uuid, uuid, uuid, varchar, date, date, text) from public;
grant execute on function public.create_institutional_claim(uuid, uuid, uuid, uuid, uuid, uuid, varchar, date, date, text) to authenticated;
