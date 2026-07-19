import { z } from 'zod';

const coverageFields = z.object({
  organizationId: z.string().uuid(),
  subscriberId: z.string().uuid(),
  patientId: z.string().uuid(),
  payerLabel: z.string().min(1).max(255),
  groupNumber: z.string().max(64).optional(),
  coverageType: z.enum(['primary', 'secondary', 'tertiary']).default('primary'),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
});

export const CreateCoverageSchema = coverageFields;

export const UpdateCoverageSchema = coverageFields.extend({
  coverageId: z.string().uuid(),
});

export const DeactivateCoverageSchema = z.object({
  coverageId: z.string().uuid(),
  isActive: z.boolean(),
});

/**
 * Single, permissive schema used for the create/edit dialog's useForm()
 * typing/validation (coverageId optional). The security boundary is
 * server-side: create/updateCoverageAction validate against the stricter
 * schemas above via enhanceAction.
 */
export const CoverageFormSchema = coverageFields.extend({
  coverageId: z.string().uuid().optional(),
});

export type CreateCoverageSchema = z.infer<typeof CreateCoverageSchema>;
export type UpdateCoverageSchema = z.infer<typeof UpdateCoverageSchema>;
export type DeactivateCoverageSchema = z.infer<typeof DeactivateCoverageSchema>;
export type CoverageFormSchema = z.infer<typeof CoverageFormSchema>;
