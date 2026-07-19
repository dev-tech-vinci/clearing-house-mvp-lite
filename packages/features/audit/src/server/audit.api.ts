import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Read side of the audit trail. All results are already scoped by RLS
 * (audit.view sees everything for the org, audit.view_own sees only the
 * caller's own actions) -- not filtered client-side.
 */
class AuditApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * audit_events.actor_id references auth.users, not public.accounts, so
   * there is no FK PostgREST can embed here (the same reason Phase 2's
   * member list needed a dedicated get_organization_members() RPC rather
   * than a plain embed). Resolves display names with a second query
   * instead of a broken embed. Note: public.accounts' own RLS only
   * allows a user to read their own row, so this best-effort lookup
   * resolves the caller's own actions fully but returns null names for
   * other actors (e.g. a different org member, or a support user) -- the
   * UI falls back to showing the raw actor_id in that case. A dedicated
   * SECURITY DEFINER resolver (like Phase 2's get_organization_members())
   * would fix this but is more than a display-name convenience is worth
   * for this phase.
   */
  async listEvents(organizationId: string, limit = 100) {
    const { data: events, error } = await this.client
      .from('audit_events')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const actorIds = [...new Set(events.map((event) => event.actor_id).filter(Boolean))] as string[];

    if (actorIds.length === 0) {
      return events.map((event) => ({ ...event, actorName: null, actorEmail: null }));
    }

    const { data: actors, error: actorsError } = await this.client
      .from('accounts')
      .select('id, name, email')
      .in('id', actorIds);

    if (actorsError) {
      throw actorsError;
    }

    const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

    return events.map((event) => ({
      ...event,
      actorName: actorsById.get(event.actor_id ?? '')?.name ?? null,
      actorEmail: actorsById.get(event.actor_id ?? '')?.email ?? null,
    }));
  }
}

export function createAuditApi(client: SupabaseClient<Database>) {
  return new AuditApi(client);
}
