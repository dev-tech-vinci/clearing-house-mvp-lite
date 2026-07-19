import { hasPermission } from '@kit/access-control/server';
import { PERMISSIONS } from '@kit/access-control/permissions';
import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { RemittancesList } from '@kit/remittances/components';
import { createRemittancesApi } from '@kit/remittances/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

function RemittancesPage() {
  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.remittances'} />} />

      <PageBody>
        <RemittancesPageContent />
      </PageBody>
    </>
  );
}

async function RemittancesPageContent() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  if (!currentOrganizationId) {
    return <PlaceholderNotice />;
  }

  const client = getSupabaseServerClient();
  const remittancesApi = createRemittancesApi(client);

  const [remittances, canPostPayment] = await Promise.all([
    remittancesApi.listRemittances(currentOrganizationId),
    hasPermission(client, currentOrganizationId, PERMISSIONS.REMITTANCES_POST_PAYMENT),
  ]);

  return <RemittancesList remittances={remittances} canPostPayment={canPostPayment} />;
}

export default withI18n(RemittancesPage);
