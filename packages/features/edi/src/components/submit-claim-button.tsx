'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';

import { submitClaimAction } from '../server/submit-claim.actions';

export function SubmitClaimButton({
  claimId,
  canSubmit,
  claimStatus,
}: {
  claimId: string;
  canSubmit: boolean;
  claimStatus: string;
}) {
  const router = useRouter();
  const submitMutation = useMutation({ mutationFn: submitClaimAction });

  if (!canSubmit || claimStatus !== 'approved') {
    return null;
  }

  const onSubmit = () => {
    const promise = submitMutation.mutateAsync({ claimId }).then((result) => {
      setTimeout(() => router.refresh(), 0);

      return result;
    });

    toast.promise(() => promise, {
      loading: 'Submitting claim...',
      success: (result) =>
        result.outcome === 'duplicate_ignored'
          ? 'This claim was already submitted -- no duplicate processing occurred.'
          : `Claim submitted -- status: ${result.claimStatus.replace(/_/g, ' ')}`,
      error: (error) => (error instanceof Error ? error.message : 'Could not submit claim'),
    });
  };

  return (
    <Button
      data-test={'submit-claim-trigger'}
      onClick={onSubmit}
      disabled={submitMutation.isPending}
    >
      Submit
    </Button>
  );
}
