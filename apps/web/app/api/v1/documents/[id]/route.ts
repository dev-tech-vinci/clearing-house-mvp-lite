import { NextRequest } from 'next/server';

import { z } from 'zod';

import { logAuditEvent } from '@kit/audit/server/log-audit-event';

import { apiError, apiOk, newCorrelationId, requireApiUser } from '../../_lib/api-response';

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * GET /api/v1/documents/{id}?accessType=view|download -- issues a
 * short-TTL signed URL, the REST counterpart to
 * @kit/documents' getDocumentSignedUrlAction (Phase 8 only built the
 * Server Action). RLS on the `documents` row and the `org_documents`
 * Storage bucket is the only access check -- a caller who can't already
 * SELECT the row/object gets a 404, not a 403, matching Supabase Storage's
 * own not-found-vs-forbidden behavior for a private bucket. Every call
 * logs both document_access_events and audit_events, same as the action.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = newCorrelationId();
  const { client, user, errorResponse } = await requireApiUser(request, correlationId);

  if (errorResponse) {
    return errorResponse;
  }

  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return apiError(400, 'validation_error', 'Invalid document id', correlationId);
  }

  const accessTypeParam = request.nextUrl.searchParams.get('accessType') ?? 'view';
  const accessType = accessTypeParam === 'download' ? 'download' : 'view';

  const { data: document, error: documentError } = await client
    .from('documents')
    .select('id, organization_id, storage_path, file_name')
    .eq('id', id)
    .maybeSingle();

  if (documentError) {
    return apiError(500, 'internal_error', documentError.message, correlationId);
  }

  if (!document) {
    return apiError(404, 'not_found', 'Document not found', correlationId);
  }

  const { data: signed, error: signError } = await client.storage
    .from('org_documents')
    .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signError) {
    return apiError(404, 'not_found', 'Document not found', correlationId);
  }

  const { data: activeSession } = await client
    .from('support_access_sessions')
    .select('id')
    .eq('organization_id', document.organization_id)
    .eq('support_user_id', user!.id)
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .lte('started_at', new Date().toISOString())
    .maybeSingle();

  const { error: eventError } = await client.from('document_access_events').insert({
    organization_id: document.organization_id,
    document_id: document.id,
    accessed_by: user!.id,
    access_type: accessType,
    support_access_session_id: activeSession?.id ?? null,
  });

  if (eventError) {
    return apiError(500, 'internal_error', eventError.message, correlationId);
  }

  await logAuditEvent(client, {
    organizationId: document.organization_id,
    actorId: user!.id,
    action: `document.${accessType}`,
    targetType: 'document',
    targetId: document.id,
    metadata: { fileName: document.file_name, viaSupportSession: Boolean(activeSession) },
    correlationId,
  });

  return apiOk({ signedUrl: signed.signedUrl, fileName: document.file_name }, correlationId);
}
