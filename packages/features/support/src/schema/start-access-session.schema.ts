import { z } from 'zod';

// A typed reason is required (no silent impersonation), and the time
// limit is capped at 4 hours -- a session must have a bounded duration,
// not an open-ended one.
export const StartAccessSessionSchema = z.object({
  ticketId: z.string().uuid(),
  organizationId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  durationMinutes: z.number().int().min(5).max(240).default(60),
});

export const EndAccessSessionSchema = z.object({
  sessionId: z.string().uuid(),
  organizationId: z.string().uuid(),
});
