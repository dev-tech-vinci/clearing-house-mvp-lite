'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';

import { ClaimDiagnosisDialog } from './claim-diagnosis-dialog';
import { removeClaimDiagnosisAction } from '../server/claim-diagnoses.actions';

interface ClaimDiagnosisRow {
  id: string;
  diagnosis_code: string;
  diagnosis_pointer: number;
  is_primary: boolean;
}

export function ClaimDiagnosesSection({
  organizationId,
  claimId,
  diagnoses,
  editable,
}: {
  organizationId: string;
  claimId: string;
  diagnoses: ClaimDiagnosisRow[];
  editable: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const removeMutation = useMutation({
    mutationFn: removeClaimDiagnosisAction,
    onSuccess: () => setTimeout(() => router.refresh(), 0),
  });

  const nextPointer =
    diagnoses.reduce((max, d) => Math.max(max, d.diagnosis_pointer), 0) + 1;

  return (
    <div className={'flex flex-col space-y-3'}>
      <div className={'flex items-center justify-between'}>
        <h3 className={'text-sm font-medium'}>Diagnoses</h3>
        {editable && (
          <Button
            variant={'outline'}
            size={'sm'}
            data-test={'add-diagnosis-trigger'}
            onClick={() => setDialogOpen(true)}
          >
            Add diagnosis
          </Button>
        )}
      </div>

      <div data-test={'claim-diagnoses-list'} className={'flex flex-col space-y-2'}>
        {diagnoses.length === 0 && (
          <p className={'text-muted-foreground text-sm'}>No diagnoses added yet.</p>
        )}

        {diagnoses.map((diagnosis) => (
          <div
            key={diagnosis.id}
            className={'flex items-center justify-between rounded-md border p-2 text-sm'}
          >
            <span>
              #{diagnosis.diagnosis_pointer} -- {diagnosis.diagnosis_code}{' '}
              {diagnosis.is_primary && <Badge variant={'secondary'}>Primary</Badge>}
            </span>
            {editable && (
              <Button
                variant={'ghost'}
                size={'sm'}
                onClick={() => {
                  const promise = removeMutation.mutateAsync({
                    diagnosisId: diagnosis.id,
                  });
                  toast.promise(() => promise, {
                    loading: 'Removing...',
                    success: 'Diagnosis removed',
                    error: 'Could not remove diagnosis',
                  });
                }}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      <ClaimDiagnosisDialog
        organizationId={organizationId}
        claimId={claimId}
        nextPointer={Math.min(nextPointer, 12)}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
