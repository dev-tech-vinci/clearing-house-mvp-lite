import { z } from 'zod';

export const PAYER_CATEGORIES = [
  'medicare_ffs',
  'medicare_advantage',
  'medicaid_ffs',
  'medicaid_mco',
  'commercial_ppo',
  'commercial_hmo',
  'blue_plan',
  'tricare',
  'marketplace',
  'regional_bh',
] as const;

export const PAYER_CATEGORY_LABELS: Record<(typeof PAYER_CATEGORIES)[number], string> = {
  medicare_ffs: 'Medicare FFS',
  medicare_advantage: 'Medicare Advantage',
  medicaid_ffs: 'Medicaid FFS',
  medicaid_mco: 'Medicaid MCO',
  commercial_ppo: 'Commercial PPO',
  commercial_hmo: 'Commercial HMO',
  blue_plan: 'Blue Plan',
  tricare: 'TRICARE-Style',
  marketplace: 'Marketplace',
  regional_bh: 'Regional Behavioral Health',
};

const payerFields = z.object({
  simPayerId: z
    .string()
    .min(5)
    .max(32)
    .regex(/^SIM-/, 'Synthetic payer IDs must start with "SIM-"'),
  displayName: z.string().min(1).max(255),
  legalName: z.string().max(255).optional(),
  category: z.enum(PAYER_CATEGORIES),
  lineOfBusiness: z.string().max(100).optional(),
  scope: z.enum(['national', 'state', 'regional']).default('national'),
  state: z.string().max(2).optional(),
  publicProgramId: z.string().max(64).optional(),
  clearinghousePayerId: z.string().max(64).optional(),
  networkName: z.string().max(255).optional(),
  enrollmentRequired: z.boolean().default(false),
  testProduction: z.enum(['test', 'production']).default('test'),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

export const CreatePayerSchema = payerFields;

export const UpdatePayerSchema = payerFields.extend({
  payerId: z.string().uuid(),
});

export const SetPayerActiveSchema = z.object({
  payerId: z.string().uuid(),
  isActive: z.boolean(),
});

export const SoftDeletePayerSchema = z.object({
  payerId: z.string().uuid(),
});

/**
 * Single, permissive schema used for the create/edit dialog's useForm()
 * typing/validation (payerId optional). The security boundary is
 * server-side: create/updatePayerAction validate against the stricter
 * schemas above via enhanceAction (which in turn is enforced by RLS's
 * is_platform_admin() check).
 */
export const PayerFormSchema = payerFields.extend({
  payerId: z.string().uuid().optional(),
});

export type CreatePayerSchema = z.infer<typeof CreatePayerSchema>;
export type UpdatePayerSchema = z.infer<typeof UpdatePayerSchema>;
export type SetPayerActiveSchema = z.infer<typeof SetPayerActiveSchema>;
export type SoftDeletePayerSchema = z.infer<typeof SoftDeletePayerSchema>;
export type PayerFormSchema = z.infer<typeof PayerFormSchema>;
