import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

export interface AuditEventInput {
  organizationId: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Writes one audit_events row. Called from the exact server actions that
 * perform a security-sensitive action (role changes, support session
 * start/end, document access, claim approval/submission) -- there is no
 * trigger-based auto-instrumentation, so a future action that should be
 * audited needs an explicit call here, the same way every other
 * transaction_events/document_access_events writer in this codebase is
 * explicit rather than automatic.
 *
 * Uses the caller's own RLS-scoped client (never service-role), matching
 * every other write in this codebase. The audit_events_insert policy
 * requires actor_id = auth.uid() and either org access or the
 * support.access_session.enter permission, so a caller can only ever log
 * an event as themselves.
 */
export async function logAuditEvent(
  client: SupabaseClient<Database>,
  input: AuditEventInput,
): Promise<void> {
  const { error } = await client.from('audit_events').insert({
    organization_id: input.organizationId,
    actor_id: input.actorId,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    metadata: (input.metadata ?? {}) as never,
    correlation_id: input.correlationId ?? null,
  });

  if (error) {
    throw error;
  }
}
