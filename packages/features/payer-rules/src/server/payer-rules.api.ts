import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Class representing an API for reading payer rules and their versions.
 * Rules are not tenant-owned -- every authenticated user reads the same
 * rows.
 */
class PayerRulesApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * List every rule with its payer (if any) and its latest version.
   */
  async listRules() {
    const { data, error } = await this.client
      .from('payer_rules')
      .select(
        '*, payer:payers(id, sim_payer_id, display_name), versions:payer_rule_versions(*)',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async listVersions(payerRuleId: string) {
    const { data, error } = await this.client
      .from('payer_rule_versions')
      .select('*')
      .eq('payer_rule_id', payerRuleId)
      .order('version_number', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createPayerRulesApi(client: SupabaseClient<Database>) {
  return new PayerRulesApi(client);
}
