/**
 * Small, illustrative, non-exhaustive synthetic code reference lists for
 * the claim builders. These are NOT a licensed code set -- they exist only
 * so the demo has a closed, obviously-BH-relevant list to pick from.
 * Descriptions are short, original, plain-English summaries, not copied
 * from any official ICD-10-CM/CPT/HCPCS/UB-04 code manual. Do not extend
 * this into anything resembling a full code set -- see CLAUDE.md's
 * guardrail against reproducing large copyrighted code sets.
 */

export interface SyntheticCode {
  code: string;
  label: string;
}

export const SYNTHETIC_ICD10_CODES: SyntheticCode[] = [
  { code: 'F32.9', label: 'Depressive episode, unspecified' },
  { code: 'F33.1', label: 'Recurrent depressive disorder, moderate' },
  { code: 'F41.1', label: 'Generalized anxiety disorder' },
  { code: 'F43.10', label: 'Post-traumatic stress disorder, unspecified' },
  { code: 'F90.9', label: 'Attention-deficit hyperactivity disorder, unspecified type' },
  { code: 'F31.9', label: 'Bipolar disorder, unspecified' },
  { code: 'F10.20', label: 'Alcohol use disorder, moderate' },
  { code: 'F84.0', label: 'Autism spectrum disorder' },
  { code: 'F60.3', label: 'Borderline personality disorder' },
  { code: 'F42.9', label: 'Obsessive-compulsive disorder, unspecified' },
];

export const SYNTHETIC_CPT_HCPCS_CODES: SyntheticCode[] = [
  { code: '90791', label: 'Psychiatric diagnostic evaluation' },
  { code: '90792', label: 'Psychiatric diagnostic evaluation with medical services' },
  { code: '90834', label: 'Psychotherapy, 45 minutes' },
  { code: '90837', label: 'Psychotherapy, 60 minutes' },
  { code: '90847', label: 'Family psychotherapy, with patient present' },
  { code: '90853', label: 'Group psychotherapy' },
  { code: 'H0015', label: 'Intensive outpatient treatment service' },
  { code: 'H2011', label: 'Crisis intervention service, per 15 minutes' },
];

export const SYNTHETIC_REVENUE_CODES: SyntheticCode[] = [
  { code: '0100', label: 'All-inclusive room and board' },
  { code: '0124', label: 'Room and board, psychiatric' },
  { code: '0900', label: 'Behavioral health treatment/services' },
  { code: '0914', label: 'Individual therapy' },
  { code: '0915', label: 'Group therapy' },
];

export const SYNTHETIC_TYPE_OF_BILL_CODES: SyntheticCode[] = [
  { code: '0111', label: 'Hospital inpatient' },
  { code: '0131', label: 'Hospital outpatient' },
  { code: '0761', label: 'Partial hospitalization (PHP)' },
  { code: '0861', label: 'Psychiatric residential treatment facility (PRTF)' },
];

export const SYNTHETIC_PLACE_OF_SERVICE_CODES: SyntheticCode[] = [
  { code: '11', label: 'Office' },
  { code: '02', label: 'Telehealth' },
  { code: '22', label: 'Outpatient hospital' },
];
