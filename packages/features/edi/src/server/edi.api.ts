import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Class representing an API for reading a claim's EDI transaction,
 * payloads, and acknowledgments. All methods run as the calling user --
 * results are already scoped by RLS (has_org_access), not filtered
 * client-side.
 */
class EdiApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getEdiTransactionForClaim(claimId: string) {
    const { data, error } = await this.client
      .from('edi_transactions')
      .select(
        '*, payloads:edi_payloads(*), acknowledgments:acknowledgments(*)',
      )
      .eq('claim_id', claimId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createEdiApi(client: SupabaseClient<Database>) {
  return new EdiApi(client);
}
