import { notFound } from 'next/navigation';

import { hasPermission } from '@kit/access-control/server';
import { PERMISSIONS } from '@kit/access-control/permissions';
import type { ClaimDetail } from '@kit/claims/components';
import { ClaimDetailPageContent } from '@kit/claims/components';
import { createClaimsApi } from '@kit/claims/server/api';
import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  return (
    <>
      <PageHeader description={'Claim detail'} />

      <PageBody>
        {currentOrganizationId ? (
          <ClaimDetailLoader organizationId={currentOrganizationId} claimId={id} />
        ) : (
          <PlaceholderNotice />
        )}
      </PageBody>
    </>
  );
}

async function ClaimDetailLoader({
  organizationId,
  claimId,
}: {
  organizationId: string;
  claimId: string;
}) {
  const client = getSupabaseServerClient();
  const claimsApi = createClaimsApi(client);

  const [claim, canCreateEdit, canApprove] = await Promise.all([
    claimsApi.getClaim(organizationId, claimId).catch(() => null),
    hasPermission(client, organizationId, PERMISSIONS.CLAIMS_CREATE_EDIT),
    hasPermission(client, organizationId, PERMISSIONS.CLAIMS_APPROVE_SUBMIT),
  ]);

  if (!claim) {
    notFound();
  }

  return (
    <ClaimDetailPageContent
      organizationId={organizationId}
      claim={claim as unknown as ClaimDetail}
      canCreateEdit={canCreateEdit}
      canApprove={canApprove}
    />
  );
}

export default withI18n(ClaimDetailPage);
