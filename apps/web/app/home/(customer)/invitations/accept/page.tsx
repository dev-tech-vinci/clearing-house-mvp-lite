import { AcceptInvitationPanel } from '@kit/organizations/components';
import { PageBody, PageHeader } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

async function AcceptInvitationPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <>
      <PageHeader description={'Accept invitation'} />

      <PageBody>
        {token ? (
          <AcceptInvitationPanel
            token={token}
            homeHref={pathsConfig.app.home}
          />
        ) : (
          <p className={'text-muted-foreground text-sm'}>
            This invitation link is missing its token.
          </p>
        )}
      </PageBody>
    </>
  );
}

export default withI18n(AcceptInvitationPage);
