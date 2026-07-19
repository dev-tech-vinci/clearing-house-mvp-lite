import { hasRole } from '@kit/access-control/server';
import { ROLES } from '@kit/access-control/roles';
import { TicketsList } from '@kit/support/components';
import { createSupportApi } from '@kit/support/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

function SupportTicketsPage() {
  return (
    <>
      <PageHeader description={'Support ticket queue'} />

      <PageBody>
        <SupportTicketsPageContent />
      </PageBody>
    </>
  );
}

async function SupportTicketsPageContent() {
  const client = getSupabaseServerClient();

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

  const tickets = await createSupportApi(client).listTickets();

  return (
    <TicketsList
      tickets={tickets}
      basePath={'/support/tickets'}
      showOrganization
    />
  );
}

export default withI18n(SupportTicketsPage);
