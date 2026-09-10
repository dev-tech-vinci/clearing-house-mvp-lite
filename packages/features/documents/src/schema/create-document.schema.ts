import { z } from 'zod';

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB, matches the org_documents bucket's file_size_limit.

export const CreateDocumentSchema = z.object({
  organizationId: z.string().uuid(),
  claimId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(1),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_DOCUMENT_SIZE_BYTES),
});
