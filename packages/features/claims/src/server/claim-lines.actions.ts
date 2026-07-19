'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddClaimLineSchema,
  RemoveClaimLineSchema,
  UpdateClaimLineSchema,
} from '../schema/claim-line.schema';

function toRow(data: {
  organizationId: string;
  claimId: string;
  lineNumber: number;
  serviceDate: string;
  procedureCode?: string;
  revenueCode?: string;
  modifiers?: string[];
  units: number;
  chargeAmount: number;
  placeOfService?: string;
  diagnosisPointers: number[];
}) {
  return {
    organization_id: data.organizationId,
    claim_id: data.claimId,
    line_number: data.lineNumber,
    service_date: data.serviceDate,
    procedure_code: data.procedureCode || null,
    revenue_code: data.revenueCode || null,
    modifiers: data.modifiers && data.modifiers.length > 0 ? data.modifiers : null,
    units: data.units,
    charge_amount: data.chargeAmount,
    place_of_service: data.placeOfService || null,
    diagnosis_pointers: data.diagnosisPointers,
  };
}

export const addClaimLineAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('claim_lines').insert({
      ...toRow(data),
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath(`/home/claims/${data.claimId}`);

    return { success: true };
  },
  { schema: AddClaimLineSchema },
);

export const updateClaimLineAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('claim_lines')
      .update({ ...toRow(data), updated_by: user.id })
      .eq('id', data.lineId);

    if (error) {
      throw error;
    }

    revalidatePath(`/home/claims/${data.claimId}`);

    return { success: true };
  },
  { schema: UpdateClaimLineSchema },
);

export const removeClaimLineAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('claim_lines').delete().eq('id', data.lineId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/claims', 'layout');

    return { success: true };
  },
  { schema: RemoveClaimLineSchema },
);
