import { NextRequest } from 'next/server';

import { z } from 'zod';

import { AddClaimDiagnosisSchema } from '@kit/claims/schema/claim-diagnosis.schema';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requireOrgPermission,
} from '../../../_lib/api-response';

const BodySchema = AddClaimDiagnosisSchema.omit({ claimId: true, organizationId: true });

/**
 * POST /api/v1/claims/{id}/diagnoses -- adds a diagnosis pointer to a
 * draft/validation_failed claim. Requires claims.create_edit in the
 * claim's own organization (resolved server-side, not trusted from the
 * body). No dedicated Server Action equivalent exists for this exact
 * shape server-side -- addClaimDiagnosisAction requires the caller to
 * already know organizationId, which this route resolves itself instead.
 */
export async function POST(
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

  const { data: claim, error: fetchError } = await client
    .from('claims')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return apiError(500, 'internal_error', fetchError.message, correlationId);
  }

  if (!claim) {
    return apiError(404, 'not_found', 'Claim not found', correlationId);
  }

  const permissionError = await requireOrgPermission(
    client,
    claim.organization_id,
    'claims.create_edit',
    correlationId,
  );

  if (permissionError) {
    return permissionError;
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid diagnosis payload', correlationId, parsed.error.issues);
  }

  const { data: diagnosis, error } = await client
    .from('claim_diagnoses')
    .insert({
      organization_id: claim.organization_id,
      claim_id: id,
      diagnosis_code: parsed.data.diagnosisCode,
      diagnosis_pointer: parsed.data.diagnosisPointer,
      is_primary: parsed.data.isPrimary,
      created_by: user!.id,
    })
    .select('*')
    .single();

  if (error) {
    return apiError(409, 'conflict', error.message, correlationId);
  }

  return apiOk(diagnosis, correlationId, 201);
}
