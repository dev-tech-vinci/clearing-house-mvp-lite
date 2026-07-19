'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';

import { endAccessSessionAction } from '../server/end-access-session.actions';
import { startAccessSessionAction } from '../server/start-access-session.actions';
import { SupportAccessBanner } from './support-access-banner';

interface ActiveSession {
  id: string;
  reason: string;
  started_at: string | null;
  expires_at: string;
}

/**
 * The no-silent-impersonation control surface: starting a session
 * requires a typed reason (min 10 chars, enforced by
 * StartAccessSessionSchema) and a bounded duration; while active, a
 * prominent SUPPORT ACCESS ACTIVE banner is shown and the only action
 * available is ending it early. The DB is still the real gate
 * (support_access_sessions_insert's WITH CHECK requires the ticket's
 * assigned_to to already equal the caller) -- isAssignedToMe just avoids
 * showing a form that would only ever fail with a confusing RLS error.
 */
export function AccessSessionControl({
  ticketId,
  organizationId,
  activeSession,
  isAssignedToMe,
}: {
  ticketId: string;
  organizationId: string;
  activeSession: ActiveSession | null;
  isAssignedToMe: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);

  const startMutation = useMutation({ mutationFn: startAccessSessionAction });
  const endMutation = useMutation({ mutationFn: endAccessSessionAction });

  const onStart = () => {
    const promise = startMutation
      .mutateAsync({ ticketId, organizationId, reason, durationMinutes })
      .then(() => {
        setReason('');
        setTimeout(() => router.refresh(), 0);
      });

    toast.promise(() => promise, {
      loading: 'Starting support-access session...',
      success: 'Support-access session started',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not start support-access session',
    });
  };

  const onEnd = () => {
    if (!activeSession) {
      return;
    }

    const promise = endMutation
      .mutateAsync({ sessionId: activeSession.id, organizationId })
      .then(() => setTimeout(() => router.refresh(), 0));

    toast.promise(() => promise, {
      loading: 'Ending support-access session...',
      success: 'Support-access session ended',
      error: (error) =>
        error instanceof Error ? error.message : 'Could not end support-access session',
    });
  };

  if (activeSession) {
    return (
      <div className={'flex flex-col space-y-3'}>
        <SupportAccessBanner reason={activeSession.reason} expiresAt={activeSession.expires_at} />
        <div>
          <Button
            data-test={'end-access-session-trigger'}
            variant={'outline'}
            onClick={onEnd}
            disabled={endMutation.isPending}
          >
            End session now
          </Button>
        </div>
      </div>
    );
  }

  if (!isAssignedToMe) {
    return (
      <div
        data-test={'access-session-unavailable'}
        className={'text-muted-foreground rounded-md border border-dashed p-4 text-sm'}
      >
        Assign this ticket to yourself before starting a support-access session.
      </div>
    );
  }

  return (
    <div data-test={'start-access-session-form'} className={'flex flex-col space-y-2 rounded-md border p-4'}>
      <Label htmlFor={'access-session-reason'}>Reason for support access</Label>
      <Textarea
        id={'access-session-reason'}
        data-test={'access-session-reason-input'}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={'e.g. Investigating a stuck claim per customer request on this ticket'}
      />

      <Label htmlFor={'access-session-duration'}>Duration (minutes, max 240)</Label>
      <Input
        id={'access-session-duration'}
        data-test={'access-session-duration-input'}
        type={'number'}
        min={5}
        max={240}
        value={durationMinutes}
        onChange={(event) => setDurationMinutes(Number(event.target.value))}
      />

      <div>
        <Button
          data-test={'start-access-session-trigger'}
          onClick={onStart}
          disabled={startMutation.isPending || reason.trim().length < 10}
        >
          Start support-access session
        </Button>
      </div>
    </div>
  );
}
