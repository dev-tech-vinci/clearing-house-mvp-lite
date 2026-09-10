'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddRuleVersionSchema,
  CreateRuleSchema,
  SetRuleActiveSchema,
} from '../schema/payer-rule.schema';

function versionRow(data: {
  fieldPath?: string;
  condition: string;
  outcome: string;
  severity: string;
  rejectionOrDenial: string;
  explanation: string;
  suggestedCorrection?: string;
  effectiveDate?: string;
  expirationDate?: string;
  source?: string;
}) {
  return {
    field_path: data.fieldPath || null,
    condition: data.condition,
    outcome: data.outcome,
    severity: data.severity,
    rejection_or_denial: data.rejectionOrDenial,
    explanation: data.explanation,
    suggested_correction: data.suggestedCorrection || null,
    effective_date: data.effectiveDate || null,
    expiration_date: data.expirationDate || null,
    source: data.source || null,
  };
}

export const createRuleAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: rule, error: ruleError } = await client
      .from('payer_rules')
      .insert({
        rule_code: data.ruleCode,
        category: data.category,
        payer_id: data.payerId || null,
        claim_type: data.claimType || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (ruleError) {
      throw ruleError;
    }

    const { error: versionError } = await client.from('payer_rule_versions').insert({
      payer_rule_id: rule.id,
      version_number: 1,
      ...versionRow(data),
      created_by: user.id,
    });

    if (versionError) {
      throw versionError;
    }

    revalidatePath('/admin/payer-rules');

    return { success: true, payerRuleId: rule.id as string };
  },
  { schema: CreateRuleSchema },
);

export const addRuleVersionAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: existing, error: maxError } = await client
      .from('payer_rule_versions')
      .select('version_number')
      .eq('payer_rule_id', data.payerRuleId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      throw maxError;
    }

    const nextVersion = (existing?.version_number ?? 0) + 1;

    const { error } = await client.from('payer_rule_versions').insert({
      payer_rule_id: data.payerRuleId,
      version_number: nextVersion,
      ...versionRow(data),
      created_by: user.id,
    });

    if (error) {
      throw error;
    }

    await client
      .from('payer_rules')
      .update({ updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', data.payerRuleId);

    revalidatePath('/admin/payer-rules');

    return { success: true, versionNumber: nextVersion };
  },
  { schema: AddRuleVersionSchema },
);

export const setRuleActiveAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('payer_rules')
      .update({ is_active: data.isActive, updated_by: user.id })
      .eq('id', data.payerRuleId);

    if (error) {
      throw error;
    }

    revalidatePath('/admin/payer-rules');

    return { success: true };
  },
  { schema: SetRuleActiveSchema },
);
