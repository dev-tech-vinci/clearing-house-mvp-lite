'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import type { Database } from '@kit/supabase/database';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CreateEnrollmentSchema,
  UpdateEnrollmentSchema,
} from '../schema/payer-enrollment.schema';

/**
 * payer_label is a required display fallback (Phase 3), kept in sync with
 * the real payer_id FK (Phase 4).
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

export const createEnrollmentAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const payerLabel = await resolvePayerLabel(client, data.payerId);

    const { error } = await client.from('organization_payer_enrollments').insert({
      organization_id: data.organizationId,
      payer_id: data.payerId,
      payer_label: payerLabel,
      status: data.status,
      effective_date: data.effectiveDate || null,
      termination_date: data.terminationDate || null,
      notes: data.notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/home/providers');

    return { success: true };
  },
  { schema: CreateEnrollmentSchema },
);

export const updateEnrollmentAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const payerLabel = await resolvePayerLabel(client, data.payerId);

    const { error } = await client
      .from('organization_payer_enrollments')
      .update({
        payer_id: data.payerId,
        payer_label: payerLabel,
        status: data.status,
        effective_date: data.effectiveDate || null,
        termination_date: data.terminationDate || null,
        notes: data.notes ?? null,
        updated_by: user.id,
      })
      .eq('id', data.enrollmentId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/providers');

    return { success: true };
  },
  { schema: UpdateEnrollmentSchema },
);
