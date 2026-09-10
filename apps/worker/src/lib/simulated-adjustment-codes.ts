/**
 * Simulated CARC (Claim Adjustment Reason Code) / RARC (Remittance
 * Advice Remark Code) labels. These are deliberately `SIM-` prefixed
 * with my own plain-English explanations -- they do NOT assert official
 * X12 CARC/RARC code meanings, per CLAUDE.md's guardrail against
 * fabricating authoritative code-set content. Do not replace these with
 * real CARC/RARC numbers without an authoritative, verifiable source.
 *
 * The mapping is keyed by the triggering rule's field_path, which is a
 * property of whatever adjudication rule is configured for a payer --
 * not a per-payer-ID or per-claim-ID branch. A payer whose denial rule
 * targets an unmapped field falls back to a generic simulated code.
 */
export interface SimulatedAdjustmentCode {
  carcCode: string;
  rarcCode: string | null;
  label: string;
}

const DENIAL_CODES_BY_FIELD_PATH: Record<string, SimulatedAdjustmentCode> = {
  'claim.priorAuthNumber': {
    carcCode: 'SIM-CARC-PA1',
    rarcCode: 'SIM-RARC-N1',
    label: 'Simulated denial: prior authorization missing or invalid.',
  },
  'claim.benefitUnitsUsed': {
    carcCode: 'SIM-CARC-BL1',
    rarcCode: 'SIM-RARC-N2',
    label: 'Simulated denial: benefit limit exhausted.',
  },
};

const DEFAULT_DENIAL_CODE: SimulatedAdjustmentCode = {
  carcCode: 'SIM-CARC-D1',
  rarcCode: 'SIM-RARC-N9',
  label: 'Simulated denial.',
};

export function resolveDenialAdjustmentCode(fieldPath: string | null): SimulatedAdjustmentCode {
  if (fieldPath && DENIAL_CODES_BY_FIELD_PATH[fieldPath]) {
    return DENIAL_CODES_BY_FIELD_PATH[fieldPath];
  }

  return DEFAULT_DENIAL_CODE;
}

export const CONTRACTUAL_ADJUSTMENT_CODE: SimulatedAdjustmentCode = {
  carcCode: 'SIM-CARC-CO1',
  rarcCode: null,
  label: 'Simulated contractual adjustment applied per payer agreement.',
};

/**
 * A fixed, deterministic, testable simulated contractual allowance rate
 * -- 80% of billed charges are "allowed," 20% written off as a
 * contractual adjustment. Arbitrary but consistent (the point is
 * deterministic, testable adjustment math, not a real fee schedule).
 */
export const CONTRACTUAL_ALLOWANCE_RATE = 0.8;
