'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateEnrollmentSchema,
  UpdateEnrollmentSchema,
} from '../schema/payer-enrollment.schema';

export const createEnrollmentAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('organization_payer_enrollments').insert({
      organization_id: data.organizationId,
      payer_label: data.payerLabel,
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

    const { error } = await client
      .from('organization_payer_enrollments')
      .update({
        payer_label: data.payerLabel,
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
