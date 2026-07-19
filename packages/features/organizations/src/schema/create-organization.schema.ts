import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(255)
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'Use lowercase letters, numbers and hyphens only',
    ),
});

export type CreateOrganizationSchema = z.infer<typeof CreateOrganizationSchema>;
