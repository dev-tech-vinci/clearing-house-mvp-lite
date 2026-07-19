import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Class representing an API for reading claims and their child rows. All
 * methods run as the calling user -- results are already scoped by RLS
 * (has_org_access), not filtered client-side.
 */
class ClaimsApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listClaims(organizationId: string) {
    const { data, error } = await this.client
      .from('claims')
      .select(
        '*, patient:patients(id, first_name, last_name, sim_patient_id), coverage:coverages(id, payer_label, payer_id)',
      )
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async getClaim(organizationId: string, claimId: string) {
    const { data, error } = await this.client
      .from('claims')
      .select(
        `*,
         patient:patients(id, first_name, last_name, sim_patient_id),
         subscriber:subscribers(id, first_name, last_name, sim_subscriber_id),
         coverage:coverages(id, payer_id, payer_label, member_id),
         billing_provider:providers!claims_billing_provider_id_fkey(id, sim_provider_id, first_name, last_name, organization_name),
         professional:professional_claim_details(rendering_provider_id, rendering_provider:providers(id, sim_provider_id, first_name, last_name, organization_name)),
         institutional:institutional_claim_details(facility_id, type_of_bill, admission_date, discharge_date, facility:facilities(id, sim_facility_id, name)),
         diagnoses:claim_diagnoses(id, diagnosis_code, diagnosis_pointer, is_primary),
         lines:claim_lines(id, line_number, service_date, procedure_code, revenue_code, modifiers, units, charge_amount, place_of_service, diagnosis_pointers)`,
      )
      .eq('organization_id', organizationId)
      .eq('id', claimId)
      .is('deleted_at', null)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createClaimsApi(client: SupabaseClient<Database>) {
  return new ClaimsApi(client);
}
