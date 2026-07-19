/*
 * -------------------------------------------------------
 * Phase 7 — Adjudication simulator, remittances & reconciliation
 * Deterministic, rule-driven adjudication: the outcome is a function of
 * the claim's actual payer (via coverage.payer_id) and that payer's
 * payer_test_profiles.default_outcome + denial_rule_code -- never a
 * per-claim-ID branch. Both paid AND denied claims get a remittances +
 * remit_claims row (a real 835 carries $0-paid, CARC-coded denials too);
 * only paid claims get eft_traces. payment_matches is written only by a
 * separate, explicit "Match EFT" action -- never automatically.
 *
 * CARC/RARC codes here are SIM- prefixed with my own plain-English
 * simulated explanations -- they do NOT assert official X12 CARC/RARC
 * code meanings (see CLAUDE.md's guardrail against fabricating
 * authoritative code-set content).
 *
 * A denial is post-adjudication; it is never recorded as a rejection.
 * Every table is org-owned (tenancy contract), gated on
 * has_permission('remittances.view') for read and
 * has_permission('claims.approve_submit') for write (adjudication
 * continues the same claim lifecycle Submit/Approve already gate) --
 * except payment_matches, gated on has_permission('remittances.post_payment')
 * for write, since reconciliation is a distinct financial-ops action
 * (this is what gives the remittance_specialist role, seeded in Phase 2
 * with exactly this permission and otherwise unused until now, real work
 * to do).
 * -------------------------------------------------------
 */

/*
 * -------------------------------------------------------
 * Section: wire the Phase 4 seed data together for real use
 * -------------------------------------------------------
 */
update public.payer_test_profiles pt
set denial_rule_code = 'SIM-RULE-ADJ-' || p.sim_payer_id
from public.payers p
where pt.payer_id = p.id
  and pt.default_outcome = 'denied'
  and p.sim_payer_id in ('SIM-RBH-001', 'SIM-MDMCO-001');

/*
 * -------------------------------------------------------
 * Section: extend claims.status for paid/denied
 * -------------------------------------------------------
 */
drop policy if exists claims_update_edit on public.claims;
drop policy if exists claims_update_approve on public.claims;

alter table public.claims
    drop constraint if exists claims_status_check;

alter table public.claims
    add constraint claims_status_check check (
        status in (
                   'draft', 'validation_failed', 'validated', 'approved',
                   'submitted', 'accepted_for_adjudication', 'paid', 'denied'
            )
        );

create policy claims_update_edit on public.claims for update
    to authenticated using (public.has_org_access(organization_id))
    with check (public.has_permission(organization_id, 'claims.create_edit') and status <> 'approved');

create policy claims_update_approve on public.claims for update
    to authenticated using (public.has_org_access(organization_id))
    with check (
        public.has_permission(organization_id, 'claims.approve_submit')
            and status in (
                           'approved', 'submitted', 'accepted_for_adjudication',
                           'validation_failed', 'paid', 'denied'
                )
        );

/*
 * -------------------------------------------------------
 * Section: remittances
 * The 835 container. One per claim in this MVP (a real 835 batches many
 * claims; this simulator adjudicates one claim at a time, same
 * simplification Phase 6 made for edi_transactions). claim_id UNIQUE is
 * the idempotency guard against double-adjudication.
 * -------------------------------------------------------
 */
create table if not exists
    public.remittances
