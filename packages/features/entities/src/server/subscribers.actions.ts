'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateSubscriberSchema,
  DeactivateSubscriberSchema,
  UpdateSubscriberSchema,
} from '../schema/subscriber.schema';

export const createSubscriberAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('subscribers').insert({
      organization_id: data.organizationId,
      patient_id: data.patientId,
      relationship_to_patient: data.relationshipToPatient,
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth || null,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: CreateSubscriberSchema },
);

export const updateSubscriberAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('subscribers')
      .update({
        patient_id: data.patientId,
        relationship_to_patient: data.relationshipToPatient,
        first_name: data.firstName,
        last_name: data.lastName,
        date_of_birth: data.dateOfBirth || null,
        updated_by: user.id,
      })
      .eq('id', data.subscriberId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: UpdateSubscriberSchema },
);

export const deactivateSubscriberAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('subscribers')
      .update({ is_active: data.isActive, updated_by: user.id })
      .eq('id', data.subscriberId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: DeactivateSubscriberSchema },
);
