import { z } from 'zod';

import { isValidNpiChecksum } from '../lib/npi';

const optionalNpi = z
  .union([z.literal(''), z.string().regex(/^\d{10}$/, 'NPI must be exactly 10 digits').refine(isValidNpiChecksum, 'Invalid NPI check digit')])
  .optional();

const facilityFields = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  facilityType: z
    .enum(['outpatient_clinic', 'inpatient_hospital', 'residential', 'telehealth', 'other'])
    .default('outpatient_clinic'),
  npi: optionalNpi,
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(2).optional(),
  postalCode: z.string().max(10).optional(),
});

export const CreateFacilitySchema = facilityFields;

export const UpdateFacilitySchema = facilityFields.extend({
  facilityId: z.string().uuid(),
});

export const DeactivateFacilitySchema = z.object({
  facilityId: z.string().uuid(),
  isActive: z.boolean(),
});

/**
 * Single, permissive schema used for the create/edit dialog's useForm()
 * typing/validation (facilityId optional). The security boundary is
 * server-side: create/updateFacilityAction validate against the stricter
 * schemas above via enhanceAction.
 */
export const FacilityFormSchema = facilityFields.extend({
  facilityId: z.string().uuid().optional(),
});

export type CreateFacilitySchema = z.infer<typeof CreateFacilitySchema>;
export type UpdateFacilitySchema = z.infer<typeof UpdateFacilitySchema>;
export type DeactivateFacilitySchema = z.infer<typeof DeactivateFacilitySchema>;
export type FacilityFormSchema = z.infer<typeof FacilityFormSchema>;
