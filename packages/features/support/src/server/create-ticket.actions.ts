'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CreateTicketSchema } from '../schema/create-ticket.schema';

export const createTicketAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: ticket, error } = await client
      .from('support_tickets')
      .insert({
        organization_id: data.organizationId,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/home/support');

    return { ticketId: ticket.id };
  },
  { schema: CreateTicketSchema },
);
