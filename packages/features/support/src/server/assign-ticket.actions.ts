'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { AssignTicketSchema, UpdateTicketStatusSchema } from '../schema/assign-ticket.schema';

/**
 * Self-assigns a ticket to the calling support user. This is the
 * prerequisite step before starting an access session -- the DB itself
 * (support_access_sessions_insert's WITH CHECK) requires the ticket's
 * assigned_to to already equal the entering user, so a session can never
 * be started against a ticket the support user hasn't first picked up.
 */
export const assignTicketAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error: ticketError } = await client
      .from('support_tickets')
      .update({ assigned_to: user.id, status: 'in_progress', updated_by: user.id })
      .eq('id', data.ticketId);

    if (ticketError) {
      throw ticketError;
    }

    const { error: assignmentError } = await client.from('support_assignments').insert({
      organization_id: data.organizationId,
      ticket_id: data.ticketId,
      support_user_id: user.id,
      assigned_by: user.id,
    });

    if (assignmentError) {
      throw assignmentError;
    }

    revalidatePath('/support/tickets');
    revalidatePath(`/support/tickets/${data.ticketId}`);

    return { success: true };
  },
  { schema: AssignTicketSchema },
);

export const updateTicketStatusAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('support_tickets')
      .update({
        status: data.status,
        updated_by: user.id,
        closed_at: data.status === 'closed' ? new Date().toISOString() : null,
      })
      .eq('id', data.ticketId);

    if (error) {
      throw error;
    }

    revalidatePath('/support/tickets');
    revalidatePath(`/support/tickets/${data.ticketId}`);
    revalidatePath(`/home/support/${data.ticketId}`);

    return { success: true };
  },
  { schema: UpdateTicketStatusSchema },
);
