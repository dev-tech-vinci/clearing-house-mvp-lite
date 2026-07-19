'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import type { Database } from '@kit/supabase/database';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CreateCoverageSchema,
  DeactivateCoverageSchema,
  UpdateCoverageSchema,
} from '../schema/coverage.schema';

/**
 * payer_label is a required display fallback on coverages (Phase 3), kept
 * in sync with the real payer_id FK (Phase 4) so existing display code
 * doesn't need to join payers everywhere.
 */
async function resolvePayerLabel(client: SupabaseClient<Database>, payerId: string) {
  const { data, error } = await client
    .from('payers')
    .select('display_name')
    .eq('id', payerId)
    .single();

  if (error) {
    throw error;
  }

  return data.display_name;
}

export const createCoverageAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const payerLabel = await resolvePayerLabel(client, data.payerId);

    const { error } = await client.from('coverages').insert({
      organization_id: data.organizationId,
      subscriber_id: data.subscriberId,
      patient_id: data.patientId,
      payer_id: data.payerId,
      payer_label: payerLabel,
      group_number: data.groupNumber ?? null,
      coverage_type: data.coverageType,
      effective_date: data.effectiveDate || null,
      termination_date: data.terminationDate || null,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: CreateCoverageSchema },
);

export const updateCoverageAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const payerLabel = await resolvePayerLabel(client, data.payerId);

    const { error } = await client
      .from('coverages')
      .update({
        subscriber_id: data.subscriberId,
        patient_id: data.patientId,
        payer_id: data.payerId,
        payer_label: payerLabel,
        group_number: data.groupNumber ?? null,
        coverage_type: data.coverageType,
        effective_date: data.effectiveDate || null,
        termination_date: data.terminationDate || null,
        updated_by: user.id,
      })
      .eq('id', data.coverageId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: UpdateCoverageSchema },
);

export const deactivateCoverageAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('coverages')
      .update({ is_active: data.isActive, updated_by: user.id })
      .eq('id', data.coverageId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: DeactivateCoverageSchema },
);
