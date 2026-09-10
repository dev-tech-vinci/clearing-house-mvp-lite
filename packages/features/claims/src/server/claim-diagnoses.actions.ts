'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddClaimDiagnosisSchema,
  RemoveClaimDiagnosisSchema,
} from '../schema/claim-diagnosis.schema';

export const addClaimDiagnosisAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('claim_diagnoses').insert({
      organization_id: data.organizationId,
      claim_id: data.claimId,
      diagnosis_code: data.diagnosisCode,
      diagnosis_pointer: data.diagnosisPointer,
      is_primary: data.isPrimary,
      created_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath(`/home/claims/${data.claimId}`);

    return { success: true };
  },
  { schema: AddClaimDiagnosisSchema },
);

export const removeClaimDiagnosisAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('claim_diagnoses')
      .delete()
      .eq('id', data.diagnosisId);

    if (error) {
      throw error;
    }

    revalidatePath('/home/claims', 'layout');

    return { success: true };
  },
  { schema: RemoveClaimDiagnosisSchema },
);
