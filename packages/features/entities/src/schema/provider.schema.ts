import { z } from 'zod';

import { isValidNpiChecksum } from '../lib/npi';

const providerFields = z.object({
  organizationId: z.string().uuid(),
  providerType: z.enum(['individual', 'organization']),
  npi: z
    .string()
    .regex(/^\d{10}$/, 'NPI must be exactly 10 digits')
    .refine(isValidNpiChecksum, 'Invalid NPI check digit'),
  // Deliberately no .min(1) here: the dialog's defaultValues initializes
  // these to '' (not undefined) for whichever half of the individual/
  // organization split is currently hidden, and an empty string would
  // otherwise fail a .min(1) silently on the client with no visible
  // network call. Non-emptiness where it actually matters is enforced by
  // the hasRequiredNameForType refine below (a truthy check), and
  // independently by the DB check constraint.
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  organizationName: z.string().max(255).optional(),
  taxonomyCode: z.string().max(20).optional(),
});

function hasRequiredNameForType(data: {
  providerType: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
}) {
  return data.providerType === 'individual'
    ? Boolean(data.firstName && data.lastName)
    : Boolean(data.organizationName);
}

const nameRefinement = {
  message:
    'Individual providers need a first and last name; organization providers need an organization name',
  path: ['organizationName'],
};

export const CreateProviderSchema = providerFields.refine(
  hasRequiredNameForType,
  nameRefinement,
);

export const UpdateProviderSchema = providerFields
  .extend({ providerId: z.string().uuid() })
  .refine(hasRequiredNameForType, nameRefinement);

export const DeactivateProviderSchema = z.object({
  providerId: z.string().uuid(),
  isActive: z.boolean(),
});

/**
 * Single, permissive schema used for the create/edit dialog's useForm()
 * typing/validation (providerId optional). The actual security boundary
 * is server-side: createProviderAction/updateProviderAction each validate
 * against the stricter Create/Update schemas above via enhanceAction.
 */
export const ProviderFormSchema = providerFields.extend({
  providerId: z.string().uuid().optional(),
});

export type CreateProviderSchema = z.infer<typeof CreateProviderSchema>;
export type UpdateProviderSchema = z.infer<typeof UpdateProviderSchema>;
export type DeactivateProviderSchema = z.infer<typeof DeactivateProviderSchema>;
export type ProviderFormSchema = z.infer<typeof ProviderFormSchema>;
