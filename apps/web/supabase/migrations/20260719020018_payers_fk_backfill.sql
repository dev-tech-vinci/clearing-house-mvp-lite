/*
 * -------------------------------------------------------
 * Phase 4 — wire the real payer_id FK that Phase 3 deferred
 * (public.payers did not exist yet at Phase 3). Best-effort backfills
 * payer_id on existing rows by matching the free-text payer_label against
 * the new payers directory; payer_label is left in place either way (it
 * remains the fallback display value for any row that doesn't match one
 * of the ten seeded payers).
 * -------------------------------------------------------
 */

-- Best-effort backfill BEFORE adding the FK constraint, so any match
-- is captured; non-matching rows simply keep payer_id null.
update public.coverages c
set payer_id = p.id
from public.payers p
where c.payer_id is null
  and (
    c.payer_label = p.sim_payer_id
        or c.payer_label ilike p.display_name
        or c.payer_label ilike '%' || p.sim_payer_id || '%'
    );

update public.organization_payer_enrollments e
set payer_id = p.id
from public.payers p
where e.payer_id is null
  and (
    e.payer_label = p.sim_payer_id
        or e.payer_label ilike p.display_name
        or e.payer_label ilike '%' || p.sim_payer_id || '%'
    );

alter table public.coverages
    add constraint coverages_payer_id_fkey foreign key (payer_id) references public.payers (id);

alter table public.organization_payer_enrollments
    add constraint organization_payer_enrollments_payer_id_fkey foreign key (payer_id) references public.payers (id);

comment on column public.coverages.payer_id is 'FK to public.payers, wired in Phase 4. Nullable -- a coverage may reference a payer outside the ten seeded profiles, in which case payer_label remains the display fallback.';
comment on column public.organization_payer_enrollments.payer_id is 'FK to public.payers, wired in Phase 4. Nullable -- see coverages.payer_id for the same rationale.';
