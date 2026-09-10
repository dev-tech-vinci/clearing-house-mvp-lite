/*
 * -------------------------------------------------------
 * Phase 4 — Payer directory & versioned rule admin
 * Payers and payer rules are GLOBAL reference data, not tenant-owned:
 * readable by any authenticated user, writable only by a
 * platform_super_admin (checked via public.is_platform_admin(), the first
 * real capability granted to that role since it was seeded in Phase 2).
 * This does NOT reopen the Phase 2 decision to give platform_super_admin
 * a cross-org bypass into tenant-owned data (organizations, patients,
 * providers, ...) -- is_platform_admin() is used only on the tables in
 * this migration. Simulation only -- SIM- prefixed payer IDs, ten clearly
 * simulated payer profiles, no real payer connectivity implied.
 * -------------------------------------------------------
 */

/*
 * -------------------------------------------------------
 * Section: is_platform_admin() helper
 * -------------------------------------------------------
 */
create or replace function public.is_platform_admin()
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
      and r.key = 'platform_super_admin'
);
$$;

comment on function public.is_platform_admin() is 'True if the caller holds the platform_super_admin role in any organization membership. Used only to gate writes on global reference data (payers, payer rules) -- grants no visibility into tenant-owned data.';

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

/*
 * -------------------------------------------------------
 * Section: payers
 * -------------------------------------------------------
 */
create table if not exists
    public.payers
(
    id                     uuid primary key default extensions.uuid_generate_v4(),
    sim_payer_id           varchar(32)  not null unique check (sim_payer_id like 'SIM-%'),
    display_name           varchar(255) not null,
    legal_name             varchar(255),
    category               varchar(30)  not null check (category in (
        'medicare_ffs', 'medicare_advantage', 'medicaid_ffs', 'medicaid_mco',
        'commercial_ppo', 'commercial_hmo', 'blue_plan', 'tricare', 'marketplace', 'regional_bh'
        )),
    line_of_business       varchar(100),
    scope                  varchar(20)  not null default 'national' check (scope in ('national', 'state', 'regional')),
    state                  varchar(2),
    public_program_id      varchar(64),
    clearinghouse_payer_id varchar(64),
    network_name           varchar(255),
    enrollment_required    boolean      not null default false,
    test_production        varchar(20)  not null default 'test' check (test_production in ('test', 'production')),
    effective_date         date,
    termination_date       date,
    is_active               boolean     not null default true,
    notes                  text,
    source                 text,
    last_verified_date     date,
    created_at             timestamp with time zone default now(),
    created_by             uuid references auth.users,
    updated_at             timestamp with time zone,
    updated_by             uuid references auth.users,
    deleted_at              timestamp with time zone
);

comment on table public.payers is 'Global, database-driven payer directory. Simulation only -- ten SIM- prefixed profiles, not real production payer routes. Not tenant-owned: readable by any authenticated user, writable only by platform_super_admin.';
comment on column public.payers.sim_payer_id is 'Obviously-synthetic payer identifier, always SIM- prefixed. Not a real clearinghouse payer ID.';

create index if not exists payers_category_idx on public.payers (category);
create index if not exists payers_is_active_idx on public.payers (is_active);

alter table public.payers enable row level security;

revoke all on public.payers from authenticated, service_role;
grant select, insert, update on table public.payers to authenticated;
grant select, insert, update, delete on table public.payers to service_role;

create policy payers_read on public.payers for select
    to authenticated using (deleted_at is null or public.is_platform_admin());

create policy payers_insert on public.payers for insert
    to authenticated with check (public.is_platform_admin());

create policy payers_update on public.payers for update
    to authenticated using (public.is_platform_admin())
    with check (public.is_platform_admin());

/*
 * -------------------------------------------------------
 * Section: payer_aliases, payer_routes, payer_supported_transactions
 * Simple child/detail records -- no individual soft-delete, admins can
 * remove and re-add freely.
 * -------------------------------------------------------
 */
