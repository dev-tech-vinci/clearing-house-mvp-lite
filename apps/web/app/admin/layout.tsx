import { Page, PageMobileNavigation, PageNavigation } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { AdminNav } from '~/components/admin-nav';
import { PortalHeader } from '~/components/portal-header';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

async function AdminLayout({ children }: React.PropsWithChildren) {
  await requireUserInServerComponent();

  return (
    <Page style={'header'}>
      <PageNavigation>
        <PortalHeader label={<Trans i18nKey={'common:adminPortalTitle'} />} />
      </PageNavigation>

      <PageMobileNavigation className={'flex items-center justify-between'}>
        <PortalHeader label={<Trans i18nKey={'common:adminPortalTitle'} />} />
      </PageMobileNavigation>

      <AdminNav />

      {children}
    </Page>
  );
}

export default withI18n(AdminLayout);
