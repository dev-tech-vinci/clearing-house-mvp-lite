import { z } from 'zod';

export const MatchEftSchema = z.object({
  remittanceId: z.string().uuid(),
});

export type MatchEftSchema = z.infer<typeof MatchEftSchema>;
