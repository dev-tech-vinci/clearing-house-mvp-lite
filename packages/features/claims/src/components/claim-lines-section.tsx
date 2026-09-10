'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';

import { ClaimLineDialog } from './claim-line-dialog';
import { removeClaimLineAction } from '../server/claim-lines.actions';

interface ClaimLineRow {
  id: string;
  line_number: number;
  service_date: string;
  procedure_code: string | null;
  revenue_code: string | null;
  units: number;
  charge_amount: number;
  place_of_service: string | null;
  diagnosis_pointers: number[];
}

interface ClaimDiagnosisRow {
  diagnosis_pointer: number;
  diagnosis_code: string;
}

export function ClaimLinesSection({
  organizationId,
  claimId,
  claimType,
  lines,
  diagnoses,
  editable,
}: {
  organizationId: string;
  claimId: string;
  claimType: 'professional' | 'institutional';
  lines: ClaimLineRow[];
  diagnoses: ClaimDiagnosisRow[];
  editable: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const removeMutation = useMutation({
    mutationFn: removeClaimLineAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const nextLineNumber =
    lines.reduce((max, line) => Math.max(max, line.line_number), 0) + 1;

  const totalCharge = lines.reduce((sum, line) => sum + Number(line.charge_amount), 0);

  return (
    <div className={'flex flex-col space-y-3'}>
      <div className={'flex items-center justify-between'}>
        <h3 className={'text-sm font-medium'}>Service lines</h3>
        {editable && (
          <Button
            variant={'outline'}
            size={'sm'}
            data-test={'add-claim-line-trigger'}
            onClick={() => setDialogOpen(true)}
          >
            Add line
          </Button>
        )}
      </div>

      <div data-test={'claim-lines-list'} className={'flex flex-col space-y-2'}>
        {lines.length === 0 && (
          <p className={'text-muted-foreground text-sm'}>No service lines added yet.</p>
        )}

        {lines.map((line) => (
          <div
            key={line.id}
            className={'flex items-center justify-between rounded-md border p-2 text-sm'}
          >
            <span>
              #{line.line_number} -- {line.service_date} --{' '}
              {line.procedure_code ?? line.revenue_code} -- {line.units} unit(s) -- $
              {Number(line.charge_amount).toFixed(2)}
            </span>
            {editable && (
              <Button
                variant={'ghost'}
                size={'sm'}
                onClick={() => {
                  const promise = removeMutation.mutateAsync({ lineId: line.id });
                  toast.promise(() => promise, {
                    loading: 'Removing...',
                    success: 'Line removed',
                    error: 'Could not remove line',
                  });
                }}
              >
                Remove
              </Button>
            )}
          </div>
        ))}

        {lines.length > 0 && (
          <p className={'text-sm font-medium'}>
            Claim-level total: ${totalCharge.toFixed(2)}
          </p>
        )}
      </div>

      <ClaimLineDialog
        organizationId={organizationId}
        claimId={claimId}
        claimType={claimType}
        nextLineNumber={nextLineNumber}
        diagnoses={diagnoses}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
