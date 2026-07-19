'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';

import { ClaimDiagnosesSection } from './claim-diagnoses-section';
import { ClaimLinesSection } from './claim-lines-section';
import { ValidationResultsPanel } from './validation-results-panel';
import type { ValidationError } from '../lib/validate-claim';
import { approveClaimAction, validateClaimAction } from '../server/claims.actions';

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  draft: 'outline',
  validation_failed: 'destructive',
  validated: 'secondary',
  approved: 'default',
};

interface PersonRef {
  first_name: string;
  last_name: string;
  sim_patient_id?: string;
  sim_subscriber_id?: string;
}

interface ProviderRef {
  sim_provider_id: string;
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
}

interface FacilityRef {
  sim_facility_id: string;
  name: string;
}

export interface ClaimDetail {
  id: string;
  organization_id: string;
  sim_claim_id: string;
  claim_type: 'professional' | 'institutional';
  status: string;
  notes: string | null;
  validated_at: string | null;
  last_validation_result: ValidationError[] | null;
  approved_at: string | null;
  patient: PersonRef | null;
  subscriber: PersonRef | null;
  coverage: { payer_label: string; member_id: string } | null;
  billing_provider: ProviderRef | null;
  professional:
    | { rendering_provider_id: string; rendering_provider: ProviderRef | null }
    | { rendering_provider_id: string; rendering_provider: ProviderRef | null }[]
    | null;
  institutional:
    | {
        facility_id: string;
        type_of_bill: string;
        admission_date: string | null;
        discharge_date: string | null;
        facility: FacilityRef | null;
      }
    | {
        facility_id: string;
        type_of_bill: string;
        admission_date: string | null;
        discharge_date: string | null;
        facility: FacilityRef | null;
      }[]
    | null;
  diagnoses: { id: string; diagnosis_code: string; diagnosis_pointer: number; is_primary: boolean }[];
  lines: {
    id: string;
    line_number: number;
    service_date: string;
    procedure_code: string | null;
    revenue_code: string | null;
    units: number;
    charge_amount: number;
    place_of_service: string | null;
    diagnosis_pointers: number[];
  }[];
}

function providerName(provider: ProviderRef | null) {
  if (!provider) {
    return '';
  }

  return provider.organization_name ?? `${provider.first_name} ${provider.last_name}`;
}

function single<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export function ClaimDetailPageContent({
  organizationId,
  claim,
  canCreateEdit,
  canApprove,
}: {
  organizationId: string;
  claim: ClaimDetail;
  canCreateEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();

  const validateMutation = useMutation({
    mutationFn: validateClaimAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const approveMutation = useMutation({
    mutationFn: approveClaimAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const professional = single(claim.professional);
  const institutional = single(claim.institutional);
  const editable = canCreateEdit && claim.status !== 'approved';

  const onValidate = () => {
    const promise = validateMutation.mutateAsync({ claimId: claim.id });

    toast.promise(() => promise, {
      loading: 'Validating...',
      success: (result) =>
        result.status === 'validated'
          ? 'Claim validated -- no errors'
          : `Validation failed -- ${result.errors.length} issue(s)`,
      error: 'Could not validate claim',
    });
  };

  const onApprove = () => {
    const promise = approveMutation.mutateAsync({ claimId: claim.id });

    toast.promise(() => promise, {
      loading: 'Approving...',
      success: 'Claim approved',
      error: (error) => (error instanceof Error ? error.message : 'Could not approve claim'),
    });
  };

  return (
    <div className={'flex flex-col space-y-6'}>
      <div className={'flex items-center justify-between'}>
        <div>
          <h2 className={'text-lg font-semibold'}>{claim.sim_claim_id}</h2>
          <p className={'text-muted-foreground text-sm'}>
            {claim.claim_type === 'professional' ? '837P Professional' : '837I Institutional'}
          </p>
        </div>
        <Badge data-test={'claim-status-badge'} variant={STATUS_VARIANT[claim.status] ?? 'outline'}>
          {claim.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className={'grid grid-cols-2 gap-4 rounded-md border p-4 text-sm'}>
        <div>
          <span className={'text-muted-foreground'}>Patient: </span>
          {claim.patient ? `${claim.patient.first_name} ${claim.patient.last_name}` : ''}
        </div>
        <div>
          <span className={'text-muted-foreground'}>Subscriber: </span>
          {claim.subscriber
            ? `${claim.subscriber.first_name} ${claim.subscriber.last_name}`
            : ''}
        </div>
        <div>
          <span className={'text-muted-foreground'}>Payer: </span>
          {claim.coverage?.payer_label}
        </div>
        <div>
          <span className={'text-muted-foreground'}>Billing provider: </span>
          {providerName(claim.billing_provider)}
        </div>
        {claim.claim_type === 'professional' && professional && (
          <div>
            <span className={'text-muted-foreground'}>Rendering provider: </span>
            {providerName(professional.rendering_provider)}
          </div>
        )}
        {claim.claim_type === 'institutional' && institutional && (
          <>
            <div>
              <span className={'text-muted-foreground'}>Facility: </span>
              {institutional.facility?.name}
            </div>
            <div>
              <span className={'text-muted-foreground'}>Type of bill: </span>
              {institutional.type_of_bill}
            </div>
          </>
        )}
      </div>

      <ClaimDiagnosesSection
        organizationId={organizationId}
        claimId={claim.id}
        diagnoses={claim.diagnoses}
        editable={editable}
      />

      <ClaimLinesSection
        organizationId={organizationId}
        claimId={claim.id}
        claimType={claim.claim_type}
        lines={claim.lines}
        diagnoses={claim.diagnoses}
        editable={editable}
      />

      <div className={'flex gap-x-2'}>
        {editable && (
          <Button
            variant={'outline'}
            data-test={'validate-claim-trigger'}
            onClick={onValidate}
            disabled={validateMutation.isPending}
          >
            Validate
          </Button>
        )}
        {canApprove && claim.status === 'validated' && (
          <Button
            data-test={'approve-claim-trigger'}
            onClick={onApprove}
            disabled={approveMutation.isPending}
          >
            Approve
          </Button>
        )}
      </div>

      {claim.last_validation_result !== null && (
        <ValidationResultsPanel errors={claim.last_validation_result} />
      )}
    </div>
  );
}
