/**
 * The deliberate 837P/837I subset excludes these loops (see the
 * architecture doc's "Claim-type scope" section and
 * docs/05-claim-lifecycle.md). They are validated-as-out-of-scope with an
 * explicit message, not silently accepted or silently dropped. Checked
 * against the raw request body's top-level keys before Zod parsing in
 * `POST /api/v1/claims`, since the Zod schema itself simply doesn't define
 * these fields (so Zod alone would just ignore them rather than reject
 * them with a helpful message).
 */
export const UNSUPPORTED_LOOP_KEYS: Record<string, string> = {
  coordinationOfBenefits:
    'Coordination of benefits / secondary payer claims are not supported in this simulation.',
  secondaryPayerId:
    'Coordination of benefits / secondary payer claims are not supported in this simulation.',
  ambulanceCertification:
    'Ambulance / spinal certification loops are not supported in this simulation.',
  drugCode:
    'Drug (LIN/CTP) detail is not supported in this simulation.',
  claimAttachments:
    'Full 2300 claim-level attachments are not supported in this simulation -- use claim_documents metadata only.',
  supervisingProviderId:
    'Provider loops beyond the rendering provider (2420) are not supported in this simulation.',
  referringProviderId:
    'Provider loops beyond the rendering provider (2420) are not supported in this simulation.',
  orderingProviderId:
    'Provider loops beyond the rendering provider (2420) are not supported in this simulation.',
  ncpdpClaim: 'NCPDP pharmacy claims are not supported in this simulation.',
  occurrenceCodes: 'Occurrence/value/condition codes are not supported in this simulation.',
  valueCodes: 'Occurrence/value/condition codes are not supported in this simulation.',
  conditionCodes: 'Occurrence/value/condition codes are not supported in this simulation.',
};

export interface UnsupportedLoopMatch {
  loop: string;
  message: string;
}

export function findUnsupportedLoop(
  body: Record<string, unknown>,
): UnsupportedLoopMatch | null {
  for (const key of Object.keys(body)) {
    const message = UNSUPPORTED_LOOP_KEYS[key];

    if (message) {
      return { loop: key, message };
    }
  }

  return null;
}
