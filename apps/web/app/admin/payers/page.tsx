import { PayersAdminTable } from '@kit/payers/components';
import { createPayersApi } from '@kit/payers/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminAccessDenied } from '~/components/admin-access-denied';
import { withI18n } from '~/lib/i18n/with-i18n';

async function AdminPayersPage() {
  const client = getSupabaseServerClient();

  const { data: isAdmin } = await client.rpc('is_platform_admin');

  return (
    <>
      <PageHeader description={'Global Payer Directory'} />

      <PageBody>
        {isAdmin ? (
          <PayersAdminTable payers={await createPayersApi(client).listPayers()} />
        ) : (
          <AdminAccessDenied />
        )}
      </PageBody>
    </>
  );
}

export default withI18n(AdminPayersPage);
