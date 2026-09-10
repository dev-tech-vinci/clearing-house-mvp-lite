import { NextRequest } from 'next/server';

import { z } from 'zod';

import { AddClaimLineSchema } from '@kit/claims/schema/claim-line.schema';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requireOrgPermission,
} from '../../../_lib/api-response';

const BodySchema = z.object({
  lineNumber: z.coerce.number().int().min(1),
  serviceDate: z.string().min(1),
  procedureCode: z.string().max(10).optional(),
  revenueCode: z.string().max(4).optional(),
  modifiers: z.array(z.string().max(4)).optional(),
  units: z.coerce.number().int().min(1).default(1),
  chargeAmount: z.coerce.number().min(0),
  placeOfService: z.string().max(2).optional(),
  diagnosisPointers: z.array(z.coerce.number().int().min(1).max(12)).default([]),
});

/**
 * POST /api/v1/claims/{id}/lines -- adds a service line. claimType is
 * resolved server-side from the claim itself (not trusted from the body)
 * before validating against AddClaimLineSchema's professional/
 * institutional code-presence refinement.
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
    .select('organization_id, claim_type')
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
  const bodyParsed = BodySchema.safeParse(json);

  if (!bodyParsed.success) {
    return apiError(400, 'validation_error', 'Invalid line payload', correlationId, bodyParsed.error.issues);
  }

  const parsed = AddClaimLineSchema.safeParse({
    ...bodyParsed.data,
    claimId: id,
    organizationId: claim.organization_id,
    claimType: claim.claim_type,
  });

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid line payload', correlationId, parsed.error.issues);
  }

  const { data: line, error } = await client
    .from('claim_lines')
    .insert({
      organization_id: claim.organization_id,
      claim_id: id,
      line_number: parsed.data.lineNumber,
      service_date: parsed.data.serviceDate,
      procedure_code: parsed.data.procedureCode || null,
      revenue_code: parsed.data.revenueCode || null,
      modifiers: parsed.data.modifiers ?? [],
      units: parsed.data.units,
      charge_amount: parsed.data.chargeAmount,
      place_of_service: parsed.data.placeOfService || null,
      diagnosis_pointers: parsed.data.diagnosisPointers,
      created_by: user!.id,
    })
    .select('*')
    .single();

  if (error) {
    return apiError(409, 'conflict', error.message, correlationId);
  }

  return apiOk(line, correlationId, 201);
}
