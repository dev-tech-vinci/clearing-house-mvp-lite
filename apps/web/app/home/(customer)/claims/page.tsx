import { hasPermission } from '@kit/access-control/server';
import { PERMISSIONS } from '@kit/access-control/permissions';
import { ClaimsList } from '@kit/claims/components';
import { createClaimsApi } from '@kit/claims/server/api';
import { createEntitiesApi } from '@kit/entities/server/api';
import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

async function ClaimsPage() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.claims'} />} />

      <PageBody>
        {currentOrganizationId ? (
          <ClaimsPageContentLoader organizationId={currentOrganizationId} />
        ) : (
          <PlaceholderNotice />
        )}
      </PageBody>
    </>
  );
}

async function ClaimsPageContentLoader({ organizationId }: { organizationId: string }) {
  const client = getSupabaseServerClient();
  const claimsApi = createClaimsApi(client);
  const entitiesApi = createEntitiesApi(client);

  const [claims, subscribers, coverages, providers, facilities, canCreateEdit] =
    await Promise.all([
      claimsApi.listClaims(organizationId),
      entitiesApi.listSubscribers(organizationId),
      entitiesApi.listCoverages(organizationId),
      entitiesApi.listProviders(organizationId),
      entitiesApi.listFacilities(organizationId),
      hasPermission(client, organizationId, PERMISSIONS.CLAIMS_CREATE_EDIT),
    ]);

  return (
    <ClaimsList
      organizationId={organizationId}
      claims={claims}
      subscribers={subscribers}
      coverages={coverages}
      providers={providers}
      facilities={facilities}
      canCreateEdit={canCreateEdit}
    />
  );
}

export default withI18n(ClaimsPage);
