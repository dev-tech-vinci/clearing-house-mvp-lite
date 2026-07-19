'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';

import { updateTicketStatusAction } from '../server/assign-ticket.actions';

export function TicketStatusSelect({
  ticketId,
  organizationId,
  status,
}: {
  ticketId: string;
  organizationId: string;
  status: string;
}) {
  const router = useRouter();
  const updateMutation = useMutation({ mutationFn: updateTicketStatusAction });

  const onValueChange = (value: string) => {
    const promise = updateMutation
      .mutateAsync({
        ticketId,
        organizationId,
        status: value as 'open' | 'in_progress' | 'resolved' | 'closed',
      })
      .then(() => setTimeout(() => router.refresh(), 0));

    toast.promise(() => promise, {
      loading: 'Updating status...',
      success: 'Ticket status updated',
      error: (error) => (error instanceof Error ? error.message : 'Could not update status'),
    });
  };

  return (
    <Select onValueChange={onValueChange} value={status} disabled={updateMutation.isPending}>
      <SelectTrigger data-test={'ticket-status-select'} className={'w-40'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={'open'}>Open</SelectItem>
        <SelectItem value={'in_progress'}>In progress</SelectItem>
        <SelectItem value={'resolved'}>Resolved</SelectItem>
        <SelectItem value={'closed'}>Closed</SelectItem>
      </SelectContent>
    </Select>
  );
}
