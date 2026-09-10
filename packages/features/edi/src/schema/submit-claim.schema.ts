import { z } from 'zod';

export const SubmitClaimSchema = z.object({
  claimId: z.string().uuid(),
});

export type SubmitClaimSchema = z.infer<typeof SubmitClaimSchema>;
