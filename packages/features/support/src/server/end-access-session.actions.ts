'use server';

import { revalidatePath } from 'next/cache';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { EndAccessSessionSchema } from '../schema/start-access-session.schema';

export const endAccessSessionAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: session, error } = await client
      .from('support_access_sessions')
      .update({ ended_at: new Date().toISOString(), ended_by: user.id })
      .eq('id', data.sessionId)
      .select('id, ticket_id')
      .single();

    if (error) {
      throw error;
    }

    await logAuditEvent(client, {
      organizationId: data.organizationId,
      actorId: user.id,
      action: 'support_session.ended',
      targetType: 'support_access_session',
      targetId: session.id,
    });

    revalidatePath(`/support/tickets/${session.ticket_id}`);
    revalidatePath('/home/support');

    return { success: true };
  },
  { schema: EndAccessSessionSchema },
);
