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
 * POST /api/v1/claims/{id}/adjudicate -- the missing REST counterpart to
 * @kit/remittances' adjudicateClaimAction (Phase 7 only built the Server
 * Action; nothing in this repo could adjudicate a claim over HTTP until
 * this route, which the Phase 9 Python client needs to reach paid/denied
 * at all). Deterministic, rule-driven outcome -- see
 * DeterministicClaimProcessor.adjudicate. Idempotent via
 * remittances.claim_id UNIQUE: a second call returns outcome:
 * 'duplicate_ignored', not an error.
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
    .select('organization_id, status')
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
    'claims.approve_submit',
    correlationId,
  );

  if (permissionError) {
    return permissionError;
  }

  if (claim.status !== 'accepted_for_adjudication') {
    return apiError(
      409,
      'conflict',
      'Only a claim accepted for adjudication can be adjudicated -- submit it first',
      correlationId,
    );
  }

  try {
    const processor = new DeterministicClaimProcessor();

    const result = await processor.adjudicate(client, {
      claimId: id,
      organizationId: claim.organization_id,
      userId: user!.id,
    });

    return apiOk(result, correlationId, result.outcome === 'processed' ? 201 : 200);
  } catch (error) {
    return apiError(
      500,
      'internal_error',
      error instanceof Error ? error.message : 'Could not adjudicate claim',
      correlationId,
    );
  }
}