(
    id                 uuid primary key default extensions.uuid_generate_v4(),
    organization_id    uuid         not null references public.organizations (id) on delete cascade,
    claim_id           uuid         not null unique references public.claims (id) on delete cascade,
    payer_id           uuid references public.payers (id),
    sim_remittance_id  varchar(32)  not null default ('SIM-ERA-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    isa13              varchar(9)   not null,
    gs06               varchar(9)   not null,
    st02               varchar(9)   not null,
    raw_835_payload    text         not null,
    payload_hash       varchar(64)  not null,
    total_paid_amount  numeric(10, 2) not null default 0,
    outcome            varchar(10)  not null check (outcome in ('paid', 'denied')),
    status             varchar(20)  not null check (status in ('paid', 'denied', 'eft_matched', 'posted')),
    created_at         timestamp with time zone default now(),
    created_by         uuid references auth.users,
    updated_at         timestamp with time zone,
    updated_by         uuid references auth.users
);

comment on table public.remittances is 'Simulated 835 remittance advice, one per claim. Simulation only -- synthetic control numbers, not a real interchange. A denied remittance carries a $0 payment and a CARC-coded reason; it is never labeled a rejection.';

create index if not exists remittances_org_id_idx on public.remittances (organization_id, created_at);

alter table public.remittances enable row level security;

revoke all on public.remittances from authenticated, service_role;
grant select, insert, update on table public.remittances to authenticated;
grant select, insert, update, delete on table public.remittances to service_role;

create policy remittances_read on public.remittances for select
    to authenticated using (public.has_permission(organization_id, 'remittances.view'));

create policy remittances_insert on public.remittances for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

create policy remittances_update on public.remittances for update
    to authenticated using (public.has_permission(organization_id, 'remittances.view'))
    with check (public.has_permission(organization_id, 'remittances.post_payment'));

create trigger remittances_check_org
    before insert or update
    on public.remittances
    for each row
execute function kit.check_claim_child_org_consistency();

/*
 * -------------------------------------------------------
 * Section: remit_claims / remit_service_lines
 * Per-claim and per-line breakdown within a remittance. 1:1 with
 * remittances in this MVP (remittance_id UNIQUE) but modeled as proper
 * child tables matching the target ERD, so a later phase that batches
 * multiple claims per 835 doesn't need a schema change.
 * -------------------------------------------------------
 */
create table if not exists
    public.remit_claims
(
    id                    uuid primary key default extensions.uuid_generate_v4(),
    organization_id       uuid not null references public.organizations (id) on delete cascade,
    remittance_id         uuid not null unique references public.remittances (id) on delete cascade,
    claim_id              uuid not null references public.claims (id) on delete cascade,
    charge_amount         numeric(10, 2) not null,
    paid_amount           numeric(10, 2) not null default 0,
    patient_responsibility numeric(10, 2) not null default 0,
    created_at            timestamp with time zone default now(),
    created_by            uuid references auth.users
);

create index if not exists remit_claims_claim_id_idx on public.remit_claims (claim_id);

alter table public.remit_claims enable row level security;

revoke all on public.remit_claims from authenticated, service_role;
grant select, insert on table public.remit_claims to authenticated;
grant select, insert, update, delete on table public.remit_claims to service_role;

create policy remit_claims_read on public.remit_claims for select
    to authenticated using (public.has_permission(organization_id, 'remittances.view'));

create policy remit_claims_insert on public.remit_claims for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

-- remit_claims has TWO parent references (claim_id and remittance_id) --
-- both need their own org-consistency check.
create trigger remit_claims_check_claim_org
    before insert or update
    on public.remit_claims
    for each row
execute function kit.check_claim_child_org_consistency();

create table if not exists
    public.remit_service_lines
(
    id             uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    remit_claim_id uuid not null references public.remit_claims (id) on delete cascade,
    claim_line_id  uuid references public.claim_lines (id) on delete set null,
    charge_amount  numeric(10, 2) not null,
    paid_amount    numeric(10, 2) not null default 0,
    created_at     timestamp with time zone default now(),
    created_by     uuid references auth.users
);

create index if not exists remit_service_lines_remit_claim_id_idx on public.remit_service_lines (remit_claim_id);

alter table public.remit_service_lines enable row level security;

revoke all on public.remit_service_lines from authenticated, service_role;
grant select, insert on table public.remit_service_lines to authenticated;
grant select, insert, update, delete on table public.remit_service_lines to service_role;

create policy remit_service_lines_read on public.remit_service_lines for select
    to authenticated using (public.has_permission(organization_id, 'remittances.view'));

create policy remit_service_lines_insert on public.remit_service_lines for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

/*
 * -------------------------------------------------------
 * Section: claim_adjustments
 * CARC/RARC-style adjustment detail. For a paid claim: the simulated
 * contractual adjustment. For a denied claim: the full charge as a
 * denial adjustment, with rule_id pointing at the triggering payer_rules
 * row so the trace can show exactly which rule produced the denial.
 * -------------------------------------------------------
 */
create table if not exists
    public.claim_adjustments
(
    id               uuid primary key default extensions.uuid_generate_v4(),
    organization_id  uuid        not null references public.organizations (id) on delete cascade,
    remit_claim_id   uuid        not null references public.remit_claims (id) on delete cascade,
    adjustment_group varchar(5)  not null check (adjustment_group in ('CO', 'PR', 'OA', 'PI')),
    carc_code        varchar(20) not null,
    rarc_code        varchar(20),
    amount           numeric(10, 2) not null,
    explanation      text        not null,
    rule_id          uuid references public.payer_rules (id),
    created_at       timestamp with time zone default now(),
    created_by       uuid references auth.users
);

comment on table public.claim_adjustments is 'carc_code/rarc_code are SIM- prefixed simulated codes with my own plain-English explanations -- not asserted official X12 CARC/RARC meanings. adjustment_group uses the basic X12 CAS group categories (CO/PR/OA/PI), which are structural, not the detailed proprietary code lists.';

create index if not exists claim_adjustments_remit_claim_id_idx on public.claim_adjustments (remit_claim_id);

alter table public.claim_adjustments enable row level security;

revoke all on public.claim_adjustments from authenticated, service_role;
grant select, insert on table public.claim_adjustments to authenticated;
grant select, insert, update, delete on table public.claim_adjustments to service_role;

create policy claim_adjustments_read on public.claim_adjustments for select
    to authenticated using (public.has_permission(organization_id, 'remittances.view'));

create policy claim_adjustments_insert on public.claim_adjustments for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

/*
 * -------------------------------------------------------
 * Section: eft_traces / payment_matches
 * eft_traces (paid only) is written as part of adjudication -- the
 * simulated bank deposit. payment_matches is written ONLY by a separate,
 * explicit "Match EFT" action (POST /remittances/{id}/match-eft) -- never
 * automatically -- matching the real-world reconciliation step where
 * accounting staff confirm a deposit matches an expected remittance.
 * eft_trace_id UNIQUE is the idempotency guard against double-matching.
 * -------------------------------------------------------
 */
create table if not exists
    public.eft_traces
(
    id               uuid primary key default extensions.uuid_generate_v4(),
    organization_id  uuid        not null references public.organizations (id) on delete cascade,
    remittance_id    uuid        not null unique references public.remittances (id) on delete cascade,
    eft_trace_number varchar(32) not null default ('SIM-EFT-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 8))),
    amount           numeric(10, 2) not null,
    effective_date   date        not null default current_date,
    created_at       timestamp with time zone default now(),
    created_by       uuid references auth.users
);

comment on table public.eft_traces is 'Simulated bank EFT deposit for a paid claim''s remittance. Never created for a denied claim.';

alter table public.eft_traces enable row level security;

revoke all on public.eft_traces from authenticated, service_role;
grant select, insert on table public.eft_traces to authenticated;
grant select, insert, update, delete on table public.eft_traces to service_role;

create policy eft_traces_read on public.eft_traces for select
    to authenticated using (public.has_permission(organization_id, 'remittances.view'));

create policy eft_traces_insert on public.eft_traces for insert
    to authenticated with check (public.has_permission(organization_id, 'claims.approve_submit'));

create table if not exists
    public.payment_matches
(
    id              uuid primary key default extensions.uuid_generate_v4(),
    organization_id uuid           not null references public.organizations (id) on delete cascade,
    eft_trace_id    uuid           not null unique references public.eft_traces (id) on delete cascade,
    remittance_id   uuid           not null references public.remittances (id) on delete cascade,
    matched_amount  numeric(10, 2) not null,
    matched_at      timestamp with time zone default now(),
    created_by      uuid references auth.users
);

comment on table public.payment_matches is 'Written only by the explicit Match EFT reconciliation action -- never automatically during adjudication.';

alter table public.payment_matches enable row level security;

revoke all on public.payment_matches from authenticated, service_role;
grant select, insert on table public.payment_matches to authenticated;
grant select, insert, update, delete on table public.payment_matches to service_role;

create policy payment_matches_read on public.payment_matches for select
    to authenticated using (public.has_permission(organization_id, 'remittances.view'));

create policy payment_matches_insert on public.payment_matches for insert
    to authenticated with check (public.has_permission(organization_id, 'remittances.post_payment'));

-- Generic cross-org guard for the two remittance_id-keyed tables (mirrors
-- kit.check_edi_transaction_child_org_consistency from Phase 6).
create or replace function kit.check_remittance_child_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    remit_org uuid;
begin
    select organization_id into remit_org from public.remittances where id = new.remittance_id;

    if remit_org is null then
        raise exception 'Referenced remittance does not exist';
    end if;

    if remit_org <> new.organization_id then
        raise exception 'organization_id must match the referenced remittance''s organization';
    end if;

    return new;
end;
$$;

create trigger eft_traces_check_org
    before insert or update
    on public.eft_traces
    for each row
execute function kit.check_remittance_child_org_consistency();

create trigger payment_matches_check_org
    before insert or update
    on public.payment_matches
    for each row
execute function kit.check_remittance_child_org_consistency();

-- remit_claims' second parent reference (remittance_id) -- the
-- claim_id-based check above doesn't catch a remittance_id pointing at
-- a different org's remittance.
create trigger remit_claims_check_remittance_org
    before insert or update
    on public.remit_claims
    for each row
execute function kit.check_remittance_child_org_consistency();

-- remit_service_lines and claim_adjustments are keyed on remit_claim_id,
-- not claim_id or remittance_id directly -- a third small guard.
create or replace function kit.check_remit_claim_child_org_consistency()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$$
declare
    remit_claim_org uuid;
begin
    select organization_id into remit_claim_org from public.remit_claims where id = new.remit_claim_id;

    if remit_claim_org is null then
        raise exception 'Referenced remit_claim does not exist';
    end if;

    if remit_claim_org <> new.organization_id then
        raise exception 'organization_id must match the referenced remit_claim''s organization';
    end if;

    return new;
end;
$$;

create trigger remit_service_lines_check_org
    before insert or update
    on public.remit_service_lines
    for each row
execute function kit.check_remit_claim_child_org_consistency();

create trigger claim_adjustments_check_org
    before insert or update
    on public.claim_adjustments
    for each row
execute function kit.check_remit_claim_child_org_consistency();
