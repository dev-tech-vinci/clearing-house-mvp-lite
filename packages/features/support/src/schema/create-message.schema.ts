import { z } from 'zod';

export const CreateMessageSchema = z.object({
  ticketId: z.string().uuid(),
  organizationId: z.string().uuid(),
  body: z.string().min(1),
  isInternalNote: z.boolean().default(false),
});
