import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

class DocumentsApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listDocuments(organizationId: string) {
    const { data, error } = await this.client
      .from('documents')
      .select('*, claim:claims(sim_claim_id)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createDocumentsApi(client: SupabaseClient<Database>) {
  return new DocumentsApi(client);
}
