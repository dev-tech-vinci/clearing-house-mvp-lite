import { z } from 'zod';

const patientFields = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['female', 'male', 'other', 'unknown']).default('unknown'),
  addressLine1: z.string().max(255).optional(),
  addressLine2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(2).optional(),
  postalCode: z.string().max(10).optional(),
});

export const CreatePatientSchema = patientFields;

export const UpdatePatientSchema = patientFields.extend({
  patientId: z.string().uuid(),
});

export const DeactivatePatientSchema = z.object({
  patientId: z.string().uuid(),
  isActive: z.boolean(),
});

/**
 * Single, permissive schema used for the create/edit dialog's useForm()
 * typing/validation (patientId optional). The security boundary is
 * server-side: create/updatePatientAction validate against the stricter
 * schemas above via enhanceAction.
 */
export const PatientFormSchema = patientFields.extend({
  patientId: z.string().uuid().optional(),
});

export type CreatePatientSchema = z.infer<typeof CreatePatientSchema>;
export type UpdatePatientSchema = z.infer<typeof UpdatePatientSchema>;
export type DeactivatePatientSchema = z.infer<typeof DeactivatePatientSchema>;
export type PatientFormSchema = z.infer<typeof PatientFormSchema>;
