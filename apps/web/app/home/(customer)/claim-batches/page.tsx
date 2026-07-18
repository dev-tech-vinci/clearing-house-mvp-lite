import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

function ClaimBatchesPage() {
  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.claimBatches'} />} />

      <PageBody>
        <PlaceholderNotice />
      </PageBody>
    </>
  );
}

export default withI18n(ClaimBatchesPage);
