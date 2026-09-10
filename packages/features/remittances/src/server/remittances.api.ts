import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Class representing an API for reading remittances, adjustments, and
 * EFT/reconciliation data, plus the org-wide claim outcome stats the
 * dashboard uses. All methods run as the calling user -- results are
 * already scoped by RLS (has_permission('remittances.view')), not
 * filtered client-side.
 */
class RemittancesApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listRemittances(organizationId: string) {
    const { data, error } = await this.client
      .from('remittances')
      .select(
        `*,
         claim:claims(sim_claim_id, claim_type),
         payer:payers(sim_payer_id, display_name),
         remit_claims(id, charge_amount, paid_amount, patient_responsibility),
         eft_traces(id, eft_trace_number, amount, effective_date),
         payment_matches(id, matched_amount, matched_at)`,
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async getRemittance(organizationId: string, remittanceId: string) {
    const { data, error } = await this.client
      .from('remittances')
      .select(
        `*,
         claim:claims(sim_claim_id, claim_type),
         payer:payers(sim_payer_id, display_name),
         remit_claims(id, charge_amount, paid_amount, patient_responsibility,
           claim_adjustments(*)),
         eft_traces(id, eft_trace_number, amount, effective_date),
         payment_matches(id, matched_amount, matched_at)`,
      )
      .eq('organization_id', organizationId)
      .eq('id', remittanceId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Rejection rate (pre-adjudication, from processing_jobs -- every
   * submit attempt claims exactly one row, status='failed' means
   * rejected) and denial rate (post-adjudication, from remittances --
   * every adjudicated claim gets exactly one row, outcome='denied' means
   * denied) are computed from two entirely separate tables on purpose:
   * there is no code path here that could accidentally merge them.
   */
  async getClaimOutcomeStats(organizationId: string) {
    const [
      { count: totalSubmitted },
      { count: rejectedCount },
      { count: adjudicatedCount },
      { count: deniedCount },
    ] = await Promise.all([
      this.client
        .from('processing_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      this.client
        .from('processing_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'failed'),
      this.client
        .from('remittances')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),
      this.client
        .from('remittances')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('outcome', 'denied'),
    ]);

    return {
      totalSubmitted: totalSubmitted ?? 0,
      rejectedCount: rejectedCount ?? 0,
      rejectionRate: totalSubmitted ? (rejectedCount ?? 0) / totalSubmitted : 0,
      adjudicatedCount: adjudicatedCount ?? 0,
      deniedCount: deniedCount ?? 0,
      denialRate: adjudicatedCount ? (deniedCount ?? 0) / adjudicatedCount : 0,
    };
  }
}

export function createRemittancesApi(client: SupabaseClient<Database>) {
  return new RemittancesApi(client);
}
