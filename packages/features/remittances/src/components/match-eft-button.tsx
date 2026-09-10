'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';

import { matchEftAction } from '../server/match-eft.actions';

export function MatchEftButton({
  remittanceId,
  canPostPayment,
  remittanceStatus,
}: {
  remittanceId: string;
  canPostPayment: boolean;
  remittanceStatus: string;
}) {
  const router = useRouter();
  const matchMutation = useMutation({ mutationFn: matchEftAction });

  if (!canPostPayment || remittanceStatus !== 'paid') {
    return null;
  }

  const onMatch = () => {
    const promise = matchMutation.mutateAsync({ remittanceId }).then((result) => {
      setTimeout(() => router.refresh(), 0);

      return result;
    });

    toast.promise(() => promise, {
      loading: 'Matching EFT deposit...',
      success: (result) =>
        result.outcome === 'duplicate_ignored'
          ? 'This EFT deposit was already matched -- no duplicate processing occurred.'
          : 'Payment matched and posted',
      error: (error) => (error instanceof Error ? error.message : 'Could not match EFT deposit'),
    });
  };

  return (
    <Button
      data-test={'match-eft-trigger'}
      size={'sm'}
      onClick={onMatch}
      disabled={matchMutation.isPending}
    >
      Match EFT
    </Button>
  );
}
