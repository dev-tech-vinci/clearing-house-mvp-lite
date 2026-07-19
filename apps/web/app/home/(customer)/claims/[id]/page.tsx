import { notFound } from 'next/navigation';

import { hasPermission } from '@kit/access-control/server';
import { PERMISSIONS } from '@kit/access-control/permissions';
import type { ClaimDetail } from '@kit/claims/components';
import { ClaimDetailPageContent } from '@kit/claims/components';
import { createClaimsApi } from '@kit/claims/server/api';
import { SubmitClaimButton } from '@kit/edi/components';
import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { TransactionTracePanel } from '@kit/transaction-trace/components';
import { createTraceApi } from '@kit/transaction-trace/server/api';
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
  const traceApi = createTraceApi(client);

  const [claim, canCreateEdit, canApprove, trace] = await Promise.all([
    claimsApi.getClaim(organizationId, claimId).catch(() => null),
    hasPermission(client, organizationId, PERMISSIONS.CLAIMS_CREATE_EDIT),
    hasPermission(client, organizationId, PERMISSIONS.CLAIMS_APPROVE_SUBMIT),
    traceApi.getClaimTrace(organizationId, claimId),
  ]);

  if (!claim) {
    notFound();
  }

  return (
    <div className={'flex flex-col space-y-8'}>
      <ClaimDetailPageContent
        organizationId={organizationId}
        claim={claim as unknown as ClaimDetail}
        canCreateEdit={canCreateEdit}
        canApprove={canApprove}
      />

      <div className={'flex justify-end'}>
        <SubmitClaimButton claimId={claimId} canSubmit={canApprove} claimStatus={claim.status} />
      </div>

      <div>
        <h3 className={'mb-3 text-sm font-medium'}>Transaction trace</h3>
        <TransactionTracePanel events={trace} />
      </div>
    </div>
  );
}

export default withI18n(ClaimDetailPage);
