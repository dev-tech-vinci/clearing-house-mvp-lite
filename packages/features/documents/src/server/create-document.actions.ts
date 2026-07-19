'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CreateDocumentSchema } from '../schema/create-document.schema';

/**
 * Registers a document's metadata row after the browser has already
 * uploaded the raw file directly to the private org_documents Storage
 * bucket (client-side, via the RLS-scoped browser client -- the same
 * pattern @kit/accounts uses for avatar uploads; Server Actions in this
 * codebase are not wired to accept binary File payloads). This action
 * only ever runs after the upload has already succeeded, so a failed
 * upload never produces an orphaned documents row.
 */
export const createDocumentRecordAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: document, error } = await client
      .from('documents')
      .insert({
        organization_id: data.organizationId,
        claim_id: data.claimId ?? null,
        file_name: data.fileName,
        storage_path: data.storagePath,
        mime_type: data.mimeType,
        file_size_bytes: data.fileSizeBytes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    revalidatePath('/home/documents');

    return { documentId: document.id };
  },
  { schema: CreateDocumentSchema },
);
