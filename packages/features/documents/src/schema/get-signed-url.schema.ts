import { z } from 'zod';

export const GetSignedUrlSchema = z.object({
  documentId: z.string().uuid(),
  accessType: z.enum(['view', 'download']),
});
