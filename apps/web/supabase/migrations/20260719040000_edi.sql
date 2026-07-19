/*
 * -------------------------------------------------------
 * Phase 6 — EDI processor & trace graph
 * Scoped, synthetic X12 generation + an immutable transaction-event trace.
 * Every table here is org-owned (tenancy contract), gated on
 * has_org_access() for read and has_permission('claims.approve_submit')
 * for write (system-generated rows -- not user-editable forms, written
 * only by the submit pipeline in apps/worker). transaction_events is
 * append-only: INSERT policy only, no UPDATE/DELETE grant at all.
 *
 * claims.status gains exactly two new values this phase: 'submitted' and
 * 'accepted_for_adjudication'. The intermediate TA1/999/277CA checkpoints
 * are NOT separate claims.status values -- they're transaction_events/
 * acknowledgments rows, which is what those tables are for. See
 * docs/05-claim-lifecycle.md and docs/progress/DECISIONS.md.
 *
 * Simulation only -- synthetic X12-shaped payloads, clearly labeled as
 * simulated (see packages/features/edi/src/lib/synthetic-x12.ts), no real
 * payer connectivity, no claim of production X12 conformance. A rejection
 * (pre-adjudication: TA1/999/277CA) is never modeled as a denial
 * (post-adjudication: 835/CARC/RARC, Phase 7 scope).
 * -------------------------------------------------------
 */

/*
 * -------------------------------------------------------
 * Section: extend claims.status for submit/accepted-for-adjudication
 * -------------------------------------------------------
 */
-- 'accepted_for_adjudication' is 25 characters -- the Phase 5 column
-- (varchar(20)) is too narrow. Postgres won't ALTER COLUMN TYPE while a
-- policy references the column, so both claims_update_* policies (Phase
-- 5) must be dropped first and recreated after.
drop policy if exists claims_update_edit on public.claims;
drop policy if exists claims_update_approve on public.claims;

alter table public.claims
    alter column status type varchar(30);

alter table public.claims
    drop constraint if exists claims_status_check;

alter table public.claims
    add constraint claims_status_check check (
        status in (
                   'draft', 'validation_failed', 'validated', 'approved',
                   'submitted', 'accepted_for_adjudication'
            )
        );

create policy claims_update_edit on public.claims for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.create_edit') and status <> 'approved');

-- The claims.approve_submit permission gates both approving a claim AND
-- submitting it (same real-world role: whoever can approve can submit).
-- Extends the Phase 5 version of this policy to also permit the two new
-- statuses.
create policy claims_update_approve on public.claims for update
    to authenticated using (public.has_org_access(organization_id))
    with check (
        public.has_permission(organization_id, 'claims.approve_submit')
            and status in ('approved', 'submitted', 'accepted_for_adjudication', 'validation_failed')
        );

/*
 * -------------------------------------------------------
 * Section: processing_jobs
 * The idempotency anchor: exactly one row per claim, ever. A second
 * submit attempt for the same claim_id hits the unique constraint below
 * before any other write happens -- that single-statement uniqueness
 * check IS the idempotency guarantee, not a queue or lock.
 * -------------------------------------------------------
 */
create table if not exists
    public.processing_jobs
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid        not null references public.organizations (id) on delete cascade,
    claim_id        uuid        not null unique references public.claims (id) on delete cascade,
    idempotency_key varchar(255) not null,
    correlation_id  uuid        not null,
    status          varchar(20) not null default 'processing' check (status in ('processing', 'completed', 'failed')),
    result          jsonb,
    started_at      timestamp with time zone default now(),
    completed_at    timestamp with time zone,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users
);

comment on table public.processing_jobs is 'One row per claim submission attempt, ever (unique on claim_id). This uniqueness constraint is what makes submit idempotent -- a duplicate submit fails this insert before any EDI/trace row is written.';

create index if not exists processing_jobs_org_id_idx on public.processing_jobs (organization_id, created_at);

alter table public.processing_jobs enable row level security;

