import { NextRequest } from 'next/server';

import { z } from 'zod';

import {
  apiError,
  apiOk,
  newCorrelationId,
  parsePagination,
  requireApiUser,
  requireOrgPermission,
} from '../_lib/api-response';

/**
 * GET /api/v1/remittances?organizationId=&claimId= -- list remittances
 * for an organization, optionally narrowed to a single claim (the Phase
 * 9 Python client's "get remittance for this claim" case). Requires
 * remittances.view. Includes the same nested payment/adjustment/EFT
 * detail @kit/remittances' RemittancesApi.getRemittance uses for the UI,
 * so this one endpoint covers both the list and single-claim-detail use
 * cases without a separate /remittances/{id} route.
 */
export async function GET(request: NextRequest) {
  const correlationId = newCorrelationId();
  const { client, errorResponse } = await requireApiUser(request, correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const organizationId = searchParams.get('organizationId');

  if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
    return apiError(400, 'validation_error', 'organizationId query parameter is required', correlationId);
  }

  const claimId = searchParams.get('claimId');

  if (claimId && !z.string().uuid().safeParse(claimId).success) {
    return apiError(400, 'validation_error', 'Invalid claimId query parameter', correlationId);
  }

  const permissionError = await requireOrgPermission(
    client,
    organizationId,
    'remittances.view',
    correlationId,
  );

  if (permissionError) {
    return permissionError;
  }

  const { limit, offset } = parsePagination(searchParams);

  let query = client
    .from('remittances')
    .select(
      `*,
       claim:claims(sim_claim_id, claim_type),
       payer:payers(sim_payer_id, display_name),
       remit_claims(id, charge_amount, paid_amount, patient_responsibility,
         claim_adjustments(*)),
       eft_traces(id, eft_trace_number, amount, effective_date),
       payment_matches(id, matched_amount, matched_at)`,
      { count: 'exact' },
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (claimId) {
    query = query.eq('claim_id', claimId);
  }

  const { data, error, count } = await query;

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  const nextCursor = offset + limit < (count ?? 0) ? String(offset + limit) : null;

  return apiOk({ data, pagination: { limit, count, nextCursor } }, correlationId);
}
