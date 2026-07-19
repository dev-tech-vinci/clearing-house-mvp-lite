import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createPayerRulesApi } from '@kit/payer-rules/server/api';
import type { Database } from '@kit/supabase/database';

import type { ClaimRuleVersionContext, ValidateClaimInput } from '../lib/validate-claim';
import { evaluateClaimRules } from '../lib/validate-claim';

/**
 * Fetches the claim's current data and resolves which universal /
 * claim_type / payer_edit rules apply to it (adjudication-category rules
 * are post-adjudication and intentionally never evaluated here -- see
 * docs/05-claim-lifecycle.md). Shared by runClaimValidation (Phase 5's
 * interactive Validate button) and Phase 6's submit pipeline
 * (apps/worker), which both need the same claim-to-rules resolution but
 * do different things with the result (persist failures only, vs. persist
 * every rule's pass/fail as a rule_evaluations audit trail) -- see
 * docs/progress/DECISIONS.md for why this is factored out rather than
 * duplicated (Phase 4's CSV-import bug was exactly this kind of drift).
 */
export async function loadClaimValidationContext(
  client: SupabaseClient<Database>,
  claimId: string,
) {
  const { data: claim, error: claimError } = await client
    .from('claims')
    .select(
      `*,
       professional:professional_claim_details(rendering_provider_id),
       institutional:institutional_claim_details(type_of_bill),
       coverage:coverages(payer_id),
       diagnoses:claim_diagnoses(diagnosis_code),
       lines:claim_lines(service_date)`,
    )
    .eq('id', claimId)
    .single();

  if (claimError) {
    throw claimError;
  }

  const professional = Array.isArray(claim.professional)
    ? claim.professional[0]
    : claim.professional;
  const institutional = Array.isArray(claim.institutional)
    ? claim.institutional[0]
    : claim.institutional;
  const coverage = Array.isArray(claim.coverage) ? claim.coverage[0] : claim.coverage;

  let payerSimId: string | null = null;
  let hasActivePayerEnrollment = true;

  if (coverage?.payer_id) {
    const { data: payer } = await client
      .from('payers')
      .select('id, sim_payer_id')
      .eq('id', coverage.payer_id)
      .maybeSingle();

    if (payer) {
      payerSimId = payer.sim_payer_id;

      const { count } = await client
        .from('organization_payer_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', claim.organization_id)
        .eq('payer_id', payer.id)
        .eq('status', 'active')
        .is('deleted_at', null);

      hasActivePayerEnrollment = (count ?? 0) > 0;
    }
  }

  const rulesApi = createPayerRulesApi(client);
  const allRules = await rulesApi.listRules();

  const applicableRules: ClaimRuleVersionContext[] = allRules
    .filter((rule) => rule.is_active)
    .filter((rule) => {
      if (rule.category === 'universal') {
        return true;
      }

      if (rule.category === 'claim_type') {
        return rule.claim_type === claim.claim_type;
      }

      if (rule.category === 'payer_edit') {
        return payerSimId !== null && rule.payer?.sim_payer_id === payerSimId;
      }

      return false;
    })
    .map((rule) => {
      const latestVersion = [...rule.versions]
        .filter((version) => version.is_active)
        .sort((a, b) => b.version_number - a.version_number)[0];

      if (!latestVersion) {
        return null;
      }

      return {
        ruleCode: rule.rule_code,
        fieldPath: latestVersion.field_path,
        explanation: latestVersion.explanation,
        suggestedCorrection: latestVersion.suggested_correction,
        severity: latestVersion.severity as ClaimRuleVersionContext['severity'],
        rejectionOrDenial:
          latestVersion.rejection_or_denial as ClaimRuleVersionContext['rejectionOrDenial'],
      };
    })
    .filter((rule): rule is ClaimRuleVersionContext => rule !== null);

  const input: ValidateClaimInput = {
    claimType: claim.claim_type as ValidateClaimInput['claimType'],
    subscriberId: claim.subscriber_id,
    renderingProviderId: professional?.rendering_provider_id ?? null,
    typeOfBill: institutional?.type_of_bill ?? null,
    diagnoses: (claim.diagnoses ?? []).map((diagnosis) => ({
      diagnosisCode: diagnosis.diagnosis_code,
    })),
    lines: (claim.lines ?? []).map((line) => ({ serviceDate: line.service_date })),
    hasActivePayerEnrollment,
  };

  return { claim, input, applicableRules, payerSimId };
}

/**
 * The actual validation core, shared by validateClaimAction (Server
 * Action, UI path) and POST /api/v1/claims/{id}/validate (REST path) so
 * the two surfaces can never drift apart on what "valid" means -- see
 * docs/progress/DECISIONS.md for why duplicating this logic once already
 * caused a real bug in Phase 4.
 */
export async function runClaimValidation(
  client: SupabaseClient<Database>,
  userId: string,
  claimId: string,
) {
  const { input, applicableRules } = await loadClaimValidationContext(client, claimId);

  const errors = evaluateClaimRules(input, applicableRules);
  const status = errors.length === 0 ? 'validated' : 'validation_failed';

  const { error: updateError } = await client
    .from('claims')
    .update({
      status,
      validated_at: new Date().toISOString(),
      last_validation_result: JSON.parse(JSON.stringify(errors)),
      updated_by: userId,
    })
    .eq('id', claimId);

  if (updateError) {
    throw updateError;
  }

  return { status, errors };
}
