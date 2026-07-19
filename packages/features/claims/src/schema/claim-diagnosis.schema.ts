import { z } from 'zod';

export const AddClaimDiagnosisSchema = z.object({
  claimId: z.string().uuid(),
  organizationId: z.string().uuid(),
  diagnosisCode: z.string().min(1).max(10),
  diagnosisPointer: z.coerce.number().int().min(1).max(12),
  isPrimary: z.boolean().default(false),
});

export const RemoveClaimDiagnosisSchema = z.object({
  diagnosisId: z.string().uuid(),
});

export type AddClaimDiagnosisSchema = z.infer<typeof AddClaimDiagnosisSchema>;
export type RemoveClaimDiagnosisSchema = z.infer<
  typeof RemoveClaimDiagnosisSchema
>;
