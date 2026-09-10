import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Class representing an API for reading providers, facilities, patients,
 * subscribers, coverages, and payer enrollments. All methods run as the
 * calling user -- results are already scoped by RLS (has_org_access), not
 * filtered client-side.
 */
class EntitiesApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listProviders(organizationId: string) {
    const { data, error } = await this.client
      .from('providers')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async listFacilities(organizationId: string) {
    const { data, error } = await this.client
      .from('facilities')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async listPatients(organizationId: string) {
    const { data, error } = await this.client
      .from('patients')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async listSubscribers(organizationId: string) {
    const { data, error } = await this.client
      .from('subscribers')
      .select('*, patient:patients(id, first_name, last_name, sim_patient_id)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async listCoverages(organizationId: string) {
    const { data, error } = await this.client
      .from('coverages')
      .select(
        '*, subscriber:subscribers(id, first_name, last_name, sim_subscriber_id), patient:patients(id, first_name, last_name, sim_patient_id)',
      )
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async listPayerEnrollments(organizationId: string) {
    const { data, error } = await this.client
      .from('organization_payer_enrollments')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createEntitiesApi(client: SupabaseClient<Database>) {
  return new EntitiesApi(client);
}
