import { NextRequest } from 'next/server';

import { z } from 'zod';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';

import { DeterministicClaimProcessor } from 'worker/claim-processor';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requireOrgPermission,
} from '../../../_lib/api-response';

/**
 * POST /api/v1/claims/{id}/submit -- submits an approved claim. Honors a
 * client-supplied `Idempotency-Key` header per CLAUDE.md's API contract,
 * falling back to a deterministic `submit:{claimId}` key. Either way, the
 * real idempotency guarantee is `processing_jobs.claim_id` being UNIQUE,
 * not the header value itself -- see docs/progress/DECISIONS.md.
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

  if (claim.status !== 'approved') {
    return apiError(
      409,
      'conflict',
      'Only an approved claim can be submitted -- validate and approve it first',
      correlationId,
    );
  }

  const idempotencyKey = request.headers.get('Idempotency-Key') || `submit:${id}`;

  try {
    const processor = new DeterministicClaimProcessor();

    const result = await processor.process(client, {
      claimId: id,
      organizationId: claim.organization_id,
      userId: user!.id,
      idempotencyKey,
    });

    if (result.outcome !== 'duplicate_ignored') {
      await logAuditEvent(client, {
        organizationId: claim.organization_id,
        actorId: user!.id,
        action: 'claim.submitted',
        targetType: 'claim',
        targetId: id,
        correlationId,
      });
    }

    return apiOk(result, correlationId, result.outcome === 'processed' ? 201 : 200);
  } catch (error) {
    return apiError(
      500,
      'internal_error',
      error instanceof Error ? error.message : 'Could not submit claim',
      correlationId,
    );
  }
}
