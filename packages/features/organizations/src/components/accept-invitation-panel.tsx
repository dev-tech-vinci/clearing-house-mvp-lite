'use client';

import { useState } from 'react';

import Link from 'next/link';

import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { acceptInvitationAction } from '../server/server-actions';

export function AcceptInvitationPanel({
  token,
  homeHref,
}: {
  token: string;
  homeHref: string;
}) {
  const [accepted, setAccepted] = useState(false);

  const mutation = useMutation({
    mutationFn: acceptInvitationAction,
    onSuccess: () => setAccepted(true),
  });

  if (accepted) {
    return (
      <Card className={'mx-auto max-w-md'}>
        <CardHeader>
          <CardTitle className={'flex items-center gap-x-2'}>
            <CheckCircle2 className={'h-5 w-5 text-green-600'} />
            Invitation accepted
          </CardTitle>
        </CardHeader>

        <CardContent className={'flex flex-col space-y-4'}>
          <p className={'text-muted-foreground text-sm'}>
            You now have access to the organization. Simulation data only.
          </p>

          <Button asChild>
            <Link href={homeHref}>Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={'mx-auto max-w-md'}>
      <CardHeader>
        <CardTitle>You&apos;ve been invited</CardTitle>
      </CardHeader>

      <CardContent className={'flex flex-col space-y-4'}>
        <p className={'text-muted-foreground text-sm'}>
          Accept this invitation to join the organization. This must be
          accepted with the account matching the invited email address.
        </p>

        {mutation.isError && (
          <div
            data-test={'accept-invitation-error'}
            className={
              'flex items-start gap-x-2 rounded-md border border-destructive/50 p-3 text-sm text-destructive'
            }
          >
            <XCircle className={'mt-0.5 h-4 w-4 shrink-0'} />
            <span>
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Could not accept this invitation.'}
            </span>
          </div>
        )}

        <Button
          data-test={'accept-invitation-button'}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ token })}
        >
          Accept invitation
        </Button>
      </CardContent>
    </Card>
  );
}
