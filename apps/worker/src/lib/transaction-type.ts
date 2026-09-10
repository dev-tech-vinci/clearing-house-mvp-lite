/**
 * Maps a claim's claim_type to the X12 transaction type
 * payer_supported_transactions checks it against. Extracted as its own
 * pure function (rather than an inline ternary in claim-processor.ts)
 * specifically so the payer-route-enforcement decision has a unit-testable
 * seam -- the rest of that enforcement path needs a live DB and is
 * proven end-to-end by the Phase 9 Python client's negative test instead.
 */
export function resolveClaimTransactionType(
  claimType: 'professional' | 'institutional' | string,
): '837P' | '837I' {
  return claimType === 'institutional' ? '837I' : '837P';
}
