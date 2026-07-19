'use server';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { GetSignedUrlSchema } from '../schema/get-signed-url.schema';

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Issues a short-TTL signed URL for a document -- the only way a
 * document is ever served, never a public bucket URL. The
 * storage.createSignedUrl call itself runs through the caller's own
 * RLS-scoped client, so it can only succeed if the org_documents_select
 * storage policy already allows the caller to see that object (org
 * membership + documents.view_download, or an active support_access_sessions
 * row) -- this action does not add a second access check on top of RLS,
 * it relies on RLS being the real gate and only logs what RLS already
 * allowed. Every call is logged to document_access_events (and, since
 * document access is one of the four security-sensitive action
 * categories this phase names, to audit_events too).
 */
export const getDocumentSignedUrlAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: document, error: documentError } = await client
      .from('documents')
      .select('id, organization_id, storage_path, file_name')
      .eq('id', data.documentId)
      .single();

    if (documentError) {
      throw documentError;
    }

    const { data: signed, error: signError } = await client.storage
      .from('org_documents')
      .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);

    if (signError) {
      throw signError;
    }

    const { data: activeSession } = await client
      .from('support_access_sessions')
      .select('id')
      .eq('organization_id', document.organization_id)
      .eq('support_user_id', user.id)
      .is('ended_at', null)
      .gt('expires_at', new Date().toISOString())
      .lte('started_at', new Date().toISOString())
      .maybeSingle();

    const { error: eventError } = await client.from('document_access_events').insert({
      organization_id: document.organization_id,
      document_id: document.id,
      accessed_by: user.id,
      access_type: data.accessType,
      support_access_session_id: activeSession?.id ?? null,
    });

    if (eventError) {
      throw eventError;
    }

    await logAuditEvent(client, {
      organizationId: document.organization_id,
      actorId: user.id,
      action: `document.${data.accessType}`,
      targetType: 'document',
      targetId: document.id,
      metadata: { fileName: document.file_name, viaSupportSession: Boolean(activeSession) },
    });

    return { signedUrl: signed.signedUrl, fileName: document.file_name };
  },
  { schema: GetSignedUrlSchema },
);
