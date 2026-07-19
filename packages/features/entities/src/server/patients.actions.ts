'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreatePatientSchema,
  DeactivatePatientSchema,
  UpdatePatientSchema,
} from '../schema/patient.schema';

export const createPatientAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('patients').insert({
      organization_id: data.organizationId,
      first_name: data.firstName,
      last_name: data.lastName,
      date_of_birth: data.dateOfBirth,
      gender: data.gender,
      address_line1: data.addressLine1 ?? null,
      address_line2: data.addressLine2 ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postal_code: data.postalCode ?? null,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: CreatePatientSchema },
);

export const updatePatientAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('patients')
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        date_of_birth: data.dateOfBirth,
        gender: data.gender,
        address_line1: data.addressLine1 ?? null,
        address_line2: data.addressLine2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        postal_code: data.postalCode ?? null,
        updated_by: user.id,
      })
      .eq('id', data.patientId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: UpdatePatientSchema },
);

export const deactivatePatientAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('patients')
      .update({ is_active: data.isActive, updated_by: user.id })
      .eq('id', data.patientId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/patients');

    return { success: true };
  },
  { schema: DeactivatePatientSchema },
);
