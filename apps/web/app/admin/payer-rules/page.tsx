import { PayerRulesAdminTable } from '@kit/payer-rules/components';
import { createPayerRulesApi } from '@kit/payer-rules/server/api';
import { createPayersApi } from '@kit/payers/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminAccessDenied } from '~/components/admin-access-denied';
import { withI18n } from '~/lib/i18n/with-i18n';

async function AdminPayerRulesPage() {
  const client = getSupabaseServerClient();

  const { data: isAdmin } = await client.rpc('is_platform_admin');

  let content = <AdminAccessDenied />;

  if (isAdmin) {
    const [rules, payers] = await Promise.all([
      createPayerRulesApi(client).listRules(),
      createPayersApi(client).listActivePayers(),
    ]);

    content = <PayerRulesAdminTable rules={rules} payers={payers} />;
  }

  return (
    <>
      <PageHeader description={'Payer Rule Management'} />

      <PageBody>{content}</PageBody>
    </>
  );
}

export default withI18n(AdminPayerRulesPage);
