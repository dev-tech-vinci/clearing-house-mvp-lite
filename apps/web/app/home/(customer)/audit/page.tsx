import { AuditLogPanel } from '@kit/audit/components';
import { createAuditApi } from '@kit/audit/server/api';
import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

function AuditPage() {
  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.audit'} />} />

      <PageBody>
        <AuditPageContent />
      </PageBody>
    </>
  );
}

async function AuditPageContent() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  if (!currentOrganizationId) {
    return <PlaceholderNotice />;
  }

  const client = getSupabaseServerClient();
  const events = await createAuditApi(client).listEvents(currentOrganizationId);

  return <AuditLogPanel events={events} />;
}

export default withI18n(AuditPage);
