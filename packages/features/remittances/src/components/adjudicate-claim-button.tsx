'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';

import { adjudicateClaimAction } from '../server/adjudicate-claim.actions';

export function AdjudicateClaimButton({
  claimId,
  canAdjudicate,
  claimStatus,
}: {
  claimId: string;
  canAdjudicate: boolean;
  claimStatus: string;
}) {
  const router = useRouter();
  const adjudicateMutation = useMutation({ mutationFn: adjudicateClaimAction });

  if (!canAdjudicate || claimStatus !== 'accepted_for_adjudication') {
    return null;
  }

  const onAdjudicate = () => {
    const promise = adjudicateMutation.mutateAsync({ claimId }).then((result) => {
      setTimeout(() => router.refresh(), 0);

      return result;
    });

    toast.promise(() => promise, {
      loading: 'Adjudicating claim...',
      success: (result) =>
        result.outcome === 'duplicate_ignored'
          ? 'This claim was already adjudicated -- no duplicate processing occurred.'
          : `Claim adjudicated -- ${result.claimStatus}`,
      error: (error) => (error instanceof Error ? error.message : 'Could not adjudicate claim'),
    });
  };

  return (
    <Button
      data-test={'adjudicate-claim-trigger'}
      variant={'outline'}
      onClick={onAdjudicate}
      disabled={adjudicateMutation.isPending}
    >
      Adjudicate
    </Button>
  );
}
