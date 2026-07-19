import { z } from 'zod';

export const AssignTicketSchema = z.object({
  ticketId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export const UpdateTicketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  organizationId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
});
