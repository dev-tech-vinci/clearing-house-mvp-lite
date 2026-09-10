'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateFacilitySchema,
  DeactivateFacilitySchema,
  UpdateFacilitySchema,
} from '../schema/facility.schema';

export const createFacilityAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('facilities').insert({
      organization_id: data.organizationId,
      name: data.name,
      facility_type: data.facilityType,
      npi: data.npi || null,
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

    revalidatePath('/home/providers');

    return { success: true };
  },
  { schema: CreateFacilitySchema },
);

export const updateFacilityAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('facilities')
      .update({
        name: data.name,
        facility_type: data.facilityType,
        npi: data.npi || null,
        address_line1: data.addressLine1 ?? null,
        address_line2: data.addressLine2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        postal_code: data.postalCode ?? null,
        updated_by: user.id,
      })
      .eq('id', data.facilityId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/providers');

    return { success: true };
  },
  { schema: UpdateFacilitySchema },
);

export const deactivateFacilityAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('facilities')
      .update({ is_active: data.isActive, updated_by: user.id })
      .eq('id', data.facilityId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/providers');

    return { success: true };
  },
  { schema: DeactivateFacilitySchema },
);
