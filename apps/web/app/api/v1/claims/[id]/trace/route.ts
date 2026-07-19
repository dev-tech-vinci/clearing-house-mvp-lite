import { NextRequest } from 'next/server';

import { z } from 'zod';

import { apiError, apiOk, newCorrelationId, requireApiUser } from '../../../_lib/api-response';

/**
 * GET /api/v1/claims/{id}/trace -- the ordered transaction_events trace
 * for a claim. Read-only, gated only by org access (RLS) -- no finer
 * permission, matching the Transaction Trace UI's own visibility.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = newCorrelationId();
  const { client, errorResponse } = await requireApiUser(correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return apiError(400, 'validation_error', 'Invalid claim id', correlationId);
  }

  const { data, error } = await client
    .from('transaction_events')
    .select(
      `*,
       payer:payers(id, sim_payer_id, display_name),
       rule:payer_rules(id, rule_code)`,
    )
    .eq('claim_id', id)
    .order('occurred_at', { ascending: true });

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  return apiOk({ data }, correlationId);
}
