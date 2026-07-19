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
 * GET /api/v1/remittances?organizationId= -- list remittances for an
 * organization. Requires remittances.view.
 */
export async function GET(request: NextRequest) {
  const correlationId = newCorrelationId();
  const { client, errorResponse } = await requireApiUser(correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const organizationId = searchParams.get('organizationId');

  if (!organizationId || !z.string().uuid().safeParse(organizationId).success) {
    return apiError(400, 'validation_error', 'organizationId query parameter is required', correlationId);
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

  const { data, error, count } = await client
    .from('remittances')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  const nextCursor = offset + limit < (count ?? 0) ? String(offset + limit) : null;

  return apiOk({ data, pagination: { limit, count, nextCursor } }, correlationId);
}
