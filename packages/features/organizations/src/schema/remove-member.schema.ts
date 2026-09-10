import { z } from 'zod';

export const RemoveMemberSchema = z.object({
  membershipId: z.string().uuid(),
});

export type RemoveMemberSchema = z.infer<typeof RemoveMemberSchema>;
