import { NextRequest } from 'next/server';

import { z } from 'zod';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
  requireOrgPermission,
} from '../../_lib/api-response';

const CreateTicketBodySchema = z.object({
  organizationId: z.string().uuid(),
  subject: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

/**
 * POST /api/v1/support/tickets -- opens a support ticket. Requires
 * support.tickets.create on the target organization.
 */
export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();
  const { client, user, errorResponse } = await requireApiUser(request, correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateTicketBodySchema.safeParse(body);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid request body', correlationId, parsed.error.flatten());
  }

  const permissionError = await requireOrgPermission(
    client,
    parsed.data.organizationId,
    'support.tickets.create',
    correlationId,
  );

  if (permissionError) {
    return permissionError;
  }

  const { data: ticket, error } = await client
    .from('support_tickets')
    .insert({
      organization_id: parsed.data.organizationId,
      subject: parsed.data.subject,
      description: parsed.data.description,
      priority: parsed.data.priority,
      created_by: user!.id,
      updated_by: user!.id,
    })
    .select('*')
    .single();

  if (error) {
    return apiError(500, 'internal_error', error.message, correlationId);
  }

  return apiOk(ticket, correlationId, 201);
}