revoke all on public.processing_jobs from authenticated, service_role;
grant select, insert, update on table public.processing_jobs to authenticated;
grant select, insert, update, delete on table public.processing_jobs to service_role;

create policy processing_jobs_read on public.processing_jobs for select
    to authenticated using (public.has_org_access(organization_id));

create policy processing_jobs_insert on public.processing_jobs for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

create policy processing_jobs_update on public.processing_jobs for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.approve_submit'));

create trigger processing_jobs_check_org
    before insert or update
    on public.processing_jobs
    for each row
execute function kit.check_claim_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: edi_transactions / edi_payloads
 * One edi_transactions row per claim (unique on claim_id, matching
 * processing_jobs -- a claim generates exactly one outbound 837 in this
 * phase). edi_payloads stores the raw synthetic payload text + hash for
 * both the outbound 837 and every inbound ack (TA1/999/277CA).
 * -------------------------------------------------------
 */
create table if not exists
    public.edi_transactions
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid        not null references public.organizations (id) on delete cascade,
    claim_id        uuid        not null unique references public.claims (id) on delete cascade,
    batch_id        uuid references public.claim_batches (id),
    transaction_type varchar(10) not null check (transaction_type in ('837P', '837I')),
    isa13           varchar(9)  not null,
    gs06            varchar(9)  not null,
    st02            varchar(9)  not null,
    created_at      timestamp with time zone default now(),
    created_by      uuid references auth.users
);

comment on table public.edi_transactions is 'The outbound 837 transaction generated for a claim submission. Simulation only -- synthetic control numbers, not a real interchange.';

create index if not exists edi_transactions_org_id_idx on public.edi_transactions (organization_id, created_at);

alter table public.edi_transactions enable row level security;

revoke all on public.edi_transactions from authenticated, service_role;
grant select, insert on table public.edi_transactions to authenticated;
grant select, insert, update, delete on table public.edi_transactions to service_role;

create policy edi_transactions_read on public.edi_transactions for select
    to authenticated using (public.has_org_access(organization_id));

create policy edi_transactions_insert on public.edi_transactions for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

create trigger edi_transactions_check_org
    before insert or update
    on public.edi_transactions
    for each row
execute function kit.check_claim_child_org_consistency();

create table if not exists
    public.edi_payloads
(
    id                 uuid primary key default extensions.uuid_generate_v4(),
    organization_id    uuid        not null references public.organizations (id) on delete cascade,
    edi_transaction_id uuid        not null references public.edi_transactions (id) on delete cascade,
    direction          varchar(10) not null check (direction in ('outbound', 'inbound')),
    transaction_type   varchar(10) not null check (transaction_type in ('837P', '837I', 'TA1', '999', '277CA')),
    raw_payload        text        not null,
    payload_hash       varchar(64) not null,
    created_at         timestamp with time zone default now(),
    created_by         uuid references auth.users
);

comment on table public.edi_payloads is 'Raw synthetic X12-shaped payload text (outbound 837, inbound TA1/999/277CA) + its sha256 hash. Simulation only -- see packages/features/edi/src/lib/synthetic-x12.ts. Immutable in practice (no UPDATE policy granted, matching the append-only spirit of the trace even though not formally enforced the same way as transaction_events).';

create index if not exists edi_payloads_edi_transaction_id_idx on public.edi_payloads (edi_transaction_id);

alter table public.edi_payloads enable row level security;

revoke all on public.edi_payloads from authenticated, service_role;
grant select, insert on table public.edi_payloads to authenticated;
grant select, insert, update, delete on table public.edi_payloads to service_role;

create policy edi_payloads_read on public.edi_payloads for select
    to authenticated using (public.has_org_access(organization_id));

create policy edi_payloads_insert on public.edi_payloads for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

/*
 * -------------------------------------------------------
 * Section: acknowledgments
 * -------------------------------------------------------
 */
create table if not exists
    public.acknowledgments
