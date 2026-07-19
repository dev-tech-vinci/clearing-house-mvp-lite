import { z } from 'zod';

import { INVITABLE_ROLES } from '@kit/access-control/roles';

export const InviteMemberSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  roleKey: z.enum(INVITABLE_ROLES as [string, ...string[]]),
});

export type InviteMemberSchema = z.infer<typeof InviteMemberSchema>;
