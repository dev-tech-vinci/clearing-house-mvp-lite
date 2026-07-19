'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  ApproveClaimSchema,
  CreateInstitutionalClaimSchema,
  CreateProfessionalClaimSchema,
  UpdateClaimNotesSchema,
  ValidateClaimSchema,
} from '../schema/claim.schema';
import { runClaimValidation } from './validate-claim.server';

export const createProfessionalClaimAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { data: claim, error } = await client.rpc('create_professional_claim', {
      p_organization_id: data.organizationId,
      p_patient_id: data.patientId,
      p_subscriber_id: data.subscriberId,
      p_coverage_id: data.coverageId,
      p_billing_provider_id: data.billingProviderId,
      p_rendering_provider_id: data.renderingProviderId,
      p_notes: data.notes || undefined,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/home/claims');

    return claim;
  },
  { schema: CreateProfessionalClaimSchema },
);

export const createInstitutionalClaimAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    const { data: claim, error } = await client.rpc('create_institutional_claim', {
      p_organization_id: data.organizationId,
      p_patient_id: data.patientId,
      p_subscriber_id: data.subscriberId,
      p_coverage_id: data.coverageId,
      p_billing_provider_id: data.billingProviderId,
      p_facility_id: data.facilityId,
      p_type_of_bill: data.typeOfBill,
      p_admission_date: data.admissionDate || undefined,
      p_discharge_date: data.dischargeDate || undefined,
      p_notes: data.notes || undefined,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/home/claims');

    return claim;
  },
  { schema: CreateInstitutionalClaimSchema },
);

export const updateClaimNotesAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('claims')
      .update({ notes: data.notes ?? null, updated_by: user.id })
      .eq('id', data.claimId);

    if (error) {
      throw error;
    }

    revalidatePath(`/home/claims/${data.claimId}`);

    return { success: true };
  },
  { schema: UpdateClaimNotesSchema },
);

/**
 * Wires claim validation to the Phase 4 rule catalog: fetches the claim's
 * current data, resolves which universal / claim_type / payer_edit rules
 * apply (adjudication-category rules are post-adjudication and
 * intentionally not evaluated here -- see docs/05-claim-lifecycle.md),
 * runs evaluateClaimRules (the deterministic predicate map), and persists
 * the result. The explanation text shown to the user always comes from
 * the live payer_rule_versions row picked up in this fetch, not a
 * hardcoded string.
 */
export const validateClaimAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const result = await runClaimValidation(client, user.id, data.claimId);

    revalidatePath(`/home/claims/${data.claimId}`);

    return result;
  },
  { schema: ValidateClaimSchema },
);

/**
 * Sets status='approved'. The real gate is RLS (claims_update_approve
 * requires claims.approve_submit -- see the migration); the
 * .eq('status', 'validated') guard here just prevents skipping validation,
 * it is not the security boundary.
 */
export const approveClaimAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: updated, error } = await client
      .from('claims')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        updated_by: user.id,
      })
      .eq('id', data.claimId)
      .eq('status', 'validated')
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!updated) {
      throw new Error(
        'Claim could not be approved -- it must be validated first, or you may not have the claims.approve_submit permission.',
      );
    }

    revalidatePath(`/home/claims/${data.claimId}`);
    revalidatePath('/home/claims');

    return { success: true };
  },
  { schema: ApproveClaimSchema },
);