create table if not exists
    public.payer_aliases
(
    id         uuid primary key default extensions.uuid_generate_v4(),
    payer_id   uuid         not null references public.payers (id) on delete cascade,
    alias      varchar(255) not null,
    created_at timestamp with time zone default now(),
    created_by uuid references auth.users
);

create index if not exists payer_aliases_payer_id_idx on public.payer_aliases (payer_id);

alter table public.payer_aliases enable row level security;

revoke all on public.payer_aliases from authenticated, service_role;
grant select, insert, update, delete on table public.payer_aliases to authenticated;
grant select, insert, update, delete on table public.payer_aliases to service_role;

create policy payer_aliases_read on public.payer_aliases for select to authenticated using (true);
create policy payer_aliases_write on public.payer_aliases for insert to authenticated with check (public.is_platform_admin());
create policy payer_aliases_update on public.payer_aliases for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy payer_aliases_delete on public.payer_aliases for delete to authenticated using (public.is_platform_admin());

create table if not exists
    public.payer_routes
(
    id         uuid primary key default extensions.uuid_generate_v4(),
    payer_id   uuid         not null references public.payers (id) on delete cascade,
    route_name varchar(255) not null,
    route_type varchar(50)  not null default 'clearinghouse' check (route_type in ('direct', 'clearinghouse', 'gateway')),
    is_active  boolean      not null default true,
    notes      text,
    created_at timestamp with time zone default now(),
    created_by uuid references auth.users,
    updated_at timestamp with time zone,
    updated_by uuid references auth.users
);

comment on table public.payer_routes is 'Simulated connectivity routes. Not real production routes.';

create index if not exists payer_routes_payer_id_idx on public.payer_routes (payer_id);

alter table public.payer_routes enable row level security;

revoke all on public.payer_routes from authenticated, service_role;
grant select, insert, update, delete on table public.payer_routes to authenticated;
grant select, insert, update, delete on table public.payer_routes to service_role;

create policy payer_routes_read on public.payer_routes for select to authenticated using (true);
create policy payer_routes_write on public.payer_routes for insert to authenticated with check (public.is_platform_admin());
create policy payer_routes_update on public.payer_routes for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy payer_routes_delete on public.payer_routes for delete to authenticated using (public.is_platform_admin());

create table if not exists
    public.payer_supported_transactions
(
    id               uuid primary key default extensions.uuid_generate_v4(),
    payer_id         uuid        not null references public.payers (id) on delete cascade,
    transaction_type varchar(10) not null check (transaction_type in ('837P', '837I', '835', '276', '277', '270', '271', '999', 'TA1', '277CA')),
    is_active        boolean     not null default true,
    created_at       timestamp with time zone default now(),
    created_by       uuid references auth.users,
    unique (payer_id, transaction_type)
);

create index if not exists payer_supported_transactions_payer_id_idx on public.payer_supported_transactions (payer_id);

alter table public.payer_supported_transactions enable row level security;

revoke all on public.payer_supported_transactions from authenticated, service_role;
grant select, insert, update, delete on table public.payer_supported_transactions to authenticated;
grant select, insert, update, delete on table public.payer_supported_transactions to service_role;

create policy payer_supported_transactions_read on public.payer_supported_transactions for select to authenticated using (true);
create policy payer_supported_transactions_write on public.payer_supported_transactions for insert to authenticated with check (public.is_platform_admin());
create policy payer_supported_transactions_update on public.payer_supported_transactions for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy payer_supported_transactions_delete on public.payer_supported_transactions for delete to authenticated using (public.is_platform_admin());

/*
 * -------------------------------------------------------
 * Section: payer_rules + payer_rule_versions
 * A payer_rule is a stable identity (rule_code); payer_rule_versions holds
 * the actual versioned, explainable content. Editing a rule always inserts
 * a new version -- existing versions are never mutated.
 * -------------------------------------------------------
 */
