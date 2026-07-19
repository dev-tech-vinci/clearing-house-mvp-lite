import { z } from 'zod';

const claimLineFields = z.object({
  claimId: z.string().uuid(),
  organizationId: z.string().uuid(),
  claimType: z.enum(['professional', 'institutional']),
  lineNumber: z.coerce.number().int().min(1),
  serviceDate: z.string().min(1),
  procedureCode: z.string().max(10).optional(),
  revenueCode: z.string().max(4).optional(),
  modifiers: z.array(z.string().max(4)).optional(),
  units: z.coerce.number().int().min(1).default(1),
  chargeAmount: z.coerce.number().min(0),
  placeOfService: z.string().max(2).optional(),
  diagnosisPointers: z.array(z.coerce.number().int().min(1).max(12)).default([]),
});

function hasRequiredCodeForClaimType(data: {
  claimType: string;
  procedureCode?: string;
  revenueCode?: string;
}) {
  return data.claimType === 'professional'
    ? Boolean(data.procedureCode)
    : Boolean(data.revenueCode);
}

const codeRefinement = {
  message:
    'Professional lines need a CPT/HCPCS procedure code; institutional lines need a revenue code',
  path: ['procedureCode'],
};

export const AddClaimLineSchema = claimLineFields.refine(
  hasRequiredCodeForClaimType,
  codeRefinement,
);

export const UpdateClaimLineSchema = claimLineFields
  .extend({ lineId: z.string().uuid() })
  .refine(hasRequiredCodeForClaimType, codeRefinement);

export const RemoveClaimLineSchema = z.object({
  lineId: z.string().uuid(),
});

export const ClaimLineFormSchema = claimLineFields.extend({
  lineId: z.string().uuid().optional(),
});

export type AddClaimLineSchema = z.infer<typeof AddClaimLineSchema>;
export type UpdateClaimLineSchema = z.infer<typeof UpdateClaimLineSchema>;
export type RemoveClaimLineSchema = z.infer<typeof RemoveClaimLineSchema>;
export type ClaimLineFormSchema = z.infer<typeof ClaimLineFormSchema>;
