import { ProvidersPageContent } from '@kit/entities/components';
import { createEntitiesApi } from '@kit/entities/server/api';
import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { createPayersApi } from '@kit/payers/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

async function ProvidersPage() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.providers'} />} />

      <PageBody>
        {currentOrganizationId ? (
          <ProvidersPageContentLoader organizationId={currentOrganizationId} />
        ) : (
          <PlaceholderNotice />
        )}
      </PageBody>
    </>
  );
}

async function ProvidersPageContentLoader({
  organizationId,
}: {
  organizationId: string;
}) {
  const client = getSupabaseServerClient();
  const api = createEntitiesApi(client);
  const payersApi = createPayersApi(client);

  const [providers, facilities, enrollments, payers] = await Promise.all([
    api.listProviders(organizationId),
    api.listFacilities(organizationId),
    api.listPayerEnrollments(organizationId),
    payersApi.listActivePayers(),
  ]);

  return (
    <ProvidersPageContent
      organizationId={organizationId}
      providers={providers}
      facilities={facilities}
      enrollments={enrollments}
      payers={payers}
    />
  );
}

export default withI18n(ProvidersPage);