create table if not exists
    public.payer_rules
(
    id         uuid primary key default extensions.uuid_generate_v4(),
    payer_id   uuid references public.payers (id) on delete cascade,
    rule_code  varchar(64) not null unique,
    category   varchar(20) not null check (category in ('universal', 'claim_type', 'payer_edit', 'adjudication', 'informational')),
    claim_type varchar(20) check (claim_type in ('professional', 'institutional')),
    is_active  boolean     not null default true,
    created_at timestamp with time zone default now(),
    created_by uuid references auth.users,
    updated_at timestamp with time zone,
    updated_by uuid references auth.users,
    deleted_at timestamp with time zone,
    constraint payer_rules_payer_scope check (
        (category in ('payer_edit', 'adjudication') and payer_id is not null)
            or (category in ('universal', 'claim_type', 'informational'))
        )
);

comment on table public.payer_rules is 'Stable rule identity. category=universal/claim_type rules apply across all payers (payer_id null); payer_edit/adjudication rules are payer-specific (payer_id required).';

create index if not exists payer_rules_payer_id_idx on public.payer_rules (payer_id);
create index if not exists payer_rules_category_idx on public.payer_rules (category);

alter table public.payer_rules enable row level security;

revoke all on public.payer_rules from authenticated, service_role;
grant select, insert, update on table public.payer_rules to authenticated;
grant select, insert, update, delete on table public.payer_rules to service_role;

create policy payer_rules_read on public.payer_rules for select
    to authenticated using (deleted_at is null or public.is_platform_admin());

create policy payer_rules_insert on public.payer_rules for insert
    to authenticated with check (public.is_platform_admin());

create policy payer_rules_update on public.payer_rules for update
    to authenticated using (public.is_platform_admin())
    with check (public.is_platform_admin());

create table if not exists
    public.payer_rule_versions
(
    id                   uuid primary key default extensions.uuid_generate_v4(),
    payer_rule_id        uuid        not null references public.payer_rules (id) on delete cascade,
    version_number       integer     not null,
    field_path           varchar(255),
    condition            text        not null,
    outcome              varchar(20) not null check (outcome in ('reject', 'deny', 'warn', 'info')),
    severity             varchar(20) not null check (severity in ('error', 'warning', 'info')),
    rejection_or_denial  varchar(20) not null check (rejection_or_denial in ('rejection', 'denial', 'not_applicable')),
    explanation          text        not null,
    suggested_correction text,
    effective_date       date,
    expiration_date      date,
    source               text,
    is_active            boolean     not null default true,
    created_at           timestamp with time zone default now(),
    created_by           uuid references auth.users,
    unique (payer_rule_id, version_number)
);

comment on table public.payer_rule_versions is 'Versioned, explainable rule content. rejection_or_denial is the hard rejection-vs-denial designation: rejection = pre-adjudication (TA1/999/277CA), denial = post-adjudication (835 CARC/RARC). Never mutated after insert -- edits create a new version.';

create index if not exists payer_rule_versions_rule_id_idx on public.payer_rule_versions (payer_rule_id);

alter table public.payer_rule_versions enable row level security;

revoke all on public.payer_rule_versions from authenticated, service_role;
grant select, insert on table public.payer_rule_versions to authenticated;
grant select, insert, update, delete on table public.payer_rule_versions to service_role;

create policy payer_rule_versions_read on public.payer_rule_versions for select to authenticated using (true);
create policy payer_rule_versions_insert on public.payer_rule_versions for insert to authenticated with check (public.is_platform_admin());

/*
 * -------------------------------------------------------
 * Section: payer_test_profiles
 * Scaffolding consumed by Phase 7's adjudication simulator. Readable by
 * any authenticated user for directory transparency; admin-writable.
 * -------------------------------------------------------
 */
create table if not exists
    public.payer_test_profiles
