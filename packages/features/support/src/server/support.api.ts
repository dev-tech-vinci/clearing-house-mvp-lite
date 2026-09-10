import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@kit/supabase/database';

/**
 * Read side of the support portal. Ticket-queue scoping (support_manager
 * sees everything, support_agent sees only assigned/unassigned tickets,
 * a customer org sees only its own tickets) is entirely enforced by RLS
 * (support_tickets_read) -- these methods run no client-side filtering
 * on top of it.
 */
class SupportApi {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listTickets(organizationId?: string) {
    let query = this.client
      .from('support_tickets')
      .select('*, organization:organizations(name)')
      .order('created_at', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data;
  }

  async getTicket(ticketId: string) {
    const { data, error } = await this.client
      .from('support_tickets')
      .select('*, organization:organizations(name)')
      .eq('id', ticketId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async listMessages(ticketId: string) {
    const { data, error } = await this.client
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }

  /** Support-access history for a ticket -- visible to the customer org (has_org_access) and to support staff, per support_access_sessions_read. */
  async listAccessSessions(ticketId: string) {
    const { data, error } = await this.client
      .from('support_access_sessions')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('started_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }

  async getActiveAccessSession(organizationId: string, supportUserId: string) {
    const { data, error } = await this.client
      .from('support_access_sessions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('support_user_id', supportUserId)
      .is('ended_at', null)
      .gt('expires_at', new Date().toISOString())
      .lte('started_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }
}

export function createSupportApi(client: SupabaseClient<Database>) {
  return new SupportApi(client);
}
