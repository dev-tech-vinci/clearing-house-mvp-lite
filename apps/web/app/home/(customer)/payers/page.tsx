import { PayersDirectory } from '@kit/payers/components';
import { createPayersApi } from '@kit/payers/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { withI18n } from '~/lib/i18n/with-i18n';

async function PayersPage() {
  const client = getSupabaseServerClient();
  const api = createPayersApi(client);
  const payers = await api.listPayers();

  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.payers'} />} />

      <PageBody>
        <PayersDirectory payers={payers} />
      </PageBody>
    </>
  );
}

export default withI18n(PayersPage);