(
    id               uuid primary key default extensions.uuid_generate_v4(),
    payer_id         uuid        not null references public.payers (id) on delete cascade unique,
    default_outcome  varchar(20) not null default 'paid' check (default_outcome in ('paid', 'denied')),
    denial_rule_code varchar(64),
    notes            text,
    created_at       timestamp with time zone default now(),
    created_by       uuid references auth.users,
    updated_at       timestamp with time zone,
    updated_by       uuid references auth.users
);

comment on table public.payer_test_profiles is 'Per-payer simulated adjudication behavior, consumed by the Phase 7 adjudication simulator. denial_rule_code references payer_rules.rule_code informally (not a FK) -- the rule that would trigger the denial.';

alter table public.payer_test_profiles enable row level security;

revoke all on public.payer_test_profiles from authenticated, service_role;
grant select, insert, update on table public.payer_test_profiles to authenticated;
grant select, insert, update, delete on table public.payer_test_profiles to service_role;

create policy payer_test_profiles_read on public.payer_test_profiles for select to authenticated using (true);
create policy payer_test_profiles_write on public.payer_test_profiles for insert to authenticated with check (public.is_platform_admin());
create policy payer_test_profiles_update on public.payer_test_profiles for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

/*
 * -------------------------------------------------------
 * Section: seed -- ten SIM- payers matching the ten-claim test categories
 * -------------------------------------------------------
 */
insert into public.payers (sim_payer_id, display_name, legal_name, category, scope, state, network_name, notes)
values
    ('SIM-MCFFS-001', 'SIM Medicare FFS National', 'SIM Medicare Fee-For-Service (Simulated)', 'medicare_ffs', 'national', null, 'SIM Medicare FFS Network', 'Simulated Medicare fee-for-service payer profile. No real CMS connectivity.'),
    ('SIM-MCADV-001', 'SIM Medicare Advantage Plan', 'SIM Medicare Advantage (Simulated)', 'medicare_advantage', 'national', null, 'SIM Medicare Advantage Network', 'Simulated Medicare Advantage payer profile.'),
    ('SIM-MDFFS-001', 'SIM Medicaid FFS State Program', 'SIM Medicaid Fee-For-Service (Simulated)', 'medicaid_ffs', 'state', 'CA', 'SIM Medicaid FFS Network', 'Simulated state Medicaid fee-for-service program.'),
    ('SIM-MDMCO-001', 'SIM Medicaid Managed Care Plan', 'SIM Medicaid MCO (Simulated)', 'medicaid_mco', 'state', 'CA', 'SIM Medicaid MCO Network', 'Simulated Medicaid managed-care organization.'),
    ('SIM-PPO-001', 'SIM Commercial PPO Network', 'SIM Commercial PPO (Simulated)', 'commercial_ppo', 'national', null, 'SIM PPO Network', 'Simulated commercial PPO payer profile.'),
    ('SIM-HMO-001', 'SIM Commercial HMO Network', 'SIM Commercial HMO (Simulated)', 'commercial_hmo', 'regional', null, 'SIM HMO Network (West Region)', 'Simulated commercial HMO payer profile.'),
    ('SIM-BLUE-001', 'SIM Blue-Style Plan', 'SIM Blue-Style Plan (Simulated)', 'blue_plan', 'state', 'CA', 'SIM Blue Network', 'Simulated Blue-style plan. Not affiliated with any real Blue Cross/Blue Shield licensee.'),
    ('SIM-TRICARE-001', 'SIM TRICARE-Style Plan', 'SIM Military Health Plan (Simulated)', 'tricare', 'national', null, 'SIM TRICARE-Style Network', 'Simulated TRICARE-style payer profile. Not affiliated with the real TRICARE program.'),
    ('SIM-MKTPL-001', 'SIM Marketplace Exchange Plan', 'SIM ACA Marketplace Plan (Simulated)', 'marketplace', 'national', null, 'SIM Marketplace Network', 'Simulated health insurance marketplace/exchange plan.'),
    ('SIM-RBH-001', 'SIM Regional Behavioral Health Network', 'SIM Regional BH Payer (Simulated)', 'regional_bh', 'regional', null, 'SIM Regional BH Network', 'Simulated regional behavioral-health-focused payer.')
