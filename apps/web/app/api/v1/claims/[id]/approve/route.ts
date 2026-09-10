import { NextRequest } from 'next/server';

import { z } from 'zod';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
} from '../../../_lib/api-response';

/**
 * POST /api/v1/claims/{id}/approve -- sets status='approved'. The real
 * RBAC gate is RLS (claims_update_approve requires claims.approve_submit
 * -- see 20260719030000_claims.sql); the .eq('status', 'validated') guard
 * here only prevents skipping validation, it is not the security boundary.
 * A claims_specialist calling this endpoint gets 0 rows updated by RLS,
 * reported here as 409 -- proven at the RLS layer by
 * apps/web/supabase/tests/database/claims-rls.test.sql, not just by this
 * endpoint's behavior.
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

  const { data: claim, error } = await client
    .from('claims')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user!.id,
      updated_by: user!.id,
    })
    .eq('id', id)
    .eq('status', 'validated')
    .select('*')
    .maybeSingle();

  if (error) {
    return apiError(409, 'conflict', error.message, correlationId);
  }

  if (!claim) {
    return apiError(
      409,
      'conflict',
      'Claim could not be approved -- it must be validated first, or you may not have the claims.approve_submit permission',
      correlationId,
    );
  }

  await logAuditEvent(client, {
    organizationId: claim.organization_id,
    actorId: user!.id,
    action: 'claim.approved',
    targetType: 'claim',
    targetId: claim.id,
    correlationId,
  });

  return apiOk(claim, correlationId);
}
