import { describe, expect, it } from 'vitest';

import { resolveClaimTransactionType } from './transaction-type';

describe('resolveClaimTransactionType', () => {
  it('maps professional claims to 837P', () => {
    expect(resolveClaimTransactionType('professional')).toBe('837P');
  });

  it('maps institutional claims to 837I', () => {
    expect(resolveClaimTransactionType('institutional')).toBe('837I');
  });

  it('defaults an unrecognized claim_type to 837P rather than throwing', () => {
    expect(resolveClaimTransactionType('something-unexpected')).toBe('837P');
  });
});
