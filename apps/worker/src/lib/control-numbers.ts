import { randomInt } from 'node:crypto';

/**
 * Synthetic X12 control numbers for a simulated outbound 837 interchange.
 * Not derived from any real interchange sequence -- randomly generated,
 * zero-padded to the conventional field widths (ISA13: 9 digits, GS06:
 * up to 9 digits, ST02: 4 digits is a common minimum-width convention).
 * Simulation only.
 */
export interface ControlNumbers {
  isa13: string;
  gs06: string;
  st02: string;
}

function randomDigits(length: number): string {
  const max = 10 ** length;

  return String(randomInt(0, max)).padStart(length, '0');
}

export function generateControlNumbers(): ControlNumbers {
  return {
    isa13: randomDigits(9),
    gs06: randomDigits(9),
    st02: randomDigits(4),
  };
}
