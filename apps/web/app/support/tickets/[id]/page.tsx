import { notFound } from 'next/navigation';

import { hasRole } from '@kit/access-control/server';
import { ROLES } from '@kit/access-control/roles';
import { createDocumentsApi } from '@kit/documents/server/api';
import { createRemittancesApi } from '@kit/remittances/server/api';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import {
  AccessSessionControl,
  AssignTicketButton,
  TicketMessages,
  TicketStatusSelect,
} from '@kit/support/components';
import { createSupportApi } from '@kit/support/server/api';
import { Badge } from '@kit/ui/badge';
import { PageBody, PageHeader } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <PageHeader description={'Support ticket'} />

      <PageBody>
        <TicketDetailLoader ticketId={id} />
      </PageBody>
    </>
  );
}

async function TicketDetailLoader({ ticketId }: { ticketId: string }) {
  const client = getSupabaseServerClient();
  const auth = await requireUser(client);

  if (auth.error) {
    notFound();
  }

  const [isManager, isAgent] = await Promise.all([
    hasRole(client, ROLES.SUPPORT_MANAGER),
    hasRole(client, ROLES.SUPPORT_AGENT),
  ]);

  if (!isManager && !isAgent) {
    return (
      <div
        className={
          'border-destructive/50 text-destructive rounded-md border border-dashed p-8 text-sm'
        }
      >
        <p className={'font-medium'}>Access restricted</p>
        <p className={'mt-2'}>
          This page is only available to Support Managers and Support Agents.
        </p>
      </div>
    );
  }

  const supportApi = createSupportApi(client);
  const ticket = await supportApi.getTicket(ticketId).catch(() => null);

  if (!ticket) {
    notFound();
  }

  const [messages, activeSession] = await Promise.all([
    supportApi.listMessages(ticketId),
    supportApi.getActiveAccessSession(ticket.organization_id, auth.data.id),
  ]);

  // Only populated when a session is active -- the "least-privilege
  // read-only" data support can see is exactly the remittances/documents
  // an org member with remittances.view/documents.view_download would
  // see, made visible here only via has_active_support_session().
  const [remittances, documents] = activeSession
    ? await Promise.all([
        createRemittancesApi(client).listRemittances(ticket.organization_id),
        createDocumentsApi(client).listDocuments(ticket.organization_id),
      ])
    : [null, null];

  return (
    <div className={'flex flex-col space-y-6'}>
      <div className={'flex items-center justify-between'}>
        <div>
          <h2 className={'text-lg font-semibold'}>{ticket.subject}</h2>
          <p className={'text-muted-foreground text-sm'}>
            {ticket.sim_ticket_id} -- {ticket.organization?.name}
          </p>
        </div>
        <div className={'flex items-center gap-x-2'}>
          <Badge variant={'outline'}>{ticket.priority}</Badge>
          <TicketStatusSelect
            ticketId={ticketId}
            organizationId={ticket.organization_id}
            status={ticket.status}
          />
        </div>
      </div>

      <p className={'text-sm'}>{ticket.description}</p>

      {!ticket.assigned_to && (
        <div>
          <AssignTicketButton ticketId={ticketId} organizationId={ticket.organization_id} />
        </div>
      )}

      <div>
        <h3 className={'mb-3 text-sm font-medium'}>Support access</h3>
        <AccessSessionControl
          ticketId={ticketId}
          organizationId={ticket.organization_id}
          isAssignedToMe={ticket.assigned_to === auth.data.id}
          activeSession={
            activeSession
              ? {
                  id: activeSession.id,
                  reason: activeSession.reason,
                  started_at: activeSession.started_at,
                  expires_at: activeSession.expires_at,
                }
              : null
          }
        />
      </div>

      {activeSession && (
        <div className={'flex flex-col space-y-4'}>
          <div>
            <h3 className={'mb-2 text-sm font-medium'}>Customer remittances (session-scoped)</h3>
            <ul className={'space-y-1 text-sm'}>
              {(remittances ?? []).map((remittance) => (
                <li key={remittance.id} className={'rounded-md border p-2'}>
                  {remittance.sim_remittance_id} -- {remittance.outcome} -- $
                  {Number(remittance.total_paid_amount).toFixed(2)}
                </li>
              ))}
              {(remittances ?? []).length === 0 && (
                <li className={'text-muted-foreground'}>No remittances yet.</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className={'mb-2 text-sm font-medium'}>Customer documents (session-scoped)</h3>
            <ul className={'space-y-1 text-sm'}>
              {(documents ?? []).map((document) => (
                <li key={document.id} className={'rounded-md border p-2'}>
                  {document.sim_document_id} -- {document.file_name}
                </li>
              ))}
              {(documents ?? []).length === 0 && (
                <li className={'text-muted-foreground'}>No documents yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div>
        <h3 className={'mb-3 text-sm font-medium'}>Messages</h3>
        <TicketMessages
          ticketId={ticketId}
          organizationId={ticket.organization_id}
          messages={messages}
          canPostInternalNotes
        />
      </div>
    </div>
  );
}

export default withI18n(TicketDetailPage);
