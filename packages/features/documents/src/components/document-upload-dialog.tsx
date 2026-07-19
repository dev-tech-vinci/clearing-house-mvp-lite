'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from '../schema/create-document.schema';
import { createDocumentRecordAction } from '../server/create-document.actions';

const DOCUMENTS_BUCKET = 'org_documents';

/**
 * Uploads the raw file directly to the private org_documents Storage
 * bucket from the browser (RLS-scoped -- the org_documents_insert
 * storage policy requires documents.view_download on the org whose path
 * prefix the caller is writing under), then registers the metadata row
 * via createDocumentRecordAction. If the metadata insert fails, the
 * already-uploaded object is removed so an upload never silently
 * succeeds without a corresponding documents row.
 */
export function DocumentUploadDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useSupabase();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as never)) {
        throw new Error(
          `File type ${file.type || 'unknown'} is not allowed. Allowed types: ${ALLOWED_DOCUMENT_MIME_TYPES.join(', ')}.`,
        );
      }

      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        throw new Error(
          `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024} MB.`,
        );
      }

      const storagePath = `${organizationId}/${crypto.randomUUID()}-${file.name}`;

      const { error: uploadError } = await client.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError) {
        throw uploadError;
      }

      try {
        const result = await createDocumentRecordAction({
          organizationId,
          fileName: file.name,
          storagePath,
          mimeType: file.type as never,
          fileSizeBytes: file.size,
        });

        return result;
      } catch (recordError) {
        await client.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
        throw recordError;
      }
    },
    onSuccess: () => {
      onOpenChange(false);
      setFileName(null);
      setError(null);
      setTimeout(() => router.refresh(), 0);
    },
  });

  const onFileSelected = (file: File) => {
    setFileName(file.name);
    setError(null);

    const promise = uploadMutation.mutateAsync(file).catch((err: Error) => {
      setError(err.message);
      throw err;
    });

    toast.promise(() => promise, {
      loading: 'Uploading document...',
      success: 'Document uploaded',
      error: (err) => (err instanceof Error ? err.message : 'Could not upload document'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Simulation only -- private storage, size limited to{' '}
            {MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024} MB, allowed types: PDF, PNG, JPEG, plain text.
          </DialogDescription>
        </DialogHeader>

        <div className={'flex flex-col space-y-2'}>
          <Label htmlFor={'document-file-input'}>File</Label>
          <Input
            id={'document-file-input'}
            data-test={'document-file-input'}
            ref={fileInputRef}
            type={'file'}
            accept={ALLOWED_DOCUMENT_MIME_TYPES.join(',')}
            disabled={uploadMutation.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                onFileSelected(file);
              }
            }}
          />
          {fileName && <p className={'text-muted-foreground text-xs'}>{fileName}</p>}
          {error && <p className={'text-destructive text-xs'}>{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type={'button'}
            variant={'outline'}
            onClick={() => onOpenChange(false)}
            disabled={uploadMutation.isPending}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
