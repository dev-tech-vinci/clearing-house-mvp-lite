import { z } from 'zod';

export const AdjudicateClaimSchema = z.object({
  claimId: z.string().uuid(),
});

export type AdjudicateClaimSchema = z.infer<typeof AdjudicateClaimSchema>;
