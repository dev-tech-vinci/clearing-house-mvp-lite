export interface ClaimRuleVersionContext {
  ruleCode: string;
  fieldPath: string | null;
  explanation: string;
  suggestedCorrection: string | null;
  severity: 'error' | 'warning' | 'info';
  rejectionOrDenial: 'rejection' | 'denial' | 'not_applicable';
}

export interface ValidationError {
  ruleCode: string;
  fieldPath: string | null;
  severity: 'error' | 'warning' | 'info';
  rejectionOrDenial: 'rejection' | 'denial' | 'not_applicable';
  explanation: string;
  suggestedCorrection: string | null;
}

export interface ValidateClaimInput {
  claimType: 'professional' | 'institutional';
  subscriberId: string;
  renderingProviderId?: string | null;
  typeOfBill?: string | null;
  diagnoses: { diagnosisCode: string }[];
  lines: { serviceDate: string }[];
  hasActivePayerEnrollment: boolean;
}

type RuleCheck = (input: ValidateClaimInput) => boolean;

/**
 * One deterministic TS predicate per seeded rule_code -- this *is* the
 * "rule engine" wiring for Phase 5. payer_rule_versions.condition is
 * human-readable text, not a machine-executable expression, so there is no
 * generic interpreter; instead a fixed, known set of rule_codes has a
 * matching predicate here. The *message* shown to the user (explanation /
 * suggestedCorrection / severity / rejectionOrDenial) always comes from
 * the live payer_rule_versions row via evaluateClaimRules below, never a
 * hardcoded string here -- editing a rule's explanation in the Phase 4
 * admin UI changes what claim builders see with no code change. A rule
 * seeded later with no matching predicate is skipped, not guessed at (see
 * evaluateClaimRules).
 *
 * SIM-RULE-UNIV-003 (subscriber ID present), SIM-RULE-CT-001 (rendering
 * NPI present), and SIM-RULE-CT-002 (type of bill present) can never
 * actually fail once a claim row exists -- those fields are NOT NULL at
 * the DB layer (see 20260719030000_claims.sql). They are still evaluated
 * here for parity with the seeded rule catalog and to correctly report
 * them as passing, not because a failure is reachable in practice.
 */
const UNIVERSAL_AND_CLAIM_TYPE_CHECKS: Record<string, RuleCheck> = {
  'SIM-RULE-UNIV-001': (input) => input.diagnoses.length > 0,
  'SIM-RULE-UNIV-002': (input) => {
    if (input.lines.length === 0) {
      return true;
    }

    const today = new Date().toISOString().slice(0, 10);

    return input.lines.every((line) => line.serviceDate <= today);
  },
  'SIM-RULE-UNIV-003': (input) => Boolean(input.subscriberId),
  'SIM-RULE-CT-001': (input) =>
    input.claimType !== 'professional' || Boolean(input.renderingProviderId),
  'SIM-RULE-CT-002': (input) =>
    input.claimType !== 'institutional' || Boolean(input.typeOfBill),
};

function checkPayerEdit(input: ValidateClaimInput): boolean {
  return input.hasActivePayerEnrollment;
}

export interface RuleEvaluationResult {
  ruleCode: string;
  fieldPath: string | null;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  rejectionOrDenial: 'rejection' | 'denial' | 'not_applicable';
  explanation: string;
  suggestedCorrection: string | null;
}

/**
 * Runs every applicable rule (universal + matching claim_type + matching
 * payer_edit -- adjudication-category rules are post-adjudication and
 * intentionally not evaluated here, see docs/05-claim-lifecycle.md) and
 * returns one result per rule, pass or fail. Phase 6's submit pipeline
 * persists every one of these to `rule_evaluations` (a full audit trail),
 * not just the failures Phase 5's interactive Validate button cares about
 * -- see evaluateClaimRules below for the failures-only view.
 */
export function evaluateClaimRulesDetailed(
  input: ValidateClaimInput,
  rules: ClaimRuleVersionContext[],
): RuleEvaluationResult[] {
  const results: RuleEvaluationResult[] = [];

  for (const rule of rules) {
    const isPayerEdit = rule.ruleCode.startsWith('SIM-RULE-EDIT-');
    const check = isPayerEdit
      ? checkPayerEdit
      : UNIVERSAL_AND_CLAIM_TYPE_CHECKS[rule.ruleCode];

    if (!check) {
      continue;
    }

    results.push({
      ruleCode: rule.ruleCode,
      fieldPath: rule.fieldPath,
      passed: check(input),
      severity: rule.severity,
      rejectionOrDenial: rule.rejectionOrDenial,
      explanation: rule.explanation,
      suggestedCorrection: rule.suggestedCorrection,
    });
  }

  return results;
}

/**
 * Failures-only view of evaluateClaimRulesDetailed, used by Phase 5's
 * interactive Validate button (packages/features/claims/src/server/
 * validate-claim.server.ts), which only needs to show what's wrong.
 */
export function evaluateClaimRules(
  input: ValidateClaimInput,
  rules: ClaimRuleVersionContext[],
): ValidationError[] {
  return evaluateClaimRulesDetailed(input, rules)
    .filter((result) => !result.passed)
    .map(({ passed: _passed, ...error }) => error);
}
