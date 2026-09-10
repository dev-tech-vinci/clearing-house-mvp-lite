import { z } from 'zod';

import { PAYER_CATEGORIES } from './payer.schema';

/**
 * One parsed CSV row. Import upserts by sim_payer_id: creates a new payer
 * if the ID isn't already in the directory, updates the existing row
 * otherwise. Only platform admins can import (enforced server-side by
 * RLS via is_platform_admin(), same as any other payer write).
 */
export const PayerImportRowSchema = z.object({
  sim_payer_id: z.string().regex(/^SIM-/, 'Synthetic payer IDs must start with "SIM-"'),
  display_name: z.string().min(1),
  legal_name: z.string().optional().default(''),
  category: z.enum(PAYER_CATEGORIES),
  scope: z.enum(['national', 'state', 'regional']).optional().default('national'),
  state: z.string().optional().default(''),
  network_name: z.string().optional().default(''),
  enrollment_required: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
  test_production: z.enum(['test', 'production']).optional().default('test'),
  is_active: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v.toLowerCase() !== 'false'),
});

/**
 * Schema for the row shape actually sent to importPayersAction. The client
 * parses raw CSV text with PayerImportRowSchema first (string "true"/"false"
 * -> boolean transform), so by the time a row crosses the server action
 * boundary enrollment_required/is_active are already real booleans -- this
 * schema validates that already-transformed shape, not the raw CSV strings.
 */
export const ParsedPayerImportRowSchema = z.object({
  sim_payer_id: z.string().regex(/^SIM-/, 'Synthetic payer IDs must start with "SIM-"'),
  display_name: z.string().min(1),
  legal_name: z.string().optional().default(''),
  category: z.enum(PAYER_CATEGORIES),
  scope: z.enum(['national', 'state', 'regional']).optional().default('national'),
  state: z.string().optional().default(''),
  network_name: z.string().optional().default(''),
  enrollment_required: z.boolean().optional().default(false),
  test_production: z.enum(['test', 'production']).optional().default('test'),
  is_active: z.boolean().optional().default(true),
});

export const ImportPayersSchema = z.object({
  rows: z.array(ParsedPayerImportRowSchema).min(1).max(500),
});

export type PayerImportRowSchema = z.infer<typeof PayerImportRowSchema>;
export type ParsedPayerImportRowSchema = z.infer<typeof ParsedPayerImportRowSchema>;
export type ImportPayersSchema = z.infer<typeof ImportPayersSchema>;

export const PAYER_CSV_COLUMNS = [
  'sim_payer_id',
  'display_name',
  'legal_name',
  'category',
  'scope',
  'state',
  'network_name',
  'enrollment_required',
  'test_production',
  'is_active',
] as const;
