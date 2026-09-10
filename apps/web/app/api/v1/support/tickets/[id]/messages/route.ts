import { NextRequest } from 'next/server';

import { z } from 'zod';

import {
  apiError,
  apiOk,
  newCorrelationId,
  requireApiUser,
} from '../../../../_lib/api-response';

const CreateMessageBodySchema = z.object({
  body: z.string().min(1),
  isInternalNote: z.boolean().default(false),
});

/**
 * POST /api/v1/support/tickets/{id}/messages -- posts a reply or (support
 * staff only) an internal note. The RLS insert policy is the real gate:
 * a customer's own attempt at is_internal_note=true fails outright.
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
    return apiError(400, 'validation_error', 'Invalid ticket id', correlationId);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateMessageBodySchema.safeParse(body);

  if (!parsed.success) {
    return apiError(400, 'validation_error', 'Invalid request body', correlationId, parsed.error.flatten());
  }

  const { data: ticket, error: ticketError } = await client
    .from('support_tickets')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();

  if (ticketError) {
    return apiError(500, 'internal_error', ticketError.message, correlationId);
  }

  if (!ticket) {
    return apiError(404, 'not_found', 'Ticket not found', correlationId);
  }

  const { data: message, error } = await client
    .from('support_messages')
    .insert({
      organization_id: ticket.organization_id,
      ticket_id: id,
      sender_id: user!.id,
      body: parsed.data.body,
      is_internal_note: parsed.data.isInternalNote,
      created_by: user!.id,
    })
    .select('*')
    .single();

  if (error) {
    return apiError(403, 'forbidden', error.message, correlationId);
  }

  return apiOk(message, correlationId, 201);
}
