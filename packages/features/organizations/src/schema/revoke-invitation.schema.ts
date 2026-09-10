import { z } from 'zod';

export const RevokeInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

export type RevokeInvitationSchema = z.infer<typeof RevokeInvitationSchema>;