on conflict (sim_payer_id) do nothing;

insert into public.payer_aliases (payer_id, alias)
select p.id, v.alias
from (values
    ('SIM-MCFFS-001', 'SIM Medicare FFS'),
    ('SIM-MCADV-001', 'SIM Medicare Advantage'),
    ('SIM-MDFFS-001', 'SIM Medicaid FFS (CA)'),
    ('SIM-MDMCO-001', 'SIM Medicaid MCO (CA)'),
    ('SIM-PPO-001', 'SIM Commercial PPO'),
    ('SIM-HMO-001', 'SIM Commercial HMO'),
    ('SIM-BLUE-001', 'SIM Blue Plan (CA)'),
    ('SIM-TRICARE-001', 'SIM TRICARE-Style'),
    ('SIM-MKTPL-001', 'SIM Marketplace Plan'),
    ('SIM-RBH-001', 'SIM Regional BH')
) as v(sim_payer_id, alias)
    join public.payers p on p.sim_payer_id = v.sim_payer_id;

insert into public.payer_routes (payer_id, route_name, route_type, notes)
select p.id, 'SIM Clearinghouse Gateway', 'clearinghouse', 'Simulated connectivity route -- not a real production route.'
from public.payers p
where p.sim_payer_id like 'SIM-%';

insert into public.payer_supported_transactions (payer_id, transaction_type)
select p.id, t.transaction_type
from public.payers p
         cross join (values ('837P'), ('837I'), ('999'), ('TA1'), ('277CA'), ('835')) as t(transaction_type)
where p.sim_payer_id like 'SIM-%';

-- default_outcome: exactly two payers denied, matching the architecture
-- doc's two BH denial scenarios (missing prior auth; benefit limit
-- exhausted), foreshadowing Phase 7's "8 paid / 2 denied" requirement.
-- Not enforced yet -- Phase 7 builds the actual adjudication simulator.
insert into public.payer_test_profiles (payer_id, default_outcome, notes)
select p.id,
       case when p.sim_payer_id in ('SIM-RBH-001', 'SIM-MDMCO-001') then 'denied' else 'paid' end,
       case
           when p.sim_payer_id = 'SIM-RBH-001' then 'Simulated denial: required prior authorization missing/invalid.'
           when p.sim_payer_id = 'SIM-MDMCO-001' then 'Simulated denial: annual outpatient-therapy benefit limit exhausted.'
           else 'Simulated standard payment.'
           end
from public.payers p
where p.sim_payer_id like 'SIM-%';

-- universal rules (payer_id null, apply to every payer)
insert into public.payer_rules (rule_code, category)
values
    ('SIM-RULE-UNIV-001', 'universal'),
    ('SIM-RULE-UNIV-002', 'universal'),
    ('SIM-RULE-UNIV-003', 'universal')
on conflict (rule_code) do nothing;

insert into public.payer_rule_versions (payer_rule_id, version_number, field_path, condition, outcome, severity, rejection_or_denial, explanation, suggested_correction)
select r.id, 1, v.field_path, v.condition, v.outcome, v.severity, v.rejection_or_denial, v.explanation, v.suggested_correction
from (values
    ('SIM-RULE-UNIV-001', 'claim.diagnoses[0]', 'at least one diagnosis code is present', 'reject', 'error', 'rejection', 'Every claim requires at least one diagnosis code.', 'Add a primary diagnosis code to the claim.'),
    ('SIM-RULE-UNIV-002', 'claim.serviceDate', 'service date is not in the future', 'reject', 'error', 'rejection', 'The date of service cannot be after today.', 'Correct the service date.'),
    ('SIM-RULE-UNIV-003', 'claim.subscriberId', 'subscriber ID is present', 'reject', 'error', 'rejection', 'A subscriber/member ID is required to identify coverage.', 'Add the subscriber ID from the coverage record.')
) as v(rule_code, field_path, condition, outcome, severity, rejection_or_denial, explanation, suggested_correction)
    join public.payer_rules r on r.rule_code = v.rule_code
