'use server';

import { revalidatePath } from 'next/cache';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { StartAccessSessionSchema } from '../schema/start-access-session.schema';

/**
 * Starts an audited, time-limited support-access session. The real
 * enforcement -- assigned ticket, support role, one row per attempt -- is
 * the support_access_sessions_insert RLS policy itself; this action just
 * supplies the typed reason and the expiry, and logs the audit_events row
 * (support session start is one of the four security-sensitive action
 * categories this phase names). granted_scope stays '{}' (its column
 * default) -- every session is read-only by construction, since no
 * mechanism in this phase grants a write extension.
 */
export const startAccessSessionAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const expiresAt = new Date(Date.now() + data.durationMinutes * 60_000).toISOString();

    const { data: session, error } = await client
      .from('support_access_sessions')
      .insert({
        organization_id: data.organizationId,
        ticket_id: data.ticketId,
        support_user_id: user.id,
        reason: data.reason,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    await logAuditEvent(client, {
      organizationId: data.organizationId,
      actorId: user.id,
      action: 'support_session.started',
      targetType: 'support_access_session',
      targetId: session.id,
      metadata: { ticketId: data.ticketId, reason: data.reason, expiresAt },
    });

    revalidatePath(`/support/tickets/${data.ticketId}`);
    revalidatePath('/home/support');

    return { sessionId: session.id, expiresAt };
  },
  { schema: StartAccessSessionSchema },
);
