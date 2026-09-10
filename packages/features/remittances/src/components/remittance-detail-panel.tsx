'use client';

import { Badge } from '@kit/ui/badge';

import { MatchEftButton } from './match-eft-button';

interface ClaimAdjustment {
  id: string;
  adjustment_group: string;
  carc_code: string;
  rarc_code: string | null;
  amount: number;
  explanation: string;
  rule_id: string | null;
}

interface RemitClaim {
  id: string;
  charge_amount: number;
  paid_amount: number;
  patient_responsibility: number;
  claim_adjustments: ClaimAdjustment[];
}

interface RemittanceDetail {
  id: string;
  sim_remittance_id: string;
  outcome: string;
  status: string;
  total_paid_amount: number;
  payer: { sim_payer_id: string; display_name: string } | null;
  remit_claims: RemitClaim | null;
  eft_traces: { id: string; eft_trace_number: string; amount: number; effective_date: string } | null;
  payment_matches: { id: string; matched_amount: number; matched_at: string | null }[];
}

/**
 * Shows the full remittance breakdown for a claim: payment/adjustment
 * detail, CARC/RARC codes (SIM- prefixed simulated codes, not asserted
 * official meanings), EFT trace, and reconciliation status. A denied
 * remittance never shows an EFT trace or a Match EFT action -- there is
 * no code path that creates one for a denial.
 */
export function RemittanceDetailPanel({
  remittance,
  canPostPayment,
}: {
  remittance: RemittanceDetail;
  canPostPayment: boolean;
}) {
  const remitClaim = remittance.remit_claims;
  const eftTrace = remittance.eft_traces;
  const paymentMatch = remittance.payment_matches[0];

  return (
    <div data-test={'remittance-detail-panel'} className={'flex flex-col space-y-4'}>
      <div className={'flex items-center justify-between'}>
        <div>
          <h3 className={'text-sm font-medium'}>{remittance.sim_remittance_id}</h3>
          <p className={'text-muted-foreground text-xs'}>
            {remittance.payer?.display_name} ({remittance.payer?.sim_payer_id})
          </p>
        </div>
        <div className={'flex gap-x-2'}>
          <Badge
            data-test={'remittance-outcome-badge'}
            variant={remittance.outcome === 'denied' ? 'destructive' : 'secondary'}
          >
            {remittance.outcome}
          </Badge>
          <Badge variant={'outline'}>{remittance.status.replaceAll('_', ' ')}</Badge>
        </div>
      </div>

      {remitClaim && (
        <div className={'grid grid-cols-3 gap-4 rounded-md border p-3 text-sm'}>
          <div>
            <span className={'text-muted-foreground text-xs'}>Charge</span>
            <p>${Number(remitClaim.charge_amount).toFixed(2)}</p>
          </div>
          <div>
            <span className={'text-muted-foreground text-xs'}>Paid</span>
            <p>${Number(remitClaim.paid_amount).toFixed(2)}</p>
          </div>
          <div>
            <span className={'text-muted-foreground text-xs'}>Patient responsibility</span>
            <p>${Number(remitClaim.patient_responsibility).toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className={'flex flex-col space-y-2'}>
        <h4 className={'text-sm font-medium'}>Adjustments</h4>
        {(remitClaim?.claim_adjustments ?? []).map((adjustment) => (
          <div
            key={adjustment.id}
            data-test={'claim-adjustment-row'}
            className={'rounded-md border p-2 text-sm'}
          >
            <div className={'flex items-center gap-x-2'}>
              <Badge variant={'outline'}>{adjustment.adjustment_group}</Badge>
              <span className={'font-mono text-xs'}>{adjustment.carc_code}</span>
              {adjustment.rarc_code && (
                <span className={'font-mono text-xs'}>{adjustment.rarc_code}</span>
              )}
              <span className={'text-muted-foreground text-xs'}>
                ${Number(adjustment.amount).toFixed(2)}
              </span>
            </div>
            <p className={'mt-1 text-xs'}>{adjustment.explanation}</p>
          </div>
        ))}
      </div>

      {eftTrace && (
        <div className={'flex items-center justify-between rounded-md border p-3 text-sm'}>
          <div>
            <span className={'text-muted-foreground text-xs'}>EFT trace</span>
            <p className={'font-mono'}>
              {eftTrace.eft_trace_number} -- ${Number(eftTrace.amount).toFixed(2)}
            </p>
          </div>
          {paymentMatch ? (
            <Badge variant={'default'}>Matched</Badge>
          ) : (
            <MatchEftButton
              remittanceId={remittance.id}
              canPostPayment={canPostPayment}
              remittanceStatus={remittance.status}
            />
          )}
        </div>
      )}
    </div>
  );
}
