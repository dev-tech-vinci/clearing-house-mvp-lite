'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateProviderSchema,
  DeactivateProviderSchema,
  UpdateProviderSchema,
} from '../schema/provider.schema';

export const createProviderAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('providers').insert({
      organization_id: data.organizationId,
      provider_type: data.providerType,
      npi: data.npi,
      first_name: data.firstName ?? null,
      last_name: data.lastName ?? null,
      organization_name: data.organizationName ?? null,
      taxonomy_code: data.taxonomyCode ?? null,
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/home/providers');

    return { success: true };
  },
  { schema: CreateProviderSchema },
);

export const updateProviderAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('providers')
      .update({
        provider_type: data.providerType,
        npi: data.npi,
        first_name: data.firstName ?? null,
        last_name: data.lastName ?? null,
        organization_name: data.organizationName ?? null,
        taxonomy_code: data.taxonomyCode ?? null,
        updated_by: user.id,
      })
      .eq('id', data.providerId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/providers');

    return { success: true };
  },
  { schema: UpdateProviderSchema },
);

export const deactivateProviderAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('providers')
      .update({ is_active: data.isActive, updated_by: user.id })
      .eq('id', data.providerId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/providers');

    return { success: true };
  },
  { schema: DeactivateProviderSchema },
);
