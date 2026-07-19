import type { ControlNumbers } from './control-numbers';

/**
 * Scoped, synthetic X12-shaped payload generators. These produce
 * plausible-looking 837P/837I claim submissions and TA1/999/277CA
 * acknowledgments for the Transaction Trace UI -- they are NOT a
 * production-conformant X12 implementation (no full segment/element
 * validation, no real trading-partner envelope negotiation, one segment
 * per line for readability rather than a continuous delimited stream).
 * Every generated payload's first line says so explicitly. Do not treat
 * this as, or extend this into, a real X12 generator.
 */
const SIMULATION_HEADER_837 = (kind: '837P' | '837I') =>
  `* SIMULATED X12 ${kind} -- NOT FOR PRODUCTION USE -- Behavioral Health Clearinghouse Simulator`;

const SIMULATION_HEADER_ACK = (kind: 'TA1' | '999' | '277CA') =>
  `* SIMULATED X12 ${kind} ACKNOWLEDGMENT -- NOT FOR PRODUCTION USE -- Behavioral Health Clearinghouse Simulator`;

function timestamp() {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 16).replace(':', '');

  return { date, time };
}

export interface Synthetic837Diagnosis {
  diagnosisCode: string;
  diagnosisPointer: number;
}

export interface Synthetic837Line {
  lineNumber: number;
  serviceDate: string;
  code: string;
  units: number;
  chargeAmount: number;
}

export interface Synthetic837Input {
  simClaimId: string;
  claimType: 'professional' | 'institutional';
  controlNumbers: ControlNumbers;
  billingProviderNpi: string;
  billingProviderName: string;
  renderingProviderNpi?: string | null;
  facilityName?: string | null;
  typeOfBill?: string | null;
  subscriberName: string;
  patientName: string;
  patientDob: string;
  payerSimId: string;
  payerName: string;
  diagnoses: Synthetic837Diagnosis[];
  lines: Synthetic837Line[];
  totalCharge: number;
}

export function generate837Payload(input: Synthetic837Input): string {
  const kind = input.claimType === 'professional' ? '837P' : '837I';
  const { isa13, gs06, st02 } = input.controlNumbers;
  const { date, time } = timestamp();

  const segments: string[] = [
    SIMULATION_HEADER_837(kind),
    `ISA*00*          *00*          *ZZ*SIMSENDER      *ZZ*SIMRECEIVER    *${date}*${time}*^*00501*${isa13}*0*P*:~`,
    `GS*HC*SIMSENDER*SIMRECEIVER*20${date}*${time}*${gs06}*X*005010X222A1~`,
    `ST*837*${st02}*005010X222A1~`,
    `BHT*0019*00*${input.simClaimId}*20${date}*${time}*CH~`,
    `NM1*41*2*SIM CLEARINGHOUSE SUBMITTER*****46*${input.billingProviderNpi}~`,
    `NM1*85*2*${input.billingProviderName}*****XX*${input.billingProviderNpi}~`,
    `NM1*IL*1*${input.subscriberName}~`,
    `NM1*QC*1*${input.patientName}~`,
    `DMG*D8*${input.patientDob.replace(/-/g, '')}~`,
    `NM1*PR*2*${input.payerName}*****PI*${input.payerSimId}~`,
  ];

  if (kind === '837P' && input.renderingProviderNpi) {
    segments.push(`NM1*82*1*${input.renderingProviderNpi}~`);
  }

  if (kind === '837I') {
    if (input.facilityName) {
      segments.push(`NM1*77*2*${input.facilityName}~`);
    }

    if (input.typeOfBill) {
      segments.push(`CLM*${input.simClaimId}*${input.totalCharge.toFixed(2)}***${input.typeOfBill}:A:1*Y*A*Y*Y~`);
    }
  } else {
    segments.push(`CLM*${input.simClaimId}*${input.totalCharge.toFixed(2)}***11:B:1*Y*A*Y*Y~`);
  }

  segments.push(
    `HI*${input.diagnoses.map((d) => `ABK:${d.diagnosisCode}`).join('*')}~`,
  );

  for (const line of input.lines) {
    segments.push(`LX*${line.lineNumber}~`);
    segments.push(
      `SV1*HC:${line.code}*${line.chargeAmount.toFixed(2)}*UN*${line.units}~`,
    );
    segments.push(`DTP*472*D8*${line.serviceDate.replace(/-/g, '')}~`);
  }

  const bodySegmentCount = segments.length - 3; // exclude ISA/GS/ST from SE count
  segments.push(`SE*${bodySegmentCount}*${st02}~`);
  segments.push(`GE*1*${gs06}~`);
  segments.push(`IEA*1*${isa13}~`);

  return segments.join('\n');
}

export function generateAckPayload(
  ackType: 'TA1' | '999' | '277CA',
  controlNumbers: ControlNumbers,
  status: 'accepted' | 'rejected',
): string {
  const { isa13, gs06, st02 } = controlNumbers;
  const { date, time } = timestamp();
  const code = status === 'accepted' ? 'A' : 'R';

  const header = SIMULATION_HEADER_ACK(ackType);

  if (ackType === 'TA1') {
    return [header, `TA1*${isa13}*${date}*${time}*${code}*000~`].join('\n');
  }

  if (ackType === '999') {
    return [
      header,
      `ISA*00*          *00*          *ZZ*SIMRECEIVER    *ZZ*SIMSENDER      *${date}*${time}*^*00501*${isa13}*0*P*:~`,
      `GS*FA*SIMRECEIVER*SIMSENDER*20${date}*${time}*${gs06}*X*005010X231A1~`,
      `ST*999*${st02}*005010X231A1~`,
      `AK1*HC*${gs06}~`,
      `AK9*${code}*1*1*1~`,
      `SE*3*${st02}~`,
      `GE*1*${gs06}~`,
      `IEA*1*${isa13}~`,
    ].join('\n');
  }

  // 277CA
  return [
    header,
    `ISA*00*          *00*          *ZZ*SIMRECEIVER    *ZZ*SIMSENDER      *${date}*${time}*^*00501*${isa13}*0*P*:~`,
    `GS*HN*SIMRECEIVER*SIMSENDER*20${date}*${time}*${gs06}*X*005010X214~`,
    `ST*277*${st02}*005010X214~`,
    `STC*${code === 'A' ? 'A1:20' : 'A3:20'}*20${date}~`,
    `SE*3*${st02}~`,
    `GE*1*${gs06}~`,
    `IEA*1*${isa13}~`,
  ].join('\n');
}
