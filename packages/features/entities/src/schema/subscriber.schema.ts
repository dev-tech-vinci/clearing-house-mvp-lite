import { z } from 'zod';

const subscriberFields = z.object({
  organizationId: z.string().uuid(),
  patientId: z.string().uuid(),
  relationshipToPatient: z.enum(['self', 'spouse', 'child', 'other']).default('self'),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  dateOfBirth: z.string().optional(),
});

export const CreateSubscriberSchema = subscriberFields;

export const UpdateSubscriberSchema = subscriberFields.extend({
  subscriberId: z.string().uuid(),
});

export const DeactivateSubscriberSchema = z.object({
  subscriberId: z.string().uuid(),
  isActive: z.boolean(),
});

/**
 * Single, permissive schema used for the create/edit dialog's useForm()
 * typing/validation (subscriberId optional). The security boundary is
 * server-side: create/updateSubscriberAction validate against the
 * stricter schemas above via enhanceAction.
 */
export const SubscriberFormSchema = subscriberFields.extend({
  subscriberId: z.string().uuid().optional(),
});

export type CreateSubscriberSchema = z.infer<typeof CreateSubscriberSchema>;
export type UpdateSubscriberSchema = z.infer<typeof UpdateSubscriberSchema>;
export type DeactivateSubscriberSchema = z.infer<typeof DeactivateSubscriberSchema>;
export type SubscriberFormSchema = z.infer<typeof SubscriberFormSchema>;
