import { NextRequest } from 'next/server';

import { z } from 'zod';

import { runClaimValidation } from '@kit/claims/server/validate-claim';

import { apiError, apiOk, newCorrelationId, requireApiUser } from '../../../_lib/api-response';

/**
 * POST /api/v1/claims/{id}/validate -- runs the same validation core as
 * the UI's validateClaimAction (packages/features/claims/src/server/
 * validate-claim.server.ts), so the REST and Server Action paths can never
 * disagree on what "valid" means. RLS (has_org_access via claims_read)
 * gates visibility; no separate permission check is needed here since
 * validating doesn't change who owns the claim, only its status.
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

  try {
    const result = await runClaimValidation(client, user!.id, id);

    return apiOk(result, correlationId);
  } catch (error) {
    return apiError(
      404,
      'not_found',
      error instanceof Error ? error.message : 'Claim not found',
      correlationId,
    );
  }
}
