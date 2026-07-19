import { NextRequest } from 'next/server';

import { z } from 'zod';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requirePlatformPermission,
} from '../../_lib/api-response';

const StartAccessSessionBodySchema = z.object({
  ticketId: z.string().uuid(),
  organizationId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  durationMinutes: z.number().int().min(5).max(240).default(60),
});

/**
 * POST /api/v1/support/access-sessions -- starts an audited, time-limited
 * support-access session. Requires support.access_session.enter. The
 * "must be an assigned ticket" requirement is enforced by the DB itself
 * (support_access_sessions_insert's WITH CHECK), so a support user who
 * hasn't self-assigned the ticket first gets a 403 here, not a 500.
 */
export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();
  const { client, user, errorResponse } = await requireApiUser(correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = StartAccessSessionBodySchema.safeParse(body);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid request body', correlationId, parsed.error.flatten());
  }

  const permissionError = await requirePlatformPermission(
    client,
    'support.access_session.enter',
    correlationId,
  );

  if (permissionError) {
    return permissionError;
  }

  const expiresAt = new Date(Date.now() + parsed.data.durationMinutes * 60_000).toISOString();

  const { data: session, error } = await client
    .from('support_access_sessions')
    .insert({
      organization_id: parsed.data.organizationId,
      ticket_id: parsed.data.ticketId,
      support_user_id: user!.id,
      reason: parsed.data.reason,
      expires_at: expiresAt,
      created_by: user!.id,
    })
    .select('*')
    .single();

  if (error) {
    return apiError(
      403,
      'forbidden',
      'Could not start a support-access session -- the ticket must be assigned to you first',
      correlationId,
    );
  }

  await logAuditEvent(client, {
    organizationId: parsed.data.organizationId,
    actorId: user!.id,
    action: 'support_session.started',
    targetType: 'support_access_session',
    targetId: session.id,
    metadata: { ticketId: parsed.data.ticketId, reason: parsed.data.reason, expiresAt },
    correlationId,
  });

  return apiOk(session, correlationId, 201);
}
