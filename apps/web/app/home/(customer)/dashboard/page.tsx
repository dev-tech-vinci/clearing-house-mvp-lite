import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { RejectionDenialRatesCard } from '@kit/remittances/components';
import { createRemittancesApi } from '@kit/remittances/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

function DashboardPage() {
  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.dashboard'} />} />

      <PageBody>
        <DashboardPageContent />
      </PageBody>
    </>
  );
}

async function DashboardPageContent() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  if (!currentOrganizationId) {
    return <PlaceholderNotice />;
  }

  const client = getSupabaseServerClient();
  const stats = await createRemittancesApi(client).getClaimOutcomeStats(currentOrganizationId);

  return <RejectionDenialRatesCard stats={stats} />;
}

export default withI18n(DashboardPage);
