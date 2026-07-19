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
  const { client, user, errorResponse } = await requireApiUser(correlationId);

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
