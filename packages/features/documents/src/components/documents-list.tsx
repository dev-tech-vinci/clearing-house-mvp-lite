'use client';

import { useMemo, useState } from 'react';

import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import { DataTable } from '@kit/ui/data-table';

import { getDocumentSignedUrlAction } from '../server/get-signed-url.actions';
import { DocumentUploadDialog } from './document-upload-dialog';

interface DocumentRow {
  id: string;
  sim_document_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string | null;
  claim: { sim_claim_id: string } | null;
}

async function openSignedUrl(documentId: string, accessType: 'view' | 'download') {
  // window.open() must run synchronously inside the click handler or
  // browsers drop the "opened during a user gesture" context and silently
  // block it -- opening about:blank now and redirecting it once the
  // signed URL resolves (rather than calling window.open() after the
  // await) is what keeps the popup from being blocked. 'noopener' is
  // deliberately omitted -- it would make window.open() return null,
  // and this component needs the reference to set .location.href once
  // the signed URL is ready.
  const popup = window.open('about:blank', '_blank');

  const promise = getDocumentSignedUrlAction({ documentId, accessType });

  toast.promise(() => promise, {
    loading: 'Preparing document...',
    success: 'Document ready',
    error: (error) => (error instanceof Error ? error.message : 'Could not open document'),
  });

  try {
    const result = await promise;

    if (popup) {
      popup.location.href = result.signedUrl;
    }
  } catch (error) {
    popup?.close();
    throw error;
  }
}

export function DocumentsList({
  organizationId,
  documents,
}: {
  organizationId: string;
  documents: DocumentRow[];
}) {
  const [uploadOpen, setUploadOpen] = useState(false);

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      { accessorKey: 'sim_document_id', header: 'Document ID' },
      { accessorKey: 'file_name', header: 'File name' },
      {
        id: 'claim',
        header: 'Claim',
        cell: ({ row }) => row.original.claim?.sim_claim_id ?? '',
      },
      { accessorKey: 'mime_type', header: 'Type' },
      {
        id: 'size',
        header: 'Size',
        cell: ({ row }) => `${(row.original.file_size_bytes / 1024).toFixed(1)} KB`,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className={'flex justify-end gap-x-2'}>
            <Button
              data-test={'document-view-trigger'}
              variant={'ghost'}
              size={'sm'}
              onClick={() => openSignedUrl(row.original.id, 'view')}
            >
              View
            </Button>
            <Button
              data-test={'document-download-trigger'}
              variant={'ghost'}
              size={'sm'}
              onClick={() => openSignedUrl(row.original.id, 'download')}
            >
              Download
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex justify-end'}>
        <Button data-test={'upload-document-trigger'} onClick={() => setUploadOpen(true)}>
          Upload document
        </Button>
      </div>

      <div data-test={'documents-table'}>
        <DataTable columns={columns} data={documents} />
      </div>

      <DocumentUploadDialog
        organizationId={organizationId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </div>
  );
}
