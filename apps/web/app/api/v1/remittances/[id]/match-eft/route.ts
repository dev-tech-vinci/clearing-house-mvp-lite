import { NextRequest } from 'next/server';

import { z } from 'zod';

import { DeterministicClaimProcessor } from 'worker/claim-processor';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requireOrgPermission,
} from '../../../_lib/api-response';

/**
 * POST /api/v1/remittances/{id}/match-eft -- the explicit reconciliation
 * step. Requires remittances.post_payment. Idempotent -- a second call
 * for the same remittance's EFT trace is a no-op (payment_matches.eft_trace_id
 * is UNIQUE).
 */
export async function POST(
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
    return apiError(400, 'validation_error', 'Invalid remittance id', correlationId);
  }

  const { data: remittance, error: fetchError } = await client
    .from('remittances')
    .select('organization_id, outcome')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return apiError(500, 'internal_error', fetchError.message, correlationId);
  }

  if (!remittance) {
    return apiError(404, 'not_found', 'Remittance not found', correlationId);
  }

  const permissionError = await requireOrgPermission(
    client,
    remittance.organization_id,
    'remittances.post_payment',
    correlationId,
  );

  if (permissionError) {
    return permissionError;
  }

  if (remittance.outcome !== 'paid') {
    return apiError(
      409,
      'conflict',
      'Only a paid remittance can be matched to an EFT deposit',
      correlationId,
    );
  }

  try {
    const processor = new DeterministicClaimProcessor();

    const result = await processor.matchEft(client, {
      remittanceId: id,
      organizationId: remittance.organization_id,
      userId: user!.id,
    });

    return apiOk(result, correlationId, result.outcome === 'processed' ? 201 : 200);
  } catch (error) {
    return apiError(
      500,
      'internal_error',
      error instanceof Error ? error.message : 'Could not match EFT deposit',
      correlationId,
    );
  }
}
