import { z } from 'zod';

export const AcceptInvitationSchema = z.object({
  token: z.string().min(10),
});

export type AcceptInvitationSchema = z.infer<typeof AcceptInvitationSchema>;
