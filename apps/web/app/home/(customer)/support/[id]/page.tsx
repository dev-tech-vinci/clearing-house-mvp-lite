import { notFound } from 'next/navigation';

import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { TicketMessages } from '@kit/support/components';
import { createSupportApi } from '@kit/support/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Badge } from '@kit/ui/badge';
import { PageBody, PageHeader } from '@kit/ui/page';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  return (
    <>
      <PageHeader description={'Support ticket'} />

      <PageBody>
        {currentOrganizationId ? (
          <TicketDetailLoader organizationId={currentOrganizationId} ticketId={id} />
        ) : (
          <PlaceholderNotice />
        )}
      </PageBody>
    </>
  );
}

async function TicketDetailLoader({
  organizationId,
  ticketId,
}: {
  organizationId: string;
  ticketId: string;
}) {
  const client = getSupabaseServerClient();
  const supportApi = createSupportApi(client);

  const ticket = await supportApi.getTicket(ticketId).catch(() => null);

  if (!ticket || ticket.organization_id !== organizationId) {
    notFound();
  }

  const messages = await supportApi.listMessages(ticketId);

  return (
    <div className={'flex flex-col space-y-6'}>
      <div className={'flex items-center justify-between'}>
        <div>
          <h2 className={'text-lg font-semibold'}>{ticket.subject}</h2>
          <p className={'text-muted-foreground text-sm'}>{ticket.sim_ticket_id}</p>
        </div>
        <Badge variant={'outline'}>{ticket.status.replaceAll('_', ' ')}</Badge>
      </div>

      <p className={'text-sm'}>{ticket.description}</p>

      <div>
        <h3 className={'mb-3 text-sm font-medium'}>Messages</h3>
        <TicketMessages
          ticketId={ticketId}
          organizationId={organizationId}
          messages={messages.filter((message) => !message.is_internal_note)}
          canPostInternalNotes={false}
        />
      </div>
    </div>
  );
}

export default withI18n(TicketDetailPage);