on conflict (payer_rule_id, version_number) do nothing;

-- claim-type rules (payer_id null, apply by claim type across all payers)
insert into public.payer_rules (rule_code, category, claim_type)
values
    ('SIM-RULE-CT-001', 'claim_type', 'professional'),
    ('SIM-RULE-CT-002', 'claim_type', 'institutional')
on conflict (rule_code) do nothing;

insert into public.payer_rule_versions (payer_rule_id, version_number, field_path, condition, outcome, severity, rejection_or_denial, explanation, suggested_correction)
select r.id, 1, v.field_path, v.condition, v.outcome, v.severity, v.rejection_or_denial, v.explanation, v.suggested_correction
from (values
    ('SIM-RULE-CT-001', 'claim.renderingProviderNpi', 'rendering provider NPI is present', 'reject', 'error', 'rejection', 'Professional (837P) claims require a rendering provider NPI.', 'Select a rendering provider with a valid NPI.'),
    ('SIM-RULE-CT-002', 'claim.typeOfBillCode', 'type of bill code is present', 'reject', 'error', 'rejection', 'Institutional (837I) claims require a type-of-bill code.', 'Add a type-of-bill code identifying the facility/claim type.')
) as v(rule_code, field_path, condition, outcome, severity, rejection_or_denial, explanation, suggested_correction)
    join public.payer_rules r on r.rule_code = v.rule_code
on conflict (payer_rule_id, version_number) do nothing;

-- payer-specific "payer edit" rules (one per payer)
insert into public.payer_rules (payer_id, rule_code, category)
select p.id, 'SIM-RULE-EDIT-' || p.sim_payer_id, 'payer_edit'
from public.payers p
where p.sim_payer_id like 'SIM-%'
on conflict (rule_code) do nothing;

insert into public.payer_rule_versions (payer_rule_id, version_number, field_path, condition, outcome, severity, rejection_or_denial, explanation, suggested_correction)
select r.id, 1, 'claim.payerId', 'claim payer ID matches an active enrollment for this payer', 'reject', 'error', 'rejection',
       'Simulated payer-specific edit: ' || p.display_name || ' requires an active organization enrollment before accepting claims.',
       'Add a payer enrollment for ' || p.display_name || ' before submitting.'
from public.payer_rules r
         join public.payers p on p.id = r.payer_id
where r.category = 'payer_edit'
on conflict (payer_rule_id, version_number) do nothing;

