'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';

import { createMessageAction } from '../server/create-message.actions';

interface MessageRow {
  id: string;
  body: string;
  is_internal_note: boolean;
  sender_id: string | null;
  created_at: string | null;
}

export function TicketMessages({
  ticketId,
  organizationId,
  messages,
  canPostInternalNotes,
}: {
  ticketId: string;
  organizationId: string;
  messages: MessageRow[];
  canPostInternalNotes: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  const createMutation = useMutation({ mutationFn: createMessageAction });

  const onSubmit = () => {
    if (!body.trim()) {
      return;
    }

    const promise = createMutation
      .mutateAsync({ ticketId, organizationId, body, isInternalNote })
      .then(() => {
        setBody('');
        setIsInternalNote(false);
        setTimeout(() => router.refresh(), 0);
      });

    toast.promise(() => promise, {
      loading: 'Sending...',
      success: 'Message sent',
      error: (error) => (error instanceof Error ? error.message : 'Could not send message'),
    });
  };

  return (
    <div data-test={'ticket-messages'} className={'flex flex-col space-y-4'}>
      <div className={'flex flex-col space-y-2'}>
        {messages.map((message) => (
          <div
            key={message.id}
            data-test={'ticket-message-row'}
            className={
              'rounded-md border p-3 text-sm ' +
              (message.is_internal_note ? 'border-amber-500/50 bg-amber-500/5' : '')
            }
          >
            <div className={'flex items-center gap-x-2'}>
              {message.is_internal_note && (
                <Badge data-test={'internal-note-badge'} variant={'outline'}>
                  Internal note
                </Badge>
              )}
              <span className={'text-muted-foreground text-xs'}>
                {message.created_at ? new Date(message.created_at).toLocaleString() : ''}
              </span>
            </div>
            <p className={'mt-1'}>{message.body}</p>
          </div>
        ))}
      </div>

      <div className={'flex flex-col space-y-2'}>
        <Textarea
          data-test={'ticket-message-input'}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={'Write a reply...'}
        />

        {canPostInternalNotes && (
          <div className={'flex items-center gap-x-2'}>
            <Checkbox
              id={'internal-note-checkbox'}
              data-test={'internal-note-checkbox'}
              checked={isInternalNote}
              onCheckedChange={(checked) => setIsInternalNote(checked === true)}
            />
            <Label htmlFor={'internal-note-checkbox'} className={'text-sm'}>
              Internal note (never visible to the customer)
            </Label>
          </div>
        )}

        <div className={'flex justify-end'}>
          <Button
            data-test={'send-message-trigger'}
            onClick={onSubmit}
            disabled={createMutation.isPending || !body.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
