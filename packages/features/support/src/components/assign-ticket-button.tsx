'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';

import { assignTicketAction } from '../server/assign-ticket.actions';

export function AssignTicketButton({
  ticketId,
  organizationId,
}: {
  ticketId: string;
  organizationId: string;
}) {
  const router = useRouter();
  const assignMutation = useMutation({ mutationFn: assignTicketAction });

  const onClick = () => {
    const promise = assignMutation
      .mutateAsync({ ticketId, organizationId })
      .then(() => setTimeout(() => router.refresh(), 0));

    toast.promise(() => promise, {
      loading: 'Assigning...',
      success: 'Ticket assigned to you',
      error: (error) => (error instanceof Error ? error.message : 'Could not assign ticket'),
    });
  };

  return (
    <Button data-test={'assign-to-me-trigger'} variant={'outline'} onClick={onClick} disabled={assignMutation.isPending}>
      Assign to me
    </Button>
  );
}
