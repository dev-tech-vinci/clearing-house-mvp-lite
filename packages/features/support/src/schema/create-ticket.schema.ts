import { z } from 'zod';

export const CreateTicketSchema = z.object({
  organizationId: z.string().uuid(),
  subject: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});
