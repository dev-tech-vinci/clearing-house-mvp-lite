import { NextRequest } from 'next/server';

import { z } from 'zod';

import { UpdateClaimNotesSchema } from '@kit/claims/schema/claim.schema';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requireOrgPermission,
} from '../../_lib/api-response';

/**
 * GET /api/v1/claims/{id} -- full claim detail (header + type-specific
 * detail + diagnoses + lines), the same shape @kit/claims' ClaimsApi.getClaim
 * uses for the UI. RLS (has_org_access via claims_read) is the only gate --
 * matches every other read-only claim endpoint in this surface.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = newCorrelationId();
  const { client, errorResponse } = await requireApiUser(request, correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return apiError(400, 'validation_error', 'Invalid claim id', correlationId);
  }

  const { data: claim, error } = await client
    .from('claims')
    .select(
      `*,
       patient:patients(id, first_name, last_name, sim_patient_id),
       subscriber:subscribers(id, first_name, last_name, sim_subscriber_id),
       coverage:coverages(id, payer_id, payer_label, member_id),
       billing_provider:providers!claims_billing_provider_id_fkey(id, sim_provider_id, first_name, last_name, organization_name),
       professional:professional_claim_details(rendering_provider_id, rendering_provider:providers(id, sim_provider_id, first_name, last_name, organization_name)),
       institutional:institutional_claim_details(facility_id, type_of_bill, admission_date, discharge_date, facility:facilities(id, sim_facility_id, name)),
       diagnoses:claim_diagnoses(id, diagnosis_code, diagnosis_pointer, is_primary),
       lines:claim_lines(id, line_number, service_date, procedure_code, revenue_code, modifiers, units, charge_amount, place_of_service, diagnosis_pointers)`,
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  if (!claim) {
    return apiError(404, 'not_found', 'Claim not found', correlationId);
  }

  return apiOk(claim, correlationId);
}

/**
 * PATCH /api/v1/claims/{id} -- update a claim's notes. Requires
 * claims.create_edit in the claim's organization. Editable fields are
 * deliberately limited to `notes` this phase -- header fields (patient,
 * subscriber, coverage, provider/facility, type_of_bill) are set once at
 * creation; changing them is out of scope until a correction/resubmission
 * workflow exists (claim_relationships, later phase).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = newCorrelationId();
  const { client, user, errorResponse } = await requireApiUser(request, correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return apiError(400, 'validation_error', 'Invalid claim id', correlationId);
  }

  const { data: existing, error: fetchError } = await client
    .from('claims')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return apiError(500, 'internal_error', fetchError.message, correlationId);
  }

  if (!existing) {
    return apiError(404, 'not_found', 'Claim not found', correlationId);
  }

  const permissionError = await requireOrgPermission(
    client,
    existing.organization_id,
    'claims.create_edit',
    correlationId,
  );

  if (permissionError) {
    return permissionError;
  }

  const json = await request.json().catch(() => null);
  const parsed = UpdateClaimNotesSchema.omit({ claimId: true }).safeParse(json);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid claim payload', correlationId, parsed.error.issues);
  }

  const { data: claim, error } = await client
    .from('claims')
    .update({ notes: parsed.data.notes ?? null, updated_by: user!.id })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return apiError(409, 'conflict', error.message, correlationId);
  }

  if (!claim) {
    return apiError(404, 'not_found', 'Claim not found', correlationId);
  }

  return apiOk(claim, correlationId);
}
