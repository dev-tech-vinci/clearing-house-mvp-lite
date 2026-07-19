import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Class representing an API for reading a claim's transaction_events
 * trace. Read-only -- transaction_events is append-only and this package
 * never writes to it (writes happen only from apps/worker's
 * ClaimProcessor). All methods run as the calling user -- results are
 * already scoped by RLS (has_org_access), not filtered client-side.
 */
class TraceApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getClaimTrace(organizationId: string, claimId: string) {
    const { data, error } = await this.client
      .from('transaction_events')
      .select(
        `*,
         payer:payers(id, sim_payer_id, display_name),
         rule:payer_rules(id, rule_code)`,
      )
      .eq('organization_id', organizationId)
      .eq('claim_id', claimId)
      .order('occurred_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createTraceApi(client: SupabaseClient<Database>) {
  return new TraceApi(client);
}
