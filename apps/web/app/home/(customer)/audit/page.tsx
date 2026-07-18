import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

function AuditPage() {
  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.audit'} />} />

      <PageBody>
        <PlaceholderNotice />
      </PageBody>
    </>
  );
}

export default withI18n(AuditPage);
