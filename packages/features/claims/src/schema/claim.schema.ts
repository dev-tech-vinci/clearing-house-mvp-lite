import { z } from 'zod';

export const CreateProfessionalClaimSchema = z.object({
  organizationId: z.string().uuid(),
  patientId: z.string().uuid(),
  subscriberId: z.string().uuid(),
  coverageId: z.string().uuid(),
  billingProviderId: z.string().uuid(),
  renderingProviderId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export const CreateInstitutionalClaimSchema = z.object({
  organizationId: z.string().uuid(),
  patientId: z.string().uuid(),
  subscriberId: z.string().uuid(),
  coverageId: z.string().uuid(),
  billingProviderId: z.string().uuid(),
  facilityId: z.string().uuid(),
  typeOfBill: z.string().regex(/^\d{3,4}$/, 'Type of bill must be 3-4 digits'),
  admissionDate: z.string().optional(),
  dischargeDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateClaimNotesSchema = z.object({
  claimId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export const ValidateClaimSchema = z.object({
  claimId: z.string().uuid(),
});

export const ApproveClaimSchema = z.object({
  claimId: z.string().uuid(),
});

export type CreateProfessionalClaimSchema = z.infer<
  typeof CreateProfessionalClaimSchema
>;
export type CreateInstitutionalClaimSchema = z.infer<
  typeof CreateInstitutionalClaimSchema
>;
export type UpdateClaimNotesSchema = z.infer<typeof UpdateClaimNotesSchema>;
export type ValidateClaimSchema = z.infer<typeof ValidateClaimSchema>;
export type ApproveClaimSchema = z.infer<typeof ApproveClaimSchema>;
