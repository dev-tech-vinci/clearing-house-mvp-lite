import { z } from 'zod';

export const RULE_CATEGORIES = [
  'universal',
  'claim_type',
  'payer_edit',
  'adjudication',
  'informational',
] as const;

export const RULE_CATEGORY_LABELS: Record<(typeof RULE_CATEGORIES)[number], string> = {
  universal: 'Universal',
  claim_type: 'Claim-Type',
  payer_edit: 'Payer Edit',
  adjudication: 'Adjudication',
  informational: 'Informational',
};

const versionContentFields = z.object({
  fieldPath: z.string().max(255).optional(),
  condition: z.string().min(1),
  outcome: z.enum(['reject', 'deny', 'warn', 'info']),
  severity: z.enum(['error', 'warning', 'info']),
  rejectionOrDenial: z.enum(['rejection', 'denial', 'not_applicable']),
  explanation: z.string().min(1),
  suggestedCorrection: z.string().optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  source: z.string().optional(),
});

const ruleIdentityFields = z.object({
  ruleCode: z
    .string()
    .min(3)
    .max(64)
    .regex(/^SIM-/, 'Synthetic rule codes must start with "SIM-"'),
  category: z.enum(RULE_CATEGORIES),
  // Deliberately accepts '' alongside a real UUID: the dialog's
  // defaultValues initializes this to '' (not undefined) since the payer
  // field is hidden for universal/claim_type/informational rules, and an
  // empty string would otherwise fail .uuid() silently on the client with
  // no visible network call -- same pattern as the Phase 3
  // organizationName/firstName/lastName bug (see docs/progress/DECISIONS.md).
  payerId: z.union([z.literal(''), z.string().uuid()]).optional(),
  claimType: z.enum(['professional', 'institutional']).optional(),
});

function payerRequiredForScope(data: { category: string; payerId?: string }) {
  if (data.category === 'payer_edit' || data.category === 'adjudication') {
    return Boolean(data.payerId);
  }

  return true;
}

const scopeRefinement = {
  message: 'Payer-edit and adjudication rules require a payer',
  path: ['payerId'],
};

export const CreateRuleSchema = ruleIdentityFields
  .merge(versionContentFields)
  .refine(payerRequiredForScope, scopeRefinement);

export const AddRuleVersionSchema = versionContentFields.extend({
  payerRuleId: z.string().uuid(),
});

export const SetRuleActiveSchema = z.object({
  payerRuleId: z.string().uuid(),
  isActive: z.boolean(),
});

/**
 * Single, permissive schema used for the create-rule dialog's useForm()
 * typing/validation. The security boundary is server-side: createRuleAction
 * validates against CreateRuleSchema via enhanceAction (enforced by RLS's
 * is_platform_admin() check).
 */
export const RuleFormSchema = ruleIdentityFields.merge(versionContentFields);

/**
 * Permissive schema for the add-version dialog.
 */
export const RuleVersionFormSchema = versionContentFields.extend({
  payerRuleId: z.string().uuid().optional(),
});

export type CreateRuleSchema = z.infer<typeof CreateRuleSchema>;
export type AddRuleVersionSchema = z.infer<typeof AddRuleVersionSchema>;
export type SetRuleActiveSchema = z.infer<typeof SetRuleActiveSchema>;
export type RuleFormSchema = z.infer<typeof RuleFormSchema>;
export type RuleVersionFormSchema = z.infer<typeof RuleVersionFormSchema>;
