import { z } from 'zod';

export const SwitchOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
});

export type SwitchOrganizationSchema = z.infer<typeof SwitchOrganizationSchema>;
