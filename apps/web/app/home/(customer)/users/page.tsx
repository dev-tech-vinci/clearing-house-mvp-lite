import { PERMISSIONS } from '@kit/access-control/permissions';
import { hasPermission } from '@kit/access-control/server';
import {
  OrganizationMembersPage,
  resolveCurrentOrganizationId,
} from '@kit/organizations/components';
import { createOrganizationsApi } from '@kit/organizations/server/api';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

async function UsersPage() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.users'} />} />

      <PageBody>
        {currentOrganizationId ? (
          <UsersPageContent organizationId={currentOrganizationId} />
        ) : (
          <PlaceholderNotice />
        )}
      </PageBody>
    </>
  );
}

async function UsersPageContent({
  organizationId,
}: {
  organizationId: string;
}) {
  const client = getSupabaseServerClient();
  const api = createOrganizationsApi(client);

  const [members, invitations, canManageMembers] = await Promise.all([
    api.listMembers(organizationId),
    api.listInvitations(organizationId),
    hasPermission(client, organizationId, PERMISSIONS.MEMBERS_INVITE),
  ]);

  return (
    <OrganizationMembersPage
      organizationId={organizationId}
      members={members}
      invitations={invitations}
      canManageMembers={canManageMembers}
    />
  );
}

export default withI18n(UsersPage);
