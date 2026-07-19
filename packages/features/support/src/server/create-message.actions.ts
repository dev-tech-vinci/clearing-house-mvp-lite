'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CreateMessageSchema } from '../schema/create-message.schema';

export const createMessageAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('support_messages').insert({
      organization_id: data.organizationId,
      ticket_id: data.ticketId,
      sender_id: user.id,
      body: data.body,
      is_internal_note: data.isInternalNote,
      created_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath(`/home/support/${data.ticketId}`);
    revalidatePath(`/support/tickets/${data.ticketId}`);

    return { success: true };
  },
  { schema: CreateMessageSchema },
);
