import { NextRequest } from 'next/server';

import { z } from 'zod';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
} from '../../../../_lib/api-response';

/**
 * POST /api/v1/support/access-sessions/{id}/end -- ends a session early.
 * RLS (support_access_sessions_update) is the real gate: only the
 * session's own support user or a support_manager can end it.
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
    return apiError(400, 'validation_error', 'Invalid session id', correlationId);
  }

  const { data: session, error } = await client
    .from('support_access_sessions')
    .update({ ended_at: new Date().toISOString(), ended_by: user!.id })
    .eq('id', id)
    .select('id, organization_id')
    .single();

  if (error) {
    return apiError(403, 'forbidden', error.message, correlationId);
  }

  await logAuditEvent(client, {
    organizationId: session.organization_id,
    actorId: user!.id,
    action: 'support_session.ended',
    targetType: 'support_access_session',
    targetId: session.id,
    correlationId,
  });

  return apiOk(session, correlationId);
}
