import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Class representing an API for reading the global payer directory.
 * Payers are not tenant-owned -- every authenticated user reads the same
 * rows, scoped only by RLS's deleted_at visibility rule.
 */
class PayersApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listPayers() {
    const { data, error } = await this.client
      .from('payers')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }

  async listActivePayers() {
    const { data, error } = await this.client
      .from('payers')
      .select('id, sim_payer_id, display_name, category')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_name', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }

  async getPayer(payerId: string) {
    const { data, error } = await this.client
      .from('payers')
      .select(
        '*, aliases:payer_aliases(*), routes:payer_routes(*), supported_transactions:payer_supported_transactions(*), test_profile:payer_test_profiles(*)',
      )
      .eq('id', payerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createPayersApi(client: SupabaseClient<Database>) {
  return new PayersApi(client);
}
