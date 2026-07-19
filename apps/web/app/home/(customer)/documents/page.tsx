import { DocumentsList } from '@kit/documents/components';
import { createDocumentsApi } from '@kit/documents/server/api';
import { resolveCurrentOrganizationId } from '@kit/organizations/components';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { PlaceholderNotice } from '~/components/placeholder-notice';
import { withI18n } from '~/lib/i18n/with-i18n';

function DocumentsPage() {
  return (
    <>
      <PageHeader description={<Trans i18nKey={'common:routes.documents'} />} />

      <PageBody>
        <DocumentsPageContent />
      </PageBody>
    </>
  );
}

async function DocumentsPageContent() {
  const { currentOrganizationId } = await resolveCurrentOrganizationId();

  if (!currentOrganizationId) {
    return <PlaceholderNotice />;
  }

  const client = getSupabaseServerClient();
  const documents = await createDocumentsApi(client).listDocuments(currentOrganizationId);

  return <DocumentsList organizationId={currentOrganizationId} documents={documents} />;
}

export default withI18n(DocumentsPage);
