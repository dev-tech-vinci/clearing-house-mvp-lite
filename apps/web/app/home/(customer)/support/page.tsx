import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { CreateTicketDialog, SupportAccessHistory, TicketsList } from '@kit/support/components';
import { createSupportApi } from '@kit/support/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

function SupportPage() {
  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.support'} />} />

      <PageBody>
        <SupportPageContent />
      </PageBody>
    </>
  );
}

async function SupportPageContent() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  if (!currentOrganizationId) {
    return <PlaceholderNotice />;
  }

  const client = getSupabaseServerClient();
  const supportApi = createSupportApi(client);

  const [tickets, accessSessions] = await Promise.all([
    supportApi.listTickets(currentOrganizationId),
    client
      .from('support_access_sessions')
      .select('*')
      .eq('organization_id', currentOrganizationId)
      .order('started_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }

        return data;
      }),
  ]);

  return (
    <div className={'flex flex-col space-y-8'}>
      <div className={'flex flex-col space-y-4'}>
        <div className={'flex justify-end'}>
          <CreateTicketDialog organizationId={currentOrganizationId} />
        </div>

        <TicketsList
          tickets={tickets}
          basePath={'/home/support'}
        />
      </div>

      <div>
        <h3 className={'mb-3 text-sm font-medium'}>Support access history</h3>
        <SupportAccessHistory sessions={accessSessions} />
      </div>
    </div>
  );
}

export default withI18n(SupportPage);
