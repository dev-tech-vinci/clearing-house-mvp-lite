/**
 * @name isValidNpiChecksum
 * @description Validates the check digit of a 10-digit NPI using the CMS
 * NPI algorithm (Luhn applied to the 9-digit base number prefixed with the
 * constant "80840"). Assumes the input is already exactly 10 digits --
 * callers should check `/^\d{10}$/` first (the Zod schemas do).
 */
export function isValidNpiChecksum(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) {
    return false;
  }

  const digits = `80840${npi.slice(0, 9)}`.split('').map(Number);

  let sum = 0;
  let doubleDigit = true;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i] as number;

    if (doubleDigit) {
      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    doubleDigit = !doubleDigit;
  }

  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === Number(npi[9]);
}