(
    id                 uuid primary key default extensions.uuid_generate_v4(),
    organization_id    uuid        not null references public.organizations (id) on delete cascade,
    edi_transaction_id uuid        not null references public.edi_transactions (id) on delete cascade,
    ack_type           varchar(10) not null check (ack_type in ('TA1', '999', '277CA')),
    status             varchar(20) not null check (status in ('accepted', 'rejected')),
    code               varchar(20) not null,
    explanation        text        not null,
    isa13              varchar(9),
    gs06               varchar(9),
    st02               varchar(9),
    created_at         timestamp with time zone default now(),
    created_by         uuid references auth.users
);

comment on table public.acknowledgments is 'Simulated TA1 (interchange), 999 (functional), and 277CA (claim) acknowledgments for a submitted claim. Simulation only.';

create index if not exists acknowledgments_edi_transaction_id_idx on public.acknowledgments (edi_transaction_id);

alter table public.acknowledgments enable row level security;

revoke all on public.acknowledgments from authenticated, service_role;
grant select, insert on table public.acknowledgments to authenticated;
grant select, insert, update, delete on table public.acknowledgments to service_role;

create policy acknowledgments_read on public.acknowledgments for select
    to authenticated using (public.has_org_access(organization_id));

create policy acknowledgments_insert on public.acknowledgments for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

-- Generic cross-org guard for the two edi_transaction_id-keyed tables:
-- the child's organization_id must match its parent edi_transactions row.
create or replace function kit.check_edi_transaction_child_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    tx_org uuid;
begin
    select organization_id into tx_org from public.edi_transactions where id = new.edi_transaction_id;

    if tx_org is null then
        raise exception 'Referenced edi_transaction does not exist';
    end if;

    if tx_org <> new.organization_id then
        raise exception 'organization_id must match the referenced edi_transaction''s organization';
    end if;

    return new;
end;
$$;

create trigger edi_payloads_check_org
    before insert or update
    on public.edi_payloads
    for each row
execute function kit.check_edi_transaction_child_org_consistency();

create trigger acknowledgments_check_org
    before insert or update
    on public.acknowledgments
    for each row
execute function kit.check_edi_transaction_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: rule_evaluations
 * Every applicable rule's pass/fail outcome at submit time -- a fuller
 * audit trail than claims.last_validation_result (Phase 5), which only
 * ever stores failures from the interactive Validate button.
 * -------------------------------------------------------
 */
create table if not exists
    public.rule_evaluations
(
    id                 uuid primary key default extensions.uuid_generate_v4(),
    organization_id    uuid        not null references public.organizations (id) on delete cascade,
    claim_id           uuid        not null references public.claims (id) on delete cascade,
    processing_job_id  uuid references public.processing_jobs (id) on delete cascade,
    rule_code          varchar(64) not null,
    category           varchar(20),
    passed             boolean     not null,
    severity           varchar(20),
    rejection_or_denial varchar(20),
    explanation        text,
    created_at         timestamp with time zone default now(),
    created_by         uuid references auth.users
);

comment on table public.rule_evaluations is 'Every applicable universal/claim_type/payer_edit rule evaluated at submit time, pass or fail -- the full audit trail behind a submission''s accept/reject outcome.';

create index if not exists rule_evaluations_claim_id_idx on public.rule_evaluations (claim_id);

alter table public.rule_evaluations enable row level security;

revoke all on public.rule_evaluations from authenticated, service_role;
grant select, insert on table public.rule_evaluations to authenticated;
grant select, insert, update, delete on table public.rule_evaluations to service_role;

create policy rule_evaluations_read on public.rule_evaluations for select
    to authenticated using (public.has_org_access(organization_id));

create policy rule_evaluations_insert on public.rule_evaluations for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

create trigger rule_evaluations_check_org
    before insert or update
    on public.rule_evaluations
    for each row
execute function kit.check_claim_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: replay_attempts
 * Every submit attempt logs one row here, first or duplicate -- the
 * queryable proof that a duplicate submit was recognized and ignored.
 * -------------------------------------------------------
 */
create table if not exists
    public.replay_attempts