-- payer-specific adjudication rules (one per payer; two are the "real"
-- denial triggers per payer_test_profiles above, matching the
-- architecture doc's two BH denial scenarios)
insert into public.payer_rules (payer_id, rule_code, category)
select p.id, 'SIM-RULE-ADJ-' || p.sim_payer_id, 'adjudication'
from public.payers p
where p.sim_payer_id like 'SIM-%'
on conflict (rule_code) do nothing;

insert into public.payer_rule_versions (payer_rule_id, version_number, field_path, condition, outcome, severity, rejection_or_denial, explanation, suggested_correction)
select r.id, 1, v.field_path, v.condition, v.outcome, v.severity, 'denial', v.explanation, v.suggested_correction
from (values
    ('SIM-RBH-001', 'claim.priorAuthNumber', 'a valid prior authorization is on file for the service', 'deny', 'error', 'Simulated denial: required prior authorization missing or invalid for this level of care (e.g. PHP/IOP day).', 'Obtain and attach a valid prior authorization before resubmitting.'),
    ('SIM-MDMCO-001', 'claim.benefitUnitsUsed', 'annual outpatient-therapy visit limit has not been exhausted', 'deny', 'error', 'Simulated denial: annual outpatient-therapy benefit limit exhausted under the simulated plan.', 'Verify remaining benefit units or bill the patient per plan terms.'),
    ('SIM-MCFFS-001', 'claim.serviceDate', 'service falls within the simulated coverage period', 'deny', 'warning', 'Simulated adjudication check: service date coverage window (does not trigger in the demo set).', 'Verify eligibility dates.'),
    ('SIM-MCADV-001', 'claim.networkStatus', 'rendering provider is in-network for this simulated plan', 'deny', 'warning', 'Simulated adjudication check: network status (does not trigger in the demo set).', 'Verify provider network participation.'),
    ('SIM-MDFFS-001', 'claim.eligibilitySpan', 'patient eligibility is active on the service date', 'deny', 'warning', 'Simulated adjudication check: eligibility span (does not trigger in the demo set).', 'Verify eligibility on the service date.'),
    ('SIM-PPO-001', 'claim.priorAuthNumber', 'prior authorization present where required by the simulated plan', 'deny', 'warning', 'Simulated adjudication check: prior authorization (does not trigger in the demo set).', 'Verify prior authorization requirements.'),
    ('SIM-HMO-001', 'claim.referralNumber', 'a valid referral is on file where required', 'deny', 'warning', 'Simulated adjudication check: referral requirement (does not trigger in the demo set).', 'Verify referral requirements.'),
    ('SIM-BLUE-001', 'claim.benefitUnitsUsed', 'benefit limit has not been exhausted', 'deny', 'warning', 'Simulated adjudication check: benefit limit (does not trigger in the demo set).', 'Verify remaining benefit units.'),
    ('SIM-TRICARE-001', 'claim.sponsorEligibility', 'sponsor eligibility is active', 'deny', 'warning', 'Simulated adjudication check: sponsor eligibility (does not trigger in the demo set).', 'Verify sponsor eligibility.'),
    ('SIM-MKTPL-001', 'claim.premiumStatus', 'premium payment is current', 'deny', 'warning', 'Simulated adjudication check: premium/grace-period status (does not trigger in the demo set).', 'Verify premium payment status.')
) as v(sim_payer_id, field_path, condition, outcome, severity, explanation, suggested_correction)
    join public.payers p on p.sim_payer_id = v.sim_payer_id
    join public.payer_rules r on r.payer_id = p.id and r.category = 'adjudication'
on conflict (payer_rule_id, version_number) do nothing;

-- informational rules (payer_id null; informational only, never blocks)
insert into public.payer_rules (rule_code, category)
values
    ('SIM-RULE-INFO-001', 'informational'),
    ('SIM-RULE-INFO-002', 'informational')
on conflict (rule_code) do nothing;

insert into public.payer_rule_versions (payer_rule_id, version_number, field_path, condition, outcome, severity, rejection_or_denial, explanation, suggested_correction)
select r.id, 1, v.field_path, v.condition, v.outcome, v.severity, v.rejection_or_denial, v.explanation, v.suggested_correction
from (values
    ('SIM-RULE-INFO-001', 'claim.serviceDate', 'claim submitted within the typical timely-filing window', 'info', 'info', 'not_applicable', 'Informational: this claim is being submitted close to a typical timely-filing deadline. Simulated notice only -- does not block submission.', null),
    ('SIM-RULE-INFO-002', 'claim.lines', 'multiple service lines present', 'info', 'info', 'not_applicable', 'Informational: claims with many service lines may take longer to adjudicate in real-world processing. Simulated notice only.', null)
) as v(rule_code, field_path, condition, outcome, severity, rejection_or_denial, explanation, suggested_correction)
    join public.payer_rules r on r.rule_code = v.rule_code
on conflict (payer_rule_id, version_number) do nothing;
