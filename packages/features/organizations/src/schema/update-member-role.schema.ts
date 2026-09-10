import { z } from 'zod';

import { INVITABLE_ROLES } from '@kit/access-control/roles';

export const UpdateMemberRoleSchema = z.object({
  membershipId: z.string().uuid(),
  roleKey: z.enum(INVITABLE_ROLES as [string, ...string[]]),
});

export type UpdateMemberRoleSchema = z.infer<typeof UpdateMemberRoleSchema>;