(
    id                uuid primary key default extensions.uuid_generate_v4(),
    organization_id   uuid        not null references public.organizations (id) on delete cascade,
    claim_id          uuid        not null references public.claims (id) on delete cascade,
    idempotency_key   varchar(255) not null,
    outcome           varchar(20) not null check (outcome in ('processed', 'duplicate_ignored')),
    processing_job_id uuid references public.processing_jobs (id) on delete cascade,
    attempted_at      timestamp with time zone default now(),
    attempted_by      uuid references auth.users
);

comment on table public.replay_attempts is 'One row per submit attempt (first or duplicate). outcome=duplicate_ignored + a processing_job_id pointing at the ORIGINAL job is the queryable proof idempotency held.';

create index if not exists replay_attempts_claim_id_idx on public.replay_attempts (claim_id);

alter table public.replay_attempts enable row level security;

revoke all on public.replay_attempts from authenticated, service_role;
grant select, insert on table public.replay_attempts to authenticated;
grant select, insert, update, delete on table public.replay_attempts to service_role;

create policy replay_attempts_read on public.replay_attempts for select
    to authenticated using (public.has_org_access(organization_id));

create policy replay_attempts_insert on public.replay_attempts for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

create trigger replay_attempts_check_org
    before insert or update
    on public.replay_attempts
    for each row
execute function kit.check_claim_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: transaction_events -- append-only
 * Every field from the architecture doc's "trace event fields (every
 * checkpoint)" list. INSERT policy only -- no UPDATE or DELETE grant to
 * authenticated at all, so an attempt at either fails with a permission
 * error (42501), not a silently-filtered RLS row. service_role keeps
 * update/delete for admin/ops correction of a genuinely bad row, which is
 * an operational escape hatch, not something the app ever does.
 * -------------------------------------------------------
 */
create table if not exists
    public.transaction_events
(
    id                    uuid primary key default extensions.uuid_generate_v4(),
    organization_id       uuid        not null references public.organizations (id) on delete cascade,
    claim_id              uuid        not null references public.claims (id) on delete cascade,
    batch_id              uuid references public.claim_batches (id),
    edi_transaction_id    uuid references public.edi_transactions (id) on delete cascade,
    event_name            varchar(100) not null,
    event_category        varchar(30) not null check (event_category in ('submission', 'acknowledgment', 'validation', 'state_transition')),
    occurred_at           timestamp with time zone not null default now(),
    actor_type            varchar(20) not null check (actor_type in ('user', 'system')),
    actor_id              uuid references auth.users,
    isa13                 varchar(9),
    gs06                  varchar(9),
    st02                  varchar(9),
    payer_id              uuid references public.payers (id),
    route                 varchar(255),
    request_payload_hash  varchar(64),
    response_payload_hash varchar(64),
    status                varchar(30) not null,
    code                  varchar(20),
    explanation           text        not null,
    rule_id               uuid references public.payer_rules (id),
    correlation_id        uuid        not null,
    previous_event_id     uuid references public.transaction_events (id),
    next_recommended_action text,
    created_at            timestamp with time zone default now(),
    created_by            uuid references auth.users
);

comment on table public.transaction_events is 'Append-only, immutable trace of every checkpoint in a claim''s EDI lifecycle. No UPDATE/DELETE grant to authenticated -- correcting history is not a feature. Simulation only. The hard rejection-vs-denial rule (see docs/05-claim-lifecycle.md) is enforced by never writing an adjudication-stage event here -- adjudication/denial is Phase 7.';

create index if not exists transaction_events_claim_id_idx on public.transaction_events (claim_id, occurred_at);
create index if not exists transaction_events_correlation_id_idx on public.transaction_events (correlation_id);

alter table public.transaction_events enable row level security;

revoke all on public.transaction_events from authenticated, service_role;
grant select, insert on table public.transaction_events to authenticated;
grant select, insert, update, delete on table public.transaction_events to service_role;

create policy transaction_events_read on public.transaction_events for select
    to authenticated using (public.has_org_access(organization_id));

create policy transaction_events_insert on public.transaction_events for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

create trigger transaction_events_check_org
    before insert or update
    on public.transaction_events
    for each row
execute function kit.check_claim_child_org_consistency();
