import { PatientsPageContent } from '@kit/entities/components';
import { createEntitiesApi } from '@kit/entities/server/api';
import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

async function PatientsPage() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.patients'} />} />

      <PageBody>
        {currentOrganizationId ? (
          <PatientsPageContentLoader organizationId={currentOrganizationId} />
        ) : (
          <PlaceholderNotice />
        )}
      </PageBody>
    </>
  );
}

async function PatientsPageContentLoader({
  organizationId,
}: {
  organizationId: string;
}) {
  const client = getSupabaseServerClient();
  const api = createEntitiesApi(client);

  const [patients, subscribers, coverages] = await Promise.all([
    api.listPatients(organizationId),
    api.listSubscribers(organizationId),
    api.listCoverages(organizationId),
  ]);

  return (
    <PatientsPageContent
      organizationId={organizationId}
      patients={patients}
      subscribers={subscribers}
      coverages={coverages}
    />
  );
}

export default withI18n(PatientsPage);
