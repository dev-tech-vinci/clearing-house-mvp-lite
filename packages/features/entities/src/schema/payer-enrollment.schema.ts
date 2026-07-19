import { z } from 'zod';

const enrollmentFields = z.object({
  organizationId: z.string().uuid(),
  payerLabel: z.string().min(1).max(255),
  status: z.enum(['pending', 'active', 'inactive']).default('pending'),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
  notes: z.string().optional(),
});

export const CreateEnrollmentSchema = enrollmentFields;

export const UpdateEnrollmentSchema = enrollmentFields.extend({
  enrollmentId: z.string().uuid(),
});

/**
 * Single, permissive schema used for the create/edit dialog's useForm()
 * typing/validation (enrollmentId optional). The security boundary is
 * server-side: create/updateEnrollmentAction validate against the
 * stricter schemas above via enhanceAction.
 */
export const EnrollmentFormSchema = enrollmentFields.extend({
  enrollmentId: z.string().uuid().optional(),
});

export type CreateEnrollmentSchema = z.infer<typeof CreateEnrollmentSchema>;
export type UpdateEnrollmentSchema = z.infer<typeof UpdateEnrollmentSchema>;
export type EnrollmentFormSchema = z.infer<typeof EnrollmentFormSchema>;
